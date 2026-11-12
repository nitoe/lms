/**
 * Publikasi snapshot Try Out TKA ke portal orang tua.
 * - Publish per kelas × tahap (6A_I, 6B_I, …)
 * - Ranking 10 besar dari gabungan 6A+6B
 * - Rata tahap I: BI+MTK; tahap II–V: BI+MTK+IPA
 * - Sebaran capaian (kompleksitas / materi / domain IPA) dari jawaban LMS bila ada
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { daftarJawabanKuis } from './jawabanKuis'
import { ambilKuis } from './kuis'
import { bangunRekapTka } from './rekapTka'
import { KELAS_TKA, type MapelTkaNama } from './tkaAkses'
import type { TahapTryOutTka } from '../types/kuis'
import type { Soal } from '../types/soal'
import {
  NAMA_DOMAIN_TKA,
  NAMA_KOMPLEKSITAS,
  normalisasiKompleksitas,
  normalisasiDomainTka,
  type DomainTka,
  type KompleksitasSoal,
} from '../types/soal'
import type {
  MapelOrtuTka,
  NilaiOrtuTka,
  SebaranBarisOrtu,
  SebaranMapelOrtu,
  SebaranOrtuTka,
  TkaHasilOrtuDok,
  TkaPeringkatBaris,
  TkaPeringkatDok,
  TkaPublikasiDok,
} from '../types/tkaPublikasi'
import {
  idTkaHasilOrtu,
  idTkaPublikasi,
} from '../types/tkaPublikasi'

const MAPEL_KE_ORTU: Record<MapelTkaNama, MapelOrtuTka> = {
  'TKA Bahasa Indonesia': 'BI',
  'TKA Matematika': 'MTK',
  'TKA IPA': 'IPA',
}

const ORTU_KE_MAPEL: Record<MapelOrtuTka, MapelTkaNama> = {
  BI: 'TKA Bahasa Indonesia',
  MTK: 'TKA Matematika',
  IPA: 'TKA IPA',
}

/** Tahap I: 2 mapel; II–V: 3 mapel. */
export function mapelUntukRata(tahap: TahapTryOutTka): MapelOrtuTka[] {
  if (tahap === 'I') return ['BI', 'MTK']
  return ['BI', 'MTK', 'IPA']
}

export function hitungRataRata(
  nilai: NilaiOrtuTka,
  tahap: TahapTryOutTka,
): number | null {
  const keys = mapelUntukRata(tahap)
  const nums: number[] = []
  for (const k of keys) {
    const v = nilai[k]
    if (v == null || Number.isNaN(Number(v))) return null
    nums.push(Number(v))
  }
  if (nums.length === 0) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return Math.round((sum / nums.length) * 10) / 10
}

/**
 * Hitung sebaran capaian dari snapshot soal kuis + detail jawaban siswa.
 * Pola sama dengan HasilTka di SiswaTka.tsx.
 */
export function hitungSebaranDariDetail(
  soalList: Soal[] | undefined,
  detail: { soalId: string; benar?: boolean }[] | undefined,
): SebaranMapelOrtu | null {
  if (!soalList?.length || !detail?.length) return null
  const peta = new Map(detail.map((d) => [d.soalId, d.benar === true]))

  type Acc = { key: string; nama: string; benar: number; total: number }
  const kMap = new Map<string, Acc>()
  const mMap = new Map<string, Acc>()
  const dMap = new Map<string, Acc>()

  for (const s of soalList) {
    const benar = peta.get(s.id) === true ? 1 : 0
    const kk = normalisasiKompleksitas(s.kompleksitas) as KompleksitasSoal
    const kn = NAMA_KOMPLEKSITAS[kk]
    const kb = kMap.get(kk) ?? { key: kk, nama: kn, benar: 0, total: 0 }
    kb.benar += benar
    kb.total += 1
    kMap.set(kk, kb)

    if (s.tipeMateri) {
      const key = s.tipeMateri
      const mb = mMap.get(key) ?? { key, nama: s.tipeMateri, benar: 0, total: 0 }
      mb.benar += benar
      mb.total += 1
      mMap.set(key, mb)
    }

    const dom = normalisasiDomainTka(s.domainTka)
    if (dom) {
      const dn = NAMA_DOMAIN_TKA[dom as DomainTka]
      const db = dMap.get(dom) ?? { key: dom, nama: dn, benar: 0, total: 0 }
      db.benar += benar
      db.total += 1
      dMap.set(dom, db)
    }
  }

  const toBaris = (m: Map<string, Acc>): SebaranBarisOrtu[] =>
    [...m.values()].map((b) => ({
      key: b.key,
      nama: b.nama,
      benar: b.benar,
      total: b.total,
      persen: b.total ? Math.round((b.benar / b.total) * 1000) / 10 : 0,
    }))

  const out: SebaranMapelOrtu = {}
  const kompleksitas = toBaris(kMap)
  const materi = toBaris(mMap)
  const domain = toBaris(dMap)
  if (kompleksitas.length) out.kompleksitas = kompleksitas
  if (materi.length) out.materi = materi
  if (domain.length) out.domain = domain
  return kompleksitas.length || materi.length || domain.length ? out : null
}

/**
 * Bangun ranking gabungan 6A+6B untuk satu tahap dari data manual/rekap.
 * Hanya siswa dengan rata-rata lengkap (sesuai aturan tahap) yang masuk.
 */
export function bangunRankingGabungan(
  tahap: TahapTryOutTka,
  peserta: { siswaId: string; siswaNama: string; kelas: string; nilai: NilaiOrtuTka }[],
): { ranked: TkaPeringkatBaris[]; jumlahPeserta: number } {
  const withRata = peserta
    .map((p) => {
      const rata = hitungRataRata(p.nilai, tahap)
      return rata == null ? null : { ...p, rataRata: rata }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  withRata.sort(
    (a, b) =>
      b.rataRata - a.rataRata ||
      a.siswaNama.localeCompare(b.siswaNama, 'id') ||
      a.kelas.localeCompare(b.kelas),
  )

  const ranked: TkaPeringkatBaris[] = withRata.map((p, i) => ({
    peringkat: i + 1,
    siswaId: p.siswaId,
    siswaNama: p.siswaNama,
    kelas: p.kelas,
    rataRata: p.rataRata,
    nilai: p.nilai,
  }))

  return { ranked, jumlahPeserta: ranked.length }
}

export async function muatStatusPublikasi(
  kelas: string,
  tahap: TahapTryOutTka,
): Promise<TkaPublikasiDok | null> {
  const id = idTkaPublikasi(kelas, tahap)
  try {
    const snap = await getDoc(doc(db, 'lms_tka_publikasi', id))
    if (!snap.exists()) return null
    const d = snap.data()
    return {
      id,
      kelas: String(d.kelas ?? kelas),
      tahap: (d.tahap as TahapTryOutTka) ?? tahap,
      published: d.published === true,
      publishedAt: d.publishedAt,
      publishedBy: typeof d.publishedBy === 'string' ? d.publishedBy : undefined,
      publishedByNama: typeof d.publishedByNama === 'string' ? d.publishedByNama : undefined,
      catatanOrtu: typeof d.catatanOrtu === 'string' ? d.catatanOrtu : undefined,
      jumlahSiswa: typeof d.jumlahSiswa === 'number' ? d.jumlahSiswa : undefined,
      updatedAt: d.updatedAt,
    }
  } catch (e) {
    console.warn('muatStatusPublikasi', id, e)
    return null
  }
}

/**
 * Publikasikan snapshot satu kelas × tahap + hitung ulang ranking 6A+6B.
 * Menyertakan sebaran capaian bila kuis sumber + jawaban tersedia di LMS.
 */
export async function publikasikanTkaOrtu(input: {
  kelas: string
  tahap: TahapTryOutTka
  catatanOrtu?: string
  namaGuru?: string
}): Promise<{ jumlahSiswa: number; jumlahRanking: number }> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const kelas = String(input.kelas).toUpperCase()
  if (!(KELAS_TKA as readonly string[]).includes(kelas)) {
    throw new Error('Hanya kelas 6A/6B yang dapat dipublikasikan.')
  }
  const { tahap } = input

  const rekap = await bangunRekapTka({ tahap, kelasList: ['6A', '6B'] })
  const semuaSiswa = rekap.siswa

  const pesertaSemua = rekap.baris.map((b) => {
    const nilai: NilaiOrtuTka = {
      BI: b.perMapel['TKA Bahasa Indonesia']?.nilai ?? null,
      MTK: b.perMapel['TKA Matematika']?.nilai ?? null,
      IPA: b.perMapel['TKA IPA']?.nilai ?? null,
    }
    return {
      siswaId: b.siswaId,
      siswaNama: b.siswaNama,
      kelas: String(b.kelas).toUpperCase(),
      nilai,
      perMapel: b.perMapel,
    }
  })

  const { ranked, jumlahPeserta } = bangunRankingGabungan(tahap, pesertaSemua)
  const rankBySiswa = new Map(ranked.map((r) => [r.siswaId, r]))

  const siswaKelas = semuaSiswa.filter((s) => String(s.kelas).toUpperCase() === kelas)
  const catatan = (input.catatanOrtu || '').trim().slice(0, 500)

  // Cache kuis agar tidak di-download berulang
  const kuisCache = new Map<string, Awaited<ReturnType<typeof ambilKuis>>>()
  async function getKuis(id: string) {
    if (kuisCache.has(id)) return kuisCache.get(id) ?? null
    const k = await ambilKuis(id)
    kuisCache.set(id, k)
    return k
  }

  // Jawaban per kuis×kelas×mapel (cache) — daftarJawabanKuis wajib 3 arg (rules)
  const jawCache = new Map<string, Awaited<ReturnType<typeof daftarJawabanKuis>>>()
  async function getJaw(kuisId: string, kelasJaw: string, mapel: string) {
    const key = `${kuisId}|${kelasJaw}|${mapel}`
    if (jawCache.has(key)) return jawCache.get(key) ?? []
    const j = await daftarJawabanKuis(kuisId, kelasJaw, mapel)
    jawCache.set(key, j)
    return j
  }

  const ops: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = []

  for (const s of siswaKelas) {
    const baris = pesertaSemua.find((p) => p.siswaId === s.id)
    const nilai = baris?.nilai || { BI: null, MTK: null, IPA: null }
    const rank = rankBySiswa.get(s.id)

    // Sebaran per mapel (best-effort)
    const sebaran: SebaranOrtuTka = {}
    if (baris) {
      for (const mapelTka of ['TKA Bahasa Indonesia', 'TKA Matematika', 'TKA IPA'] as MapelTkaNama[]) {
        const sel = baris.perMapel[mapelTka]
        const ortuKey = MAPEL_KE_ORTU[mapelTka]
        const kid = sel?.kuisId
        if (!kid) continue
        try {
          const kuis = await getKuis(kid)
          if (!kuis?.soal?.length) continue
          const list = await getJaw(kid, kelas, mapelTka)
          const milik = list
            .filter((j) => j.siswaId === s.id || j.siswaUid === s.id)
            .sort((a, b) => (b.skorOtomatis || 0) - (a.skorOtomatis || 0))
          const terbaik = milik[0]
          if (!terbaik?.detail?.length) continue
          const seb = hitungSebaranDariDetail(kuis.soal, terbaik.detail)
          if (seb) sebaran[ortuKey] = seb
        } catch (e) {
          console.warn('sebaran publish', s.id, mapelTka, e)
        }
      }
    }

    const id = idTkaHasilOrtu(kelas, tahap, s.id)
    const data: Record<string, unknown> = {
      kelas,
      tahap,
      siswaId: s.id,
      siswaNama: s.nama,
      nilai,
      rataRata: rank ? rank.rataRata : hitungRataRata(nilai, tahap),
      peringkat: rank ? rank.peringkat : null,
      jumlahPesertaRanking: jumlahPeserta,
      published: true,
      publishedAt: serverTimestamp(),
      catatanOrtu: catatan,
      updatedAt: serverTimestamp(),
    }
    if (Object.keys(sebaran).length) data.sebaran = sebaran

    ops.push({ ref: doc(db, 'lms_tka_hasil_ortu', id), data })
  }

  ops.push({
    ref: doc(db, 'lms_tka_publikasi', idTkaPublikasi(kelas, tahap)),
    data: {
      kelas,
      tahap,
      published: true,
      publishedAt: serverTimestamp(),
      publishedBy: uid,
      publishedByNama: input.namaGuru || '',
      catatanOrtu: catatan,
      jumlahSiswa: siswaKelas.length,
      updatedAt: serverTimestamp(),
    },
  })

  ops.push({
    ref: doc(db, 'lms_tka_peringkat', tahap),
    data: {
      tahap,
      top10: ranked.slice(0, 10),
      jumlahPeserta,
      updatedAt: serverTimestamp(),
      updatedByNama: input.namaGuru || '',
    },
  })

  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const o of ops.slice(i, i + CHUNK)) {
      batch.set(o.ref, o.data, { merge: true })
    }
    await batch.commit()
  }

  return { jumlahSiswa: siswaKelas.length, jumlahRanking: jumlahPeserta }
}

/**
 * Tarik publikasi (sembunyikan dari portal). Snapshot tetap ada tetapi published=false.
 */
export async function tarikPublikasiTkaOrtu(input: {
  kelas: string
  tahap: TahapTryOutTka
  namaGuru?: string
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const kelas = String(input.kelas).toUpperCase()
  const { tahap } = input

  const pubRef = doc(db, 'lms_tka_publikasi', idTkaPublikasi(kelas, tahap))
  await setDoc(
    pubRef,
    {
      kelas,
      tahap,
      published: false,
      updatedAt: serverTimestamp(),
      publishedBy: uid,
      publishedByNama: input.namaGuru || '',
    },
    { merge: true },
  )

  const q = query(collection(db, 'lms_tka_hasil_ortu'), where('kelas', '==', kelas))
  const snap = await getDocs(q)
  const docs = snap.docs.filter((d) => String(d.data().tahap) === tahap)
  const CHUNK = 400
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.set(d.ref, { published: false, updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
}

export type { TkaPublikasiDok, TkaHasilOrtuDok, TkaPeringkatDok, SebaranOrtuTka, SebaranMapelOrtu }
export { ORTU_KE_MAPEL, MAPEL_KE_ORTU }

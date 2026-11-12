/**
 * Muat & simpan Rekap Nilai Try Out TKA.
 * Otomatis: skor dari lms_jawaban pada kuis dengan tahapTryOutTka cocok.
 * Manual: override di lms_rekap_tka (menang atas otomatis).
 * Sebaran capaian (kompleksitas / tipe materi / domain): dari jawaban LMS (otomatis) atau
 * field `sebaran` pada dokumen rekap (hasil import try out di luar LMS). ANTIREGRESI §109.
 */
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { daftarKuis } from './kuis'
import {
  daftarJawabanKuisMultiKelas,
  ringkasPerSiswa,
  skorKe100,
} from './jawabanKuis'
import { muatSiswaKelas, type SiswaDasar } from './siswaAuth'
import { hitungSebaranDariJawaban } from './sebaranTka'
import {
  KELAS_TKA_BANK,
  MAPEL_TKA,
  type MapelTkaNama,
} from './tkaAkses'
import type { KuisLms, TahapTryOutTka } from '../types/kuis'
import type {
  BarisRekapTka,
  RekapTkaDok,
  SebaranMapelTka,
  SelNilaiTka,
  SumberNilaiTka,
} from '../types/rekapTka'
import { idRekapTka } from '../types/rekapTka'

function koleksi() {
  return collection(db, 'lms_rekap_tka')
}

/** Kuis TKA (kelas bank «6») yang bertanda tahap tertentu, per mapel. */
export async function muatKuisTkaPerTahap(
  tahap: TahapTryOutTka,
): Promise<Record<MapelTkaNama, KuisLms[]>> {
  const out = {} as Record<MapelTkaNama, KuisLms[]>
  await Promise.all(
    MAPEL_TKA.map(async (mapel) => {
      const semua = await daftarKuis(KELAS_TKA_BANK, mapel)
      out[mapel] = semua.filter((k) => k.tahapTryOutTka === tahap)
    }),
  )
  return out
}

/**
 * Nilai otomatis 0–100 untuk satu siswa pada satu mapel dari daftar kuis tahap.
 * Jika beberapa kuis: ambil skor tertinggi (skala 100).
 */
type NilaiOtomatis = {
  nilai: number
  kuisId: string
  judul: string
  sebaran: SebaranMapelTka | null
}

async function nilaiOtomatisMapel(
  mapel: MapelTkaNama,
  kuisList: KuisLms[],
  kelasList: string[],
): Promise<Map<string, NilaiOtomatis>> {
  const hasil = new Map<string, NilaiOtomatis>()
  for (const k of kuisList) {
    if (!k.id) continue
    const jawaban = await daftarJawabanKuisMultiKelas(k.id, kelasList, mapel)
    const ringkas = ringkasPerSiswa(jawaban)
    for (const j of ringkas) {
      const sid = j.siswaId || j.siswaUid
      if (!sid) continue
      const n = skorKe100(j.skorOtomatis, j.totalPoin || k.totalPoin || 0)
      const prev = hasil.get(sid)
      if (!prev || n > prev.nilai) {
        // Sebaran dihitung dari kuis & jawaban yang SAMA dengan nilai (konsisten).
        hasil.set(sid, {
          nilai: n,
          kuisId: k.id,
          judul: k.judul,
          sebaran: hitungSebaranDariJawaban(k.soal, j.detail, mapel),
        })
      }
    }
  }
  return hasil
}

/**
 * Muat override manual untuk tahap + daftar kelas.
 *
 * PENTING: query hanya `where('kelas'==…)` (indeks otomatis), filter `tahap` di klien.
 * Query compound `tahap`+`kelas` membutuhkan composite index — jika belum ada di
 * Firebase Console, getDocs gagal «failed-precondition» dan nilai import tampak kosong
 * (ANTIREGRESI §104).
 */
export async function muatRekapTkaManual(
  tahap: TahapTryOutTka,
  kelasList: string[],
): Promise<{ map: Map<string, RekapTkaDok>; peringatan: string[] }> {
  const map = new Map<string, RekapTkaDok>()
  const peringatan: string[] = []
  await Promise.all(
    kelasList.map(async (kelas) => {
      const kelasNorm = String(kelas).toUpperCase()
      try {
        // Satu field saja — tidak butuh composite index.
        const q = query(koleksi(), where('kelas', '==', kelasNorm))
        const snap = await getDocs(q)
        for (const d of snap.docs) {
          const data = d.data()
          if (String(data.tahap ?? '') !== tahap) continue
          map.set(d.id, {
            id: d.id,
            kelas: String(data.kelas ?? kelasNorm),
            tahap: data.tahap as TahapTryOutTka,
            siswaId: String(data.siswaId ?? ''),
            siswaNama: String(data.siswaNama ?? ''),
            nilai: (data.nilai as RekapTkaDok['nilai']) ?? {},
            sumber: (data.sumber as RekapTkaDok['sumber']) ?? {},
            sebaran: (data.sebaran as RekapTkaDok['sebaran']) ?? undefined,
            kuisIdRef: (data.kuisIdRef as RekapTkaDok['kuisIdRef']) ?? {},
            diubahOleh: typeof data.diubahOleh === 'string' ? data.diubahOleh : undefined,
            diubahOlehNama: typeof data.diubahOlehNama === 'string' ? data.diubahOlehNama : undefined,
            updatedAt: data.updatedAt,
            createdAt: data.createdAt,
          })
        }
      } catch (e) {
        // Permission / rules belum deploy — jangan gagalkan seluruh rekap, tapi catat.
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('muatRekapTkaManual', kelasNorm, e)
        peringatan.push(`Kelas ${kelasNorm}: gagal memuat nilai manual (${msg})`)
      }
    }),
  )
  return { map, peringatan }
}

/** Gabungkan roster siswa + otomatis + manual menjadi baris UI. */
/** Peringatan label soal (tipe materi / domain) yang membuat sebaran tidak lengkap. */
export function peringatanLabelSebaran(
  kuisPerMapel: Record<MapelTkaNama, KuisLms[]>,
): string[] {
  const out: string[] = []
  for (const mapel of MAPEL_TKA) {
    for (const k of kuisPerMapel[mapel] ?? []) {
      const soal = k.soal ?? []
      // IPA memakai domain (bukan tipe materi) sebagai kompetensi materi.
      const tanpaMateri =
        mapel === 'TKA IPA' ? 0 : soal.filter((s) => !(s.tipeMateri || '').trim()).length
      if (tanpaMateri > 0) {
        out.push(`${k.judul}: ${tanpaMateri} soal belum berlabel tipe materi (sebaran materi tidak lengkap).`)
      }
      if (mapel === 'TKA IPA') {
        const tanpaDomain = soal.filter((s) => !s.domainTka).length
        if (tanpaDomain > 0) {
          out.push(`${k.judul}: ${tanpaDomain} soal IPA belum berlabel domain (pengetahuan / keterampilan proses).`)
        }
      }
    }
  }
  return out
}

export async function bangunRekapTka(input: {
  tahap: TahapTryOutTka
  kelasList: string[]
}): Promise<{
  baris: BarisRekapTka[]
  kuisPerMapel: Record<MapelTkaNama, KuisLms[]>
  siswa: SiswaDasar[]
  peringatanManual: string[]
  peringatanSebaran: string[]
}> {
  const { tahap, kelasList } = input
  const [kuisPerMapel, siswaBatches, manualHasil] = await Promise.all([
    muatKuisTkaPerTahap(tahap),
    Promise.all(kelasList.map((k) => muatSiswaKelas(k))),
    muatRekapTkaManual(tahap, kelasList),
  ])
  const manualMap = manualHasil.map
  const peringatanManual = manualHasil.peringatan
  const siswa = siswaBatches
    .flat()
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id') || a.kelas.localeCompare(b.kelas))

  const autoPerMapel = {} as Record<MapelTkaNama, Map<string, NilaiOtomatis>>
  await Promise.all(
    MAPEL_TKA.map(async (mapel) => {
      autoPerMapel[mapel] = await nilaiOtomatisMapel(mapel, kuisPerMapel[mapel], kelasList)
    }),
  )

  const baris: BarisRekapTka[] = siswa.map((s) => {
    const dokId = idRekapTka(String(s.kelas).toUpperCase(), tahap, s.id)
    // Cadangan: cocokkan by siswaId jika id dokumen beda format historis
    const manual =
      manualMap.get(dokId) ||
      [...manualMap.values()].find(
        (d) => d.siswaId === s.id && String(d.kelas).toUpperCase() === String(s.kelas).toUpperCase(),
      )
    const perMapel = {} as Record<MapelTkaNama, SelNilaiTka>
    for (const mapel of MAPEL_TKA) {
      const mVal = manual?.nilai?.[mapel]
      const mSrc = manual?.sumber?.[mapel]
      // Nilai di dokumen lms_rekap_tka selalu override (import / isi manual).
      // Terima juga bila sumber kosong (dokumen lama / batch import parsial).
      if (
        mVal != null &&
        !Number.isNaN(Number(mVal)) &&
        (mSrc === 'manual' || mSrc == null || mSrc === undefined)
      ) {
        perMapel[mapel] = {
          nilai: Number(mVal),
          sumber: 'manual',
          sebaran: manual?.sebaran?.[mapel] ?? null,
        }
        continue
      }
      const auto = autoPerMapel[mapel].get(s.id)
      if (auto) {
        perMapel[mapel] = {
          nilai: auto.nilai,
          sumber: 'otomatis',
          dariKuis: auto.judul,
          kuisId: auto.kuisId,
          sebaran: auto.sebaran,
        }
      } else {
        perMapel[mapel] = { nilai: null, sumber: null, sebaran: null }
      }
    }
    return {
      siswaId: s.id,
      siswaNama: s.nama,
      kelas: s.kelas,
      perMapel,
    }
  })

  return {
    baris,
    kuisPerMapel,
    siswa,
    peringatanManual,
    peringatanSebaran: peringatanLabelSebaran(kuisPerMapel),
  }
}

/** Simpan / perbarui nilai manual satu mapel untuk satu siswa. */
export async function simpanNilaiManualTka(input: {
  kelas: string
  tahap: TahapTryOutTka
  siswaId: string
  siswaNama: string
  mapel: MapelTkaNama
  /** null = hapus override manual (kembali ke otomatis / kosong). */
  nilai: number | null
  namaGuru?: string
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const kelas = String(input.kelas).toUpperCase()
  const id = idRekapTka(kelas, input.tahap, input.siswaId)
  const ref = doc(db, 'lms_rekap_tka', id)

  // getDoc dokumen yang belum ada bisa permission-denied (resource==null di rules).
  // Anggap kosong jika gagal / tidak ada — setDoc merge akan create.
  let prev: Record<string, unknown> = {}
  let sudahAda = false
  try {
    const existing = await getDoc(ref)
    if (existing.exists()) {
      prev = existing.data() as Record<string, unknown>
      sudahAda = true
    }
  } catch (e) {
    console.warn('simpanNilaiManualTka getDoc', id, e)
  }

  const nilai: Record<string, number | null> = {
    ...((prev.nilai as Record<string, number | null>) || {}),
  }
  const sumber: Record<string, SumberNilaiTka> = {
    ...((prev.sumber as Record<string, SumberNilaiTka>) || {}),
  }

  // Sebaran hasil import hanya valid untuk nilai yang diimpor. Bila nilai diubah / dihapus,
  // sebaran mapel itu dibuang agar tidak menampilkan capaian yang tidak cocok (ANTIREGRESI §109).
  const nilaiLama = (prev.nilai as Record<string, number | null> | undefined)?.[input.mapel]
  let buangSebaran = false

  if (input.nilai == null || Number.isNaN(Number(input.nilai))) {
    delete nilai[input.mapel]
    delete sumber[input.mapel]
    buangSebaran = true
  } else {
    const n = Math.round(Number(input.nilai) * 10) / 10
    if (n < 0 || n > 100) throw new Error('Nilai harus antara 0 dan 100.')
    nilai[input.mapel] = n
    sumber[input.mapel] = 'manual'
    buangSebaran = nilaiLama == null || Number(nilaiLama) !== n
  }

  await setDoc(
    ref,
    {
      kelas,
      tahap: input.tahap,
      siswaId: input.siswaId,
      siswaNama: input.siswaNama,
      nilai,
      sumber,
      ...(buangSebaran && sudahAda ? { sebaran: { [input.mapel]: deleteField() } } : {}),
      diubahOleh: uid,
      diubahOlehNama: input.namaGuru || '',
      updatedAt: serverTimestamp(),
      ...(sudahAda ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
}

/**
 * Lib Rekap Nilai — agregasi SLM/STS/SAS per TP (Tahap 2).
 * Sumber SLM: tugas (lms_nilai_tugas) + kuis jenisPenilaian=slm.
 * STS/SAS: kuis jenisPenilaian=sts|sas (biasanya satu event).
 * Bobot SLM: lms_bobot_slm (live, opsional persist).
 */
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { daftarTugas } from './tugas'
import { daftarKuis } from './kuis'
import { daftarNilaiTugas } from './nilaiTugas'
import {
  daftarJawabanKuis,
  ringkasPerSiswa,
  skorKe100,
} from './jawabanKuis'
import type { AppUser } from '../types/user'
import type { TugasLms } from '../types/tugas'
import type { KuisLms } from '../types/kuis'
import type {
  BobotSlmDok,
  SumberNilaiSlm,
  NilaiSiswaTp,
} from '../types/rekapNilai'
import { daftarRuangKelas } from './kelasLms'

/** Pasangan kelas×mapel yang diampu guru (dari penugasan). */
export function daftarMapelKelasGuru(profil: AppUser | null | undefined): {
  kelas: string
  mapel: string
}[] {
  const ruang = daftarRuangKelas(profil ?? null)
  const seen = new Set<string>()
  const out: { kelas: string; mapel: string }[] = []
  for (const r of ruang) {
    const k = `${r.kelas}::${r.mapel}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ kelas: r.kelas, mapel: r.mapel })
  }
  out.sort((a, b) => {
    const ck = a.kelas.localeCompare(b.kelas, 'id')
    if (ck !== 0) return ck
    return a.mapel.localeCompare(b.mapel, 'id')
  })
  return out
}

/** ID dokumen bobot SLM (stabil, aman untuk path Firestore). */
export function idBobotSlm(kelas: string, mapel: string, tpId: string): string {
  const mapelSlug = mapel.trim().replace(/\s+/g, '_').replace(/[\/\\#?[\]]/g, '-')
  return `${kelas.toUpperCase()}__${mapelSlug}__${tpId}`
}

/**
 * Hitung nilai akhir berbobot dari map skor + daftar bobot.
 * Skor null/undefined diabaikan; jika tidak ada skor valid → null.
 */
export function hitungNilaiBerbobot(
  perSumber: Record<string, number | null | undefined>,
  sumber: { id: string; bobot: number }[],
): number | null {
  let sum = 0
  let totalBobot = 0
  for (const s of sumber) {
    const v = perSumber[s.id]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    const b = typeof s.bobot === 'number' && s.bobot > 0 ? s.bobot : 1
    sum += v * b
    totalBobot += b
  }
  if (totalBobot <= 0) return null
  return Math.round((sum / totalBobot) * 10) / 10
}

function tugasMemuatTp(t: TugasLms, tpId: string): boolean {
  if (Array.isArray(t.tpList) && t.tpList.some((x) => x.id === tpId)) return true
  if (t.tpId && t.tpId === tpId) return true
  return false
}

function kuisMemuatTp(k: KuisLms, tpId: string): boolean {
  return Array.isArray(k.tpIds) && k.tpIds.includes(tpId)
}

/**
 * Temukan sumber SLM untuk satu TP: tugas yang terhubung TP + kuis jenis=slm.
 * Tidak memuat nilai — hanya metadata sumber.
 */
export async function temukanSumberSlm(
  kelas: string,
  mapel: string,
  tpId: string,
): Promise<SumberNilaiSlm[]> {
  const kelasU = String(kelas).toUpperCase()
  const [tugasList, kuisList] = await Promise.all([
    daftarTugas(kelasU, mapel).catch(() => [] as TugasLms[]),
    daftarKuis(kelasU, mapel).catch(() => [] as KuisLms[]),
  ])

  const sumber: SumberNilaiSlm[] = []

  for (const t of tugasList) {
    if (!tugasMemuatTp(t, tpId)) continue
    // Hanya tugas SLM (default legacy tanpa field = slm). Latihan/STS/SAS tidak masuk SLM.
    const jp = (t as { jenisPenilaian?: string }).jenisPenilaian
    if (jp === 'latihan' || jp === 'sts' || jp === 'sas') continue
    sumber.push({
      id: `tugas:${t.id}`,
      jenis: 'tugas',
      sumberId: t.id,
      judul: t.judul || `Tugas ${t.id.slice(0, 6)}`,
      bobot: 1,
    })
  }

  for (const k of kuisList) {
    const jenis = k.jenisPenilaian ?? 'latihan'
    if (jenis !== 'slm') continue
    if (!kuisMemuatTp(k, tpId)) continue
    sumber.push({
      id: `kuis:${k.id}`,
      jenis: 'kuis',
      sumberId: k.id,
      judul: k.judul || `Kuis ${k.id.slice(0, 6)}`,
      bobot: 1,
    })
  }

  // Stabil: tugas dulu lalu kuis, urut judul
  sumber.sort((a, b) => {
    if (a.jenis !== b.jenis) return a.jenis === 'tugas' ? -1 : 1
    return a.judul.localeCompare(b.judul, 'id')
  })
  return sumber
}

/** Muat dokumen bobot SLM; null jika belum ada. */
export async function muatBobotSlm(
  kelas: string,
  mapel: string,
  tpId: string,
): Promise<BobotSlmDok | null> {
  const id = idBobotSlm(kelas, mapel, tpId)
  try {
    const snap = await getDoc(doc(db, 'lms_bobot_slm', id))
    if (!snap.exists()) return null
    const d = snap.data()
    const sumberRaw = Array.isArray(d.sumber) ? d.sumber : []
    const sumber: SumberNilaiSlm[] = sumberRaw
      .filter((x: unknown) => x && typeof x === 'object')
      .map((x: Record<string, unknown>): SumberNilaiSlm => {
        const jenis: SumberNilaiSlm['jenis'] = x.jenis === 'kuis' ? 'kuis' : 'tugas'
        return {
          id: String(x.id || ''),
          jenis,
          sumberId: String(x.sumberId || ''),
          judul: String(x.judul || ''),
          bobot: typeof x.bobot === 'number' && x.bobot > 0 ? x.bobot : 1,
        }
      })
      .filter((s) => s.id)
    return {
      id: snap.id,
      kelas: String(d.kelas || kelas),
      mapel: String(d.mapel || mapel),
      tpId: String(d.tpId || tpId),
      tpNomor: typeof d.tpNomor === 'number' ? d.tpNomor : undefined,
      tpNama: typeof d.tpNama === 'string' ? d.tpNama : undefined,
      sumber,
      diubahOleh: typeof d.diubahOleh === 'string' ? d.diubahOleh : undefined,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    }
  } catch (e) {
    console.warn('muatBobotSlm gagal:', e)
    return null
  }
}

/**
 * Gabungkan sumber terdeteksi + bobot tersimpan.
 * Sumber baru mendapat bobot 1; sumber hilang dihapus dari daftar efektif.
 */
export function gabungSumberDenganBobot(
  terdeteksi: SumberNilaiSlm[],
  tersimpan: BobotSlmDok | null,
): SumberNilaiSlm[] {
  const mapBobot = new Map<string, number>()
  if (tersimpan?.sumber) {
    for (const s of tersimpan.sumber) {
      if (s.id) mapBobot.set(s.id, typeof s.bobot === 'number' && s.bobot > 0 ? s.bobot : 1)
    }
  }
  return terdeteksi.map((s) => ({
    ...s,
    bobot: mapBobot.get(s.id) ?? 1,
  }))
}

/** Simpan pengaturan bobot SLM. */
export async function simpanBobotSlm(input: {
  kelas: string
  mapel: string
  tpId: string
  tpNomor?: number
  tpNama?: string
  sumber: SumberNilaiSlm[]
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Belum masuk.')
  const id = idBobotSlm(input.kelas, input.mapel, input.tpId)
  const ref = doc(db, 'lms_bobot_slm', id)
  const payload: Record<string, unknown> = {
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel,
    tpId: input.tpId,
    sumber: input.sumber.map((s) => ({
      id: s.id,
      jenis: s.jenis,
      sumberId: s.sumberId,
      judul: s.judul,
      bobot: typeof s.bobot === 'number' && s.bobot > 0 ? s.bobot : 1,
    })),
    diubahOleh: uid,
    updatedAt: serverTimestamp(),
  }
  if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
  if (input.tpNama) payload.tpNama = input.tpNama

  const existing = await getDoc(ref)
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp()
  }
  await setDoc(ref, payload, { merge: true })
}

/**
 * Muat nilai per sumber SLM untuk semua siswa (map: sumberId → siswaId → skor 0–100).
 */
export async function muatNilaiPerSumberSlm(
  kelas: string,
  mapel: string,
  sumber: SumberNilaiSlm[],
): Promise<Record<string, Record<string, number | null>>> {
  const kelasU = String(kelas).toUpperCase()
  const out: Record<string, Record<string, number | null>> = {}

  await Promise.all(
    sumber.map(async (s) => {
      const perSiswa: Record<string, number | null> = {}
      try {
        if (s.jenis === 'tugas') {
          const list = await daftarNilaiTugas(s.sumberId, kelasU, mapel)
          for (const n of list) {
            if (!n.siswaId) continue
            perSiswa[n.siswaId] =
              typeof n.nilai === 'number' && !Number.isNaN(n.nilai) ? n.nilai : null
          }
        } else {
          const jawaban = await daftarJawabanKuis(s.sumberId, kelasU, mapel)
          const ringkas = ringkasPerSiswa(jawaban)
          for (const j of ringkas) {
            const key = j.siswaId || j.siswaUid
            if (!key) continue
            perSiswa[key] = skorKe100(j.skorOtomatis, j.totalPoin)
          }
        }
      } catch (e) {
        console.warn(`muat nilai sumber ${s.id}:`, e)
      }
      out[s.id] = perSiswa
    }),
  )
  return out
}

/** Bangun baris nilai siswa untuk tabel SLM. */
export function bangunNilaiSlmSiswa(
  siswa: { id: string; nama: string }[],
  sumber: SumberNilaiSlm[],
  nilaiPerSumber: Record<string, Record<string, number | null>>,
): NilaiSiswaTp[] {
  return siswa.map((s) => {
    const perSumber: Record<string, number | null> = {}
    for (const src of sumber) {
      const v = nilaiPerSumber[src.id]?.[s.id]
      perSumber[src.id] = typeof v === 'number' ? v : null
    }
    return {
      siswaId: s.id,
      siswaNama: s.nama,
      perSumber,
      nilaiAkhir: hitungNilaiBerbobot(perSumber, sumber),
    }
  })
}

/**
 * Temukan kuis STS atau SAS yang terhubung ke TP (atau semua STS/SAS mapel×kelas
 * jika kuis multi-TP / tanpa filter ketat — prioritaskan yang memuat tpId).
 */
export async function temukanSumberStsSas(
  kelas: string,
  mapel: string,
  tpId: string,
  jenis: 'sts' | 'sas',
): Promise<SumberNilaiSlm[]> {
  const kelasU = String(kelas).toUpperCase()
  const [kuisList, tugasList] = await Promise.all([
    daftarKuis(kelasU, mapel).catch(() => [] as KuisLms[]),
    daftarTugas(kelasU, mapel).catch(() => [] as TugasLms[]),
  ])
  const sumber: SumberNilaiSlm[] = []

  for (const k of kuisList) {
    if ((k.jenisPenilaian ?? 'latihan') !== jenis) continue
    if (k.tpIds && k.tpIds.length > 0 && !k.tpIds.includes(tpId)) continue
    sumber.push({
      id: `kuis:${k.id}`,
      jenis: 'kuis',
      sumberId: k.id,
      judul: k.judul || `Kuis ${jenis.toUpperCase()}`,
      bobot: 1,
    })
  }

  for (const t of tugasList) {
    if ((t as { jenisPenilaian?: string }).jenisPenilaian !== jenis) continue
    if (!tugasMemuatTp(t, tpId)) continue
    sumber.push({
      id: `tugas:${t.id}`,
      jenis: 'tugas',
      sumberId: t.id,
      judul: t.judul || `Tugas ${jenis.toUpperCase()}`,
      bobot: 1,
    })
  }

  return sumber.sort((a, b) => a.judul.localeCompare(b.judul, 'id'))
}

/**
 * Nilai STS/SAS per siswa. Jika banyak sumber, rata-rata sederhana
 * (biasanya hanya satu event).
 */
export async function muatNilaiStsSas(
  kelas: string,
  mapel: string,
  sumber: SumberNilaiSlm[],
  siswa: { id: string; nama: string }[],
): Promise<NilaiSiswaTp[]> {
  if (!sumber.length) {
    return siswa.map((s) => ({
      siswaId: s.id,
      siswaNama: s.nama,
      nilaiAkhir: null,
    }))
  }
  const nilaiPerSumber = await muatNilaiPerSumberSlm(kelas, mapel, sumber)
  // Rata-rata sederhana antar sumber (bobot sama)
  const sumberRata = sumber.map((s) => ({ ...s, bobot: 1 }))
  return bangunNilaiSlmSiswa(siswa, sumberRata, nilaiPerSumber)
}

export type RingkasRekapTp = {
  tpId: string
  tpNomor?: number
  tpNama?: string
  nilaiSlm: number | null
  nilaiSts: number | null
  nilaiSas: number | null
}

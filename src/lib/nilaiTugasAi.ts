/**
 * Klien Cloud Function `nilaiTugasLmsAi` (repo SDM01Penilaian): USULAN nilai tugas dari
 * bukti foto/video siswa + rubrik. ANTIREGRESI §Tugas.NilaiAi.
 *
 * - Hanya akun AI (UID + email, `bolehAiTugas`); server memeriksa ulang.
 * - Hanya mengirim `tugasId` + `siswaId`; rubrik & bukti dibaca server dari Firestore/Storage.
 * - Hasil BUKAN nilai: guru menerapkan ke draf, memeriksa, lalu menyimpan lewat alur biasa.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from './firebase'
import { bolehAiTugas } from './penilaianTugas'

const REGION = 'asia-southeast2'
/** Analisis video bisa lama; default SDK hanya 70 dtk. Server membatasi 300 dtk. */
const TIMEOUT_MS = 295_000

export type KeyakinanAi = 'tinggi' | 'sedang' | 'rendah'

export type UsulanKategoriAi = {
  id: string
  nama: string
  /** null = AI/server tidak menilai (observasi, bukti tak ada/tak cukup). */
  skor: number | null
  keyakinan: KeyakinanAi
  alasan: string
  /** Nomor bukti (merujuk `UsulanNilaiAi.bukti[].nomor`). */
  bukti: number[]
  /** Guru sebaiknya memeriksa manual (skor null atau keyakinan rendah). */
  perluDicek: boolean
  /** false = tidak dinilai AI sama sekali (observasi / tanpa bukti). */
  dinilaiAi: boolean
}

export type BuktiUsulanAi = {
  nomor: number
  label: string
  jenis: 'foto' | 'video'
  slot: number
}

export type UsulanNilaiAi = {
  siswaId: string
  siswaNama: string
  kategori: UsulanKategoriAi[]
  ringkasan: string
  komentarSiswa: string
  /**
   * Poin perbaikan untuk siswa (bahasa SD, siap ditempel ke form «Poin perbaikan»).
   * Kosong bila model tidak mengisi — guru mengisi manual.
   */
  poinPerbaikan?: string[]
  catatanKualitas: string[]
  bukti: BuktiUsulanAi[]
  belumDikumpulkan: string[]
  model: string
  /** Waktu usulan dibuat (ms, sisi klien). */
  dibuatMs: number
}

function pesan(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Gagal menghubungi layanan AI.'
  const e = err as { code?: unknown; message?: unknown }
  const code = String(e.code || '')
  const m = String(e.message || '')
  const rendah = `${code} ${m}`.toLowerCase()
  if (rendah.includes('failed-precondition') || m.includes('belum mengumpulkan')) {
    const bersih = m.replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[\w-]+\s*/i, '').trim()
    return (
      bersih ||
      'Belum ada bukti yang bisa dinilai. Pastikan siswa sudah mengumpulkan (atau mengirim perbaikan).'
    )
  }
  if (rendah.includes('invalid-argument')) {
    return 'ID tugas/siswa tidak valid. Muat ulang halaman lalu coba lagi.'
  }
  if (rendah.includes('permission-denied') || rendah.includes('unauthenticated')) {
    return 'Akun ini tidak berhak memakai penilaian AI, atau sesi sudah habis. Masuk ulang.'
  }
  if (rendah.includes('resource-exhausted') || rendah.includes('429')) {
    return 'Layanan AI sedang penuh. Tunggu sebentar lalu coba lagi.'
  }
  if (m && m !== 'internal' && !/^FirebaseError$/i.test(m)) {
    return m.replace(/^FirebaseError:\s*/i, '').trim()
  }
  return 'Gagal menilai dengan AI (galat server). Coba lagi atau periksa log Functions.'
}


/**
 * Susun daftar poin perbaikan ramah anak SD dari usulan AI.
 * Prioritas: field poinPerbaikan dari server; jika kosong, turunkan dari alasan kategori
 * yang skornya rendah / perlu dicek agar kotak guru tidak kosong.
 */
export function daftarPoinPerbaikanDariUsulan(u: Pick<UsulanNilaiAi, 'poinPerbaikan' | 'kategori' | 'komentarSiswa'>): string[] {
  const dariServer = (u.poinPerbaikan ?? [])
    .map((x) => String(x || '').trim().replace(/^[-*•\d.)\s]+/, ''))
    .filter((x) => x.length >= 8)
    .slice(0, 8)
  if (dariServer.length >= 2) return dariServer

  const dariKat: string[] = []
  for (const k of u.kategori ?? []) {
    if (!k.dinilaiAi) continue
    const lemah =
      k.perluDicek ||
      k.skor === null ||
      (typeof k.skor === 'number' && k.skor < 85)
    if (!lemah) continue
    const alasan = (k.alasan || '').trim()
    if (alasan.length < 12) continue
    // Ubah nada guru → saran ke siswa (ringkas).
    let saran = k.nama
      ? `Perbaiki bagian «${k.nama}»: ${alasan}`
      : alasan
    if (saran.length > 200) saran = saran.slice(0, 197) + '…'
    if (!dariKat.some((x) => x === saran)) dariKat.push(saran)
    if (dariKat.length >= 5) break
  }

  const gabung = [...dariServer]
  for (const x of dariKat) {
    if (gabung.length >= 6) break
    if (!gabung.some((y) => y.slice(0, 40) === x.slice(0, 40))) gabung.push(x)
  }

  if (gabung.length === 0 && (u.komentarSiswa || '').trim()) {
    // Cadangan terakhir: pecah komentar jadi 1–2 butir pendek
    const k = u.komentarSiswa.trim()
    if (k.length >= 20) gabung.push(k.length > 180 ? k.slice(0, 177) + '…' : k)
  }
  return gabung.slice(0, 8)
}

export async function usulkanNilaiTugasAi(tugasId: string, siswaId: string): Promise<UsulanNilaiAi> {
  if (!bolehAiTugas(auth.currentUser?.uid)) {
    throw new Error('Fitur AI tugas tidak tersedia untuk akun Anda.')
  }
  const panggil = httpsCallable<{ tugasId: string; siswaId: string }, Omit<UsulanNilaiAi, 'dibuatMs'>>(
    getFunctions(app, REGION),
    'nilaiTugasLmsAi',
    { timeout: TIMEOUT_MS },
  )
  try {
    const res = await panggil({ tugasId, siswaId })
    const d = res.data
    if (!d || !Array.isArray(d.kategori)) throw new Error('Jawaban AI tidak lengkap. Coba lagi.')
    const mentah = (
      Array.isArray(d.poinPerbaikan)
        ? d.poinPerbaikan
        : []
    )
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 8)
    const sementara = { ...d, poinPerbaikan: mentah, kategori: d.kategori, komentarSiswa: d.komentarSiswa || '' }
    const poinPerbaikan = daftarPoinPerbaikanDariUsulan(sementara as UsulanNilaiAi)
    return { ...d, poinPerbaikan, dibuatMs: Date.now() }
  } catch (e) {
    throw new Error(pesan(e))
  }
}

// ---------------------------------------------------------------------------
// Mode PREDIKAT (tab Pengumpulan): satu predikat keseluruhan dari bukti. Skor per kategori
// diturunkan oleh `generateSkorPerKategoriDariPredikat`; hasilnya hanya masuk DRAF.
// ANTIREGRESI §Tugas.PredikatAi.
// ---------------------------------------------------------------------------

export type UsulanPredikatAi = {
  siswaId: string
  siswaNama: string
  /** Salah satu `daftarPredikat` (sudah divalidasi server). */
  predikat: string
  keyakinan: KeyakinanAi
  /** Keyakinan rendah → guru sebaiknya memeriksa bukti sendiri. */
  perluDicek: boolean
  alasan: string
  komentarSiswa: string
  catatanKualitas: string[]
  bukti: BuktiUsulanAi[]
  belumDikumpulkan: string[]
  daftarPredikat: string[]
  model: string
  dibuatMs: number
}

export async function usulkanPredikatTugasAi(tugasId: string, siswaId: string): Promise<UsulanPredikatAi> {
  if (!bolehAiTugas(auth.currentUser?.uid)) {
    throw new Error('Fitur AI tugas tidak tersedia untuk akun Anda.')
  }
  const panggil = httpsCallable<{ tugasId: string; siswaId: string }, Omit<UsulanPredikatAi, 'dibuatMs'>>(
    getFunctions(app, REGION),
    'predikatTugasLmsAi',
    { timeout: TIMEOUT_MS },
  )
  try {
    const res = await panggil({ tugasId, siswaId })
    const d = res.data
    if (!d || typeof d.predikat !== 'string' || !d.predikat) throw new Error('Jawaban AI tidak lengkap. Coba lagi.')
    return { ...d, dibuatMs: Date.now() }
  } catch (e) {
    throw new Error(pesan(e))
  }
}

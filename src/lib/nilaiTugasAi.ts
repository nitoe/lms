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
  catatanKualitas: string[]
  bukti: BuktiUsulanAi[]
  belumDikumpulkan: string[]
  model: string
  /** Waktu usulan dibuat (ms, sisi klien). */
  dibuatMs: number
}

function pesan(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    if (m && m !== 'internal') return m
  }
  return 'Gagal menghubungi layanan AI.'
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
    return { ...d, dibuatMs: Date.now() }
  } catch (e) {
    throw new Error(pesan(e))
  }
}

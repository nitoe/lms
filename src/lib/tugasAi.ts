/**
 * Klien Cloud Function AI untuk Tugas LMS.
 * Mirror otorisasi: UID + email arif.azwar79@gmail.com (generateAi / generateSoal).
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from './firebase'
import { bolehAiTugas } from './penilaianTugas'
import type { KategoriPenilaian, TpTugas } from '../types/tugas'

const REGION = 'asia-southeast2'

function pastikanBerhak() {
  if (!bolehAiTugas(auth.currentUser?.uid)) {
    throw new Error('Fitur AI tugas tidak tersedia untuk akun Anda.')
  }
}

function pesan(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    if (m && m !== 'internal') return m
  }
  return 'Gagal menghubungi layanan AI.'
}

export type InputKonteksTugasAi = {
  judul?: string
  mapel?: string
  mapelLain?: string[]
  kelas?: string
  jenis?: 'mapel' | 'proyek'
  deskripsi?: string
  instruksi?: string
  tpList?: TpTugas[]
}

/** Generate 4–6 kategori rubrik dari isi tugas (instruksi/deskripsi wajib). */
export async function generateKategoriTugasAi(
  input: InputKonteksTugasAi,
): Promise<KategoriPenilaian[]> {
  pastikanBerhak()
  const isi = `${input.instruksi || ''} ${input.deskripsi || ''}`.trim()
  if (isi.length < 40) {
    throw new Error(
      'Isi tugas belum ada atau terlalu pendek. Simpan instruksi di tab Isi Tugas terlebih dahulu.',
    )
  }
  const panggil = httpsCallable<
    InputKonteksTugasAi & { provider: 'gemini' },
    { kategori: KategoriPenilaian[] }
  >(getFunctions(app, REGION), 'generateKategoriTugasLmsAi')
  try {
    const res = await panggil({ ...input, provider: 'gemini' })
    const list = res.data?.kategori
    if (!Array.isArray(list) || list.length < 4) {
      throw new Error('AI tidak mengembalikan 4–6 kategori. Coba lagi.')
    }
    return list.slice(0, 6).map((k, i) => ({
      id: k.id || `kat-ai-${Date.now()}-${i}`,
      nama: String(k.nama || '').trim(),
      deskripsi: k.deskripsi ? String(k.deskripsi) : undefined,
    }))
  } catch (e) {
    throw new Error(pesan(e))
  }
}

/** Generate deskripsi + instruksi dari pengaturan (judul wajib sudah disimpan). */
export async function generateIsiTugasAi(
  input: InputKonteksTugasAi,
): Promise<{ deskripsi?: string; instruksi: string }> {
  pastikanBerhak()
  if (!input.judul || input.judul.trim().length < 3) {
    throw new Error('Judul tugas belum disimpan. Simpan pengaturan dulu.')
  }
  const panggil = httpsCallable<
    InputKonteksTugasAi & { provider: 'gemini' },
    { deskripsi?: string; instruksi: string }
  >(getFunctions(app, REGION), 'generateIsiTugasLmsAi')
  try {
    const res = await panggil({ ...input, provider: 'gemini' })
    const instruksi = res.data?.instruksi
    if (!instruksi || String(instruksi).trim().length < 40) {
      throw new Error('AI tidak menghasilkan instruksi yang memadai.')
    }
    return {
      deskripsi: res.data?.deskripsi ? String(res.data.deskripsi) : undefined,
      instruksi: String(instruksi),
    }
  } catch (e) {
    throw new Error(pesan(e))
  }
}

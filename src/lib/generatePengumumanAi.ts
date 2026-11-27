/**
 * Generate pengumuman LMS via Cloud Function (hanya akun AI).
 * Mirror: functions/generatePengumumanLmsAi.js + generateAi.js (UID+email).
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from './firebase'
import { bolehGenerateSoalAi, EMAIL_GENERATE_AI, UID_GENERATE_AI } from './generateSoalAi'

const REGION_FUNGSI = 'asia-southeast2'

/** UI + client gate — sama dengan generate soal/materi. */
export function bolehGeneratePengumumanAi(uid: string | undefined): boolean {
  return bolehGenerateSoalAi(uid)
}

export { EMAIL_GENERATE_AI, UID_GENERATE_AI }

function pastikanBerhak() {
  if (!bolehGeneratePengumumanAi(auth.currentUser?.uid)) {
    throw new Error('Fitur AI pengumuman hanya untuk akun yang diizinkan.')
  }
}

function pesan(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    if (m && m !== 'internal') return m
  }
  return 'Gagal menghubungi layanan AI pengumuman.'
}

export type HasilGeneratePengumumanAi = {
  judul: string
  kontenHtml: string
}

/**
 * Generate pengumuman HTML hangat berbahasa Islami (ayah/bunda · ananda)
 * dari ringkasan/informasi yang diberikan guru.
 */
export async function generatePengumumanLmsAi(input: {
  mapel: string
  kelas: string
  /** Informasi inti yang harus masuk pengumuman (wajib). */
  informasi: string
  /** Nada opsional: pengingat, undangan, info, apresiasi, … */
  tujuan?: string
  variasi?: string
}): Promise<HasilGeneratePengumumanAi> {
  pastikanBerhak()
  const informasi = String(input.informasi || '').trim()
  if (informasi.length < 8) {
    throw new Error('Tulis informasi pengumuman minimal beberapa kalimat.')
  }
  const panggil = httpsCallable<
    {
      mapel: string
      kelas: string
      informasi: string
      tujuan?: string
      variasi?: string
      provider: 'gemini'
    },
    HasilGeneratePengumumanAi
  >(getFunctions(app, REGION_FUNGSI), 'generatePengumumanLmsAi')
  try {
    const res = await panggil({
      mapel: String(input.mapel || '').trim(),
      kelas: String(input.kelas || '').trim(),
      informasi: informasi.slice(0, 4000),
      tujuan: input.tujuan?.trim().slice(0, 200) || undefined,
      variasi: input.variasi || String(Date.now()),
      provider: 'gemini',
    })
    const judul = String(res.data?.judul || '').trim()
    const kontenHtml = String(res.data?.kontenHtml || '').trim()
    if (!judul || !kontenHtml) throw new Error('AI tidak mengembalikan pengumuman lengkap.')
    return { judul: judul.slice(0, 160), kontenHtml }
  } catch (e) {
    throw new Error(pesan(e))
  }
}

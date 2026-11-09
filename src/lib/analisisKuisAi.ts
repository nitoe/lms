/**
 * Analisis hasil kuis via Cloud Function (Gemini).
 * Hanya UID + email yang sama dengan generate soal AI.
 */
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'

/** Mirror functions/generateAi.js — jangan longgarkan. */
export const UID_ANALISIS_KUIS_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
export const EMAIL_ANALISIS_KUIS_AI = 'arif.azwar79@gmail.com'

export function bolehAnalisisKuisAi(uid: string | undefined): boolean {
  if (!uid || uid !== UID_ANALISIS_KUIS_AI) return false
  const sesi = auth.currentUser
  if (!sesi || sesi.uid !== UID_ANALISIS_KUIS_AI) return false
  return (sesi.email ?? '').trim().toLowerCase() === EMAIL_ANALISIS_KUIS_AI
}

export type HasilAnalisisKuisAi = {
  ringkas: string
  kekuatan: string[]
  kelemahan: string[]
  butirBermasalah: { no: number; alasan: string; saran: string }[]
  miskonsepsi: string[]
  tindakLanjutGuru: string[]
  perbaikanSoal: string[]
  meta?: { nSiswa: number; rata100: number; nSoal: number }
}

export async function analisisKuisDenganAi(kuisId: string): Promise<HasilAnalisisKuisAi> {
  if (!bolehAnalisisKuisAi(auth.currentUser?.uid)) {
    throw new Error('Analisis AI kuis tidak tersedia untuk akun Anda.')
  }
  const fn = httpsCallable<{ kuisId: string }, HasilAnalisisKuisAi>(functions, 'analisisKuisLmsAi')
  const res = await fn({ kuisId })
  return res.data
}

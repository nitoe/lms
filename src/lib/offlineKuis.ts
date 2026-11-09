/**
 * Input jawaban kuis offline (guru) → CF simpanJawabanOfflineKuis.
 */
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { JawabanSoal } from '../types/soal'

export type HasilSimpanOffline = {
  ok: boolean
  jawabanId: string
  skor: number
  totalPoin: number
  percobaan: number
  status: string
  detail: {
    soalId: string
    tipe?: string
    benar?: boolean
    skor?: number
    butuhManual?: boolean
  }[]
}

/** skorOverride: skor AI/guru untuk isian & uraian (kelipatan 0,5). */
export async function simpanJawabanOffline(input: {
  kuisId: string
  siswaId: string
  siswaNama: string
  jawaban: Record<string, JawabanSoal | string | string[] | Record<string, string | boolean> | null>
  skorOverride?: Record<string, number>
}): Promise<HasilSimpanOffline> {
  const fn = httpsCallable<typeof input, HasilSimpanOffline>(functions, 'simpanJawabanOfflineKuis')
  const res = await fn(input)
  return res.data
}

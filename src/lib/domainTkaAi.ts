/**
 * Klasifikasi domainTka soal kuis TKA via Cloud Function.
 * Hanya akun AI (sama pola analisisKuisAi).
 */
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import { bolehAnalisisKuisAi } from './analisisKuisAi'
import type { DomainTka } from '../types/soal'

export type HasilKlasifikasiDomain = {
  soalId: string
  domainTka: DomainTka
  alasan?: string
}

export async function klasifikasiDomainTkaDenganAi(
  kuisId: string,
  opts?: { overwrite?: boolean },
): Promise<{ hasil: HasilKlasifikasiDomain[]; dilewati: number; diklasifikasi: number }> {
  if (!bolehAnalisisKuisAi(auth.currentUser?.uid)) {
    throw new Error('Klasifikasi domain AI hanya tersedia untuk akun yang diizinkan.')
  }
  const fn = httpsCallable(functions, 'klasifikasiDomainTkaLmsAi')
  const res = await fn({
    kuisId,
    overwrite: !!opts?.overwrite,
  })
  const data = res.data as {
    hasil?: HasilKlasifikasiDomain[]
    dilewati?: number
    diklasifikasi?: number
  }
  return {
    hasil: Array.isArray(data.hasil) ? data.hasil : [],
    dilewati: Number(data.dilewati) || 0,
    diklasifikasi: Number(data.diklasifikasi) || 0,
  }
}

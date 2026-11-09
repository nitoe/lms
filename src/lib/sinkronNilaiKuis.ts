import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export type HasilSinkronNilaiKuis = {
  ok: boolean
  jenis: string
  semester: string
  tahunAjaran: string
  nSiswa: number
  nTp: number
  tp: string[]
  ditulis: number
  dilewati: number
  koleksi: string
}

export async function sinkronNilaiKuisKePenilaian(input: {
  kuisId: string
  overwrite?: boolean
  semester?: '1' | '2'
  tahunAjaran?: string
}): Promise<HasilSinkronNilaiKuis> {
  const fn = httpsCallable<typeof input, HasilSinkronNilaiKuis>(functions, 'sinkronNilaiKuisLms')
  const res = await fn(input)
  return res.data
}

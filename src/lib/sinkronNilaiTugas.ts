import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export type HasilSinkronNilaiTugas = {
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

export async function sinkronNilaiTugasKePenilaian(input: {
  tugasId: string
  overwrite?: boolean
  semester?: '1' | '2'
  tahunAjaran?: string
}): Promise<HasilSinkronNilaiTugas> {
  const fn = httpsCallable<typeof input, HasilSinkronNilaiTugas>(functions, 'sinkronNilaiTugasLms')
  const res = await fn(input)
  return res.data
}

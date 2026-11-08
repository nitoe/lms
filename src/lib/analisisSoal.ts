import type { Soal } from '../types/soal'
import { teksPolos } from './html'

const KATA_BUTUH_STIMULUS = [
  'perhatikan', 'lihat gambar', 'pada gambar', 'berdasarkan gambar',
  'tabel', 'grafik', 'diagram', 'ilustrasi', 'peta', 'gambar berikut',
  'data berikut', 'bacalah', 'teks berikut', 'cerita berikut',
  'stimulus', 'wacana', 'paragraf berikut', 'kutipan',
]

export interface HasilAnalisisSoal {
  soal: Soal
  nomor: number
  masalah: string[]
}

export function butuhStimulusBelumAda(soal: Soal): boolean {
  if (soal.gambarId) return false
  const teks = teksPolos(soal.teks).toLowerCase()
  return KATA_BUTUH_STIMULUS.some((k) => teks.includes(k))
}

/** Analisis lengkap satu soal: stimulus + kelengkapan struktural. */
export function analisisSoal(soal: Soal, nomor: number): HasilAnalisisSoal {
  const masalah: string[] = []

  // Stimulus
  if (butuhStimulusBelumAda(soal)) {
    masalah.push('Butuh stimulus/ilustrasi tetapi belum ada gambar')
  }

  // Pembahasan
  if (!soal.pembahasan || teksPolos(soal.pembahasan).length < 10) {
    masalah.push('Belum ada pembahasan')
  }

  // Validasi per tipe
  if (soal.tipe === 'pg' || soal.tipe === 'pgk') {
    if (!soal.opsi || soal.opsi.length < 2) masalah.push('Opsi kurang')
    if (soal.tipe === 'pgk' && soal.opsi && soal.opsi.length > 4) masalah.push('PG kompleks lebih dari 4 opsi')
    if (soal.tipe === 'pg' && !soal.kunci) masalah.push('Tidak ada kunci')
    if (soal.tipe === 'pgk' && (!soal.kunci || soal.kunci.length === 0)) masalah.push('Tidak ada kunci')
    if (soal.tipe === 'pgk' && soal.kunci && soal.kunci.length > 2) masalah.push('PG kompleks lebih dari 2 jawaban benar')
  }
  if (soal.tipe === 'isian' && (!soal.kunci || soal.kunci.length === 0)) {
    masalah.push('Isian tanpa kunci jawaban')
  }
  if (soal.tipe === 'jodoh' && (!soal.pasangan || soal.pasangan.length < 2)) {
    masalah.push('Menjodohkan tanpa pasangan')
  }
  if (soal.tipe === 'bs' && (!soal.pernyataan || soal.pernyataan.length === 0)) {
    masalah.push('Benar/Salah tanpa pernyataan')
  }

  return { soal, nomor, masalah }
}

export function daftarSoalBermasalah(soalList: Soal[]): HasilAnalisisSoal[] {
  return soalList
    .map((soal, i) => analisisSoal(soal, i + 1))
    .filter((h) => h.masalah.length > 0)
}

export function daftarSoalButuhStimulus(soalList: Soal[]): { soal: Soal; nomor: number }[] {
  return daftarSoalBermasalah(soalList)
    .filter((h) => h.masalah.some((m) => m.includes('stimulus')))
    .map((h) => ({ soal: h.soal, nomor: h.nomor }))
}

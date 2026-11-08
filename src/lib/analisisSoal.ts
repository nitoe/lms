import type { Soal } from '../types/soal'
import { teksPolos } from './html'

/**
 * Deteksi apakah soal kemungkinan membutuhkan stimulus/ilustrasi
 * tetapi belum memiliki gambarId.
 *
 * Heuristik sederhana (bisa ditingkatkan nanti dengan AI):
 * - Kata kunci yang menunjukkan kebutuhan visual/data
 * - Tidak ada gambarId pada soal
 */
const KATA_BUTUH_STIMULUS = [
  'perhatikan', 'lihat gambar', 'pada gambar', 'berdasarkan gambar',
  'tabel', 'grafik', 'diagram', 'ilustrasi', 'peta', 'gambar berikut',
  'data berikut', 'bacalah', 'teks berikut', 'cerita berikut',
  'stimulus', 'wacana', 'paragraf berikut', 'kutipan',
]

export function butuhStimulusBelumAda(soal: Soal): boolean {
  if (soal.gambarId) return false
  const teks = teksPolos(soal.teks).toLowerCase()
  return KATA_BUTUH_STIMULUS.some((k) => teks.includes(k))
}

export function daftarSoalButuhStimulus(soalList: Soal[]): { soal: Soal; nomor: number }[] {
  return soalList
    .map((soal, i) => ({ soal, nomor: i + 1 }))
    .filter(({ soal }) => butuhStimulusBelumAda(soal))
}

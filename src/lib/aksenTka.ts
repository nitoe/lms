/**
 * Aksen warna per mapel untuk panel Bank Soal & Kuis.
 * Selaras dengan dashboard TKA (IPA rose, Matematika teal, Bahasa Indonesia biru);
 * mapel reguler memakai aksen biru-ungu Muhammadiyah (`umum`).
 */
import type { PaketSoal, TipeSoal } from '../types/soal'
import { adalahMapelTka } from './tkaAkses'

export type KodeAksen = 'ipa' | 'mtk' | 'bi' | 'umum'

export function kodeAksenMapel(mapel: string | null | undefined): KodeAksen {
  if (!adalahMapelTka(mapel)) return 'umum'
  if (mapel === 'TKA IPA') return 'ipa'
  if (mapel === 'TKA Matematika') return 'mtk'
  return 'bi'
}

/** Kelas pembungkus yang menyetel variabel warna `--pk-*` (lihat tka-bank.css). */
export function kelasAksenMapel(mapel: string | null | undefined): string {
  return `pk-aksen pk-aksen--${kodeAksenMapel(mapel)}`
}

/** Label bentuk soal versi ringkas untuk chip kartu. */
export const LABEL_TIPE_PENDEK: Record<TipeSoal, string> = {
  pg: 'Pilihan ganda',
  pgk: 'PG kompleks',
  jodoh: 'Menjodohkan',
  bs: 'Benar–Salah',
  isian: 'Isian',
  uraian: 'Uraian',
}

/** Materi sebuah paket: level paket dulu, lalu soal pertama yang punya materi. */
export function materiPaket(p: PaketSoal): string {
  const dariPaket = (p.tipeMateri ?? '').trim()
  if (dariPaket) return dariPaket
  const dariSoal = (p.soal ?? []).find((x) => (x.tipeMateri ?? '').trim())
  return (dariSoal?.tipeMateri ?? '').trim()
}

/** Paket memuat materi tertentu (di level paket atau di salah satu soal). */
export function paketMemuatMateri(p: PaketSoal, materi: string): boolean {
  if ((p.tipeMateri ?? '') === materi) return true
  return (p.soal ?? []).some((x) => (x.tipeMateri ?? '') === materi)
}

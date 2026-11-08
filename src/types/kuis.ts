/**
 * Model kuis LMS — disusun dari paket bank soal (`lms_paket_soal`) yang berstatus `siap`.
 * Snapshot soal disimpan di dokumen kuis agar stabil (perubahan bank tidak merusak kuis aktif).
 * Model lama `lms_soal` terpisah dihentikan (draf diganti total).
 */
import type { KompleksitasSoal, Soal, TipeSoal } from './soal'

export type ModeSusunKuis = 'manual' | 'otomatis' | 'otomatis_ai'

/** Filter yang dipakai saat mode otomatis / otomatis_ai. */
export interface FilterSusunKuis {
  /** Target jumlah soal keseluruhan (0 = tidak dibatasi selain filter lain). */
  jumlahSoal?: number
  /** Bentuk yang diizinkan. Kosong = semua. */
  tipe?: TipeSoal[]
  /** Jumlah target per bentuk (opsional; dihormati selama stok mencukupi). */
  jumlahPerTipe?: Partial<Record<TipeSoal, number>>
  /** Kompleksitas yang diizinkan. Kosong = semua. */
  kompleksitas?: KompleksitasSoal[]
  /** Jumlah target per kompleksitas (opsional). */
  jumlahPerKompleksitas?: Partial<Record<KompleksitasSoal, number>>
}

/**
 * Satu soal di dalam kuis = salinan penuh dari bank + jejak sumber.
 * `poin` default 1 saat disusun; guru boleh mengubah nanti.
 */
export type SoalKuis = Soal & {
  /** ID paket bank asal. */
  sumberPaketId: string
  /** ID soal di dalam array paket asal (bukan id dokumen terpisah). */
  sumberSoalId: string
  /** Judul paket (denormalisasi untuk UI). */
  sumberPaketJudul?: string
}

/** Dokumen `lms_kuis/{id}`. */
export interface KuisLms {
  id: string
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  /** Paket bank yang dipakai sebagai sumber (boleh lebih dari satu). */
  sumberPaketIds: string[]
  modeSusun: ModeSusunKuis
  filterSusun?: FilterSusunKuis
  /** Snapshot soal (stabil). */
  soal: SoalKuis[]
  durasiMenit?: number
  acakSoal?: boolean
  acakOpsi?: boolean
  aktif: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  /** Denormalisasi. */
  jumlahSoal: number
  totalPoin: number
  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_SOAL_PER_KUIS = 100
export const BATAS_PAKET_SUMBER = 12

/** Ringkasan untuk daftar (tanpa array soal penuh). */
export type KuisRingkas = Omit<KuisLms, 'soal' | 'filterSusun'> & {
  soal?: SoalKuis[]
}

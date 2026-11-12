/**
 * Rekap Nilai Try Out TKA — per tahap (I–V) × mapel TKA × siswa kelas 6A/6B.
 * Nilai otomatis dari lms_jawaban kuis dengan tahapTryOutTka cocok;
 * override manual di lms_rekap_tka.
 */
import type { MapelTkaNama } from '../lib/tkaAkses'
import type { TahapTryOutTka } from './kuis'

export type SumberNilaiTka = 'otomatis' | 'manual'

/**
 * Satu baris sebaran capaian (kompleksitas / tipe materi / domain).
 * Berbobot POIN (bukan jumlah soal): persen = poin / maks × 100.
 */
export type BarisSebaranTka = {
  /** Kunci stabil: L1, Bilangan, pengetahuan, … */
  key: string
  nama: string
  /** Poin diperoleh (boleh pecahan bila skor parsial). */
  poin: number
  /** Poin maksimum kelompok ini. */
  maks: number
  /** 0–100, satu desimal. */
  persen: number
}

/** Sebaran capaian satu siswa pada satu mapel TKA (satu tahap). */
export type SebaranMapelTka = {
  skor: number
  maks: number
  kompleksitas?: BarisSebaranTka[]
  materi?: BarisSebaranTka[]
  /** Khusus IPA: pengetahuan vs keterampilan proses. */
  domain?: BarisSebaranTka[]
  /** true = waktu habis; soal yang tidak sempat tampil tidak dihitung (data sumber lama). */
  waktuHabis?: boolean
}

/** Dokumen `lms_rekap_tka/{kelas}_{tahap}_{siswaId}`. */
export type RekapTkaDok = {
  id: string
  kelas: string
  tahap: TahapTryOutTka
  siswaId: string
  siswaNama: string
  /** Nilai 0–100 per mapel TKA. Hanya mapel yang diisi (manual atau disimpan). */
  nilai: Partial<Record<MapelTkaNama, number | null>>
  /** Asal nilai per mapel. Otomatis dihitung di klien; manual disimpan di sini. */
  sumber: Partial<Record<MapelTkaNama, SumberNilaiTka>>
  /** Opsional: kuis sumber nilai otomatis terakhir. */
  kuisIdRef?: Partial<Record<MapelTkaNama, string>>
  /**
   * Sebaran capaian per mapel untuk nilai yang diimpor / manual (mis. Try Out I dari portal lama).
   * Nilai otomatis dari LMS tidak disimpan di sini — dihitung dari lms_jawaban.
   */
  sebaran?: Partial<Record<MapelTkaNama, SebaranMapelTka>>
  diubahOleh?: string
  diubahOlehNama?: string
  updatedAt?: unknown
  createdAt?: unknown
}

/** Satu sel nilai di UI rekap (hasil gabungan otomatis + manual). */
export type SelNilaiTka = {
  nilai: number | null
  sumber: SumberNilaiTka | null
  /** Judul kuis sumber otomatis, jika ada. */
  dariKuis?: string
  kuisId?: string
  /** Sebaran capaian (otomatis dari jawaban LMS, atau hasil import). null = tidak ada data butir. */
  sebaran?: SebaranMapelTka | null
}

export type BarisRekapTka = {
  siswaId: string
  siswaNama: string
  kelas: string
  perMapel: Record<MapelTkaNama, SelNilaiTka>
}

export function idRekapTka(kelas: string, tahap: TahapTryOutTka, siswaId: string): string {
  return `${String(kelas).toUpperCase()}_${tahap}_${siswaId}`
}

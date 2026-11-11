/**
 * Rekap Nilai Try Out TKA — per tahap (I–V) × mapel TKA × siswa kelas 6A/6B.
 * Nilai otomatis dari lms_jawaban kuis dengan tahapTryOutTka cocok;
 * override manual di lms_rekap_tka.
 */
import type { MapelTkaNama } from '../lib/tkaAkses'
import type { TahapTryOutTka } from './kuis'

export type SumberNilaiTka = 'otomatis' | 'manual'

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

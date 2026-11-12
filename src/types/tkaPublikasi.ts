/**
 * Publikasi hasil Try Out TKA ke portal orang tua (khusus kelas 6).
 * Snapshot — bukan baca live lms_rekap_tka.
 *
 * Selain nilai akhir per mapel, snapshot dapat memuat sebaran capaian:
 * - per tingkat kompleksitas (L1 / L2 / L3)
 * - per tipe materi (Bilangan, Pemahaman Tekstual, …)
 * - per domain TKA IPA (pengetahuan / keterampilan_proses)
 */
import type { TahapTryOutTka } from './kuis'

/** Kunci mapel ringkas di snapshot portal (bukan nama TKA panjang). */
export type MapelOrtuTka = 'BI' | 'MTK' | 'IPA'

/** Label tampilan penuh untuk portal (jangan disingkat BI). */
export const LABEL_MAPEL_ORTU: Record<MapelOrtuTka, string> = {
  BI: 'Bahasa Indonesia',
  MTK: 'Matematika',
  IPA: 'IPA',
}

export type NilaiOrtuTka = Partial<Record<MapelOrtuTka, number | null>>

/** Satu baris sebaran (kompleksitas / materi / domain). */
export type SebaranBarisOrtu = {
  /** Kunci stabil (L1, Bilangan, pengetahuan, …). */
  key: string
  /** Label tampilan. */
  nama: string
  benar: number
  total: number
  /** 0–100. */
  persen: number
}

/** Sebaran satu mapel untuk satu siswa × tahap. */
export type SebaranMapelOrtu = {
  kompleksitas?: SebaranBarisOrtu[]
  materi?: SebaranBarisOrtu[]
  /** Khusus IPA: Pengetahuan IPA vs Keterampilan Proses Sains. */
  domain?: SebaranBarisOrtu[]
}

export type SebaranOrtuTka = Partial<Record<MapelOrtuTka, SebaranMapelOrtu>>

/** `lms_tka_publikasi/{kelas}_{tahap}` — gerbang publish per rombel × tahap. */
export type TkaPublikasiDok = {
  id: string
  kelas: string
  tahap: TahapTryOutTka
  published: boolean
  publishedAt?: unknown
  publishedBy?: string
  publishedByNama?: string
  catatanOrtu?: string
  jumlahSiswa?: number
  updatedAt?: unknown
}

/** `lms_tka_hasil_ortu/{kelas}_{tahap}_{siswaId}` */
export type TkaHasilOrtuDok = {
  id: string
  kelas: string
  tahap: TahapTryOutTka
  siswaId: string
  siswaNama: string
  nilai: NilaiOrtuTka
  /** Rata mapel yang dihitung untuk ranking (tahap I: 2 mapel; II–V: 3 mapel). */
  rataRata: number | null
  /** Peringkat di gabungan 6A+6B (1 = tertinggi). null = tidak masuk ranking. */
  peringkat: number | null
  /** Jumlah peserta yang masuk ranking pada tahap ini. */
  jumlahPesertaRanking: number
  published: boolean
  publishedAt?: unknown
  catatanOrtu?: string
  /** Sebaran capaian per mapel (opsional; diisi saat publish dari data LMS). */
  sebaran?: SebaranOrtuTka
  updatedAt?: unknown
}

/** Satu baris 10 besar. */
export type TkaPeringkatBaris = {
  peringkat: number
  siswaId: string
  siswaNama: string
  kelas: string
  rataRata: number
  nilai: NilaiOrtuTka
}

/** `lms_tka_peringkat/{tahap}` — 10 besar gabungan 6A+6B. */
export type TkaPeringkatDok = {
  id: string
  tahap: TahapTryOutTka
  top10: TkaPeringkatBaris[]
  jumlahPeserta: number
  updatedAt?: unknown
  updatedByNama?: string
}

export function idTkaPublikasi(kelas: string, tahap: TahapTryOutTka): string {
  return `${String(kelas).toUpperCase()}_${tahap}`
}

export function idTkaHasilOrtu(
  kelas: string,
  tahap: TahapTryOutTka,
  siswaId: string,
): string {
  return `${String(kelas).toUpperCase()}_${tahap}_${siswaId}`
}

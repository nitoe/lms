/**
 * Kesempatan mengerjakan tugas berulang (ANTIREGRESI §Tugas.Kesempatan).
 *
 * Model: nilai TETAP satu dokumen `lms_nilai_tugas/{tugasId_siswaId}`. Percobaan berikutnya dibuka
 * guru lewat «Minta perbaikan» (`bukaPerbaikan: true`). Selama terbuka, rules mengizinkan siswa
 * mengirim ulang; begitu guru menilai pengiriman baru, `bukaPerbaikan` kembali false.
 * Batas percobaan dijaga di sini (UI guru), bukan di rules, karena rules tidak bisa menghitung.
 */
import type { NilaiDipakaiTugas, TugasLms } from '../types/tugas'

export const KESEMPATAN_BATAS_MAKS = 5

/** 1 = sekali (default/legacy), 2–5 = berulang dengan batas, 0 = tanpa batas. Nilai aneh → 1. */
export function normKesempatanMaks(v: unknown): number {
  if (v === 0) return 0
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1
  const n = Math.floor(v)
  if (n < 2) return 1
  return Math.min(KESEMPATAN_BATAS_MAKS, n)
}

export function normNilaiDipakai(v: unknown): NilaiDipakaiTugas {
  return v === 'terakhir' ? 'terakhir' : 'terbaik'
}

/** Tugas boleh dikerjakan berulang? (kelompok selalu sekali) */
export function tugasBerulang(
  t: Pick<TugasLms, 'kesempatanMaks' | 'modeKelompok'>,
): boolean {
  if (t.modeKelompok === true) return false
  return normKesempatanMaks(t.kesempatanMaks) !== 1
}

export type RiwayatPercobaan = {
  ke: number
  nilai: number
  predikat?: string
  komentar?: string
  poin?: string[]
  /** Waktu simpan (ms, jam perangkat guru — hanya untuk tampilan). */
  ms?: number
}

/** Sisa percobaan (Infinity = tanpa batas). `terpakai` = jumlah percobaan yang sudah dinilai. */
export function sisaKesempatan(maks: unknown, terpakai: number): number {
  const m = normKesempatanMaks(maks)
  if (m === 0) return Infinity
  return Math.max(0, m - Math.max(0, terpakai))
}

/** Teks aturan untuk siswa/guru. */
export function teksAturanKesempatan(
  t: Pick<TugasLms, 'kesempatanMaks' | 'nilaiDipakai' | 'modeKelompok'>,
): string {
  if (!tugasBerulang(t)) return 'Tugas ini dikerjakan satu kali.'
  const m = normKesempatanMaks(t.kesempatanMaks)
  const batas = m === 0 ? 'Boleh diperbaiki beberapa kali' : `Boleh diperbaiki sampai ${m} kali mengerjakan`
  const pakai =
    normNilaiDipakai(t.nilaiDipakai) === 'terakhir'
      ? 'yang dipakai nilai percobaan terakhir'
      : 'yang dipakai nilai terbaik'
  return `${batas} · ${pakai}.`
}

type NilaiSebagian = {
  bukaPerbaikan?: unknown
  percobaanDinilai?: unknown
  /** Timestamp server saat guru menekan «Minta perbaikan». */
  dibukaAt?: unknown
}

/** Timestamp Firestore (atau {seconds}) → ms. 0 bila kosong/tidak dikenal. */
export function msDariTs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    return (v as { toMillis: () => number }).toMillis()
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  return 0
}

/** Waktu (ms, jam server) percobaan dibuka; 0 bila tidak ada. */
export function dibukaMs(nilai: NilaiSebagian | null | undefined): number {
  return nilai ? msDariTs(nilai.dibukaAt) : 0
}

/** Siswa sedang boleh mengirim perbaikan (guru sudah menekan «Minta perbaikan»). */
export function perbaikanTerbuka(nilai: NilaiSebagian | null | undefined): boolean {
  return !!nilai && nilai.bukaPerbaikan === true
}

export function percobaanTerpakai(nilai: NilaiSebagian | null | undefined): number {
  if (!nilai) return 0
  const n = nilai.percobaanDinilai
  return typeof n === 'number' && n >= 1 ? Math.floor(n) : 1
}

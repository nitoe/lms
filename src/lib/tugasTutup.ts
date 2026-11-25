/**
 * Penutupan penugasan (ANTIREGRESI §Tugas.Selesai.Ditutup + §Tugas.Tenggat.Otomatis).
 * Tugas ditutup untuk siswa bila:
 *  - guru menandai selesai (`selesai === true`), atau
 *  - `tutupSetelahTenggat === true` DAN tenggat sudah dilewati.
 * Penutupan oleh tenggat DITURUNKAN saat dibaca (tidak menulis `selesai`), dan ditegakkan juga oleh
 * rules (request.time, dengan toleransi TOLERANSI_UNGGAH_MENIT) — jaga ketiganya tetap sejalan.
 */
import type { TugasLms } from '../types/tugas'

/** Toleransi unggahan yang sedang berjalan saat tenggat terlewati. WAJIB sama dengan rules. */
export const TOLERANSI_UNGGAH_MENIT = 5

export type AlasanDitutup = 'selesai' | 'tenggat'

function msTenggat(v: unknown): number {
  if (!v) return 0
  if (v instanceof Date) return v.getTime() || 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  return 0
}

/** null = tugas masih terbuka. «selesai» didahulukan agar keterangannya konsisten. */
export function alasanTugasDitutup(
  t: Pick<TugasLms, 'selesai' | 'tenggat' | 'tutupSetelahTenggat'>,
  sekarang: number = Date.now(),
): AlasanDitutup | null {
  if (t.selesai === true) return 'selesai'
  if (t.tutupSetelahTenggat === true) {
    const ms = msTenggat(t.tenggat)
    if (ms > 0 && sekarang >= ms) return 'tenggat'
  }
  return null
}

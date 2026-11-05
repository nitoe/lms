import type { AppUser, PeranLms } from '../types/user'

const ROLE_GURU = ['guru', 'guru_tahsin_tahfizh', 'guru_akademik']

export const NAMA_PERAN: Record<PeranLms, string> = {
  admin: 'Administrator',
  guru: 'Guru',
  siswa: 'Siswa',
  orangtua: 'Orang Tua',
}

/**
 * Peran efektif di LMS.
 * - admin Penilaian → admin LMS
 * - role guru* → guru
 * - role orangtua (approved) → orangtua
 * Field peranLms bisa dipakai nanti untuk override (mis. staff khusus).
 */
export function peranDari(profil: AppUser | null): PeranLms | null {
  if (!profil || profil.aktif === false) return null
  if (profil.role === 'admin') return 'admin'
  if (profil.peranLms && ['admin', 'guru', 'siswa', 'orangtua'].includes(profil.peranLms)) {
    return profil.peranLms
  }
  if (profil.role && ROLE_GURU.includes(profil.role)) return 'guru'
  if (profil.role === 'orangtua' && profil.status === 'approved') return 'orangtua'
  return null
}

export function isStaf(peran: PeranLms | null): boolean {
  return peran === 'admin' || peran === 'guru'
}

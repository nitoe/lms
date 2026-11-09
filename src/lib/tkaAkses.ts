import type { User } from 'firebase/auth'
import type { AppUser } from '../types/user'

/**
 * Aturan akses menu TKA (ANTIREGRESI §76).
 *
 * - Guru kelas 6 = wali kelas 6A/6B/6C (profil.waliKelas), role guru/guru_akademik.
 * - Admin TKA = pembuat aplikasi: UID + email tetap (pola sama dengan analisis kuis AI, §56).
 * - Siswa = claim `kelas` dari token loginSiswaLms diawali "6".
 *
 * PENTING: fungsi ini hanya mengatur TAMPILAN. Penegak sebenarnya adalah firestore.rules
 * (tkaAdmin / tkaGuruKelas6 / tkaStaf) dan Cloud Function. Ubah keduanya bersamaan.
 */

export const KELAS_TKA = ['6A', '6B', '6C'] as const

export const EMAIL_ADMIN_TKA = 'arif.azwar79@gmail.com'
export const UID_ADMIN_TKA = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'

const ROLE_GURU_TKA = ['guru', 'guru_akademik']

export function adalahAdminTka(user: User | null, profil: AppUser | null): boolean {
  if (!user || !profil || profil.aktif === false) return false
  return user.uid === UID_ADMIN_TKA && (user.email || '').toLowerCase() === EMAIL_ADMIN_TKA
}

/** Kelas 6 yang diwalikan guru ini (kosong bila bukan wali kelas 6). */
export function kelasTkaDiwalikan(profil: AppUser | null): string[] {
  if (!profil || profil.aktif === false) return []
  if (!profil.role || !ROLE_GURU_TKA.includes(profil.role)) return []
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.filter((k) => (KELAS_TKA as readonly string[]).includes(k))
}

export function adalahGuruKelas6(profil: AppUser | null): boolean {
  return kelasTkaDiwalikan(profil).length > 0
}

/** Boleh melihat menu TKA di sidebar guru. */
export function bolehAksesTkaStaf(user: User | null, profil: AppUser | null): boolean {
  return adalahAdminTka(user, profil) || adalahGuruKelas6(profil)
}

/** Boleh melihat menu TKA di area siswa. */
export function bolehTkaSiswa(kelas: string | null | undefined): boolean {
  return !!kelas && (KELAS_TKA as readonly string[]).includes(kelas.trim().toUpperCase())
}

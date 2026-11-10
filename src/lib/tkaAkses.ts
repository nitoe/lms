import type { User } from 'firebase/auth'
import type { AppUser } from '../types/user'
import { buatRuangId } from './kelasLms'

/**
 * Aturan akses menu TKA (ANTIREGRESI §76 & §77).
 *
 * TKA = ruang khusus di pipeline kuis LMS: kelas 6A/6B/6C × mapel «TKA Matematika» /
 * «TKA Bahasa Indonesia». Bank soal = lms_paket_soal, kuis = lms_kuis, hasil = lms_jawaban.
 *
 * - Guru kelas 6 = wali kelas 6A/6B/6C (profil.waliKelas) → mengelola kelasnya sendiri.
 * - Pengecualian email: arif.azwar79@gmail.com (wali kelas 5A) boleh mengelola SEMUA kelas 6
 *   untuk keperluan uji sistem. Ini bukan peran admin.
 * - Siswa = claim `kelas` dari token loginSiswaLms adalah 6A/6B/6C.
 *
 * PENTING: fungsi ini hanya mengatur TAMPILAN. Penegak sebenarnya adalah firestore.rules
 * (tkaEmailKhusus, tkaGuruKelas6, ruangTka). Ubah keduanya bersamaan.
 */

export const KELAS_TKA = ['6A', '6B', '6C'] as const

export const EMAIL_AKSES_KHUSUS_TKA = 'arif.azwar79@gmail.com'

export const MAPEL_TKA = ['TKA Matematika', 'TKA Bahasa Indonesia'] as const

const ROLE_GURU_TKA = ['guru', 'guru_akademik']

export function adalahMapelTka(mapel: string | null | undefined): boolean {
  return !!mapel && (MAPEL_TKA as readonly string[]).includes(mapel)
}

export function adalahKelasTka(kelas: string | null | undefined): boolean {
  return !!kelas && (KELAS_TKA as readonly string[]).includes(kelas.trim().toUpperCase())
}

function emailAksesKhusus(user: User | null, profil: AppUser | null): boolean {
  if (!user || !profil || profil.aktif === false) return false
  return (user.email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA
}

/** Kelas 6 yang boleh dikelola akun ini (kosong = tidak punya akses TKA). */
export function kelasTkaDikelola(user: User | null, profil: AppUser | null): string[] {
  if (emailAksesKhusus(user, profil)) return [...KELAS_TKA]
  if (!profil || profil.aktif === false) return []
  if (!profil.role || !ROLE_GURU_TKA.includes(profil.role)) return []
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return KELAS_TKA.filter((k) => wali.includes(k))
}

/** Boleh melihat menu TKA di sidebar guru. */
export function bolehAksesTkaStaf(user: User | null, profil: AppUser | null): boolean {
  return kelasTkaDikelola(user, profil).length > 0
}

/** Boleh melihat menu TKA di area siswa. */
export function bolehTkaSiswa(kelas: string | null | undefined): boolean {
  return adalahKelasTka(kelas)
}

export function ruangTka(kelas: string, mapel: string): { id: string; kelas: string; mapel: string } {
  return { id: buatRuangId(kelas, mapel), kelas, mapel }
}

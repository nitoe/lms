import type { User } from 'firebase/auth'
import type { AppUser } from '../types/user'
import { buatRuangId } from './kelasLms'

/**
 * Aturan akses menu TKA (ANTIREGRESI §76, §77, §85, §86).
 *
 * TKA = ruang khusus di pipeline kuis LMS. Bank soal bersama untuk seluruh kelas 6
 * (disimpan dengan kelas kanonik «6»), mapel:
 *   «TKA Matematika» | «TKA Bahasa Indonesia» | «TKA IPA»
 *
 * PENTING: fungsi ini hanya mengatur TAMPILAN. Penegak sebenarnya adalah firestore.rules
 * (tkaEmailKhusus, tkaGuruKelas6Any, ruangTka). Ubah keduanya bersamaan.
 */

export const KELAS_TKA = ['6A', '6B'] as const
export const KELAS_TKA_BANK = '6'
export const EMAIL_AKSES_KHUSUS_TKA = 'arif.azwar79@gmail.com'
export const MAPEL_TKA = ['TKA Matematika', 'TKA Bahasa Indonesia', 'TKA IPA'] as const
export type MapelTkaNama = (typeof MAPEL_TKA)[number]

/**
 * Materi tetap per mapel TKA (pengganti TP).
 * IPA mencakup Fase B dan Fase C (pola TKA resmi sering lintas fase).
 */
export const MATERI_TKA: Record<MapelTkaNama, readonly string[]> = {
  'TKA Matematika': ['Bilangan', 'Geometri dan Pengukuran', 'Data'],
  'TKA Bahasa Indonesia': [
    'Pemahaman Tekstual',
    'Pemahaman Inferensial',
    'Evaluasi dan Apresiasi',
  ],
  'TKA IPA': [
    'Pancaindra Manusia',
    'Siklus Hidup dan Pelestarian Makhluk Hidup',
    'Zat dan Wujudnya',
    'Energi dan Perubahannya',
    'Gaya dan Pengaruhnya',
    'Bumi dan Pelestarian SDA',
    'Sistem Organ Manusia',
    'Ekosistem dan Lingkungan',
    'Gelombang Bunyi dan Cahaya',
    'Energi Alternatif',
    'Bumi dan Antariksa',
  ],
}

export const LABEL_MAPEL_TKA: Record<MapelTkaNama, string> = {
  'TKA Matematika': 'Matematika',
  'TKA Bahasa Indonesia': 'Bahasa Indonesia',
  'TKA IPA': 'IPA',
}

export const TIPE_SOAL_TKA = ['pg', 'pgk', 'bs'] as const
export type TipeSoalTka = (typeof TIPE_SOAL_TKA)[number]

const ROLE_GURU_TKA = ['guru', 'guru_akademik']

export function adalahMapelTka(mapel: string | null | undefined): boolean {
  return !!mapel && (MAPEL_TKA as readonly string[]).includes(mapel)
}

export function adalahKelasTka(kelas: string | null | undefined): boolean {
  if (!kelas) return false
  const k = kelas.trim().toUpperCase()
  return (KELAS_TKA as readonly string[]).includes(k) || k === KELAS_TKA_BANK
}

export function materiTkaUntuk(mapel: string | null | undefined): readonly string[] {
  if (!mapel || !adalahMapelTka(mapel)) return []
  return MATERI_TKA[mapel as MapelTkaNama] ?? []
}

function emailAksesKhusus(user: User | null, profil: AppUser | null): boolean {
  if (!user || !profil || profil.aktif === false) return false
  return (user.email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA
}

export function bolehAksesTkaStaf(user: User | null, profil: AppUser | null): boolean {
  if (emailAksesKhusus(user, profil)) return true
  if (!profil || profil.aktif === false) return false
  if (!profil.role || !ROLE_GURU_TKA.includes(profil.role)) return false
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return KELAS_TKA.some((k) => wali.includes(k))
}

/** @deprecated Gunakan bolehAksesTkaStaf. */
export function kelasTkaDikelola(user: User | null, profil: AppUser | null): string[] {
  if (!bolehAksesTkaStaf(user, profil)) return []
  return [KELAS_TKA_BANK]
}

export function bolehTkaSiswa(kelas: string | null | undefined): boolean {
  if (!kelas) return false
  return (KELAS_TKA as readonly string[]).includes(kelas.trim().toUpperCase())
}

export function ruangTka(mapel: string): { id: string; kelas: string; mapel: string } {
  return { id: buatRuangId(KELAS_TKA_BANK, mapel), kelas: KELAS_TKA_BANK, mapel }
}

/**
 * Kelas rombel yang boleh dilihat di laporan hasil TKA (bukan kelas bank «6»).
 * - Email khusus (admin TKA): 6A dan 6B.
 * - Wali 6A saja → ['6A']; wali 6B saja → ['6B']; keduanya → keduanya.
 * Dipakai hanya di UI hasil; rules tetap memakai tkaWaliKelas6Any untuk baca.
 */
export function kelasHasilTkaBolehDilihat(
  user: User | null,
  profil: AppUser | null,
): string[] {
  if (!bolehAksesTkaStaf(user, profil)) return []
  if (emailAksesKhusus(user, profil)) return [...KELAS_TKA]
  const wali = Array.isArray(profil?.waliKelas) ? profil!.waliKelas : []
  return KELAS_TKA.filter((k) => wali.includes(k))
}

/** true bila user adalah admin TKA (email khusus), bukan admin LMS. */
export function adalahAdminTka(user: User | null, profil: AppUser | null): boolean {
  return emailAksesKhusus(user, profil)
}

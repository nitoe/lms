import type { User } from 'firebase/auth'
import type { AppUser } from '../types/user'
import { buatRuangId } from './kelasLms'

/**
 * Aturan akses menu TKA (ANTIREGRESI §76, §77, §85).
 *
 * TKA = ruang khusus di pipeline kuis LMS. Bank soal bersama untuk seluruh kelas 6
 * (disimpan dengan kelas kanonik «6»), mapel:
 *   «TKA Matematika» | «TKA Bahasa Indonesia» | «TKA IPA»
 *
 * - Guru kelas 6 = wali kelas 6A/6B (profil.waliKelas) → mengelola bank soal TKA bersama.
 * - Pengecualian email: arif.azwar79@gmail.com (wali kelas 5A) boleh mengelola TKA
 *   untuk keperluan uji sistem. Ini bukan peran admin.
 * - Siswa = claim `kelas` dari token loginSiswaLms adalah 6A/6B.
 * - Kelas 6C tidak dipakai (tidak ada rombel 6C di sekolah).
 *
 * PENTING: fungsi ini hanya mengatur TAMPILAN. Penegak sebenarnya adalah firestore.rules
 * (tkaEmailKhusus, tkaGuruKelas6, ruangTka). Ubah keduanya bersamaan.
 */

/** Kelas rombel siswa TKA (bukan kelas penyimpanan bank). */
export const KELAS_TKA = ['6A', '6B'] as const

/**
 * Kelas kanonik untuk dokumen bank soal / kuis TKA bersama.
 * Satu bank berlaku untuk 6A dan 6B. Jangan diganti tanpa migrasi data + rules.
 */
export const KELAS_TKA_BANK = '6'

export const EMAIL_AKSES_KHUSUS_TKA = 'arif.azwar79@gmail.com'

export const MAPEL_TKA = ['TKA Matematika', 'TKA Bahasa Indonesia', 'TKA IPA'] as const

export type MapelTkaNama = (typeof MAPEL_TKA)[number]

/** Materi tetap per mapel TKA (pengganti filter TP). */
export const MATERI_TKA: Record<MapelTkaNama, readonly string[]> = {
  'TKA Matematika': ['Bilangan', 'Geometri dan Pengukuran', 'Data'],
  'TKA Bahasa Indonesia': [
    'Pemahaman Tekstual',
    'Pemahaman Inferensial',
    'Evaluasi dan Apresiasi',
  ],
  'TKA IPA': [
    'Sistem Organ Manusia',
    'Ekosistem dan Lingkungan',
    'Gelombang Bunyi dan Cahaya',
    'Energi Alternatif',
    'Bumi dan Antariksa',
  ],
}

/** Bentuk soal yang diizinkan di bank TKA. */
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

/** Materi saran untuk mapel TKA (kosong jika bukan TKA). */
export function materiTkaUntuk(mapel: string | null | undefined): readonly string[] {
  if (!mapel || !adalahMapelTka(mapel)) return []
  return MATERI_TKA[mapel as MapelTkaNama] ?? []
}

function emailAksesKhusus(user: User | null, profil: AppUser | null): boolean {
  if (!user || !profil || profil.aktif === false) return false
  return (user.email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA
}

/**
 * True jika akun boleh mengelola bank soal TKA (guru 6A/6B atau akun uji).
 * Tidak lagi mengembalikan daftar kelas per-rombel — bank bersama.
 */
export function bolehAksesTkaStaf(user: User | null, profil: AppUser | null): boolean {
  if (emailAksesKhusus(user, profil)) return true
  if (!profil || profil.aktif === false) return false
  if (!profil.role || !ROLE_GURU_TKA.includes(profil.role)) return false
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return KELAS_TKA.some((k) => wali.includes(k))
}

/** @deprecated Gunakan bolehAksesTkaStaf. Dipertahankan agar pemanggil lama tidak putus. */
export function kelasTkaDikelola(user: User | null, profil: AppUser | null): string[] {
  if (!bolehAksesTkaStaf(user, profil)) return []
  // Bank bersama: selalu tampilkan kelas kanonik.
  return [KELAS_TKA_BANK]
}

/** Boleh melihat menu TKA di area siswa. */
export function bolehTkaSiswa(kelas: string | null | undefined): boolean {
  if (!kelas) return false
  return (KELAS_TKA as readonly string[]).includes(kelas.trim().toUpperCase())
}

/** Ruang TKA bersama (satu per mapel, kelas kanonik «6»). */
export function ruangTka(mapel: string): { id: string; kelas: string; mapel: string } {
  return { id: buatRuangId(KELAS_TKA_BANK, mapel), kelas: KELAS_TKA_BANK, mapel }
}

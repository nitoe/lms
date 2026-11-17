/**
 * Akses menu & operasi Lomba.
 * Penegak sebenarnya: firestore.rules (lms_lomba). Ubah keduanya bersamaan.
 *
 * Admin LMS = role admin (arif.nitoe@gmail.com dan admin lain).
 * Guru pengampu = uid yang tercantum di dokumen lomba.guruPengampuUid.
 * Siswa peserta = siswaId ada di lomba.siswaIds.
 */

import type { User } from 'firebase/auth'
import type { AppUser } from '../types/user'
import type { Lomba, StatusLomba } from '../types/lomba'
import { peranDari } from './peran'

/** Email admin LMS yang disebutkan di spesifikasi (selaras role admin). */
export const EMAIL_ADMIN_LMS = 'arif.nitoe@gmail.com'

/** Kelas kanonik bank konten lomba (materi / paket / kuis), pola mirip TKA «6». */
export const KELAS_LOMBA_BANK = 'LB'


export function adalahAdminLms(user: User | null, profil: AppUser | null): boolean {
  if (!user || !profil) return false
  if (profil.aktif === false) return false
  if (peranDari(profil) === 'admin') return true
  const email = (user.email || profil.email || '').toLowerCase()
  return email === EMAIL_ADMIN_LMS
}

/** Staf yang boleh melihat menu Lomba: admin, atau guru yang jadi pengampu ≥1 lomba. */
export function bolehAksesLombaStaf(
  user: User | null,
  profil: AppUser | null,
  lombaSebagaiPengampu: Lomba[] = [],
): boolean {
  if (adalahAdminLms(user, profil)) return true
  if (!user || !profil) return false
  if (profil.aktif === false) return false
  const peran = peranDari(profil)
  if (peran !== 'guru' && peran !== 'admin') return false
  return lombaSebagaiPengampu.length > 0
}

/** Boleh mengubah meta lomba (nama, masa, pengampu, peserta): admin saja. */
export function bolehAturMetaLomba(user: User | null, profil: AppUser | null): boolean {
  return adalahAdminLms(user, profil)
}

/** Boleh kelola konten (materi/bank/kuis) di dalam lomba: admin atau pengampu lomba itu. */
export function bolehKelolaKontenLomba(
  user: User | null,
  profil: AppUser | null,
  lomba: Lomba | null,
): boolean {
  if (!lomba) return false
  if (adalahAdminLms(user, profil)) return true
  if (!user) return false
  return lomba.guruPengampuUid === user.uid
}

/** Siswa boleh melihat menu Lomba jika terdaftar di ≥1 lomba (status aktif/draf/selesai). */
export function bolehLombaSiswa(siswaId: string | null | undefined, daftarLomba: Lomba[]): boolean {
  if (!siswaId) return false
  return daftarLomba.some((l) => l.siswaIds.includes(siswaId))
}

export function labelStatusLomba(s: StatusLomba): string {
  switch (s) {
    case 'draf':
      return 'Draf'
    case 'aktif':
      return 'Aktif'
    case 'selesai':
      return 'Selesai'
    case 'arsip':
      return 'Arsip'
    default:
      return s
  }
}

export function lombaSedangBerlangsung(l: Lomba, sekarang = new Date()): boolean {
  if (l.status !== 'aktif') return false
  if (l.mulai && sekarang < l.mulai) return false
  if (l.selesai && sekarang > l.selesai) return false
  return true
}

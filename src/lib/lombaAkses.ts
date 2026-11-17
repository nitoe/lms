/**
 * Akses menu & operasi Lomba.
 * Penegak sebenarnya: firestore.rules (lms_lomba). Ubah keduanya bersamaan.
 *
 * Admin LMS = role admin (arif.nitoe@gmail.com dan admin lain).
 * Guru pengampu = uid tercantum di lomba.guruPengampuUids (atau guruPengampuUid legacy).
 * Siswa peserta = siswaId ada di lomba.siswaIds.
 * Hanya admin yang boleh create/update meta lomba (termasuk daftar pengampu).
 */

import type { User } from 'firebase/auth'
import type { AppUser } from '../types/user'
import type { Lomba, StatusLomba } from '../types/lomba'
import { peranDari } from './peran'

/** Email admin LMS yang disebutkan di spesifikasi (selaras role admin). */
export const EMAIL_ADMIN_LMS = 'arif.nitoe@gmail.com'

/** Kelas kanonik bank konten lomba (materi / paket / kuis), pola mirip TKA «6». */
export const KELAS_LOMBA_BANK = 'LB'

/**
 * Nilai `mapel` untuk kuis Lomba yang menggabungkan soal dari beberapa mapel dalam satu kuis.
 * Disimpan di field string `mapel` dokumen `lms_kuis` (rules hanya mewajibkan string 1–80 karakter, jadi tanpa
 * perubahan rules). Asal mapel tiap soal ada di `SoalKuis.sumberMapel`. ANTIREGRESI §Lomba.13.
 */
export const MAPEL_GABUNGAN_LOMBA = 'Gabungan'

export function adalahMapelGabungan(mapel: string | null | undefined): boolean {
  return mapel === MAPEL_GABUNGAN_LOMBA
}

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

/** Apakah uid termasuk pengampu lomba (multi + legacy single). */
export function adalahPengampuLomba(lomba: Lomba | null, uid: string | null | undefined): boolean {
  if (!lomba || !uid) return false
  if (lomba.guruPengampuUids?.includes(uid)) return true
  if (lomba.guruPengampuUid === uid) return true
  return false
}

/** Boleh kelola konten (materi/bank/kuis) di dalam lomba: admin atau salah satu pengampu. */
export function bolehKelolaKontenLomba(
  user: User | null,
  profil: AppUser | null,
  lomba: Lomba | null,
): boolean {
  if (!lomba) return false
  if (adalahAdminLms(user, profil)) return true
  if (!user) return false
  return adalahPengampuLomba(lomba, user.uid)
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

/** Label ringkas daftar pengampu untuk kartu/daftar. */
export function labelPengampuLomba(l: Lomba): string {
  const list = l.guruPengampuList?.length
    ? l.guruPengampuList
    : l.guruPengampuUid
      ? [{ uid: l.guruPengampuUid, nama: l.guruPengampuNama || '—' }]
      : []
  if (list.length === 0) return '—'
  if (list.length === 1) return list[0].nama || '—'
  if (list.length === 2) return `${list[0].nama} · ${list[1].nama}`
  return `${list[0].nama} +${list.length - 1} pengampu`
}

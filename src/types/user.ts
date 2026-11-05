/** Peran di aplikasi LMS. */
export type PeranLms = 'admin' | 'guru' | 'siswa' | 'orangtua'

/** Profil di koleksi users/{uid} (dibagi dengan Penilaian, Perpustakaan, Sarpras). */
export interface AppUser {
  uid: string
  email: string
  nama: string
  gelar?: string
  /** Peran di Penilaian: admin, guru, guru_tahsin_tahfizh, guru_akademik, orangtua, dll. */
  role?: string
  /** Peran khusus aplikasi LMS (opsional). Admin Penilaian otomatis admin LMS. */
  peranLms?: PeranLms
  aktif?: boolean
  /** Field penugasan dari Penilaian (untuk guru). */
  penugasan?: unknown
  penugasanKelas?: string[]
  penugasanKelasMapel?: string[]
  waliKelas?: string[]
  kelasAmpu?: string[]
  anakIds?: string[]
  status?: string
}

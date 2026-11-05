/** Peran di aplikasi LMS. */
export type PeranLms = 'admin' | 'guru' | 'siswa' | 'orangtua'

/** Satu baris penugasan mapel (dari aplikasi Penilaian). */
export interface PenugasanMapel {
  kelas: string
  mapel: string
}

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
  /** Penugasan mapel (guru akademik) — sumber daftar ruang kelas. */
  penugasan?: PenugasanMapel[]
  penugasanKelas?: string[]
  /** Format "KELAS::MAPEL", mis. "4A::Matematika". */
  penugasanKelasMapel?: string[]
  waliKelas?: string[]
  kelasAmpu?: string[]
  anakIds?: string[]
  status?: string
}

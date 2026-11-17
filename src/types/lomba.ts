/** Model data modul Lomba LMS. */

export type StatusLomba = 'draf' | 'aktif' | 'selesai' | 'arsip'

/** Tingkat lomba (sekolah → nasional / lainnya). */
export type TingkatLomba =
  | 'sekolah'
  | 'kecamatan'
  | 'kota'
  | 'provinsi'
  | 'nasional'
  | 'lainnya'

export const TINGKAT_LOMBA: { value: TingkatLomba; label: string }[] = [
  { value: 'sekolah', label: 'Tingkat Sekolah' },
  { value: 'kecamatan', label: 'Tingkat Kecamatan' },
  { value: 'kota', label: 'Tingkat Kota / Kabupaten' },
  { value: 'provinsi', label: 'Tingkat Provinsi' },
  { value: 'nasional', label: 'Tingkat Nasional' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const STATUS_LOMBA: { value: StatusLomba; label: string }[] = [
  { value: 'draf', label: 'Draf' },
  { value: 'aktif', label: 'Aktif' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'arsip', label: 'Arsip' },
]

/** Satu peserta (denormalisasi dari koleksi siswa). */
export interface PesertaLomba {
  id: string
  nama: string
  kelas: string
  nisn?: string
}

/** Satu guru pengampu (denormalisasi). */
export interface PengampuLomba {
  uid: string
  nama: string
  email?: string
}

/** Dokumen `lms_lomba/{id}`. */
export interface Lomba {
  id: string
  nama: string
  deskripsi?: string
  identitas?: string
  tingkat: TingkatLomba
  /** Satu atau lebih mapel terkait — TP materi/bank/kuis dibatasi ke mapel ini. */
  mapelTerkait: string[]
  mulai: Date | null
  selesai: Date | null
  status: StatusLomba
  /**
   * Pengampu utama (pertama di daftar) — kompatibilitas query/tampilan lama.
   * Selalu selaras dengan `guruPengampuUids[0]` / `guruPengampuList[0]`.
   */
  guruPengampuUid: string
  guruPengampuNama: string
  guruPengampuEmail?: string
  /** Semua UID pengampu (maks MAKS_PENGAMPU_LOMBA). Query guru: array-contains. */
  guruPengampuUids: string[]
  /** Denormalisasi nama/email pengampu, urutan sama dengan uids. */
  guruPengampuList: PengampuLomba[]
  /** Maks 20. */
  siswaIds: string[]
  siswaList: PesertaLomba[]
  dibuatOleh: string
  dibuatOlehNama: string
  createdAt: Date | null
  updatedAt: Date | null
}

export const MAKS_PESERTA_LOMBA = 20
/** Maks guru pengampu per lomba (admin menunjuk; pengampu tidak bisa buat lomba baru). */
export const MAKS_PENGAMPU_LOMBA = 10

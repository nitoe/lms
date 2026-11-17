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
  guruPengampuUid: string
  guruPengampuNama: string
  guruPengampuEmail?: string
  /** Maks 20. */
  siswaIds: string[]
  siswaList: PesertaLomba[]
  dibuatOleh: string
  dibuatOlehNama: string
  createdAt: Date | null
  updatedAt: Date | null
}

export const MAKS_PESERTA_LOMBA = 20

/** Dokumen tugas di `lms_tugas/{id}`. */
export interface TugasLms {
  id: string
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  /** ISO string atau timestamp. */
  tenggat?: unknown
  aktif: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  jumlahPengumpulan?: number
  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_UKURAN_FILE_TUGAS = 10 * 1024 * 1024 // 10 MB

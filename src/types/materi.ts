/** Jenis materi pembelajaran. */
export type JenisMateri = 'pdf' | 'gambar' | 'video' | 'youtube' | 'tautan'

/** Dokumen `lms_materi/{id}`. */
export interface MateriLms {
  id: string
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  jenis: JenisMateri
  /** URL publik (YouTube, tautan, atau download URL Storage). */
  url?: string
  /** Path di Firebase Storage (jika unggah file). */
  storagePath?: string
  fileName?: string
  contentType?: string
  ukuran?: number
  /** Nama bab / unit (bebas), dihubungkan ke TP. */
  bab?: string
  /** ID dokumen `tp_kktp/{id}`. */
  tpId?: string
  tpNomor?: number
  /** Nama TP (denormalisasi untuk tampilan). */
  tpNama?: string
  urutan: number
  dibuatOleh: string
  dibuatOlehNama?: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** TP ringkas dari koleksi `tp_kktp` (Penilaian). */
export interface TpRingkas {
  id: string
  nomorTp: number
  namaTp: string
  mapel: string
  kelas: string
}

export const BATAS_UKURAN = {
  pdf: 10 * 1024 * 1024,
  gambar: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const

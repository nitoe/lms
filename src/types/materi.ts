/** Jenis materi pembelajaran. */
export type JenisMateri =
  | 'pdf'
  | 'gambar'
  | 'video'
  | 'youtube'
  | 'tautan'
  | 'halaman'

/** Blok konten di dalam satu halaman materi (V1: teks + gambar). */
export type MateriBlok =
  | { id: string; tipe: 'teks'; html: string }
  | {
      id: string
      tipe: 'gambar'
      url: string
      storagePath?: string
      alt?: string
      caption?: string
    }

/** Satu halaman dalam materi jenis halaman. */
export interface MateriHalaman {
  id: string
  /** Judul singkat (opsional) untuk daftar isi / navigasi. */
  judul?: string
  urutan: number
  blok: MateriBlok[]
}

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
  /** Path di Firebase Storage (jika unggah file tunggal). */
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
  /**
   * Konten multi-halaman (hanya jika `jenis === 'halaman'`).
   * Disimpan inline di dokumen materi agar satu baca cukup untuk siswa.
   */
  halaman?: MateriHalaman[]
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
  /** Gambar di dalam blok halaman (sedikit lebih ketat untuk mobile). */
  gambarHalaman: 8 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const

/** Batas praktis materi halaman (ANTIREGRESI). */
export const BATAS_HALAMAN_PER_MATERI = 20
export const BATAS_BLOK_PER_HALAMAN = 30

/** Jenis materi pembelajaran. */
export type JenisMateri = 'pdf' | 'gambar' | 'video' | 'youtube' | 'tautan' | 'halaman'

/** Status terbit materi tulis-sendiri (jenis `halaman`). Jenis lain selalu dianggap terbit. */
export type StatusMateri = 'draf' | 'terbit'

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
  /** Hanya jenis `halaman`: draf tidak tampil untuk siswa. Kosong = terbit. */
  status?: StatusMateri
  /** Hanya jenis `halaman`: jumlah halaman (denormalisasi untuk daftar). */
  jumlahHalaman?: number
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

/** Satu halaman materi tulis-sendiri. `html` = HTML terbatas, SELALU lewat bersihHtmlMateri sebelum tampil. */
export interface HalamanMateri {
  id: string
  judul: string
  html: string
}

/** Dokumen `lms_materi_isi/{materiId}` — isi halaman dipisah dari metadata agar daftar materi tetap ringan. */
export interface IsiMateri {
  materiId: string
  kelas: string
  mapel: string
  halaman: HalamanMateri[]
  /** Path Storage yang dipakai isi (untuk dibersihkan saat materi dihapus). */
  mediaPaths: string[]
  /** Salinan status terbit; rules siswa hanya mengizinkan baca bila true. */
  terbit: boolean
}

export const BATAS_HALAMAN = {
  maksHalaman: 60,
  /** Total karakter HTML semua halaman (dokumen Firestore maks 1 MiB). */
  maksKarakter: 600_000,
} as const

export const BATAS_MEDIA = {
  gambarAsal: 15 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const

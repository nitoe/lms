/** Jenis materi pembelajaran. */
export type JenisMateri =
  | 'pdf'
  | 'gambar'
  | 'video'
  | 'youtube'
  | 'tautan'
  | 'halaman'
  /** Konten HTML (paste kode atau unggah .html) — gambar eksternal (imgbb, Postimages, Drive, dll.) didukung. */
  | 'html'

/** Blok konten di dalam satu halaman materi (V1: teks + gambar). */
export type MateriBlok =
  | { id: string; tipe: 'teks'; html: string }
  | {
      id: string
      tipe: 'gambar'
      /** Kosong string = placeholder menunggu unggah / generate AI. */
      url: string
      storagePath?: string
      alt?: string
      caption?: string
      /**
       * Petunjuk untuk generate ilustrasi AI (hanya editor; tidak ditampilkan siswa).
       * Dihapus dari payload simpan bila url sudah terisi (opsional dipertahankan).
       */
      petunjukGambar?: string
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
  /** Kelas utama (tempat materi dibuat). */
  kelas: string
  /**
   * Semua kelas yang boleh membaca materi ini (selalu memuat `kelas`).
   * Dokumen lama tanpa field ini = hanya `[kelas]`.
   * Share hanya ke paralel se-tingkat yang diampu guru.
   */
  kelasList?: string[]
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
  /**
   * Konten HTML penuh (hanya jika `jenis === 'html'`).
   * Sudah dibersihkan (DOMPurify) di klien; gambar eksternal diizinkan lewat `<img src="https://…">`.
   * Batas praktis ~400 KB karakter (ANTIREGRESI).
   */
  kontenHtml?: string
  /** Scope modul Lomba (kelas bank LB). */
  lombaId?: string
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
  /**
   * Gambar blok halaman — dioptimasi untuk HP.
   * Setelah kompres target ~100–200 KB; batas unggah sumber 4 MB.
   */
  gambarHalaman: 4 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const

/** Batas praktis materi halaman (ANTIREGRESI). */
export const BATAS_HALAMAN_PER_MATERI = 20
export const BATAS_BLOK_PER_HALAMAN = 30

/** Batas karakter konten HTML (paste / file .html) — ~400 KB. */
export const BATAS_KONTEN_HTML = 400_000

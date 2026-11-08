/** Jenis soal yang didukung. */
export type JenisSoal =
  | 'pg' // Pilihan Ganda
  | 'pg_kompleks' // Pilihan Ganda Kompleks (multi-answer)
  | 'menjodohkan'
  | 'benar_salah'
  | 'isian'
  | 'uraian'

export const LABEL_JENIS_SOAL: Record<JenisSoal, string> = {
  pg: 'Pilihan Ganda',
  pg_kompleks: 'PG Kompleks',
  menjodohkan: 'Menjodohkan',
  benar_salah: 'Benar / Salah',
  isian: 'Isian',
  uraian: 'Uraian',
}

/** Satu opsi jawaban (untuk PG, PG Kompleks, Menjodohkan). */
export interface OpsiJawaban {
  id: string
  teks: string
  gambarUrl?: string
  /** Untuk PG / PG Kompleks. */
  benar?: boolean
}

/** Pasangan untuk soal Menjodohkan. */
export interface PasanganMenjodohkan {
  id: string
  kiri: string
  kanan: string
  gambarKiri?: string
  gambarKanan?: string
}

/** Dokumen soal di `lms_soal/{id}`. */
export interface SoalLms {
  id: string
  kuisId: string
  urutan: number
  jenis: JenisSoal
  pertanyaan: string
  /** URL gambar pada pertanyaan (opsional). */
  pertanyaanGambar?: string
  /** Path Storage jika diunggah. */
  pertanyaanGambarPath?: string
  opsi?: OpsiJawaban[]
  pasangan?: PasanganMenjodohkan[]
  /** Jawaban benar untuk isian (bisa beberapa varian). */
  jawabanIsian?: string[]
  /** Petunjuk / kunci untuk uraian (opsional, untuk guru). */
  kunciUraian?: string
  skor: number
  penjelasan?: string
  wajib?: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

/** Dokumen kuis di `lms_kuis/{id}`. */
export interface KuisLms {
  id: string
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  durasiMenit?: number
  acakSoal?: boolean
  acakOpsi?: boolean
  aktif: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  jumlahSoal?: number
  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_UKURAN_GAMBAR_SOAL = 5 * 1024 * 1024 // 5 MB
export const BATAS_UKURAN_VIDEO_SOAL = 20 * 1024 * 1024 // 20 MB

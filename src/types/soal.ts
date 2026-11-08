/** Tipe soal yang didukung editor bank soal. */
export type TipeSoal = 'pg' | 'pgk' | 'jodoh' | 'bs' | 'isian' | 'uraian'

export const NAMA_TIPE: Record<TipeSoal, string> = {
  pg: 'Pilihan ganda',
  pgk: 'Pilihan ganda kompleks',
  jodoh: 'Menjodohkan',
  bs: 'Benar / Salah',
  isian: 'Isian singkat',
  uraian: 'Uraian',
}

export const URUTAN_TIPE: TipeSoal[] = ['pg', 'pgk', 'jodoh', 'bs', 'isian', 'uraian']

/** Satu pilihan jawaban (PG / PG kompleks). `teks` = teks biasa (bukan HTML). */
export interface OpsiSoal {
  id: string
  teks: string
  /** ID dokumen `lms_gambar/{id}`. */
  gambarId?: string
}

interface SoalDasar {
  id: string
  /** HTML terbatas (lihat lib/html.ts) — hasil RichEditor. */
  teks: string
  gambarId?: string
  poin: number
  waktuMenit: number
  /** HTML terbatas. Tampil setelah siswa menjawab. */
  pembahasan?: string
}

export interface SoalPg extends SoalDasar {
  tipe: 'pg'
  opsi: OpsiSoal[]
  /** ID opsi yang benar. */
  kunci: string
  acakOpsi: boolean
  opsiGambar: boolean
}

export interface SoalPgk extends SoalDasar {
  tipe: 'pgk'
  opsi: OpsiSoal[]
  /** ID opsi yang benar (boleh lebih dari satu). */
  kunci: string[]
  acakOpsi: boolean
  opsiGambar: boolean
  /** true = skor sebagian; false = harus benar semua. */
  nilaiParsial: boolean
}

export interface PasanganJodoh {
  id: string
  kiri: string
  kiriGambarId?: string
  kanan: string
}

export interface SoalJodoh extends SoalDasar {
  tipe: 'jodoh'
  /** Baris ke-n kiri berpasangan dengan baris ke-n kanan (kunci). Sisi kanan diacak saat tampil. */
  pasangan: PasanganJodoh[]
  nilaiParsial: boolean
}

export interface PernyataanBs {
  id: string
  teks: string
  benar: boolean
}

export interface SoalBs extends SoalDasar {
  tipe: 'bs'
  pernyataan: PernyataanBs[]
  nilaiParsial: boolean
}

export interface SoalIsian extends SoalDasar {
  tipe: 'isian'
  /** Semua jawaban yang diterima. */
  kunci: string[]
  abaikanKapital: boolean
}

export interface SoalUraian extends SoalDasar {
  tipe: 'uraian'
  /** Pedoman penskoran untuk guru (HTML terbatas). Dinilai manual. */
  kunciJawaban?: string
}

export type Soal = SoalPg | SoalPgk | SoalJodoh | SoalBs | SoalIsian | SoalUraian

export type StatusPaket = 'draf' | 'siap'

/** Dokumen `lms_paket_soal/{id}`: satu paket soal/kuis berisi banyak soal. */
export interface PaketSoal {
  id: string
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  status: StatusPaket
  acakSoal: boolean
  soal: Soal[]
  /** Denormalisasi untuk daftar. */
  jumlahSoal: number
  totalPoin: number
  dibuatOleh: string
  dibuatOlehNama?: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** Jawaban siswa, bentuknya bergantung tipe soal. */
export type JawabanSoal =
  | string // pg, isian, uraian
  | string[] // pgk
  | Record<string, string> // jodoh: id pasangan kiri → id pasangan kanan yang dipilih
  | Record<string, boolean> // bs: id pernyataan → dipilih "Benar"?

export const BATAS_SOAL_PER_PAKET = 100
export const BATAS_OPSI = 8

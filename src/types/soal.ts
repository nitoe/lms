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

/** Tingkat kompleksitas kognitif sederhana (bukan taksonomi penuh). */
export type KompleksitasSoal = 'L1' | 'L2' | 'L3'

export const URUTAN_KOMPLEKSITAS: KompleksitasSoal[] = ['L1', 'L2', 'L3']

export const NAMA_KOMPLEKSITAS: Record<KompleksitasSoal, string> = {
  L1: 'L1 · Sederhana',
  L2: 'L2 · Menengah',
  L3: 'L3 · Kompleks',
}

export const DESKRIPSI_KOMPLEKSITAS: Record<KompleksitasSoal, string> = {
  L1: 'Mengingat / mengenali fakta atau prosedur dasar',
  L2: 'Memahami / menerapkan konsep pada situasi familiar',
  L3: 'Menganalisis / menalar / memecahkan masalah baru',
}

/** Normalisasi field lama yang belum punya kompleksitas. */
export function normalisasiKompleksitas(v: unknown): KompleksitasSoal {
  return v === 'L1' || v === 'L2' || v === 'L3' ? v : 'L1'
}

/**
 * Domain penilaian TKA (terutama TKA IPA).
 * Opsional — diisi manual atau nanti dari usulan AI paket.
 * Hanya dua nilai: putuskan kecenderungan dominan (bukan «campuran»).
 */
export type DomainTka = 'pengetahuan' | 'keterampilan_proses'

export const URUTAN_DOMAIN_TKA: DomainTka[] = ['pengetahuan', 'keterampilan_proses']

export const NAMA_DOMAIN_TKA: Record<DomainTka, string> = {
  pengetahuan: 'Pengetahuan IPA',
  keterampilan_proses: 'Keterampilan Proses Sains',
}

export const DESKRIPSI_DOMAIN_TKA: Record<DomainTka, string> = {
  pengetahuan: 'Lebih menuntut penguasaan fakta, konsep, atau istilah ilmiah',
  keterampilan_proses: 'Lebih menuntut proses sains: mengamati, mengklasifikasi, menyimpulkan, dll.',
}

/** Nilai lama «campuran» diabaikan → undefined (harus dipilih ulang). */
export function normalisasiDomainTka(v: unknown): DomainTka | undefined {
  return v === 'pengetahuan' || v === 'keterampilan_proses' ? v : undefined
}

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
  /** Tingkat kompleksitas L1–L3. Default L1 bila kosong (dokumen lama). */
  kompleksitas: KompleksitasSoal
  /** HTML terbatas. Tampil setelah siswa menjawab. */
  pembahasan?: string
  /**
   * Stimulus / teks bacaan bersama soal (HTML; boleh tabel). Dipakai soal TKA.
   * Dibersihkan dengan bersihHtmlStimulus (lib/html.ts), bukan bersihHtml.
   */
  stimulus?: string
  /** Kategori materi (mis. Bilangan, Pemahaman Tekstual). Dipakai analisis TKA. */
  tipeMateri?: string
  /** true = tampilkan rumus `$...$` / `$$...$$` dengan KaTeX (soal TKA hasil migrasi). */
  rumus?: boolean
  /**
   * Domain penilaian TKA (opsional). Utamanya TKA IPA:
   * pengetahuan | keterampilan_proses (pilih yang lebih dominan).
   */
  domainTka?: DomainTka
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
  /** Label kolom kustom (soal TKA, mis. «Fakta» / «Opini»). Kosong = «Benar» / «Salah». */
  labelBenar?: string
  labelSalah?: string
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
  /**
   * Kategori materi TKA pada level paket (ANTIREGRESI §86).
   * Semua soal dalam paket mewarisi nilai ini. Hanya dipakai mapel TKA.
   */
  tipeMateri?: string
  status: StatusPaket
  acakSoal: boolean
  soal: Soal[]
  /** Denormalisasi untuk daftar & filter bank. */
  jumlahSoal: number
  totalPoin: number
  /** Jumlah soal per tipe (bentuk). Diisi saat simpan. */
  jumlahPerTipe?: Partial<Record<TipeSoal, number>>
  /** Jumlah soal per kompleksitas L1–L3. Diisi saat simpan. */
  jumlahPerKompleksitas?: Partial<Record<KompleksitasSoal, number>>
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

export const BATAS_SOAL_PER_PAKET = 300
export const BATAS_OPSI = 8

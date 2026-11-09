/**
 * Model data modul TKA (Tes Kemampuan Akademik) — kelas 6.
 * Dimigrasi dari repo nitoe/tka2026 (project Firebase tka2026-sdm01) ke project LMS.
 *
 * Koleksi (semua berawalan `tka_`, lihat docs/TKA.md dan ANTIREGRESI §76):
 *   tka_soal        bank soal BERISI KUNCI  → hanya staf TKA yang boleh membaca
 *   tka_paket       paket latihan / try out → siswa kelas 6 membaca paket aktif (TANPA token)
 *   tka_token       token try out per paket → hanya staf TKA (dicek Cloud Function)
 *   tka_percobaan   hasil pengerjaan        → ditulis Cloud Function; siswa baca miliknya
 *   tka_sesi_live   pemantauan langsung     → siswa tulis miliknya; staf baca
 */

export type MapelTka = 'matematika' | 'bahasa-indonesia'
export const DAFTAR_MAPEL_TKA: readonly MapelTka[] = ['matematika', 'bahasa-indonesia']

export const NAMA_MAPEL_TKA: Record<MapelTka, string> = {
  matematika: 'Matematika',
  'bahasa-indonesia': 'Bahasa Indonesia',
}

/** pg = pilihan ganda, pgk = pilihan ganda kompleks, pgk-cat = tabel pernyataan (kolom kategori). */
export type TipeSoalTka = 'pg' | 'pgk' | 'pgk-cat'

export const KOMPLEKSITAS_TKA = ['L1-Pemahaman', 'L2-Aplikasi', 'L3-Penalaran'] as const
export type KompleksitasTka = (typeof KOMPLEKSITAS_TKA)[number]

export type JenisPaketTka = 'latihan' | 'tryout'

/** Dokumen tka_soal/{id}. ID dipertahankan dari questionPool lama. */
export interface SoalTka {
  id: string
  subjectId: MapelTka
  tipe: TipeSoalTka
  pertanyaan: string
  /** Teks stimulus/bacaan (HTML aman, rumus $...$ / $$...$$). Disimpan juga di `bacaan` (kompatibilitas lama). */
  stimulus?: string
  bacaan?: string
  /** Gambar stimulus (data URL / URL). */
  stimulusImage?: string | null
  /** MTK: materi bebas (mis. Bilangan). BI: Pemahaman Tekstual | Inferensial | Evaluasi dan Apresiasi. */
  tipeMateri?: string
  kompleksitas?: string
  skor: number
  opsi?: string[]
  /** pgk-cat: baris pernyataan dan kolom kategori. */
  rows?: string[]
  cols?: string[]
  /** pg: [satu teks opsi]; pgk: beberapa teks opsi; pgk-cat: satu kolom per baris. */
  kunciJawaban?: string[]
  sumber?: string
  createdBy?: string | null
}

/** Dokumen tka_paket/{id}. `token` TIDAK disimpan di sini (lihat tka_token). */
export interface PaketTka {
  id: string
  nama: string
  jenis: JenisPaketTka
  subjectId: MapelTka
  questionIds: string[]
  durasiMenit?: number
  /** true bila try out ini memakai token (nilai token ada di tka_token/{id}). */
  butuhToken: boolean
  bukaPada?: unknown
  tutupPada?: unknown
  maksPercobaan?: number | null
  acakSoal?: boolean
  acakOpsi?: boolean
  tampilkanHasil?: boolean
  aktif: boolean
}

export interface RingkasanSkorTka {
  benar: number
  total: number
  poinBenar: number
  poinMaks: number
  noSoal: number[]
}

/** Dokumen tka_percobaan/{id}. Ditulis Cloud Function (Admin SDK) atau skrip migrasi. */
export interface PercobaanTka {
  id: string
  siswaId: string
  namaSiswa: string
  kelas: string
  paketId: string
  paketNama: string
  subjectId: MapelTka
  jenisPaket: JenisPaketTka
  jawaban: Record<string, unknown>
  skorAkhir: number
  skorMaksimal: number
  skorPerTipeMateri: Record<string, RingkasanSkorTka>
  skorPerKompleksitas: Record<string, RingkasanSkorTka>
  durasiDetik?: number
  status: 'selesai' | 'waktu_habis' | string
  /** 'migrasi-tka2026' untuk data lama. */
  sumber?: string
}

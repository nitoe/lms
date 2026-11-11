/**
 * Model kuis LMS — disusun dari paket bank soal (`lms_paket_soal`) yang berstatus `siap`.
 * Snapshot soal disimpan di dokumen kuis agar stabil (perubahan bank tidak merusak kuis aktif).
 * Model lama `lms_soal` terpisah dihentikan (draf diganti total).
 */
import type { KompleksitasSoal, Soal, TipeSoal } from './soal'

export type ModeSusunKuis = 'manual' | 'otomatis' | 'otomatis_ai'

export type JenisPenilaianKuis = 'latihan' | 'slm' | 'sts' | 'sas'

/** Online = siswa kerjakan di LMS; offline = guru input jawaban. */
export type ModePelaksanaanKuis = 'online' | 'offline'

export const NAMA_MODE_PELAKSANAAN: Record<ModePelaksanaanKuis, string> = {
  online: 'Online (siswa mengerjakan di LMS)',
  offline: 'Offline (guru input jawaban)',
}

/** Label untuk UI guru (form atur kuis / detail). Menjelaskan dampak ke nilai. */
export const NAMA_JENIS_PENILAIAN: Record<JenisPenilaianKuis, string> = {
  latihan: 'Latihan (tidak masuk nilai)',
  slm: 'SLM (masuk nilai SLM TP)',
  sts: 'STS (masuk nilai STS)',
  sas: 'SAS (masuk nilai SAS)',
}

/** Label ringkas untuk UI siswa — tanpa frasa «tidak masuk nilai» agar tidak menurunkan keseriusan. */
export const NAMA_JENIS_PENILAIAN_SISWA: Record<JenisPenilaianKuis, string> = {
  latihan: 'Latihan',
  slm: 'SLM',
  sts: 'STS',
  sas: 'SAS',
}

/** Filter yang dipakai saat mode otomatis / otomatis_ai. */
export interface FilterSusunKuis {
  jumlahSoal?: number
  tipe?: TipeSoal[]
  jumlahPerTipe?: Partial<Record<TipeSoal, number>>
  kompleksitas?: KompleksitasSoal[]
  jumlahPerKompleksitas?: Partial<Record<KompleksitasSoal, number>>
}

export type SoalKuis = Soal & {
  sumberPaketId: string
  sumberSoalId: string
  sumberPaketJudul?: string
}

/** Dokumen `lms_kuis/{id}`. */
export interface KuisLms {
  id: string
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  sumberPaketIds: string[]
  modeSusun: ModeSusunKuis
  filterSusun?: FilterSusunKuis
  soal: SoalKuis[]
  durasiMenit?: number
  acakSoal?: boolean
  acakOpsi?: boolean
  aktif: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  jumlahSoal: number
  totalPoin: number

  /** Waktu kuis boleh dikerjakan (ISO string atau Timestamp). */
  waktuMulai?: string
  waktuSelesai?: string
  /** Token opsional untuk akses online. */
  token?: string
  /** Default online. Offline → input jawaban oleh guru. */
  modePelaksanaan?: ModePelaksanaanKuis
  /** Tujuan penilaian. Default latihan. */
  jenisPenilaian?: JenisPenilaianKuis
  /** TP yang diukur. Untuk SLM biasanya 1, untuk STS/SAS bisa banyak. */
  tpIds?: string[]
  /** Denormalisasi nama TP untuk tampilan. */
  tpNamaList?: string[]
  /** Nilai akhir per TP (manual atau dari analisis). */
  nilaiPerTp?: Record<string, number>
  /** Sumber nilai: analisis atau manual. */
  sumberNilai?: 'analisis' | 'manual'

  /**
   * TKA saja: apakah skor sudah boleh ditampilkan ke siswa.
   * Default false/undefined = siswa hanya melihat «jawaban terkirim», tanpa angka.
   * Mapel non-TKA mengabaikan field ini (skor tetap langsung tampil).
   */
  hasilDipublish?: boolean

  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_SOAL_PER_KUIS = 100
export const BATAS_PAKET_SUMBER = 12

export type KuisRingkas = Omit<KuisLms, 'soal' | 'filterSusun'> & {
  soal?: SoalKuis[]
}

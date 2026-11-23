/**
 * Model kuis LMS — disusun dari paket bank soal (`lms_paket_soal`) yang berstatus `siap`.
 * Snapshot soal disimpan di dokumen kuis agar stabil (perubahan bank tidak merusak kuis aktif).
 * Model lama `lms_soal` terpisah dihentikan (draf diganti total).
 */
import type { KompleksitasSoal, Soal, TipeSoal } from './soal'

export type ModeSusunKuis = 'manual' | 'otomatis' | 'otomatis_ai'

export type JenisPenilaianKuis = 'latihan' | 'slm' | 'sts' | 'sas'

/**
 * Tahap Try Out TKA (kelas 6). Dipakai untuk Rekap Nilai TKA per mapel
 * (Bahasa Indonesia, Matematika, IPA). Hanya relevan jika mapel adalah mapel TKA.
 */
export type TahapTryOutTka = 'I' | 'II' | 'III' | 'IV' | 'V'

export const DAFTAR_TAHAP_TRYOUT_TKA: readonly TahapTryOutTka[] = ['I', 'II', 'III', 'IV', 'V']

export const NAMA_TAHAP_TRYOUT_TKA: Record<TahapTryOutTka, string> = {
  I: 'Try Out I',
  II: 'Try Out II',
  III: 'Try Out III',
  IV: 'Try Out IV',
  V: 'Try Out V',
}

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

/**
 * Status kuis (selaras tugas — ANTIREGRESI §Kuis.Status):
 * - draf: masih disusun; siswa tidak melihat
 * - aktif_guru: siap dipakai guru (input hasil offline, sinkron nilai); siswa TIDAK melihat
 * - aktif_siswa: tampil & bisa dikerjakan siswa (sesuai jadwal/token)
 * Boolean `aktif` diselaraskan: true hanya jika status === 'aktif_siswa' (rules & query siswa memakai `aktif`).
 */
export type StatusKuis = 'draf' | 'aktif_guru' | 'aktif_siswa'

export const LABEL_STATUS_KUIS: Record<StatusKuis, string> = {
  draf: 'Draf',
  aktif_guru: 'Aktif guru',
  aktif_siswa: 'Aktif siswa',
}

export const KETERANGAN_STATUS_KUIS: Record<StatusKuis, string> = {
  draf: 'Masih disusun — siswa tidak melihat',
  aktif_guru: 'Siap dipakai guru (input hasil offline, sinkron nilai) — siswa tidak melihat',
  aktif_siswa: 'Tampil ke siswa dan bisa dikerjakan',
}

export function statusKuisValid(v: unknown): StatusKuis | undefined {
  return v === 'draf' || v === 'aktif_guru' || v === 'aktif_siswa' ? v : undefined
}

/**
 * Normalisasi dari dokumen. Dokumen lama hanya punya `aktif`:
 * aktif → aktif_siswa; tidak aktif + kuis offline → aktif_guru (kuis offline memang tidak untuk siswa,
 * jangan jadi «draf» agar input hasil offline lama tidak terblokir); selain itu draf.
 */
export function normalisasiStatusKuis(
  status: unknown,
  aktifLegacy?: unknown,
  modePelaksanaan?: unknown,
): StatusKuis {
  const s = statusKuisValid(status)
  if (s) return s
  if (aktifLegacy === true) return 'aktif_siswa'
  return modePelaksanaan === 'offline' ? 'aktif_guru' : 'draf'
}

export function aktifSiswaDariStatusKuis(s: StatusKuis): boolean {
  return s === 'aktif_siswa'
}

/** Guru boleh memasukkan hasil offline / menyinkronkan nilai. */
export function bolehInputHasilKuis(s: StatusKuis): boolean {
  return s === 'aktif_guru' || s === 'aktif_siswa'
}

export type SoalKuis = Soal & {
  sumberPaketId: string
  sumberSoalId: string
  sumberPaketJudul?: string
  /** Mapel paket asal soal (diisi sejak kuis gabungan Lomba; kuis lama tidak punya). */
  sumberMapel?: string
}

/** Dokumen `lms_kuis/{id}`. */
export interface KuisLms {
  id: string
  /** Kelas utama (tempat kuis dibuat). */
  kelas: string
  /**
   * Semua kelas yang boleh melihat kuis aktif ini (selalu memuat `kelas`).
   * Dokumen lama tanpa field = `[kelas]`. Share hanya ke paralel se-tingkat yang diampu.
   */
  kelasList?: string[]
  mapel: string
  /** Kuis modul Lomba: id lomba (kelas bank «LB»). mapel = «Gabungan» bila soal lintas mapel. */
  lombaId?: string
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
  /** Status kanonis: draf | aktif_guru | aktif_siswa. Dokumen lama = diturunkan dari `aktif`. */
  statusKuis?: StatusKuis
  /** Diarsipkan: disembunyikan dari daftar utama dan dari siswa. Nilai tetap dihitung. */
  arsip?: boolean
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

  /**
   * TKA saja: tahap Try Out (I–V). Dipakai Rekap Nilai TKA per mapel.
   * Kosong = belum digolongkan ke tahap manapun.
   */
  tahapTryOutTka?: TahapTryOutTka

  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_SOAL_PER_KUIS = 100
export const BATAS_PAKET_SUMBER = 12

export type KuisRingkas = Omit<KuisLms, 'soal' | 'filterSusun'> & {
  soal?: SoalKuis[]
}

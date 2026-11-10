/**
 * Model Rekap Nilai — pusat agregasi SLM/STS/SAS per TP per mapel×kelas
 * untuk sinkronisasi ke aplikasi Penilaian (SDM01Penilaian).
 *
 * Tahap 1: fondasi tipe + shell UI. Agregasi sumber & bobot live menyusul.
 */

/** Jenis penilaian dalam satu TP (sub-tab). */
export type JenisNilaiTp = 'slm' | 'sts' | 'sas'

export const NAMA_JENIS_NILAI_TP: Record<JenisNilaiTp, string> = {
  slm: 'SLM',
  sts: 'STS',
  sas: 'SAS',
}

/**
 * Satu sumber nilai yang masuk ke SLM suatu TP.
 * Bisa dari tugas (lms_nilai_tugas) atau kuis (lms_jawaban / nilai offline)
 * yang jenisPenilaian = 'slm' dan terhubung ke tpId.
 */
export type SumberNilaiSlm = {
  /** Kunci stabil: `tugas:{tugasId}` atau `kuis:{kuisId}` */
  id: string
  jenis: 'tugas' | 'kuis'
  /** ID dokumen sumber (tugasId / kuisId) */
  sumberId: string
  judul: string
  /** Bobot dalam persen (0–100). Jumlah semua sumber idealnya 100. */
  bobot: number
}

/**
 * Pengaturan bobot SLM untuk satu pasangan mapel × kelas × TP.
 * Disimpan di `lms_bobot_slm/{kelas}__{mapelSlug}__{tpId}`.
 */
export type BobotSlmDok = {
  id: string
  kelas: string
  mapel: string
  tpId: string
  tpNomor?: number
  tpNama?: string
  /** Daftar sumber + bobot persen. Urutan tampil = urutan array. */
  sumber: SumberNilaiSlm[]
  /** uid guru yang terakhir menyimpan */
  diubahOleh?: string
  updatedAt?: unknown
  createdAt?: unknown
}

/**
 * Nilai akhir per siswa untuk satu jenis (SLM/STS/SAS) pada satu TP.
 * Belum ditulis ke koleksi terpisah di Tahap 1; dihitung di klien.
 * Nanti bisa di-cache ke `lms_nilai_tp_akhir` bila sinkron ke Penilaian.
 */
export type NilaiSiswaTp = {
  siswaId: string
  siswaNama: string
  /** Nilai per sumber (kunci = SumberNilaiSlm.id) — hanya untuk SLM */
  perSumber?: Record<string, number | null>
  /** Nilai akhir berbobot (0–100) atau null jika belum ada data */
  nilaiAkhir: number | null
  predikat?: string
}

/** Ringkasan rekap satu mapel×kelas untuk daftar di dashboard. */
export type RingkasRekapMapel = {
  kelas: string
  mapel: string
  jumlahTp: number
}

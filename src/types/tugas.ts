/** Dokumen tugas di `lms_tugas/{id}`. */

/** Jenis tugas: terikat satu mapel, atau proyek lintas mapel. */
export type JenisTugas = 'mapel' | 'proyek'

/** Tujuan penilaian tugas — selaras kuis, untuk rekap nilai TP. */
export type JenisPenilaianTugas = 'latihan' | 'slm' | 'sts' | 'sas'

export const NAMA_JENIS_PENILAIAN_TUGAS: Record<JenisPenilaianTugas, string> = {
  latihan: 'Latihan (tidak masuk nilai)',
  slm: 'SLM (masuk nilai SLM TP)',
  sts: 'STS (masuk nilai STS)',
  sas: 'SAS (masuk nilai SAS)',
}

/** Label ringkas untuk UI siswa — tanpa frasa «tidak masuk nilai». */
export const NAMA_JENIS_PENILAIAN_TUGAS_SISWA: Record<JenisPenilaianTugas, string> = {
  latihan: 'Latihan',
  slm: 'SLM',
  sts: 'STS',
  sas: 'SAS',
}

/** Satu Tujuan Pembelajaran yang dilampirkan ke tugas (bisa banyak). */
export interface TpTugas {
  id: string
  nomor: number
  nama: string
  /** Mapel asal TP (penting untuk proyek lintas mapel). */
  mapel?: string
}

/** Satu baris rentang nilai → predikat (skala 0–100, default KKM/KKTP 70). */
export interface RentangPredikat {
  /** Kode predikat, mis. C-, B+, A */
  predikat: string
  min: number
  max: number
  /** Keterangan kategori, mis. "Hampir Cukup (Batas KKM/KKTP)" */
  keterangan?: string
}

/** Kategori/aspek rubrik asesmen kinerja. */
export interface KategoriPenilaian {
  id: string
  /** Nama aspek, mis. "Tebal-tipis garis" */
  nama: string
  deskripsi?: string
  /**
   * Bobot relatif dalam rubrik (opsional).
   * Jika semua kosong/0, dihitung rata-rata.
   */
  bobot?: number
}

/**
 * Pengaturan penilaian tugas (tab Input Nilai → Pengaturan penilaian).
 * Skala selalu 0–100. Sinkron ke Penilaian dilakukan lewat tombol di Daftar nilai, bukan di sini.
 */
export interface PengaturanPenilaianTugas {
  /** Aspek rubrik (asesmen kinerja) — menjadi kolom di daftar nilai. */
  kategori: KategoriPenilaian[]
  /** Tabel konversi nilai → predikat (boleh diedit guru kecuali terkunci). */
  rentangPredikat: RentangPredikat[]
  /** Jika true, tabel rentang tidak bisa diubah (terkunci guru). */
  rentangTerkunci?: boolean
  catatan?: string
}

/** Dokumen `lms_tugas/{id}`. */
export interface TugasLms {
  id: string
  /** Rombel utama, mis. `5A`. Untuk proyek bisa satu kelas utama. */
  kelas: string
  /**
   * Semua kelas yang boleh melihat tugas aktif ini (selalu memuat `kelas`).
   * Dokumen lama tanpa field = `[kelas]`. Share hanya ke paralel se-tingkat yang diampu.
   */
  kelasList?: string[]
  /**
   * Mapel utama (selalu ada).
   * Untuk jenis `mapel`: satu mapel.
   * Untuk jenis `proyek`: mapel utama / penanggung jawab; mapel lain di `mapelLain`.
   */
  mapel: string
  /** Mapel tambahan (hanya untuk jenis `proyek`). */
  mapelLain?: string[]
  judul: string
  deskripsi?: string
  /** Instruksi lengkap (bisa HTML dari rich editor di tab Isi Tugas). */
  instruksi?: string
  jenis: JenisTugas
  /** Tujuan penilaian (SLM/STS/SAS/latihan). Default legacy = slm. */
  jenisPenilaian?: JenisPenilaianTugas
  /** Daftar TP yang dilampirkan (boleh lebih dari satu). */
  tpList?: TpTugas[]
  /** Field lama (kompatibilitas baca); prefer `tpList`. */
  tpId?: string
  tpNomor?: number
  tpNama?: string
  /** ISO string atau Firestore Timestamp. */
  tenggat?: unknown
  aktif: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  jumlahPengumpulan?: number
  pengaturanPenilaian?: PengaturanPenilaianTugas
  createdAt?: unknown
  updatedAt?: unknown
}

/** Input pembuatan / pembaruan tugas (tanpa id & meta). */
export type TugasInput = {
  kelas: string
  mapel: string
  mapelLain?: string[]
  judul: string
  deskripsi?: string
  instruksi?: string
  jenis: JenisTugas
  jenisPenilaian?: JenisPenilaianTugas
  tpList?: TpTugas[]
  tenggat?: Date | null
  aktif?: boolean
  pengaturanPenilaian?: PengaturanPenilaianTugas
  namaGuru?: string
}

export const BATAS_UKURAN_FILE_TUGAS = 10 * 1024 * 1024 // 10 MB

export function labelJenisTugas(j: JenisTugas): string {
  return j === 'proyek' ? 'Proyek' : 'Mapel'
}

/** Semua mapel yang terlibat (utama + lain). */
export function semuaMapelTugas(t: Pick<TugasLms, 'mapel' | 'mapelLain'>): string[] {
  const lain = Array.isArray(t.mapelLain) ? t.mapelLain.filter(Boolean) : []
  return [t.mapel, ...lain].filter((m, i, arr) => m && arr.indexOf(m) === i)
}

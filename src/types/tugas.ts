/** Dokumen tugas di `lms_tugas/{id}`. */

/** Jenis tugas: terikat satu mapel, atau proyek lintas mapel. */
export type JenisTugas = 'mapel' | 'proyek'

/**
 * Status publikasi & kesiapan penilaian tugas.
 * - draf: masih disusun; guru belum boleh input nilai; siswa tidak melihat
 * - aktif_guru: siap dinilai guru (bisa sinkron ke Penilaian); siswa tidak melihat/mengumpulkan
 * - aktif_siswa: tampil ke siswa + pengumpulan LMS; guru boleh input nilai
 *
 * Field boolean `aktif` diselaraskan: true hanya jika status === 'aktif_siswa'
 * (kompatibel rules & query siswa lama).
 */
export type StatusTugas = 'draf' | 'aktif_guru' | 'aktif_siswa'

export const LABEL_STATUS_TUGAS: Record<StatusTugas, string> = {
  draf: 'Draf',
  aktif_guru: 'Aktif guru',
  aktif_siswa: 'Aktif siswa',
}

export const KETERANGAN_STATUS_TUGAS: Record<StatusTugas, string> = {
  draf: 'Masih disusun — belum bisa diisi nilai, siswa tidak melihat',
  aktif_guru: 'Siap dinilai guru tanpa pengumpulan LMS (mis. tugas offline) — siswa tidak melihat',
  aktif_siswa: 'Tampil ke siswa; ada pengumpulan/bukti di LMS',
}

export function statusTugasValid(v: unknown): StatusTugas | undefined {
  return v === 'draf' || v === 'aktif_guru' || v === 'aktif_siswa' ? v : undefined
}

/** Normalisasi dari dokumen (termasuk legacy hanya field aktif). */
export function normalisasiStatusTugas(
  status: unknown,
  aktifLegacy?: unknown,
): StatusTugas {
  const s = statusTugasValid(status)
  if (s) return s
  return aktifLegacy === true ? 'aktif_siswa' : 'draf'
}

export function aktifSiswaDariStatus(s: StatusTugas): boolean {
  return s === 'aktif_siswa'
}

/** Guru boleh mengisi nilai di daftar nilai. */
export function bolehInputNilaiTugas(s: StatusTugas): boolean {
  return s === 'aktif_guru' || s === 'aktif_siswa'
}


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
export type TahapTugas = 'persiapan' | 'pelaksanaan' | 'hasil'
export type SumberKategori = 'bukti' | 'observasi'
export const DAFTAR_TAHAP: TahapTugas[] = ['persiapan', 'pelaksanaan', 'hasil']
export const LABEL_TAHAP: Record<TahapTugas, string> = {
  persiapan: 'Persiapan',
  pelaksanaan: 'Pelaksanaan (proses)',
  hasil: 'Hasil akhir',
}
export function tahapValid(t: unknown): TahapTugas | undefined {
  return t === 'persiapan' || t === 'pelaksanaan' || t === 'hasil' ? t : undefined
}

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
  /**
   * Mapel pemilik aspek ini (untuk tugas proyek lintas mapel, mis. «IPAS» atau
   * «Bahasa Indonesia»). Kosong = berlaku umum / mapel utama.
   */
  mapel?: string
  /** Tahap kegiatan yang dinilai: persiapan, pelaksanaan (proses), atau hasil akhir. */
  tahap?: TahapTugas
  /**
   * Dari mana nilai aspek ini diperoleh: `bukti` (foto/hasil tulisan siswa; default) atau
   * `observasi` (pengamatan/tanya jawab guru — tidak butuh upload).
   */
  sumber?: SumberKategori
}

/**
 * Satu «bukti pengumpulan» yang diminta guru: satu foto berlabel (mis. «Data sebelum aktivitas»).
 * Tiap bukti memegang satu slot foto (`slot` 1..3 = akhiran ID `lms_pengumpulan_foto`,
 * ANTIREGRESI §132 & §Tugas.Bukti). Slot TIDAK berubah walau bukti diurutkan ulang atau bukti lain dihapus.
 */
export type JenisBukti = 'foto' | 'video'
/** Maksimal bukti berjenis video per tugas (kuota Storage & waktu guru menonton). */
export const BATAS_BUKTI_VIDEO = 2

export interface BuktiTugas {
  /** ID stabil (tidak berubah walau label/urutan diedit). */
  id: string
  /** Slot foto 1..6 yang dipakai bukti ini (unik per tugas). */
  slot: number
  /** Nama bukti yang tampil ke siswa, mis. «Foto catatan hasil sebelum aktivitas». */
  label: string
  /** Petunjuk singkat: apa yang harus terlihat di foto. */
  petunjuk?: string
  /**
   * `foto` (default) atau `video` (≤ 1 menit, dikecilkan di HP siswa, disimpan di Storage).
   * Bukti video memakai slot yang sama dengan bukti foto (total bukti tetap ≤ 6) tetapi TIDAK
   * membuat dokumen `lms_pengumpulan_foto` (ANTIREGRESI §Tugas.Video).
   */
  jenis?: JenisBukti
  /** Tahap kegiatan bukti ini (untuk pengelompokan tampilan siswa). */
  tahap?: TahapTugas
  /** Wajib dikumpulkan? Bukti opsional boleh dikosongkan siswa. */
  wajib: boolean
  /** ID kategori rubrik (`KategoriPenilaian.id`) yang dinilai dari bukti ini. */
  kategoriIds?: string[]
}

/** Jumlah bukti/foto maksimum per tugas — dibatasi aturan Firestore (slot foto '1'..'6'). */
export const BATAS_BUKTI_TUGAS = 6

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
  /**
   * true = tampil ke siswa (statusTugas === 'aktif_siswa'). Diselaraskan otomatis.
   */
  aktif: boolean
  /** Status kanonis: draf | aktif_guru | aktif_siswa. */
  statusTugas?: StatusTugas
  /**
   * Alur penilaian guru selesai (nilai sudah diisi / tugas dianggap tuntas).
   * Berbeda dari status publikasi. Default/legacy = belum selesai.
   */
  selesai?: boolean
  /**
   * true = penugasan otomatis ditutup untuk siswa saat tenggat terlewati (diturunkan saat dibaca,
   * tidak menulis `selesai`). Dokumen lama tanpa field ini = false (perilaku lama tidak berubah).
   */
  tutupSetelahTenggat?: boolean
  /**
   * Diarsipkan: disembunyikan dari daftar default dashboard.
   * Biasanya digabung dengan aktif=false agar siswa tidak melihat.
   */
  arsip?: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  jumlahPengumpulan?: number
  pengaturanPenilaian?: PengaturanPenilaianTugas
  /**
   * Bukti pengumpulan berlabel (1–6). Kosong/tidak ada = mode lama: siswa mengunggah 1–3 foto
   * tanpa label. Dokumen lama tanpa field ini tetap bekerja.
   */
  buktiList?: BuktiTugas[]
  /**
   * Berkas dilampirkan guru (template, worksheet, media) — siswa unduh dari detail tugas.
   * Disimpan di Storage `lms/tugas/{tugasId}/…`; meta di dokumen tugas.
   */
  lampiranList?: LampiranTugas[]
  /**
   * true = tugas kelompok. Siswa membentuk kelompok + pilih ketua; hanya ketua yang mengumpulkan
   * (mewakili anggota). Fondasi — UI lengkap menyusul (ANTIREGRESI §Tugas.Kelompok).
   */
  modeKelompok?: boolean
  /** Maks. anggota per kelompok (termasuk ketua). Default 4. */
  kelompokMaxAnggota?: number
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
  statusTugas?: StatusTugas
  selesai?: boolean
  tutupSetelahTenggat?: boolean
  arsip?: boolean
  pengaturanPenilaian?: PengaturanPenilaianTugas
  buktiList?: BuktiTugas[]
  lampiranList?: LampiranTugas[]
  modeKelompok?: boolean
  kelompokMaxAnggota?: number
  namaGuru?: string
}


/** File yang dilampirkan guru pada tugas (template, worksheet, media). */
export type JenisLampiranTugas =
  | 'dokumen'
  | 'spreadsheet'
  | 'presentasi'
  | 'gambar'
  | 'audio'
  | 'video'
  | 'lain'

export interface LampiranTugas {
  id: string
  /** Nama tampil, mis. «Lembar kerja.xlsx». */
  nama: string
  jenis: JenisLampiranTugas
  /** Download URL bertoken (siswa buka tanpa Storage rules). */
  url: string
  storagePath: string
  contentType: string
  ukuran: number
  /** Keterangan singkat opsional. */
  keterangan?: string
}

/** Maks. ukuran per berkas lampiran guru (50 MB — video pendek / presentasi). */
export const BATAS_UKURAN_LAMPIRAN_TUGAS = 50 * 1024 * 1024
/** Maks. jumlah lampiran per tugas. */
export const BATAS_JUMLAH_LAMPIRAN_TUGAS = 8

export const BATAS_UKURAN_FILE_TUGAS = 10 * 1024 * 1024 // 10 MB (legacy; prefer BATAS_UKURAN_LAMPIRAN_TUGAS)

export function labelJenisTugas(j: JenisTugas): string {
  return j === 'proyek' ? 'Proyek' : 'Mapel'
}

/** Semua mapel yang terlibat (utama + lain). */
export function semuaMapelTugas(t: Pick<TugasLms, 'mapel' | 'mapelLain'>): string[] {
  const lain = Array.isArray(t.mapelLain) ? t.mapelLain.filter(Boolean) : []
  return [t.mapel, ...lain].filter((m, i, arr) => m && arr.indexOf(m) === i)
}

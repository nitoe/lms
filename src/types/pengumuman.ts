/** Pengumuman per ruang kelas (kelas × mapel). */

export type PengumumanLms = {
  id: string
  kelas: string
  mapel: string
  judul: string
  /** HTML kaya (disanitasi lewat bersihHtmlMateri). */
  kontenHtml: string
  /** Pin di atas daftar. */
  pin?: boolean
  /** true = tampil untuk siswa; false = draf guru. */
  aktif: boolean
  dibuatOleh: string
  dibuatOlehNama?: string
  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_JUDUL_PENGUMUMAN = 160
export const BATAS_KONTEN_PENGUMUMAN = 50_000

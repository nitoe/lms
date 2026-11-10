import { auth } from './firebase'
import type { KategoriPenilaian, PengaturanPenilaianTugas, RentangPredikat } from '../types/tugas'

/** Sama dengan generate soal AI — mirror functions. */
export const UID_AI_TUGAS = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
export const EMAIL_AI_TUGAS = 'arif.azwar79@gmail.com'

/**
 * Fitur AI tugas (generate kategori rubrik & nilai dari predikat).
 * Dicek terhadap sesi Auth aktif, bukan hanya profil Firestore.
 */
export function bolehAiTugas(uid: string | undefined | null): boolean {
  if (!uid || uid !== UID_AI_TUGAS) return false
  const sesi = auth.currentUser
  if (!sesi || sesi.uid !== UID_AI_TUGAS) return false
  return (sesi.email ?? '').trim().toLowerCase() === EMAIL_AI_TUGAS
}

/**
 * Default rentang predikat — KKM/KKTP 70 (Tabel Rentang Nilai).
 * Batas bawah predikat C- = 70.
 */
export const RENTANG_PREDIKAT_DEFAULT: RentangPredikat[] = [
  { predikat: 'E', min: 0, max: 49, keterangan: 'Sangat Kurang (Perlu Intervensi Khusus)' },
  { predikat: 'D', min: 50, max: 59, keterangan: 'Kurang' },
  { predikat: 'D+', min: 60, max: 69, keterangan: 'Kurang' },
  { predikat: 'C-', min: 70, max: 73, keterangan: 'Hampir Cukup (Batas KKM/KKTP)' },
  { predikat: 'C', min: 74, max: 77, keterangan: 'Cukup' },
  { predikat: 'C+', min: 78, max: 81, keterangan: 'Cukup' },
  { predikat: 'B-', min: 82, max: 85, keterangan: 'Cukup Baik' },
  { predikat: 'B', min: 86, max: 89, keterangan: 'Baik' },
  { predikat: 'B+', min: 90, max: 93, keterangan: 'Sangat Baik' },
  { predikat: 'A-', min: 94, max: 96, keterangan: 'Istimewa' },
  { predikat: 'A', min: 97, max: 100, keterangan: 'Sangat Istimewa (Sempurna)' },
]

export function pengaturanPenilaianDefault(): PengaturanPenilaianTugas {
  return {
    kategori: [],
    rentangPredikat: RENTANG_PREDIKAT_DEFAULT.map((r) => ({ ...r })),
  }
}

/** Normalisasi pengaturan dari dokumen (kompatibel field lama skalaMaks/bobot). */
export function normalisasiPengaturan(
  raw: PengaturanPenilaianTugas | Record<string, unknown> | null | undefined,
): PengaturanPenilaianTugas {
  const base = pengaturanPenilaianDefault()
  if (!raw || typeof raw !== 'object') return base

  const r = raw as Partial<PengaturanPenilaianTugas> & Record<string, unknown>
  let rentang = base.rentangPredikat
  if (Array.isArray(r.rentangPredikat) && r.rentangPredikat.length > 0) {
    rentang = r.rentangPredikat
      .filter((x) => x && typeof x.predikat === 'string')
      .map((x) => ({
        predikat: String(x.predikat),
        min: typeof x.min === 'number' ? x.min : 0,
        max: typeof x.max === 'number' ? x.max : 100,
        keterangan: typeof x.keterangan === 'string' ? x.keterangan : undefined,
      }))
  }

  let kategori: KategoriPenilaian[] = []
  if (Array.isArray(r.kategori)) {
    kategori = r.kategori
      .filter((x) => x && typeof x.nama === 'string' && x.nama.trim())
      .map((x, i) => ({
        id: typeof x.id === 'string' && x.id ? x.id : `kat-${i}`,
        nama: String(x.nama).trim(),
        deskripsi: typeof x.deskripsi === 'string' ? x.deskripsi : undefined,
        bobot: typeof x.bobot === 'number' ? x.bobot : undefined,
      }))
  }

  return {
    kategori,
    rentangPredikat: rentang,
    rentangTerkunci: r.rentangTerkunci === true,
    catatan: typeof r.catatan === 'string' ? r.catatan : undefined,
  }
}

/** Predikat dari nilai angka (skala 0–100). */
export function predikatDariNilai(
  nilai: number,
  rentang: RentangPredikat[] = RENTANG_PREDIKAT_DEFAULT,
): RentangPredikat | null {
  const n = Math.max(0, Math.min(100, nilai))
  const sorted = [...rentang].sort((a, b) => a.min - b.min)
  for (const r of sorted) {
    if (n >= r.min && n <= r.max) return r
  }
  // Fallback: baris terdekat
  if (!sorted.length) return null
  if (n < sorted[0].min) return sorted[0]
  return sorted[sorted.length - 1]
}

/**
 * Nilai numerik dari predikat.
 * `mode`: 'tengah' (default) | 'acak' (variasi dalam rentang, untuk generate AI-assist).
 */
export function nilaiDariPredikat(
  predikat: string,
  rentang: RentangPredikat[] = RENTANG_PREDIKAT_DEFAULT,
  mode: 'tengah' | 'acak' = 'tengah',
): number {
  const r = rentang.find((x) => x.predikat === predikat)
  if (!r) return 0
  if (mode === 'tengah') {
    return Math.round((r.min + r.max) / 2)
  }
  // Acak inklusif dalam rentang
  const min = Math.ceil(r.min)
  const max = Math.floor(r.max)
  if (max <= min) return min
  return min + Math.floor(Math.random() * (max - min + 1))
}

function idKat(): string {
  return `kat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Generate usulan kategori rubrik (asesmen kinerja) dari konteks tugas.
 * Hanya dipanggil setelah bolehAiTugas() — heuristik lokal + siap diganti CF Gemini.
 */
export function generateKategoriRubrikAi(input: {
  judul: string
  mapel: string
  deskripsi?: string
  instruksi?: string
}): KategoriPenilaian[] {
  const teks = `${input.judul} ${input.mapel} ${input.deskripsi || ''} ${input.instruksi || ''}`.toLowerCase()
  const usulan: { nama: string; deskripsi: string }[] = []

  const push = (nama: string, deskripsi: string) => {
    if (usulan.some((u) => u.nama.toLowerCase() === nama.toLowerCase())) return
    usulan.push({ nama, deskripsi })
  }

  // Umum asesmen kinerja
  push('Ketepatan sesuai instruksi', 'Kesesuaian hasil kerja dengan perintah dan tujuan tugas')
  push('Kelengkapan', 'Semua bagian/langkah yang diminta terselesaikan')

  if (/gambar|menggambar|lukis|sketsa|visual|poster|tekstur|warna|garis/.test(teks)) {
    push('Tebal-tipis garis', 'Penguasaan variasi ketebalan garis sesuai maksud')
    push('Tekstur dan detail', 'Kualitas tekstur, bayangan, atau detail visual')
    push('Komposisi dan proporsi', 'Tata letak, keseimbangan, dan proporsi objek')
    push('Penggunaan warna', 'Pilihan dan penerapan warna yang selaras')
  }
  if (/tulis|karangan|cerita|esai|laporan|teks|bahasa/.test(teks)) {
    push('Isi dan gagasan', 'Kedalaman ide dan kesesuaian topik')
    push('Struktur tulisan', 'Keruntutan paragraf dan organisasi teks')
    push('Ejaan dan tata bahasa', 'Ketepatan ejaan, tanda baca, dan kalimat')
  }
  if (/hitung|matemat|soal|angka|operasi|pecahan/.test(teks)) {
    push('Ketepatan prosedur', 'Langkah penyelesaian benar dan runtut')
    push('Hasil akhir', 'Jawaban numerik/kesimpulan akurat')
    push('Penjelasan', 'Alasan atau cara berpikir yang jelas')
  }
  if (/eksperimen|percobaan|ipa|sains|pengamatan/.test(teks)) {
    push('Prosedur ilmiah', 'Mengikuti langkah percobaan dengan tertib')
    push('Pengamatan dan data', 'Ketelitian mencatat hasil')
    push('Kesimpulan', 'Menarik kesimpulan sesuai data')
  }
  if (/proyek|kelompok|kolaborasi|presentasi/.test(teks)) {
    push('Kerja sama', 'Partisipasi dan kontribusi dalam kelompok')
    push('Presentasi', 'Kejelasan menyampaikan hasil')
  }
  if (/praktek|praktik|gerak|olahraga|seni/.test(teks)) {
    push('Teknik gerakan/keterampilan', 'Ketepatan teknik yang diajarkan')
    push('Konsistensi', 'Hasil stabil dari awal hingga akhir')
  }

  // Batasi 4–6 aspek
  const ambil = usulan.slice(0, 6)
  return ambil.map((u) => ({
    id: idKat(),
    nama: u.nama,
    deskripsi: u.deskripsi,
  }))
}

/** Validasi rentang tidak tumpang tindih parah dan dalam 0–100. */
export function validasiRentang(rentang: RentangPredikat[]): string | null {
  if (!rentang.length) return 'Rentang predikat tidak boleh kosong.'
  for (const r of rentang) {
    if (r.min < 0 || r.max > 100 || r.min > r.max) {
      return `Rentang ${r.predikat} tidak valid (min–max harus 0–100 dan min ≤ max).`
    }
  }
  return null
}

/**
 * Dari predikat target, hasilkan skor per kategori (variasi acak dalam rentang predikat)
 * lalu rata-rata. Dipakai tombol generate AI di daftar nilai.
 */
export function generateSkorPerKategoriDariPredikat(
  predikat: string,
  kategori: KategoriPenilaian[],
  rentang: RentangPredikat[] = RENTANG_PREDIKAT_DEFAULT,
): { perKategori: Record<string, number>; rataRata: number; nilaiAkhir: number } {
  const r = rentang.find((x) => x.predikat === predikat)
  const min = r ? Math.ceil(r.min) : 70
  const max = r ? Math.floor(r.max) : 100
  const perKategori: Record<string, number> = {}
  if (!kategori.length) {
    const n = nilaiDariPredikat(predikat, rentang, 'acak')
    return { perKategori: {}, rataRata: n, nilaiAkhir: n }
  }
  const scores: number[] = []
  for (const k of kategori) {
    const span = Math.max(0, max - min)
    const skor = span === 0 ? min : min + Math.floor(Math.random() * (span + 1))
    perKategori[k.id] = skor
    scores.push(skor)
  }
  const rata = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
  return { perKategori, rataRata: rata, nilaiAkhir: Math.round(rata) }
}

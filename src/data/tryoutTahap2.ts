/**
 * Data hasil Try Out TKA tahap II (Matematika + Bahasa Indonesia) — diselenggarakan penyelenggara
 * eksternal (platform kejarcita.id), BUKAN di LMS. Try Out II IPA dikerjakan di LMS (otomatis),
 * jadi tidak ada di berkas ini.
 *
 * Sumber: Hasil_Tryout_SD_Muhammadiyah_Kukusan_01.xlsx (4 sheet: 6A-I, 6A-II, 6B-I, 6B-II),
 * dicocokkan dengan 4 PDF «Analisis Hasil» (nilai akhir 51 siswa identik) dan
 * Soal_dan_Pembahasan_TKA_SD_Muhammadiyah_01_Kukusan.pdf (paket 6A-I, 48 soal).
 * 51 siswa hadir. Dzaky Abdul Rauf (6A) TIDAK hadir pada sesi reguler; hasil susulannya hanya
 * berupa satu nilai gabungan (35) tanpa rincian per soal sehingga tidak bisa dipecah per mapel
 * dan SENGAJA tidak diimpor.
 *
 * CARA MENURUNKAN ANGKA (semua dari skor per butir; tidak ada angka karangan):
 * - Soal 1–24 = Matematika (total bobot 50), soal 25–48 = Bahasa Indonesia (total bobot 50).
 *   Soal tidak dijawab = 0 poin, penyebut tetap seluruh soal (ANTIREGRESI §109.2).
 * - Skor parsial sumber dibulatkan 2 desimal (0,67 / 1,33 / 0,63 / 0,42); dikembalikan ke pecahan
 *   eksak (1/3, 1/2, 2/3 dari bobot) sebelum dijumlah, lalu poin kelompok dibulatkan 2 desimal.
 * - Nilai mapel = round(poin ÷ 50 × 100), sama dengan nilaiDariSebaran().
 * - Kompetensi dasar (L1/L2/L3) dari «Level Kognitif» penyelenggara: 1–3 = L1, 4–6 = L2, 7–9 = L3.
 *   Matematika level 2 / 5 / 9; Bahasa Indonesia level 1 / 4 / 7–8.
 * - Kompetensi materi Matematika: klasifikasi soal per konten dari PDF soal paket 6A-I
 *   (Bilangan: soal 1,2,3,5,6,7,8,15,16 · Data: 9,10,17,20,21,22,23,24 ·
 *   Geometri dan Pengukuran: 4,11,12,13,14,18,19). Penyelenggara TIDAK menyediakan kisi-kisi
 *   materi; ini klasifikasi guru/pengembang, bukan data resmi. Soal 4, 13, 17, 21 paling ambigu.
 * - Bahasa Indonesia: tipe materi = L1/L2/L3 (Tekstual / Inferensial / Evaluasi dan Apresiasi),
 *   konvensi yang sama dengan Try Out I (lihat bangunSebaranBi).
 * - Paket B (sheet 6A-II, 6B-I, 6B-II) memuat 10 soal berkode baru (nomor 4, 9, 14, 16, 21–24,
 *   44, 45). Dianggap salinan soal paket A (level & bobot identik, kode berurutan menurut nomor
 *   soal, tingkat keberhasilan tidak berbeda) — dikonfirmasi guru, tidak ada PDF paket B.
 *
 * Format poin per kelompok:
 * - sbMtk.k = [L1, L2, L3] (maksK [2, 39, 9]) · sbMtk.m = [Bilangan, Data, Geometri dan Pengukuran]
 *   (maksM [19, 17, 14]) — total 50.
 * - sbBi.k = [L1, L2, L3] (maks [10, 22, 18]) — total 50.
 */
import type { BarisTryOutImport, SebaranBiImport, SebaranMtkImport } from './tryoutTahap1'

/** Poin maksimum Try Out TKA Matematika 2 & Bahasa Indonesia 2 (total 50 per mapel). */
export const MAKS_TRYOUT2_MTK_KOMPLEKSITAS = [2, 39, 9] as const
export const MAKS_TRYOUT2_MTK_MATERI = [19, 17, 14] as const
export const MAKS_TRYOUT2_BI_KOMPLEKSITAS = [10, 22, 18] as const

export const SUMBER_TRYOUT_TAHAP_2 =
  'Penyelenggara eksternal (kejarcita.id) · Hasil_Tryout_SD_Muhammadiyah_Kukusan_01.xlsx · 51 siswa hadir'

const mtk2 = (
  k: [number, number, number],
  m: [number, number, number],
): SebaranMtkImport => ({
  k,
  m,
  maksK: MAKS_TRYOUT2_MTK_KOMPLEKSITAS,
  maksM: MAKS_TRYOUT2_MTK_MATERI,
})

const bi2 = (k: [number, number, number]): SebaranBiImport => ({
  k,
  maks: [...MAKS_TRYOUT2_BI_KOMPLEKSITAS],
})

export const DATA_TRYOUT_TAHAP_2: readonly BarisTryOutImport[] = [
  { nama: 'Abi Ibadurrohman', kelas: '6A', mtk: 57, bi: 56, sbMtk: mtk2([0, 22.33, 6], [14, 8.67, 5.67]), sbBi: bi2([5.63, 9.67, 12.5]) },
  { nama: 'Al-Ghifari Azzam Khoirusshalih Mahika', kelas: '6A', mtk: 70, bi: 80, sbMtk: mtk2([1, 25, 9], [15.67, 12.67, 6.67]), sbBi: bi2([6.46, 15.67, 18]) },
  { nama: 'Daenzel Zhafran', kelas: '6A', mtk: 45, bi: 31, sbMtk: mtk2([1, 15.33, 6], [13.33, 0, 9]), sbBi: bi2([1.25, 6.67, 7.5]) },
  { nama: 'Davindra Arfino Erwansyah', kelas: '6A', mtk: 35, bi: 50, sbMtk: mtk2([0, 15.33, 2], [7.67, 7.67, 2]), sbBi: bi2([3.54, 16.67, 5]) },
  { nama: 'Farannisa Humaira Mumtaz', kelas: '6A', mtk: 37, bi: 65, sbMtk: mtk2([1, 12.33, 5], [8.67, 2.67, 7]), sbBi: bi2([8.13, 10.67, 13.75]) },
  { nama: 'Fayakuun Abdullah Wikrama', kelas: '6A', mtk: 41, bi: 51, sbMtk: mtk2([1, 15.67, 4], [8.67, 5.33, 6.67]), sbBi: bi2([6.46, 12.67, 6.25]) },
  { nama: 'Gibran Praja Al Fatih', kelas: '6A', mtk: 58, bi: 81, sbMtk: mtk2([1, 23, 5], [10.33, 9.67, 9]), sbBi: bi2([8.54, 16.67, 15.5]) },
  { nama: 'Hafiza Khaira Lubna', kelas: '6A', mtk: 44, bi: 63, sbMtk: mtk2([1, 18, 3], [7.33, 9.67, 5]), sbBi: bi2([5, 12.33, 14.25]) },
  { nama: 'Hafiz Ali Al Fatih', kelas: '6A', mtk: 60, bi: 55, sbMtk: mtk2([1, 22, 7], [12.33, 7.67, 10]), sbBi: bi2([7.5, 11, 8.75]) },
  { nama: 'Kanzaki Luvry Amirza', kelas: '6A', mtk: 31, bi: 47, sbMtk: mtk2([0, 12.67, 3], [9, 6, 0.67]), sbBi: bi2([6.25, 10.67, 6.75]) },
  { nama: 'Luqman Syafii', kelas: '6A', mtk: 39, bi: 74, sbMtk: mtk2([0, 16.67, 3], [9.67, 6, 4]), sbBi: bi2([6.88, 17.67, 12.5]) },
  { nama: 'Mirza Ukail Bunia', kelas: '6A', mtk: 34, bi: 54, sbMtk: mtk2([0, 12, 5], [9.33, 4.67, 3]), sbBi: bi2([5.63, 11.33, 10]) },
  { nama: 'Muhammad Abdus Salam Firanda', kelas: '6A', mtk: 44, bi: 48, sbMtk: mtk2([0, 17, 5], [10.33, 8, 3.67]), sbBi: bi2([5, 11.67, 7.5]) },
  { nama: 'Muhammad Arkan Alfarizi', kelas: '6A', mtk: 28, bi: 50, sbMtk: mtk2([0, 12, 2], [5.67, 6.67, 1.67]), sbBi: bi2([3.75, 16, 5]) },
  { nama: 'Muhammad Danish Alfiero', kelas: '6A', mtk: 56, bi: 67, sbMtk: mtk2([0, 21, 7], [9.67, 12.67, 5.67]), sbBi: bi2([6.25, 14.67, 12.5]) },
  { nama: 'Muhammad Wirabumi', kelas: '6A', mtk: 35, bi: 56, sbMtk: mtk2([0, 14.33, 3], [9.67, 5.33, 2.33]), sbBi: bi2([4.58, 13, 10.5]) },
  { nama: 'Naila Azharina Zhafira', kelas: '6A', mtk: 41, bi: 52, sbMtk: mtk2([0, 15.33, 5], [6.67, 6, 7.67]), sbBi: bi2([5.21, 11, 10]) },
  { nama: 'Najla Fiesya Callista', kelas: '6A', mtk: 32, bi: 84, sbMtk: mtk2([1, 13, 2], [4.67, 5.33, 6]), sbBi: bi2([7.5, 16.33, 18]) },
  { nama: 'Naufal Adrian Ramadhani', kelas: '6A', mtk: 23, bi: 55, sbMtk: mtk2([0, 8.67, 3], [5.67, 3.33, 2.67]), sbBi: bi2([3.75, 13.67, 10]) },
  { nama: 'Oryza Adilla Yasin', kelas: '6A', mtk: 54, bi: 68, sbMtk: mtk2([1, 22, 4], [15, 8, 4]), sbBi: bi2([7.5, 17.67, 8.75]) },
  { nama: 'Qisya Hamizan Chasril', kelas: '6A', mtk: 40, bi: 78, sbMtk: mtk2([2, 16, 2], [9.67, 7, 3.33]), sbBi: bi2([8.75, 17.33, 13]) },
  { nama: 'Safiya Azzahra Elmeira Kandow', kelas: '6A', mtk: 43, bi: 46, sbMtk: mtk2([0, 18.67, 3], [10.33, 3, 8.33]), sbBi: bi2([5.63, 7.33, 10]) },
  { nama: 'Sinan Abhinaya Tsabit', kelas: '6A', mtk: 37, bi: 42, sbMtk: mtk2([0, 13.33, 5], [9.67, 2.33, 6.33]), sbBi: bi2([3.54, 11.33, 6.25]) },
  { nama: 'Syabila Aisyatuz Zahra', kelas: '6A', mtk: 37, bi: 38, sbMtk: mtk2([1, 12.67, 5], [7.67, 6, 5]), sbBi: bi2([4.38, 8.33, 6.25]) },
  { nama: 'Yasfa Qudsiyyah', kelas: '6A', mtk: 53, bi: 71, sbMtk: mtk2([1, 16.67, 9], [9, 7.67, 10]), sbBi: bi2([7.5, 16.67, 11.25]) },
  { nama: 'Agisha Bellvania Raeka Hermansyah', kelas: '6B', mtk: 50, bi: 79, sbMtk: mtk2([1, 18, 6], [8.33, 9.33, 7.33]), sbBi: bi2([7.29, 18.67, 13.75]) },
  { nama: 'Ahmad Rayhan Nurhadi', kelas: '6B', mtk: 60, bi: 87, sbMtk: mtk2([1, 25, 4], [14.67, 7.33, 8]), sbBi: bi2([9.38, 21, 13]) },
  { nama: 'Aisyah Ayudia Inara', kelas: '6B', mtk: 51, bi: 82, sbMtk: mtk2([1, 20.33, 4], [10.67, 7.33, 7.33]), sbBi: bi2([6.67, 20, 14.25]) },
  { nama: 'Alendru Naizar', kelas: '6B', mtk: 46, bi: 46, sbMtk: mtk2([0, 19, 4], [9, 5.67, 8.33]), sbBi: bi2([5.21, 11.33, 6.25]) },
  { nama: 'Alisha Marwa Shofia', kelas: '6B', mtk: 60, bi: 84, sbMtk: mtk2([0, 24, 6], [12.33, 7.67, 10]), sbBi: bi2([7.5, 20, 14.25]) },
  { nama: 'Arkarilo Alkhawarizmi Laami', kelas: '6B', mtk: 48, bi: 45, sbMtk: mtk2([0, 19, 5], [12.67, 6, 5.33]), sbBi: bi2([3.54, 11.33, 7.5]) },
  { nama: 'Awlia Ramadhani Handoko', kelas: '6B', mtk: 51, bi: 61, sbMtk: mtk2([0, 19.67, 6], [8, 9.67, 8]), sbBi: bi2([6.25, 10.67, 13.75]) },
  { nama: 'Dhabita Arissa Mahera', kelas: '6B', mtk: 27, bi: 63, sbMtk: mtk2([1, 8.33, 4], [4.67, 1.33, 7.33]), sbBi: bi2([6.46, 14.67, 10.5]) },
  { nama: 'Fathan Ghani Abidenur', kelas: '6B', mtk: 71, bi: 74, sbMtk: mtk2([2, 26.33, 7], [14.33, 13.67, 7.33]), sbBi: bi2([6.88, 17.33, 13]) },
  { nama: 'Ibrahim Abbas Al Ukasyah Hasibuan', kelas: '6B', mtk: 44, bi: 71, sbMtk: mtk2([1, 17, 4], [6.67, 8, 7.33]), sbBi: bi2([3.33, 16.67, 15.5]) },
  { nama: 'La Ode Muhammad Fakhri Akbar', kelas: '6B', mtk: 44, bi: 50, sbMtk: mtk2([1, 14, 7], [8.67, 7, 6.33]), sbBi: bi2([3.33, 14.33, 7.5]) },
  { nama: 'Maliq Rizky Javier', kelas: '6B', mtk: 58, bi: 60, sbMtk: mtk2([0, 20, 9], [11.67, 11.67, 5.67]), sbBi: bi2([7.5, 13.67, 8.75]) },
  { nama: 'Mohammad Rayyan Bagjapura', kelas: '6B', mtk: 59, bi: 86, sbMtk: mtk2([1, 24.67, 4], [13.67, 11, 5]), sbBi: bi2([9.58, 18.33, 15]) },
  { nama: 'Muhammad Abdullah Azzam', kelas: '6B', mtk: 35, bi: 65, sbMtk: mtk2([1, 10.33, 6], [5.67, 4, 7.67]), sbBi: bi2([6.88, 18, 7.5]) },
  { nama: 'Muhammad Abidzar Al Ghifari', kelas: '6B', mtk: 74, bi: 77, sbMtk: mtk2([2, 27, 8], [18, 12.33, 6.67]), sbBi: bi2([10, 18, 10.5]) },
  { nama: 'Muhammad Alzam Hanif', kelas: '6B', mtk: 47, bi: 66, sbMtk: mtk2([1, 17.33, 5], [12.67, 7.33, 3.33]), sbBi: bi2([4.38, 15, 13.75]) },
  { nama: 'Muhammad Kafiluddin Jundori', kelas: '6B', mtk: 58, bi: 51, sbMtk: mtk2([0, 23, 6], [13, 9.67, 6.33]), sbBi: bi2([6.04, 12, 7.5]) },
  { nama: 'Naufal Ibrohim', kelas: '6B', mtk: 43, bi: 47, sbMtk: mtk2([0, 13.33, 8], [8, 7.67, 5.67]), sbBi: bi2([6.88, 12.67, 3.75]) },
  { nama: 'Raziq Hanan Achmad', kelas: '6B', mtk: 54, bi: 62, sbMtk: mtk2([1, 20, 6], [13.67, 6.67, 6.67]), sbBi: bi2([4.38, 12.33, 14.25]) },
  { nama: 'Sabiq Alkhairy Rahman', kelas: '6B', mtk: 49, bi: 48, sbMtk: mtk2([0, 19.67, 5], [12.67, 6.67, 5.33]), sbBi: bi2([3.75, 11.33, 8.75]) },
  { nama: 'Syafira Putri Kartadisastra', kelas: '6B', mtk: 46, bi: 56, sbMtk: mtk2([0, 15, 8], [7, 9, 7]), sbBi: bi2([4.38, 13.67, 10]) },
  { nama: 'Syifa Aulia Azkiya', kelas: '6B', mtk: 44, bi: 64, sbMtk: mtk2([0, 18, 4], [9, 6, 7]), sbBi: bi2([7.71, 14.33, 10]) },
  { nama: 'Tangguh Hafiz Pratama', kelas: '6B', mtk: 44, bi: 44, sbMtk: mtk2([0, 17, 5], [10.67, 4.67, 6.67]), sbBi: bi2([3.96, 9.33, 8.75]) },
  { nama: 'Uwais Al Fatih', kelas: '6B', mtk: 39, bi: 39, sbMtk: mtk2([1, 15.67, 3], [8.67, 2.67, 8.33]), sbBi: bi2([1.67, 9, 8.75]) },
  { nama: 'Vania Amira Zhafirah', kelas: '6B', mtk: 48, bi: 65, sbMtk: mtk2([1, 21, 2], [10.67, 6, 7.33]), sbBi: bi2([4.17, 12.67, 15.5]) },
  { nama: 'Zakiyah Fathinah Fauziyah', kelas: '6B', mtk: 31, bi: 55, sbMtk: mtk2([0, 14.33, 1], [4.33, 6.67, 4.33]), sbBi: bi2([5.83, 9.33, 12.5]) },
  { nama: 'Dzaky Abdul Rauf', kelas: '6A', mtk: 31, bi: 39, sbMtk: mtk2([0, 14.33, 1], [4.33, 6.67, 4.33]), sbBi: bi2([1.67, 9, 8.75]) },
]

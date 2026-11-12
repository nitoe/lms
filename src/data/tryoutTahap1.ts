/**
 * Data hasil Try Out TKA tahap I dari portal tka2026
 * (rekap-kelas-gabungan, dicetak 12/11/2026).
 * Hanya MTK + BI; IPA belum diujikan pada tahap I.
 * Nilai sudah diverifikasi mean MTK 40.7 / BI 49.8 / n=52.
 *
 * Sebaran capaian per siswa (sbMtk / sbBi) berasal dari
 * Rekap_Nilai_Try_Out_TKA_Matematika.xlsx dan Rekap_Nilai_Try_Out_TKA_Bahasa_Indonesia.xlsx
 * (dicetak 12/11/2026). Disimpan sebagai POIN per kelompok, bukan persen berbulat:
 *
 * - sbMtk.k = poin [L1, L2]            (maks [15, 17], total 32)
 * - sbMtk.m = poin [Bilangan, Data, Geometri dan Pengukuran]   (maks [10, 12, 10])
 * - sbBi.k  = poin [L1, L2, L3]        (maks bawaan [10, 10, 20], total 40)
 *   Pada BI, L1/L2/L3 sama persis dengan Pemahaman Tekstual / Inferensial / Evaluasi dan
 *   Apresiasi — tipe materi diturunkan dari k (lihat bangunSebaranBi di importRekapTka.ts).
 * - sbBi.maks = maks per kelompok bila berbeda dari bawaan. Dua siswa kehabisan waktu
 *   (Daenzel Zhafran 6A, Zakiyah Fathinah Fauziyah 6B): soal yang tidak sempat tampil tidak
 *   dihitung oleh portal lama (maks 36 / 37, bukan 40). Angka sumber dipertahankan apa adanya
 *   dan ditandai waktuHabis (ANTIREGRESI §109).
 */
export type SebaranMtkImport = {
  k: [number, number]
  m: [number, number, number]
}

export type SebaranBiImport = {
  k: [number, number, number]
  maks?: [number, number, number]
  waktuHabis?: boolean
}

export type BarisTryOutImport = {
  nama: string
  kelas: '6A' | '6B'
  mtk: number
  bi: number
  sbMtk?: SebaranMtkImport
  sbBi?: SebaranBiImport
}

/** Poin maksimum bawaan Try Out TKA Matematika 1 & Bahasa Indonesia 1. */
export const MAKS_MTK_KOMPLEKSITAS = [15, 17] as const
export const MAKS_MTK_MATERI = [10, 12, 10] as const
export const MAKS_BI_KOMPLEKSITAS = [10, 10, 20] as const

export const SUMBER_TRYOUT_TAHAP_1 =
  'Portal tka2026 · rekap kelas gabungan · dicetak 12/11/2026'

export const DATA_TRYOUT_TAHAP_1: readonly BarisTryOutImport[] = [
  { nama: 'Muhammad Abidzar Al Ghifari', kelas: '6B', mtk: 91, bi: 68, sbMtk: { k: [15, 14], m: [10, 9, 10] }, sbBi: { k: [9, 10, 8] } },
  { nama: 'Abi Ibadurrohman', kelas: '6A', mtk: 75, bi: 53, sbMtk: { k: [12, 12], m: [8, 8, 8] }, sbBi: { k: [9, 8, 4] } },
  { nama: 'Ahmad Rayhan Nurhadi', kelas: '6B', mtk: 66, bi: 57, sbMtk: { k: [10, 11], m: [10, 5, 6] }, sbBi: { k: [8, 9, 6] } },
  { nama: 'Oryza Adilla Yasin', kelas: '6A', mtk: 59, bi: 57, sbMtk: { k: [9, 10], m: [8, 5, 6] }, sbBi: { k: [7, 8, 8] } },
  { nama: 'Gibran Praja Al Fatih', kelas: '6A', mtk: 50, bi: 57, sbMtk: { k: [8, 8], m: [6, 4, 6] }, sbBi: { k: [9, 10, 4] } },
  { nama: 'Syifa Aulia Azkiya', kelas: '6B', mtk: 50, bi: 55, sbMtk: { k: [6, 10], m: [6, 6, 4] }, sbBi: { k: [7, 7, 8] } },
  { nama: 'Fathan Ghani Abidenur', kelas: '6B', mtk: 50, bi: 53, sbMtk: { k: [6, 10], m: [7, 4, 5] }, sbBi: { k: [8, 7, 6] } },
  { nama: 'Mohammad Rayyan Bagjapura', kelas: '6B', mtk: 47, bi: 57, sbMtk: { k: [6, 9], m: [5, 5, 5] }, sbBi: { k: [8, 5, 10] } },
  { nama: 'Muhammad Kafiluddin Jundori', kelas: '6B', mtk: 44, bi: 60, sbMtk: { k: [7, 7], m: [4, 4, 6] }, sbBi: { k: [8, 8, 8] } },
  { nama: 'Agisha Bellvania Raeka Hermansyah', kelas: '6B', mtk: 34, bi: 68, sbMtk: { k: [6, 5], m: [4, 4, 3] }, sbBi: { k: [8, 9, 10] } },
  { nama: 'Luqman Syafii', kelas: '6A', mtk: 47, bi: 55, sbMtk: { k: [5, 10], m: [8, 4, 3] }, sbBi: { k: [7, 7, 8] } },
  { nama: 'Muhammad Abdullah Azzam', kelas: '6B', mtk: 47, bi: 55, sbMtk: { k: [6, 9], m: [6, 6, 3] }, sbBi: { k: [9, 7, 6] } },
  { nama: 'Syafira Putri Kartadisastra', kelas: '6B', mtk: 41, bi: 60, sbMtk: { k: [5, 8], m: [4, 5, 4] }, sbBi: { k: [8, 8, 8] } },
  { nama: 'Vania Amira Zhafirah', kelas: '6B', mtk: 44, bi: 57, sbMtk: { k: [8, 6], m: [6, 4, 4] }, sbBi: { k: [9, 8, 6] } },
  { nama: 'Alisha Marwa Shofia', kelas: '6B', mtk: 50, bi: 50, sbMtk: { k: [5, 11], m: [6, 6, 4] }, sbBi: { k: [8, 8, 4] } },
  { nama: 'Muhammad Alzam Hanif', kelas: '6B', mtk: 47, bi: 53, sbMtk: { k: [5, 10], m: [7, 5, 3] }, sbBi: { k: [6, 9, 6] } },
  { nama: 'Qisya Hamizan Chasril', kelas: '6A', mtk: 50, bi: 50, sbMtk: { k: [8, 8], m: [7, 4, 5] }, sbBi: { k: [8, 4, 8] } },
  { nama: 'Aisyah Ayudia Inara', kelas: '6B', mtk: 41, bi: 53, sbMtk: { k: [6, 7], m: [3, 5, 5] }, sbBi: { k: [7, 8, 6] } },
  { nama: 'Arkarilo Alkhawarizmi Laami', kelas: '6B', mtk: 41, bi: 53, sbMtk: { k: [6, 7], m: [4, 5, 4] }, sbBi: { k: [9, 6, 6] } },
  { nama: 'Raziq Hanan Achmad', kelas: '6B', mtk: 44, bi: 50, sbMtk: { k: [8, 6], m: [4, 4, 6] }, sbBi: { k: [5, 9, 6] } },
  { nama: 'Hafiz Ali Al Fatih', kelas: '6A', mtk: 41, bi: 50, sbMtk: { k: [4, 9], m: [4, 7, 2] }, sbBi: { k: [8, 4, 8] } },
  { nama: 'La Ode Muhammad Fakhri Akbar', kelas: '6B', mtk: 47, bi: 45, sbMtk: { k: [6, 9], m: [5, 5, 5] }, sbBi: { k: [6, 8, 4] } },
  { nama: 'Maliq Rizky Javier', kelas: '6B', mtk: 47, bi: 45, sbMtk: { k: [4, 11], m: [3, 6, 6] }, sbBi: { k: [7, 5, 6] } },
  { nama: 'Sinan Abhinaya Tsabit', kelas: '6A', mtk: 47, bi: 45, sbMtk: { k: [6, 9], m: [4, 5, 6] }, sbBi: { k: [7, 7, 4] } },
  { nama: 'Syabila Aisyatuz Zahra', kelas: '6A', mtk: 44, bi: 48, sbMtk: { k: [6, 8], m: [6, 4, 4] }, sbBi: { k: [9, 6, 4] } },
  { nama: 'Uwais Al Fatih', kelas: '6B', mtk: 34, bi: 57, sbMtk: { k: [4, 7], m: [2, 7, 2] }, sbBi: { k: [8, 7, 8] } },
  { nama: 'Dhabita Arissa Mahera', kelas: '6B', mtk: 44, bi: 45, sbMtk: { k: [6, 8], m: [3, 6, 5] }, sbBi: { k: [7, 3, 8] } },
  { nama: 'Daenzel Zhafran', kelas: '6A', mtk: 41, bi: 47, sbMtk: { k: [5, 8], m: [5, 4, 4] }, sbBi: { k: [4, 7, 6], maks: [7, 9, 20], waktuHabis: true } },
  { nama: 'Ibrahim Abbas Al Ukasyah Hasibuan', kelas: '6B', mtk: 41, bi: 45, sbMtk: { k: [4, 9], m: [3, 6, 4] }, sbBi: { k: [6, 8, 4] } },
  { nama: 'Muhammad Danish Alfiero', kelas: '6A', mtk: 38, bi: 48, sbMtk: { k: [4, 8], m: [5, 5, 2] }, sbBi: { k: [5, 8, 6] } },
  { nama: 'Yasfa Qudsiyyah', kelas: '6A', mtk: 31, bi: 55, sbMtk: { k: [3, 7], m: [2, 5, 3] }, sbBi: { k: [9, 9, 4] } },
  { nama: 'Al-Ghifari Azzam Khoirusshalih Mahika', kelas: '6A', mtk: 44, bi: 40, sbMtk: { k: [6, 8], m: [5, 4, 5] }, sbBi: { k: [9, 5, 2] } },
  { nama: 'Alendru Naizar', kelas: '6B', mtk: 44, bi: 40, sbMtk: { k: [6, 8], m: [7, 3, 4] }, sbBi: { k: [4, 4, 8] } },
  { nama: 'Muhammad Wirabumi', kelas: '6A', mtk: 41, bi: 43, sbMtk: { k: [5, 8], m: [5, 4, 4] }, sbBi: { k: [7, 8, 2] } },
  { nama: 'Farannisa Humaira Mumtaz', kelas: '6A', mtk: 34, bi: 48, sbMtk: { k: [4, 7], m: [6, 4, 1] }, sbBi: { k: [6, 5, 8] } },
  { nama: 'Kanzaki Luvry Amirza', kelas: '6A', mtk: 19, bi: 63, sbMtk: { k: [3, 3], m: [2, 2, 2] }, sbBi: { k: [10, 9, 6] } },
  { nama: 'Mirza Ukail Bunia', kelas: '6A', mtk: 47, bi: 35, sbMtk: { k: [7, 8], m: [5, 4, 6] }, sbBi: { k: [6, 2, 6] } },
  { nama: 'Sabiq Alkhairy Rahman', kelas: '6B', mtk: 34, bi: 48, sbMtk: { k: [5, 6], m: [5, 4, 2] }, sbBi: { k: [5, 8, 6] } },
  { nama: 'Najla Fiesya Callista', kelas: '6A', mtk: 34, bi: 45, sbMtk: { k: [2, 9], m: [4, 2, 5] }, sbBi: { k: [5, 5, 8] } },
  { nama: 'Naufal Ibrohim', kelas: '6B', mtk: 25, bi: 55, sbMtk: { k: [5, 3], m: [1, 3, 4] }, sbBi: { k: [7, 9, 6] } },
  { nama: 'Awlia Ramadhani Handoko', kelas: '6B', mtk: 28, bi: 50, sbMtk: { k: [3, 6], m: [5, 2, 2] }, sbBi: { k: [5, 7, 8] } },
  { nama: 'Dzaky Abdul Rauf', kelas: '6A', mtk: 28, bi: 50, sbMtk: { k: [6, 3], m: [3, 3, 3] }, sbBi: { k: [5, 7, 8] } },
  { nama: 'Hafiza Khaira Lubna', kelas: '6A', mtk: 16, bi: 60, sbMtk: { k: [2, 3], m: [2, 2, 1] }, sbBi: { k: [8, 6, 10] } },
  { nama: 'Zakiyah Fathinah Fauziyah', kelas: '6B', mtk: 25, bi: 51, sbMtk: { k: [3, 5], m: [4, 1, 3] }, sbBi: { k: [5, 8, 6], maks: [8, 9, 20], waktuHabis: true } },
  { nama: 'Naila Azharina Zhafira', kelas: '6A', mtk: 28, bi: 43, sbMtk: { k: [6, 3], m: [2, 5, 2] }, sbBi: { k: [5, 4, 8] } },
  { nama: 'Naufal Adrian Ramadhani', kelas: '6A', mtk: 25, bi: 45, sbMtk: { k: [3, 5], m: [2, 4, 2] }, sbBi: { k: [7, 7, 4] } },
  { nama: 'Tangguh Hafiz Pratama', kelas: '6B', mtk: 22, bi: 48, sbMtk: { k: [2, 5], m: [2, 4, 1] }, sbBi: { k: [7, 8, 4] } },
  { nama: 'Fayakuun Abdullah Wikrama', kelas: '6A', mtk: 38, bi: 30, sbMtk: { k: [2, 10], m: [4, 5, 3] }, sbBi: { k: [6, 4, 2] } },
  { nama: 'Muhammad Arkan Alfarizi', kelas: '6A', mtk: 28, bi: 40, sbMtk: { k: [2, 7], m: [3, 3, 3] }, sbBi: { k: [8, 4, 4] } },
  { nama: 'Muhammad Abdus Salam Firanda', kelas: '6A', mtk: 25, bi: 40, sbMtk: { k: [4, 4], m: [3, 3, 2] }, sbBi: { k: [2, 6, 8] } },
  { nama: 'Safiya Azzahra Elmeira Kandow', kelas: '6A', mtk: 25, bi: 40, sbMtk: { k: [3, 5], m: [1, 5, 2] }, sbBi: { k: [4, 4, 8] } },
  { nama: 'Davindra Arfino Erwansyah', kelas: '6A', mtk: 31, bi: 25, sbMtk: { k: [4, 6], m: [2, 5, 3] }, sbBi: { k: [3, 1, 6] } },
]

/**
 * Data hasil Try Out TKA tahap I dari portal tka2026
 * (rekap-kelas-gabungan, dicetak 12/11/2026).
 * Hanya MTK + BI; IPA belum ada di sumber.
 * Nilai sudah diverifikasi mean MTK 40.7 / BI 49.8 / n=52.
 */
export type BarisTryOutImport = {
  nama: string
  kelas: '6A' | '6B'
  mtk: number
  bi: number
}

export const SUMBER_TRYOUT_TAHAP_1 =
  'Portal tka2026 · rekap kelas gabungan · dicetak 12/11/2026'

export const DATA_TRYOUT_TAHAP_1: readonly BarisTryOutImport[] = [
  { nama: 'Muhammad Abidzar Al Ghifari', kelas: '6B', mtk: 91, bi: 68 },
  { nama: 'Abi Ibadurrohman', kelas: '6A', mtk: 75, bi: 53 },
  { nama: 'Ahmad Rayhan Nurhadi', kelas: '6B', mtk: 66, bi: 57 },
  { nama: 'Oryza Adilla Yasin', kelas: '6A', mtk: 59, bi: 57 },
  { nama: 'Gibran Praja Al Fatih', kelas: '6A', mtk: 50, bi: 57 },
  { nama: 'Syifa Aulia Azkiya', kelas: '6B', mtk: 50, bi: 55 },
  { nama: 'Fathan Ghani Abidenur', kelas: '6B', mtk: 50, bi: 53 },
  { nama: 'Mohammad Rayyan Bagjapura', kelas: '6B', mtk: 47, bi: 57 },
  { nama: 'Muhammad Kafiluddin Jundori', kelas: '6B', mtk: 44, bi: 60 },
  { nama: 'Agisha Bellvania Raeka Hermansyah', kelas: '6B', mtk: 34, bi: 68 },
  { nama: 'Luqman Syafii', kelas: '6A', mtk: 47, bi: 55 },
  { nama: 'Muhammad Abdullah Azzam', kelas: '6B', mtk: 47, bi: 55 },
  { nama: 'Syafira Putri Kartadisastra', kelas: '6B', mtk: 41, bi: 60 },
  { nama: 'Vania Amira Zhafirah', kelas: '6B', mtk: 44, bi: 57 },
  { nama: 'Alisha Marwa Shofia', kelas: '6B', mtk: 50, bi: 50 },
  { nama: 'Muhammad Alzam Hanif', kelas: '6B', mtk: 47, bi: 53 },
  { nama: 'Qisya Hamizan Chasril', kelas: '6A', mtk: 50, bi: 50 },
  { nama: 'Aisyah Ayudia Inara', kelas: '6B', mtk: 41, bi: 53 },
  { nama: 'Arkarilo Alkhawarizmi Laami', kelas: '6B', mtk: 41, bi: 53 },
  { nama: 'Raziq Hanan Achmad', kelas: '6B', mtk: 44, bi: 50 },
  { nama: 'Hafiz Ali Al Fatih', kelas: '6A', mtk: 41, bi: 50 },
  { nama: 'La Ode Muhammad Fakhri Akbar', kelas: '6B', mtk: 47, bi: 45 },
  { nama: 'Maliq Rizky Javier', kelas: '6B', mtk: 47, bi: 45 },
  { nama: 'Sinan Abhinaya Tsabit', kelas: '6A', mtk: 47, bi: 45 },
  { nama: 'Syabila Aisyatuz Zahra', kelas: '6A', mtk: 44, bi: 48 },
  { nama: 'Uwais Al Fatih', kelas: '6B', mtk: 34, bi: 57 },
  { nama: 'Dhabita Arissa Mahera', kelas: '6B', mtk: 44, bi: 45 },
  { nama: 'Daenzel Zhafran', kelas: '6A', mtk: 41, bi: 47 },
  { nama: 'Ibrahim Abbas Al Ukasyah Hasibuan', kelas: '6B', mtk: 41, bi: 45 },
  { nama: 'Muhammad Danish Alfiero', kelas: '6A', mtk: 38, bi: 48 },
  { nama: 'Yasfa Qudsiyyah', kelas: '6A', mtk: 31, bi: 55 },
  { nama: 'Al-Ghifari Azzam Khoirusshalih Mahika', kelas: '6A', mtk: 44, bi: 40 },
  { nama: 'Alendru Naizar', kelas: '6B', mtk: 44, bi: 40 },
  { nama: 'Muhammad Wirabumi', kelas: '6A', mtk: 41, bi: 43 },
  { nama: 'Farannisa Humaira Mumtaz', kelas: '6A', mtk: 34, bi: 48 },
  { nama: 'Kanzaki Luvry Amirza', kelas: '6A', mtk: 19, bi: 63 },
  { nama: 'Mirza Ukail Bunia', kelas: '6A', mtk: 47, bi: 35 },
  { nama: 'Sabiq Alkhairy Rahman', kelas: '6B', mtk: 34, bi: 48 },
  { nama: 'Najla Fiesya Callista', kelas: '6A', mtk: 34, bi: 45 },
  { nama: 'Naufal Ibrohim', kelas: '6B', mtk: 25, bi: 55 },
  { nama: 'Awlia Ramadhani Handoko', kelas: '6B', mtk: 28, bi: 50 },
  { nama: 'Dzaky Abdul Rauf', kelas: '6A', mtk: 28, bi: 50 },
  { nama: 'Hafiza Khaira Lubna', kelas: '6A', mtk: 16, bi: 60 },
  { nama: 'Zakiyah Fathinah Fauziyah', kelas: '6B', mtk: 25, bi: 51 },
  { nama: 'Naila Azharina Zhafira', kelas: '6A', mtk: 28, bi: 43 },
  { nama: 'Naufal Adrian Ramadhani', kelas: '6A', mtk: 25, bi: 45 },
  { nama: 'Tangguh Hafiz Pratama', kelas: '6B', mtk: 22, bi: 48 },
  { nama: 'Fayakuun Abdullah Wikrama', kelas: '6A', mtk: 38, bi: 30 },
  { nama: 'Muhammad Arkan Alfarizi', kelas: '6A', mtk: 28, bi: 40 },
  { nama: 'Muhammad Abdus Salam Firanda', kelas: '6A', mtk: 25, bi: 40 },
  { nama: 'Safiya Azzahra Elmeira Kandow', kelas: '6A', mtk: 25, bi: 40 },
  { nama: 'Davindra Arfino Erwansyah', kelas: '6A', mtk: 31, bi: 25 },
]

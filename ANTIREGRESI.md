## §100. Kelas 6 tanpa 6C; katalog TKA; konfirmasi keluar akun siswa

100.1 Rombel kelas 6 hanya **6A** dan **6B**. Jangan mengembalikan **6C** ke `DAFTAR_KELAS` / `DAFTAR_KELAS_SD` kecuali sekolah benar-benar membuka rombel itu.

100.2 Siswa kelas 6 harus menemukan TKA dari **beranda** (kartu katalog) dan **nav**, bukan hanya nav.

100.3 Tombol **Keluar** di header area siswa **wajib** `confirm` sebelum `signOut`. Jangan logout langsung.

100.4 Saat komponen pengerjaan kuis/TKA aktif, pasang `beforeunload` agar tutup tab/refresh tidak tanpa peringatan. Tombol Keluar *di dalam* kuis tetap memakai dialog sendiri (bukan logout akun).

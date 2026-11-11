## 2026-11-11 — Fix: tanpa 6C, katalog TKA di beranda, konfirmasi keluar akun

- **Kelas 6C** dihapus dari `DAFTAR_KELAS` (login siswa) dan `DAFTAR_KELAS_SD` — sekolah tidak punya 6C (hanya 6A/6B).
- **Beranda siswa:** kartu katalog **TKA** untuk siswa kelas 6 (selain nav header).
- **Tombol Keluar (header):** konfirmasi sebelum logout, agar tidak keluar akun saat mengira itu keluar kuis.
- **Sedang mengerjakan kuis/TKA:** `beforeunload` minta konfirmasi jika tab ditutup/refresh.
- File: `siswaAuth.ts`, `kelasLms.ts`, `SiswaBeranda.tsx`, `SiswaLayout.tsx`, `SiswaKuis.tsx`, `SiswaTka.tsx`.
- ANTIREGRESI §100

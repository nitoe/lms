# CHANGELOG

## 0.2.0 — Fase 1a: Daftar ruang kelas + halaman kelas

- Daftar ruang kelas dari penugasan / waliKelas profil guru (`src/lib/kelasLms.ts`).
- Halaman `/kelas` (grid kartu kelas × mapel) dan `/kelas/:ruangId` (tab Pengumuman · Materi · Tugas — skeleton).
- Beranda menampilkan ringkasan ruang kelas yang diampu.
- **Layout lebar penuh** mengikuti pola aplikasi Penilaian (`max-w-[1600px]` untuk `/` dan `/kelas*`) agar tidak muncul ruang kosong kiri-kanan saat zoom-out / layar lebar (lihat ANTIREGRESI §6).

## 0.1.0 — Fase 0: Fondasi

- Inisialisasi proyek Vite + React 19 + TypeScript + Tailwind CSS v4 + Firebase.
- Halaman masuk staf (`/masuk`), siswa (`/siswa/masuk`), dan orang tua (`/orangtua/masuk`) dengan desain auth-shell menarik (mengikuti pola Perpustakaan).
- Auth staf & orang tua lewat Firebase Auth + profil `users/{uid}` (shared).
- Login siswa lewat kelas + nama + NISN (sessionStorage, tanpa akun Firebase baru).
- Routing peran: dashboard staf, shell siswa, dashboard orang tua.
- Dokumentasi: README, RANCANGAN, DATA_MODEL, DEPLOY, ANTIREGRESI.

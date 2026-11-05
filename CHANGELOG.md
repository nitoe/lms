# CHANGELOG

## 0.3.0 — Fase 1b: Materi pembelajaran

- Tab **Materi** di halaman kelas: unggah PDF/gambar/video, tautan YouTube, dan tautan umum.
- Pengelompokan materi menurut **Tujuan Pembelajaran (TP)** dari koleksi `tp_kktp` (aplikasi Penilaian), plus label bab/unit opsional.
- Koleksi Firestore `lms_materi` + path Storage `lms/materi/{kelas}/…`.
- Batas ukuran: PDF/gambar 10 MB, video 50 MB.
- **firestore.rules** dan **storage.rules** (versi lengkap) memuat aturan LMS; deploy dari repo Penilaian / shared rules.

## 0.2.0 — Fase 1a: Daftar ruang kelas + halaman kelas

- Daftar ruang kelas dari penugasan / waliKelas profil guru (`src/lib/kelasLms.ts`).
- Halaman `/kelas` (grid kartu kelas × mapel) dan `/kelas/:ruangId` (tab Pengumuman · Materi · Tugas — skeleton).
- Beranda menampilkan ringkasan ruang kelas yang diampu.
- **Layout lebar penuh** mengikuti pola aplikasi Penilaian (`max-w-[1600px]` untuk `/` dan `/kelas*`) agar tidak muncul ruang kosong kiri-kanan saat zoom-out / layar lebar (lihat ANTIREGRESI §6).

## 0.1.0 — Fase 0: Fondasi

- Inisialisasi proyek Vite + React 19 + TypeScript + Tailwind CSS v4 + Firebase.
- Halaman masuk staf, siswa, dan orang tua; auth shared; login siswa kelas+nama+NISN.

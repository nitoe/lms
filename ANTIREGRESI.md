# ANTIREGRESI — LMS

Catatan agar error yang pernah terjadi (atau berpotensi) tidak terulang.

## 1. Firebase config & .env

- Nilai `.env` **harus sama** dengan Penilaian / Perpustakaan / Sarpras (project `sdm01kukusan-2e735`).
- Jangan commit `.env`. Hanya `.env.example`.

## 2. Peran & rules

- Sumber kebenaran role: `users/{uid}.role` (dari Penilaian).
- Admin Penilaian otomatis admin LMS.
- Field opsional `peranLms` untuk override nanti; jangan biarkan user mengubah sendiri.
- Setiap koleksi `lms_*` baru **wajib** didaftarkan di `firestore.rules` bersama (full file, bukan patch) sebelum dipakai di production.

## 3. Login siswa

- Siswa **tidak** memakai Firebase Auth di Fase 0 (mirip pola Perpustakaan).
- Verifikasi NISN di client + daftar dari koleksi `siswa`. Rules harus mengizinkan list/get `siswa` (sudah `|| true` di rules bersama untuk data dasar).
- Jangan simpan NISN di sessionStorage dalam bentuk plain jika nanti ada fitur sensitif; untuk Fase 0 cukup.

## 4. Shared firestore.rules

- File rules di repo Penilaian adalah sumber utama. Perubahan untuk LMS digabung di sana dan dideploy sekali.
- Selalu berikan **versi lengkap** rules saat update (bukan diff saja).

## 5. Hero & aset

- `public/hero-lms.png` dan `public/logo-sdm.png` wajib ada sebelum deploy (logo bisa disalin dari repo Perpustakaan/Penilaian).

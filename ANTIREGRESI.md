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

## 6. Lebar halaman — ruang kosong kiri/kanan saat zoom-out (regresi berulang)

**Gejala:** Halaman baru memakai `max-w-6xl` (atau lebih sempit) di dalam shell, sehingga di layar lebar / zoom-out muncul strip kosong besar di kiri dan kanan.

**Penyebab:** Konten dibatasi terlalu sempit untuk halaman daftar/dashboard yang seharusnya mengisi viewport.

**Aturan (ikuti pola Penilaian `HALAMAN_LEBAR`):**

- Halaman **daftar / dashboard / grid** (`/`, `/kelas`, dan kelak daftar materi/tugas): shell + konten memakai **`max-w-[1600px]`**.
- Halaman **form ringkas** saja: boleh `max-w-xl` atau `max-w-6xl`.
- Header dan `<main>` harus memakai kelas lebar yang **sama** agar header tidak “melayang” lebih sempit/lebar dari konten.
- Saat menambah rute baru di `Layout.tsx`, masukkan path-nya ke array `HALAMAN_LEBAR` jika itu halaman daftar/grid.

Referensi implementasi: `src/components/Layout.tsx` (LMS) dan `src/components/Layout.tsx` (Penilaian).


## 7. Materi LMS & index Firestore

- Query `lms_materi` memakai `where kelas + mapel` + `orderBy urutan`. Jika muncul error index, buat composite index di Firebase Console (link biasanya ada di pesan error), atau app sudah punya fallback tanpa `orderBy`.
- Nama `mapel` di `lms_materi` harus **sama persis** dengan penugasan / `tp_kktp` (termasuk spasi dan kapitalisasi), supaya `tulisMapelKelas` di rules lolos.
- Jangan mengizinkan klien mengubah `kelas`, `mapel`, atau `dibuatOleh` saat update (dicek di rules).

## 8. Rules bersama (deploy)

- `firestore.rules` dan `storage.rules` di repo LMS adalah salinan lengkap yang sudah digabung dengan aturan Penilaian/Perpustakaan/Sarpras + blok LMS.
- Deploy rules dari satu tempat (biasanya repo Penilaian) agar tidak saling menimpa: `firebase deploy --only firestore:rules,storage`.
- Setelah menambah koleksi `lms_*` baru, selalu kirim **file rules lengkap**, bukan patch saja.

## 9. Siswa membaca data LMS tanpa Firebase Auth

**Gejala:** Halaman Materi siswa menampilkan «Materi belum bisa dibuka» (error Firestore `permission-denied`), padahal guru melihat materi normal.

**Penyebab:** Siswa tidak login Firebase (§3), jadi request dari area siswa memiliki `request.auth == null`. Rules yang mensyaratkan login menolaknya.

**Aturan:**

- Setiap koleksi `lms_*` yang dibaca siswa (saat ini `lms_materi`) butuh `allow read` yang tidak mensyaratkan `request.auth`. `write` tetap hanya untuk guru/admin; jangan membuka `write`.
- Tulis oleh siswa (mis. pengumpulan tugas) **tidak boleh** memakai `allow write: if true`. Rancang pengamanannya terlebih dahulu sebelum koleksinya dibuat.
- Perubahan rules selalu dikirim sebagai file **lengkap** (§4, §8).

## 10. Query area siswa & composite index

- Query siswa hanya memakai satu filter `where kelas ==` (`src/lib/materiSiswa.ts`); pengelompokan per mapel dan pengurutan dilakukan di klien, sehingga tidak butuh composite index.
- Jangan menambah `where mapel` + `orderBy` di sisi siswa tanpa membuat index terlebih dahulu: siswa tidak bisa melihat tautan pembuatan index di konsol, hanya pesan gagal umum. Untuk sisi guru lihat §7.

## 11. Pengurutan TP harus numerik

**Gejala:** «TP 10» tampil sebelum «TP 2».

**Penyebab:** Mengurutkan label teks dengan `localeCompare` tanpa opsi numerik membandingkan karakter «1» dengan «2».

**Aturan:** Urutkan kelompok TP menurut `tpNomor` (angka), bukan menurut label. Pakai helper `kelompokkanMateri` di `src/lib/materiUi.ts`. Catatan: `MateriPanel.tsx` (sisi guru) masih mengurutkan menurut label; samakan saat file itu disentuh berikutnya.

## 12. Jangan memanggil `navigate()` saat render

- Pengalihan karena sesi kosong memakai komponen `<Navigate to="..." replace />` (contoh: `SiswaLayout.tsx`), bukan `navigate()` di badan komponen. Pemanggilan saat render memicu peringatan React dan bisa mengalihkan dua kali.

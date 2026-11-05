# CHANGELOG

## 0.4.1 — Overhaul UI guru tahap 2 (detail kelas + materi)

- **Header ruang kelas:** cover gradien per mapel, badge kelas/wali, judul besar (selaras kartu daftar).
- **Tab** dengan indikator «Segera» pada Tugas.
- **Panel Materi:** toolbar (jumlah + pencarian + aksi File/YouTube/Tautan).
- Form tambah materi dalam kartu putih rapi; daftar TP sebagai listbox modern.
- **Item materi:** ikon jenis berwarna, chip jenis, meta file, aksi Buka/Hapus.
- Empty state dan loading konsisten dengan shell `.lms-empty`.
- Kelas CSS `.kelas-hero*`, `.materi-*`.

## 0.4.0 — Overhaul UI guru tahap 1 (shell LMS modern)

Pola mengacu referensi LMS profesional (sidebar + grid kartu konten), disesuaikan merek SDM 01 Kukusan.

- **Shell guru:** sidebar kiri (menu, avatar, keluar) + topbar + area konten; mobile dengan drawer.
- **Kartu ruang kelas:** cover gradien dekoratif, badge kelas, judul mapel, chip, hover naik — grid responsif 1–4 kolom.
- **Beranda:** hero + statistik, pencarian mapel/kelas, modul status (Materi aktif / Tugas segera / Kuis fase 2).
- **Daftar kelas:** filter chip per kelas + pencarian.
- Komponen baru: `RuangCard`, helper `uiAksen.ts`.
- Kelas CSS `.lms-*` (shell, card, toolbar, module tile).

Tahap berikutnya: detail ruang kelas & panel materi; lalu area siswa dengan bahasa visual yang sama.

## 0.3.3 — Visual guru profesional (beranda & daftar kelas)

- Banner sapaan beranda dengan gradien merek + ringkasan jumlah ruang kelas.
- Kartu ruang kelas: bilah aksen warna per mapel, inisial mapel, hover naik tipis.
- Pintasan fitur dengan ikon SVG (bukan emoji) dan badge status (Segera / Fase 2).
- Navigasi header guru lebih tegas (state aktif).
- Kelas CSS `.guru-*`, `.ruang-card`, `.fitur-tile` di `index.css`.

## 0.3.2 — UI/UX siswa ramah anak + polish beranda guru

- **Area siswa:** beranda dengan sapaan waktu, avatar inisial, dan kartu menu besar berwarna (Materi, Tugas, Kuis, Pencapaian).
- **Navigasi bawah siswa:** ikon + label, target sentuh ≥ 3.5rem, safe-area untuk HP.
- Placeholder ramah anak untuk rute `/siswa/materi`, `/tugas`, `/kuis`, `/pencapaian` agar menu tidak “mati”.
- Gaya khusus `.siswa-*` di `index.css` (kartu, tip, tombol, bottom nav).
- **Beranda guru:** kartu fitur dengan ikon, empty state lebih jelas, hover konsisten dengan daftar kelas.

## 0.3.1 — Perbaikan ruang kelas wali & TP wajib

- Kartu fiktif «Wali kelas» dihapus; materi selalu per **mapel × kelas**.
- Wali tanpa penugasan mapel: daftar diperluas dari master `mapel` (satu kartu per mapel).
- **TP wajib** saat menambah materi (bukan opsional).

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

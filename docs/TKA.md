# TKA (Tes Kemampuan Akademik) — kelas 6

Dimigrasi dari repo `nitoe/tka2026`. **Hanya bank soal yang dimigrasi.** Kuis TKA berjalan di mesin kuis
LMS (`lms_kuis` → Cloud Function `nilaiKuisLms` → `lms_jawaban`) dengan tampilan pengerjaan yang
disempurnakan. Aturan agar tidak regresi: `ANTIREGRESI.md` §76–§77.

## Konsep: TKA = ruang khusus kelas 6

Tidak ada koleksi baru. Tiap kelas 6 punya dua ruang: **TKA Matematika** dan **TKA Bahasa Indonesia**
(kelas 6A/6B/6C × dua mapel). Ruang itu memakai halaman ruang LMS biasa, hanya tab **Bank Soal** dan **Kuis**.

| Data | Tempat |
|---|---|
| Bank soal TKA | `lms_paket_soal` (kelas 6x, mapel «TKA …», status `siap`) |
| Gambar soal | `lms_gambar` |
| Kuis TKA | `lms_kuis` (dibuat dari paket lewat wizard Kuis biasa) |
| Hasil | `lms_jawaban` |

## Siapa boleh apa

| Pihak | Dasar | Akses |
|---|---|---|
| **Guru kelas 6** | `users/{uid}.waliKelas` memuat 6A/6B/6C, role `guru`/`guru_akademik` | Menu TKA; mengelola ruang TKA **kelasnya sendiri** |
| **Akun uji** `arif.azwar79@gmail.com` | pengecualian berdasarkan email (wali kelas 5A, bukan admin) | Menu TKA; mengelola ruang TKA **semua kelas 6** |
| **Siswa kelas 6** | claim `kelas` token `loginSiswaLms` = 6A/6B/6C | Menu TKA di navigasi siswa; hanya kuis TKA kelasnya |
| Lainnya | — | Menu tidak tampil; rules menolak |

Tiga tempat yang HARUS sinkron: `src/lib/tkaAkses.ts` (tampilan), `firestore.rules`
(`tkaEmailKhusus`, `tkaGuruKelas6`, `ruangTka`, `lmsTulisMapelKelas`, `lmsLihatMapelKelas`), dan menu siswa
(`SiswaLayout`). Helper bersama `tulisMapelKelas`/`lihatMapelKelas` (dipakai Penilaian) tidak diubah.

## Migrasi bank soal dari tka2026

Skrip di repo **SDM01Penilaian**: `scripts/migrasi-tka-soal.mjs`.

1. Deploy `firestore.rules` terbaru (`npm run deploy:rules` dari SDM01Penilaian).
2. Siapkan dua kunci service account (jangan di-commit): project `tka2026-sdm01` (sumber) dan `sdm01kukusan-2e735` (tujuan).
3. `cd functions && npm install` (sekali).
4. Uji logika: `node scripts/cek-migrasi-tka-soal.mjs`.
5. **Dry-run** (tidak menulis): `node scripts/migrasi-tka-soal.mjs --source-key=./tka-key.json --target-key=./baru-key.json`
6. Baca ringkasan di layar dan `migrasi-tka-soal-laporan-*.json`: terutama `dilewati` (soal yang kuncinya tak bisa dicocokkan, atau `pgk-cat` bukan 2 kolom) dan `peringatan`.
7. Perbaiki di sumber bila perlu, ulangi dry-run.
8. **Apply**: tambahkan `--apply`.
9. Buka menu **TKA** → pilih ruang → tab Bank Soal. Cek tampilan rumus, bacaan, dan gambar lewat tombol pratinjau.
10. Buat kuis dari paket (tab Kuis), atur durasi/jadwal/token, lalu aktifkan.

Konversi:

| tka2026 | LMS |
|---|---|
| `pg` | `pg` (opsi a, b, c…; kunci dicocokkan dari teks opsi) |
| `pgk` | `pgk`, harus benar semua (`nilaiParsial=false`) |
| `pgk-cat` 2 kolom | `bs` (label kolom kustom → `labelBenar`/`labelSalah`) |
| `pgk-cat` ≠ 2 kolom | dilewati & dilaporkan |
| `stimulus`/`bacaan` | `soal.stimulus` (HTML, boleh tabel) |
| `stimulusImage` (data URL) | `lms_gambar` + `soal.gambarId` |
| `tipeMateri`, `kompleksitas` (L1-…/L2-…/L3-…) | `tipeMateri`, `L1`/`L2`/`L3` |
| `$...$`, `$$...$$` | tetap; `soal.rumus=true` → KaTeX |

Satu paket per (kelas, mapel, tipeMateri); dipecah bila >300 soal atau ±700 KB. Opsi tidak diacak secara
bawaan (`--acak-opsi` untuk mengacak). Skrip aman diulang: paket/gambar yang sudah ada tidak ditimpa
kecuali `--overwrite`.

## Tampilan pengerjaan siswa (menyempurnakan kuis LMS)

`src/pages/siswa/SiswaTka.tsx`: bacaan + soal dua kolom di layar lebar, rumus KaTeX, penanda
ragu-ragu, status «sebagian» (tabel B/S belum lengkap), tinjau sebelum kirim, zoom huruf (A−/A+),
timer berbasis tenggat (tetap berjalan saat keluar) berwarna, kirim otomatis saat waktu habis, ←/→
berpindah soal, rincian hasil per kompleksitas dan materi. Jadwal buka/tutup dan token diperiksa di
klien.

## Mengelola bank soal TKA (editor soal)

Di ruang TKA, editor soal menampilkan blok **Bahan bacaan & pengaturan TKA** (di bawah teks soal):

- **Bahan bacaan / stimulus**: teks biasa (Enter dua kali = paragraf baru) atau HTML sederhana, termasuk
  `<table>`. Pratinjau tampil di bawahnya. Memakai kotak teks (bukan editor kaya) supaya tabel tidak hilang.
- **Materi**: kategori untuk analisis (mis. Bilangan; Pemahaman Tekstual / Inferensial / Evaluasi dan Apresiasi).
- **Tampilkan rumus**: `$x^2$` sebaris, `$$…$$` blok. Aktif otomatis untuk soal baru di ruang TKA.
- **Label kolom** (soal Benar/Salah): mis. «Fakta» / «Opini».

Blok ini juga muncul pada soal di ruang lain bila soal itu sudah memuat field TKA. Mengganti tipe soal
(mis. PG → PG Kompleks) tidak lagi menghapus bacaan, materi, dan rumus.

## Batasan yang perlu diketahui

- Token dan jadwal kuis diperiksa **di klien** (token ikut terbaca dari dokumen kuis). `nilaiKuisLms`
  belum menegakkan jadwal/token/batas percobaan. Bila TKA dipakai sebagai ujian berisiko tinggi, tambahkan
  penegakan di Cloud Function.
- Kuis LMS menyimpan snapshot soal **beserta kunci** di dokumen kuis yang dibaca siswa (pola yang sudah
  ada, ANTIREGRESI §73). Dengan TKA ini sama saja.
- Penilaian manual (`uraian`) tidak dipakai TKA. Fitur nilai manual di Cloud Function berbasis penugasan,
  jadi tidak mencakup ruang TKA.
- Soal `pgk-cat` dengan lebih dari 2 kolom belum didukung.

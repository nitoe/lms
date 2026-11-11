# TKA (Tes Kemampuan Akademik) — kelas 6

Dimigrasi dari repo `nitoe/tka2026`. **Hanya bank soal yang dimigrasi.** Kuis TKA berjalan di mesin kuis
LMS (`lms_kuis` → Cloud Function `nilaiKuisLms` → `lms_jawaban`) dengan tampilan pengerjaan yang
disempurnakan. Aturan agar tidak regresi: `ANTIREGRESI.md` §76–§77 dan **§85**.

## Konsep: TKA = bank bersama kelas 6

Tidak ada koleksi baru. Bank soal TKA disimpan dengan **kelas kanonik `6`** (berlaku untuk 6A dan 6B)
dan tiga mapel: **TKA Matematika**, **TKA Bahasa Indonesia**, **TKA IPA**. Dashboard guru menampilkan
tiga kontainer mapel — tanpa pemisahan per rombel dan tanpa 6C.

| Data | Tempat |
|---|---|
| Bank soal TKA | `lms_paket_soal` (kelas `6`, mapel «TKA …», status `siap`) |
| Gambar soal | `lms_gambar` |
| Kuis TKA | `lms_kuis` (kelas `6` atau rombel 6A/6B; dibuat dari paket lewat wizard Kuis) |
| Hasil | `lms_jawaban` |
| Rekap TO | `lms_rekap_tka` |

### Materi (pengganti TP)

| Mapel | Materi tetap |
|---|---|
| TKA Matematika | Bilangan · Geometri dan Pengukuran · Data |
| TKA Bahasa Indonesia | Pemahaman Tekstual · Pemahaman Inferensial · Evaluasi dan Apresiasi |
| TKA IPA | Sistem Organ Manusia · Ekosistem dan Lingkungan · Gelombang Bunyi dan Cahaya · Energi Alternatif · Bumi dan Antariksa |

Soal TKA mengukur **keterampilan proses** pada materi di atas, bukan hapalan semata.

### Bentuk soal TKA

Hanya tiga: **pilihan ganda (pg)**, **pilihan ganda kompleks (pgk)**, **benar/salah–kategori (bs)**
dengan label kolom kustom (Sesuai/Tidak sesuai, Relevan/Tidak relevan, dll.). PGK dan BS: maksimal
4 pernyataan/opsi; biasanya 2 yang benar/sesuai.

## Siapa boleh apa

| Pihak | Dasar | Akses |
|---|---|---|
| **Guru kelas 6** | `users/{uid}.waliKelas` memuat 6A atau 6B, role `guru`/`guru_akademik` | Menu TKA; mengelola **bank bersama** ketiga mapel |
| **Akun uji** `arif.azwar79@gmail.com` | pengecualian berdasarkan email (wali kelas 5A, bukan admin) | Menu TKA; akses uji bank bersama |
| **Siswa kelas 6** | claim `kelas` token `loginSiswaLms` = 6A/6B | Menu TKA; kuis aktif kelasnya atau kelas `6` mapel TKA |
| Lainnya | — | Menu tidak tampil; rules menolak |

Tiga tempat yang HARUS sinkron: `src/lib/tkaAkses.ts` (tampilan), `firestore.rules`
(`tkaEmailKhusus`, `tkaGuruKelas6Any`, `ruangTka`, `mapelTka`, `lmsTulisMapelKelas`, `lmsLihatMapelKelas`), dan menu siswa
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


### Rekap Nilai Try Out TKA

Halaman **Dashboard TKA → Rekap Nilai Try Out** (`/tka/rekap`).

| Aspek | Keterangan |
|---|---|
| Akses | Wali **6A** hanya siswa 6A; wali **6B** hanya 6B. Email khusus TKA (`arif.azwar79@gmail.com`, termasuk jika wali 5A) melihat **6A+6B** |
| Dimensi | Tahap Try Out I–V × mapel TKA (BI, Matematika, IPA) × siswa |
| Otomatis | Skor dari `lms_jawaban` pada kuis `lms_kuis` dengan `tahapTryOutTka` cocok (skala 0–100; jika beberapa kuis: skor tertinggi) |
| Manual | Override di `lms_rekap_tka/{kelas}_{tahap}_{siswaId}` — untuk try out di luar LMS |
| Prioritas | Nilai **manual** mengalahkan otomatis; hapus override = kembali ke LMS/kosong |

Pastikan setiap kuis TKA yang dipakai try out sudah diisi **Tahap Try Out** di Atur kuis.


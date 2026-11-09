# TKA (Tes Kemampuan Akademik) — modul kelas 6

Dimigrasi dari repo `nitoe/tka2026` (project Firebase `tka2026-sdm01`) ke LMS (`sdm01kukusan-2e735`).
Catatan aturan agar tidak regresi: `ANTIREGRESI.md` §76.

## Siapa boleh apa

| Pihak | Dasar | Akses |
|---|---|---|
| **Admin TKA** (pembuat aplikasi) | UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1` + email `arif.azwar79@gmail.com` | Semua: impor/hapus soal, hapus paket, lihat semua kelas 6 |
| **Guru kelas 6** | `users/{uid}.waliKelas` memuat 6A/6B/6C, role `guru`/`guru_akademik` | Menu TKA, lihat bank soal, edit soal, susun paket, lihat hasil kelas 6 (kedua/ketiga kelas) |
| **Siswa kelas 6** | claim `kelas` token `loginSiswaLms` = 6A/6B/6C | Menu TKA di navigasi siswa, paket aktif, hasil miliknya |
| Lainnya | — | Menu tidak tampil; rules menolak |

Tiga tempat yang HARUS sinkron: `src/lib/tkaAkses.ts` (tampilan), `firestore.rules` (fungsi `tkaAdmin`, `tkaGuruKelas6`, `tkaStaf`, `tkaSiswa`), dan Cloud Function TKA (Tahap 2).

## Koleksi

| Koleksi | Isi | Baca | Tulis |
|---|---|---|---|
| `tka_soal` | bank soal + kunci | staf TKA | admin (buat/hapus), staf (edit) |
| `tka_paket` | paket latihan/try out (tanpa token) | staf; siswa kelas 6 hanya `aktif == true` | staf (hapus: admin) |
| `tka_token` | token try out per paket | staf | staf |
| `tka_percobaan` | hasil pengerjaan | staf; siswa miliknya | Cloud Function / skrip migrasi; hapus (reset): staf |
| `tka_sesi_live` | pemantauan langsung | staf | siswa (dokumen sendiri) |

Tipe data ada di `src/types/tka.ts`.

## Migrasi data dari tka2026

Skrip ada di repo **SDM01Penilaian**: `scripts/migrasi-tka.mjs`.

1. Deploy `firestore.rules` terbaru (`npm run deploy:rules` dari SDM01Penilaian).
2. Siapkan dua kunci service account (jangan di-commit): project `tka2026-sdm01` (sumber) dan `sdm01kukusan-2e735` (tujuan).
3. `cd functions && npm install` (sekali).
4. Uji logika: `node scripts/cek-migrasi-tka.mjs`.
5. **Dry-run** (tidak menulis): `node scripts/migrasi-tka.mjs --source-key=./tka-key.json --target-key=./baru-key.json`
6. Baca ringkasan di layar dan file `migrasi-tka-laporan-*.json`: terutama `pemetaanSiswa.tidakCocok`, `ambigu`, `namaBeda`, dan `percobaanDilewati`.
7. Perbaiki data siswa bila perlu (mis. NISN/nama kelas 6 di koleksi `siswa`), ulangi dry-run.
8. **Apply**: tambahkan `--apply`.
9. Buka menu **TKA** di LMS: kartu Soal/Paket/Hasil menampilkan jumlah dokumen.

Pemetaan:

| tka2026 | LMS | Catatan |
|---|---|---|
| `questionPool` | `tka_soal` | ID tetap; `sekolahId`, `kunciHash` dibuang |
| `packages` | `tka_paket` + `tka_token` | `token` dipisah; paket menyimpan `butuhToken`; `aktif` hanya `true` bila memang `true` |
| `attempts` | `tka_percobaan` | `studentId` → `siswaId` (NISN, lalu nama+kelas); percobaan tak terpetakan tidak ditulis |
| `students`, `staff`, `loginRoster`, `sekolah`, `subjects`, `soalPublik`, `liveSessions` | — | digantikan LMS / tidak diperlukan |
| `pengajuanPaket`, `notifikasi` | — | dibawa di Tahap 3 |

Skrip aman diulang: dokumen yang sudah ada tidak ditimpa kecuali `--overwrite`.

## Tahapan

1. **Tahap 1 (ini):** menu TKA guru + siswa, penjaga akses, tipe data, rules, skrip migrasi.
2. **Tahap 2:** pengerjaan siswa — Cloud Function `mulaiTkaLms` (cek token, jendela waktu, batas percobaan, kelas 6; kirim soal tanpa kunci) dan `kirimTkaLms` (nilai di server); timer, autosave, KaTeX.
3. **Tahap 3:** bank soal (impor Excel/JSON) dan susun paket; alur pengajuan try out; rules tulis diperketat.
4. **Tahap 4:** monitor langsung, rekap per kelas, analisis, regresi, perbandingan paket, PDF.

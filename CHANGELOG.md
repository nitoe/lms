# CHANGELOG (cuplikan — append di BAWAH)

## 2026-11-10 — generateSoalLmsAi.js versi lengkap (fix model + TKA ilustrasi)

- File lengkap `functions/generateSoalLmsAi.js` (bukan patch).
- Hapus ketergantungan `@google/generative-ai`; semua lewat fetch REST.
- Model gambar: fallback `gemini-2.5-flash-image` → `gemini-3.1-flash-image` → `gemini-3-pro-image` → `gemini-nano-banana-2.1` (mengganti model preview yang sudah dihapus API).
- Ilustrasi TKA: petunjuk guru prioritas mutlak; larangan diagram ilmiah/anatomi kecuali diminta; multi-panel + caption.
- Ilustrasi non-TKA: tetap gaya diagram/fungsional.
- Generate soal teks tetap diekspor (`generateSoalLmsDenganAi`).
- ANTIREGRESI §67, §87.

## 2026-11-11 — TKA: filter bentuk soal di rancang kuis hanya PG / PGK / BS

- **Masalah:** di wizard rancang kuis (`KuisPanel`), filter «Bentuk soal» masih menampilkan semua tipe mapel (menjodohkan, isian, uraian) meskipun ruang TKA.
- **Perbaikan (hanya TKA):**
  - Tombol filter bentuk memakai `TIPE_SOAL_TKA` (`pg`, `pgk`, `bs`) bila `adalahMapelTka(mapel)`.
  - Jika user tidak memilih bentuk apa pun di TKA, penyusunan otomatis membatasi kandidat ke ketiga tipe tersebut (bukan seluruh `URUTAN_TIPE`).
  - Pengelompokan pratinjau & urutan menurut bentuk mengikuti daftar yang sama.
- Mapel biasa **tidak berubah** (masih `URUTAN_TIPE` penuh).
- File: `src/components/KuisPanel.tsx`.
- ANTIREGRESI §88.

## 2026-11-11 — Bank soal: tempel gambar (clipboard) + salin antar soal

- **GambarPicker** mendukung:
  - Tempel gambar lewat **Ctrl+V / ⌘V** pada area gambar (atau tombol **Tempel gambar**).
  - Seret-lepas file gambar ke area yang sama.
  - **Salin gambar** (ikon ⧉) pada gambar yang sudah ada → clipboard sistem, lalu tempel ke soal lain tanpa file sumber.
- Alur unggah file dan generate AI **tidak diubah**.
- `lib/gambar.ts`: `unggahGambar`/`kompresGambar` menerima Blob; helper clipboard (`ambilGambarDariDataTransfer`, `ambilGambarDariClipboardApi`, `salinDataUrlKeClipboard`).
- File: `src/lib/gambar.ts`, `src/components/soal/GambarSoal.tsx`, `src/styles/soal.css`.
- ANTIREGRESI §89.

## 2026-11-11 — Rancang kuis manual: pratinjau soal lengkap (daftar + panel)

- **Masalah:** mode «Pilih manual» hanya menampilkan cuplikan ±100 karakter — stimulus, gambar, opsi, dan kunci tidak terlihat, menyulitkan pemilihan (khususnya TKA).
- **Perbaikan UX:** layout master–detail di dalam konten wizard (bukan sidebar menu utama):
  - Kiri: daftar soal dengan centang, badge tipe/kompleksitas/materi/media, pencarian, filter bentuk.
  - Kanan: pratinjau penuh (stimulus, gambar, teks, opsi lewat `SoalTampil`) + ringkas kunci guru + tombol Pilih/Keluarkan.
- Berlaku untuk TKA dan mapel biasa; filter bentuk tetap menghormati `TIPE_SOAL_TKA` di ruang TKA.
- File: `src/components/soal/PilihSoalManual.tsx` (baru), `src/components/KuisPanel.tsx`, `src/styles/soal.css`.
- ANTIREGRESI §90.

## 2026-11-11 — Fix build: KuisDetail JSX `{!isTka && (…)}`

- Perbaiki sintaks JSX di blok penutup «Penilaian & TP» (komentar di antara `(` dan `<section>` memecah parse TS).
- Perilaku sama: blok hanya untuk mapel non-TKA.
- File: `src/components/KuisDetail.tsx`.

## 2026-11-11 — Rules: hapus helper TKA tidak terpakai (tkaGuruKelas6)

- Hilangkan peringatan compile `Unused function: tkaGuruKelas6`.
- Akses TKA tetap lewat `tkaWaliKelas6Any` + `ruangTka` (wali 6A/6B, kelas 6/6A/6B, mapel TKA termasuk IPA) + `match /lms_jawaban`.
- File shared: `firestore.rules` (lengkap → SDM01Penilaian / sdm01kks).

## 2026-11-11 — Laporan hasil siswa TKA (roster + filter kelas + tanpa AI)

- **Laporan hasil TKA berbeda dari kuis mapel:**
  - Roster siswa kelas yang diizinkan **selalu tampil** (nilai kosong bila belum mengerjakan).
  - Admin TKA (`arif.azwar79@gmail.com`) melihat 6A+6B dengan **filter kelas**.
  - Wali 6A hanya 6A; wali 6B hanya 6B (`kelasHasilTkaBolehDilihat`).
  - Query jawaban multi-rombel: `daftarJawabanKuisMultiKelas`.
  - Analisis AI isian/uraian **disembunyikan** untuk TKA (soal otomatis).
  - Tidak ada sinkron ke rapor akademik.
- Mapel non-TKA: perilaku hasil kuis **tidak berubah**.
- File: `src/lib/tkaAkses.ts`, `src/lib/jawabanKuis.ts`, `src/components/HasilKuisPanel.tsx`.
- ANTIREGRESI §92.

## 2026-11-11 — Domain penilaian TKA IPA (tag manual di editor soal)

- Field opsional `domainTka` pada soal: **hanya** `pengetahuan` | `keterampilan_proses` (tanpa campuran).
- Guru memutuskan kecenderungan dominan soal; nilai lama `campuran` diabaikan saat baca.
- UI di **Bahan bacaan & pengaturan TKA** (khusus mapel TKA IPA, atau soal yang sudah bertag).
- Label: Pengetahuan IPA · Keterampilan Proses Sains.
- Badge domain di panel pilih soal manual (rancang kuis).
- Belum ada usulan AI paket dan belum memecah skor di laporan hasil — langkah berikutnya.
- Mapel non-TKA tidak berubah.
- File: `src/types/soal.ts`, `src/components/soal/TkaFieldEditor.tsx`, `src/components/soal/PilihSoalManual.tsx`.
- ANTIREGRESI §93.

## 2026-11-11 — TKA: perbaikan build domain + laporan hasil siswa per domain

- **Perbaikan build:** import `normalisasiDomainTka`, `NAMA_DOMAIN_TKA`, `URUTAN_DOMAIN_TKA`, `DESKRIPSI_DOMAIN_TKA`, `DomainTka` ditambahkan di `TkaFieldEditor.tsx` dan `PilihSoalManual.tsx` (sebelumnya dipakai tanpa import → TS2304).
- **Laporan hasil TKA:** di tab Hasil siswa, bila soal memiliki domain penilaian (`pengetahuan` / `keterampilan_proses`), kolom tambahan menampilkan persentase skor per domain (hanya TKA; mapel biasa tidak berubah).
- Roster, filter kelas, dan mekanisme nilai total tetap sama. Tidak ada perubahan pada kuis mapel biasa atau sinkron ke Penilaian.
- File: `src/components/soal/TkaFieldEditor.tsx`, `src/components/soal/PilihSoalManual.tsx`, `src/components/HasilKuisPanel.tsx`.
- ANTIREGRESI §94.

## 2026-11-11 — Fix TS2304 soalIds + laporan TKA domain (rata kelas & detail)

- **Build:** restore `const soalIds = useMemo(() => (kuis.soal ?? []).map((s) => s.id), [kuis.soal])` di `HasilKuisPanel` (terhapus saat kolom domain → TS2304).
- **Laporan TKA (hanya `adalahMapelTka`):**
  - Kartu rata-rata skor per domain di atas tabel (dari siswa yang sudah mengerjakan).
  - Badge domain di header detail siswa + di setiap baris soal.
  - Kolom domain di tabel roster tetap seperti sebelumnya.
- Mapel non-TKA: tidak ada kartu/badge/kolom domain; agregat per soal tetap memakai `soalIds`.
- File: `src/components/HasilKuisPanel.tsx`.
- ANTIREGRESI §94, §95. Lihat juga `RESTORE_HASIL_KUIS.md` jika file sempat terpotong di remote.

## 2026-11-11 — TKA: publikasi hasil ke siswa

- **Masalah:** setelah submit kuis TKA, siswa langsung melihat skor (sama seperti latihan mapel). Untuk try-out/ujian TKA, skor sebaiknya hanya tampil setelah guru mempublikasikan.
- **Perilaku baru (hanya TKA):**
  - Field `lms_kuis.hasilDipublish` (boolean). Default kosong/false = skor disembunyikan dari siswa.
  - Tab **Hasil** guru: banner status + tombol «Publikasikan hasil ke siswa» / «Sembunyikan dari siswa».
  - Siswa (`SiswaTka`): daftar menampilkan «nilai belum dipublikasikan»; layar pasca-submit tanpa angka skor/rincian sampai dipublish.
  - Mapel non-TKA **tidak berubah** (skor tetap langsung tampil).
- Juga: `HasilKuisPanel.tsx` dikembalikan ke versi utuh (file di `main` sempat terpotong) + kontrol publikasi.
- File: `src/types/kuis.ts`, `src/lib/kuis.ts`, `src/components/HasilKuisPanel.tsx`, `src/components/KuisPanel.tsx`, `src/pages/siswa/SiswaTka.tsx`.
- ANTIREGRESI §96.

## 2026-11-11 — TKA: reset attempt siswa di laporan hasil

- **Masalah:** jika siswa submit terlalu cepat / sebelum selesai, tidak ada cara guru mereset attempt agar siswa bisa mengerjakan ulang.
- **Solusi (hanya TKA):**
  - Cloud Function `resetJawabanKuisLms` (repo SDM01Penilaian): hapus semua `lms_jawaban` untuk pasangan `kuisId` + `siswaId`.
  - Izin: admin, email khusus TKA, atau wali 6A/6B untuk rombel siswa. Mapel non-TKA ditolak di server.
  - UI tab Hasil TKA: tombol **Reset** per baris roster + di detail siswa (konfirmasi wajib).
- Mapel biasa tidak punya tombol reset (ANTIREGRESI §97).
- File LMS: `src/lib/jawabanKuis.ts`, `src/components/HasilKuisPanel.tsx`, CHANGELOG, ANTIREGRESI.
- File SDM01Penilaian: `functions/resetJawabanKuisLms.js`, `functions/index.js` (lengkap).
- Deploy CF: `firebase deploy --only functions:resetJawabanKuisLms` dari SDM01Penilaian.
- ANTIREGRESI §97.

## 2026-11-11 — TKA laporan: 3 kolom nilai domain + deteksi domain AI + fix soalIds

- **Build:** `soalIds` hilang di `HasilKuisPanel` → TS2304 (terjadi berulang setelah restore file terpotong). Dipulihkan + dicatat §98.
- **Laporan hasil TKA (beda dari kuis mapel):**
  - Checkbox «Hanya percobaan terbaru» disembunyikan; TKA selalu ringkas 1 attempt per siswa.
  - Kolom **Perc.** dihapus dari tabel TKA.
  - Kolom nilai diganti tiga kolom tetap: **Pengetahuan** (IPA), **Keterampilan Proses** (Sains), **Nilai Akhir** = rata-rata kedua domain (yang punya soal).
- **Domain soal:** field `domainTka` (`pengetahuan` | `keterampilan_proses`, tanpa campuran). Soal tanpa label → kolom «—» + banner peringatan.
- **AI klasifikasi domain:** CF `klasifikasiDomainTkaLmsAi` (akun AI) + tombol «Deteksi domain AI» di tab Hasil; menyimpan label ke snapshot `lms_kuis.soal`.
- Mapel non-TKA tidak berubah.
- File LMS: `HasilKuisPanel.tsx`, `domainTkaAi.ts` (baru).
- File SDM01Penilaian: `functions/klasifikasiDomainTkaLmsAi.js`, `functions/index.js`.
- ANTIREGRESI §98.

## 2026-11-11 — Fix build HasilKuisPanel: hapus NAMA_DOMAIN_TKA & domainYangAda tak terpakai

- TS6133: impor `NAMA_DOMAIN_TKA` dan variabel `domainYangAda` tidak dipakai setelah kolom domain diganti header tetap.
- Kolom Pengetahuan / Keterampilan Proses / Nilai Akhir tetap; logika skor tidak berubah.
- File: `src/components/HasilKuisPanel.tsx`.

## 2026-11-11 — Deteksi domain AI dipindah ke tab Atur kuis

- Tombol/banner **Deteksi domain AI** dihapus dari tab **Hasil siswa** (`HasilKuisPanel`).
- Dipindah ke tab **Atur kuis** (`KuisDetail`): ringkasan jumlah soal per domain + tombol deteksi (akun AI).
- Badge domain per soal di daftar soal Atur kuis (Pengetahuan / Keterampilan proses / Domain belum).
- Perbaikan regresi: panel Analisis AI siswa di Hasil kembali memakai `bolehAi` (bukan `bolehDomainAi`).
- File: `KuisDetail.tsx`, `HasilKuisPanel.tsx`. ANTIREGRESI §98.7.

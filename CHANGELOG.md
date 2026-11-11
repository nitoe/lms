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

## 2026-11-11 — TKA: sembunyikan Penilaian & TP + perbaiki baca hasil (lms_jawaban)

- **Pengaturan kuis TKA:** blok «Penilaian & TP» (jenis SLM/STS/SAS + daftar TP rapor) disembunyikan. Nilai TKA tetap di `lms_jawaban`, terpisah dari rapor/Penilaian. Simpan TKA memaksa `jenisPenilaian: latihan` tanpa TP.
- Mapel biasa **tidak berubah**.
- **Hasil siswa gagal dibaca:** `match /lms_jawaban` hilang di rules (default deny) + helper TKA belum mengakui kelas kanonik `6` / mapel `TKA IPA` / wali 6A|6B untuk bank bersama.
- **Rules (file lengkap → SDM01Penilaian):**
  - `mapelTka` + `TKA IPA`; `tkaKelas6` = `6`/`6A`/`6B`; `tkaWaliKelas6Any` + `ruangTka` selaras `tkaAkses.ts`.
  - `match /lms_jawaban`: baca guru `lmsLihatMapelKelas` atau siswa milik sendiri; tulis hanya Admin SDK.
- File LMS: `src/components/KuisDetail.tsx`.
- File shared: `firestore.rules` (lengkap).
- ANTIREGRESI §91.


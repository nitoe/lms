# Panduan AI untuk Membuat Bank Soal LMS (Versi Ketat)
**SD Muhammadiyah 01 Kukusan — Bank Soal**

Dokumen ini adalah panduan ketat bagi AI agar menghasilkan soal yang **lengkap dan siap dipakai**.

## 1. Aturan Mutlak per Tipe Soal

### Pilihan Ganda (`pg`)
- Minimal 4 opsi.
- Tepat satu jawaban benar.

### Pilihan Ganda Kompleks (`pgk`)
- Maksimal 4 opsi (untuk SD).
- Idealnya tepat 2 jawaban benar.
- Jangan membuat hampir semua opsi benar.

### Isian (`isian`)
- Wajib memiliki minimal satu kunci jawaban.

### Menjodohkan (`jodoh`)
- Wajib memiliki minimal 2 pasangan lengkap.

### Benar/Salah (`bs`)
- Wajib memiliki minimal 1 pernyataan dengan status benar/salah.

### Umum
- Setiap soal wajib memiliki pembahasan.
- Hindari soal yang secara esensial sama.

## 2. Stimulus Visual
Jika soal membutuhkan gambar, buat file prompt gambar terpisah dan hubungkan dengan `idGambarReferensi`.

## 3. Format Output
Hasilkan dua file: `soal.json` dan `prompt-gambar.json`.

**Versi:** 2026-11-08 (ketat)

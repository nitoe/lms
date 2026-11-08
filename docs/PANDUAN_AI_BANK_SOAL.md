# Panduan AI untuk Membuat Bank Soal LMS (Versi Ketat)
**SD Muhammadiyah 01 Kukusan — Bank Soal**

Dokumen ini adalah panduan ketat bagi AI agar menghasilkan soal yang **lengkap, sesuai untuk siswa SD, dan siap diimpor**.

---

## 1. Aturan Mutlak per Tipe Soal

### Pilihan Ganda (`pg`)
- Minimal 4 opsi, maksimal 5.
- Tepat **satu** jawaban benar.
- Kunci harus cocok dengan salah satu opsi.

### Pilihan Ganda Kompleks (`pgk`) — Aturan Khusus SD
- **Maksimal 4 opsi**.
- Idealnya **tepat 2 jawaban benar**.
- Jangan membuat hampir semua opsi benar.
- **Wajib** menuliskan di teks soal berapa jawaban yang benar.  
  Contoh: “Pilih **dua** jawaban yang benar.”
- Jangan membuat lebih dari 2 jawaban benar.

### Isian (`isian`)
- **Wajib** memiliki minimal satu kunci jawaban.
- Bisa lebih dari satu variasi jawaban yang diterima.

### Menjodohkan (`jodoh`)
- **Wajib** memiliki minimal 2 pasangan (kiri–kanan) yang lengkap.

### Benar/Salah (`bs`)
- **Wajib** memiliki minimal 1 pernyataan dengan status benar/salah.
- Idealnya 3–4 pernyataan.

### Uraian (`uraian`)
- Disarankan memiliki kunci jawaban / pedoman penskoran.

### Umum
- **Setiap soal wajib memiliki pembahasan.**
- Hindari soal yang secara esensial sama (hanya beda narasi).
- Satu paket = satu TP.
- Gunakan bahasa yang sesuai untuk siswa SD.

---

## 2. Stimulus Visual

Jika soal membutuhkan gambar, diagram, tabel, atau grafik:
- Tandai `butuhGambar: true`
- Beri `idGambarReferensi` unik
- Buat file prompt gambar **terpisah**

---

## 3. Format Output

Hasilkan **dua file**:

1. `soal.json` — soal lengkap dengan semua field wajib terisi
2. `prompt-gambar.json` — prompt untuk soal yang butuh visual

---

## 4. Contoh Permintaan ke AI

```
Buatkan 30 soal untuk TP [nama TP] (Matematika kelas 4).

Aturan ketat:
- PG kompleks maksimal 4 opsi dan tepat 2 jawaban benar
- Tuliskan di soal “Pilih dua jawaban yang benar”
- Setiap soal isian harus punya kunci
- Setiap soal menjodohkan harus punya pasangan lengkap
- Setiap soal benar/salah harus punya pernyataan
- Semua soal harus punya pembahasan
- Sertakan file prompt gambar terpisah untuk soal yang butuh visual
```

---

## 5. Checklist Sebelum Menyerahkan

- [ ] PG kompleks tidak lebih dari 4 opsi
- [ ] PG kompleks tepat 2 jawaban benar
- [ ] Teks soal PG kompleks menyebutkan jumlah jawaban yang benar
- [ ] Semua soal isian, jodoh, dan bs lengkap
- [ ] Semua soal memiliki pembahasan
- [ ] File prompt gambar terpisah sudah dibuat (jika ada soal yang butuh visual)

---

**Versi:** 2026-11-08 (ketat — aturan PG kompleks untuk SD)

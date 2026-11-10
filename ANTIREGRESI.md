# ANTIREGRESI (cuplikan — append di BAWAH)

## §87. Generate ilustrasi AI TKA (revisi model 2026-11-10)

87.1 Cabang mapel diawali "TKA " terpisah di `susunPromptIlustrasiSoal`. Petunjuk guru prioritas mutlak.

87.2 Jangan memakai model `gemini-2.0-flash-preview-image-generation` (sudah tidak tersedia). Gunakan daftar fallback di `MODEL_GAMBAR_CANDIDATES`.

87.3 Jangan impor `@google/generative-ai` di functions (tidak ada di package.json). Pakai fetch REST.

87.4 Non-TKA tetap diagram/fungsional. Jangan menyamakan prompt TKA ke path mapel biasa.

87.5 File `generateSoalLmsAi.js` selalu diganti utuh (bukan patch potongan) agar export dan helper konsisten.

## §88. Rancang kuis TKA — filter bentuk soal

88.1 Di wizard rancang kuis (`KuisPanel`), filter «Bentuk soal» untuk mapel TKA **hanya** menampilkan `pg`, `pgk`, `bs` (`TIPE_SOAL_TKA` dari `tkaAkses.ts`). Jangan memakai `URUTAN_TIPE` penuh di ruang TKA.

88.2 Jika user tidak memilih bentuk apa pun, penyusunan otomatis TKA tetap membatasi ke `TIPE_SOAL_TKA` (bukan «semua tipe mapel»). Mapel non-TKA: kosong = semua tipe seperti sebelumnya.

88.3 Perubahan filter bentuk soal di rancang kuis **hanya** boleh dikondisikan dengan `adalahMapelTka(mapel)`. Jangan mengubah perilaku default mapel biasa.

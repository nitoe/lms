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

## §89. Tempel / salin gambar bank soal

89.1 Penyediaan gambar soal: unggah file, generate AI, **dan** tempel dari clipboard. Jangan menghapus salah satu jalur.

89.2 Paste hanya memproses item `image/*` di clipboard/dataTransfer. Jangan `preventDefault` paste global di halaman editor teks — hanya di zona `GambarPicker` saat clipboard berisi gambar.

89.3 Salin gambar memakai data URL dari `lms_gambar` → `ClipboardItem` (bukan URL Storage eksternal). Tempel menghasilkan dokumen `lms_gambar` baru (bukan berbagi ID) agar soal tidak saling terikat bila salah satu dihapus.

89.4 Batas kompresi tetap sama (sisi ≤ 1024 px, data URL ≤ sasaran karakter Firestore). Clipboard melewati `unggahGambar` yang sama.

## §90. Pemilihan soal manual (rancang kuis)

90.1 Mode manual **wajib** menampilkan pratinjau soal lengkap (teks, stimulus, gambar, opsi) saat memilih — jangan kembali ke daftar cuplikan satu baris saja.

90.2 Layout master–detail berada di area konten wizard kuis, **bukan** mengganti atau bercampur dengan sidebar navigasi utama aplikasi.

90.3 Komponen pratinjau memakai `SoalTampil` / `StimulusSoal` / `GambarSoal` yang sama dengan tampilan siswa agar tidak ada perbedaan format.

90.4 Filter bentuk di panel pilih manual mengikuti `tipePilihan` dari pemanggil (TKA: `TIPE_SOAL_TKA`; mapel: `URUTAN_TIPE`).


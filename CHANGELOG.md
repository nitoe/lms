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

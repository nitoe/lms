# CHANGELOG (cuplikan — append di BAWAH)

## 2026-11-10 — generateSoalLmsAi.js versi lengkap (fix model + TKA ilustrasi)

- File lengkap `functions/generateSoalLmsAi.js` (bukan patch).
- Hapus ketergantungan `@google/generative-ai`; semua lewat fetch REST.
- Model gambar: fallback `gemini-2.5-flash-image` → `gemini-3.1-flash-image` → `gemini-3-pro-image` → `gemini-nano-banana-2.1` (mengganti model preview yang sudah dihapus API).
- Ilustrasi TKA: petunjuk guru prioritas mutlak; larangan diagram ilmiah/anatomi kecuali diminta; multi-panel + caption.
- Ilustrasi non-TKA: tetap gaya diagram/fungsional.
- Generate soal teks tetap diekspor (`generateSoalLmsDenganAi`).
- ANTIREGRESI §67, §87.

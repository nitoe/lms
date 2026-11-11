## 2026-11-11 — TKA hanya 1× pengerjaan (UI + server)

- Layar setelah submit: hilangkan «percobaan ke-N» dan tombol «Kerjakan lagi dari awal».
- Kartu daftar TKA: status «Sudah dikerjakan» tanpa hitungan ulang; tidak ada opsi kerjakan lagi.
- CF `nilaiKuisLms`: tolak submit ke-2 untuk mapel TKA (reset hanya lewat guru / `resetJawabanKuisLms`).
- File: `src/pages/siswa/SiswaTka.tsx`, `SDM01Penilaian/functions/nilaiKuisLms.js`.
- ANTIREGRESI §99.11

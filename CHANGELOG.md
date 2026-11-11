## 2026-11-11 — Fix submit TKA: «Kuis bukan untuk kelasmu» [403]

- **Penyebab:** CF `nilaiKuisLms` membandingkan ketat `kuis.kelas === token.kelas`.
  Bank TKA memakai `kelas: "6"` sedangkan siswa `6A`/`6B` → selalu 403.
- **Bukan** karena pembuat = admin TKA / wali 5A (`dibuatOleh` tidak dicek).
- **Perbaikan:** siswa 6A/6B boleh mengerjakan kuis mapel TKA dengan `kelas` dokumen `"6"`.
- Dokumen `lms_jawaban.kelas` menyimpan **rombel siswa** (6A/6B), bukan `"6"`, agar roster hasil TKA benar.
- File: `SDM01Penilaian/functions/nilaiKuisLms.js` (versi lengkap). Deploy: `firebase deploy --only functions:nilaiKuisLms`
- ANTIREGRESI §99.10

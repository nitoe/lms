## §99.10 Submit TKA — kelas bank «6» vs rombel siswa

CF `nilaiKuisLms` **tidak** boleh menolak siswa hanya karena `kuis.kelas !== token.kelas` bila:
- `mapel` ∈ {TKA Matematika, TKA Bahasa Indonesia, TKA IPA}, dan
- `kuis.kelas === '6'`, dan
- `token.kelas` ∈ {6A, 6B}.

Pembuat kuis (admin TKA / wali kelas lain) tidak relevan.

Saat siswa submit, field `lms_jawaban.kelas` = **rombel token siswa** (bukan kelas bank «6»), supaya filter hasil per 6A/6B di panel guru benar.

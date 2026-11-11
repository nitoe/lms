## §99.11 TKA satu kali pengerjaan

- UI siswa TKA **tidak** menampilkan «Kerjakan lagi» / nomor percobaan, terlepas dari `jenisPenilaian`.
- CF `nilaiKuisLms`: jika mapel TKA dan sudah ada dokumen `lms_jawaban` untuk pasangan kuisId+siswaId → `failed-precondition`.
- Reset attempt hanya lewat staf (CF `resetJawabanKuisLms`), bukan dari klien siswa.
- Kuis mapel non-TKA tidak berubah (latihan tetap boleh ulang di `SiswaKuis`).

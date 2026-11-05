# Model data LMS (Fase 0+)

## Shared (dari Penilaian)

- `users/{uid}` — profil + role + penugasan + anakIds
- `siswa/{id}` — data dasar (nama, kelas, NISN, aktif)
- Master mapel, kelas, TP/CP (koleksi yang sudah ada)

## LMS (akan ditambah di Fase 1+)

Prefix `lms_` agar jelas di rules bersama:

- `lms_materi/{id}` — materi per kelas+mapel+bab/TP
- `lms_tugas/{id}` — tugas + tenggat
- `lms_pengumpulan/{id}` — pengumpulan siswa
- `lms_nilai_tugas/{id}` — nilai & komentar guru
- (nanti) kuis, kehadiran, badge, dll.

Detail field akan ditulis saat implementasi Fase 1.

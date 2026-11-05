# Model data LMS

## Shared (dari Penilaian)

- `users/{uid}` — profil + role + penugasan + anakIds
- `siswa/{id}` — data dasar (nama, kelas, NISN, aktif)
- `tp_kktp/{id}` — Tujuan Pembelajaran per mapel × kelas paralel
- `mapel/{nama}` — master mata pelajaran

## LMS

Prefix `lms_` agar jelas di rules bersama.

### `lms_materi/{id}`

| Field | Tipe | Keterangan |
|-------|------|------------|
| kelas | string | Rombel, mis. `5A` |
| mapel | string | Nama mapel (sama dengan penugasan / tp_kktp) |
| judul | string | Judul materi |
| deskripsi | string? | Opsional |
| jenis | string | `pdf` \| `gambar` \| `video` \| `youtube` \| `tautan` |
| url | string? | Download URL Storage / YouTube / tautan |
| storagePath | string? | Path Firebase Storage |
| fileName | string? | Nama file asli |
| contentType | string? | MIME |
| ukuran | number? | Byte |
| bab | string? | Label bab/unit |
| tpId | string? | ID dokumen `tp_kktp` |
| tpNomor | number? | Nomor TP (denormalisasi) |
| tpNama | string? | Nama TP (denormalisasi) |
| urutan | number | Urutan tampil |
| dibuatOleh | string | uid guru |
| dibuatOlehNama | string? | Nama guru |
| createdAt / updatedAt | timestamp | |

**Storage:** `lms/materi/{kelas}/{timestamp}_{namaFile}`  
Batas: PDF/gambar 10 MB, video 50 MB.

### Rencana berikutnya

- `lms_tugas/{id}` — tugas + tenggat
- `lms_pengumpulan/{id}` — pengumpulan siswa
- `lms_nilai_tugas/{id}` — nilai & komentar guru

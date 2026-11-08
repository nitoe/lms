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

### `lms_kuis/{id}`

| Field | Tipe | Keterangan |
|-------|------|------------|
| kelas | string | Rombel |
| mapel | string | Nama mapel |
| judul | string | Judul kuis |
| deskripsi | string? | Opsional |
| tpId / tpNomor / tpNama | | Opsional, hubung ke TP |
| durasiMenit | number? | Opsional |
| acakSoal / acakOpsi | boolean? | Opsional |
| aktif | boolean | Status publish |
| dibuatOleh / dibuatOlehNama | string | |
| jumlahSoal | number | Denormalisasi |
| createdAt / updatedAt | timestamp | |

### `lms_soal/{id}`

| Field | Tipe | Keterangan |
|-------|------|------------|
| kuisId | string | |
| urutan | number | |
| jenis | string | `pg` \| `pg_kompleks` \| `menjodohkan` \| `benar_salah` \| `isian` \| `uraian` |
| pertanyaan | string | |
| pertanyaanGambar / pertanyaanGambarPath | string? | URL + path Storage |
| opsi | array? | `{id, teks, gambarUrl?, benar?}` |
| pasangan | array? | Untuk menjodohkan `{id, kiri, kanan, ...}` |
| jawabanIsian | string[]? | Varian jawaban benar |
| kunciUraian | string? | Petunjuk penilaian |
| skor | number | |
| penjelasan | string? | |
| wajib | boolean? | |

**Storage gambar soal:** `lms/kuis/{kuisId}/{timestamp}_{namaFile}` (maks 5 MB)

> Catatan: `lms_kuis`/`lms_soal` (modul Kuis) dan `lms_paket_soal` (Bank Soal Fase 2a) dibuat terpisah dan saat ini tumpang tindih; penyatuan menunggu keputusan.

### `lms_paket_soal/{id}` (Fase 2a)

Satu paket soal/kuis (draf guru). Memuat **kunci jawaban** → hanya terbaca guru kelas×mapel & admin.

| Field | Tipe | Keterangan |
|-------|------|------------|
| kelas, mapel | string | Seperti `lms_materi` (mapel sama persis dengan penugasan) |
| judul | string | ≤ 200 karakter |
| deskripsi | string? | Petunjuk untuk siswa |
| tpId / tpNomor / tpNama | string? / number? / string? | TP opsional (denormalisasi) |
| status | `'draf'` \| `'siap'` | `siap` hanya bila semua soal lengkap |
| acakSoal | boolean | Acak urutan soal per siswa |
| soal | array<Soal> | Maks 100 soal; lihat tipe di `src/types/soal.ts` |
| jumlahSoal, totalPoin | number | Denormalisasi untuk daftar |
| dibuatOleh, dibuatOlehNama | string | uid & nama guru |
| createdAt / updatedAt | timestamp | |

Elemen `soal[]` (semua punya `id`, `tipe`, `teks` (HTML terbatas), `gambarId?`, `poin`, `waktuMenit`, `pembahasan?`):

| tipe | Field khusus |
|------|--------------|
| `pg` | `opsi[{id,teks,gambarId?}]`, `kunci` (id opsi), `acakOpsi`, `opsiGambar` |
| `pgk` | `opsi[]`, `kunci[]` (id opsi), `acakOpsi`, `opsiGambar`, `nilaiParsial` |
| `jodoh` | `pasangan[{id,kiri,kiriGambarId?,kanan}]` (baris sejajar = kunci), `nilaiParsial` |
| `bs` | `pernyataan[{id,teks,benar}]`, `nilaiParsial` |
| `isian` | `kunci[]` (jawaban diterima), `abaikanKapital` |
| `uraian` | `kunciJawaban?` (pedoman guru, HTML), dinilai manual |

Query: `where kelas == … && where mapel == …` saja (tanpa `orderBy`).

### `lms_gambar/{id}` (Fase 2a)

| Field | Tipe | Keterangan |
|-------|------|------------|
| data | string | Data URL WebP/JPEG terkompres, ≤ 300.000 karakter |
| lebar, tinggi | number | Piksel |
| dibuatOleh | string | uid guru |
| createdAt | timestamp | |

Baca terbuka (siswa tanpa Auth); tulis guru; tidak ada ubah; hapus admin.

### Rencana berikutnya

- `lms_tugas/{id}` — tugas + tenggat
- `lms_pengumpulan/{id}` — pengumpulan siswa
- `lms_nilai_tugas/{id}` — nilai & komentar guru

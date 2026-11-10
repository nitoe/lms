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

### `lms_tugas/{id}`

| Field | Tipe | Keterangan |
|-------|------|------------|
| kelas | string | Rombel (satu kelas utama) |
| mapel | string | Mapel utama / penanggung jawab |
| mapelLain | string[]? | Mapel tambahan (jenis `proyek`) |
| judul | string | Judul tugas |
| deskripsi | string? | Ringkasan untuk katalog |
| instruksi | string? | Instruksi lengkap (tab Isi Tugas) |
| jenis | string | `mapel` \| `proyek` |
| tpList | array? | `[{id, nomor, nama, mapel?}]` — boleh lebih dari satu TP |
| tpId / tpNomor / tpNama | | Mirror TP pertama (kompatibilitas) |
| tenggat | timestamp? | Tenggat waktu |
| aktif | boolean | Status publish |
| pengaturanPenilaian | map? | `{kategori[], rentangPredikat[], rentangTerkunci?, catatan}` |
| dibuatOleh / dibuatOlehNama | string | |
| jumlahPengumpulan | number | Denormalisasi |
| createdAt / updatedAt | timestamp | |

Query utama: `where kelas == … && where mapel == …`.

### `lms_nilai_tugas/{id}`

ID disarankan: `{tugasId}_{siswaId}`.

| Field | Tipe | Keterangan |
|-------|------|------------|
| tugasId | string | |
| siswaId | string | ID dokumen `siswa` |
| siswaNama | string | Denormalisasi |
| kelas | string | Rombel |
| mapel | string | Mapel utama tugas |
| nilaiPerKategori | map? | skor per `kategoriId` (0–100) |
| nilaiRataRata | number? | rata-rata / berbobot |
| nilai | number | nilai akhir 0–100 |
| predikat | string? | mis. B+, C- |
| komentar | string? | |
| dinilaiOleh / dinilaiOlehNama | string | |
| createdAt / updatedAt | timestamp | |

Query: `where tugasId == … && where kelas == … && where mapel == …`.

### Rencana berikutnya (Tugas)

- `lms_pengumpulan/{id}` — pengumpulan file/jawaban siswa
- Sinkron nilai ke koleksi nilai di SDM01Penilaian (Cloud Function) bila `pengaturanPenilaian.sinkronKePenilaian`

### `lms_jawaban/{id}`

Satu dokumen **per kiriman / percobaan** siswa (bukan per soal).

Ditulis **hanya** oleh Cloud Function `nilaiKuisLms` (Admin SDK). Klien tidak boleh create/update/delete.

| Field | Tipe | Keterangan |
|-------|------|------------|
| kuisId | string | |
| siswaUid | string | UID Auth (lms_siswa_…) |
| siswaId | string? | ID dokumen `siswa` |
| siswaNama | string | Denormalisasi |
| kelas | string | Rombel |
| mapel | string | |
| judulKuis | string? | Denormalisasi |
| jenisPenilaian | string | `latihan` \| `slm` \| `sts` \| `sas` |
| jawaban | map | Kunci = id soal snapshot, nilai = jawaban siswa |
| skorOtomatis | number | Jumlah skor otomatis |
| totalPoin | number | |
| detail | array | `{ soalId, tipe, benar, skor, butuhManual }` |
| percobaan | number | 1, 2, … per siswa×kuis |
| status | string | `selesai` \| `sebagian_manual` |
| createdAt | timestamp | |

**Query guru:** `where('kuisId', '==', …)` (rules memeriksa `kelas`+`mapel` di dokumen).  
**Query siswa:** `where('siswaId', '==', …) && where('kuisId', '==', …)`.

Indeks: `siswaId` Asc + `kuisId` Asc. Bila perlu orderBy waktu di klien, urutkan di memori atau buat indeks `kuisId` + `createdAt`.

**Catatan latihan:** `jenisPenilaian === 'latihan'` tidak menulis ke koleksi nilai rapor (SLM/STS/SAS), tetapi dokumen `lms_jawaban` **tetap** dibuat agar guru bisa menganalisis.

### Rekap Nilai (rencana & fondasi)

Pusat agregasi nilai per TP untuk sinkron ke aplikasi Penilaian.

#### `lms_bobot_slm/{id}` (Tahap 2+)

ID: `{kelas}__{mapelSlug}__{tpId}` (lihat `idBobotSlm`).

| Field | Tipe | Keterangan |
|-------|------|------------|
| kelas | string | Rombel |
| mapel | string | Nama mapel |
| tpId | string | ID `tp_kktp` |
| tpNomor / tpNama | number? / string? | Denormalisasi |
| sumber | array | `{ id, jenis: 'tugas'\|'kuis', sumberId, judul, bobot }` |
| diubahOleh | string? | uid |
| createdAt / updatedAt | timestamp | |

**Belum di-deploy rules.** Tulis hanya guru mapel×kelas (`lmsTulisMapelKelas`).

#### Alur nilai (konsep)

1. **SLM TP:** gabungan skor dari `lms_nilai_tugas` (tugas yang `tpList` memuat tpId) + skor kuis `jenisPenilaian=slm` yang `tpIds` memuat tpId, dihitung berbobot dari `lms_bobot_slm`.
2. **STS / SAS TP:** dari kuis `jenisPenilaian=sts|sas` (biasanya satu sumber); input offline lewat modul Kuis.
3. **Rekap mapel:** tabel nilai akhir semua TP → CF sinkron ke koleksi nilai di SDM01Penilaian (bukan tulis langsung dari klien).


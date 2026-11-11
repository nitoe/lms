# ANTIREGRESI (cuplikan — append di BAWAH)

## §87. Generate ilustrasi AI TKA (revisi model 2026-11-10)

87.1 Cabang mapel diawali "TKA " terpisah di `susunPromptIlustrasiSoal`. Petunjuk guru prioritas mutlak.

87.2 Jangan memakai model `gemini-2.0-flash-preview-image-generation` (sudah tidak tersedia). Gunakan daftar fallback di `MODEL_GAMBAR_CANDIDATES`.

87.3 Jangan impor `@google/generative-ai` di functions (tidak ada di package.json). Pakai fetch REST.

87.4 Non-TKA tetap diagram/fungsional. Jangan menyamakan prompt TKA ke path mapel biasa.

87.5 File `generateSoalLmsAi.js` selalu diganti utuh (bukan patch potongan) agar export dan helper konsisten.

## §88. Rancang kuis TKA — filter bentuk soal

88.1 Di wizard rancang kuis (`KuisPanel`), filter «Bentuk soal» untuk mapel TKA **hanya** menampilkan `pg`, `pgk`, `bs` (`TIPE_SOAL_TKA` dari `tkaAkses.ts`). Jangan memakai `URUTAN_TIPE` penuh di ruang TKA.

88.2 Jika user tidak memilih bentuk apa pun, penyusunan otomatis TKA tetap membatasi ke `TIPE_SOAL_TKA` (bukan «semua tipe mapel»). Mapel non-TKA: kosong = semua tipe seperti sebelumnya.

88.3 Perubahan filter bentuk soal di rancang kuis **hanya** boleh dikondisikan dengan `adalahMapelTka(mapel)`. Jangan mengubah perilaku default mapel biasa.

## §89. Tempel / salin gambar bank soal

89.1 Penyediaan gambar soal: unggah file, generate AI, **dan** tempel dari clipboard. Jangan menghapus salah satu jalur.

89.2 Paste hanya memproses item `image/*` di clipboard/dataTransfer. Jangan `preventDefault` paste global di halaman editor teks — hanya di zona `GambarPicker` saat clipboard berisi gambar.

89.3 Salin gambar memakai data URL dari `lms_gambar` → `ClipboardItem` (bukan URL Storage eksternal). Tempel menghasilkan dokumen `lms_gambar` baru (bukan berbagi ID) agar soal tidak saling terikat bila salah satu dihapus.

89.4 Batas kompresi tetap sama (sisi ≤ 1024 px, data URL ≤ sasaran karakter Firestore). Clipboard melewati `unggahGambar` yang sama.

## §90. Pemilihan soal manual (rancang kuis)

90.1 Mode manual **wajib** menampilkan pratinjau soal lengkap (teks, stimulus, gambar, opsi) saat memilih — jangan kembali ke daftar cuplikan satu baris saja.

90.2 Layout master–detail berada di area konten wizard kuis, **bukan** mengganti atau bercampur dengan sidebar navigasi utama aplikasi.

90.3 Komponen pratinjau memakai `SoalTampil` / `StimulusSoal` / `GambarSoal` yang sama dengan tampilan siswa agar tidak ada perbedaan format.

90.4 Filter bentuk di panel pilih manual mengikuti `tipePilihan` dari pemanggil (TKA: `TIPE_SOAL_TKA`; mapel: `URUTAN_TIPE`).

## §91. Pengaturan & hasil kuis TKA

91.1 Blok UI «Penilaian & TP» (jenis penilaian rapor + TP KKTP) **hanya** untuk mapel non-TKA. Jangan menampilkan atau mewajibkan TP rapor pada kuis TKA.

91.2 Kuis TKA disimpan dengan `jenisPenilaian: 'latihan'` (atau setara non-rapor). Skor tetap di `lms_jawaban`, tidak disinkron ke nilai akademik Penilaian/rapor lewat jalur SLM/STS/SAS.

91.3 `match /lms_jawaban` wajib ada: baca guru/admin via `lmsLihatMapelKelas` (termasuk `ruangTka`) atau siswa milik sendiri; create/update/delete klien = false (hanya Admin SDK / CF).

91.4 Helper TKA di rules harus selaras `tkaAkses.ts`: mapel termasuk IPA; kelas `6`/`6A`/`6B`; wali 6A atau 6B boleh kelola bank/kuis/hasil kelas kanonik `6`. Ubah keduanya bersamaan.

## §92. Laporan hasil TKA (roster & akses kelas)

92.1 Hasil TKA menampilkan **roster lengkap** siswa rombel yang diizinkan, meski belum ada yang mengerjakan. Jangan kembali ke daftar kosong hanya dari `lms_jawaban`.

92.2 Akses tampilan hasil:
- Email khusus `arif.azwar79@gmail.com` (admin TKA, **bukan** admin LMS): 6A dan 6B + filter kelas.
- Wali 6A → hanya 6A; wali 6B → hanya 6B (`kelasHasilTkaBolehDilihat` di `tkaAkses.ts`).
- Pembatasan per rombel di **UI**; rules tetap `tkaWaliKelas6Any` untuk baca bank/kuis/jawaban.

92.3 Muat jawaban TKA lewat `daftarJawabanKuisMultiKelas` (query per kelas 6A/6B), bukan hanya `kuis.kelas` kanonik «6».

92.4 Analisis AI kuis/siswa (isian–uraian) **tidak** ditampilkan untuk mapel TKA. Sinkron ke Penilaian/rapor tetap dimatikan (`jenisPenilaian: latihan`).

92.5 Perubahan laporan hasil **hanya** dikondisikan `adalahMapelTka`. Perilaku hasil kuis mapel biasa tidak boleh berubah.

## §93. Domain penilaian TKA (Pengetahuan vs Keterampilan Proses)

93.1 Field `domainTka` bersifat **opsional**. Soal lama tanpa field tetap valid; jangan wajibkan saat simpan paket/kuis.

93.2 Nilai yang diizinkan **hanya** `pengetahuan` | `keterampilan_proses`. Tidak ada opsi «campuran» — putuskan yang lebih dominan. Nilai legacy `campuran` → `undefined` lewat `normalisasiDomainTka`.

93.3 UI penanda domain tampil untuk mapel **TKA IPA** (atau bila soal sudah punya `domainTka`). Jangan tampilkan di mapel biasa / TKA non-IPA kecuali field sudah terisi.

93.4 Tag domain **manual dulu**; usulan AI paket dan pemecahan skor laporan adalah langkah terpisah. Jangan auto-apply label AI tanpa konfirmasi guru.

93.5 Perubahan domain tidak boleh mengubah penilaian otomatis PG/PGK/BS atau sinkron rapor.

## §94. Laporan hasil siswa TKA — breakdown domain

94.1 Di `HasilKuisPanel`, kolom skor per domain (`pengetahuan` / `keterampilan_proses`) **hanya** muncul bila `adalahMapelTka` dan ada soal yang memiliki `domainTka` ternormalisasi. Mapel biasa tidak menampilkan kolom ini.

94.2 Perhitungan memakai `detail[].skor` dan `soal.poin` yang berdomain sama; soal tanpa domain tidak masuk agregat domain. Persentase ditampilkan sebagai bilangan bulat (atau «—» bila belum ada skor/maks 0).

94.3 Jangan mengubah struktur tabel hasil kuis mapel non-TKA. Roster, filter kelas, dan status «Belum mengerjakan» tetap seperti §92.

94.4 Import domain di editor (`TkaFieldEditor`, `PilihSoalManual`) wajib menyertakan `normalisasiDomainTka` + konstanta nama/urutan/deskripsi dari `types/soal.ts` — jangan memakai tanpa import (regresi build TS2304).

94.5 `soalIds` untuk `agregatPerSoal` wajib didefinisikan di panel (`useMemo` dari `kuis.soal`); jangan menghapus saat menambah kolom domain.

## §95. Laporan TKA — rata domain kelas & detail siswa

95.1 Kartu rata-rata per domain di ringkasan hasil **hanya** bila `isTka` dan `domainYangAda.length > 0`. Dihitung dari siswa yang sudah mengerjakan (bukan roster kosong).

95.2 Header detail siswa TKA menampilkan badge skor per domain; setiap kartu soal menampilkan badge domain bila `domainTka` ternormalisasi.

95.3 Semua UI §95 dikondisikan `adalahMapelTka` / `isTka`. Jangan menambah kolom atau kartu domain ke jalur mapel biasa.

## §96. Publikasi hasil TKA ke siswa

96.1 Field `hasilDipublish` pada `lms_kuis` **hanya** mengatur tampilan skor di sisi siswa untuk mapel TKA. Mapel non-TKA mengabaikan field ini.

96.2 Default `hasilDipublish` kosong/false: siswa yang sudah submit hanya melihat status «jawaban terkirim» / «nilai belum dipublikasikan», **tanpa** angka skor, rincian kompleksitas, materi, atau domain.

96.3 Guru mengubah status lewat tab Hasil (`HasilKuisPanel`) dengan `updateKuis({ hasilDipublish })`. Tidak perlu Cloud Function baru; tulis mengikuti rules kuis yang sudah ada.

96.4 Setelah publish, siswa melihat skor di daftar kuis dan (jika baru submit) di layar hasil. Guru boleh menyembunyikan kembali (toggle).

96.5 Jangan mengaitkan `hasilDipublish` dengan sinkron rapor, portal-ortu, atau jenis penilaian SLM/STS/SAS. TKA tetap `jenisPenilaian: 'latihan'` (§91.2).

96.6 Perubahan UI publish **hanya** dikondisikan `adalahMapelTka` / `isTka`. Jangan mengubah layar hasil kuis mapel biasa.

## §97. Reset attempt TKA

97.1 Reset attempt **hanya** untuk mapel TKA. Cloud Function menolak mapel non-TKA (`failed-precondition`).

97.2 Tulis/hapus `lms_jawaban` tetap **hanya** Admin SDK. Klien memanggil `resetJawabanKuisLms`; jangan membuka `delete` klien di rules.

97.3 Izin CF: admin LMS, email `arif.azwar79@gmail.com`, atau wali kelas 6A/6B (role guru/guru_akademik) yang sesuai **kelas di dokumen jawaban** (rombel siswa), bukan hanya kelas kanonik bank `6`.

97.4 Reset menghapus **semua** kiriman siswa pada kuis tersebut (`kuisId` + `siswaId`), bukan hanya percobaan terakhir, agar nomor percobaan berikutnya dimulai bersih.

97.5 UI Reset hanya di `HasilKuisPanel` saat `isTka`. Jangan menambah reset ke jalur hasil kuis mapel biasa.

97.6 Setelah reset, muat ulang daftar jawaban. Progres lokal siswa (`localStorage` TKA) tidak dihapus server-side — siswa yang masih membuka tab lama perlu refresh; attempt baru tetap diizinkan karena dokumen jawaban sudah hilang.

## §98. Laporan nilai TKA — domain & satu attempt

98.1 **`soalIds`** di `HasilKuisPanel` wajib `useMemo` dari `kuis.soal` sebelum `agregatPerSoal`. Jangan menghapus saat menambah kolom domain/publish/reset (regresi TS2304 berulang).

98.2 TKA **satu attempt**: sembunyikan checkbox «Hanya percobaan terbaru»; `tampil` selalu `ringkasPerSiswa`. Jangan tampilkan kolom Perc. di tabel roster TKA.

98.3 Kolom nilai TKA tetap tiga: **Pengetahuan IPA** (`pengetahuan`), **Keterampilan Proses Sains** (`keterampilan_proses`), **Nilai Akhir** = rata-rata persentase domain yang punya soal (maks>0). Bukan skor total mentah semua soal.

98.4 `domainTka` hanya `pengetahuan` | `keterampilan_proses` (normalisasi menolak nilai lain / campuran). Soal tanpa domain tidak masuk agregat domain.

98.5 Klasifikasi domain AI (`klasifikasiDomainTkaLmsAi`) hanya akun AI (`bolehPemanggilAi`); hasil ditulis ke snapshot soal kuis lewat `updateKuis`. Jangan membuka write `lms_jawaban` dari klien.

98.6 Perubahan §98 hanya dikondisikan `isTka` / `adalahMapelTka`. Tabel hasil mapel biasa (termasuk kolom Perc. & checkbox percobaan) tidak berubah.

## §98.7 Lokasi deteksi domain TKA

Deteksi/klasifikasi domain AI (**bukan** di tab Hasil siswa) hanya di tab **Atur kuis** (`KuisDetail`). Tab Hasil hanya menampilkan skor domain yang sudah dilabel. Jangan mengembalikan tombol deteksi ke `HasilKuisPanel`.

## §99. Siswa LMS boleh baca kuis aktif (kelasnya / bank TKA)

99.1 **`lms_kuis` allow read** harus mencakup siswa:
```
isSiswaLms()
&& resource.data.aktif == true
&& (
  resource.data.kelas == request.auth.token.kelas
  || (mapelTka(resource.data.mapel)
      && tkaKelas6(request.auth.token.kelas)
      && resource.data.kelas == '6')
)
```
Tanpa ini, daftar kuis mapel dan TKA di area siswa selalu gagal permission.

99.2 Query klien siswa **wajib** filter `aktif == true` dan `kelas` (rombel atau «6» untuk TKA). Jangan query tanpa filter kelas.

99.3 **`lms_jawaban`**: siswa hanya **read** dokumen dengan `siswaId == token.siswaId`. Create/update/delete = `false` (hanya Admin SDK / CF `nilaiKuisLms`).

99.4 `mapelTka` = `TKA Matematika` | `TKA Bahasa Indonesia` | `TKA IPA`. Jangan hilangkan IPA.

99.5 File `firestore.rules` **dibagikan** LMS ↔ SDM01Penilaian: selalu salin **versi utuh**, bukan potongan.

99.6 Snapshot soal di `lms_kuis` masih memuat kunci di klien (keterbatasan saat ini). Penilaian tetap server-side. Jangan menolak read siswa dengan alasan kunci — itu memutus akses mengerjakan. Strip kunci = tugas terpisah.

## §99 (lanjutan) — list query TKA kelas «6»

99.7 Cabang baca siswa pada `lms_kuis` **wajib** terpisah tanpa `mapelTka()` pada query bank:
```
|| (isSiswaLms() && resource.data.aktif == true
    && resource.data.kelas == request.auth.token.kelas)
|| (isSiswaLms() && resource.data.aktif == true
    && resource.data.kelas == '6'
    && request.auth.token.kelas in ['6A', '6B'])
```
Menyisipkan `mapelTka(resource.data.mapel)` ke cabang bank membuat `getDocs(where kelas=='6')` selalu permission-denied.

99.8 Identity pembuat kuis (`dibuatOleh`, role wali 5A, email admin TKA) **tidak** boleh menjadi syarat baca siswa.

99.9 Klien TKA boleh memuat rombel + bank «6» secara terpisah agar satu query gagal tidak menutup seluruh menu.

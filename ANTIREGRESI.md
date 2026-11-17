## §0. PRIORITAS — Batas klien vs rules (permission denied berulang)

**Ini sudah berulang.** Gejala: simpan/import paket soal (atau write lain) gagal dengan `Missing or insufficient permissions` padahal user berhak menulis kelas×mapel.

### Akar yang sering terlupa
1. **Rules `soal.size() <= N` tidak ikut dinaikkan** saat `BATAS_SOAL_PER_PAKET` di klien dinaikkan.  
   - Klien: `src/types/soal.ts` → `BATAS_SOAL_PER_PAKET = 300`  
   - Rules (lama): `lms_paket_soal` create/update → `request.resource.data.soal.size() <= 100`  
   - Akibat: paket >100 soal selalu ditolak rules → permission denied (bukan error validasi klien).
2. **Rules belum di-deploy** setelah diubah di repo (`npm run deploy:rules` dari SDM01Penilaian). UI Hosting baru ≠ rules baru.
3. **firestore.indexes.json parsial** (lihat §128.7) — deploy index minimal menawarkan hapus index production.

### Wajib sebelum merge/deploy fitur yang menyentuh jumlah soal / ukuran array
- [ ] `BATAS_*` di `src/types/*` **sama** dengan `*.size() <= N` di `firestore.rules` untuk field yang sama.
- [ ] Setelah ubah rules: salin **file utuh** ke SDM01Penilaian → `npm run deploy:rules`.
- [ ] Uji simpan paket dengan jumlah soal **di atas** batas lama (mis. 101, 150) dengan akun guru biasa (bukan hanya admin).
- [ ] Jangan menaikkan hanya klien. Jangan menaikkan hanya rules tanpa update konstanta klien (pesan error UI akan salah).

### Batas resmi saat ini (sinkronkan bila diubah lagi)
| Field / koleksi | Klien | Rules |
|-----------------|-------|-------|
| `lms_paket_soal.soal` | `BATAS_SOAL_PER_PAKET = 300` | `soal.size() <= 300` |
| `lms_kuis.jumlahSoal` | `BATAS_SOAL_PER_KUIS = 100` | `jumlahSoal <= 200` (rules lebih longgar) |
| Ukuran dokumen paket | `BATAS_UKURAN_PAKET = 900_000` (peringatan klien) | Batas Firestore 1 MiB (bukan permission) |

Bila error tetap permission setelah rules 300 ter-deploy: cek penugasan `penugasanKelasMapel` / `lmsTulisMapelKelas`, bukan jumlah soal.

---

## §128. Query kelasList array-contains (berbagi paralel) — permission list

128.1 Query sekunder `where('kelasList','array-contains', kelas)` di `daftarTugas`, `daftarKuis`, `daftarMateri` **wajib** didukung rules **dan** menyertakan constraint `mapel`.

128.2 **Wajib di klien:** `where('mapel','==', mapel)` + `where('kelasList','array-contains', kelas)`. Tanpa mapel di query, list evaluation menolak (dokumen hipotetis mapel lain). Jangan mengandalkan filter mapel hanya di klien setelah getDocs.

128.3 Helper rules `lmsLihatViaKelasList(mapel, list)`: OR `lmsLihatMapelKelas` untuk tiap elemen list (maks 6). Dipakai di `allow read` `lms_kuis` dan `lms_tugas` (cabang `isGuru() && 'kelasList' in resource.data && …`). Dengan mapel ter-constraint + user ampu kelas yang di-query, rule benar untuk semua dokumen match.

128.4 `lms_materi` sudah `allow read: if isGuru() || …` sehingga lebih longgar; tetap sertakan mapel di query kelasList agar siap jika rules diperketat.

128.5 Composite index: `mapel` ASC + `kelasList` CONTAINS untuk koleksi `lms_tugas`, `lms_kuis`, `lms_materi`. Tanpa index, error berubah dari permission menjadi «requires an index» (ikuti link di console Firebase).

128.6 Tulis/update `kelasList` tetap lewat `lmsKelasListBoleh` (semua kelas dalam list wajib `lmsTulisMapelKelas`) — jangan longgarkan write. Deploy rules **dan** index; push kode klien saja tidak cukup jika rules lama masih aktif di Firebase.

## §128.7 firestore.indexes.json — JANGAN file parsial

128.7 `firestore.indexes.json` adalah **sumber kebenaran penuh**. Deploy file yang hanya memuat index baru akan membuat CLI menawarkan **hapus** semua index yang tidak tercantum (nilai_*, perpus_*, tp_kktp, siswa, notifikasi, …). Selalu: ambil file lengkap dari SDM01Penilaian (atau `firebase firestore:indexes`), **tambah** index baru, baru deploy. Jangan pernah menimpa dengan daftar minimal.



## §127.33 Judul dokumen & semester export kuis (2026-11-15)

127.33 Judul kop dihitung di `judulUtama()` dari `kuis.jenisPenilaian` (latihan → «ASESMEN TERTULIS LATIHAN», slm, sts, sas). Jangan kembali ke «LEMBAR SOAL» / hardcode satu judul. Semester **jangan hardcode 'ganjil'**: pakai `opsi.semester ?? semesterOtomatis(kuis)` (waktuMulai kuis, fallback tanggal hari ini; Jul–Des ganjil, Jan–Jun genap). Tahun pelajaran masih default konstanta `2026/2027` (`metaDokumen`) — perbarui bila tahun ajaran berganti atau turunkan otomatis.

## §127.26–§127.32 Export PDF v4: paginasi sendiri (2026-11-15)

127.26 **Jalur PDF tidak boleh mengandalkan pemecah halaman browser** (`break-inside`, `break-after`, `column-count`, `column-span`, `@page @bottom-*`). Terbukti di Chromium: halaman 1 hanya kop (soal mulai hal. 2), opsi terpisah dari soal, meta tercecer. Pembagian halaman dihitung di `susunHalaman()` (ukur tinggi blok → tempatkan pada `.halaman` A4 tetap, posisi `absolute`). Jangan mengembalikan CSS kolom/pemecah halaman untuk jalur PDF.

127.27 **Satu soal = satu blok utuh** (`htmlSatuSoal`): nomor, teks, gambar, stimulus, opsi/tabel tidak dipisah. `potongan` hanya cadangan bila satu soal lebih tinggi dari satu halaman penuh. Judul bagian `jaga: true` (selalu bersama blok sesudahnya). Kop+identitas+judul+soal pertama harus di halaman 1 selama muat.

127.28 **Footer**: elemen `.footer-halaman` per halaman — `border-top` tipis (0.5pt), nomor halaman `.footer-no` di **kanan bawah**, keterangan kuis di kiri. Batas isi (`geometriCetak().bawah`) ≥ 3 mm di atas garis footer. Jangan memakai `@page { @bottom-center }` (tak bisa bergaris penuh & tak konsisten).

127.29 **Mode 2 kolom**: hanya `jenis === 'uraian'` yang `mode: 'penuh'` (1 kolom selebar halaman); semua bentuk lain `mode: 'kolom'`. Judul bagian di awal wilayah kolom selebar halaman (`penuhBilaAwal`). Kolom di halaman terakhir wilayah diseimbangkan (`seimbangkan`) tanpa mengubah urutan soal. Font ≥ 11pt (BS 11pt di `body.dua`).

127.30 Ukuran halaman `.halaman` = 210mm × **296.5mm** (bukan 297) + `@page { margin: 0 }` agar pembulatan tidak melahirkan halaman kosong. Posisi/lebar dalam px dari `geometriCetak()`; jangan memakai satuan relatif viewport.

127.31 Pengukuran harus menunggu gambar didekode (`tungguGambar`) dan font siap sebelum `print()`; gambar tetap JPEG (§127.17). Garis jawaban isian pakai `.garis-isi` ber-border (jangan deretan `_` — melebihi lebar kolom).

127.32 `window.open` dipanggil **sinkron di awal** `cetakKuisPdf` (dalam klik pengguna), baru diisi setelah proses async; bila gagal, jendela ditutup dan error dilempar (UI menampilkan `alert`). Jalur Word memakai `STYLE_WORD` terpisah — mengubah CSS PDF tidak boleh mengubah Word dan sebaliknya.

## §127.23–§127.25 Export PDF v3: alur, uraian, footer halaman (2026-11-15)

> **DIGANTIKAN untuk jalur PDF oleh §127.26–§127.32** (paginasi dihitung sendiri; aturan CSS di bawah tetap berlaku hanya untuk jalur Word bila relevan).


127.23 Jangan membiarkan halaman 1 hanya berisi kop/identitas. Margin identitas & garis ganda diperketat; `max-height` ilustrasi dibatasi agar blok soal muat mulai di halaman pertama.

127.24 Bagian **uraian** tidak ikut `column-count: 2`. Selalu dibungkus `.isi-soal--penuh` (1 kolom) dengan minimal 8 baris garis jawaban.

127.25 Nomor halaman hanya di **bottom margin** via `@page { @bottom-center { content: counter(page) } }`. Margin bawah ≥ 1.6 cm. Jangan menaruh nomor halaman menempel konten soal.

## §127.20–§127.22 Export PDF: anti-potong, rata kiri, dua kolom (2026-11-15)

> **DIGANTIKAN untuk jalur PDF oleh §127.26–§127.32** (paginasi dihitung sendiri; aturan CSS di bawah tetap berlaku hanya untuk jalur Word bila relevan).


127.20 Setiap blok soal (`table.soal-wrap`) dan ilustrasi (`.soal-gambar` / `.opsi-gambar`) **wajib** `break-inside: avoid` + `page-break-inside: avoid` pada `@media print` agar narasi, opsi, dan gambar tidak terpotong pergantian halaman.

127.21 Ilustrasi soal **rata kiri** (`margin: … 0`, bukan `margin-inline: auto` / tengah), sejajar teks soal dan opsi.

127.22 Mode **dua kolom** (`opsi.duaKolom`): isi soal dalam `.isi-soal--dua` (`column-count: 2`), margin `@page` ≈ 1 cm, `font-size: 11pt` minimum. Jangan mengecilkan di bawah 11pt. Judul bagian memakai `column-span: all`. Word tetap satu kolom.

## §127.17–§127.19 Export: JPEG, anti-potong, PDF (2026-11-15)

127.17 Gambar soal **wajib** dikonversi ke JPEG (`keJpegDataUrl`) sebelum embed di HTML cetak. Jangan menyematkan data-URL WebP mentah — Word menampilkan ikon rusak (X).

127.18 Jangan memakai `page-break-inside: avoid` pada seluruh `table.soal-wrap` untuk soal panjang — Word memotong narasi/opsi. Pakai `auto` + orphans/widows pada teks.

127.19 Cetak PDF lewat `cetakKuisPdf` (window.print / Save as PDF) adalah jalur **utama** untuk hasil cetak andal. `unduhKuisCetak` (.doc) tetap ada sebagai cadangan. Popup diblokir → tampilkan pesan jelas.

## §127.14–§127.16 Export Word: identitas tunggal, spasi, gambar (2026-11-15)

127.14 Default cetak **identitas tunggal** (`htmlIdentitasSiswa`: Nama + No. Absen). Jangan mengembalikan tabel paraf 10 baris kosong sebagai default (`barisParaf` default **0**). Tabel paraf multi-siswa hanya jika pemanggil set `barisParaf > 0`.

127.15 Spasi antar soal: `table.soal-wrap { margin: 0 0 22pt }` (minimal). Jangan ≤ 12pt.

127.16 Ilustrasi soal **wajib** di-embed bila `gambarId` / `opsi.gambarId` / `kiriGambarId` ada: `unduhKuisCetak` dan `htmlKuisCetak` **async**, muat lewat `ambilGambar` (`lms_gambar`), sematkan `<img class="soal-gambar|opsi-gambar">`. Pemanggil UI: `void unduhKuisCetak(...)`. Gagal muat gambar tidak menggagalkan unduh seluruh dokumen.

## §127.10–§127.13 Export cetak: logo, spasi, unduh tunggal, pratinjau (2026-11-15)

127.10 Kop cetak memakai **logo SDM** (kiri) dan **logo Kota Depok** (kanan) sebagai `<img>` data-URI, bukan karakter bintang/placeholder. Jangan mengembalikan `&#9733;` di `.kop-logo`.

127.11 Huruf opsi A–D: `td.opsi-huruf { font-weight: normal }` — jangan tebal (hanya nomor soal yang tebal). Spasi antar soal: `table.soal-wrap { margin: 0 0 16pt }` (bukan ≤ 9pt).

127.12 Tombol unduh Word **hanya** di `KuisKepala` (prop `aksi`). Jangan mengembalikan pasangan «Unduh soal» / «Unduh + kunci» di bilah sticky tab Atur kuis (`KuisDetail`) — menyebabkan menu ganda.

127.13 Pratinjau isi kuis (termasuk ilustrasi `gambarId`) lewat tombol «Pratinjau» di kepala detail → modal `PratinjauSoal` dengan `soal` dari kuis. Jangan mengandalkan unduh Word untuk mengecek apakah soal punya gambar (gambar belum di-embed di .doc).

## §127.9 Tombol unduh di kepala kuis

Tombol unduh Word wajib di `KuisKepala` (prop `aksi`) agar mudah ditemukan dari semua tab. Sejak §127.12 tombol **tidak** lagi di bilah sticky tab Atur (`KuisDetail`) — hanya di kepala (satu tempat).

## §127.1 Optimasi cetak Word (2026-11-15)

127.6 Layout cetak memakai **tabel** (bukan flex/grid) agar stabil di Microsoft Word.
127.7 `@page { size: A4; margin: 1.5cm }`; soal `page-break-inside: avoid`; kunci `page-break-before: always`.
127.8 Opsi PG = tabel 2 kolom (huruf | teks). Uraian = baris border-bottom. Jangan kembalikan ke `<ol type="A">` yang sering rusak di Word.

## §127. Export kuis cetak (.doc)

127.1 Unduh lembar soal lewat `unduhKuisCetak` / `htmlKuisCetak` di `lib/exportKuisCetak.ts`. Format HTML + MIME `application/msword` (sama pola `unduhLaporanDoc`) — **jangan** menambah dependency `docx` tanpa keputusan eksplisit.

127.2 Tombol «Unduh soal» / «Unduh + kunci» di **kepala detail** (`KuisKepala` prop `aksi`). Jangan mengembalikan ke bilah sticky tab Atur (`KuisDetail`) — lihat §127.12. Jangan sembunyikan untuk kuis offline.

127.3 Pengelompokan cetak: objektif (pg/pgk/bs/jodoh) → isian → uraian, dengan nomor soal global berurutan. Instruksi bagian menyesuaikan template sumatif sekolah.

127.4 Teks soal lewat `teksPolos` (bukan HTML mentah). Gambar soal **belum** di-embed di v1.

127.5 Judul dokumen mengikuti `jenisPenilaian` (STS/SAS/SLM/Latihan), bukan hanya judul kuis.

## §126. Reset attempt kuis mapel (online)

126.1 Reset attempt **bukan** hanya TKA. UI di `HasilKuisPanel` (detail + daftar) menampilkan aksi reset untuk **semua** kuis; jangan mengembalikan guard `if (!isTka) return` pada `resetAttempt`.

126.2 Client memakai `resetJawabanKuis` (CF `resetJawabanKuisLms`). Alias `resetJawabanKuisTka` boleh tetap untuk kompatibilitas.

126.3 Marker draf perangkat tetap di koleksi **`lms_tka_progress_reset/{kuisId}_{siswaId}`** (nama historis). Klien **SiswaKuis** dan **SiswaTka** wajib cek marker sebelum memakai localStorage progress (`sinkronProgressSetelahReset`).

126.4 Mode: `attempt` | `progress` | `semua`. Default UI daftar = `semua` (Reset+). Detail menyediakan ketiga mode.

126.5 Setelah reset attempt, daftar hasil di-muat ulang; siswa boleh mengerjakan ulang (termasuk jenis SLM/STS/SAS yang sebelumnya terkunci setelah kirim).

## §125.4 Gambar HP-first: 1200px + ~180KB WebP

## §125. Viewer materi

125.5 Tabel lebar: `.mh-blok--teks { overflow-x: auto }`, tabel `width: max-content; min-width: 100%`.

## §123. Kompetensi dasar & materi: dua daftar terpisah

## §125. Viewer materi multi-halaman: CSS Grid responsif

125.1 `.mh-viewer` memakai **grid 3 kolom** `minmax(0,1fr) | minmax(0, min(100%, 72rem)) | minmax(0,1fr)` — anak langsung `grid-column: 2`. Jangan kembali ke `max-width: 42rem` + `margin: auto` saja (ruang kosong tidak merata / konten terasa sempit).

125.2 Teks: `max-width` berbasis **ch** (≈65–70ch) di `.mh-blok--teks`. Gambar full-width kartu halaman (`max-width: none` pada blok gambar).

125.3 Nav: grid 3 kolom (prev | dots | next), sticky, lebar 100% kolom konten.


## §124. Katalog Kuis & Tugas siswa: kelompok mapel + filter

124.1 Daftar kuis/tugas siswa **dikelompokkan per `mapel`**. Jangan kembali ke daftar datar tanpa section mapel jika jumlah item bisa banyak.

124.2 Filter status wajib:
- Kuis: Semua | Belum dikerjakan | Sudah dikerjakan | Draf tersimpan (draf = progress localStorage, belum ada `lms_jawaban`).
- Tugas: Semua | Belum dinilai | Sudah dinilai | Lewat tenggat. «Sudah dinilai» = ada `lms_nilai_tugas` milik siswa; pengumpulan file belum menjadi sumber status sampai `lms_pengumpulan` aktif.

124.3 Query tugas siswa: `kelas` + `aktif == true` saja (selaras rules `isSiswaLms`). Jangan compound index tambahan tanpa deploy.

124.4 Instruksi tugas (HTML) wajib lewat `bersihHtml` sebelum `dangerouslySetInnerHTML` (ANTIREGRESI §9).

124.5 Kuis TKA tetap di `/siswa/tka`, tidak dicampur katalog kuis biasa (ANTIREGRESI §77).

124.6 Katalog Kuis/Tugas memakai kelas `sw-kat-*` di `siswa.css` + `aksenMapel` untuk bilah/ikon. Jangan mengembalikan kartu generik `rounded-xl border` tanpa aksen mapel di daftar utama.



123.1 Kompetensi dasar (L1–L3) dan kompetensi materi (BI/MTK: tipe materi; IPA: domain) SELALU ditampilkan sebagai **dua daftar/tabel/kolom terpisah**. Pada Bahasa Indonesia nilainya kebetulan identik (L1=Tekstual, L2=Inferensial, L3=Evaluasi), tetapi JANGAN digabung, dipasangkan, atau dideduplikasi.

123.2 Aturan §109.5 («BI: satu tabel berpasangan», `pasangkanDimensiSama`) **dicabut** — penyebab data tampil ganda (pasangan + kompleksitas) di tab BI. `kolomDariAgregat` adalah satu-satunya sumber kolom (rekap, laporan hasil kuis, ekspor); jangan menambah logika penggabungan di UI.

123.3 Input manual BI tetap hanya meminta poin L1–L3; tipe materi diturunkan saat menyimpan (`bangunSebaranManual`), sehingga data tersimpan memuat kedua daftar.

## §122. Laporan hasil kuis TKA: kolom kompetensi

122.1 «Laporan hasil TKA» (HasilKuisPanel) harus menampilkan kompetensi dari **jawaban kuis itu** lewat `hitungSebaranDariJawaban` + `kolomDariAgregat` (berbobot poin). Jangan kembali ke kolom domain saja — domain hanya terisi untuk IPA, sehingga BI/MTK menjadi kosong.

122.2 Nilai Akhir mapel tanpa domain (BI, MTK) = `skorKe100(skorOtomatis, totalPoin)`, selaras Rekap TKA. IPA mempertahankan rata-rata domain (`nilaiAkhirTka`); jangan menyatukan tanpa keputusan eksplisit.

## §121. Paket soal TKA lintas kelas 6 / 6A / 6B

121.1 Paket hasil migrasi tka2026 bisa berkelas **6A/6B**, bukan hanya «6». Semua pembaca paket TKA (Bank Soal, wizard kuis, `buatKuisDariPaket`, «Tambah paket») HARUS lewat `daftarPaket()` yang menggabungkan 6, 6A, 6B untuk mapel TKA. Jangan query `lms_paket_soal` dengan `kelas == '6'` saja.

121.2 Query per kelas memakai `Promise.allSettled`; hanya bila SEMUA gagal, lempar error. Wizard menampilkan diagnosis (`ringkasanPaket`) bila tak ada paket Siap.

## §120. Kuis TKA terpisah per mapel & daftar kuis aktif

120.1 Mapel TKA berbagi kelas bank «6». Daftar kuis ruang TKA HARUS difilter `mapel` yang sama; jangan menggabung `daftarKuisDibuatOleh()` tanpa memeriksa mapel untuk mapel TKA.

120.2 Setiap query `lms_kuis` `where kelas + mapel` (rules); daftar kuis aktif di `/tka` = satu query per mapel. «Aktif» = `aktif === true` dan `waktuSelesai` kosong/di masa depan; waktu bisa string ISO atau Timestamp (`keTanggal`).

## §119. Ekspor TKA & konfirmasi hapus kuis

119.1 Ekspor XLSX tanpa dependensi (`exportTabel.ts`): header tebal, kolom nama dibekukan, angka tetap numerik, nama sheet ≤ 31 karakter. CSV: UTF-8 **BOM**, `;`, desimal `,`, sel berawalan `= + - @` diberi `'`.

119.2 Ekspor mengikuti filter tahap/kelas yang tampil; jangan mengekspor kelas di luar `kelasRekapTkaBolehDilihat`.

119.3 Hapus kuis HARUS lewat `KonfirmasiHapusDialog` (ketik **HAPUS**), bukan `confirm()` satu klik. `hapusKuis` hanya menghapus dokumen kuis; hasil `lms_jawaban` tertinggal (yatim).

## §118. Input sebaran manual

118.1 Sebaran manual disimpan sebagai **poin & maks** per kompetensi (bukan persen) lewat `bangunSebaranManual`; jumlah poin & maks kompetensi dasar WAJIB sama dengan kompetensi materi.

118.2 Grid hanya memuat siswa `sumber !== 'otomatis'`. Menyimpan lewat `simpanNilaiManualTka({ sebaran })` agar nilai & sebaran tertulis bersamaan; mengubah nilai manual tanpa `sebaran` membuang sebaran lama (§109.3). Validasi semua baris dulu; satu salah → jangan simpan apa pun. Setelah menyimpan, «Perbarui publikasi».

118.3 Catatan nomor: entri §113–§117 yang pernah saya tulis bentrok dengan §113 Navigasi, §114 CSS `tka-ka-*`, dan rujukan kode §115.x (materi AI); dinomori ulang menjadi §118–§122. Sebelum menulis entri baru, cek nomor tertinggi yang dirujuk di `src/` (`grep -rhoE "§1[0-9]{2}" src`), bukan hanya heading di ANTIREGRESI.md.

## §113. Navigasi di dalam panel Kuis (`kn-*`)

113.1 Tombol navigasi di dalam Kuis (kembali, menu Atur/Offline/Hasil, sub-menu hasil, filter kelas) memakai komponen `components/KuisNav.tsx` (`KuisKepala`, `KnSegmen`, `KnChips`, `KnKembali`). Jangan kembali ke tombol Tailwind ad-hoc. Aksen lewat `--rg-a` yang diset wrapper `KelasDetail`; fallback ungu sekolah.

113.2 Kuis **online** tidak punya tab «Input offline». Bila `detailTab === 'offline'` tetapi kuis online, perilaku lama = jatuh ke Hasil siswa: gunakan `tabEfektif` yang sama untuk sorotan menu **dan** isi panel (jangan hitung terpisah).

113.3 ARIA: menu segmen di `KuisKepala` = `tablist` (`idPrefix` `kuis-detail`, panel `#kuis-detail-panel`, roving tabindex). Sub-menu hasil dan filter kelas = `group` + `aria-pressed` karena kontennya bukan panel terpisah.

113.4 Ponsel (≤ 640 px): judul kuis boleh membungkus (clamp 2 baris) — jangan `white-space: nowrap` (judul terpotong «Tah…»); menu segmen memakai `flex: 1 1 0` tanpa scroll horizontal.

113.5 `.tka-tabs` (TkaRekap) harus `display: flex; width: fit-content`; `inline-flex` di dalam kolom flex membuatnya melebar penuh.

113.6 Label tombol kembali di dalam kuis memakai tujuan singkat («Daftar kuis», «Daftar nilai»).

## §112. UI Beranda / Ruang Kelas (`rg-*`)

112.1 Ringkasan tugas & kuis aktif **hanya** lewat `lib/ringkasanRuang.ts` (`useRingkasanRuang` / `muatRingkasanRuang`). Jangan menyalin query `daftarTugasGuru`/`daftarKuis` ke halaman lain. Hook aman balapan (hanya hasil permintaan terbaru yang dipakai).

112.2 `useRingkasanRuang(ruang, …)` memuat ulang setiap **identitas array `ruang`** berubah. Di Beranda/KelasList `ruang` hanya di-set dari efek `[profil]`; di KelasDetail dibungkus `useMemo`. Jangan meneruskan array yang dibuat baru tiap render (akibatnya «Maximum update depth exceeded»).

112.3 `KelasDetail`: semua hook baru wajib di atas early return `!parsed` (sama dengan aturan KuisPanel §108.4). Ruang TKA **tidak** memuat ringkasan (`ruangSatu` kosong) dan **tidak** menampilkan pil tugas/kuis; tab TKA tetap hanya Kuis + Bank Soal (§77).

112.4 `.kelas-hero*` dan `.tka-ruang-*` dipakai bersama hero TKA — jangan diubah untuk mempercantik hero non-TKA (tambahan non-TKA lewat `.rg-hero-pills`). `.lms-hero`, `.lms-card*`, `.lms-tab*` masih dipakai halaman siswa dan panel; **jangan dihapus** walau Beranda/KelasList tidak lagi memakainya.

112.5 Tab ruang memakai pola ARIA: `role=tablist/tab/tabpanel`, id `tab-<id>` / `panel-<id>`, roving `tabIndex`, panah kiri/kanan/Home/End. Jangan kembali ke tab tanpa atribut ini.

112.6 Label hitungan di kartu ruang («tugas aktif», «kuis aktif») huruf biasa, **bukan** uppercase ber-letter-spacing — versi uppercase terpotong («TUGAS AK…») pada kartu ±215 px. Hitungan nol berwarna `#64748b` (bukan `#94a3b8`, kontras kurang).

112.7 Item grid ruang adalah `<li>` `display: flex` berisi kartu (`<a class="rg-ruang">`); jangan `display: contents` pada `<li>`. Lebar halaman penuh — tanpa `max-width` pada `.rg-halaman` / `.rg-grid` (§111.2).

112.8 Urutan agenda (`urutkanAgenda`): tugas bertenggat mendatang (terdekat dulu) → tugas lewat tenggat (terbaru dulu) → tugas tanpa tenggat → kuis; selaras «Tenggat terdekat» di katalog Tugas. Nada tenggat memakai `infoTenggat` (§111.3).

## §111. UI katalog Tugas (`tg-*`)

111.1 Aksen kartu = variabel `--tg-a` yang diset **inline per kartu** dari `aksenMapel(mapel).bar`; soft/garis diturunkan dengan `color-mix`. Warna teks berwarna boleh memakai `--tg-a` langsung karena palet `aksenMapel` seluruhnya gelap (kontras ≥ 4,5:1). Jangan mengganti palet itu dengan warna terang tanpa mengecek kontras (ANTIREGRESI §108.2).

111.2 Jangan menambah `max-width` pada `.tg-halaman` / `.tg-grid` — konten shell memang lebar penuh (regresi lebar UI TKA, CHANGELOG 2026-11-12).

111.3 Tenggat dihitung dengan **selisih hari kalender** (`infoTenggat` di `lib/tugasUi.ts`), bukan selisih 24 jam; «lewat» bila waktu tenggat < sekarang. Nada alarm (lewat / hari ini / segera) hanya untuk tugas **aktif**; draf memakai nada netral.

111.4 Label penilaian di UI **guru** boleh singkat (Latihan/SLM/STS/SAS) dengan label lengkap di `title`. Di UI **siswa** tetap tanpa «(tidak masuk nilai)» (CHANGELOG 2026-11-11, `NAMA_JENIS_PENILAIAN_SISWA`) — jangan tertukar.

111.5 Item grid adalah `<li>` yang `display: flex` berisi `<article>`; jangan memakai `display: contents` pada `<li>` (menghilangkan semantik daftar di sebagian peramban).

111.6 Statistik ringkasan dan hitungan segmen dihitung dari **daftar penuh**, bukan hasil saringan. Urutan «Terbaru» = urutan asal dari `daftarTugasGuru` (sudah menurut `updatedAt`).

## §110. Kompetensi IPA di sebaran TKA

110.1 Kompetensi dasar = `kompleksitas` L1–L3 untuk semua mapel. Kompetensi materi: MTK & BI = `tipeMateri`; **IPA = `domainTka`** (pengetahuan / keterampilan_proses). Jangan menambahkan 11 tipe materi IPA ke `SebaranMapelTka.materi`.

110.2 Soal IPA wajib punya `kompleksitas` dan `domainTka`; tanpa domain, sebaran materi IPA kosong (rekap menampilkan peringatan).

110.3 Sebaran rentang nilai (histogram) sengaja **tidak** ditampilkan di tab mapel (permintaan pengguna: memakan ruang, belum perlu). Jika dimunculkan lagi, jadikan opsional/lipat, hanya untuk guru/admin, dan **jangan** masuk snapshot portal orang tua. Utamakan capaian kompetensi per siswa.

## §109. Sebaran capaian TKA di rekap

109.1 Sebaran dihitung **berbobot poin** (`poin ÷ maks`), bukan jumlah soal benar — skor parsial PGK / Benar-Salah ikut dihitung. Jangan kembali ke `benar === true`.

109.2 Penyebut = **seluruh soal kuis** (soal tanpa jawaban = 0 poin). Sebaran harus dihitung dari kuis & jawaban yang **sama** dengan nilai akhir yang dipilih (`nilaiOtomatisMapel`), bukan kuis lain.

109.3 Nilai manual/import (mis. Try Out I dari portal lama) tidak punya jawaban per butir. Sebarannya hanya dari field `lms_rekap_tka.sebaran[mapel]`. Mengubah/menghapus nilai manual **membuang** `sebaran[mapel]` (`deleteField`) agar tidak tampil capaian yang tak cocok dengan nilai.

109.4 Data Try Out I menyimpan **poin per kelompok** (`data/tryoutTahap1.ts`), bukan persen berbulat. Dua siswa waktu habis (Daenzel Zhafran 6A, Zakiyah Fathinah Fauziyah 6B) memakai maks sumber 36 / 37 (bukan 40) dan ditandai `waktuHabis`. Untuk tahap yang dikerjakan di LMS, penyebut tetap seluruh soal.

109.5 Bahasa Indonesia: kompleksitas L1/L2/L3 ≡ Pemahaman Tekstual / Inferensial / Evaluasi dan Apresiasi (pembagian soal sama). UI menampilkan satu tabel berpasangan (`pasangkanDimensiSama`); Matematika tetap dua dimensi terpisah.

109.6 Snapshot portal: `SebaranBarisOrtu.benar/total` kini berarti **poin/maks**. Label kompleksitas `L1 · Pemahaman / L2 · Aplikasi / L3 · Penalaran` (`NAMA_KOMPLEKSITAS_TKA`). `hitungSebaranDariDetail` lama deprecated.

109.7 Soal TKA harus berlabel `tipeMateri` (dan `domainTka` untuk IPA); bila kosong rekap menampilkan peringatan dan sebaran materi/domain tidak lengkap.

109.8 Rules `lms_rekap_tka` tidak membatasi field tambahan, jadi field `sebaran` tidak butuh deploy rules. Jangan menambah `hasOnly` tanpa memasukkan `sebaran`.

## §108. UI Bank Soal / wizard kuis (kartu `pk-*`, wizard `wz-*`)

108.1 Variabel warna `--pk-*` hanya aktif di dalam pembungkus `kelasAksenMapel(mapel)` (`pk-aksen pk-aksen--ipa|mtk|bi|umum`). Pembungkus wajib ada di root BankSoalPanel, daftar kuis, dan wizard — tanpa itu kartu jatuh ke aksen default.

108.2 Teks/tombol berwarna memakai `--pk-ink`, **bukan** `--pk-a` (teal/biru terang gagal kontras di atas putih). `--pk-a` hanya untuk bar/titik dekoratif.

108.3 Helper materi paket (`materiPaket`, `paketMemuatMateri`) satu sumber di `src/lib/aksenTka.ts`. Filter materi di Bank Soal, pengelompokan, dan wizard harus memakainya — jangan menyalin logika (paket bisa membawa materi di level paket **atau** di soal).

108.4 `KuisPanel`: semua `useState`/`useMemo` baru wajib di atas early return `langkah === 'detail' | 'wizard'` (kalau tidak: error «Rendered fewer hooks»). `resetWizard` harus ikut mereset state wizard baru (`qPaket`, `materiPaketAktif`).

108.5 Hitungan «tersedia» wizard (`tersedia`) memakai logika filter yang sama dengan `filterSusun` (TKA kosong = hanya `TIPE_SOAL_TKA`, ANTIREGRESI §88). Ubah keduanya bersamaan.

108.6 Kelas lama `.paket-item/.paket-list/.paket-grup*` di `soal.css` sudah tidak dipakai komponen; jangan dihapus tanpa cek, jangan dipakai lagi untuk kartu baru.

## §107. Snapshot sebaran TKA ke portal

107.1 Portal menampilkan sebaran hanya dari field `sebaran` di `lms_tka_hasil_ortu` — bukan hitung ulang live dari `lms_jawaban`.

107.2 Publish menghitung sebaran best-effort dari kuis sumber (`SelNilaiTka.kuisId`) + detail jawaban. Gagal sebaran **tidak** menggagalkan publish nilai akhir.

107.3 Label portal: Bahasa Indonesia / Matematika / IPA (jangan singkatan BI di UI orang tua).

107.4 IPA: `domainTka` pada soal → sebaran domain Pengetahuan IPA vs Keterampilan Proses Sains.

## §106. Publikasi Try Out TKA → portal orang tua

106.1 Portal **tidak** membaca `lms_rekap_tka` / `lms_jawaban`. Hanya snapshot `lms_tka_hasil_ortu` + gerbang `lms_tka_publikasi` + `lms_tka_peringkat`.

106.2 Publish **per kelas × tahap** (mis. 6A_I terpisah 6B_I). Ranking selalu dihitung dari **gabungan 6A+6B**.

106.3 Rata ranking: tahap I = BI+MTK; II–V = BI+MTK+IPA. Tanpa mapel wajib → tidak masuk ranking (`peringkat: null`).

106.4 Baca snapshot `allow read: if true` (portal tanpa Auth). Tulis hanya staf (`tkaBolehPublishKelas`). Deploy rules utuh.

106.5 Setelah ubah nilai rekap, wali harus **Perbarui publikasi** agar portal mendapat snapshot baru.

## §105. Rules `lms_rekap_tka`: admin TKA harus bisa baca

105.1 `allow list` / `allow get` wajib mengizinkan `tkaEmailKhusus()` **langsung** (bukan hanya di dalam `isGuru() && tkaBolehRombelRekap`). Create/update sudah benar; baca sering tertinggal.

105.2 Jangan memakai `resource.data.keys().hasAll([...])` pada `allow list` — satu dokumen tanpa field wajib menggagalkan seluruh query klien.

105.3 `tkaEmailKhusus`: bandingkan email dengan `.lower()` agar token Auth tidak gagal karena kapitalisasi.

105.4 Setelah ubah rules: deploy **firestore:rules** (bukan hanya Hosting LMS). Tanpa deploy rules, UI tetap «Missing or insufficient permissions».

## §104. Rekap TKA: nilai manual/import harus tampil

104.1 Jangan query compound `tahap` + `kelas` pada `lms_rekap_tka` kecuali composite index sudah di-deploy. Default: query satu field (`kelas` atau `tahap`), filter sisanya di klien.

104.2 Error `getDocs` (permission / failed-precondition) **wajib** dilog dan ditampilkan di UI rekap — jangan hanya `console.warn` (nilai import akan tampak «hilang»).

104.3 ID dokumen: `{KELAS}_{tahap}_{siswaId}` (`idRekapTka`). Lookup UI harus uppercase kelas yang sama dengan import.

104.4 Merge UI: nilai di dokumen `lms_rekap_tka` menang atas otomatis; terima `sumber` kosong sebagai manual.

## §103. Import rekap TKA bulk (admin)

103.1 UI `/tka/import-rekap` hanya `profil.role === 'admin'` (bukan sekadar email TKA / wali 6).

103.2 Matching: normalisasi nama + kelas exact ke koleksi `siswa`. Status ganda/tidak_ketemu tidak ditulis.

103.3 Rules: `isAdmin()` boleh create/update `lms_rekap_tka` selain jalur `tkaBolehRombelRekap`. Deploy rules bersama file utuh.

103.4 Nilai disimpan `sumber: manual` untuk `TKA Matematika` dan `TKA Bahasa Indonesia`. IPA tidak diisi dari sumber try out tahap I portal tka2026.

## §101. Reset TKA: attempt vs draf progress

101.1 `lms_jawaban` dihapus = izin mengerjakan ulang. **Tidak** menghapus draf di `localStorage` perangkat siswa.

101.2 Draf dihapus lewat marker `lms_tka_progress_reset/{kuisId}_{siswaId}` (`resetAt` / `resetAtMs`). Klien siswa wajib cek marker sebelum memakai progress lokal.

101.3 Mode CF: `attempt` | `progress` | `semua`. Default UI admin = `semua`.

101.4 Tulis marker hanya Admin SDK. Siswa hanya **read** dokumen dengan `siswaId == token.siswaId`.

101.5 Jangan mengandalkan admin dan siswa di perangkat yang sama untuk “hapus localStorage jarak jauh” tanpa marker server.

## §102. Atur kuis: tambah soal dari bank

102.1 Setelah kuis dibuat, soal hanya boleh ditambah lewat snapshot dari paket `siap` (bukan edit teks di Atur kuis).

102.2 Identitas jejak: `sumberPaketId` + `sumberSoalId`. Soal dengan `sumberSoalId` yang sudah ada di kuis tidak ditambahkan lagi.

102.3 TKA: picker hanya menampilkan/mengizinkan tipe di `TIPE_SOAL_TKA`. Mapel biasa tetap semua tipe.

102.4 `sumberPaketIds` diperbarui saat simpan bila paket baru dipakai; jangan melebihi `BATAS_PAKET_SUMBER`.

102.5 Jangan mengubah bank soal dari Atur kuis — hanya snapshot ke dokumen kuis.

## §114. CSS wajib untuk class `tka-ka-*` (dashboard kuis aktif)

114.1 Komponen `src/pages/tka/TkaKuisAktif.tsx` memakai class `tka-ka`, `tka-ka-grup`, `tka-ka-chip`, `tka-ka-item`, `tka-ka-status`, `tka-ka-buka`, dll. **Semua harus punya rule di `src/styles/tka.css`.** Tanpa CSS, teks chip + nama mapel + «N kuis» dan «Berlangsung» + «Buka →» menempel jadi satu kata.

114.2 Saat menambah class `tka-ka-*` baru di TSX, tulis style di `tka.css` dalam blok yang sama (cari «Kuis TKA aktif di dashboard»). Jangan mengandalkan utility Tailwind saja untuk elemen yang sudah memakai class khusus ini.

114.3 `.tka-rekap-controls`: panel portal sudah tab; jangan memaksa `grid-template-columns: … 1fr` dua kolom jika hanya ada toolbar filter (pakai `:has(> :only-child)` / `:has(> :nth-child(2))`).

## Lomba (modul baru)

### §Lomba.1 Menu siswa hanya untuk peserta
Menu **Lomba** di nav siswa hanya ditampilkan jika `daftarLombaSiswa(siswaId)` mengembalikan ≥1 dokumen (query `siswaIds` array-contains). Jangan hardcode tampil untuk semua kelas.

### §Lomba.2 Peserta maksimal 20
Validasi di client (`MAKS_PESERTA_LOMBA`) **dan** rules (`siswaIds.size() <= 20`, `siswaList.size() <= 20`). Selalu jaga `siswaIds` selaras dengan `siswaList`.

### §Lomba.3 Meta hanya admin; konten admin atau pengampu
Create/update/delete dokumen `lms_lomba` (nama, pengampu, peserta, mapel terkait, masa) = **admin saja**. Guru pengampu (`guruPengampuUid`) baru boleh menulis konten turunan (materi/bank/kuis dengan `lombaId`) di Tahap 2 — jangan izinkan guru mengubah meta lewat rules.

### §Lomba.4 Mapel terkait membatasi TP
Field `mapelTerkait: string[]` wajib ≥1. Pada Tahap 2, filter TP / mapel di form materi-bank-kuis lomba harus memakai daftar ini (admin boleh filter TP penuh per mapel terkait; guru pengampu mengikuti mapel lomba tanpa filter admin ekstra).

### §Lomba.5 List users hanya admin
Dropdown guru pengampu memakai `getDocs(users)` — rules `users` hanya `allow list: if isAdmin()`. Jangan panggil dari akun guru.

### §Lomba.6 Lebar & tampilan modul baru (wajib)

Regresi berulang: halaman modul baru (Lomba, dan kelak fitur lain) memakai `max-w-3xl` / `max-w-6xl` + kartu generik putih, sehingga di layar lebar muncul **strip kosong kiri-kanan** dan UI terasa template kosong.

**Aturan:**

1. Wrapper halaman daftar/dashboard/form modul **tidak** memakai `max-w-3xl`, `max-w-4xl`, atau `max-w-6xl`. Konten mengisi `.lms-content` (sudah `max-width: 1600px`).
2. Form panjang: gunakan **grid 2 kolom** di desktop (lihat `.lomba-form`), bukan kolom sempit di tengah.
3. Halaman daftar wajib punya **hero** (gradient + judul + lead) dan **kartu grid** dengan meta/badge — pola referensi: `tka-dash-*` / `lomba-*`. Jangan hanya judul + daftar border generik.
4. CSS modul baru taruh di `src/styles/{modul}.css` dan di-import di halaman; jangan mengandalkan utility Tailwind sempit untuk layout halaman.

### §Lomba.7 Konten kelas bank LB + lombaId
Materi/paket/kuis lomba disimpan dengan `kelas == "LB"` dan field **`lombaId`**. Query wajib `where lombaId` + `mapel`. Jangan campur dengan ruang kelas biasa. Rules: `lombaKontenBoleh(lombaId)`. **`lombaId` WAJIB benar-benar ditulis ke dokumen** pada setiap fungsi pembuat konten lomba (`buatPaket`, `tambahMateri`, `buatKuisDariPaket`) — lihat §Lomba.10.

### §Lomba.8 Prop opsional untuk panel bersama: jangan di-destructure bila tak dipakai
Build deploy (`tsc -b`) gagal dengan `TS6133 'tpKelas' is declared but its value is never read` di `KuisPanel`. Panel bersama (`MateriPanel`, `BankSoalPanel`, `KuisPanel`) menerima `lombaId` / `tpKelas` opsional dari `LombaDetail`, tetapi **tidak semua panel memakai kedua prop**. `KuisPanel` hanya memakai `lombaId` (TP kuis berasal dari paket sumber).

**Aturan:**
1. Prop yang tidak dipakai sebuah panel tetap dideklarasikan di tipe `Props` (agar pemanggil seragam), tetapi **jangan** dimasukkan ke destructuring parameter — `noUnusedLocals`/`noUnusedParameters` menolaknya.
2. Saat menambah prop baru ke panel bersama, periksa tiap panel: destructure hanya yang benar-benar dibaca.
3. Selalu jalankan `npx tsc -b` (atau `npm run build`) sebelum `npm run deploy`; jangan mengandalkan Vite dev server yang tidak mengecek tipe.

### §Lomba.9 Nama kelas CSS ganda & kesamaan tampilan dengan ruang kelas
Regresi: bar mapel di detail lomba tampil terhimpit (tombol mapel membulat, «TP dari kelas» terpotong per kata) karena `.lomba-mapel-bar` dipakai **dua kali** di `lomba.css` — bilah warna kartu mapel form (`width: 0.28rem; align-self: stretch`) dan baris filter mapel. Aturan CSS bergabung, lebar bilah ikut terbawa.

**Aturan:**
1. Sebelum menambah kelas CSS baru, `grep -n "nama-kelas" src/styles/*.css` — jangan memakai ulang nama yang sudah ada di file yang sama dengan arti berbeda. Filter mapel detail lomba = `.kn-bar.lomba-ruangbar`; pemilih TP = `.lomba-tp`.
2. Tab detail lomba memakai `rg-tabs`/`rg-tab` (ruang.css) dan filter mapel memakai `KnChips` (KuisNav) agar selaras dengan ruang kelas/TKA. Jangan membuat tab/pill khusus Lomba lagi.
3. `.rg-tabs` punya `--rg-a` bawaan ungu; aksen mapel wajib diset **inline pada elemen `.rg-tabs`** (bukan hanya pembungkus), seperti `KelasDetail`.
4. Aksen = `aksenMapel(mapelAktif).bar` lewat `--rg-a` pada pembungkus `lomba-dash`, agar `kn-*` di dalam panel Kuis ikut berwarna mapel.
5. Cek visual halaman baru di lebar ≤ 640 px dan ≥ 1280 px sebelum deploy; jalankan `npx tsc -b` (§Lomba.8).

### §Lomba.10 `lombaId` harus ikut ditulis ke dokumen (permission denied saat import / buat paket / tambah materi)
Regresi: **Import soal**, «+ Paket soal baru», dan tambah materi di Lomba gagal `Missing or insufficient permissions`. Penyebab: fungsi pembuat (`buatPaket` di `soal.ts`, `tambahMateri` di `materi.ts`) mendeklarasikan `lombaId?: string` di tipe input dan pemanggil (`BankSoalPanel`, `MateriPanel`) mengirimnya, tetapi objek yang ditulis ke Firestore **tidak memuat `lombaId`**. Rules `create` kelas `LB` mensyaratkan `'lombaId' in request.resource.data && lombaKontenBoleh(...)`, dan admin tidak lolos `lmsTulisMapelKelas`, jadi semua penulis ditolak. TypeScript tidak mendeteksinya (prop opsional yang diterima tapi tak dipakai tidak error).

**Aturan:**
1. Setiap fungsi pembuat konten yang menerima `lombaId` **wajib** menulisnya: `...(input.lombaId ? { lombaId: input.lombaId } : {})` (atau `payload.lombaId = …`). Mendeklarasikan di tipe saja tidak cukup. Saat menambah modul/koleksi konten lomba baru (tugas, bobot SLM, dst.), cek ketiga fungsi di atas sebagai contoh dan **grep `lombaId` pada fungsi tulisnya**.
2. Konten kelas `LB` **tanpa** `lombaId` tidak akan pernah lolos rules (tulis maupun baca). Jangan melonggarkan rules untuk menutupi field yang hilang.
3. Cabang **baca** Lomba harus ada di setiap koleksi yang dibaca pengampu: `lms_paket_soal` dan `lms_kuis` memakai `isGuru() && 'lombaId' in resource.data && lombaKontenBoleh(resource.data.lombaId)`. Tanpa itu guru pengampu non-admin gagal memuat daftar (kelas `LB` tidak ada di `penugasanKelasMapel`). Query klien wajib `where lombaId` + `mapel` (`daftarPaketLomba`, `daftarKuisLomba`, `daftarMateriLomba`); query hanya `kelas == 'LB'` ditolak untuk non-admin.
4. Uji setelah perubahan: buat paket dan import soal di dalam Lomba dengan **akun admin** dan **akun guru pengampu non-admin**, lalu muat ulang tab Bank soal. Cek di Firebase Console bahwa dokumen baru punya field `lombaId`.
5. Diketahui, belum diperbaiki: `KuisDetail` («Tambah dari bank») dan `buatKuisDariPaket` (jalur otomatis tanpa `soalSiap`) memanggil `daftarPaket`/`daftarPaketSiap` per kelas `LB` tanpa `lombaId`; aman untuk admin, tetapi ditolak untuk guru pengampu non-admin. Perbaiki (pakai `daftarPaketLomba`) sebelum pengampu non-admin menyusun kuis lomba dari jalur itu.

### §Lomba.11 Salinan `firestore.rules` di repo LMS bisa basi — basis selalu dari SDM01Penilaian
Regresi: `firestore.rules` di repo `nitoe/lms` tidak memuat rules Lomba (`lms_lomba`, `lombaKontenBoleh`, cabang `LB` pada materi/paket/kuis/tugas/bobot) walau CHANGELOG mencatatnya, sementara versi di `SDM01Penilaian` (sumber deploy `npm run deploy:rules`) memuatnya. Mengedit salinan basi lalu men-deploy akan **menghapus** rules Lomba di production.

**Aturan:**
1. Sebelum mengubah `firestore.rules`, ambil versi terbaru dari **`SDM01Penilaian`** (bukan salinan di `lms`), terapkan perubahan, lalu kirim file **utuh** untuk kedua repo dengan isi identik.
2. Pastikan keluaran tidak kehilangan blok milik repo lain: bandingkan dengan `diff` terhadap versi Penilaian — hanya baris yang memang diubah yang boleh berbeda.
3. Setelah mengubah rules di repo mana pun, salin ke repo satunya agar tidak berselisih lagi.

### §Lomba.12 Kelas bank «LB» bukan ruang kelas: navigasi balik harus ke dashboard Lomba

1. Paket/materi/kuis Lomba disimpan dengan `kelas = 'LB'` (`KELAS_LOMBA_BANK`) hanya agar rules & query seragam. «LB» **bukan** ruang kelas: tidak ada di penugasan guru, tidak tampil di `/kelas`. Jangan pernah mengarahkan pengguna Lomba ke `/kelas/LB--…`; hasilnya halaman «Kelas LB» dan daftar «Ruang Kelas» kosong (juga untuk admin).
2. `BankSoalPanel` dengan prop `lombaId` WAJIB menambahkan `?lomba=<lombaId>` pada setiap tautan/navigasi ke `/kelas/:ruangId/soal/:paketId` (`qLomba`). Tautan editor baru dari konteks Lomba harus meniru ini.
3. `SoalEditor`: tujuan kembali = `/lomba/<id>?tab=soal&mapel=<mapel>` bila ada lombaId (query `?lomba=` dahulu — tersedia sebelum paket selesai dimuat — lalu `paket.lombaId`); `/lomba` bila kelas `LB` tanpa lombaId; selain itu `/kelas/<ruangId>?tab=soal`. Jangan mengembalikan `kembaliKe` menjadi konstanta `/kelas/...`.
4. `LombaDetail` membaca `?tab=` (ringkas/materi/kuis/soal) dan `?mapel=` (harus ada di `mapelTerkait`). Jangan menghapusnya — dipakai tombol kembali editor.
5. `KelasDetail` mengalihkan kelas `LB` ke `/lomba` sebagai jaring pengaman untuk bookmark/tautan lama.
6. «Ruang Kelas» kosong di akun admin itu normal (daftar hanya dari `penugasan`/`waliKelas` profil), jangan dianggap bug dan jangan «diisi» dengan ruang LB.
7. Uji: Lomba → Bank Soal (mapel B) → Buka paket → ← mendarat di tab Bank Soal mapel B pada lomba yang sama; ruang kelas biasa & TKA tetap kembali ke tab soal ruangnya.

## §129. Template & import bank soal: «Tanpa TP» dan parser CSV

129.1 Bank soal mapel biasa (termasuk Lomba, kelas bank `LB`) **boleh tanpa TP**: `tpId/tpNomor/tpNama` opsional di `lms_paket_soal` (rules tidak mewajibkannya — jangan menambah syarat TP di rules/klien). Kuis dari paket tanpa TP tetap sah (`tpIds` dihitung hanya dari paket yang punya `tpId`).

129.2 Pilihan «Tanpa TP» di dropdown unduh/import memakai konstanta `VALUE_TANPA_TP` (`'__tanpa__'`) dari `importSoal.ts` — **jangan** mencocokkan `tpList.find(id === ...)` untuk nilai ini (menghasilkan `null` dan membuat `validasiMetadata(..., null)` meloloskan file tanpa pengecekan TP). Mode tanpa TP **wajib** lewat `validasiMetadataTanpaTp`.

129.3 Mode tanpa TP menolak file yang memuat TP; mode «pilih TP» menolak file tanpa TP. Paket yang sudah ada tanpa `tpId` divalidasi dengan `validasiMetadataTanpaTp` (bukan `validasiMetadata`). Jangan melonggarkan ke «terima semua» — tujuannya mencegah soal ber-TP tercampur ke bank gabungan tanpa disadari. (Yang boleh kosong hanya `mapel`, lihat §130.3; larangan memuat TP tetap berlaku.)

129.4 Template per-TP dan «Tanpa TP» berbagi contoh soal lewat `contohSoalMapel()`; ubah contoh di satu tempat. Struktur template per-TP (`mapel, tpId, tpNomor, tpNama, catatan, soal`) tidak boleh berubah (dipakai validasi).

129.5 **Parser CSV:** `normalisasiSoalDariImport` membaca kunci camelCase (`opsiA`, `tipeMateri`, `kompleksitas`, `waktuMenit`, `kunciJawaban`). `parseCsvImport` WAJIB menyimpan nilai sel di bawah nama header asli **dan** huruf kecil. Regresi lama: hanya huruf kecil → semua soal PG/PGK CSV ditolak («minimal 2 opsi») dan template CSV tidak pernah bisa diimpor.

129.6 CSV dipecah dengan `pecahCsv` (bukan `split(',')`): kutip ganda, koma/baris baru di dalam sel, pemisah `,`/`;` otomatis, BOM dibuang. Jangan kembali ke `split(',')` — teks soal sering memuat koma (mis. «3,5») dan Excel regional Indonesia memakai `;`.

129.7 Setelah mengubah `importSoal.ts`, uji minimal: template JSON & CSV (per-TP, Tanpa TP, TKA) → parse tanpa galat dan lolos validasi yang sesuai; CSV ber-`;` dengan koma di teks; file ber-TP ditolak di mode Tanpa TP dan sebaliknya.


## §130. Import bank soal: galat susulan palsu, JSON toleran, `mapel` kosong di mode Tanpa TP

130.1 **Jangan menjalankan validasi metadata bila isi file gagal dibaca.** `parseJsonImport`/`parseCsvImport` menandai `gagalParse: true` untuk JSON rusak, isi bukan objek/daftar, dan CSV kosong. Kedua pemanggil di `BankSoalPanel.tsx` (`prosesImport` dan `prosesImportKePaket`) WAJIB memakai `hasil.gagalParse ? [...hasil.galat] : [...galatMeta, ...hasil.galat]`. Regresi lama: JSON rusak → `mapel: ''` → muncul «File import tidak memuat mata pelajaran» di atas «File JSON tidak valid», sehingga pengguna mencari kesalahan di tempat yang salah. Setiap pemanggil baru `parse*Import` harus meniru pola ini.

130.2 **JSON diparse toleran, tidak ketat.** `parseJsonImport` mencoba `JSON.parse` apa adanya, lalu `rapikanJson` (BOM/zero-width, pagar ```` ```json ````, teks di luar kurung terluar, komentar, koma sisa, baris baru/tab mentah dalam string). Jangan menghapus langkah rapikan: file hasil salinan AI hampir selalu tidak 100% valid. `rapikanJson` bersifat sadar-string (tidak menyentuh `//`, `,` atau `]` di dalam teks soal, mis. URL) — uji dengan teks soal yang memuat `http://` dan `, ]`. Kutip miring (“ ”) **sengaja tidak** diperbaiki otomatis (tidak bisa dibedakan dari isi teks); pesan galat menunjuk ke sana.

130.3 **`mapel` boleh kosong hanya di mode «Tanpa TP»** (`validasiMetadataTanpaTp`): file tanpa TP sering berupa daftar soal polos `[...]`; mapel diwarisi dari ruang/paket tujuan. Bila diisi, harus cocok. Mode «pilih TP» (`validasiMetadata`) dan TKA (`validasiMetadataTka`) tetap mewajibkan mapel — jangan ikut dilonggarkan. File yang memuat TP tetap ditolak di mode Tanpa TP (§129.3).

130.4 **Pesan galat parse harus menunjuk lokasi** (baris/kolom + cuplikan, dari `position N` pada pesan `JSON.parse`). Jangan kembali ke pesan datar «File JSON tidak valid.» tanpa petunjuk.

130.5 Uji setelah mengubah `importSoal.ts` (tambahan atas §129.7): JSON ber-BOM, berpagar kode, koma sisa, komentar, baris baru mentah, teks pembuka; daftar polos tanpa `mapel` di mode Tanpa TP (lolos) dan di mode pilih TP (ditolak «tidak memuat mata pelajaran»); JSON rusak → **tepat satu** galat; `null`/angka → pesan «harus berupa objek… atau daftar».

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

### §Lomba.13 Kuis gabungan lintas mapel: `mapel = 'Gabungan'`, paket se-lomba, jangan pakai `daftarPaket('LB', mapel)`

1. Kuis lintas mapel disimpan dengan `mapel = MAPEL_GABUNGAN_LOMBA` (`'Gabungan'`, `lombaAkses.ts`) dan `lombaId`. Jangan mengubah nilainya (kuis lama bergantung padanya) dan jangan menjadikan «Gabungan» mapel sungguhan di tempat lain (TP, materi, bank soal, Penilaian/rekap). Rules `lms_kuis` hanya mensyaratkan `mapel` string 1–80 karakter — jangan menambah whitelist mapel di rules tanpa mengakomodasi nilai ini.
2. Sumber paket Lomba SELALU lewat `lombaId`: `daftarPaketLomba(lombaId, mapel)` (satu mapel) atau `daftarPaketLombaSemua(lombaId)` (lintas mapel; query hanya `lombaId` agar lolos cabang rules guru pengampu). Untuk kuis yang sudah ada gunakan `daftarPaketUntukKuis(kuis)` (`kuis.ts`). **Jangan** `daftarPaket(kuis.kelas, kuis.mapel)` / `daftarPaketSiap` untuk kelas «LB»: tercampur antar-lomba dan ditolak rules bagi guru pengampu non-admin (query tidak memuat `lombaId`). Regresi lama ada di `KuisDetail` (Tambah dari bank, Perbarui TP).
3. `KuisPanel` menerima `mapelGabungan` (array) — di dalam komponen WAJIB dipakai lewat kunci string (`kunciMapelGab = join('|')`) pada dependency `useCallback`; array prop berubah identitas tiap render dan memicu `muat()` berulang tanpa henti.
4. Di `LombaDetail`, «Gabungan» hanya muncul di tab Kuis dan hanya bila lomba punya ≥ 2 mapel. Di tab Materi/Bank Soal pilihan itu dipetakan ke mapel pertama (`mapelPanel`); `BankSoalPanel`/`MateriPanel` tidak boleh menerima mapel «Gabungan» (ruangId `LB--Gabungan` tidak bermakna).
5. Daftar kuis Lomba tidak boleh menggabungkan `daftarKuisDibuatOleh()` (kelas «LB» milik pembuat dari lomba lain). `KuisPanel` melewati penggabungan itu bila `lombaId` ada.
6. Kuis gabungan tidak boleh masuk Penilaian/rekap per mapel: panel «Penilaian & TP» disembunyikan (`adalahMapelGabungan`), jenis penilaian tetap «latihan». Bila kelak ada sinkron nilai, kecualikan `mapel === 'Gabungan'`.
7. `SoalKuis.sumberMapel` diisi `snapshotSoal` bila paket membawa `mapel`; kuis lama tidak punya field ini — kode yang membacanya harus menganggapnya opsional.
8. Sisi siswa untuk kuis Lomba belum ada (`/siswa/lomba/:id` belum dirutekan; rules siswa membaca `lms_kuis` lewat `kelas == token.kelas`, bukan «LB»). Saat dibuat, tambahkan cabang rules baca siswa untuk `lombaId` (peserta: `request.auth.token.siswaId in lomba.siswaIds`) dan deploy rules.
9. Uji: lomba ≥ 2 mapel → buat paket Siap di dua mapel → Kuis → Gabungan → pilih paket kedua mapel → pratinjau memuat soal campuran → simpan → buka kuis → «Tambah soal dari bank» menampilkan paket kedua mapel (juga untuk akun guru pengampu non-admin).


### §Lomba.14 Kuis gabungan: preset jumlah soal & saring paket tidak membatasi penyusunan

1. Preset jumlah soal di wizard kuis (`PRESET_JUMLAH` di `KuisPanel.tsx`) mencakup **40** dan **50** di samping 10–30. Batas keras tetap `BATAS_SOAL_PER_KUIS` (100) di `types/kuis.ts` dan `susunOtomatis`. Jangan menghapus 40/50 tanpa alasan; lomba sering memakai 30–50 soal.
2. Saring Mapel (chip) di langkah «Pilih paket soal» mode Gabungan **hanya memfilter tampilan** (`paketTampil`). `paketIds` dan `kandidat`/`susunOtomatis` memakai **seluruh paket yang dicentang**, termasuk yang sedang disembunyikan saring. Jangan memfilter `kandidat` dengan `mapelPaketAktif`.
3. Tombol «Pilih semua yang tampil» menghormati saring; tombol **«Pilih semua paket Siap»** (Gabungan saja) mengabaikan saring dan mencentang semua `paketSiap`. Keduanya harus tetap ada.
4. Saat saring mapel aktif dan ada paket terpilih dari mapel lain, UI menampilkan ringkasan «Terpilih: …» agar pengguna tidak mengira centang hilang.
5. Uji: Lomba ≥2 mapel → Gabungan → saring ke satu mapel → centang paket → saring ke mapel lain → centang lagi → ringkasan menunjukkan kedua mapel → Susun pratinjau → soal berasal dari kedua paket; preset 40/50 tersedia dan menghasilkan jumlah sesuai stok.


### §Lomba.15 Simpan kuis Lomba / Gabungan: cabang create `lms_kuis` harus Lomba-first + deploy rules

1. Create dokumen `lms_kuis` untuk Lomba memakai `kelas == 'LB'`, field `lombaId`, dan (untuk lintas mapel) `mapel == 'Gabungan'`. Rules **wajib** punya cabang:
   `lombaKelasBank(kelas) && 'lombaId' in data && lombaKontenBoleh(lombaId)`.
2. Letakkan cabang Lomba **sebelum** `lmsTulisMapelKelas` dalam ekspresi OR create, agar mapel non-penugasan («Gabungan», mapel lomba yang tidak diampu guru di ruang biasa) tidak bergantung pada urutan evaluasi.
3. `lombaKontenBoleh` melakukan `exists` + `get` pada `lms_lomba/{lombaId}` — get harus diizinkan untuk admin dan guru pengampu (sudah diatur di match `lms_lomba`). Jika create gagal permission sementara list paket Lomba berhasil, cek apakah rules yang **ter-deploy** di proyek Firebase sudah memuat cabang Lomba pada `lms_kuis` (bukan hanya di repo).
4. Klien (`buatKuisDariPaket`) wajib menulis `lombaId` bila `input.lombaId` ada — jangan hanya mengandalkan kelas «LB». Tanpa `lombaId` di dokumen, cabang Lomba ditolak (sengaja, agar tidak ada kuis bank LB yatim).
5. Setelah mengubah `firestore.rules`, selalu `firebase deploy --only firestore:rules` (atau pipeline yang mem-deploy rules). Deploy Hosting saja tidak cukup.
6. Uji: admin atau guru pengampu → Lomba → Kuis → Gabungan → pilih paket → susun → simpan → dokumen `lms_kuis` terbentuk dengan `kelas: "LB"`, `mapel: "Gabungan"`, `lombaId` terisi.


### §Lomba.16 Admin LMS di rules = role admin ATAU email arif.nitoe@gmail.com

1. Klien (`adalahAdminLms` di `lombaAkses.ts`) mengizinkan admin lewat `peranDari === 'admin'` **atau** email `arif.nitoe@gmail.com`. Rules sebelumnya hanya `myRole() == 'admin'`. Ketidakselarasan ini menyebabkan UI admin tetapi create/update konten Lomba (`lms_kuis` / paket / materi kelas `LB`) ditolak permission.
2. **(Dikoreksi §Lomba.19)** Rules memakai `isAdminLmsEmail()` (token email lower-case == `arif.nitoe@gmail.com`, + `akunAktif()`) HANYA lewat `lombaAdmin() = isAdmin() || isAdminLmsEmail()`. `isAdmin()` global JANGAN diubah (dipakai Penilaian, Perpustakaan, Sarpras).
3. Setelah mengubah definisi `isAdmin`, deploy **firestore.rules** ke proyek `sdm01kukusan-2e735`. Jangan mengandalkan hanya deploy Hosting.
4. Idealnya dokumen `users/{uid}` untuk akun itu juga `role: "admin"` (sumber kebenaran Penilaian); email fallback melindungi bila role belum tersinkron.
5. Uji: login `arif.nitoe@gmail.com` → Lomba → Kuis → Gabungan → pilih paket → susun pratinjau → **Simpan** → dokumen `lms_kuis` terbentuk (`kelas: "LB"`, `mapel: "Gabungan"`, `lombaId` terisi).


### §Lomba.17 UPDATE dokumen Lomba (`lms_kuis`, `lms_materi`, `lms_tugas`) ditolak karena aturan `kelasList` — akar «Missing or insufficient permissions» saat menyimpan kuis Lomba

1. **Akar sebenarnya.** Pada UPDATE, `request.resource.data` adalah dokumen HASIL gabungan, bukan hanya field yang dikirim. Kuis Lomba dibuat dengan `kelasList: ['LB']` (`normalisasiKelasList('LB')`), jadi `'kelasList' in request.resource.data` SELALU true pada setiap update berikutnya (aktifkan, ubah judul/soal, atur jadwal, simpan). Aturan lama lalu mewajibkan `lmsKelasListBoleh(mapel, ['LB'])` → `lmsTulisMapelKelas` per-kelas «LB» → false untuk admin maupun guru pengampu (tidak ada penugasan «LB::mapel»). Perbaikan create-only (§Lomba.15–16) tidak menyentuh jalur ini.
2. **Rules wajib** punya `lombaKelasListSah(list)` (`list is list && size()==1 && list[0]=='LB'`) dan cabang `('lombaId' in resource.data && lombaKelasListSah(request.resource.data.kelasList))` di klausa kelasList update `lms_materi`, `lms_kuis`, `lms_tugas`. Konten Lomba TIDAK boleh dibagikan ke rombel (`aturBerbagiKuis` tidak dipakai di Lomba).
3. **Jangan** menghapus `kelasList` dari payload create Lomba sebagai «solusi»: query/rules kelas lain bergantung pada field itu; perbaiki di rules.
4. Cabang baca Lomba pada `lms_paket_soal` & `lms_kuis` TIDAK lagi bergantung pada `isGuru()`; cukup `'lombaId' in resource.data && lombaKontenBoleh(lombaId)` (admin via email tidak ber-role admin/guru di `users`). `lms_materi` read menambah `lombaAdmin()`.
5. Cabang create Lomba didahulukan (Lomba-first) di `lms_materi`, `lms_paket_soal`, `lms_kuis`, `lms_tugas`, `lms_nilai_tugas`; `lombaKontenBoleh` kini juga mensyaratkan `akunAktif()`.
6. Uji (urut, akun `arif.nitoe@gmail.com` DAN akun guru pengampu): Lomba → Kuis → Gabungan → susun → **Simpan** (create) → buka kuis → **Aktifkan** / ubah judul / hapus satu soal (update) → keduanya sukses. Akun guru lain (bukan pengampu) tetap ditolak.
7. File `firestore.rules` bersifat BERSAMA: harus disalin UTUH ke repo SDM01Penilaian lalu `npm run deploy:rules`. Mengubah rules di repo lms saja TIDAK berefek di Firebase.

### §Lomba.18 Draf lokal wizard «Susun kuis» (localStorage)

1. `src/lib/kuisDraf.ts` menyimpan kemajuan wizard (judul, deskripsi, paket, mode, filter, pilihan manual, pratinjau) di `localStorage` kunci `lms:kuis-draf:v1:{uid}:{lomba:ID|kelas:K}:{mapel}`. Murni sisi klien — TIDAK melewati firestore.rules, jadi tetap berfungsi saat simpan ke Firestore gagal.
2. Autosave debounce 500 ms saat `langkah === 'wizard'`, plus flush di `pagehide`/`beforeunload` dan di tombol «Batal dan kembali». Wizard KOSONG tidak boleh menimpa draf lama (`drafKuisKosong`).
3. Draf dihapus HANYA saat simpan sukses (`buatKuisDariPaket` resolve) atau «Buang draf» / memilih mulai kuis baru di dialog. `resetWizard()` sengaja TIDAK menghapus draf.
4. Kuota penuh → ulang tanpa `pratinjau` (hasil `tanpa-pratinjau`); gagal total → pesan di wizard. Selalu dibungkus try/catch (mode privat/diblokir).
5. Error `permission-denied` saat simpan menampilkan pesan khusus (deploy rules) dan memanggil `simpanDrafSegera()`; draf tidak boleh hilang pada jalur galat.
6. Hook draf WAJIB berada di atas `return` bersyarat `KuisPanel` (aturan hooks). Jangan memindahkannya ke dalam cabang `langkah === 'wizard'`.
7. Uji: isi wizard → hard reload (Ctrl+Shift+R) → daftar kuis menampilkan banner «Draf kuis belum disimpan» → Lanjutkan → semua isian & pratinjau kembali; simpan sukses → banner hilang.

### §Lomba.19 Email admin LMS hanya discope ke modul Lomba

1. `isAdminLmsEmail()` + `lombaAdmin()` dipakai oleh `lms_lomba`, `lombaKontenBoleh`, dan baca `lms_materi`. `isAdmin()` global TIDAK dimodifikasi agar akun itu tidak otomatis admin di Penilaian/Perpustakaan/Sarpras tanpa role di `users`.
2. Akun tetap sebaiknya ber-`role: "admin"` di `users/{uid}` agar fitur non-Lomba (mis. daftar pengampu/siswa) konsisten dengan UI.
3. Jika menambah koleksi Lomba baru, pakai `lombaAdmin()` / `lombaKontenBoleh()`, bukan `isAdmin()`.


### §Lomba.20 Menu Lomba siswa: kartu di Beranda + nav, satu sumber data, galat tidak ditelan diam

1. Dashboard siswa (`SiswaBeranda.tsx`) punya daftar kartu SENDIRI (`MENU`) terpisah dari nav (`SiswaLayout.tsx`). Menu baru siswa wajib ditambahkan di KEDUANYA; sebelumnya Lomba hanya ada di nav sehingga «tidak ada menu Lomba» di dashboard.
2. Keterdaftaran dibaca lewat satu hook `src/pages/siswa/useLombaSiswa.ts` (`daftarLombaSiswa(sesi.id)`), dipakai nav dan Beranda. Jangan menduplikasi query di komponen.
3. Kartu/nav Lomba tampil hanya bila siswa terdaftar di ≥1 lomba non-arsip. Kartu disisipkan SEBELUM kartu «Segera» (Pencapaian).
4. Hook mencatat `console.warn` saat query gagal (mis. `permission-denied`); jangan kembali ke `.catch(() => {})` kosong. Jika menu tidak muncul padahal siswa terdaftar: buka konsol browser siswa → bila `permission-denied`, deploy `firestore.rules` terbaru (SDM01Penilaian → `npm run deploy:rules`); bila tidak ada galat, periksa `siswaIds` di dokumen `lms_lomba` memuat ID siswa (ID dokumen `siswa`, sama dengan claim `siswaId`).
5. Uji: login siswa peserta → Beranda menampilkan kartu Lomba dan nav menampilkan «Lomba»; siswa non-peserta tidak melihat keduanya.


### §Lomba.21 List `lms_lomba` untuk siswa: jangan pakai predikat tipe pada `resource.data`

1. Gejala: konsol siswa `daftarLombaSiswa gagal … Missing or insufficient permissions` → menu/kartu Lomba tidak pernah muncul.
2. Akar: cabang siswa pada `allow list` memuat `resource.data.siswaIds is list`. Untuk query list, Firestore harus membuktikan aturan benar untuk SEMUA dokumen yang cocok dengan filter; predikat tipe (`is list`, `is string`) pada field tidak dapat dibuktikan dari filter `array-contains`, sehingga query ditolak walau tiap dokumen sebenarnya lolos. Pola yang terbukti jalan (kuis siswa): `request.auth.token.kelas in resource.data.kelasList` tanpa predikat tipe.
3. Aturan benar: `isSiswaLms() && request.auth.token.siswaId in resource.data.siswaIds`. Bila `siswaIds` bukan list, operator `in` gagal → ditolak, jadi keamanan tidak berkurang.
4. Berlaku umum: pada cabang `allow list` hanya pakai kondisi yang selaras dengan filter query (kesetaraan / `in` terhadap filter), bukan predikat tipe atau fungsi bantu yang membaca field lain. `allow get` boleh lebih ketat.
5. Wajib deploy `firestore.rules` (SDM01Penilaian → `npm run deploy:rules`). Uji: login siswa peserta → konsol tanpa galat → kartu Lomba muncul di Beranda dan nav.








### §Lomba.28 Multi guru pengampu

1. Dokumen `lms_lomba` menyimpan `guruPengampuUids: string[]` + `guruPengampuList: {uid,nama,email?}[]` (maks 10). Field `guruPengampuUid`/`Nama`/`Email` = elemen pertama (legacy).
2. **Hanya admin** create/update meta & daftar pengampu. Pengampu **tidak** boleh membuat lomba baru.
3. Akses konten (materi/bank/kuis/hasil/reset): admin **atau** uid ∈ `guruPengampuUids` (fallback `guruPengampuUid`).
4. List guru: query `array-contains` pada `guruPengampuUids` **dan** `guruPengampuUid == uid`, hasil digabung unik di klien. Rules list mengakui kedua predikat.
5. Form admin: multi-pilih staf (bukan radio tunggal).

### §Lomba.27 Skor kuis Lomba ke siswa hanya setelah publikasi

1. Setelah submit, UI siswa **jangan** menampilkan skor — pakai pola TKA: «Jawaban terkirim» + kotak amber «Nilai belum dipublikasikan».
2. Skor/rincian baru tampil jika `kuis.hasilDipublish === true`.
3. Guru/pengampu mempublikasikan lewat `HasilKuisPanel` (toggle sama TKA, juga aktif untuk `lombaId`).
4. Di daftar kartu kuis lomba: tanpa skor sampai dipublish («nilai belum dipublikasikan»).

### §Lomba.26 Kirim jawaban Lomba (CF) + hasil roster + reset

1. **`nilaiKuisLms`:** selain kelas==siswa / TKA bank 6, izinkan kuis `kelas=='LB'` + `lombaId` jika `siswaId ∈ lomba.siswaIds`. Tolak tetap pesan «Kuis bukan untuk kelasmu.»
2. Dokumen `lms_jawaban` untuk Lomba **wajib** menyimpan `lombaId` (denormalisasi). Field `kelas` tetap **rombel siswa**, bukan `LB`.
3. **Rules baca `lms_jawaban`:** cabang `lombaId` + `lombaKontenBoleh` (pengampu/admin). Query hasil: `where kuisId + lombaId` — **jangan** `where kelas=='LB'`.
4. **Hasil:** tabel roster dari `lomba.siswaList` (semua peserta), gabung jawaban terbaru; status «Belum mengerjakan» bila null. Reset attempt = CF `resetJawabanKuisLms` mode `semua` (hapus `lms_jawaban` + marker progress lokal).
5. Deploy functions di repo SDM01Penilaian; rules di LMS. Index Firestore: `lms_jawaban` composite `kuisId` + `lombaId` bila konsol meminta.

### §Lomba.25 Mulai kerjakan = mode pengerjaan, bukan sekadar detail

1. Tombol **Mulai kerjakan** di daftar lomba siswa wajib membawa `?mulai=1` (atau setara) sehingga detail **auto-start** kuis yang jadwalnya buka — jangan hanya `Link` ke detail tanpa aksi.
2. Info Masa/Pengampu/Peserta di detail siswa diletakkan di **hero** (`.lomba-hero-meta`), bukan `lomba-kartu` + `lomba-kartu-meta` tanpa padding atas (konten menempel border).
3. Mode pengerjaan memakai kerangka `sw-kuis-kerja` / pola TKA, bukan layout ad-hoc.

### §Lomba.24 UI siswa Lomba: CTA daftar + kartu kuis non-generik

1. Daftar lomba siswa: tombol kaki **Mulai kerjakan** jika `daftarKuisLombaAktif` menghasilkan ≥1 kuis dengan jadwal buka (aktif + dalam `waktuMulai`/`waktuSelesai`); selain itu **Lihat detail**. Jangan hardcode selalu «Lihat detail».
2. Kartu kuis di detail memakai kelas `.lomba-kuis-*` + `.lomba-cta-mulai` (aksen oranye Lomba). Jangan mengandalkan hanya `.tka-kartu` polos di halaman Lomba — terasa template generik (§Lomba.6).
3. Hint «N kuis siap dikerjakan» opsional di kartu daftar bila ada yang buka.

### §Lomba.23 Kuis Lomba untuk siswa: rules + daftar aktif + mesin TKA

1. **Rules `lms_kuis` baca siswa Lomba** wajib ada:
   ```
   isSiswaLms() && aktif == true && 'lombaId' in resource.data
   && exists(.../lms_lomba/$(lombaId))
   && request.auth.token.siswaId in get(...).data.siswaIds
   ```
   Query klien: `where('lombaId','==', id), where('aktif','==', true)` — **tanpa** filter mapel (satu query untuk semua mapel + Gabungan). Jangan mengandalkan `kelas == token.kelas` (bank LB ≠ rombel siswa).
2. Setelah ubah rules: salin **file utuh** ke SDM01Penilaian → `npm run deploy:rules`. Hosting baru ≠ rules baru.
3. UI siswa: `SiswaLombaDetail` menampilkan kartu kuis aktif + **Mulai Kerjakan**. Pengerjaan **wajib** memakai pola TKA (`tka.css`, progress lokal, ragu, tinjau, timer, `nilaiKuisLms`). Jangan membuat halaman generik baru (§Lomba.6).
4. Progress lokal prefix terpisah (`lomba_progress_v1_`) agar tidak bentrok dengan TKA/kuis biasa.
5. Uji: peserta login → detail lomba → kartu kuis tampil → Mulai → kirim → skor muncul; non-peserta ditolak rules; kuis non-aktif tidak tampil.

### §Lomba.22 Rute siswa baru wajib didaftarkan di App.tsx (jangan jatuh ke `path="*"` → login)

1. Gejala: tombol «Lihat detail» pada kartu lomba siswa melempar siswa ke halaman login. Akar: rute `/siswa/lomba/:lombaId` belum ada; `path="*"` mengarah ke `/` yang lalu mengarahkan ke login.
2. Setiap `Link`/`navigate` ke `/siswa/...` harus punya `<Route>` di dalam blok `/siswa` (di bawah `WajibSiswa` + `SiswaLayout`) di `src/App.tsx`. Cek: cari semua `to="/siswa/` dan padankan dengan rute.
3. Halaman `SiswaLombaDetail` memverifikasi `siswaIds` memuat `sesi.id` (pesan ramah); penegak sebenarnya tetap rules `get` pada `lms_lomba`. Materi & kuis lomba untuk siswa belum ada (butuh rules baca + halaman terpisah).

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

## §131. Area siswa v2: shell, Beranda, font (2026-11-17)

131.1 **Kontrak DOM dengan halaman kerjakan.** `SiswaKuis`, `SiswaTka`, `SiswaLombaDetail` memakai `document.querySelector('.sw-nav')` (diberi `display:none` saat mengerjakan) dan `'.sw-main'` (+ kelas `.sw-main--kuis`). Jangan mengganti nama class itu, jangan memecah `.sw-nav` menjadi beberapa elemen (sidebar PC dan nav HP adalah **satu** elemen `.sw-nav`; yang berubah hanya CSS-nya), dan jangan memindahkan `.sw-main` ke luar `.sw-body`. Saat `.sw-nav` disembunyikan di PC, `.sw-body` (flex:1) otomatis melebar penuh.

131.2 **Beranda tidak boleh menambah koleksi/query baru.** `useBerandaSiswa` hanya memakai `daftarTugasAktifKelas`, query `lms_nilai_tugas` (siswaId+kelas), dan `daftarMateriKelas` — query yang sama dengan halaman Tugas/Materi sehingga rules siswa sudah cukup (§0, §124.3). Tiap bagian gagal-sendiri (`catch` → console.warn → bagian disembunyikan); jangan mengubah menjadi `throw`/layar error yang menghalangi menu Beranda.

131.3 **Daftar materi berat.** Dokumen `lms_materi` (jenis `halaman`) memuat seluruh halaman. Beranda memuatnya **ditunda 300 ms setelah tugas** dan **di-cache di memori 5 menit per kelas**. Jangan memanggil `daftarMateriKelas` di Beranda tanpa cache, dan jangan menjadikannya syarat tampilnya menu.

131.4 **Font Nunito di-scope `.sw-app`.** `@font-face` ada di `siswa.css`, file `public/fonts/nunito-latin-wght-normal.woff2` harus ikut ter-push (biner). Bila file hilang, tampilan jatuh ke Inter tanpa galat. Jangan menerapkan Nunito ke `body`/area guru.

131.5 **Offset sticky mode kerjakan** memakai variabel `--sw-header-h` (3.75rem) pada `.sw-app` (`.sw-kuis-kerja-head`, `.sw-kuis-nav`). Bila tinggi header diubah, ubah variabel itu — jangan mengembalikan `top: 0` / `4.25rem` literal (kepala kuis tertutup header).

131.6 **Override visual halaman siswa selalu di-scope `.sw-app`** (`.sw-app .lms-card`, `.sw-app .kelas-hero`, dst.). `.lms-card`/`.kelas-hero` juga dipakai area guru; jangan mengubah aturan globalnya untuk kebutuhan siswa.

131.7 **Kontras ubin berwarna.** Teks di ubin menu/nav aktif berwarna **putih** di atas gradien `--t-from → --t-to`. Jangan memakai warna awal terang (kuning/oranye muda) tanpa uji kontras; palet saat ini sudah disesuaikan (`.sw-tone-*`).

131.8 **Penamaan menu/aktivitas tetap polos-deskriptif** (Materi, Tugas, Kuis, Pekan ini, Tugas untukmu, Pelajaranmu). Jangan memakai tagline/julukan («Detektif…», «Petualang…», «Agen…») — preferensi pemilik proyek.

131.9 **Tanda «Pekan ini»** (titik oranye) = tenggat tugas **belum dinilai** pada hari itu; bukan jadwal pelajaran. Cincin hero = tugas berstatus `dinilai` / seluruh tugas aktif kelas.

131.10 **Halaman masuk siswa** memakai modifier `auth-shell--siswa` pada wrapper `SiswaMasuk`; semua gaya baru di-scope ke class itu. Jangan mengubah `.auth-*` global — dipakai juga oleh `Login.tsx` (staf) dan `OrangtuaMasuk.tsx`.

131.11 **Input form di HP = 16px** (`font-size: 1rem`). Ukuran <16px membuat iOS Safari zoom otomatis saat fokus dan layout bergeser. Jangan kembali ke 0.875rem pada `.auth-field input/select` siswa.

131.12 **Viewer materi di bawah nav melayang.** `.mh-viewer-nav` sticky bottom harus `calc(5.5rem + env(safe-area-inset-bottom))` pada <1024px (hanya di `.sw-app`). Bila tinggi nav HP berubah, sesuaikan angka ini. Override viewer selalu di-scope `.sw-app` agar tampilan guru (editor/pratinjau) tidak ikut berubah.

131.15 **Pencapaian = baca saja, tanpa koleksi baru.** `lib/pencapaianSiswa.ts` hanya membaca `lms_jawaban` (query `where('siswaId','==', sesi.id)` — rules mengizinkan siswa membaca dokumen miliknya; query tanpa `siswaId` akan ditolak) dan `lms_nilai_tugas` (siswaId + kelas, sama dengan halaman Tugas). Jangan menulis bintang/lencana ke Firestore dari klien (`lms_jawaban` rules `create/update/delete: false`). Bila kelak ingin menyimpan (mis. riwayat lencana lintas perangkat), itu butuh koleksi + rules baru: berikan `firestore.rules` **utuh** dan catat di sini.

131.16 **Kriteria lencana hanya di satu tempat** (`susunLencana`); teks syarat di UI berasal dari sana. Mengubah ambang (mis. `AMBANG_NILAI_BAGUS = 80`) cukup di file itu. Kegagalan memuat ditampilkan ramah (`pesanGagalPencapaian`) dengan tombol coba lagi — jangan dibiarkan layar kosong/melempar galat.

131.17 **Mode kerjakan: CSS saja, dipakai bersama.** `.sw-kuis-kerja`, `-head`, `-nav`, `-nav-btn`, `-kerja-foot` dipakai oleh `SiswaKuis`, `SiswaTka` (`.tka-kerja`) **dan** `SiswaLombaDetail`. Ubah lewat override `.sw-app …` di `siswa.css`; jangan mengubah markup/urutan elemen tanpa menguji ketiganya. Di HP `.sw-kuis-nav-grid` dibatasi `max-height: 5.4rem` + gulir; nomor soal aktif bisa berada di luar area terlihat — header «Soal X dari N» dan tombol footer tetap menjadi acuan. Footer wajib punya `padding-bottom` berbasis `env(safe-area-inset-bottom)` di HP (tombol Kirim tidak boleh tertutup home bar).

## §132. Pengumpulan tugas siswa (foto) — `lms_pengumpulan` & `lms_pengumpulan_foto` (2026-11-17)

132.1 **Dua koleksi, foto di Firestore.** Meta `lms_pengumpulan/{tugasId_siswaId}` (catatan, `fotoIds`, `jumlahFoto`, `createdAt`, `updatedAt`) dan foto `lms_pengumpulan_foto/{tugasId_siswaId_slot}` (`slot` '1'..'3', `data` = data URL ≤ 300.000 karakter). Siswa TIDAK boleh menulis ke Storage (`storage.rules` sengaja tidak mengenal token siswa); jangan memindahkan foto ke Storage tanpa mengubah kedua file rules **utuh**.

132.2 **Urutan tulis di klien:** foto dulu, meta TERAKHIR (`kirimPengumpulan`). Kirim ulang = `updateDoc` TANPA `createdAt` (rules membatasi `affectedKeys` meta ke `catatan, fotoIds, jumlahFoto, updatedAt`; foto ke `data, updatedAt`). Jangan mengganti `updateDoc` menjadi `setDoc` penuh pada dokumen yang sudah ada — `createdAt == request.time` akan melanggar rules.

132.3 **Daftar guru hanya memuat meta**; foto dimuat per baris saat dibuka (`muatFoto`). Jangan menaruh data URL di dokumen meta atau memuat semua foto kelas sekaligus (30 siswa × ±500 KB).

132.4 **Query wajib sesuai rules.** Siswa: `where('siswaId','==', sesi.id)` saja. Guru: `where tugasId + mapel + kelas` (satu query per rombel; `daftarPengumpulanTugas`). Tanpa `mapel`+`kelas`, evaluasi list ditolak permission (pola §128).

132.5 **Rules (helper `lmsSiswaBolehKumpul`, `lmsSudahDinilai`):** siswa hanya untuk tugas **aktif** rombelnya (kelas utama atau `kelasList`), `mapel` dokumen = `mapel` tugas, ID dokumen deterministik, dan **terkunci** bila `lms_nilai_tugas/{tugasId_siswaId}` ada (ID itu = `idNilai()`; bila format ID nilai diubah, kunci ini ikut tidak berfungsi — ubah bersamaan). **Tenggat TIDAK ditegakkan di rules**; «Terlambat» hanya tanda di UI guru (`updatedAt` > tenggat).

132.6 **Deploy:** `firestore.rules` harus dideploy dari SDM01Penilaian (salin file UTUH, §0). Sebelum deploy, uji dengan emulator/akun nyata: (a) siswa kumpul 1 & 3 foto, (b) kirim ulang dengan 2 foto (slot 3 terhapus), (c) setelah guru menyimpan nilai, siswa gagal kirim ulang, (d) siswa kelas lain gagal, (e) guru pengampu melihat; guru lain tidak.

132.7 **Foto hanya boleh dipasang lewat `<img src>` setelah `dataUrlGambarAman`** (awalan `data:image/`). Jangan merender `data` sebagai HTML atau tautan `href`.

132.8 **Status filter Tugas tidak berubah** (`belum | dinilai | lewat`, §124.2). «Terkumpul» hanya lencana tambahan; jangan menjadikannya status yang mengubah hitungan Beranda/Pencapaian tanpa menguji keduanya.

### §Lomba.29 Kartu peserta Lomba (cetak A4, 8 kartu/lembar) — 2026-11-18

1. **Jendela cetak dibuka SINKRON.** `cetakKartuPeserta` (`lib/kartuLomba.ts`) memanggil `window.open` sebagai pernyataan pertama dan dipanggil langsung dari handler klik di `KartuPesertaDialog` (pola §127.32). Jangan memindahkannya ke setelah `await` (popup diblokir browser). Bila gagal, jendela ditutup dan galat berbahasa Indonesia ditampilkan di dialog.
2. **NISN = kata sandi login siswa — jangan disalin ke dokumen `lms_lomba`.** Dokumen lomba dapat dibaca setiap peserta (`get` oleh `siswaIds`), sehingga menyimpan `nisn` di `siswaList` akan membuka sandi semua peserta kepada sesama peserta. NISN selalu dibaca dari `siswa/{id}` saat cetak (`muatDataKartu`). Field `PesertaLomba.nisn` tetap opsional dan hanya menjadi cadangan; `LombaForm` sengaja tidak mengisinya.
3. **Geometri kartu tetap.** `.lembar` = 210 × 296,5 mm (§127.30), padding 8 mm, grid `97mm 97mm` × 4 baris `70.1mm` → 8 kartu. Pemecahan halaman dihitung sendiri (`KARTU_PER_HALAMAN`, satu `<section class="lembar">` per 8 kartu); jangan mengandalkan `break-inside`/kolom CSS (§127.26). `@page { margin: 0 }`. Jangan menaikkan tinggi baris/padding tanpa mengecek total ≤ 296,5 mm (akibatnya lembar kosong di tengah).
4. **Logo diubah jadi data URI** dari `/logo-sdm.png` (`muatLogo`); periksa `blob.type` berawalan `image/` karena SPA fallback mengembalikan `index.html` berstatus 200 bila berkas hilang. Jangan memakai `src="/logo-sdm.png"` relatif di jendela baru (tidak ikut tersimpan saat «Simpan PDF» dan bergantung pada base URL). Logo hilang → kartu tetap tercetak tanpa logo.
5. **Alamat LMS = konstanta** `DOMAIN_LMS_PUBLIK` + `PATH_MASUK_SISWA` (`/siswa/masuk`), bukan `window.location.origin` (domain preview `*.web.app` berbeda dan «/» mengarah ke login staf). Bila domain berubah, ubah di satu tempat itu.
6. **Nomor kartu** dihitung dari urutan seluruh peserta (kelas, lalu nama; `susunPesertaBernomor`) sebelum difilter, agar mencetak ulang satu kartu tidak mengubah nomornya.
7. **Hanya admin/pengampu** (halaman `LombaDetail` sudah dibatasi `bolehKelolaKontenLomba`). Bila rules koleksi `siswa` kelak diperketat (saat ini `get`/`list` terbuka), pastikan admin LMS dan guru pengampu non-admin tetap boleh `get siswa/{id}` — jika tidak, kartu tercetak dengan «NISN belum terdaftar».
8. **CSS:** gaya dialog di `styles/kartuLomba.css` (`kp-*`); gaya kartu cetak inline di `kartuLomba.ts` (konstanta `CSS`). Jangan menambah aturan ke `lomba.css` untuk ini dan jangan memakai ulang nama kelas `kp-*`/`kartu`/`lembar` di tempat lain (§Lomba.9). State dialog di `LombaDetail` (`kartuBuka`) dideklarasikan di atas `return` bersyarat (§108.4).
9. **Uji sebelum deploy:** (a) lomba 20 peserta → 3 lembar, tidak ada lembar kosong di Chrome print preview (A4, skala 100%, margin None); (b) siswa tanpa NISN → kartu menampilkan «Belum terdaftar» + peringatan di atas pratinjau; (c) nama panjang (±40 huruf) dan nama lomba panjang tidak memotong baris «Cara masuk LMS»; (d) cetak sebagian peserta → nomor tidak bergeser; (e) pop-up diblokir → pesan jelas di dialog; (f) akun guru pengampu non-admin dapat mencetak.

## §MateriHtml — Materi jenis HTML + gambar eksternal (2026-11-18)

1. **Jenis `'html'`** dan field **`kontenHtml`** (string, maks. 400_000 karakter). Jangan menyimpan HTML mentah tanpa `bersihHtmlLengkap`.
2. **Sanitasi terpisah** dari `bersihHtmlMateri` (blok halaman). `bersihHtmlLengkap` mengizinkan `img` (src/alt/…), `a` (href/target/rel), `figure`, heading, table, dll. — **tanpa** script, on*, style berbahaya, data: URI jahat.
3. Gambar eksternal (imgbb, postimages, drive.google.com/uc, CDN) **sengaja** diizinkan agar URL di kode HTML guru tetap ter-load. Hotlink/CORS adalah tanggung jawab sumber; LMS tidak mem-proxy.
4. Rules: `jenis` **wajib** memuat `'halaman'` **dan** `'html'`. Deploy rules setelah ubah (file utuh ke SDM01Penilaian). Tanpa itu create/update HTML & halaman ditolak permission.
5. Viewer: selalu lewat `MateriHtmlViewer` + `dangerouslySetInnerHTML` **setelah** `bersihHtmlLengkap`. Jangan render `kontenHtml` mentah.
6. Lomba: setiap create materi (file/youtube/tautan/html/**halaman**) di scope lomba **wajib** menyertakan `lombaId` di dokumen (rules `lombaKontenBoleh`).

## §Materi.TpOpsionalLombaTka (2026-11-18)

1. `MateriPanel`: `tanpaTpWajib = Boolean(lombaId) || adalahMapelTka(mapel)`. Jangan mengembalikan `disabled={tpList.length === 0}` tanpa guard ini — di Lomba daftar TP sering kosong → seluruh tombol mati.
2. Jangan mewajibkan `tpId` di `tambahMateri` / `tambahMateriHalaman` bila `lombaId` terisi. Field `tpId` opsional di rules.
3. Mapel kelas (tanpa `lombaId`, bukan TKA): tetap wajib TP — jangan longgarkan global.
4. UI: sembunyikan blok «Tujuan Pembelajaran *» saat `tanpaTpWajib`; tombol Simpan tidak bergantung `tpId`.

## §Lomba.Materi — Materi lomba hanya peserta (2026-11-18)

1. Dokumen `lms_materi` dengan field `lombaId` **tidak** boleh dibaca lewat cabang `kelas == token.kelas` / `kelasList`. Rules wajib menolak non-peserta.
2. Query siswa: `where('lombaId','==', lombaId)` saja. Jangan query kelas `LB` tanpa filter lombaId.
3. Klien `SiswaLombaDetail`: muat materi **hanya** setelah `l.siswaIds.includes(sesi.id)`.
4. `daftarMateriKelas` (halaman Materi mapel) wajib skip `m.lombaId` agar materi lomba tidak muncul di kurikulum kelas.
5. Pratinjau HTML guru: `bersihHtmlLengkap` + `MateriHtmlViewer` sebelum simpan; id lokal `pratinjau-lokal` tidak ditulis ke Firestore.

## §MateriHtml.Iframe (2026-11-18)

1. Jangan DOMPurify-kan modul interaktif (style/script/details/svg) saat **simpan** — gunakan `siapkanSimpanHtml`.
2. Tampil dokumen penuh hanya lewat **iframe srcdoc** + sandbox **tanpa** `allow-same-origin`. Jangan `dangerouslySetInnerHTML` untuk dokumen penuh.
3. `allow-scripts` boleh; jangan tambah `allow-same-origin` (bocor ke parent).
4. Cuplikan sederhana tetap `bersihHtmlLengkap` + inline.
5. Materi yang sudah ter-strip di Firestore harus diunggah ulang oleh guru.

## §19. Bank Soal / Kuis

19.1 Koleksi `lms_kuis` dan `lms_soal` harus didaftarkan di `firestore.rules` (shared). Guru hanya boleh baca/tulis kuis dan soal pada kelas + mapel yang diampu (mirip pola `lms_materi`). Admin boleh baca. **Rules belum di-deploy.**

19.2 Gambar soal diunggah ke `lms/kuis/{kuisId}/...` dengan batas 5 MB. Jangan menyimpan file besar atau non-gambar di path ini.

19.3 Saat menghapus kuis, semua dokumen `lms_soal` terkait harus ikut dihapus (sudah dilakukan di `hapusKuis`).

19.4 Jumlah soal di `lms_kuis.jumlahSoal` adalah denormalisasi. Jangan mengandalkannya sebagai sumber kebenaran; selalu hitung ulang dari `lms_soal` bila perlu.

## §1. Firestore rules

1.1 **`users` create**: selalu batasi ke `role == 'orangtua' && status == 'pending'` dan daftar field (`keys().hasOnly`). Jangan pernah mengizinkan `create` hanya dengan `request.auth.uid == uid` — itu membuat siapa pun bisa menjadikan dirinya admin.

1.2 **`users` update oleh pemilik**: hanya `nama` dan `updatedAt`. Setiap field baru yang dibaca rules (`role`, `status`, `kelasAmpu`, `penugasan`, `anakIds`, `waliKelas`, `penugasanKelas`, `penugasanKelasMapel`, dst.) JANGAN ditambahkan ke daftar yang boleh diubah pemilik.

1.3 **Orang tua**: hanya `get` ke `siswa/{anakIds}`; tidak ada `list` pada `siswa`.

1.4 **Default deny** di blok paling bawah harus tetap ada. Koleksi baru wajib didaftarkan di `firestore.rules` dan `docs/DATA_MODEL.md` sekaligus.

1.5 **`setoran` / `menulis_log` immutable** (`update: if false`). Jangan membuka update tanpa keputusan eksplisit; riwayat penilaian anak tidak boleh bisa diubah diam-diam.

1.6 **Jangan membuat kembali** koleksi `students` (duplikat `siswa`) dan `nilai` generik (bertabrakan dengan `nilai_tp`/`nilai_sts`/`nilai_sas` dari v2).

1.7 Commit ke GitHub tidak mengubah rules produksi. Selalu `npm run deploy:rules` lalu uji dengan tiga jenis akun (admin, guru, orang tua).

## §2. Header & hosting

2.1 CSP saat ini **Report-Only**. Sebelum mengubahnya menjadi `Content-Security-Policy`, pastikan Console browser bersih dari pelanggaran di halaman login, beranda, dan tiap modul.

2.2 Domain `penilaian.sdmuhammadiyah01kks.sch.id` harus ada di Firebase Auth → Authorized domains.

## §3. Migrasi dari v2

3.1 Satu project Firebase saja sebagai sumber kebenaran (lihat `docs/DATA_MODEL.md`, keputusan #1).

3.2 Impor siswa yang mencocokkan hanya berdasarkan NIS berisiko membuat duplikat (v2 antiregresi §16.6). Tampilkan pratinjau baru/update/duplikat sebelum menulis.

3.3 Akun demo dengan password tertulis di `assets/firebase.js` v2 tidak boleh ikut dimigrasi.

## §4. Build, data siswa, dan migrasi

4.1 **`ignoreUndefinedProperties: true` di `firebase.ts` jangan dihapus.** `normalizeSiswa()` sengaja menghasilkan `undefined` untuk kolom kosong. Tanpa opsi itu, menyimpan siswa gagal saat runtime (TypeScript tidak mendeteksinya).

4.2 `initializeFirestore` hanya boleh dipanggil sekali per app. Di `firebase.ts` dijaga dengan `isNewApp`; jangan diganti dengan pemanggilan langsung di tempat lain.

4.3 Casting `s as Record<string, unknown>` pada interface tanpa index signature gagal dibuild (TS2352). Gunakan `as unknown as Record<string, unknown>`.

4.4 **Kunci service account TIDAK PERNAH di-commit.** Simpan di luar folder repo dan hapus/cabut setelah migrasi selesai.

4.5 `scripts/migrate-firestore.mjs` terkunci ke pasangan project `sdm01-penilaianv2` → `sdm01kukusan-2e735`. Jangan melonggarkan pengecekan itu. `--overwrite` hanya untuk sinkron akhir (cutover), bukan untuk eksperimen.

4.6 Indeks komposit v2 dibuat manual di Console project lama dan tidak ada di repo. Setiap indeks yang dibutuhkan di project baru harus dicatat di `firestore.indexes.json`.

## §5. UI

5.1 Halaman baru memakai komponen di `src/components/ui.tsx` (`HeroBanner`, `StatCard`, `ModuleCard`, `Badge`, `IconTile`) dan ikon dari `Icon.tsx`. Jangan membuat gaya kartu/tombol sendiri per halaman; ubah token di `src/index.css` bila perlu.

5.2 **Tanpa font, ikon, atau skrip dari CDN.** CSP hanya mengizinkan `'self'` (lihat `firebase.json`). Ikon ditambah lewat `PATHS` di `Icon.tsx`.

5.3 Teks putih hanya di atas area hijau pada `.hero-banner` (kontras terjaga). Jangan memindahkan teks putih ke area peach.

5.4 `RoleGate` di `App.tsx` hanya merapikan UI. Hak akses sebenarnya ada di `firestore.rules`; jangan menganggap menu tersembunyi berarti data aman.

5.5 Ringkasan beranda memakai `getCountFromServer`. Jangan diganti dengan mengunduh seluruh koleksi `siswa` (biaya baca dan lambat).

## §6. Data pribadi siswa

6.1 **Jangan pernah mengimpor file data siswa (JSON/CSV/XLSX) ke kode frontend.** Semua yang di-`import` ikut terbundel ke `dist/assets/*.js` dan terunduh oleh siapa pun yang membuka URL situs, tanpa login. Kejadian nyata: `siswaSeed.json` (403 siswa) terbundel di build produksi. Cek sebelum deploy: `grep -c "<nama siswa>" dist/assets/*.js` harus 0.

6.2 Repo GitHub dianggap bisa dibaca publik kecuali dipastikan private. Data siswa tidak boleh di-commit; data hanya hidup di Firestore (dilindungi rules).

6.3 Data siswa masuk lewat halaman impor yang dipakai admin yang sudah login (unggah berkas lokal), bukan lewat berkas di repo.

## §7. Akademik

7.1 **Rumus nilai hanya di `src/lib/akademikRumus.ts`.** Halaman tidak boleh menghitung ulang. Setelah mengubah rumus jalankan `node --experimental-strip-types scripts/cek-rumus-akademik.mjs`.

7.2 `saveTP()` tidak boleh menulis `semester`/`bobotMapel` (dikelola halaman Bobot Semester). Kalau ditulis dengan nilai bawaan, setiap edit TP menimpa pengaturan guru (v2 §20.3).

7.3 Query ke `nilai_tp` (dan nanti `nilai_sts`/`nilai_sas`/`asesmen_cakupan`) wajib menyertakan `where('mapel')` DAN `where('kelas')`, karena rules memeriksa keduanya (v2 §1.1, §10.3).

7.4 `users.penugasanKelas`, `users.penugasanKelasMapel`, `users.waliKelas` dibaca `firestore.rules`. Kalau `penugasan` diubah, ketiganya harus diturunkan ulang (`turunkanFieldRules()`); kalau tidak, guru kehilangan atau mendapat akses yang salah. Di v2 field ini diisi manual lewat Console. Halaman Kelola Akun wajib menulis ketiganya sekaligus.

7.5 Admin tidak menulis TP/KKTP maupun nilai lewat UI (v2 §14.1). Jangan menambah `isAdmin()` ke rule `tp_kktp`.

7.6 Komponen di dalam komponen (mis. `const Kartu = () => ...` di dalam render) membuat `<input>` di-remount tiap ketikan dan kehilangan fokus. Pakai fungsi render atau komponen di luar.

## §8. Peran, beranda, dan masa transisi

8.1 `kelasAmpu` hanya untuk guru Tahsin-Tahfizh. Kelas guru akademik = `waliKelas` + kelas di `penugasan` (`kelasSaya()` / `mapelKelasSaya()`). Jangan memakai `kelasAmpu` untuk tampilan atau akses modul Akademik.

8.2 Fungsi website adalah administrasi penilaian semua guru; Tahsin-Tahfizh hanya salah satu modul. Beranda tidak boleh menjadikan Tahsin sebagai informasi utama, dan info Tahsin tidak tampil di layar kecil bila pengguna juga punya modul Akademik atau admin.

8.3 Beranda tidak menjalankan query ke koleksi nilai (rules mewajibkan `mapel` dan `kelas`, §7.3). Informasi akademik di beranda hanya dari profil dan `config/akademik`.

8.4 Selama transisi, sumber kebenaran data Tahsin-Tahfizh adalah v2. Jangan menginput setoran di situs baru, jangan mengubah rules v2 menjadi tolak-semua, dan jangan memakai `--overwrite` pada skrip migrasi sebelum membandingkan laporan dry-run.

8.5 Koreksi atas 8.4 (per 10 Okt 2026): v2 belum dipakai guru dan belum ada data nyata, jadi v2 bukan sumber kebenaran Tahsin. Aturan intinya tetap: sebelum guru menginput, tetapkan satu sumber kebenaran per modul dan jangan menginput di dua tempat.

## §9. Data siswa dan impor

9.1 **Biodata sensitif hanya di `identitas_siswa`**, bukan di `siswa` (v2 §12.1). `siswa` dibaca semua guru. Kunci yang boleh di `siswa` ada di `DASAR_KEYS`; pemetaan biodata di `IDENTITAS_KEY` (`siswaImport.ts`). Jangan menambah field pribadi baru ke `siswa`.

9.2 Halaman guru memakai `listAllSiswa` (data dasar). Hanya halaman admin memakai `listSiswaLengkap`. Jangan membaca `identitas_siswa` dari halaman guru; rules menolaknya kecuali wali kelas.

9.3 **Impor tidak boleh menimpa `aktif`, `tamatIqro`, `jenjang` siswa yang sudah ada** (kecuali ada di sumber). Versi sebelumnya mengaktifkan kembali siswa nonaktif dan mereset `tamatIqro`.

9.4 Impor harus lewat `praLihatImpor` (pencegah duplikat: NIPD ganda, NISN ganda, NISN dipakai siswa lain) lalu `jalankanImpor`. Jangan menulis siswa massal tanpa pratinjau.

9.5 Nama siswa/orang tua yang HURUF BESAR semua dirapikan per kata; nama campuran tidak disentuh (v2 §17). Jangan mengubah menjadi per huruf setelah tanda baca (merusak "Syafi'i").

9.6 **Data siswa tidak pernah masuk repo atau bundle** (`src/data/`, `public/`, `*.xlsx` diabaikan git). Impor dibaca di browser dari file lokal.

9.7 Setelah impor pertama terverifikasi, pertimbangkan membatasi `siswa` dengan `keys().hasOnly(DASAR_KEYS)` pada rules. Jangan dipasang sebelum semua dokumen lama dibersihkan, atau `setSiswaAktif` pada dokumen lama akan ditolak.

9.8 Berkas `.patch`/`.diff` dan contoh/placeholder di kode tidak boleh memuat data siswa sungguhan. `fase1.patch` (commit b81f5eb) memuat seluruh NIPD dan NISN 403 siswa di cabang utama, dan contoh template memakai identitas satu siswa nyata. Gunakan nilai palsu (`000000001`) untuk contoh.

## §10. Tahsin-Tahfizh: Baca & Tandai dan status

10.1 **Baca & Tandai adalah fitur inti, bukan opsional.** `detailAyat` dan `detailBacaanIqro` pada setoran tidak boleh diisi kosong/null secara tetap. Bentuk simpan (sama dengan v2): `detailAyat: [{ayat, status: 'lulus'|'gagal'|null, kataSalah: [{index, jenis}]}]`, `detailBacaanIqro: {teks, kataSalah}`; `jenis` hanya `'tajwid'` atau `'makhroj'`.

10.2 **Istilah status mengikuti data v2.** Status setoran: `'lulus'` | `'ulang'` (label "Perlu diulang"); per ayat: `'lulus'` | `'gagal'`. Jangan menambah nilai baru. Pembacaan data wajib lewat `recordSetoran`/`normalisasiStatus` agar data lama (`'mengulang'`, `'belum'`) tidak tampil kosong.

10.3 Teks ayat diambil dari `https://equran.id` (hanya nomor surah yang dikirim). Alamat itu harus ada di `connect-src` CSP. Jika gagal dimuat, penanda Lulus / Perlu diulang per ayat tetap harus bisa dipakai.

10.4 Rules `setoran`/`menulis_log` (v2 §5): update hanya oleh pembuat dan hanya field sederhana (`jenis`, `statusHafalan`, `catatan`; materi dan Baca & Tandai terkunci); delete oleh pembuat atau admin. Pembatasan ini dijaga di rules, bukan hanya di UI.

10.5 Sebelum mengubah logika tanda/ringkasan, jalankan `npx tsx scripts/cek-baca-tandai.mts` (harus mencetak SEMUA UJI LULUS).

## §11. Data Al-Qur'an, font, dan tata letak

11.1 **Font Al-Qur'an disajikan dari situs sendiri** (`public/fonts/amiri-quran-arabic-400-normal.woff2`, lisensi SIL OFL 1.1; berkas lisensi harus tetap menyertainya). CSP `font-src 'self'` melarang font dari CDN. Jangan mengembalikan ke font sistem untuk teks Al-Qur'an.

11.2 Sumber teks, transliterasi, terjemahan, dan audio adalah EQuran.id. Alamatnya harus ada di `connect-src` (API) dan `media-src` (audio) pada CSP. Atribusi "EQuran.id" di Baca & Tandai harus tetap ditampilkan. URL audio hanya diterima lewat `audioAman` (https dan domain equran.id); jangan melonggarkannya. Kunci cache sesi `tt_quran_v2_`; ubah versinya bila bentuk data berubah.

11.3 Tampilan teks memakai React (bukan HTML mentah), jadi isi API tidak pernah dijalankan sebagai HTML. Jangan memakai `dangerouslySetInnerHTML` untuk terjemahan atau transliterasi.

11.4 **Jangan memakai `overflow-hidden` pada pembungkus Layout.** Itu mematikan `position: sticky` (sidebar, header, panel siswa, bilah simpan, bilah alat Baca & Tandai). Gunakan `overflow-clip` bila perlu memotong sudut membulat.

11.5 Halaman kerja harian (Input Setoran, Riwayat, Target, Data Siswa) didaftarkan di `HALAMAN_LEBAR` pada `Layout.tsx` agar memakai lebar penuh di PC. Di PC, aksi utama (Simpan) harus selalu terlihat tanpa menggulir; jangan memindahkannya ke akhir halaman.

11.6 Progres target hanya menghitung setoran Ziyadah berstatus Lulus untuk satu surah yang sama dengan surah target (aturan v2). Jangan menghitung Muroja'ah, status Perlu diulang, atau rentang lintas surah. Uji: `npx tsx scripts/cek-target.mts`.

## §12. Kelola Akun Guru

12.1 **Jangan memanggil `createUserWithEmailAndPassword` pada `auth` utama.** Itu mengganti sesi admin yang sedang login. Pembuatan akun wajib lewat app Firebase sekunder bernama `sdm-buat-akun`, `inMemoryPersistence`, lalu `deleteApp` (lihat `buatAkunGuru`).

12.2 Setiap simpan akun menulis sekaligus `kelasAmpu`, `penugasan`, `waliKelas`, `penugasanKelas`, dan `penugasanKelasMapel` lewat `susunDokumenAkun()`. Peran yang tidak memakai sebuah tugas mendapat array kosong — jangan hanya menghapus field, dan jangan mengisi `kelasAmpu` untuk guru akademik (§8.1, §7.4).

12.3 `users.aktif === false` menolak login dan, setelah rules di-deploy, menolak baca/tulis (`akunAktif()`). Field tidak ada berarti aktif, supaya dokumen lama tidak terkunci. Pemilik akun tidak boleh mengubah `aktif` (§1.2). Jangan menghapus dokumen `users` dari halaman ini: user Auth-nya tidak ikut terhapus (tidak ada Admin SDK) dan login berikutnya hanya menghasilkan profil kosong.

12.4 Admin tidak menonaktifkan atau mengganti peran akunnya sendiri dari UI. Mencegah terkunci di luar sistem.

12.5 Password awal tidak ditulis ke Firestore dan tidak masuk log. Yang boleh dikirim ke guru adalah tautan `sendPasswordResetEmail`.

## §13. Akses akademik guru kelas dan tahun ajaran

13.1 Guru kelas (`waliKelas`) membuka semua mapel yang berlaku di tingkat kelasnya, termasuk mapel guru bidang studi. Guru bidang studi hanya pasangan di `penugasan`. Guru Tahsin-Tahfizh murni tidak membuka menu Akademik. Admin membaca TP, bobot, dan nilai, tetapi rules `tp_kktp` dan `nilai_tp` menolak tulis admin.

13.2 `nilai_tp` create/update memakai `tulisMapelKelas` (penugasan atau wali kelas), bukan `bolehMapelKelas` yang dulu mengizinkan admin menulis. Baca admin lewat `lihatMapelKelas`. Setelah mengubah rules, jalankan `npm run deploy:rules`.

13.3 Tahun ajaran aktif ada di `config/akademik`. Dokumen nilai menyimpan `tahunAjaran` dan `semester` saat diinput. Mengganti tahun ajaran tidak memindahkan nilai lama.

13.4 `asesmen_cakupan`, `nilai_sts`, dan `nilai_sas` di-query dengan `mapel` dan `kelas` (plus semester, tahun ajaran, dan `jenis` pada cakupan). Cakupan STS dan SAS tidak disamakan. STS tidak menimpa SLM; rumus tetap `hitungNilaiAkhirTP`.

## §14. Alokasi bobot TP multi-semester

14.1 Sumber kebenaran alokasi TP adalah `tp_kktp.bobotPerSemester` (map semester → persen). Field legacy `semester` + `bobotMapel` tetap diisi saat simpan agar dokumen lama dan klien lama tetap terbaca; jangan menghapus fallback di `tpMasukSemester` / `bobotTpDiSemester`.

14.2 Satu TP boleh masuk Semester 1 dan Semester 2 sekaligus dengan bobot berbeda. Total ideal **per semester** = 100% (bukan digabung antar-semester).

14.3 `saveTP` / `importTPBatch` **tidak** boleh menulis `semester`, `bobotMapel`, atau `bobotPerSemester` (milik halaman Bobot Semester). Melanggar ini menimpa pengaturan guru.

14.4 Perhitungan nilai mapel (`hitungNilaiAkhirMapel`) memakai `bobotTpDiSemester(tp, semesterAktif)`, bukan `tp.bobotMapel` mentah.

14.5 Pengecualian disengaja: `salinTPKeKelas` **boleh** menyalin `bobotPerSemester` (+ legacy) ke kelas paralel setingkat bila guru mencentang opsi tersebut. Ini aksi eksplisit menyamakan alokasi antar-rombel, bukan simpan form TP biasa. Kelas beda tingkatan wajib ditolak. Nilai siswa tidak ikut disalin.

## §15. Model AI (Gemini)

15.1 **Nama model Gemini sudah ada yang dipensiunkan Google dan dibalas 404** (1.5, 2.0 per 1 Jun 2026, 2.5 per 16 Okt 2026). Daftar model hanya ada di `MODEL_GEMINI` (`functions/generateAi.js`); jangan menulis nama model di tempat lain. Sebelum menambah atau mempertahankan model, cek halaman deprecations Gemini API. Jangan mengembalikan model yang sudah pensiun ke daftar.

15.2 Model 3.x berpikir secara bawaan dan token berpikir memakan `maxOutputTokens`; keluaran JSON bisa terpotong. Selalu atur `thinkingConfig` lewat `thinkingGemini()` untuk jalur teks dan vision.

15.3 Pesan galat `panggilGemini` harus menyebut semua model yang gagal, bukan hanya yang terakhir. Pesan "model terakhir 404" pernah menutupi bahwa tiga model sekaligus sudah mati (lihat CHANGELOG, 21 Okt 2026).

## §16. AI Proyek STEM (kokurikuler)

16.1 AI Proyek STEM harus berjalan hanya dari keterangan aktivitas. Jangan menambah kembali syarat "minimal 3 DPL aktif" atau syarat lain yang memaksa guru menyiapkan DPL/TP lebih dulu, selain katalog TP minimal 2 mapel berbeda (AI tidak boleh mengarang TP).

16.2 `tpId` dan `dplId` hasil AI wajib divalidasi terhadap katalog yang dikirim klien (`tpIdsSah`, `dplIdsSah`). Jangan menerima id di luar katalog.

16.3 `dplLevel` dari AI hanya boleh mengisi level DPL yang masih kosong; jangan menimpa deskripsi level yang sudah ditulis wali kelas. DPL baru diaktifkan dan diperbarui saat proyek DISIMPAN, bukan saat AI dijalankan, supaya hasil AI bisa diperiksa dulu.

16.4 Rubrik STEM tetap 4 rentang sesuai `STEM_NILAI_RANGE` (0–60, 61–75, 76–85, 86–100). Jangan mengubah urutan atau batasnya tanpa mengubah rumus akademik.

16.5 Fitur AI tetap dibatasi pada UID + email di `bolehPemanggilAi` (lihat §15 dan `src/lib/generateAi.ts`). Pemeriksaan di klien hanya kosmetik; yang menjaga adalah Cloud Function.

16.6 Prompt materi ajar tidak boleh menghasilkan judul bergaya julukan, slogan, atau persona (mis. "detektif", "petualang", "agen").

## §17. 7KAIH

17.1 7KAIH **tidak ditautkan ke DPL**. Jangan mengembalikan pilihan DPL per kebiasaan atau syarat "DPL aktif" pada tab 7KAIH. Bila deskripsi rapor perlu menyebut DPL, itu urusan penyusun deskripsi akhir, bukan data 7KAIH.

17.2 Skala 7KAIH adalah 4 level (`LEVEL_7KAIH_LABEL`), **bukan 0–100**. Skala 0–100 khusus Proyek STEM karena berkaitan dengan mapel (`STEM_NILAI_RANGE`).

17.3 `level: null` berarti belum diisi/tidak teramati dan bukan level terendah. Jangan menafsirkan kosong sebagai 1 saat menyusun rapor.

17.4 `catatan` dan `dplId` pada dokumen `g7kaih` lama harus tetap tersimpan ulang apa adanya (data pengguna). UI tidak lagi mengisinya.

17.5 Penyimpanan 7KAIH hanya menulis baris siswa yang berubah (`simpanG7kaihBanyak`, batch). Jangan menulis seluruh kelas pada setiap simpan.

17.6 Aksi massal per kolom 7KAIH ("Atur semua") harus **menimpa** seluruh kolom dan menyediakan "Kosongkan". Jangan kembali ke perilaku "hanya isi sel kosong": pilihan itu tidak berefek bila kolom sudah terisi penuh dan tidak ada jalan menghapus massal. Perubahan baru tersimpan setelah tombol Simpan.

## §18. Catat Menulis (Tahsin-Tahfizh)

18.1 **Rata-rata menulis = tiga aspek inti saja** (`hurufSambungan`, `harakat`, `keutuhanTeks`), dihitung hanya di `rataInti` (`src/lib/menulis.ts`). Jangan memasukkan `kerapian` ke rata-rata dan jangan menghitung ulang di halaman. Ini koreksi atas rata-rata empat aspek di v2 (aturan lama tidak dihapus; yang berlaku adalah aturan ini). Uji: `npx tsx scripts/cek-menulis.mts` dan `node --experimental-strip-types scripts/cek-laporan-cetak.mjs`.

18.2 Kunci `penilaian` tetap `hurufSambungan`, `harakat`, `keutuhanTeks`, `kerapian` agar data impor v2 terbaca. `kerapian` boleh `null` (tidak dinilai); `null` berarti belum dinilai, bukan level terendah. Skor sah hanya bilangan bulat 1-4.

18.3 `jenisTugas` (`salin` | `dikte` | `hafalan`) dan `kesalahan[]` opsional pada catatan impor v2. Pembaca wajib menoleransi keduanya kosong. Jangan menambah aspek skor baru tanpa keputusan eksplisit pemilik proyek: rancangan sengaja ramping agar tidak membebani guru.

18.4 Catat Menulis hanya untuk guru Tahsin (`isGuruTahsinRole`); admin memantau (§17). Setiap catatan menyimp

## §54 — Fitur Tugas: query wajib where kelas + mapel

- Koleksi `lms_tugas` mengikuti pola `lms_materi` / `lms_kuis`: baca/tulis hanya guru kelas×mapel (tulisMapelKelas / lihatMapelKelas).
- Klien WAJIB query dengan `where('kelas', '==', …)` DAN `where('mapel', '==', …)`. Tanpa kedua filter, rules menolak.
- Halaman agregat sidebar (`TugasDanKuis`) melakukan loop per ruang kelas lalu query per pasangan, bukan satu query tanpa filter.
- Jangan mengaktifkan `orderBy` di query pertama bila composite index belum dibuat; fallback sort di klien sudah ada di `daftarTugas`.

## §56. Import soal ke paket yang sudah ada

- Tombol Import pada kartu paket menambahkan soal ke array `soal` yang sudah ada (append), bukan mengganti.
- Validasi metadata (mapel + TP) tetap wajib dan harus cocok dengan paket tujuan. Jika berbeda, tampilkan pesan dan jangan simpan.
- Import untuk paket baru (form terpisah) tidak boleh dihapus; keduanya hidup berdampingan.

## §58. Batas soal per paket = 300

- Konstanta `BATAS_SOAL_PER_PAKET` di `src/types/soal.ts` adalah 300.
- Validasi di `simpanPaket` dan UI editor (tombol tambah) menggunakan konstanta ini.
- Jangan turunkan kembali ke 100 tanpa keputusan eksplisit; bank soal dirancang untuk menampung banyak soal.

## §61. Fitur Analisis stimulus hanya untuk user tertentu

- Tombol dan panel Analisis hanya muncul jika `user.uid === 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'`.
- Deteksi bersifat heuristik (kata kunci). Bukan pengganti review manual.
- Jangan mengaktifkan untuk semua user tanpa keputusan eksplisit.

## §63. Validasi impor soal harus ketat

- Import harus menolak soal yang tidak lengkap sesuai tipenya (isian tanpa kunci, jodoh tanpa pasangan, bs tanpa pernyataan, dll.).
- Deteksi duplikat berdasarkan teks yang dinormalisasi.
- Fitur analisis harus bisa menandai soal yang kurang pembahasan atau struktur.

## §64. Kuis dari bank soal (snapshot)

64.1 Kuis baru **wajib** disusun dari `lms_paket_soal` berstatus `siap`. Jangan menghidupkan lagi editor soal berdiri sendiri di tab Kuis (`KuisBuilder` / `lms_soal` create).

64.2 Field `lms_kuis.soal` adalah **snapshot** (salinan penuh). Jangan mengandalkan baca live ke paket saat siswa mengerjakan; paket bisa diubah atau dihapus.

64.3 Poin awal setiap soal snapshot = **1**. Perubahan bobot hanya di dokumen kuis, bukan di bank.

64.4 Query `lms_kuis` tetap `where kelas + mapel`. Rules menolak create tanpa `soal` list. Create ke `lms_soal` ditolak (legacy delete-only).

64.5 Mode `otomatis_ai` dan deteksi mirip hanya UI-gated lewat `bolehGenerateSoalAi` (UID+email). Logika deteksi kasar di klien; panggilan AI server untuk esensi belum ada — jangan mengaku “AI menganalisis esensi” sampai function siap.

64.6 Batas: ≤100 soal per kuis, ≤12 paket sumber. Ukuran dokumen Firestore 1 MiB — hindari menyalin gambar data-URL besar ke dalam snapshot (gambar tetap lewat `lms_gambar` id).

## §65. Pengelompokan soal kuis menurut bentuk

- Urutan bagian memakai `URUTAN_TIPE` dari `src/types/soal.ts` (pg → pgk → jodoh → bs → isian → uraian).
- Instruksi setiap bentuk ada di konstanta `INSTRUKSI_TIPE` di `KuisDetail.tsx`. Jangan mengubah teks instruksi tanpa keputusan eksplisit (berpengaruh ke siswa dan nantinya cetak).
- Tombol “Kelompokkan menurut bentuk” hanya mengubah urutan array `soal` di state. Persistensi terjadi saat guru menekan Simpan perubahan.
- Tampilan selalu mengelompokkan (meski array di dokumen belum terurut). 
- Bila `acakSoal` aktif, kebijakan acak sebaiknya tetap menghormati kelompok bentuk (acak di dalam bagian), atau sesuai keputusan sekolah nanti saat implementasi siswa.

## §66. Batas soal paket di rules = 300

- `firestore.rules` untuk `lms_paket_soal` (create & update) memakai `soal.size() <= 300`.
- Jangan turunkan kembali ke 100; kode di `src/types/soal.ts` (`BATAS_SOAL_PER_PAKET`) sudah 300.
- Setelah mengubah rules, WAJIB salin file lengkap ke repo SDM01Penilaian dan jalankan `npm run deploy:rules`. Perubahan di GitHub LMS saja tidak langsung berlaku.
- Ubah status Siap ↔ Draf hanya boleh jika dokumen tetap memenuhi semua validasi rules (kelas/mapel tidak berubah, dibuatOleh sama, dll.).

## §67. Batas prompt ilustrasi AI

- Deskripsi ilustrasi AI (petunjukGambar) minimal 3000 karakter di UI dan di server.
- Jangan turunkan kembali ke 500/600; prompt pendek sering menghasilkan ilustrasi tidak stabil atau tidak sesuai.
- Setelah mengubah `functions/generateSoalLmsAi.js`, deploy ulang Cloud Functions dari repo SDM01Penilaian.

## §68. Proporsi soal kuis otomatis

- Bila `jumlahPerTipe` tidak diisi, `susunOtomatis` memakai `hitungProporsiTipe` berdasarkan `BOBOT_TIPE` (PG terbanyak, uraian tersedikit).
- Jangan mengubah bobot tanpa keputusan eksplisit; proporsi ini mengikuti prinsip soal lebih mudah lebih banyak.
- Jika user secara eksplisit mengisi `jumlahPerTipe`, proporsi otomatis diabaikan.
- Sisa kuota setelah proporsi tetap diisi acak dari kandidat yang cocok (tidak memaksa tipe yang stoknya habis).

## §69. Pengaturan kuis Fase 1 (waktu, token, jenis, TP)

- Field baru pada `lms_kuis`: `waktuMulai`, `waktuSelesai`, `token`, `jenisPenilaian`, `tpIds`, `tpNamaList`.
- `jenisPenilaian` hanya boleh `latihan` | `slm` | `sts` | `sas`. Default `latihan` (hasil tidak masuk nilai).
- Untuk STS/SAS, `tpIds`/`tpNamaList` boleh berisi lebih dari satu TP (untuk analisis capaian per TP nanti).
- Rules harus tetap mengizinkan field ini sebagai opsional. Jangan menghapus validasi kelas/mapel/dibuatOleh.
- Setelah mengubah rules, salin file lengkap ke SDM01Penilaian dan deploy (`npm run deploy:rules`).

## §71. Skeleton penilaian kuis

- Function `nilaiKuisLms` masih skeleton. Jangan menganggap skor sudah benar sebelum logika perbandingan kunci diimplementasi.
- Kunci jawaban tidak boleh dikirim ke klien. Semua perbandingan dilakukan di Cloud Function.
- Deploy: `firebase deploy --only functions:nilaiKuisLms` dari repo SDM01Penilaian.

## §72. Koleksi lms_jawaban

- Jawaban siswa disimpan di `lms_jawaban`, terpisah dari dokumen kuis yang berisi kunci.
- Siswa hanya boleh membuat dokumen dengan `siswaUid == request.auth.uid`.
- Jangan membuka update dari klien; koreksi guru (jika perlu) dilakukan lewat jalur lain atau admin.
- Setelah mengubah rules, salin file lengkap ke SDM01Penilaian dan deploy (`npm run deploy:rules`).

## §54. Layout area siswa & halaman baru (full-width responsive)

54.1 **Konten halaman siswa memakai lebar penuh shell** (`.sw-main` max-width 1600px, padding responsif). Jangan membungkus daftar/kartu/konten utama dengan `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl`, `max-w-3xl`, atau `max-width` ≤ 48rem kecuali untuk **satu kartu pesan kosong / placeholder terpusat** (mis. `.sw-placeholder`).

54.2 **Pola yang dilarang (regresi berulang):** `className="… max-w-2xl mx-auto"` atau container sempit di tengah layar PC yang meninggalkan ruang kosong lebar di kiri-kanan. Pola ini sudah muncul di `SiswaKuis` dan beberapa halaman baru lainnya.

54.3 **Grid fluid:** daftar kartu (menu, mapel, materi, kuis) memakai CSS grid `minmax(0, 1fr)` dengan breakpoint:
- HP: 1–2 kolom
- tablet (≥768px): 2–3 kolom
- PC (≥1024/1200px): 3–5 kolom sesuai jenis kartu
Jangan memaksa satu kolom sempit di desktop.

54.4 **Navigasi siswa:** HP = bottom nav fixed; tablet/PC (≥768px) = strip horizontal di bawah header (bukan bottom fixed), agar konten tidak selalu mengosongkan ruang bawah besar.

54.5 Aturan ini berlaku untuk **semua halaman baru** di area siswa (`src/pages/siswa/*`) dan sebaiknya diikuti juga untuk halaman guru yang bukan editor khusus (bukan SoalEditor). Sebelum merge halaman baru, cek di viewport ~1280px dan ~375px apakah konten mengisi lebar secara wajar.
54.6 **Regresi 2026-11-09 (SiswaKuis):** rewrite fitur progres/timer mengembalikan `max-w-2xl mx-auto` di daftar dan `max-w-5xl mx-auto` di mode kerjakan. Checklist sebelum merge halaman siswa: (1) tidak ada `max-w-md`…`max-w-5xl` pada wrapper konten utama, (2) uji PC ~1280px konten mengisi `.sw-main`, (3) hanya placeholder/dialog boleh sempit + `mx-auto`.

## §73. Kuis siswa (pengerjaan online)

73.1 Halaman pengerjaan siswa **wajib** memakai `SoalTampil` (bukan form ad-hoc). Semua tipe (`pg`, `pgk`, `jodoh`, `bs`, `isian`, `uraian`) dan gambar (`gambarId` → `GambarSoal` / `lms_gambar`) harus tampil.

73.2 Progres jawaban disimpan di `localStorage` (`lms_kuis_progress_v1_{siswaId}_{kuisId}`). Jangan menghapus progres kecuali setelah kirim sukses (`clearProgress`).

73.3 Saat mengerjakan: pasang `beforeunload`, dialog konfirmasi Keluar, dan sembunyikan `.sw-nav` agar siswa tidak pindah halaman tanpa sengaja.

73.4 Rules `lms_kuis` read: guru lewat `lihatMapelKelas`; siswa LMS hanya kuis **aktif** kelasnya (`resource.data.kelas == request.auth.token.kelas && resource.data.aktif == true`). Snapshot memuat kunci — diterima untuk latihan; ujian berisiko tinggi harus dilayani Cloud Function yang menyaring kunci (belum diimplementasi).

73.5 Import `styles/soal.css` di rute siswa yang menampilkan `SoalTampil`, atau pastikan stylesheet sudah dimuat global.

## §74. Firestore rules — selalu dari sumber terbaru

74.1 **Setiap** perubahan `firestore.rules` wajib dimulai dari file terbaru di repo yang di-deploy (biasanya `main` LMS atau salinan di SDM01Penilaian setelah deploy terakhir). Jangan memakai salinan di zip perbaikan lama sebagai basis — itu sumber regresi berulang (batas soal 100 vs 300, akses siswa kuis, dll.).

74.2 Batas `lms_paket_soal.soal.size()` di rules **harus** sama dengan `BATAS_SOAL_PER_PAKET` di `src/types/soal.ts` (saat ini **300**). Validasi update memakai seluruh dokumen hasil; ganti status saja ikut memeriksa ukuran array `soal`.

74.3 Setelah mengubah rules: salin file **utuh** ke SDM01Penilaian, `npm run deploy:rules`, uji update status paket siap↔draf dengan paket yang soalnya >100 bila ada.

## §75. Hasil kuis siswa (`lms_jawaban`)

75.1 Setiap **Selesai & Kirim** membuat dokumen baru di `lms_jawaban` (bukan menimpa). Field wajib: `kuisId`, `siswaId`, `percobaan`, `skorOtomatis`, `totalPoin`, `jawaban`, `status`.

75.2 **Latihan** boleh diulang dari UI siswa hanya lewat konfirmasi «Kerjakan lagi dari awal» (progres lokal dihapus). SLM/STS/SAS tidak menawarkan ulang dari klien.

75.3 Tulis `lms_jawaban` hanya Cloud Function / Admin SDK. Rules klien: `create/update/delete: if false`.

75.4 Query siswa: `where siswaId == claim && where kuisId == …`. Siapkan indeks komposit bila Console meminta.

## §55. Hasil kuis (`lms_jawaban`) & analisis guru

55.1 Koleksi `lms_jawaban` wajib ada di `firestore.rules` (shared). **Tulis hanya Admin SDK** (Cloud Function `nilaiKuisLms`). Klien: siswa baca miliknya (`siswaId` == claim); guru baca lewat `lihatMapelKelas(mapel, kelas)` pada field dokumen; admin baca.

55.2 Jangan mengaitkan keberadaan analisis dengan `jenisPenilaian`. **Latihan** (`latihan`) tidak masuk nilai rapor, tetapi setiap kiriman tetap menghasilkan dokumen `lms_jawaban` dan harus bisa dilihat guru di tab **Hasil siswa**.

55.3 Jangan menulis kunci jawaban ke dokumen `lms_jawaban` di luar yang sudah dinilai server (`detail.benar` / skor). Kunci penuh tetap hanya di snapshot `lms_kuis.soal` (baca guru) dan di CF.

55.4 File `firestore.rules` di-deploy hanya dari repo SDM01Penilaian (`npm run deploy:rules`). Perubahan bagian LMS disalin sebagai file **utuh** ke SDM01Penilaian sebelum deploy.

55.5 Penilaian manual (uraian / koreksi isian) **hanya** lewat Cloud Function `nilaiManualKuisLms`. Jangan membuka `allow update` klien pada `lms_jawaban`. Skor per soal disimpan di `detail[]`; total di `skorOtomatis` dihitung ulang server.

55.6 Isian dinilai otomatis dengan normalisasi spasi/kapital dan kesetaraan angka. Tetap sediakan UI koreksi guru karena sinonim/ejaan tidak dicocokkan.

## §56. Analisis kuis AI

56.1 Fitur analisis hasil kuis dengan AI (**hanya** UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1` + email `arif.azwar79@gmail.com`). Cek di klien (`bolehAnalisisKuisAi`) dan **wajib** di CF (`bolehPemanggilAi`). Jangan memperluas daftar akun tanpa keputusan eksplisit.

56.2 Kunci Gemini hanya di secrets Cloud Functions. Jangan memanggil API AI dari browser.

56.3 Analisis membaca agregat `lms_jawaban` di server; jangan mengirim kunci jawaban atau data siswa berlebih ke model di luar yang diperlukan untuk statistik/contoh jawaban salah.

## §57. Kuis offline

57.1 `modePelaksanaan` default `online`. Offline: guru input di tab Input offline; portal siswa menyembunyikan kuis offline.

57.2 Penulisan `lms_jawaban` offline hanya lewat CF `simpanJawabanOfflineKuis` (Admin SDK). Field `sumber: 'offline'`.

57.3 Bantu AI offline memakai gate yang sama §56 (UID+email); skor diterapkan lewat `nilaiManualKuisLms`.

## §58. Sinkron kuis → nilai Penilaian

58.1 Penulisan `nilai_tp` / `nilai_sts` / `nilai_sas` dari LMS hanya lewat CF `sinkronNilaiKuisLms` (Admin SDK). Jangan tulis langsung dari klien LMS tanpa rules yang setara Penilaian.

58.2 Hanya jenis SLM/STS/SAS. Skor = (skorOtomatis/totalPoin)×100; satu nilai per TP terdaftar di kuis (atau `nilaiPerTp` bila diisi).

58.3 TP harus resolve ke `tp_kktp` (id atau nama + mapel/kelas). Gagal resolve → tolak sinkron dengan pesan jelas.

## §58. Sinkron kuis → nilai Penilaian (lanjutan)

58.4 Tombol sinkron **hanya** di tab Hasil siswa (`HasilKuisPanel`). Jangan membuat halaman rekap terpisah hanya untuk sinkron — dropdown kelas/mapel di halaman rekap sering kosong bila penugasan belum lengkap, dan alur guru lebih natural dari detail kuis.
58.5 Hapus menu sidebar «Rekap Kuis» bila sudah ada sinkron di Hasil siswa.

## §59. Import tertimpa saat menambah fitur di komponen besar

59.1 Saat menambah import baru di file besar (mis. `HasilKuisPanel.tsx`), **tambahkan** baris import baru; jangan mengganti blok import lama. Menimpa blok import menimbulkan puluhan error TS2304 + TS7006 sekaligus (error `implicit any` hanyalah turunan dari tipe yang hilang).
59.2 Sebelum push/deploy, jalankan `npx tsc -b` di lokal. Bila error muncul beruntun, periksa dulu bagian import di baris atas file sebelum menelusuri logika.
59.3 `HasilKuisPanel.tsx` memakai dua sumber import yang harus tetap ada bersamaan: `../lib/analisisKuisAi` (analisis AI & laporan) dan `../lib/sinkronNilaiKuis` (sinkron ke Penilaian).

## §76. Modul TKA (kelas 6)

76.1 **Akses TKA ditegakkan di tiga tempat yang harus sinkron:** `src/lib/tkaAkses.ts` (tampilan/rute), `firestore.rules` (`tkaAdmin`, `tkaGuruKelas6`, `tkaStaf`, `tkaSiswa`), dan Cloud Function TKA. Menyembunyikan menu saja BUKAN pengamanan. Mengubah salah satunya (mis. menambah guru, mengganti email admin) berarti mengubah ketiganya.

76.2 **Siapa:** admin TKA = UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1` + email `arif.azwar79@gmail.com` (pola sama dengan §56). Guru kelas 6 = `waliKelas` memuat **6A, 6B, atau 6C** (jangan hardcode hanya 6A/6B; kelas 6C ada di `DAFTAR_KELAS_SD`), role `guru`/`guru_akademik`. Siswa = claim `kelas` diawali kelas 6 yang sama.

76.3 **Token try out tidak boleh ada di `tka_paket`** (siswa kelas 6 membaca paket aktif). Token hanya di `tka_token/{paketId}`; rules `tka_paket` menolak field `token`. Pemeriksaan token siswa dilakukan Cloud Function (Admin SDK). TKA lama menyimpan token di dokumen paket dan mengeceknya di browser — jangan dibawa kembali.

76.4 **Kunci jawaban tidak boleh terbaca siswa:** `tka_soal` hanya staf TKA. Jangan membuat koleksi «publik» berisi kunci/hash (pola `soalPublik` + hash SHA-256 di klien dari TKA lama dihapus dari desain). Soal ke siswa dikirim Cloud Function tanpa kunci; penilaian di server.

76.5 **Query vs rules:** siswa membaca `tka_paket` dengan `where('aktif', '==', true)` dan `tka_percobaan` dengan `where('siswaId', '==', <siswaId sendiri>)`. Tanpa filter itu rules menolak seluruh query ("Missing or insufficient permissions"), bukan hanya dokumen yang tidak boleh.

76.6 **Semantik `aktif`:** paket aktif hanya bila `aktif === true`. Paket TKA lama tanpa field `aktif` dianggap nonaktif (perilaku `susun-paket.html`); skrip migrasi menjaga ini.

76.7 **Pemetaan siswa migrasi:** NISN → nama+kelas (dinormalisasi). Lebih dari satu kandidat = ambigu, **tidak ditebak**. Percobaan siswa tak terpetakan **tidak ditulis** dan tercantum di laporan. Selalu dry-run dan baca `pemetaanSiswa` + `percobaanDilewati` sebelum `--apply`.

76.8 **Skrip migrasi:** project sumber/tujuan dikunci, dokumen berbeda tidak ditimpa tanpa `--overwrite`, kunci service account tidak boleh di-commit. firebase-admin dimuat dari `functions/` (jalankan `npm install` di sana).

76.9 **Rules:** mengikuti §74 — basis selalu `firestore.rules` terbaru di SDM01Penilaian. Pada 2026-11-10 salinan di repo LMS ternyata tertinggal dari SDM01Penilaian (batas soal 100 vs 300, `lms_kuis` siswa, `lms_jawaban`); kedua salinan disamakan di Tahap 1. Aturan tulis `tka_paket` sementara longgar untuk staf TKA dan akan diperketat di Tahap 3 bersama alur pengajuan try out.

76.10 **Navigasi siswa:** item TKA ditambahkan dinamis (`SiswaLayout`), bukan di array `NAV` tetap, agar siswa kelas lain tidak melihatnya. Item nav memakai `flex: 1` sehingga 5 item muat di HP; cek lebar ~375px saat menambah item lagi. Ikon baru harus ditambahkan di `SiswaIconName` DAN di `switch` `SiswaIcon` sekaligus.

## §77. Koreksi arah TKA: ruang khusus di pipeline kuis (menggantikan §76.3–76.5)

77.1 **TKA tidak punya koleksi sendiri.** §76.3–76.5 (token/kunci/query pada `tka_*`) tidak berlaku karena koleksi `tka_*` tidak dibuat. Data TKA hidup di `lms_paket_soal` / `lms_kuis` / `lms_jawaban` / `lms_gambar` dengan mapel «TKA Matematika» atau «TKA Bahasa Indonesia» dan kelas 6A/6B/6C. Jangan membuat koleksi `tka_*` baru tanpa mengubah dokumen ini.

77.2 **Akun `arif.azwar79@gmail.com` BUKAN admin** — wali kelas 5A dengan pengecualian email khusus TKA (uji sistem). Jangan menyebutnya admin di UI/dokumen, dan jangan mengandalkan role admin untuk akses TKA. Kode: `tkaAkses.ts` (`EMAIL_AKSES_KHUSUS_TKA`); rules: `tkaEmailKhusus()`. UID tidak dipakai; hanya email.

77.3 **Rules: jangan ubah `tulisMapelKelas` / `lihatMapelKelas`** (dipakai Penilaian) untuk TKA. Akses TKA ditambahkan lewat `lmsTulisMapelKelas` / `lmsLihatMapelKelas` yang HANYA dipakai koleksi `lms_*`. Koleksi `lms_*` baru wajib memakai helper `lms…` agar ruang TKA ikut bekerja. Guru kelas 6 hanya untuk kelasnya (`tkaGuruKelas6(kelas)`); akun email khusus untuk semua kelas 6.

77.4 **Daftar mapel TKA ada di tiga tempat:** `MAPEL_TKA` (`tkaAkses.ts`), `mapelTka()` (rules), dan `MAPEL_LMS` (skrip migrasi). Mengubah nama mapel berarti mengubah ketiganya dan menyalin ulang `firestore.rules` ke SDM01Penilaian.

77.5 **Menu siswa:** kuis TKA tampil hanya di `SiswaTka`; `SiswaKuis` menyaringnya (`adalahMapelTka`). Jangan menghapus filter itu, atau kuis TKA muncul ganda. Item nav TKA dinamis (kelas 6), bukan di array `NAV` tetap.

77.6 **Ruang TKA di `KelasDetail`** hanya menampilkan tab Bank Soal dan Kuis (Materi/Tugas/Pengumuman disembunyikan). Ruang TKA tidak muncul di `/kelas` (daftar berasal dari penugasan); masuknya lewat menu TKA.

77.7 **Rumus (KaTeX):** hanya untuk soal bertanda `rumus: true` (soal TKA hasil migrasi), supaya tanda `$` di konten lain tidak berubah. Rumus dirender SETELAH HTML dibersihkan, dan hasilnya tidak dibersihkan ulang (keluaran KaTeX dari teks ter-escape). Jangan memanggil KaTeX pada node yang dikelola React (mutasi DOM merusak rekonsiliasi); pakai `htmlDenganRumus`/`teksDenganRumus` + `dangerouslySetInnerHTML`. KaTeX dimuat malas (`muatKatex`), jangan diimpor statis.

77.8 **Stimulus:** gunakan `bersihHtmlStimulus` (mengizinkan tabel + colspan/rowspan/scope), bukan `bersihHtml`. Soal dengan `stimulus` menampilkan bacaan + gambar lewat `StimulusSoal`; `SoalTampil` memakai prop `tanpaStimulus` bila halaman pemanggil menampilkannya sendiri (jangan tampil dobel).

77.9 **Soal B/S kustom (`labelBenar`/`labelSalah`)** hanya mengubah tampilan; skor tetap boolean di `nilaiKuisLms`. `pgk-cat` dengan ≠ 2 kolom belum didukung dan dilewati migrasi.

77.10 **Migrasi:** `migrasi-tka-soal.mjs` dry-run bawaan, project terkunci, paket/gambar yang ada tidak ditimpa tanpa `--overwrite`, ID paket deterministik (`tka-<kelas>-<mapel>-<materi>-<n>`) sehingga aman diulang. Soal yang kuncinya tidak cocok dilewati dan dilaporkan; jangan menebak kunci.

77.11 **Pengerjaan TKA:** timer berbasis tenggat (`mulaiMs` disimpan di progres; waktu tetap jalan saat keluar) dan kirim otomatis saat habis (dijaga `kirimRef` agar tidak ganda). Jadwal dan token hanya dicek di klien — bukan keamanan sungguhan; `nilaiKuisLms` belum menegakkannya.

## §78. Rekap Nilai (sinkron ke Penilaian)

78.1 **Rekap Nilai adalah pusat agregasi**, bukan pengganti input di Tugas/Kuis. Nilai tetap diinput di modul sumber (`lms_nilai_tugas`, kuis offline/online). Halaman Rekap hanya menggabungkan dan (nanti) menulis nilai akhir TP untuk sinkron.

78.2 **Struktur UI:** kelas × mapel → tab per TP (`tp_kktp`) → sub-tab SLM | STS | SAS. Jangan meratakan semua TP ke satu tabel besar tanpa tab; guru butuh konteks per TP.

78.3 **SLM multi-sumber:** satu TP bisa punya banyak tugas + kuis (jenisPenilaian=`slm`). Bobot per sumber disimpan di `lms_bobot_slm` (ID: `{kelas}__{mapelSlug}__{tpId}`). Jangan hard-code bobot di klien tanpa dokumen.

78.4 **STS/SAS biasanya satu sumber** (satu event kuis). Tetap tampilkan sub-tab terpisah agar konsisten dengan model Penilaian (`nilai_sts` / `nilai_sas`).

78.5 **Jangan menulis langsung ke koleksi Penilaian** (`nilai_tp`, `nilai_sts`, `nilai_sas`) dari klien LMS. Sinkron hanya lewat Cloud Function (Admin SDK), sama pola `sinkronNilaiKuisLms`.

78.6 **Tahap 1 hanya shell.** Jangan menganggap nilai di tabel Rekap sudah final sampai tahap agregasi + bobot + CF selesai. Placeholder menampilkan "—" dengan sengaja.

78.7 Koleksi baru `lms_bobot_slm` (dan nanti cache nilai akhir bila ada) **wajib** didaftarkan di `firestore.rules` (helper `lmsTulisMapelKelas` / `lmsLihatMapelKelas`) sebelum dipakai tulis dari klien. Salin rules lengkap ke SDM01Penilaian.

## §79. Rekap Nilai — agregasi & bobot SLM (Tahap 2)

79.1 Sumber SLM hanya tugas yang `tpList`/`tpId` memuat `tpId` aktif dan `jenisPenilaian` bukan `latihan`/`sts`/`sas` (field kosong = SLM legacy), serta kuis dengan `jenisPenilaian == 'slm'` dan `tpIds` memuat `tpId`.

79.2 Skor kuis selalu dinormalisasi ke 0–100 lewat `skorKe100(skorOtomatis, totalPoin)`. Jangan menampilkan poin mentah di tabel rekap.

79.3 Satu siswa bisa punya beberapa `lms_jawaban` (percobaan). Pakai `ringkasPerSiswa` (percobaan/terbaru) — konsisten dengan Hasil Kuis.

79.4 Bobot default = 1 untuk sumber baru. Sumber yang hilang tidak ikut dihitung; `gabungSumberDenganBobot` hanya menggabungkan sumber yang masih terdeteksi.

79.5 `lms_bobot_slm` ditulis klien dengan `lmsTulisMapelKelas`. Rules wajib di-deploy sebelum Simpan bobot dipakai di produksi.

79.6 Jangan tulis langsung ke koleksi nilai di SDM01Penilaian dari klien LMS. Sinkron nilai akhir TP → Penilaian hanya lewat Cloud Function (Tahap 3).

79.7 Query tugas/kuis/nilai tetap `where kelas + mapel` agar lolos rules yang ada.

## §80. Firestore rules LMS harus selalu dari salinan lengkap SDM01Penilaian

80.1 Sumber kebenaran rules bersama = repo SDM01Penilaian. Setiap perubahan match `lms_*` dibuat di situ (atau disalin utuh ke situ) lalu `deploy:rules` dari situ.

80.2 Repo LMS boleh menyimpan salinan `firestore.rules` yang **identik**, hanya untuk referensi. Jangan deploy dari repo LMS jika file di sana lebih pendek / lebih lama.

80.3 Sebelum deploy rules, cek keberadaan `match /lms_tugas` dan `match /lms_nilai_tugas`. Jika hilang, UI tugas/nilai akan kosong meski data masih ada.

80.4 Jangan pernah menimpa rules produksi dengan snippet atau file partial. Selalu file **lengkap**.

## §81. Daftar tugas/kuis tidak boleh mengandalkan penugasan saja

81.1 Katalog tugas guru wajib menggabungkan query penugasan kelas×mapel DENGAN query `dibuatOleh == uid` (dan admin: opsi muat semua).

81.2 Jangan menelan error permission di `catch` kosong — tampilkan ke UI jika hasil akhir kosong.

81.3 Rules baca `lms_tugas` / `lms_kuis` harus mengizinkan pembuat (`dibuatOleh == uid`) agar data lama tidak "hilang" saat penugasan/mapel berubah.

81.4 Tugas tidak lagi di tab Ruang Kelas — hanya menu `/tugas`.

## §82. Jenis penilaian tugas (selaras kuis)

82.1 Field `jenisPenilaian` pada `lms_tugas`: `latihan` | `slm` | `sts` | `sas`. Default create = `slm`. Baca dokumen lama tanpa field → perlakukan sebagai `slm`.

82.2 Rekap Nilai memfilter sumber tugas menurut `jenisPenilaian`. Jangan memasukkan tugas `latihan` ke nilai SLM/STS/SAS.

82.3 Kuis sudah memakai field yang sama di `lms_kuis`; jangan menduplikasi konstanta label dengan teks berbeda — selaraskan makna dengan `NAMA_JENIS_PENILAIAN` / `NAMA_JENIS_PENILAIAN_TUGAS`.

## §83. Rekap Nilai & Ruang Kelas memakai sumber kelas×mapel yang sama

83.1 Jangan mengisi dropdown Rekap hanya dari `daftarRuangKelas` (penugasan murni) jika Ruang Kelas memakai `perluasDenganMapelMaster` untuk wali. Keduanya harus konsisten agar wali tidak melihat “belum ada penugasan” di Rekap padahal kartu ruang penuh.

83.2 Panel **Penugasan aktif** di `KelasList` menggantikan teks intro generik. Jangan mengembalikan copy “Setiap kartu adalah satu mata pelajaran…” sebagai konten utama di atas katalog.

## §84. Field soal TKA di editor dan pengolahan soal

84.1 **Field TKA pada `Soal`** (`stimulus`, `tipeMateri`, `rumus`, `labelBenar`, `labelSalah`) bersifat opsional dan hanya ada pada soal TKA. Kode yang membangun ulang soal (ganti tipe, impor, AI, salin) WAJIB mempertahankannya. `ubahTipe` kini membawa `stimulus`/`tipeMateri`/`rumus`; kode baru yang menyusun `Soal` bidang demi bidang harus menyalinnya. `snapshotSoal` (kuis) memakai klon JSON penuh — jangan diubah menjadi daftar putih bidang, atau bacaan dan rumus hilang di kuis siswa.

84.2 **Jangan menulis `undefined` ke Firestore.** Sertakan field TKA hanya bila ada (`...(x ? { x } : {})`), seperti di `ubahTipe`.

84.3 **Stimulus diedit lewat `<textarea>`, bukan `RichEditor`.** Editor kaya tidak mengenal tabel; menyuntingnya di sana membuang tabel. Jangan menggantinya dengan `RichEditor` sebelum ada dukungan tabel.

84.4 **Urutan pembersihan stimulus:** `stimulusKeHtml` (teks biasa → paragraf) → `bersihHtmlStimulus` → `htmlDenganRumus`. Jangan membalik urutan (rumus tidak boleh dirender sebelum pembersihan).

84.5 **`rumus: true` otomatis untuk soal baru di ruang TKA** (efek di `TkaFieldEditor`). Bila efek itu dihapus, rumus `$…$` tampil mentah di soal baru.

84.6 **`analisisSoal`:** soal dengan `stimulus` teks dianggap sudah punya stimulus. Jangan mengembalikan pemeriksaan hanya-gambar.

## §85. TKA bank bersama + 3 mapel (tanpa 6C)

85.1 **Tidak ada pemisahan bank per rombel.** Bank soal TKA memakai kelas kanonik `6` (`KELAS_TKA_BANK`). Dashboard menampilkan 3 kartu mapel saja. Jangan mengembalikan grid 6A/6B/6C × mapel.

85.2 **Kelas 6C tidak dipakai.** `KELAS_TKA` = `['6A','6B']`. Rules `tkaKelas6` menerima `6`, `6A`, `6B` saja.

85.3 **Mapel TKA** = `TKA Matematika`, `TKA Bahasa Indonesia`, `TKA IPA`. Harus sama di `tkaAkses.ts` (`MAPEL_TKA`), `firestore.rules` (`mapelTka`), dan skrip migrasi.

85.4 **Filter bank TKA ≠ filter mapel biasa.** Ganti TP dengan **Materi** (daftar tetap di `MATERI_TKA`). Sembunyikan «Kelompokkan». Bentuk soal hanya `pg` | `pgk` | `bs`.

85.5 **Akses guru:** wali 6A **atau** 6B (atau email khusus) boleh baca/tulis semua ruang TKA (kelas `6` dan sisa 6A/6B). Jangan membatasi lagi ke «hanya kelas wali» untuk mapel TKA.

85.6 **Siswa:** query kuis aktif untuk `kelas` token **dan** kelas `6` (mapel TKA). Rules `lms_kuis` read siswa harus mengizinkan keduanya.

85.7 **`ruangTka(mapel)`** hanya menerima mapel (kelas selalu `6`). Pemanggil lama yang mengirim `(kelas, mapel)` harus disesuaikan.

## §86. TKA materi paket, template, AI stimulus

86.1 **Materi di level paket.** Paket TKA menyimpan `tipeMateri`. Soal baru mewarisi nilai itu; editor soal mengunci pilihan materi bila paket sudah menetapkan. Jangan mengembalikan pemilihan materi per-soal sebagai satu-satunya cara mengelompokkan.

86.2 **Template/import TKA ≠ mapel biasa.** Gunakan `buatTemplateJsonTka` / `buatTemplateCsvTka` dan `validasiMetadataTka` (field `tipeMateri`). Jangan memaksa TP pada ruang TKA.

86.3 **AI stimulus TKA.** Untuk mapel TKA + level stimulus ≠ `tanpa`, narasi AI masuk ke `stimulus`; `teks` hanya pertanyaan singkat. Mapel non-TKA tetap menaruh narasi di `teks`.

86.4 **Navigasi.** Dari ruang TKA, tautan kembali mengarah ke `/tka`, bukan `/kelas`.

86.5 **IPA materi** mencakup Fase B dan Fase C di `MATERI_TKA['TKA IPA']`.


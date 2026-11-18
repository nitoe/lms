## 2026-11-18 — Lomba siswa: akses materi + HTML interaktif (localStorage)

- **Akses materi:** di daftar lomba siswa, tombol «Materi & kuis» selalu ada (selain «Mulai kerjakan») agar siswa tidak loncat langsung ke kuis tanpa melihat materi.
- **Detail lomba:** pesan jelas bila materi gagal dimuat (permission/rules) vs benar-benar kosong.
- **HTML interaktif:** polyfill `localStorage`/`sessionStorage` disisipkan di dokumen iframe. Modul seperti MIPA Quest sebelumnya crash di baris pertama (SecurityError origin opaque) → semua tombol/filter/kuis mati. Sekarang skrip lanjut jalan.
- File: `src/pages/siswa/SiswaLomba.tsx`, `src/pages/siswa/SiswaLombaDetail.tsx`, `src/styles/lomba.css`, `src/lib/html.ts`.
- Materi HTML yang disimpan **sebelum** fix simpan-utuh masih perlu diunggah ulang jika script-nya ter-strip.
- Antiregresi: §Lomba.MateriAksesSiswa, §MateriHtml.LocalStoragePolyfill.

## 2026-11-18 — Materi HTML: iframe dokumen penuh (modul interaktif)

- **Masalah:** Pratinjau/simpan memakai DOMPurify + body-only → modul seperti *MIPA Quest* (CSS, script, details, SVG, kuis, progress) hancur/ tampil jelek.
- **Simpan:** `siapkanSimpanHtml` menyimpan dokumen HTML utuh (style/script tetap). Batas tetap 400.000 karakter. Cuplikan kosong tetap ditolak.
- **Tampil:**
  - Dokumen interaktif (`htmlButuhDokumenPenuh`) → **iframe** `srcdoc` + `sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"` **tanpa** `allow-same-origin` (skrip tidak menyentuh parent).
  - Cuplikan sederhana → tetap DOMPurify + optimasi gambar eksternal (inline).
- **CSS:** `.mh-html-iframe` tinggi ~viewport agar modul full-page nyaman dibaca.
- File: `src/lib/html.ts`, `src/lib/materi.ts`, `src/components/materi/MateriHtmlViewer.tsx`, `src/styles/materi-halaman.css`.
- Materi HTML yang sudah tersimpan **setelah strip lama** perlu diunggah ulang agar interaktif.
- Tidak perlu ubah firestore.rules (batas kontenHtml 400k sudah cukup untuk ~90 KB).
- Antiregresi: §MateriHtml.Iframe.

## 2026-11-18 — Materi HTML: pratinjau + materi lomba hanya untuk peserta

- **Pratinjau HTML (guru):** tombol «Pratinjau» di form + HTML sebelum simpan — menampilkan `MateriHtmlViewer` dari kode yang sedang diedit (termasuk gambar eksternal setelah sanitasi). Mencegah siswa mendapat halaman rusak.
- **Visibilitas materi lomba (siswa):**
  - Rules `lms_materi`: siswa hanya boleh baca dokumen dengan `lombaId` jika `token.siswaId` ∈ `lms_lomba/{id}.siswaIds`. Cabang baca kelas biasa **tidak** berlaku bila ada `lombaId` (mencegah bocor ke materi mapel/LB).
  - `daftarMateriKelas` mengecualikan dokumen ber-`lombaId` (defense in depth).
  - `daftarMateriLombaSiswa(lombaId)` + section «Materi lomba» di `SiswaLombaDetail` (hanya setelah cek peserta).
- **Wajib deploy `firestore.rules`** (file utuh ke SDM01Penilaian → `npm run deploy:rules`).
- File: `src/components/MateriPanel.tsx`, `src/lib/materiSiswa.ts`, `src/pages/siswa/SiswaLombaDetail.tsx`, `firestore.rules`.
- Antiregresi: §Lomba.Materi.

## 2026-11-18 — Materi Lomba/TKA: TP tidak wajib (termasuk HTML)

- **Mapel kelas biasa:** Tujuan Pembelajaran tetap wajib saat menambah materi (file/YouTube/tautan/HTML/halaman).
- **Lomba** (`lombaId` terisi) dan **mapel TKA** (`adalahMapelTka`): form materi **tidak** menampilkan blok TP, tombol tambah tidak terkunci karena daftar TP kosong, simpan tanpa `tpId`.
- `tambahMateriHalaman` / editor halaman: TP opsional bila `lombaId` ada.
- Selaras pola Bank Soal (TKA filter materi, bukan TP; paket boleh tanpa TP).
- File: `src/components/MateriPanel.tsx`, `src/components/materi/MateriHalamanEditor.tsx`, `src/lib/materi.ts`.
- Tidak perlu ubah rules.
- Antiregresi: §Materi.TpOpsionalLombaTka.

## 2026-11-18 — Materi: dukungan sumber HTML (paste kode / file .html) + gambar eksternal

- Guru (termasuk di modul **Lomba**) dapat menambah materi jenis **HTML**: tempel kode HTML atau unggah file `.html` / `.htm`.
- Gambar/ilustrasi dari sumber eksternal (imgbb, Postimages, Google Drive, CDN, dll.) **tetap ter-load** lewat `<img src="https://…">` setelah sanitasi.
- Sanitasi: `bersihHtmlLengkap` (DOMPurify) — mengizinkan `img`/`a`/`figure`/heading/table, membuang script & event handler; dokumen penuh diekstrak isi `<body>`.
- Field baru `kontenHtml` di `lms_materi` (inline, maks. ~400 KB karakter). Jenis baru `'html'`.
- Viewer guru & siswa: `MateriHtmlViewer` (inline Baca, bukan buka tab baru).
- Rules: `jenis` mengizinkan `'halaman'` dan `'html'`; validasi `kontenHtml` & `halaman` size. **Wajib deploy firestore.rules** (salin utuh ke SDM01Penilaian → `npm run deploy:rules`).
- Bonus anti-regresi Lomba: `tambahMateriHalaman` + editor menerima `lombaId` (sebelumnya materi halaman di lomba bisa gagal permission).
- File: `src/types/materi.ts`, `src/lib/html.ts`, `src/lib/materi.ts`, `src/lib/materiUi.ts`, `src/components/MateriPanel.tsx`, `src/components/materi/MateriHtmlViewer.tsx` (baru), `src/components/materi/MateriHalamanEditor.tsx`, `src/components/JenisIcon.tsx`, `src/pages/siswa/SiswaMateri.tsx`, `src/styles/materi-halaman.css`, `src/index.css`, `firestore.rules`.
- Antiregresi: ANTIREGRESI.md §MateriHtml.

## 2026-11-18 — Lomba: cetak kartu peserta (A4, 8 kartu per lembar)

- **Admin / guru pengampu:** tombol «Cetak kartu peserta» di panel Peserta (tab Ringkasan, detail lomba) → dialog opsi (pilih peserta, pelaksanaan opsional, tahun pelajaran, kotak foto 2×3) → jendela cetak berisi pratinjau + tombol «Cetak / Simpan PDF».
- **Tata letak:** A4 portrait, 2 kolom × 4 baris = 8 kartu per lembar (tiap kartu 97 × 70,1 mm), garis potong putus-putus; 20 peserta = 3 lembar. Nomor kartu urut kelas lalu nama dan tetap sama walau mencetak sebagian peserta.
- **Isi kartu:** logo sekolah (`public/logo-sdm.png`), nama lomba, penyelenggara, tingkat, nomor, nama, kelas, **NISN (kata sandi login)**, pelaksanaan (atau masa lomba), mapel, alamat `lms.sdmuhammadiyah01kks.sch.id/siswa/masuk` + tiga langkah masuk, tahun pelajaran.
- NISN dibaca dari `siswa/{id}` saat cetak dan **tidak disimpan** ke `lms_lomba`. Peringatan di jendela cetak bila NISN belum terdaftar atau siswa nonaktif.
- Tanpa perubahan koleksi, field, rules, index, atau functions — **tidak perlu deploy rules**.
- File: `src/lib/kartuLomba.ts` (baru), `src/components/KartuPesertaDialog.tsx` (baru), `src/styles/kartuLomba.css` (baru), `src/pages/lomba/LombaDetail.tsx`.
- Antiregresi: ANTIREGRESI.md §Lomba.29.

## 2026-11-17 — Pengumpulan tugas oleh siswa (foto) + tab «Pengumpulan» guru

- **Siswa:** di detail tugas, tombol «Ambil / pilih foto» (maks. 3 foto, dikecilkan otomatis di perangkat), catatan opsional, «Kumpulkan». Bisa «Kirim ulang» selama belum dinilai; setelah dinilai terkunci. Kartu tugas menampilkan lencana «Terkumpul».
- **Guru:** tab baru «Pengumpulan» di detail tugas: daftar siswa yang mengumpulkan (waktu, jumlah foto, tanda «Terlambat» bila lewat tenggat), foto dimuat saat baris dibuka.
- Koleksi baru **`lms_pengumpulan`** (meta) dan **`lms_pengumpulan_foto`** (foto terkompres). Foto disimpan di Firestore (bukan Storage); `storage.rules` tidak berubah.
- **WAJIB deploy `firestore.rules`** (versi lengkap di zip, salin juga ke SDM01Penilaian → `npm run deploy:rules`). Tanpa itu, siswa/guru melihat pesan «belum bisa dibuka/dikumpulkan» (aplikasi tidak rusak).
- File: `firestore.rules`, `src/lib/pengumpulan.ts` (baru), `src/pages/siswa/PengumpulanSiswa.tsx` (baru), `src/components/PengumpulanPanel.tsx` (baru), `src/pages/siswa/SiswaTugas.tsx`, `src/pages/TugasDetail.tsx`, `src/styles/siswa.css`, `src/styles/tugas.css`.
- Antiregresi: ANTIREGRESI.md §132.

## 2026-11-17 — Area siswa: poles mode kerjakan (kuis, TKA, lomba)

- Kepala, navigasi soal, dan footer mode kerjakan dibulatkan; tombol Sebelumnya/Berikutnya/Kirim berbentuk pil dan lebih besar (min. 2,9rem); nomor soal aktif berwarna gradien, yang sudah dijawab hijau tegas; kartu soal lebih bulat.
- HP: navigasi soal dibatasi ±2 baris dan bisa digulir (sebelumnya 30 soal memakan ±6 baris sehingga soal terdorong ke bawah); legenda disembunyikan di HP; footer menghormati area aman bawah (home bar iPhone).
- Hanya CSS (`src/styles/siswa.css`) — markup dan logika SiswaKuis/SiswaTka/SiswaLombaDetail tidak diubah.
- Antiregresi: ANTIREGRESI.md §131.17.

## 2026-11-17 — Area siswa: halaman Pencapaian (bintang & lencana) aktif

- Menu «Pencapaian» yang sebelumnya «Segera» kini aktif. **Bintang** = 1 per kuis yang sudah dikerjakan + 1 per tugas yang sudah dinilai. **8 lencana** dengan bilah progres (kuis 1/5/10, skor ≥80, skor 100, tugas dinilai 1/5, 3 tugas bernilai ≥80). Ringkasan: kuis selesai, rata-rata skor kuis, tugas dinilai, rata-rata nilai tugas.
- Dihitung di klien dari data yang sudah ada (`lms_jawaban` milik siswa, `lms_nilai_tugas`) — **tanpa koleksi, field, rules, atau index baru**; halaman hanya membaca.
- Catatan: skor kuis memakai `skorOtomatis`; soal uraian yang dinilai manual tidak ikut terhitung (tertulis di halaman).
- File: `src/lib/pencapaianSiswa.ts` (baru), `src/pages/siswa/SiswaPencapaian.tsx` (baru), `src/App.tsx`, `src/pages/siswa/SiswaBeranda.tsx`, `src/styles/siswa.css`.
- Antiregresi: ANTIREGRESI.md §131.15–131.16.

## 2026-11-17 — Area siswa tahap 2: halaman masuk, Tugas/Kuis, viewer materi

- Halaman masuk siswa: tampilan lebih berwarna & ramah anak (kartu bulat, tombol pil, pil fitur tiga warna, font Nunito). Kolom isian kini 16px agar iPhone tidak zoom otomatis saat fokus. Halaman masuk staf **tidak** berubah.
- Judul halaman Tugas dan Kuis diberi ikon berwarna (selaras Materi).
- Viewer materi (siswa): pil halaman hijau, tombol Sebelumnya/Berikutnya berwarna, titik halaman lebih besar, kartu halaman dibulatkan.
- Perbaikan: bilah navigasi viewer materi di HP kini berada **di atas** nav melayang (sebelumnya bisa tertutup).
- File: `src/pages/siswa/{SiswaMasuk,SiswaTugas,SiswaKuis}.tsx`, `src/styles/siswa.css`.
- Antiregresi: ANTIREGRESI.md §131.10–131.12.

## 2026-11-17 — Area siswa: tampilan baru yang lebih hidup (PC & HP)

- Gejala: akun siswa terasa generik (kartu putih datar, nav sama di semua ukuran layar).
- Perubahan UI (tanpa perubahan data/rules/functions):
  - Shell baru: **sidebar kiri** di PC/tablet landscape (≥1024px, tiap menu berikon warna sendiri); **nav melayang** di HP/tablet portrait dengan menu aktif berwarna.
  - Beranda baru: hero bergradien dengan sapaan, tanggal, tombol «Buka materi», **cincin progres tugas dinilai**; ubin menu berwarna; panel **Pekan ini** (titik oranye = tugas jatuh tempo); panel **Tugas untukmu** (maks. 4, urut tenggat terdekat); rel geser **Pelajaranmu** → langsung ke materi per mapel.
  - Font **Nunito** (bulat, ramah anak) khusus area siswa; area guru tetap Inter.
  - Halaman Materi: judul berikon; kartu pelajaran, kartu materi, tombol, dan hero pelajaran dibulatkan/diberi bayangan lembut (di-scope `.sw-app`).
  - Mode kerjakan kuis/TKA/lomba: offset sticky disesuaikan dengan tinggi header baru (`--sw-header-h`).
- File: `src/pages/siswa/{SiswaLayout,SiswaBeranda,SiswaIcon,SiswaMateri}.tsx`, `src/pages/siswa/useBerandaSiswa.ts` (baru), `src/styles/siswa.css`, `public/fonts/nunito-latin-wght-normal.woff2` (baru).
- Antiregresi: ANTIREGRESI.md §131.

## 2026-11-17 — Lomba multi-pengampu: perbaiki updateDoc undefined

- Gejala: simpan >1 pengampu → `Unsupported field value: undefined`.
- Akar: objek nested di `siswaList`/`guruPengampuList` (mis. `nisn`/`email` opsional) membawa `undefined`; Firestore menolak.
- Perbaikan: `sanitasiPeserta` + normalisasi pengampu (`email: null`, tanpa key undefined) sebelum `addDoc`/`updateDoc`.
- File: `src/lib/lomba.ts`, `src/pages/lomba/LombaForm.tsx`.

## 2026-11-17 — Modul Lomba Tahap 1: fondasi data, akses, CRUD meta

## 2026-11-17 — Lomba Tahap 2: materi, bank soal, kuis

- Tab **Ringkasan · Materi · Bank soal · Kuis** di detail lomba.
- Konten di-scope `lombaId` + kelas bank **LB** + mapel dari `mapelTerkait`.
- Admin: filter **TP dari kelas** (dropdown); pengampu memakai kelas peserta default.
- Panel existing (`MateriPanel`, `BankSoalPanel`, `KuisPanel`) menerima `lombaId` / `tpKelas` opsional — ruang mapel biasa tidak berubah.
- Rules: tulis konten LB bila `lombaKontenBoleh(lombaId)` (admin atau guru pengampu).
- File: `LombaDetail.tsx`, panel×3, `materi.ts`/`soal.ts`/`kuis.ts`, `lombaAkses.ts`, `lomba.css`, `firestore.rules`.

## 2026-11-17 — Lomba form: layout responsif

- Form 1 kolom hingga 1024px, 2 kolom (identitas | mapel) di desktop.
- Mapel: 1→2 kolom; di kolom form sempit tetap 1 kolom agar teks tidak terpotong.
- Guru: 1 / 2 / 3 kolom; max-height berbasis viewport; role disembunyikan di HP.
- Input ≥16px di mobile (anti-zoom iOS); tombol aksi & tambah peserta full-width di HP.
- File: `src/styles/lomba.css`.

## 2026-11-17 — Lomba form: pisah kartu mapel & guru

- Mapel terkait dan Guru pengampu dipisah menjadi **dua kartu** terpisah.
- Layout: Identitas | Mapel (sejajar); **Guru pengampu full-width** di bawah keduanya; Peserta full-width.
- Daftar guru di mode lebar: 2 kolom agar tidak terlalu tinggi.
- File: `src/pages/lomba/LombaForm.tsx`, `src/styles/lomba.css`.

## 2026-11-17 — Lomba form: mapel grid + pemilih guru

- **Mapel terkait:** chip generik diganti grid kartu (inisial + bilah warna `aksenMapel`, centang, hitungan dipilih).
- **Guru pengampu:** dropdown diganti daftar dapat dicari (avatar, email, badge peran, ringkasan terpilih).
- File: `src/pages/lomba/LombaForm.tsx`, `src/styles/lomba.css`.

## 2026-11-17 — Lomba UI: lebar penuh + tampilan non-generik

- **Regresi ruang kosong kiri/kanan:** form lomba memakai `max-w-3xl` → diganti layout full shell (`.lomba-form` grid 2 kolom). Daftar/detail tanpa max-width sempit.
- **Tampilan:** hero oranye (pola TKA), kartu grid, pill mapel, badge status, panel detail — file `src/styles/lomba.css`.
- ANTIREGRESI §6 diperkuat + §Lomba.6: halaman daftar/dashboard modul baru **wajib** full lebar shell; dilarang `max-w-3xl` / `max-w-6xl` pada wrapper halaman.
- File: `src/styles/lomba.css`, `src/pages/lomba/*`, `src/pages/siswa/SiswaLomba.tsx`.


- **Koleksi `lms_lomba`:** nama, identitas, deskripsi, tingkat (sekolah→nasional), mapel terkait (multi), masa berlaku, status, guru pengampu, peserta max 20 (siswaIds + siswaList denormalisasi).
- **Akses:** admin LMS (role admin / arif.nitoe@gmail.com) atur meta + pengampu + peserta; guru pengampu kelola konten (Tahap 2); siswa hanya lihat lomba yang diikutinya.
- **UI staf:** menu Lomba di sidebar; daftar kartu; form buat/ubah (dropdown staf aktif, multi mapel, tambah peserta via kelas→nama).
- **UI siswa:** menu Lomba muncul hanya jika terdaftar (≥1 lomba); dashboard daftar lomba (materi/kuis/riwayat → Tahap 3).
- **Rules:** `match /lms_lomba` di firestore.rules (versi lengkap). Deploy rules dari repo Penilaian.
- File: `src/types/lomba.ts`, `src/lib/lomba.ts`, `src/lib/lombaAkses.ts`, `src/pages/lomba/*`, `src/pages/siswa/SiswaLomba.tsx`, `SiswaLayout.tsx`, `SiswaIcon.tsx`, `Layout.tsx`, `App.tsx`, `firestore.rules`.
- ANTIREGRESI §Lomba.1–§Lomba.4.

## 2026-11-15 — Export kuis: judul dokumen mengikuti jenis penilaian + semester otomatis

- **Judul otomatis** dari `jenisPenilaian` kuis: Latihan → **ASESMEN TERTULIS LATIHAN** (sebelumnya «LEMBAR SOAL»); SLM → ASESMEN SUMATIF LINGKUP MATERI; STS → ASESMEN SUMATIF TENGAH SEMESTER GANJIL/GENAP; SAS → ASESMEN SUMATIF AKHIR SEMESTER GANJIL/GENAP. Jenis kosong dianggap latihan.
- **Semester otomatis:** sebelumnya selalu GANJIL karena pemanggil tidak mengirim `opsi.semester`. Kini diturunkan dari `waktuMulai` kuis (bila terbaca) atau tanggal hari ini: Juli–Desember = ganjil, Januari–Juni = genap. `opsi.semester` dan `opsi.judulDokumen` tetap bisa menimpa.
- Berlaku untuk PDF dan Word. Diuji untuk semua jenis dan kedua semester.
- File: `src/lib/exportKuisCetak.ts`, `CHANGELOG.md`, `ANTIREGRESI.md` (§127.33).

## 2026-11-15 — Export PDF v4: paginasi sendiri (kop+soal satu halaman, anti-potong, footer)

- **Penyebab (direproduksi di Chromium):** CSS v3 mengandalkan pemecah halaman browser (`break-inside: avoid`, `column-count`). Hasilnya: halaman 1 hanya berisi kop/identitas (soal mulai di hal. 2), opsi jawaban terpisah dari soalnya, dan baris meta tercecer sendirian di halaman terakhir.
- **Perbaikan:** jalur PDF kini **menghitung sendiri** pembagian halaman — tinggi tiap soal diukur, lalu ditempatkan pada halaman A4 berukuran tetap. Satu soal (nomor, teks, gambar, stimulus, opsi) = satu blok utuh yang tidak pernah terpotong; bila tak muat, pindah ke kolom/halaman berikutnya.
- **Halaman 1:** kop + identitas + judul bagian + soal pertama dalam halaman yang sama selama muat. Judul bagian selalu bersama soal sesudahnya.
- **Footer:** garis tipis di atas, **nomor halaman di kanan bawah**; keterangan kuis (judul · jumlah soal · poin · menit) di kiri footer setiap halaman (tidak lagi tercecer di akhir).
- **PDF 2 kolom:** hanya soal **uraian** 1 kolom selebar halaman; PG, PGK, B/S, jodoh, isian = 2 kolom (garis pemisah kolom). Kolom di halaman terakhir diseimbangkan agar uraian muat lebih rapat. Font tetap ≥ 11pt.
- Garis jawaban isian digambar dengan border (tidak lagi deretan garis-bawah yang melebihi lebar kolom). Tabel Benar/Salah di 2 kolom dipadatkan.
- Jendela cetak dibuka **segera** saat klik (sebelumnya setelah proses async → rawan diblokir popup-blocker); judul jendela = nama berkas sehingga nama default «Save as PDF» informatif.
- Word (.doc) tidak berubah tampilannya. Tombol & tanda tangan fungsi tidak berubah (`cetakKuisPdf`, `unduhKuisCetak`, `htmlKuisCetak`).
- File: `src/lib/exportKuisCetak.ts`, `CHANGELOG.md`, `ANTIREGRESI.md`.
- ANTIREGRESI §127.26–§127.32.

## 2026-11-15 — Rules paket soal: naikkan batas soal 100 → 300 (permission >100 soal)

- **Regresi berulang:** menyimpan/import paket dengan **lebih dari 100 soal** gagal `Missing or insufficient permissions`.
- **Akar:** klien `BATAS_SOAL_PER_PAKET = 300`, tetapi `firestore.rules` `lms_paket_soal` create/update masih `soal.size() <= 100`.
- **Perbaikan:** rules dinaikkan ke `soal.size() <= 300` (create + update), selaras konstanta klien.
- **ANTIREGRESI §0 (PRIORITAS):** checklist wajib sinkron `BATAS_*` klien ↔ `size() <= N` rules; deploy rules dari SDM01Penilaian; uji dengan >100 soal.
- File: `firestore.rules` (full). Deploy: salin ke SDM01Penilaian → `npm run deploy:rules`.

## 2026-11-15 — Query kelasList wajib sertakan mapel (permission list)

- **Masih permission denied** meski helper `lmsLihatViaKelasList` sudah di rules: query klien hanya `where('kelasList','array-contains', kelas)` **tanpa** `mapel`. Evaluasi list Firestore konservatif — tanpa constraint mapel, dokumen hipotetis dengan mapel lain membuat rule gagal → seluruh query ditolak.
- **Perbaikan klien:** `daftarTugas`, `daftarKuis`, `daftarMateri` sekarang `where('mapel','==', mapel) + where('kelasList','array-contains', kelas)`. Filter mapel di klien tidak lagi diperlukan.
- Butuh **composite index** (mapel ASC + kelasList CONTAINS) untuk `lms_tugas`, `lms_kuis`, `lms_materi`. Disediakan di `firestore.indexes.json`; deploy index dari SDM01Penilaian / Firebase Console bila belum ada.
- Rules `lmsLihatViaKelasList` tetap diperlukan (dari perbaikan sebelumnya). Pastikan rules **sudah di-deploy** ke project Firebase (`npm run deploy:rules` dari SDM01Penilaian).
- File: `src/lib/tugas.ts`, `src/lib/kuis.ts`, `src/lib/materi.ts`, `firestore.indexes.json`. ANTIREGRESI §128.2–§128.6.

## 2026-11-15 — Perbaiki permission query kelasList (daftarTugas / daftarKuis)

- **Gejala:** di console guru (contoh akun arif.azwar79@gmail.com / wali 5A) muncul berulang:
  `daftarTugas kelasList FirebaseError: Missing or insufficient permissions`
  dan `daftarKuis kelasList …` saat membuka Beranda / Daftar Kelas / Detail Kelas (termasuk tab Bank Soal).
- **Akar:** query sekunder `where('kelasList','array-contains', kelas)` ditolak rules. Baca `lms_kuis` / `lms_tugas` hanya lewat `lmsLihatMapelKelas(mapel, kelas_utama)`; dokumen hasil share punya `kelas` = rombel pemilik, sehingga evaluasi list konservatif menolak seluruh query.
- **Perbaikan rules:** helper `lmsLihatViaKelasList(mapel, list)` — guru boleh baca jika punya akses lihat ke *salah satu* kelas dalam `kelasList` untuk mapel itu. Cabang ini ditambahkan ke `allow read` `lms_kuis` dan `lms_tugas`. Query array-contains kelas yang diampu kini lolos; fitur berbagi ke paralel berfungsi penuh bagi penerima.
- File: `firestore.rules` (full). Deploy rules dari SDM01Penilaian setelah salin. ANTIREGRESI §128.

## 2026-11-15 — Export PDF v3: alur halaman, uraian penuh, nomor halaman

- **Halaman 1 tidak kosong:** margin identitas/garis diperketat; tinggi ilustrasi dibatasi (≤130pt) agar soal mulai di halaman yang sama dengan kop.
- **Anti-potong:** `break-inside: avoid` pada soal, opsi, tabel BS/jodoh, ruang uraian, dan gambar.
- **Uraian selalu 1 kolom penuh** (`.isi-soal--penuh`) meski mode PDF 2 kolom — 8 baris garis jawaban.
- **Nomor halaman** di bottom margin (`@page @bottom-center { content: counter(page) }`); margin bawah diperbesar agar tidak menempel soal.
- File: `src/lib/exportKuisCetak.ts`.
- ANTIREGRESI §127.23–§127.25.

## 2026-11-15 — Export PDF: anti-potong, gambar kiri, 2 kolom

- **Soal/ilustrasi tidak terbelah halaman:** `break-inside: avoid` + `page-break-inside: avoid` pada tiap blok soal dan gambar (jalur PDF/print).
- **Gambar rata kiri** sejajar narasi/opsi (`margin-left: 0`, bukan `auto` tengah).
- **PDF 2 kolom** (hemat kertas): `duaKolom: true` — `column-count: 2`, margin halaman ±1 cm, font **11pt** (tidak lebih kecil). Judul bagian (`p.bagian`) `column-span: all`.
- Tombol di kepala: **PDF** (1 kolom) · **PDF 2 kolom** · Word · Word + kunci.
- File: `src/lib/exportKuisCetak.ts`, `src/components/KuisPanel.tsx`.
- ANTIREGRESI §127.20–§127.22.

## 2026-11-15 — Export cetak: JPEG, logo, PDF, anti-potong

- **Gambar X di Word:** LMS menyimpan WebP; filter HTML Word sering gagal menampilkannya. Semua ilustrasi dikonversi ke **JPEG** (`keJpegDataUrl`) sebelum disematkan.
- **Logo kop:** JPEG lebih tajam (SDM + Kota Depok), ukuran ~56px.
- **Tipografi kop:** judul 14pt, nama sekolah 13pt; jarak garis ganda → identitas diperbesar (`margin` 14pt).
- **Soal terpotong:** `page-break-inside: auto` (bukan avoid paksa) agar Word tidak memotong narasi/opsi panjang.
- **PDF (disarankan):** tombol **PDF** membuka dialog print browser → «Save as PDF». Layout & gambar lebih stabil daripada .doc.
- Tombol Word tetap ada sebagai cadangan; «Word + kunci» untuk guru.
- File: `src/lib/exportKuisCetak.ts`, `src/components/KuisPanel.tsx`.
- ANTIREGRESI §127.17–§127.19.

## 2026-11-15 — Export Word: identitas 1 baris, spasi, ilustrasi soal

- **Identitas siswa:** default **satu baris Nama + No. Absen** (bukan tabel 10 baris kosong). Tabel paraf multi-siswa hanya jika `barisParaf > 0`.
- **Spasi antar soal:** margin bawah `.soal-wrap` dinaikkan ke **22pt** + padding body agar tidak berdempet.
- **Ilustrasi ikut unduh:** `unduhKuisCetak` / `htmlKuisCetak` async — memuat `gambarId` (soal, opsi PG, jodoh kiri) dari `lms_gambar` dan menyematkan data-URL di dokumen Word.
- File: `src/lib/exportKuisCetak.ts`, `src/components/KuisPanel.tsx`.
- ANTIREGRESI §127.14–§127.16.

## 2026-11-15 — Export kuis: logo, spasi, pratinjau, unduh tunggal

- **Logo kop:** logo sekolah (SDM) + logo Kota Depok (bukan bintang placeholder); disematkan data-URI PNG di `exportKuisCetak.ts`.
- **Tipografi opsi:** huruf A–D tidak lagi tebal (`font-weight: normal` pada `.opsi-huruf`); hanya nomor soal yang tebal.
- **Spasi antar soal:** margin bawah `.soal-wrap` 9pt → **16pt** agar tidak berdempet saat dicetak.
- **Menu unduh tunggal:** tombol «Unduh soal» / «Unduh + kunci» **hanya** di kepala detail kuis (`KuisKepala`); dihapus dari bilah sticky tab Atur kuis (sebelumnya ganda dengan kepala).
- **Pratinjau soal:** tombol «Pratinjau» di kepala detail — membuka modal `PratinjauSoal` (SoalTampil + GambarSoal) sehingga ilustrasi terlihat sebelum unduh Word.
- File: `src/lib/exportKuisCetak.ts`, `src/components/KuisDetail.tsx`, `src/components/KuisPanel.tsx`.
- ANTIREGRESI §127.10–§127.13.

## 2026-11-15 — Tombol unduh soal di kepala detail kuis

- **Masalah:** tombol «Unduh soal» / «Unduh + kunci» hanya di bilah dalam tab Atur kuis, mudah terlewat.
- **Perbaikan:** tombol yang sama di **kepala detail kuis** (`KuisKepala`) — terlihat di semua tab (Atur / Offline / Hasil).
- Slot `aksi` opsional di `KuisKepala`; gaya `.kn-aksi-unduh`.
- File: `src/components/KuisNav.tsx`, `src/components/KuisPanel.tsx`, `src/styles/kuis-nav.css`.
  (Generator: `src/lib/exportKuisCetak.ts` — sertakan versi layout terbaru bila belum.)

## 2026-11-15 — Optimasi format cetak Word (export kuis)

- Layout lebih mendekati template sumatif sekolah:
  - Kop 3 kolom (logo placeholder | judul | logo), garis ganda
  - Judul formal tanpa mapel (mapel di baris identitas); semester GANJIL/GENAP
  - Soal: kolom nomor + isi (tabel stabil di Word)
  - Opsi PG sebagai tabel huruf | teks (bukan list)
  - Tabel paraf ber-tinggi tetap untuk tulis tangan; nomor baris 1…n
  - Uraian: 6 baris garis; BS dengan checkbox ☐
  - `@page A4` margin 1,5 cm; `page-break-inside: avoid` per soal
  - Kunci jawaban di halaman baru (`page-break-before`)
- File: `src/lib/exportKuisCetak.ts` saja (tombol KuisDetail tidak berubah).

## 2026-11-15 — Export kuis ke Word siap cetak (template sumatif)

- Tombol **Unduh soal** dan **Unduh + kunci** di panel Atur kuis (`KuisDetail`).
- File `.doc` (HTML Word-compatible, tanpa library baru) mengikuti template sumatif sekolah:
  - Header SD Muhammadiyah 01 Kukusan + judul dari jenis penilaian (STS/SAS/SLM/Latihan)
  - Identitas: mapel, hari/tanggal (kosong), kelas, daftar TP
  - Tabel paraf (No / Nama / Nilai / Paraf Guru / Paraf Orang Tua)
  - Soal dikelompokkan: I objektif (PG/PGK/BS/jodoh) → II isian → III uraian
  - Versi kunci: tabel kunci di bagian akhir
- Belum embed gambar soal (teks saja; gambar tetap di LMS). Versi berikutnya bisa menambah logo & gambar.
- File: `src/lib/exportKuisCetak.ts` (baru), `src/components/KuisDetail.tsx`.
- ANTIREGRESI §127.

## 2026-11-15 — Reset attempt kuis mapel (online)

- **Masalah:** reset attempt + draf hanya tersedia di hasil kuis TKA; kuis mata pelajaran online tidak punya cara mereset kiriman siswa agar bisa mengerjakan ulang.
- **Perbaikan:**
  - Tombol **Reset attempt + draf / Reset draf saja / Reset attempt saja** di detail hasil, dan **Reset+** di daftar nilai, berlaku untuk **semua kuis** (mapel & TKA).
  - Client: `resetJawabanKuis` (menggantikan nama khusus TKA; alias `resetJawabanKuisTka` tetap ada).
  - Siswa mapel (`SiswaKuis`): cek marker `lms_tka_progress_reset/{kuisId}_{siswaId}` saat muat daftar dan saat «Lanjutkan» — draf lokal dihapus jika guru sudah mereset.
- CF `resetJawabanKuisLms` tidak berubah (sudah generik). Marker koleksi tetap nama historis TKA agar kompatibel.
- File: `src/lib/jawabanKuis.ts`, `src/components/HasilKuisPanel.tsx`, `src/pages/siswa/SiswaKuis.tsx`.
- ANTIREGRESI §126.

## 2026-11-14 — Optimasi gambar materi untuk smartphone

- **Prioritas:** ukuran file kecil + tetap terbaca di HP (akses utama siswa).
- Kompres unggah `siapkanGambarHalaman`: sisi maks. **1200px**, WebP q≈0.72 (fallback JPEG), turunkan kualitas bertahap hingga mendekati **~180 KB**.
- Batas unggah sumber blok halaman: **4 MB** (setelah kompres biasanya 100–250 KB).
- Tampilan mobile-first: gambar `width: 100%` di HP (label diagram terbaca), `max-height` dibatasi agar tidak mendominasi gulir; di PC `width: auto`.
- File lama di Storage tidak berubah otomatis — unggah ulang di editor bila ingin file lebih ringan.
- File: `src/lib/materi.ts`, `src/types/materi.ts`, `src/styles/materi-halaman.css`.

## 2026-11-14 — Gambar materi: ukuran tampilan proporsional + kompres unggah

- **Tampilan:** gambar tidak lagi dipaksa `width: 100%` tanpa batas (terlalu besar/berat di PC). Kini `width: auto`, `max-width: 100%`, `max-height: min(70vh, 26–36rem)` + `object-fit: contain`, rata tengah. Di HP tetap memenuhi lebar kartu bila gambar cukup lebar.
- **Unggah:** `siapkanGambarHalaman` — resize sisi terpanjang maks. 1600px + JPEG ~82% bila file besar; dipakai di `unggahGambarHalaman` dan unggah hasil AI.
- Gambar yang sudah tersimpan tidak diubah; hanya unggahan baru yang dikompres. Ganti file di editor bila ingin file lama lebih ringan.
- File: `src/styles/materi-halaman.css`, `src/lib/materi.ts`. ANTIREGRESI §125.4 diperbarui.

## 2026-11-13 — Tabel materi lebar: scroll horizontal di HP

- Tabel multi-kolom di viewer materi tidak lagi terpotong di smartphone.
- `.mh-blok--teks` memakai `overflow-x: auto` + touch momentum; tabel `width: max-content; min-width: 100%`.
- Sel: `word-break` / `min-width` agar kolom tetap terbaca saat digeser.
- File: `src/styles/materi-halaman.css`. ANTIREGRESI §125.5.

## 2026-11-13 — Viewer materi: full-width responsif (tanpa gutter kiri/kanan)

- `.mh-viewer` flex full parent (bukan grid 72rem). Teks/kartu tanpa max-width ch.
- File: `src/styles/materi-halaman.css`.

## 2026-11-13 — Gambar materi full-width (editor & viewer)

- Penyebab ruang kosong kiri/kanan pada gambar: `max-height: 70vh` + `object-fit: contain` + `margin-inline: auto` mengecilkan lebar tampilan saat aspek gambar tidak mengisi viewport.
- Viewer `.mh-blok--gambar img`: `width: 100%`, `height: auto`, **tanpa** `max-height`, margin 0 — mengisi lebar kartu.
- Editor `.mh-img-preview`: sama, full lebar blok (bukan max 16rem tinggi yang membuat pratinjau kecil di tengah).
- Gabungan dengan perbaikan viewer full-width (tanpa grid 72rem / 65ch).
- File: `src/styles/materi-halaman.css`.

## 2026-11-13 — Viewer materi: layout CSS Grid (gutter fluid)

- Shell `.mh-viewer` memakai **CSS Grid 3 kolom**: `1fr | min(100%, 72rem) | 1fr` — konten mengisi kolom tengah, gutter kiri/kanan tumbuh merata di PC (tidak «mengambang» sempit di tengah).
- Header grid (judul | pill), kartu halaman grid stack blok, nav grid 3 kolom (Sebelumnya | titik | Berikutnya).
- Lebar baris teks diukur dengan `ch` (65–70ch), bukan rem kaku; gambar tetap full-width kartu.
- File: `src/styles/materi-halaman.css`.

## 2026-11-13 — Viewer materi: lebar responsif PC & HP

- `.mh-viewer` tidak lagi terkunci `max-width: 42rem` (menyisakan ruang kosong besar di kiri/kanan PC).
- Lebar mengikuti viewport: penuh di HP → 48rem (≥768px) → 56rem (≥1024px) → 64rem (≥1280px) → 72rem (≥1536px).
- Padding kartu halaman dan ukuran judul/teks sedikit diperbesar di layar lebar; gambar tetap full-width kartu; navigasi halaman mengikuti lebar viewer.
- File: `src/styles/materi-halaman.css`.

## 2026-11-13 — UI katalog Kuis & Tugas siswa (polish)

- Katalog Kuis dan Tugas siswa memakai bahasa visual yang sama: header + ringkasan angka, chip filter, section per mapel dengan bilah aksen warna mapel, grid kartu responsif, badge status, empty state berikon.
- Kelas CSS baru `sw-kat-*` di `src/styles/siswa.css` (selaras materi/kartu beranda; target sentuh nyaman).
- Kartu kuis: ikon, meta jenis/soal/durasi, catatan skor/draf, CTA jelas.
- Kartu tugas: aksen mapel, tenggat relatif, badge status, hero detail + panel nilai/instruksi.
- File: `src/pages/siswa/SiswaKuis.tsx`, `src/pages/siswa/SiswaTugas.tsx`, `src/styles/siswa.css`.

## 2026-11-13 — Siswa: kelompok mapel + filter status di Kuis & Tugas

- **Kuis siswa** (`SiswaKuis`): daftar dikelompokkan per mata pelajaran; chip filter status (Semua / Belum dikerjakan / Sudah dikerjakan / Draf tersimpan) dan filter mapel bila lebih dari satu. Kartu & alur kerjakan/ulang tidak berubah.
- **Tugas siswa** (`SiswaTugas`): halaman baru menggantikan placeholder. Daftar tugas aktif kelas siswa, kelompok per mapel, filter status (Belum dinilai / Sudah dinilai / Lewat tenggat) + filter mapel. Detail tugas menampilkan deskripsi, instruksi (HTML dibersihkan), tenggat relatif, dan nilai/predikat/komentar dari `lms_nilai_tugas` jika sudah ada.
- Pengumpulan file siswa (unggah) **belum** diaktifkan — menunggu koleksi `lms_pengumpulan`; UI memberi catatan sementara.
- Helper `src/lib/tugasSiswa.ts`; label ringkas `NAMA_JENIS_PENILAIAN_TUGAS_SISWA`.
- Beranda siswa: badge «Segera» dihapus dari menu Tugas dan Kuis.
- File: `src/pages/siswa/SiswaKuis.tsx`, `src/pages/siswa/SiswaTugas.tsx`, `src/lib/tugasSiswa.ts`, `src/types/tugas.ts`, `src/App.tsx`, `src/pages/siswa/SiswaBeranda.tsx`.

## 2026-11-13 — Perbaikan: sebaran BI tidak lagi ganda; kompetensi dasar & materi dua daftar terpisah

- **Bug:** pada tab Bahasa Indonesia, tabel «berpasangan» (L1 ↔ Pemahaman Tekstual, dst.) tampil bersama tabel kompleksitas biasa, sehingga L1–L3 muncul **dua kali**.
- Kini **kompetensi dasar** (L1 Pemahaman, L2 Aplikasi, L3 Penalaran) dan **kompetensi materi** (BI: Pemahaman Tekstual, Pemahaman Inferensial, Evaluasi dan Apresiasi) selalu **dua tabel terpisah**, untuk semua mapel (MTK: L1–L2 + Bilangan / Geometri dan Pengukuran / Data; IPA: L1–L3 + Pengetahuan IPA / Keterampilan Proses Sains). Berlaku juga di tabel per siswa (header «Kompetensi dasar» / «Kompetensi materi»), laporan hasil kuis, dan ekspor Excel/CSV.
- Fungsi `pasangkanDimensiSama` dihapus; `kolomDariAgregat` tidak lagi menggabung kolom.
- File: `src/lib/sebaranTka.ts`, `src/pages/tka/TkaRekapMapel.tsx`.

## 2026-11-13 — Laporan hasil kuis TKA: kolom kompetensi per siswa (L1–L3, materi)

- Tab **Hasil** kuis TKA («Laporan hasil TKA») sebelumnya hanya punya kolom domain IPA (Pengetahuan / Keterampilan Proses), sehingga **Bahasa Indonesia dan Matematika tidak menampilkan L1–L3 maupun kompetensi materi**, dan Nilai Akhir-nya kosong (tidak ada domain).
- Kini kolom kompetensi per siswa dihitung dari jawaban kuis (berbobot poin, `hitungSebaranDariJawaban`): BI = L1–L3 sekaligus tipe materi (satu kolom berpasangan); MTK = L1, L2 + Bilangan / Geometri dan Pengukuran / Data; IPA = domain seperti semula + kolom L1–L3. Sel berwarna (merah < 50, kuning < 70, hijau ≥ 70), poin tampil saat kursor diarahkan.
- Nilai Akhir BI/MTK = skor ÷ poin maksimum × 100 (selaras Rekap TKA); IPA tetap rata-rata domain (rancangan semula).
- File: `src/components/HasilKuisPanel.tsx`.

## 2026-11-13 — Paket soal TKA hasil migrasi terdeteksi di penyusunan kuis

- Paket soal TKA **Bahasa Indonesia dan Matematika** (migrasi tka2026) berstatus Siap terlihat di Bank Soal tetapi tidak muncul di wizard «Susun kuis»: sisa migrasi dapat berkelas **6A/6B**, sedangkan wizard & pembuatan kuis hanya mencari kelas «6». IPA tidak terdampak (dibuat di LMS).
- `daftarPaket` sadar-TKA: mencari kelas 6, 6A, 6B lalu menggabungkan per id (satu query ditolak tidak membatalkan yang lain); dipakai Bank Soal, wizard, pembuatan kuis, «Tambah paket». Bila tetap tidak ada paket Siap, wizard menampilkan diagnosis (jumlah per kelas, Draf, Siap tanpa soal).
- File: `src/lib/soal.ts`, `src/components/KuisPanel.tsx`, `src/components/BankSoalPanel.tsx`.

## 2026-11-13 — Kuis TKA per mapel terpisah & daftar kuis aktif di dashboard TKA

- Tab Kuis ruang TKA tidak lagi menampilkan kuis TKA mapel lain (tiga mapel berbagi kelas bank «6»; daftar menggabung semua kuis buatan guru tanpa memeriksa mapel).
- Dashboard `/tka`: bagian **Kuis TKA aktif** per mapel (judul, tahap, jumlah soal, durasi, jendela waktu, status, tautan Buka). Aktif = `aktif` menyala dan `waktuSelesai` belum lewat.
- File: `src/components/KuisPanel.tsx`, `src/pages/tka/TkaKuisAktif.tsx`, `src/pages/tka/TkaBeranda.tsx`, `src/styles/tka.css`.

## 2026-11-13 — Ekspor hasil TKA (Excel/CSV) & konfirmasi hapus kuis

- `/tka/rekap`: **Unduh Excel** (.xlsx: Rekap Nilai Akhir, tiap mapel dengan capaian % per kompetensi, Keterangan) dan **Unduh CSV** (tab yang dibuka; `;`, UTF-8 BOM, desimal koma). Mengikuti filter tahap & kelas. Tanpa dependensi baru (`src/lib/exportTabel.ts`).
- **Konfirmasi hapus kuis** (TKA & mapel): dialog `KonfirmasiHapusDialog`, harus mengetik HAPUS; menampilkan jumlah soal, jumlah hasil siswa yang hilang, dampak ke Rekap TKA, dan saran «Nonaktifkan».
- File: `src/lib/exportTabel.ts`, `src/lib/exportRekapTka.ts`, `src/lib/sebaranTka.ts`, `src/pages/tka/TkaRekap.tsx`, `src/components/KonfirmasiHapusDialog.tsx`, `src/styles/konfirmasi-hapus.css`, `src/components/KuisPanel.tsx`.

## 2026-11-13 — Fix regresi UI TKA: daftar kuis aktif + filter rekap

- **Dashboard TKA (`TkaKuisAktif`)**: class `.tka-ka*` dipakai sejak commit «Pisahkan kuis TKA per mapel» tetapi **CSS tidak pernah ditulis** → chip mapel, judul, status, dan tautan «Buka» saling menempel (`IPAIPA1 kuis`, `BerlangsungBuka →`). Style lengkap ditambahkan (grup per mapel, chip aksen, status Berlangsung/Terjadwal, tombol Buka).
- **Rekap TKA**: `.tka-rekap-controls` masih 2 kolom (filter | panel portal) padahal panel portal sudah pindah ke tab «Publikasi ke portal» → kolom kanan kosong lebar. Sekarang full-width bila hanya ada satu anak; 2 kolom hanya jika ada anak kedua (legacy).
- Tidak mengubah logika data, query, rules, atau komponen TSX (hanya `src/styles/tka.css`).
- File: `src/styles/tka.css`, `CHANGELOG.md`, `ANTIREGRESI.md`.

## 2026-11-13 — Navigasi di dalam Kuis & tab TKA Rekap: UI v2

- **Kepala detail kuis** (`KuisKepala`): tombol «← Daftar kuis», judul kuis, chip jenis penilaian / tahap try out TKA, Online/Offline, Aktif/Nonaktif, jumlah soal, dan menu segmen berikon **Atur kuis · Input offline · Hasil siswa** (navigasi panah/Home/End, ARIA tablist + tabpanel). Menggantikan tautan polos + tombol ungu generik.
- **Laporan hasil:** sub-menu **Daftar nilai / Analisis per soal** memakai segmen berikon; «Hanya percobaan terbaru» menjadi toggle chip; **Filter kelas TKA** menjadi chip dalam bar tersendiri; «Muat ulang» berikon; tombol «Kembali ke daftar nilai» seragam.
- **Aksen mapel:** `KelasDetail` kini menurunkan warna mapel (`--rg-a`) ke seluruh panel, sehingga menu di dalam Kuis ikut beraksen sama dengan tab ruang kelas (ungu sekolah bila tak ada).
- **Tab TKA Rekap** (`.tka-tab`) diseragamkan menjadi kontrol segmen yang sama.
- Responsif: judul kuis membungkus 2 baris di ponsel, menu segmen membagi lebar rata tanpa scroll horizontal.
- Tidak mengubah logika kuis, penilaian, publikasi hasil, sinkronisasi, maupun data.
- File: `components/KuisNav.tsx` (baru), `components/KuisPanel.tsx`, `components/HasilKuisPanel.tsx`, `components/ikonRuang.tsx`, `pages/KelasDetail.tsx`, `styles/kuis-nav.css` (baru), `styles/tka.css`.

## 2026-11-12 — Input sebaran kompetensi manual (try out di luar LMS)

- Tab mapel punya tombol **+ Input sebaran kompetensi manual**: poin maksimum per kompetensi sekali, poin tiap siswa; nilai akhir dihitung otomatis (boleh ditimpa); tersimpan sebagai nilai manual + `sebaran[mapel]`. MTK = L1, L2 + 3 materi; BI = L1–L3; IPA = L1–L3 + 2 domain. Validasi lengkap; satu baris salah → tidak ada yang disimpan. Siswa bernilai otomatis LMS tidak ditampilkan.
- File: `src/pages/tka/TkaSebaranManual.tsx`, `src/pages/tka/TkaRekapMapel.tsx`, `src/lib/sebaranTka.ts`, `src/lib/rekapTka.ts`.

## 2026-11-12 — Beranda, Ruang Kelas (daftar & detail), kartu ruang: UI v2

- **Beranda:** hero baru (salam sesuai waktu, tanggal, peran, 4 angka: ruang, kelas, tugas aktif, kuis aktif yang bisa diklik). Tata letak dua kolom di layar lebar: ruang kelas di kiri; **Agenda penugasan** (5 tugas/kuis aktif, urut tenggat terdekat, tenggat relatif berwarna) dan **Pintasan** (Tugas baru, Ruang kelas, Rekap nilai, TKA bila berhak) di kanan; di ponsel agenda tampil lebih dulu.
- **Beranda:** tile «Tugas — Segera» yang sudah usang (Tugas sudah aktif) dan seksi «Modul pembelajaran» diganti Pintasan yang benar-benar berfungsi.
- **Kartu ruang:** cover lebih ringkas, badge Kelas/Wali, hitungan **tugas aktif** dan **kuis aktif** per ruang (juga di Beranda), skeleton/placeholder saat belum dimuat.
- **Daftar Kelas:** kepala halaman, panel «Penugasan aktif» (urut tenggat, chip tenggat berwarna, skeleton, «Tampilkan N lainnya», muat ulang), saringan kelas, **kartu dikelompokkan per kelas** bila guru memegang lebih dari satu kelas, empty state + «Reset saringan».
- **Detail Kelas:** pil «N tugas aktif» dan «N kuis aktif» di hero (pil kuis membuka tab Kuis), tab berikon dengan aksen warna mapel + navigasi keyboard (panah/Home/End) dan atribut ARIA lengkap, empty state Pengumuman. Hero & tab ruang TKA tidak berubah (tetap Kuis + Bank Soal).
- **Refaktor:** logika ringkasan tugas/kuis aktif dipindah dari `KelasList` ke `lib/ringkasanRuang.ts` (`useRingkasanRuang`) dan dipakai Beranda, Daftar Kelas, Detail Kelas — satu sumber kebenaran.
- Tidak mengubah route, data model, `firestore.rules`, maupun panel Materi/Kuis/Bank Soal.
- Catatan: Beranda kini ikut membaca tugas & kuis aktif (sama seperti Daftar Kelas), sehingga ada tambahan baca Firestore per kunjungan Beranda.
- File: `pages/Beranda.tsx`, `pages/KelasList.tsx`, `pages/KelasDetail.tsx`, `components/RuangCard.tsx`, `components/ikonRuang.tsx` (baru), `lib/ringkasanRuang.ts` (baru), `styles/ruang.css` (baru).

## 2026-11-12 — Halaman Tugas (katalog guru): UI v2

- **Kepala & ringkasan:** judul + tombol «Tugas baru» yang jelas, strip ringkasan (total, aktif, segera berakhir, pengumpulan).
- **Cari & saring:** pencarian dengan ikon, urutkan (terbaru / tenggat terdekat / pengumpulan terbanyak / judul A–Z), segmen Status & Jenis dengan **hitungan**, segmen Kelas (muncul bila ada lebih dari satu kelas), tombol «Reset saringan».
- **Kartu tugas:** aksen warna per mapel (selaras ruang kelas), monogram mapel, badge Aktif/Draf (draf = garis aksen putus-putus), judul + deskripsi, chip Proyek / penilaian (Latihan, SLM, STS, SAS) / TP, panel **tenggat relatif** (Hari ini, Besok, 3 hari lagi, Lewat 2 hari) berwarna sesuai urgensi + angka pengumpulan besar. Tugas draf tidak diberi warna alarm.
- **Status memuat/kosong/galat:** skeleton kartu, empty state dengan ikon & tombol aksi, banner galat `role="alert"`; hanya kartu yang sedang diproses yang diredam saat aktif/nonaktif/hapus.
- Lebar penuh konten shell (tanpa `max-width`), responsif hingga layar ponsel.
- Tidak mengubah logika data (`lib/tugas.ts`), route, data model, maupun `firestore.rules`.
- File: `src/pages/TugasDashboard.tsx`, `src/lib/tugasUi.ts` (baru), `src/styles/tugas.css` (baru).

## 2026-11-12 — Rekap TKA: kompetensi IPA & tata letak per siswa

- **IPA:** kompetensi dasar = tingkat kompleksitas **L1–L3**; kompetensi materi = **dua kelompok** (Pengetahuan IPA, Keterampilan Proses Sains) dari `domainTka`. 11 tipe materi IPA tidak lagi dipakai untuk sebaran (rekap maupun snapshot portal). Matematika & Bahasa Indonesia tidak berubah (L1–L3 + tipe materi).
- **Tata letak tab mapel:** tabel nilai + capaian kompetensi **per siswa** kini paling atas (header dua tingkat: «Kompetensi dasar» / «Kompetensi materi»), lalu sebaran kompetensi per kelas.
- **Dihapus dari tampilan:** ringkasan statistik kelas dan **sebaran rentang nilai** (histogram) di tab mapel — terlalu memakan ruang dan belum diperlukan. Rata-rata per mapel tetap ada di tab «Rekap nilai akhir». Helper `distribusiNilai` tetap ada di `sebaranTka.ts` bila nanti dibutuhkan.
- Peringatan label soal untuk IPA hanya memeriksa `domainTka`.
- File: `src/lib/sebaranTka.ts`, `src/lib/rekapTka.ts`, `src/pages/tka/TkaRekapMapel.tsx`, `src/styles/tka.css`.

## 2026-11-12 — Rekap TKA per mapel: nilai + sebaran kompetensi, data Try Out I

- Halaman `/tka/rekap` (admin TKA & wali 6) kini berupa **tab**: Matematika → Bahasa Indonesia → IPA → **Rekap nilai akhir** (hanya nilai akhir + rata-rata) → **Publikasi ke portal** (dengan tabel kesiapan: siswa bernilai & siswa bersebaran per mapel).
- Tiap tab mapel: ringkasan nilai (rata-rata, median, min/maks, tuntas ≥ 70) per 6A / 6B / gabungan, sebaran rentang nilai, sebaran **kompleksitas, tipe materi, domain (IPA)** per kelas dengan jumlah siswa rendah (< 50%) / sedang / tuntas, serta tabel per siswa (nilai + capaian per kompetensi + kompetensi terlemah). Pada Bahasa Indonesia, kompleksitas ≡ tipe materi sehingga ditampilkan dalam satu tabel.
- Helper baru `src/lib/sebaranTka.ts` (berbobot poin, penyebut = seluruh soal). Rekap menyimpan `SelNilaiTka.sebaran`; publikasi portal memakai sumber yang sama (tidak lagi mengambil jawaban per siswa).
- **Data Try Out I (MTK & BI, 52 siswa)** kini membawa sebaran poin per kompetensi dari rekap xlsx; tombol simpan di `/tka/import-rekap` menulis nilai + `sebaran` ke `lms_rekap_tka`. Tidak ada perubahan `firestore.rules`.
- Label kompleksitas TKA: L1 · Pemahaman, L2 · Aplikasi, L3 · Penalaran (konsisten di rekap & portal).
- File: `src/lib/sebaranTka.ts` (baru), `src/lib/rekapTka.ts`, `src/lib/importRekapTka.ts`, `src/lib/tkaPublikasi.ts`, `src/types/rekapTka.ts`, `src/data/tryoutTahap1.ts`, `src/pages/tka/TkaRekap.tsx`, `src/pages/tka/TkaRekapMapel.tsx` (baru), `src/pages/tka/TkaImportRekap.tsx`, `src/styles/tka.css`.

## 2026-11-12 — Kartu paket Bank Soal & wizard susun kuis (UI v2)

- **Kartu paket:** aksen warna per mapel (IPA rose, MTK teal, BI biru; mapel reguler biru-ungu), angka soal/poin besar, bar sebaran L1–L3, chip bentuk soal, status «Siap dipakai» / «Draf» dengan catatan langkah berikutnya, grid responsif.
- **Bank Soal TKA:** strip ringkasan (paket / siap / soal siap), chip materi berhitungan menggantikan dropdown, paket TKA tampil sebagai satu grid datar (mengisi seluruh lebar, tanpa sisa ruang kosong) diurutkan menurut materi, empty state dengan tombol aksi.
- **Wizard susun kuis:** stepper 4 langkah (Identitas → Paket → Susun → Tinjau), kartu paket yang bisa dipilih (cari, saring materi, pilih semua), kartu pilihan mode, jumlah soal dengan stepper + preset, chip bentuk/level dengan **jumlah soal tersedia**, peringatan bila target melebihi soal tersedia, ringkasan sticky + checklist (layar lebar), bar aksi selalu terlihat, pratinjau dikelompokkan per bentuk dengan statistik.
- **Daftar kuis:** kartu bergaya sama (tahap Try Out, status Aktif/Draf, mode susun).
- Tidak mengubah logika bisnis, data model, maupun rules.
- File: `src/components/BankSoalPanel.tsx`, `src/components/KuisPanel.tsx`, `src/lib/aksenTka.ts` (baru), `src/styles/tka-bank.css` (baru).

## 2026-11-12 — Tab Bank Soal & Kuis ruang TKA: intro kontekstual

- Strip intro di atas toolbar tab **Bank Soal** dan **Kuis** saat ruang mapel TKA (aksen IPA / MTK / BI).
- Copy IPA menekankan materi Fase B & C dan bentuk soal TKA (PG, PGK, B/S); kuis mengingatkan tahap Try Out untuk rekap.
- Empty state kuis TKA lebih jelas (Siap + tahap).
- File: `src/components/BankSoalPanel.tsx`, `src/components/KuisPanel.tsx`, `src/styles/tka.css`.

## 2026-11-12 — Ruang TKA per mapel: hero IPA (dan aksen tetap)

- Aksen cover TKA **tidak lagi hash nama**: IPA rose, Matematika teal, Bahasa Indonesia biru — selaras kartu dashboard.
- Inisial hero: `IPA` / `MTK` / `BI` (bukan huruf acak).
- Hero ruang TKA menampilkan **chip materi** (IPA hingga 8 materi + sisa); deskripsi spesifik Fase B & C / keterampilan proses untuk IPA.
- Badge «Bank bersama 6A & 6B»; back link ke dashboard TKA.
- File: `src/lib/uiAksen.ts`, `src/pages/KelasDetail.tsx`, `src/styles/tka.css`.

## 2026-11-12 — Rekap TKA: filter tahap/kelas tidak lagi kotak kosong

- Panel filter (Tahap Try Out / Kelas) tidak dipaksa setinggi panel portal ortu — hilangkan ruang putih besar di tengah kartu.
- Select lebih besar (`0.9375rem`, min-height 2.5rem, font-weight 600); label tetap ringkas di atas.
- Grid kontrol: `align-items: start` agar toolbar hanya setinggi isinya.
- File: `src/styles/tka.css`.

## 2026-11-12 — UI TKA: full-width + rekap lebih padat (perbaikan regresi)

- **Perbaikan regresi lebar:** hapus `max-width: 72rem` pada `.tka-dash` / `.tka-rekap` yang menyisakan ruang kosong di kanan (konten shell hingga 1600px). Sekarang `width: 100%`.
- Grid aksi: satu kartu saja mengisi full width (`:has(> :only-child)`).
- **Dashboard TKA:** hero, aksi Rekap/Import, kartu mapel — memakai lebar konten penuh.
- **Rekap:** meta (akses + hint) 2 kolom; toolbar filter + panel portal ortu berdampingan di layar lebar; **stat ringkas** dengan aksen warna mapel (BI/MTK/IPA); header kolom mapel berwarna; tabel sticky.
- Tidak mengubah logika bisnis, rules, atau data model.
- File: `src/styles/tka.css`, `src/pages/tka/TkaBeranda.tsx`, `src/pages/tka/TkaRekap.tsx`.

## 2026-11-12 — Snapshot sebaran capaian TKA ke portal

- Publikasi Try Out menyertakan **sebaran** per mapel (kompleksitas L1–L3, tipe materi, domain IPA) bila kuis sumber + jawaban ada di LMS.
- Tipe baru: `SebaranOrtuTka` / `SebaranMapelOrtu` di `src/types/tkaPublikasi.ts`.
- Label portal: `LABEL_MAPEL_ORTU` (Bahasa Indonesia, Matematika, IPA).
- Helper `hitungSebaranDariDetail` (pola sama HasilTka siswa).
- File: `src/types/tkaPublikasi.ts`, `src/lib/tkaPublikasi.ts`.

## 2026-11-12 — Publikasi Try Out TKA ke portal orang tua

- Snapshot hasil per **kelas × tahap** (`lms_tka_publikasi`, `lms_tka_hasil_ortu`) setelah wali/admin publish dari `/tka/rekap`.
- Ranking **10 besar gabungan 6A+6B** (`lms_tka_peringkat/{tahap}`).
- Rata-rata ranking: tahap **I** = BI+MTK; tahap **II–V** = BI+MTK+IPA (mapel wajib lengkap).
- Tombol Publikasikan / Perbarui / Tarik di rekap; catatan opsional untuk orang tua.
- Siapa boleh publish: admin LMS, admin TKA (email khusus), wali kelas rombel tersebut.
- File: `src/lib/tkaPublikasi.ts`, `src/types/tkaPublikasi.ts`, `src/pages/tka/TkaRekap.tsx`, `src/lib/tkaAkses.ts`, `firestore.rules`.

## 2026-11-12 — Rules rekap TKA: baca untuk admin TKA

- **Gejala:** admin TKA (`arif.azwar79@gmail.com`) dapat error «Missing or insufficient permissions» saat muat nilai manual 6A/6B.
- **Akar:** `allow list/get` `lms_rekap_tka` mensyaratkan `isGuru()` dulu; create/update sudah mengizinkan `tkaEmailKhusus()` langsung. Profil admin TKA bisa role non-guru / wali 5A → list ditolak.
- **Perbaikan:** `get`/`list`/`delete` mengizinkan `tkaEmailKhusus()` tanpa `isGuru()`; hapus `keys().hasAll` di list (bisa gagalkan query); email dibandingkan case-insensitive.
- **Wajib:** deploy rules utuh (`firebase deploy --only firestore:rules`), bukan hanya Hosting.
- File: `firestore.rules`, `ANTIREGRESI.md`.

## 2026-11-12 — Rekap TKA: nilai import tidak tampil (query index)

- **Gejala:** import rekap berhasil tulis `lms_rekap_tka`, tetapi halaman `/tka/rekap` tahap I tetap kosong (IPA memang belum diujikan — itu wajar).
- **Akar:** `muatRekapTkaManual` memakai query compound `tahap` + `kelas`. Tanpa composite index di Firebase, `getDocs` gagal; error ditelan → peta manual kosong.
- **Perbaikan:** query hanya `where('kelas'==…)` (indeks otomatis), filter `tahap` di klien; lookup id dokumen + cadangan by `siswaId`; nilai manual tanpa field `sumber` tetap ditampilkan; peringatan query gagal ditampilkan di UI.
- File: `src/lib/rekapTka.ts`, `src/pages/tka/TkaRekap.tsx`, `ANTIREGRESI.md`.

## 2026-11-12 — Tool import rekap TKA (admin LMS)

- Halaman `/tka/import-rekap` **hanya role admin LMS**: pratinjau cocokkan nama+kelas ke roster `siswa`, tulis nilai manual MTK+BI ke `lms_rekap_tka`.
- Data bawaan Try Out tahap I (52 siswa dari portal tka2026) + opsi tempel JSON kustom.
- Rules: `isAdmin()` boleh **create/update** `lms_rekap_tka` (bulk import); guru/wali tetap lewat `tkaBolehRombelRekap`.
- Pintasan di beranda TKA (hanya admin). File: `src/pages/tka/TkaImportRekap.tsx`, `src/lib/importRekapTka.ts`, `src/data/tryoutTahap1.ts`, `src/App.tsx`, `src/pages/tka/TkaBeranda.tsx`, `src/styles/tka.css`, `firestore.rules`.

## 2026-11-12 — Rekap TKA: input manual nilai yang jelas

- Tombol **+ Isi manual** / **Ubah** pada setiap sel mapel (bukan hanya klik angka tersembunyi).
- Petunjuk di atas tabel untuk try out di luar LMS; Enter = simpan, Esc = batal; **Hapus manual**.
- `simpanNilaiManualTka`: getDoc dokumen baru tidak menggagalkan create.
- Rules `lms_rekap_tka`: `get` izinkan `resource == null` (dokumen belum ada) agar input manual pertama berhasil.
- File: `src/pages/tka/TkaRekap.tsx`, `src/lib/rekapTka.ts`, `src/styles/tka.css`, `firestore.rules`.

## 2026-11-12 — Rules `lms_rekap_tka` (perbaiki permission denied)

- **Akar masalah:** kode rekap sudah di repo, tetapi `firestore.rules` di main belum memuat koleksi `lms_rekap_tka` → query manual rekap kena default deny («Missing or insufficient permissions»).
- Tambah `tkaBolehRombelRekap` + `match /lms_rekap_tka/{id}` (baca/tulis).
- Email khusus TKA (`arif.azwar79@gmail.com`) boleh 6A+6B; wali 6A hanya 6A, wali 6B hanya 6B.
- Klien: `muatRekapTkaManual` tidak menggagalkan seluruh halaman jika rules belum ter-deploy.
- **Wajib:** deploy rules ke Firebase (`firebase deploy --only firestore:rules`), bukan hanya Hosting.

## 2026-11-12 — Akses rekap TKA: admin email khusus + isolasi 6A/6B

- **Admin TKA** (`arif.azwar79@gmail.com`): pengecualian dipertegas — boleh menu/rekap TKA meski profil wali **5A** (tidak perlu wali 6).
- **Wali 6A** hanya rekap siswa **6A**; **wali 6B** hanya **6B** (UI `kelasRekapTkaBolehDilihat` + rules `tkaBolehRombelRekap`).
- Banner di halaman rekap menjelaskan cakupan akses.
- File: `src/lib/tkaAkses.ts`, `src/pages/tka/TkaRekap.tsx`, `src/styles/tka.css`, `firestore.rules`.

## 2026-11-12 — Rekap Nilai Try Out TKA

- Halaman `/tka/rekap` di dashboard TKA: nilai per **tahap I–V** × **BI / MTK / IPA** × siswa 6A/6B.
- **Akses:** wali kelas 6A dan/atau 6B (hanya rombelnya); akun uji email khusus TKA (keduanya). Helper `kelasHasilTkaBolehDilihat` + rules `tkaBolehRombelRekap`.
- Nilai **otomatis** dari `lms_jawaban` kuis dengan `tahapTryOutTka` sama (skor tertinggi, skala 100).
- Nilai **manual** di `lms_rekap_tka` (override) untuk try out di luar LMS; klik sel → edit.
- Kartu pintasan di beranda TKA. Field `tahapTryOutTka` pada tipe kuis (jika belum ada di branch).
- File: `src/pages/tka/TkaRekap.tsx`, `src/lib/rekapTka.ts`, `src/types/rekapTka.ts`, `src/pages/tka/TkaBeranda.tsx`, `src/App.tsx`, `src/styles/tka.css`, `src/types/kuis.ts`, `firestore.rules`, `docs/TKA.md`.

## 2026-11-11 — Label jenis kuis siswa: tanpa «tidak masuk nilai»

- Di katalog/card siswa (TKA & kuis biasa), jenis **Latihan** ditampilkan ringkas: «Latihan» saja.
- Alasan: frasa «(tidak masuk nilai)» bisa membuat siswa kurang serius mengerjakan.
- Label lengkap (dengan keterangan nilai) tetap di UI guru saat atur kuis.
- Tambah `NAMA_JENIS_PENILAIAN_SISWA` di `src/types/kuis.ts`.
- File: `src/types/kuis.ts`, `src/pages/siswa/SiswaTka.tsx`, `src/pages/siswa/SiswaKuis.tsx`.

## 2026-11-11 — Halaman masuk: lebih cerah & tanpa login orang tua

- Hapus tab/link **Orang Tua** di halaman masuk staf dan siswa (login orang tua tidak dipakai di LMS).
- Overlay hero diperingan agar foto kelas tidak gelap/suram; kutipan lebih transparan + blur.
- Teks hero staf diganti menjadi sambutan sekolah yang ramah siswa; hero siswa: «Selamat datang, teman-teman!».
- File: `src/pages/Login.tsx`, `src/pages/siswa/SiswaMasuk.tsx`, `src/index.css`.

## 2026-11-11 — Reset TKA: attempt + draf jawaban (progress)

- Reset attempt sekarang punya 3 mode:
  - **Reset attempt + draf** (default): hapus `lms_jawaban` + tandai hapus draf perangkat
  - **Reset draf saja**: hanya tandai hapus progress/localStorage (kiriman server tetap)
  - **Reset attempt saja**: hanya hapus kiriman server (draf perangkat tetap)
- Marker server: `lms_tka_progress_reset/{kuisId}_{siswaId}` (Admin SDK).
- Klien siswa (`SiswaTka`): saat muat daftar / mulai kuis, jika marker lebih baru dari draf lokal → hapus localStorage.
- UI detail hasil TKA: tiga tombol reset. Roster: **Reset+** = mode semua.
- Rules: siswa boleh baca marker miliknya. File rules utuh LMS + SDM01Penilaian.
- CF: `resetJawabanKuisLms` (versi lengkap). ANTIREGRESI §101.

## 2026-11-11 — Atur kuis: tambah soal dari bank

- **Masalah:** di Atur kuis (KuisDetail) hanya ada hapus/urut soal; tidak bisa menambah dari bank setelah kuis dibuat (termasuk TKA).
- **Perbaikan:** tombol «+ Tambah dari bank» membuka modal: pilih paket siap → PilihSoalManual → snapshot soal ke kuis.
- Duplikat (sumberSoalId) dilewati; batas BATAS_SOAL_PER_KUIS; sumberPaketIds ikut diperbarui saat simpan.
- TKA: filter bentuk tetap TIPE_SOAL_TKA (pg/pgk/bs) — tidak regresi mapel biasa (ANTIREGRESI §88, §102).
- File: src/components/KuisDetail.tsx.
- ANTIREGRESI §102.

## 2026-11-10 — TKA: UI dashboard, materi paket, template, AI stimulus

- **Dashboard TKA** diperbarui (kartu mapel + daftar materi, bukan kartu generik).
- **Navigasi balik** dari ruang TKA → `/tka` (bukan daftar ruang kelas).
- **Materi IPA** mencakup Fase B + Fase C.
- **Paket TKA** wajib pilih materi saat dibuat; materi diwariskan ke semua soal; filter bank memakai materi paket.
- **Unduh template / import TKA** memakai materi (bukan TP); template JSON/CSV khusus TKA (`stimulus` + `teks`).
- **AI generate** (akun khusus): pada mapel TKA, narasi panjang masuk ke **bahan bacaan/stimulus**, bukan kotak soal.
- Mapel biasa tidak berubah.
- File: `tkaAkses.ts`, `TkaBeranda.tsx`, `tka.css`, `KelasDetail.tsx`, `BankSoalPanel.tsx`, `importSoal.ts`, `soal.ts`, `types/soal.ts`, `SoalEditor.tsx`, `SoalEditorKartu.tsx`, `TkaFieldEditor.tsx`, `AiSoalPanel.tsx`.
- ANTIREGRESI §86.

## 2026-11-10 — TKA: bank bersama, 3 mapel, filter materi

- **Dashboard TKA:** 3 kontainer saja (Matematika, Bahasa Indonesia, IPA) — tanpa pemisahan 6A/6B/6C.
- **Kelas 6C dihapus** dari ruang TKA; rombel siswa = 6A & 6B.
- **Bank soal bersama:** disimpan dengan kelas kanonik `6`; berlaku untuk 6A dan 6B. Paket lama 6A/6B tetap terbaca (merge di klien).
- **Filter bank TKA:** Materi (daftar tetap) menggantikan TP; bentuk soal hanya PG / PG kompleks / Benar-Salah (kategori); tanpa «Kelompokkan».
- **Materi tetap:**
  - Matematika: Bilangan, Geometri dan Pengukuran, Data
  - Bahasa Indonesia: Pemahaman Tekstual, Pemahaman Inferensial, Evaluasi dan Apresiasi
  - IPA: Sistem Organ Manusia, Ekosistem dan Lingkungan, Gelombang Bunyi dan Cahaya, Energi Alternatif, Bumi dan Antariksa
- **Rules:** `mapelTka` + `TKA IPA`; `tkaKelas6` = `6`/`6A`/`6B`; wali 6A atau 6B kelola bank bersama; siswa 6A/6B baca kuis aktif kelasnya **atau** kelas `6` mapel TKA.
- File: `src/lib/tkaAkses.ts`, `src/pages/tka/TkaBeranda.tsx`, `src/components/BankSoalPanel.tsx`, `src/components/soal/TkaFieldEditor.tsx`, `src/pages/SoalEditor.tsx`, `src/pages/siswa/SiswaTka.tsx`, `firestore.rules` (lengkap → SDM01Penilaian), `docs/TKA.md`.
- ANTIREGRESI §85.

## 2026-11-10 — Rekap Nilai: fondasi (Tahap 1)

- Menu sidebar **Rekap Nilai** (`/rekap-nilai`) — pusat agregasi nilai TP untuk sinkron ke aplikasi Penilaian.
- Halaman shell: pilih kelas × mapel (dari penugasan guru) → tab per TP → sub-tab **SLM / STS / SAS** + tabel roster siswa (placeholder nilai).
- Tipe: `src/types/rekapNilai.ts` (`SumberNilaiSlm`, `BobotSlmDok`, `NilaiSiswaTp`).
- Lib util: `src/lib/rekapNilai.ts` (`daftarMapelKelasGuru`, `idBobotSlm`, `hitungNilaiBerbobot`).
- **Belum:** agregasi otomatis dari tugas/kuis, input bobot live, tulis nilai akhir, Cloud Function sinkron.
- File: `src/pages/RekapNilai.tsx`, `src/types/rekapNilai.ts`, `src/lib/rekapNilai.ts`, `src/components/Layout.tsx`, `src/App.tsx`, `docs/DATA_MODEL.md`.
- ANTIREGRESI §78.

## 2026-11-10 — Fix simpan nilai tugas (permission write)

- Create/update `lms_nilai_tugas`: izinkan **admin** di samping `lmsTulisMapelKelas` (admin tidak lolos penugasan mapel).
- Izinkan field opsional `null` / map (`komentar`, `predikat`, `nilaiPerKategori`, `nilaiRataRata`).
- Client tidak mengirim field opsional kosong sebagai `null` pada create.
- File: `firestore.rules` (lengkap), `src/lib/nilaiTugas.ts`.

## 2026-11-10 — Fix permission daftar nilai tugas

- Rules `lms_nilai_tugas` baca: guru/admin (`isGuru()` / `isAdmin()`) agar query list tidak ditolak; tulis tetap `lmsTulisMapelKelas`.
- Client: roster `siswa` tetap dimuat meski query nilai gagal (`nilaiTugas.ts`).
- File: `firestore.rules` (lengkap → SDM01Penilaian), `src/lib/nilaiTugas.ts`.

## 2026-11-10 — Fix simpan pengaturan penilaian (undefined Firestore)

- `updateDoc` gagal karena `pengaturanPenilaian.catatan` (dan field opsional lain) bernilai `undefined`.
- `sanitasiPengaturanPenilaian` di `src/lib/tugas.ts`: kosong → `null` / dihilangkan; dipakai di buat & update tugas.

## 2026-11-10 — Blok mapel + TP per mapel (proyek)

- Pengaturan tugas: setiap mapel (utama / tambahan) punya dropdown mapel **dan** daftar TP di bawahnya; multi-TP per mapel.
- Proyek: tombol **+ Tambah mata pelajaran** (bukan checklist mapel lain).
- Hapus mapel tambahan menghapus TP terkait mapel itu.
- File: `src/pages/TugasDetail.tsx`.

## 2026-11-10 — Mapel/TP dari Penilaian + AI tugas (CF)

- **Mapel:** opsi mapel di pengaturan tugas memuat koleksi `mapel` (Penilaian) + penugasan guru (`getDaftarMapel`).
- **TP:** multi-mapel via `getTpMultiMapelKelas` (proyek: TP dari mapel utama + mapel lain); label mapel pada daftar TP.
- **Generate kategori AI:** Cloud Function `generateKategoriTugasLmsAi` — wajib isi tugas tersimpan (≥40 karakter); 4–6 kategori; tidak lagi random lokal.
- **Generate isi AI:** `generateIsiTugasLmsAi` — wajib judul tugas sudah disimpan; hanya akun AI.
- File LMS: `src/lib/tugasAi.ts`, `src/lib/tpData.ts`, `src/pages/TugasDetail.tsx`.
- File SDM01Penilaian: `functions/generateTugasLmsAi.js`, `functions/index.js` (lengkap).

## 2026-11-10 — Daftar nilai terhubung rubrik + UI penilaian

- Setiap **kategori penilaian** menjadi kolom skor di Daftar nilai; rata-rata otomatis; nilai akhir + predikat.
- Predikat **hanya bisa dipilih** oleh akun AI (`arif.azwar79@gmail.com`); guru lain melihat predikat otomatis dari nilai.
- Tombol generate (ikon) di samping predikat: mengisi skor tiap kategori dari predikat (akun AI saja).
- **Kunci rentang** predikat: guru bisa mengunci/membuka edit tabel KKM.
- Simpan `nilaiPerKategori` + `nilaiRataRata` di `lms_nilai_tugas`.
- UI pengaturan penilaian & lembar nilai diperjelas (kartu rubrik, tabel sticky nama, highlight C-).
- File: `src/types/tugas.ts`, `src/lib/nilaiTugas.ts`, `src/lib/penilaianTugas.ts`, `src/pages/TugasDetail.tsx`.

## 2026-11-10 — Pengaturan penilaian: rubrik + predikat KKM 70

- Hapus skala maks, bobot mapel, dan opsi sinkron dari form pengaturan penilaian.
- **Pengaturan penilaian:** kategori rubrik (asesmen kinerja) + tabel rentang predikat default KKM/KKTP 70 (C- = 70); guru dapat mengedit.
- **Generate kategori (AI)** dan **generate nilai dari predikat** hanya untuk sesi Auth `arif.azwar79@gmail.com` (sama pola `bolehGenerateSoalAi`).
- **Sinkron ke Penilaian:** tombol di Daftar nilai (CF menyusul).
- File: `src/types/tugas.ts`, `src/lib/penilaianTugas.ts` (baru), `src/lib/nilaiTugas.ts`, `src/pages/TugasDetail.tsx`, `docs/DATA_MODEL.md`.

## 2026-11-10 — Rules lms_tugas + input nilai manual

- **Rules (file lengkap):** ditambah `lms_tugas` dan `lms_nilai_tugas` di blok REPO nitoe/lms. Tidak mengubah rules Penilaian/Sarpras/Perpustakaan/materi/kuis/soal. Salin utuh ke SDM01Penilaian lalu `npm run deploy:rules`.
  - `lms_tugas`: baca guru (lihatMapelKelas) + siswa aktif kelas sendiri; tulis guru penugasan/wali.
  - `lms_nilai_tugas`: baca/tulis guru mapel×kelas; siswa baca milik sendiri.
- **Input nilai:** tab Daftar nilai memuat roster `siswa` per kelas + form nilai/komentar per baris (`src/lib/nilaiTugas.ts`).
- File LMS: `src/lib/nilaiTugas.ts`, `src/pages/TugasDetail.tsx`, `docs/DATA_MODEL.md`.
- File shared: `firestore.rules` (lengkap → SDM01Penilaian).
- Belum: pengumpulan file siswa, sinkron CF ke nilai Penilaian.

## 2026-11-10 — Perbaikan build: TugasPanel & TugasDanKuis

- `buatTugas` di `TugasPanel` wajib `jenis: 'mapel'` (sesuai `TugasInput`).
- `TugasDanKuis.tsx` diganti redirect ke `/tugas` (hindari error union tipe dengan `TugasLms` baru).
- File: `src/components/TugasPanel.tsx`, `src/pages/TugasDanKuis.tsx`.

## 2026-11-10 — Fondasi fitur Tugas (v0.5.0)

- **Navigasi:** menu sidebar **Tugas** menggantikan «Tugas & Kuis». Tab Tugas dihapus dari ruang kelas (`KelasDetail`); kuis tetap di tab Ruang Kelas. Alias `/tugas-kuis` → `/tugas`.
- **Dashboard `/tugas`:** katalog kartu (jenis mapel/proyek, kelas, mapel, tenggat, status, jumlah pengumpulan) + filter + buat tugas baru.
- **Detail `/tugas/:id` & `/tugas/baru`:** tab **Pengaturan** (jenis, kelas, mapel, multi-mapel proyek, multi-TP, tenggat, aktif), **Isi Tugas** (deskripsi + instruksi), **Input Nilai** (sub-tab Pengaturan penilaian + placeholder Daftar nilai).
- **Model:** `jenis` (`mapel` | `proyek`), `mapelLain[]`, `tpList[]`, `instruksi`, `pengaturanPenilaian` (skala, bobot, sinkronKePenilaian). Kompatibilitas baca dokumen lama (satu TP).
- **Lib:** `daftarTugasGuru`, `ambilTugas`, perluasan `buatTugas` / `updateTugas`.
- File: `src/types/tugas.ts`, `src/lib/tugas.ts`, `src/pages/TugasDashboard.tsx`, `src/pages/TugasDetail.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `src/pages/KelasDetail.tsx`, `docs/DATA_MODEL.md`.
- **Belum:** rules `lms_tugas` (masih mengandalkan pola yang sudah ada / default — akan ditambahkan hati-hati), pengumpulan siswa, input nilai per siswa, sinkron ke Penilaian.
- `TugasPanel` di ruang kelas tidak lagi dipakai; file lama boleh dihapus kemudian.

## 2026-11-10 — TKA Tahap 1: menu TKA, penjaga akses, rules, skrip migrasi

- **Fitur:** menu baru **TKA (Tes Kemampuan Akademik)** di sidebar guru dan navigasi siswa, dimigrasi bertahap dari repo `nitoe/tka2026`.
  - Guru: hanya **admin TKA** (`arif.azwar79@gmail.com`) dan **wali kelas 6** (6A/6B/6C). Halaman `/tka` menampilkan jumlah soal/paket/hasil hasil migrasi dan daftar tahap berikutnya.
  - Siswa: item **TKA** muncul hanya untuk kelas 6; halaman `/siswa/tka` masih placeholder (pengerjaan di Tahap 2).
- **Data:** koleksi baru `tka_soal`, `tka_paket`, `tka_token`, `tka_percobaan`, `tka_sesi_live` di project LMS (tipe di `src/types/tka.ts`). Token try out dipisah dari paket agar tidak terbaca siswa.
- **Rules:** fungsi `tkaAdmin`/`tkaGuruKelas6`/`tkaStaf`/`tkaSiswa` + blok `tka_*`. `firestore.rules` di repo ini disinkronkan dengan salinan terbaru di SDM01Penilaian (sebelumnya tertinggal: batas soal 100, `lms_kuis` siswa, `lms_jawaban`).
- **Migrasi:** `scripts/migrasi-tka.mjs` di SDM01Penilaian (dry-run bawaan, project terkunci, tidak menimpa). Siswa dicocokkan NISN lalu nama+kelas; yang tak cocok/ambigu dilaporkan, tidak ditebak.
- **Dokumentasi:** `docs/TKA.md` (akses, koleksi, langkah migrasi, tahapan).
- File (LMS): `src/lib/tkaAkses.ts`, `src/types/tka.ts`, `src/pages/tka/TkaBeranda.tsx`, `src/pages/siswa/SiswaTka.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `src/pages/siswa/SiswaLayout.tsx`, `src/pages/siswa/SiswaIcon.tsx`, `firestore.rules`, `docs/TKA.md`. File (SDM01Penilaian): `firestore.rules` (lengkap), `scripts/migrasi-tka.mjs`, `scripts/cek-migrasi-tka.mjs`.
- ANTIREGRESI §76.

## 2026-11-10 — Fix: tugas/kuis lama terlihat (rules + query pembuat)

- Gejala: tugas/kuis yang dibuat sebelum update rules tidak tampil di UI.
- Sebab: katalog hanya query penugasan kelas×mapel; error permission ditelan; rules baca tidak mengizinkan pembuat.
- Rules (file **lengkap**): `lms_tugas` / `lms_kuis` read = `isAdmin()` **atau** penugasan/wali **atau** `dibuatOleh == uid` (siswa: tugas aktif kelas sendiri).
- Klien: `daftarTugasGuru` menggabungkan penugasan + query `dibuatOleh`; admin opsi muat semua; `KuisPanel` menggabungkan `daftarKuisDibuatOleh`.
- Deploy rules hanya dari SDM01Penilaian (salinan lengkap).
- File: `firestore.rules` (lengkap), `src/lib/tugas.ts`, `src/lib/kuis.ts`, `src/pages/TugasDashboard.tsx`, `src/components/KuisPanel.tsx`.
- ANTIREGRESI §80, §81.

## 2026-11-10 — Rekap Nilai Tahap 2: agregasi SLM/STS/SAS + bobot live

- Sumber SLM otomatis dari tugas (terhubung TP, jenisPenilaian SLM) + kuis `jenisPenilaian=slm`.
- Bobot live per sumber; simpan ke `lms_bobot_slm`; nilai akhir berbobot di tabel.
- STS/SAS dari kuis (dan tugas) dengan jenis sesuai.
- **Belum:** matriks rekap seluruh TP + Cloud Function sinkron ke Penilaian.
- File: `src/lib/rekapNilai.ts`, `src/pages/RekapNilai.tsx`; rules `lms_bobot_slm` di `firestore.rules` (lengkap).
- ANTIREGRESI §79.

## 2026-11-10 — Monitor tugas & kuis aktif di Ruang Kelas

- Panel **Penugasan aktif** di atas katalog ruang: jumlah + daftar singkat tugas/kuis aktif (tautan).
- Mengganti teks intro generik; catatan wali dipendekkan.
- Kartu mapel menampilkan badge jumlah tugas/kuis aktif.
- File: `src/pages/KelasList.tsx`, `src/components/RuangCard.tsx`.

## 2026-11-10 — Jenis penilaian tugas (SLM / STS / SAS)

- **Kuis:** sudah punya `jenisPenilaian` di pengaturan — tidak diubah.
- **Tugas:** field baru `jenisPenilaian` (`latihan` | `slm` | `sts` | `sas`), default `slm`; dokumen lama tanpa field dianggap SLM.
- UI tab Pengaturan tugas: dropdown **Jenis penilaian**.
- Katalog tugas menampilkan label Penilaian.
- Rekap: filter sumber sesuai jenis (bukan semua tugas = SLM).
- File: `src/types/tugas.ts`, `src/lib/tugas.ts`, `src/pages/TugasDetail.tsx`, `src/pages/TugasDashboard.tsx`, `src/lib/rekapNilai.ts`.
- Rules: tidak perlu diubah (field opsional).

## 2026-11-10 — Fix build: rekapNilai.ts TypeScript

- `daftarRuangKelas(profil ?? null)` — `undefined` tidak lolos tipe `AppUser | null`.
- Mapping `lms_bobot_slm.sumber`: `jenis` ditegaskan sebagai `'tugas' | 'kuis'` (`SumberNilaiSlm['jenis']`).
- File: `src/lib/rekapNilai.ts` (lengkap).

## 2026-11-10 — Rekap Nilai terhubung penugasan/wali + monitor Ruang Kelas

- **Rekap Nilai** memakai sumber kelas×mapel yang **sama dengan Ruang Kelas**: penugasan guru + perluasan wali × master mapel (bukan hanya `penugasan` mentah). Menghilangkan pesan kosong palsu bagi wali kelas.
- UI Rekap **Tahap 2** (agregasi tugas/kuis + bobot SLM) dipastikan ikut terpasang.
- **Ruang Kelas:** panel **Penugasan aktif** (daftar tugas/kuis aktif) mengganti teks intro lama; badge jumlah di kartu mapel.
- File: `src/pages/RekapNilai.tsx`, `src/lib/rekapNilai.ts`, `src/pages/KelasList.tsx`, `src/components/RuangCard.tsx`.
- ANTIREGRESI §83.

## 2026-11-10 — TKA Tahap 3: bank soal TKA dapat dikelola di editor soal

- **Editor soal:** blok baru «Bahan bacaan & pengaturan TKA» (`TkaFieldEditor`) di ruang TKA: bahan bacaan/stimulus (teks biasa atau HTML dengan tabel, ada pratinjau), materi, tombol rumus, dan label kolom Benar/Salah kustom. Rumus aktif otomatis untuk soal baru di ruang TKA.
- **Perbaikan:** mengganti tipe soal (`ubahTipe`) sebelumnya membuang field TKA; kini `stimulus`, `tipeMateri`, `rumus` terbawa. Analisis «butuh stimulus» tidak lagi menandai soal yang sudah punya bahan bacaan teks.
- **Tampilan:** stimulus berupa teks biasa dirender sebagai paragraf (`stimulusKeHtml`).
- File: `src/components/soal/{TkaFieldEditor,SoalEditorKartu,StimulusSoal}.tsx`, `src/lib/{soal,analisisSoal,html}.ts`, `src/styles/soal.css`, `docs/TKA.md`.
- ANTIREGRESI §84.

## 2026-11-09 — Latihan: riwayat pengerjaan + opsi kerjakan lagi dari awal

- **Perilaku:**
  - Setelah **Selesai & Kirim**, siswa melihat layar hasil (skor, nomor percobaan).
  - Di daftar kuis: badge **Sudah dikerjakan N×** + skor terakhir + ringkas riwayat.
  - **Latihan** (`jenisPenilaian === 'latihan'`): tombol **Kerjakan lagi dari awal** dengan konfirmasi; progres lokal dihapus; kirim berikutnya = percobaan baru di `lms_jawaban`.
  - Bukan latihan (SLM/STS/SAS): setelah dikirim tidak bisa mengerjakan ulang dari akun siswa; hanya melihat status terkirim.
  - Draf lokal (belum kirim) tetap bisa **Lanjutkan**.
- **Backend:** `nilaiKuisLms` menulis `lms_jawaban` per kirim (`siswaId`, `percobaan`, skor, detail); penilaian otomatis juga untuk jodoh & BS.
- **Rules:** `lms_jawaban` baca siswa (milik sendiri) / guru mapel×kelas; tulis hanya Admin SDK (CF).
- File: `src/pages/siswa/SiswaKuis.tsx` (LMS); `functions/nilaiKuisLms.js` + `firestore.rules` (SDM01Penilaian, versi lengkap).
- Indeks Firestore: komposit `lms_jawaban` — `siswaId` Asc + `kuisId` Asc (buat di Console bila query gagal).

## 2026-11-09 — Layout kuis siswa: hilangkan max-w-2xl (regresi ruang kosong)

- **Bug:** daftar kuis siswa tampil sempit di tengah layar PC, ruang kosong lebar di kiri-kanan.
- **Penyebab:** wrapper `max-w-2xl mx-auto` (dan saat mengerjakan: `max-w-5xl mx-auto`) — pola yang sudah dilarang ANTIREGRESI §54 tetapi ikut terbawa lagi saat rewrite fitur progres/timer.
- **Perbaikan:** konten mengikuti lebar `.sw-main` (hingga 1600px); dialog konfirmasi tetap `max-w-sm` (boleh terpusat).
- **Pelajaran:** setiap rewrite halaman siswa wajib cek viewport ~1280px; jangan menambah `max-w-*` sempit pada konten utama.
- File: `src/pages/siswa/SiswaKuis.tsx`.

## 2026-11-09 — Regresi rules: status paket siap→draf (batas soal 100 vs 300)

- **Bug berulang:** mengubah status paket bank soal dari Siap ke Draf gagal dengan "Missing or insufficient permissions".
- **Penyebab:** `firestore.rules` masih membatasi `lms_paket_soal.soal.size() <= 100` sementara kode (`BATAS_SOAL_PER_PAKET`) sudah 300. Validasi rules memakai dokumen hasil (`request.resource.data`), jadi **setiap** update (termasuk hanya ganti status) ditolak bila paket punya >100 soal.
- **Perbaikan:** create & update `lms_paket_soal` → `soal.size() <= 300` (selaras `types/soal.ts`).
- **Prosedur wajib:** setiap patch rules **harus** berangkat dari file terbaru di repo (bukan salinan lama di zip sebelumnya), lalu merge perubahan. Jangan menimpa dengan versi usang.
- File: `firestore.rules` (lengkap, salin ke SDM01Penilaian lalu `npm run deploy:rules`).
- ANTIREGRESI §74.

## 2026-11-09 — Kuis siswa: tampilan lengkap, progres, cegah keluar tidak sengaja

- **Masalah:**
  1. Siswa bisa berpindah halaman kapan saja (tombol Keluar + navigasi bawah) tanpa konfirmasi; progres hilang.
  2. Tidak ada save progress — refresh/tutup tab menghapus jawaban.
  3. Gambar soal tidak tampil (hanya `soal.teks` via `dangerouslySetInnerHTML`).
  4. Tipe benar-salah dan menjodohkan belum didukung di form jawaban siswa.
- **Perbaikan:**
  - `SiswaKuis.tsx` memakai komponen `SoalTampil` (semua tipe: PG, PGK, jodoh, BS, isian, uraian) + `GambarSoal`/`RichView`.
  - Progres jawaban + nomor soal + sisa waktu disimpan otomatis ke `localStorage` (kunci per siswa+kuis); tombol **Lanjutkan** di daftar.
  - Dialog konfirmasi saat Keluar; `beforeunload` saat refresh/tutup tab; navigasi bawah siswa disembunyikan selama mengerjakan.
  - `firestore.rules`: siswa LMS boleh **read** `lms_kuis` aktif milik kelasnya (claim token). Catatan: snapshot memuat kunci — cukup untuk latihan; ujian berisiko tinggi nanti lewat CF.
- File: `src/pages/siswa/SiswaKuis.tsx`, `firestore.rules` (lengkap, salin ke SDM01Penilaian).
- ANTIREGRESI §54.

## 2026-11-09 — Kuis disusun dari paket bank soal (snapshot stabil)

- **Ganti total** alur tab Kuis di ruang kelas. Model lama (`lms_soal` terpisah + editor KuisBuilder dari nol) dihentikan; kuis lama dianggap draf dan diganti.
- Kuis baru diambil dari satu atau lebih **paket bank soal berstatus Siap**.
- Mode penyusunan:
  - **Manual** — centang soal dari paket terpilih.
  - **Otomatis** — filter jumlah, bentuk (tipe), kompleksitas L1–L3; sistem mengacak dan mengisi kuota.
  - **Otomatis + bantuan AI** (hanya `arif.azwar79@gmail.com`) — sama + deteksi soal mirip (Jaccard teks); tombol buang pasangan mirip. Analisis esensi AI server menyusul.
- **Snapshot penuh** setiap soal disimpan di `lms_kuis.soal[]` (poin default 1) agar perubahan bank tidak merusak kuis aktif. Jejak `sumberPaketId` / `sumberSoalId` tetap ada.
- Setelah dibuat: ubah poin per soal, urutan, hapus soal, durasi, acak soal/opsi, aktifkan/nonaktifkan.
- File utama: `src/types/kuis.ts`, `src/lib/susunKuis.ts` (baru), `src/lib/kuis.ts`, `src/components/KuisPanel.tsx`, `src/components/KuisDetail.tsx` (baru). `KuisBuilder.tsx` tidak lagi dipakai.
- `firestore.rules` (lengkap, repo SDM01Penilaian): `lms_kuis` wajib field `soal` list (≤100); create `lms_soal` ditolak (legacy hapus saja).
- ANTIREGRESI §64.

## 2026-11-09 — Perbaiki build: hapus KuisBuilder + import susunKuis

- Hapus `src/components/KuisBuilder.tsx` (model kuis lama; tidak diimpor setelah alur snapshot dari bank soal).
- `src/lib/susunKuis.ts`: buang import type `KompleksitasSoal` / `TipeSoal` yang tidak terpakai (TS6196).

## 2026-11-09 — Kuis: pengelompokan otomatis menurut bentuk soal + instruksi bagian

- **Masalah:** setelah soal disusun (manual/otomatis) dari bank, urutannya belum terkelompok menurut bentuk, sehingga siswa berpotensi bingung saat mengerjakan.
- **Perbaikan:**
  - Di halaman detail kuis, soal ditampilkan **dikelompokkan** menurut `URUTAN_TIPE` (PG → PG kompleks → Menjodohkan → Benar/Salah → Isian → Uraian).
  - Setiap kelompok menampilkan **instruksi lengkap dan jelas**.
  - Tombol **Kelompokkan menurut bentuk** menyusun ulang array `soal` di state (urutan relatif dalam kelompok tetap); user kemudian menekan Simpan.
- File: `src/components/KuisDetail.tsx` (tambah `INSTRUKSI_TIPE` + tampilan berkelompok) dan `src/components/KuisPanel.tsx` (pratinjau juga dikelompokkan + diurutkan otomatis saat susun).
- ANTIREGRESI §65.
- Catatan ke depan: struktur kelompok + instruksi ini menjadi dasar ekspor Word/PDF sesuai template sekolah.

## 2026-11-09 — Perbaiki permissions ubah status paket siap → draf + warning TipTap

- **Bug:** mengubah status paket dari Siap ke Draf gagal dengan "Missing or insufficient permissions" meski koneksi baik. Penyebab: `firestore.rules` masih membatasi `soal.size() <= 100` sementara kode sudah mengizinkan hingga 300.
- **Perbaikan:** batas di create & update `lms_paket_soal` dinaikkan ke 300 (sesuai `BATAS_SOAL_PER_PAKET`).
- **TipTap:** warning "Duplicate extension names found: ['underline']" dihilangkan dengan menonaktifkan underline di StarterKit (karena sudah ditambahkan eksplisit).
- File: `firestore.rules` (lengkap, salin ke SDM01Penilaian lalu deploy), `src/components/soal/RichEditor.tsx`.
- ANTIREGRESI §66.

## 2026-11-09 — Perbaiki regresi: batas prompt ilustrasi AI terlalu pendek (600)

- **Regresi:** batas deskripsi/prompt generate ilustrasi AI kembali ke 600 karakter (UI) dan 500 (server). Terlalu pendek untuk prompt yang stabil.
- **Perbaikan:** dinaikkan menjadi 3000 karakter di UI (`GambarSoal.tsx` maxLength) dan di Cloud Function (`generateSoalLmsAi.js` potong petunjukGambar).
- File: `src/components/soal/GambarSoal.tsx` (LMS) + `functions/generateSoalLmsAi.js` (SDM01Penilaian, versi lengkap).
- ANTIREGRESI §67.

## 2026-11-09 — Kuis otomatis: proporsi soal menurut kompleksitas bentuk

- **Perbaikan:** saat mode otomatis / otomatis+AI dan user hanya mengisi total jumlah soal (tanpa jumlahPerTipe), sistem sekarang membagi soal secara proporsional menurut kompleksitas bentuk:
  - PG paling banyak (~35%)
  - PG kompleks ~20%
  - Isian ~15%
  - Benar/Salah & Menjodohkan ~12% masing-masing
  - Uraian paling sedikit (~6%)
- Jika stok tipe tertentu kurang, sisa diisi dari tipe lain yang masih tersedia (perilaku lama).
- File: `src/lib/susunKuis.ts`.
- ANTIREGRESI §68.

## 2026-11-09 — Fase 1 kuis: waktu, token, jenis penilaian, dan tautan TP

- Tambah pengaturan pada kuis:
  - Waktu mulai & waktu selesai
  - Token (opsional, untuk akses online)
  - Jenis penilaian: `latihan` | `slm` | `sts` | `sas`
  - Daftar TP (satu atau lebih). Untuk STS/SAS mendukung banyak TP agar nantinya bisa menilai capaian per TP.
- UI di halaman detail kuis (bagian “Pengaturan kuis & penilaian”).
- `firestore.rules` (lengkap): izinkan field opsional baru pada `lms_kuis`.
- File: `src/types/kuis.ts`, `src/lib/kuis.ts`, `src/components/KuisDetail.tsx`, `firestore.rules`.
- ANTIREGRESI §69.
- Catatan: integrasi nilai ke SDM01Penilaian dan pengerjaan siswa menyusul di fase berikutnya.

## 2026-11-09 — Form jawaban siswa + skeleton Cloud Function nilaiKuisLms

- Halaman pengerjaan kuis siswa: form jawaban untuk PG, PG kompleks, isian, dan uraian.
- Tombol selesai memanggil Cloud Function `nilaiKuisLms` (skeleton).
- Skeleton function di repo SDM01Penilaian: `functions/nilaiKuisLms.js` (versi lengkap, siap dilengkapi logika penilaian).
- ANTIREGRESI §71.

## 2026-11-09 — Perbaiki error TS pada update kuis dan SiswaKuis
- Tambah `nilaiPerTp` dan `sumberNilai` ke tipe `updateKuis`.
- Hapus import tidak terpakai `teksPolos` di `SiswaKuis.tsx`.

## 2026-11-09 — Rules untuk koleksi lms_jawaban

- Tambah blok `match /lms_jawaban/{id}` di `firestore.rules` (versi lengkap).
- Siswa (token lmsSiswa) boleh create jawaban miliknya sendiri.
- Guru kelas×mapel dan admin boleh read.
- Update dari klien ditolak; delete hanya admin.
- ANTIREGRESI §72.

## 2026-11-09 — TP pada kuis terisi otomatis dari paket soal
- Saat menyusun kuis, sistem mengumpulkan TP unik dari paket bank soal yang dipilih.
- Di halaman detail, daftar TP ditampilkan (bisa dihapus) bukan lagi textarea bebas.
- File: `KuisPanel.tsx`, `KuisDetail.tsx`, `lib/kuis.ts`.

## 2026-11-09 — Overhaul UI area siswa: full-width responsive (PC + HP)

- **Masalah berulang:** halaman siswa (terutama Kuis dan halaman baru) memakai container sempit (`max-w-2xl mx-auto` / max-width kecil) sehingga di PC banyak ruang kosong kiri-kanan; pola sama sering terulang saat membuat halaman baru.
- **Perbaikan:**
  - `src/styles/siswa.css`: shell `.sw-main` / header fluid (max 1600px, padding `clamp`); nav HP tetap bottom fixed; ≥768px nav menjadi strip horizontal di bawah header; grid mapel/materi/kuis diperjelas per breakpoint; kelas `.sw-kuis-list` / `.sw-kuis-card` baru.
  - `SiswaLayout.tsx`: urutan header → nav → main agar sticky nav desktop benar; tidak membungkus konten dengan max-width sempit.
  - `SiswaKuis.tsx`: hapus `max-w-2xl mx-auto`; daftar kuis grid full-width; mode kerjakan tetap dalam shell siswa (bukan full-screen terpisah yang memotong nav).
- **ANTIREGRESI §54** (baru): aturan wajib full-width responsive untuk area siswa dan acuan halaman baru.
- Perlu di-deploy: hosting saja (`npm run deploy`). Tidak ada perubahan rules.

## 2026-11-09 — Analisis hasil kuis guru (termasuk latihan)

- **Masalah:** kuis berjenis *Latihan* tampak tidak punya menu nilai/analisis di akun guru. Bukan karena data tidak tersimpan: CF `nilaiKuisLms` menulis setiap kiriman ke `lms_jawaban` (termasuk latihan). Yang hilang adalah **UI guru** untuk membaca analisis.
- **Bukan regresi penilaian rapor:** latihan tetap tidak menulis ke `nilai_tp` / STS / SAS. Analisis jawaban ≠ input nilai rapor.
- **Perbaikan:**
  - Tab **Hasil siswa** di detail kuis (`KuisPanel`): daftar skor per siswa (percobaan terbaru atau semua), agregat benar/salah per soal.
  - `src/lib/jawabanKuis.ts` — baca `lms_jawaban` (query `kuisId`).
  - `docs/DATA_MODEL.md` — skema `lms_jawaban`.
  - `firestore.rules` (repo SDM01Penilaian, versi lengkap): blok `lms_jawaban` (baca siswa/guru/admin; tulis false).
  - ANTIREGRESI §55.
- **Deploy:** hosting LMS; pastikan rules produksi sudah memuat `lms_jawaban` (`npm run deploy:rules` dari SDM01Penilaian bila belum). Indeks: `siswaId`+`kuisId`.

## 2026-11-09 — Fix permissions tab Hasil siswa (query lms_jawaban)

- **Bug:** tab Hasil siswa menampilkan "Missing or insufficient permissions".
- **Penyebab:** query hanya `where('kuisId')`. Rules `lms_jawaban` mengizinkan baca guru lewat `lihatMapelKelas(mapel, kelas)` pada field dokumen; Firestore menolak list query yang tidak membatasi field yang sama.
- **Perbaikan:** `daftarJawabanKuis(kuisId, kelas, mapel)` — filter `kuisId` + `kelas` + `mapel`. ANTIREGRESI §55.3.
- File: `src/lib/jawabanKuis.ts`, `src/components/HasilKuisPanel.tsx`.
- **Cek juga:** rules produksi sudah memuat `match /lms_jawaban` (deploy dari SDM01Penilaian). Bila muncul error indeks, buat indeks komposit `kuisId`+`kelas`+`mapel` lewat tautan Console.

## 2026-11-09 — Penilaian kuis guru: daftar nilai + nilai manual uraian/isian

- **Kebutuhan:** belum ada aplikasi penilaian & daftar nilai kuis di sisi guru; ragu isian/uraian dinilai benar.
- **Perilaku penilaian:**
  - **PG / PGK / BS / jodoh:** otomatis di CF `nilaiKuisLms`.
  - **Isian:** otomatis (teks dinormalisasi + cocok angka 3 = 3,0); guru boleh mengoreksi skor.
  - **Uraian:** tidak otomatis (skor 0, status perlu manual) → guru isi skor di detail siswa.
- **UI guru (tab Hasil siswa):** daftar nilai skala 100, status «Perlu nilai manual», detail per siswa (jawaban vs kunci/pedoman), input skor + simpan.
- **CF baru:** `nilaiManualKuisLms` (tulis skor lewat Admin SDK; rules `lms_jawaban` tetap tulis=false).
- **CF `nilaiKuisLms`:** isian mendukung kesetaraan numerik.
- File LMS: `src/lib/jawabanKuis.ts`, `src/components/HasilKuisPanel.tsx`, `src/components/KuisPanel.tsx`.
- File SDM01Penilaian: `functions/nilaiManualKuisLms.js`, `functions/nilaiKuisLms.js`, `functions/index.js` (lengkap).
- Deploy: `firebase deploy --only functions:nilaiKuisLms,functions:nilaiManualKuisLms` dari SDM01Penilaian; hosting LMS.

## 2026-11-09 — UI Hasil siswa dirapikan

- Kartu ringkasan (jumlah siswa, rata-rata /100, selesai, perlu dinilai).
- Tab pill aktif berwarna muh; tabel dengan inisial, badge status, hover baris.
- Detail siswa: header skor menonjol, nomor soal berwarna, kartu jawaban, area nilai manual.
- File: `src/components/HasilKuisPanel.tsx`, `src/components/KuisPanel.tsx`.

## 2026-11-09 — UI Atur kuis dirapikan

- Tab **Atur kuis** (`KuisDetail`): bilah aksi sticky (simpan + ringkas soal/poin), kartu bagian Identitas / Jadwal & akses / Penilaian & TP, daftar soal per bentuk dengan header badge dan baris lebih rapi.
- File: `src/components/KuisDetail.tsx`.

## 2026-11-09 — Analisis kuis dengan AI (akun terbatas)

- Tombol **Jalankan analisis AI** di tab Hasil siswa (hanya sesi Auth UID+email `arif.azwar79@gmail.com`).
- CF `analisisKuisLmsAi`: agregat skor & butir dari `lms_jawaban`, prompt Gemini → ringkas, kekuatan/kelemahan, butir bermasalah, miskonsepsi, tindak lanjut, perbaikan soal.
- File LMS: `src/lib/analisisKuisAi.ts`, `src/components/HasilKuisPanel.tsx`, ANTIREGRESI §56.
- File SDM01Penilaian: `functions/analisisKuisLmsAi.js`, `functions/index.js`.
- Deploy: `firebase deploy --only functions:analisisKuisLmsAi` lalu hosting LMS.

## 2026-11-09 — Analisis AI per siswa (nilai isian/uraian) + unduh .doc

- **Mode siswa:** AI membandingkan jawaban isian/uraian dengan kunci; skor boleh pecahan (0,5). Tombol **Analisis AI** di samping Detail/nilai dan di halaman detail. **Terapkan** / **Terapkan semua skor AI** → `nilaiManualKuisLms`.
- **Mode kuis:** laporan kualitatif kelas tetap ada.
- **Unduh .doc** (HTML kompatibel Word) untuk laporan kelas maupun per siswa.
- Hanya akun `arif.azwar79@gmail.com`.
- File: `analisisKuisAi.ts`, `HasilKuisPanel.tsx`; CF `analisisKuisLmsAi.js` (mode kuis|siswa); ANTIREGRESI §56.

## 2026-11-09 — Kuis offline: input jawaban guru + nilai otomatis + bantu AI

- Field `modePelaksanaan`: `online` | `offline` di atur kuis.
- Tab **Input offline** (jika offline): pilih siswa, isi jawaban, **Simpan & nilai otomatis** (CF `simpanJawabanOfflineKuis`, kunci di server).
- Kuis offline tidak tampil di portal siswa.
- Bantu nilai AI isian/uraian (akun `arif.azwar79@gmail.com`) setelah simpan → terapkan skor lewat `nilaiManualKuisLms`.
- File LMS: `types/kuis.ts`, `lib/kuis.ts`, `lib/offlineKuis.ts`, `components/OfflineKuisPanel.tsx`, `KuisDetail.tsx`, `KuisPanel.tsx`, `SiswaKuis.tsx`.
- File SDM01Penilaian: `functions/simpanJawabanOfflineKuis.js`, `functions/index.js`.

## 2026-11-09 — Rekap hasil kuis + sinkron ke Penilaian (SLM/STS/SAS)

- Halaman **Rekap Kuis** (`/rekap-kuis`): tabel nilai online & offline, filter kelas×mapel×kuis.
- Tombol **Sinkronkan ke Penilaian** untuk jenis SLM/STS/SAS → CF `sinkronNilaiKuisLms` menulis `nilai_tp` / `nilai_sts` / `nilai_sas` (skala 100, percobaan terbaru per siswa, TP dari daftar TP kuis).
- Latihan tidak disinkron. Butuh TP di atur kuis yang cocok `tp_kktp`.
- File LMS: `pages/RekapKuis.tsx`, `lib/sinkronNilaiKuis.ts`, `App.tsx`, `Layout.tsx`.
- File SDM01Penilaian: `functions/sinkronNilaiKuisLms.js`, `index.js`.

## 2026-11-09 — UI Input offline: status siswa, progress, soal penuh, alur cepat

- **Panel Input offline** diperbaiki agar guru lebih cepat mengisi banyak siswa:
  - Badge **sudah diinput** + skor terakhir di dropdown siswa; urutkan yang belum diinput di atas.
  - Cari nama siswa.
  - Progress bar jumlah soal terisi; kartu soal hijau bila sudah diisi.
  - Teks soal tampil penuh (RichView) + gambar soal/opsi bila ada.
  - Peringatan bila siswa sudah pernah diinput (percobaan baru).
  - Konfirmasi bila menyimpan dengan soal belum lengkap.
  - Sticky action bar: Simpan, Bantu AI, Terapkan AI, **Siswa berikutnya (belum diinput)**, Kosongkan form.
- File: `src/components/OfflineKuisPanel.tsx`.

## 2026-11-09 — Offline: muat ulang jawaban tersimpan + perbaiki bantu nilai AI

- **Bug:** memilih ulang siswa yang sudah diinput mengosongkan form meski skor ada di Hasil siswa.
  - **Perbaikan:** saat pilih siswa, muat `jawaban` + skor isian/uraian dari percobaan terbaru (`lms_jawaban`); set `lastJawabanId` agar AI & skor manual langsung tersedia.
  - Tombol **Kosongkan → percobaan baru** jika guru ingin input ulang dari nol.
- **Bug:** Bantu nilai AI (isian/uraian) di tab Input offline sering tidak jalan karena `jawabanId` hanya di-set setelah simpan di sesi yang sama.
  - **Perbaikan:** AI memakai `jawabanId` dokumen tersimpan; alur Terapkan skor AI memanggil `nilaiManualKuisLms` per butir lalu refresh status; tombol **Simpan skor ini** per soal isian/uraian.
- File: `src/components/OfflineKuisPanel.tsx`.

## 2026-11-09 — Sinkron nilai kuis dipindah ke tab Hasil siswa; hapus menu Rekap Kuis

- **Perubahan:**
  - Tombol **Sinkronkan ke Penilaian** (untuk SLM/STS/SAS) sekarang ada langsung di tab **Hasil siswa** pada detail kuis.
  - Menu sidebar dan halaman **Rekap Kuis** dihapus karena redundant dan dropdown kelas/mapel sering kosong.
- **Alasan:** Alur guru lebih langsung; tidak perlu pindah halaman hanya untuk sinkron.
- File: `src/components/HasilKuisPanel.tsx`, `src/components/Layout.tsx`, `src/App.tsx`.
- ANTIREGRESI §58 (catatan lokasi UI).

## 2026-11-09 — Perbaikan build: import analisisKuisAi di HasilKuisPanel dipulihkan

- **Bug:** `npm run deploy` gagal di `tsc -b` (25 error TS2304/TS7006) di `HasilKuisPanel.tsx`: `analisisKuisDenganAi`, `analisisSiswaDenganAi`, `bolehAnalisisKuisAi`, `htmlLaporanKuis`, `htmlLaporanSiswa`, `unduhLaporanDoc`, `HasilAnalisisKuisAi`, `HasilAnalisisSiswaAi` tidak ditemukan.
  - **Penyebab:** saat menambah import `sinkronNilaiKuisKePenilaian`, seluruh blok import dari `../lib/analisisKuisAi` ikut tertimpa. Error `implicit any` pada `.map((x, i) => …)` hanyalah akibat turunan.
  - **Perbaikan:** blok import `../lib/analisisKuisAi` dipulihkan dan import `../lib/sinkronNilaiKuis` dipertahankan. `tsc -b` lolos tanpa error.
- File: `src/components/HasilKuisPanel.tsx`.
- ANTIREGRESI §59.

## 2026-11-08 — Aktifkan fitur Tugas di ruang kelas & menu Tugas & Kuis di sidebar

- **Tugas di setiap mata pelajaran:** tab Tugas di detail ruang kelas kini aktif (bukan placeholder). Guru dapat membuat, mengaktifkan/nonaktifkan, dan menghapus tugas per kelas×mapel.
- **Menu sidebar Tugas & Kuis:** item "Soon" diganti menjadi halaman agregat `/tugas-kuis` yang menampilkan semua tugas dan kuis dari ruang kelas yang diampu guru. Memudahkan aktivasi dan pantauan lintas mapel.
- File baru: `src/types/tugas.ts`, `src/lib/tugas.ts`, `src/components/TugasPanel.tsx`, `src/pages/TugasDanKuis.tsx`.
- File diubah: `src/pages/KelasDetail.tsx`, `src/App.tsx`, `src/components/Layout.tsx`.
- Model data: koleksi `lms_tugas` (lihat docs/DATA_MODEL.md rencana sebelumnya).
- Rules: tambah match `lms_tugas` (file lengkap di zip).
- ANTIREGRESI §54.

## 2026-11-08 — Import soal ke paket yang sudah ada

- Tombol **Import** ditambahkan di samping Buka dan Hapus pada setiap kartu paket soal.
- Pengguna dapat menambahkan soal dari file JSON/CSV ke paket yang sudah ada (soal lama tidak diganti).
- Validasi tetap berlaku: mapel dan TP di file harus cocok dengan paket tujuan. Jika tidak cocok, impor ditolak.
- Import untuk membuat paket baru tetap ada dan tidak diubah.
- File: `src/components/BankSoalPanel.tsx`.
- ANTIREGRESI §56.

## 2026-11-08 — Batas soal per paket dinaikkan ke 300

- Batas maksimal soal per paket bank soal dinaikkan dari 100 menjadi **300**.
- Memudahkan pembuatan bank soal besar dengan variasi bentuk soal.
- File: `src/types/soal.ts` (`BATAS_SOAL_PER_PAKET`).
- ANTIREGRESI §58.

## 2026-11-08 — Perbaiki vite.config.ts untuk Vite 8

- Hapus `minify: 'esbuild'` (Vite 8 memakai Oxc secara default; esbuild sudah tidak disertakan).
- Ganti `__dirname` dengan `import.meta.dirname` agar kompatibel dengan config loader native.
- File: `vite.config.ts`.

## 2026-11-08 — Fitur Analisis stimulus (khusus user tertentu)

- Tombol **Analisis** muncul di editor soal hanya untuk UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1`.
- Mendeteksi soal yang kemungkinan butuh stimulus/ilustrasi (berdasarkan kata kunci) tetapi belum punya `gambarId`.
- Soal tersebut ditandai border merah di daftar kiri.
- Panel kanan yang bisa di-toggle menampilkan daftar soal tersebut + klik untuk loncat ke soal.
- File baru: `src/lib/analisisSoal.ts`. File diubah: `SoalEditor.tsx`, `soal.css`.
- ANTIREGRESI §61.

## 2026-11-08 — Perbaiki kualitas soal AI (validasi impor + analisis)

- **importSoal.ts**: validasi ketat per tipe soal. Soal isian tanpa kunci, jodoh tanpa pasangan, bs tanpa pernyataan, dan pgk dengan >4 opsi atau >2 kunci ditolak. Deteksi duplikat berdasarkan teks.
- **analisisSoal.ts**: analisis diperluas — mendeteksi soal yang kurang kunci, pasangan, pernyataan, pembahasan, atau PG kompleks yang terlalu berat.
- Panduan AI diperbarui dengan aturan yang lebih ketat.
- File: `src/lib/importSoal.ts`, `src/lib/analisisSoal.ts`, `docs/PANDUAN_AI_BANK_SOAL.md`.
- ANTIREGRESI §63.

## 2026-11-08 — Perbaiki error import yang tidak hilang

- Pesan error validasi import sekarang dihapus saat form ditutup (Batal), file diganti, atau form lain dibuka.
- File: `src/components/BankSoalPanel.tsx`.

## 2026-11-08 — Perbarui panduan AI (aturan PG kompleks untuk SD)

- Panduan AI Bank Soal diperkuat dengan aturan khusus PG kompleks:
  - Maksimal 4 opsi
  - Idealnya tepat 2 jawaban benar
  - Wajib menuliskan di teks soal berapa jawaban yang benar
  - Jangan membuat hampir semua opsi benar
- File: `docs/PANDUAN_AI_BANK_SOAL.md`.

## 2026-11-08 — Ilustrasi AI: anti-bocorkan jawaban + deskripsi opsional

- Prompt gambar: larangan label jawaban (termasuk nama organ pada soal identifikasi), teks soal/opsi, dan gaya screenshot lembar ujian.
- Tombol **Generate ilustrasi** langsung dari teks soal; deskripsi tambahan opsional.

## 2026-11-08 — AI: narasi ikut diganti + level stimulus

- Perbaiki bug fatal: generate AI hanya mengisi opsi/kunci sementara narasi soal tidak berubah (RichEditor tidak sinkron ke props).
- Panel AI: opsi level stimulus (tanpa / ringan / sedang / kaya) untuk teks fungsional hingga narasi panjang.
- Prompt server mewajibkan field `teks` baru; kompatibel field lama `butuhStimulus`.

## 2026-11-08 — Sidebar dapat diciutkan (ikon saja)

- Menu kiri desktop bisa diciutkan: hanya ikon navigasi, ruang konten (editor soal) lebih lebar.
- Tombol ciut di brand sidebar dan di topbar; preferensi disimpan di `localStorage`.
- Default ciut saat membuka editor soal bila belum ada preferensi.

## 2026-11-08 — AI per-soal, deskripsi ilustrasi, daftar soal rapi

- Generate AI dipindah ke kartu soal aktif: satu nomor per generate (tipe + kompleksitas yang dipilih guru + fokus materi).
- Form ilustrasi AI: input deskripsi untuk tabel/grafik/chart agar data terbaca dan fungsional.
- Prompt Gemini: penekanan daya pembeda pengecoh & larangan pola jawaban benar paling panjang (Buku Saku).
- Daftar samping editor: cegah overflow horizontal, teks 2 baris, chip dikelompokkan.

## 2026-11-08 — AI generate soal & ilustrasi (akun terbatas)

- Cloud Functions (repo SDM01Penilaian): `generateSoalLmsAi` + `generateIlustrasiSoalLmsAi` (Gemini, secret `GEMINI_API_KEY`). Prompt mengacu Buku Saku menyusun soal SD. Hanya UID+email pemilik AI.
- LMS klien: `src/lib/generateSoalAi.ts`, panel **Buat soal dengan AI** di editor paket, tombol **Ilustrasi AI** di pemilih gambar soal (terpisah dari generate teks).
- Generate teks dan gambar sengaja dipisah; ilustrasi wajib fungsional (bukan dekorasi).

## 2026-11-08 — Editor bank soal: semua tipe soal dapat dipakai

- **Bug kritis:** `ubahTipe()` sebelumnya mengganti `id` soal → daftar samping/`aktifId` kehilangan fokus sehingga form PG kompleks, menjodohkan, B/S, isian, dan uraian tampak tidak berfungsi. Id kini dipertahankan.
- **`JawabanEditor`:** form diperkuat untuk keenam tipe (fallback array kosong, label jelas, saklar skor sebagian / abaikan kapital). Layout menjodohkan 2 kolom responsif.
- **`masalahSoal`:** aman terhadap field array yang hilang/rusak.
- ANTIREGRESI §46.

## 2026-11-08 — Bank soal: kompleksitas L1–L3, filter & pengelompokan

- **Model:** field `kompleksitas` (`L1` | `L2` | `L3`) pada setiap soal; denormalisasi `jumlahPerTipe` + `jumlahPerKompleksitas` di `lms_paket_soal` saat simpan. Default soal baru = L1; dokumen lama dinormalisasi ke L1.
- **Editor:** pemilih kompleksitas di kaki kartu soal; chip L1/L2/L3 di daftar samping.
- **Bank soal:** filter TP/materi, bentuk soal, kompleksitas, status; mode kelompokkan menurut TP, bentuk, atau kompleksitas. Chip ringkas per paket.
- **Layout:** perbaikan overflow select TP di `.materi-form` / `.materi-field` (grid `minmax(0,1fr)`, `min-width: 0`, ellipsis) — dicatat ANTIREGRESI §44.

## 2026-11-08 — Perbaikan editor bank soal + rules modul Kuis

- **Font Inter**: file `public/fonts/inter-latin-wght-normal.woff2` ditambahkan (self-host). Sebelumnya path `@font-face` mengarah ke file yang tidak ada, sehingga dev-server mengembalikan HTML → browser gagal decode font (`OTS parsing error: invalid sfntVersion`, `Failed to decode downloaded font`).
- **RichEditor (TipTap)**: ekstensi `Underline` dipasang (`@tiptap/extension-underline`) karena tombol garis bawah memanggil `toggleUnderline` tanpa extension → error runtime. Dependensi eksplisit `@tiptap/extensions` (Placeholder) dan `@tiptap/extension-underline` ditambah di `package.json`.
- **`firestore.rules`** (file lengkap, salin ke SDM01Penilaian): blok baru `lms_kuis` dan `lms_soal`. Baca/tulis hanya guru kelas×mapel (atau admin hapus); soal memuat kunci (`opsi.benar`, `jawabanIsian`, …) jadi siswa **tidak** boleh baca (sama prinsip §38). Query klien wajib `where kelas + mapel` (kuis) / `where kuisId` (soal).
- **`storage.rules`** (file lengkap): path `lms/kuis/{kuisId}/{fileName}` — unggah/baca staf, maks 5 MB image.

## 2026-11-08 — LMS Fase 2a: Bank Soal & Editor Soal (repo `nitoe/lms`)

- **Tab baru «Bank Soal»** di ruang kelas: daftar paket soal per kelas × mapel (status Draf/Siap, jumlah soal, total poin, TP), buat, cari, hapus.
- **Editor soal** (`/kelas/:ruangId/soal/:paketId`): daftar soal di kiri (cari, seret untuk mengurutkan, duplikat, naik/turun, hapus, penanda soal belum lengkap) dan kartu soal di kanan, mengikuti tata letak referensi.
- **Enam tipe soal:** pilihan ganda, pilihan ganda kompleks, menjodohkan, benar/salah (tabel pernyataan), isian singkat (kunci alternatif), uraian (pedoman penskoran, dinilai manual). Tipe bisa diganti tanpa kehilangan teks/gambar/poin.
- Teks kaya (TipTap: tebal, miring, garis bawah, subskrip/superskrip, daftar, palet simbol matematika), gambar pada soal/pilihan/sisi kiri menjodohkan (dikompres otomatis di browser), pembahasan, poin, estimasi waktu, acak pilihan, acak soal, skor sebagian.
- Simpan otomatis + peringatan sebelum menutup tab; pratinjau tampilan siswa dengan «Periksa jawaban» (`lib/penilaian.ts`, fungsi murni untuk dipakai penilaian kuis di Fase 2b); «Tandai siap» hanya bila semua soal lengkap.
- Koleksi baru `lms_paket_soal` dan `lms_gambar` (lihat `docs/DATA_MODEL.md` di repo LMS). Editor dimuat malas (lazy) agar bundel siswa tidak membengkak.
- Dependensi baru: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-subscript`, `@tiptap/extension-superscript`, `dompurify`.
- `firestore.rules`: dibangun di atas versi terbaru (dengan `isSiswaLms()`/`loginSiswaLms`). Blok baru `lms_paket_soal` (baca/tulis hanya guru kelas×mapel; admin hapus; memuat kunci jawaban) dan `lms_gambar` (baca guru atau siswa LMS bertoken, buat guru, tanpa ubah). Ditambah banner `REPO:` dan peta kepemilikan di header agar jelas bagian milik SDM01Penilaian, sarpras, perpustakaan, dan lms; blok `perpus_progress` dipindah ke bagian Perpustakaan. Tidak ada aturan lain yang berubah.
- **Deploy wajib:** salin `firestore.rules` ke repo Penilaian lalu `npm run deploy:rules`, kemudian `npm run deploy` di repo LMS. Tanpa deploy rules, editor menampilkan «Missing or insufficient permissions».
- Belum ada: kuis untuk siswa (2b), generate soal AI (2c), rumus KaTeX, impor soal dari paket lain.
- **Catatan tumpang tindih:** modul «Kuis» (`lms_kuis`, `lms_soal`, `KuisBuilder`) yang sudah ada di repo LMS dibuat terpisah dari «Bank Soal» (`lms_paket_soal`). Keduanya hidup berdampingan sementara; penyatuan menunggu keputusan. Rules untuk `lms_kuis`/`lms_soal` **belum ada** (ditolak oleh aturan default) sampai ditulis.

## 2026-11-05 — Login siswa LMS lewat Cloud Function (identitas siswa di Firebase Auth)

- **Latar belakang:** siswa LMS login memakai NISN yang dicocokkan **di klien**, tanpa Firebase Auth. Akibatnya rules tidak bisa membedakan siswa satu dengan lainnya, sehingga fitur Tugas (pengumpulan dan nilai per siswa) tidak bisa diamankan. Sebagai langkah sementara, commit `6ff49f4` membuka baca `lms_materi` untuk siapa saja (`allow read: if true`); perubahan ini menggantikannya.
- **Cloud Function baru `loginSiswaLms`** (`functions/loginSiswaLms.js`, wilayah `asia-southeast2`): menerima `siswaId` + `nisn`, memverifikasi NISN di server terhadap `siswa/{id}` (hanya siswa aktif), lalu menerbitkan custom token Firebase Auth dengan claims `lmsSiswa`, `siswaId`, `kelas`, `nama`. UID siswa: `lms_siswa_{siswaId}`.
- **Pembatasan percobaan:** 5 kali NISN salah mengunci siswa itu 10 menit (dicatat di `lms_login_gagal/{siswaId}`, hanya bisa diakses Admin SDK). Pesan gagal seragam agar tidak membocorkan siapa yang ada atau tidak.
- Logika murni dipisah ke `functions/aturanSiswaLms.js`; uji: `node scripts/cek-login-siswa-lms.mjs`.
- **`firestore.rules`:** `isLoggedIn()` kini **tidak** berlaku untuk token siswa (agar aturan lama yang hanya memeriksa «sudah login» tidak ikut terbuka untuk siswa); fungsi baru `isSiswaLms()`. `lms_materi` dibaca guru/admin, atau siswa hanya untuk materi kelasnya sendiri (claim `kelas`).
- **`storage.rules`:** `isLoggedIn()` mengecualikan token siswa dengan alasan yang sama (mencegah siswa menghapus/menimpa `lms/materi` atau membaca file staf). Download URL bertoken tetap bisa dibuka siswa.
- **Deploy wajib, berurutan:** (1) beri peran *Service Account Token Creator* pada service account runtime function (lihat ANTIREGRESI §32); (2) `firebase deploy --only functions:loginSiswaLms`; (3) deploy LMS v0.4.3; (4) `npm run deploy:rules`. Rules sebelum LMS baru di-deploy akan membuat siswa di LMS lama tidak bisa membuka materi.
- **Keterbatasan:** koleksi `siswa` (berisi `nisn`) masih terbaca publik karena dipakai login Perpustakaan, sehingga verifikasi server belum membuat NISN rahasia. Perlu langkah lanjutan sebelum nilai siswa ditampilkan.

## 2026-10-29 — Jadwal rilis rapor STS

- Wali kelas dan admin dapat menjadwalkan rilis rapor STS ke portal orang tua.
- Di halaman **Publikasikan rapor STS**: pilih tanggal & waktu, lalu **Jadwalkan**.
- Jadwal disimpan di dokumen `sts_publikasi` (field `jadwalAt`, `jadwalOlehNama`).
- Saat waktu tiba dan halaman Publikasikan (atau hub yang memuat status) dibuka oleh wali kelas, rilis otomatis dijalankan memakai fungsi `publikasikanSts` yang sama dengan tombol manual.
- Tombol **Publikasikan sekarang** tetap ada. Membatalkan publikasi atau mempublikasikan manual menghapus jadwal.
- Tidak mengubah rumus rapor, salinan `rapor_sts_ortu`, atau rules. Tidak perlu `deploy:rules`.

## 2026-10-29 — Perbaikan loop Publikasikan STS + Top STS live

### Loop di halaman Publikasikan rapor STS
- **Bug**: halaman terus menampilkan “Memuat status publikasi…” tanpa selesai (loop).
- **Penyebab**: `muat` bergantung pada objek `toast` dari `useToast()`. Objek itu baru setiap render, sehingga `useEffect([muat])` berjalan terus.
- **Perbaikan**: dependency diganti ke `toast.show` (stabil via `useCallback`).

### Dashboard guru kelas — Top STS
- Kartu **Top STS** di beranda guru (wali kelas) sekarang menampilkan 5 siswa dengan rata-rata nilai STS tertinggi pada periode aktif.
- Sumber: koleksi `nilai_sts` (filter kelas + tahun ajaran + semester). Bukan placeholder lagi.
- Top SLM dan Top SAS tetap placeholder sampai modulnya siap.

## 2026-10-29 — Jadwal rilis STS benar-benar otomatis

- **Bug**: jadwal hanya berjalan saat halaman Publikasikan dibuka/di-refresh di aplikasi penilaian. Portal orang tua tidak melihat rapor sampai guru membuka halaman itu.
- **Perbaikan**:
  - Saat menekan **Jadwalkan**, salinan `rapor_sts_ortu` disiapkan (published: false) memakai fungsi yang sama dengan publikasi manual.
  - Cloud Function `jalankanJadwalPublikasiSts` (setiap 1 menit, Asia/Jakarta) membalik `published` menjadi true pada salinan dan gerbang `sts_publikasi` ketika waktu tiba.
  - Tidak menghitung ulang nilai di function — hanya membalik flag, sehingga tidak beda dengan rapor resmi.
- **Deploy wajib**: `firebase deploy --only functions:jalankanJadwalPublikasiSts` lalu hosting.
- Data yang dirilis adalah data saat jadwal disimpan. Jika nilai berubah, jadwalkan ulang.

## Belum dirilis — Fondasi Bank Soal / Kuis

- Tab **Kuis** ditambahkan di ruang kelas (`KelasDetail`).
- `src/types/kuis.ts`, `src/lib/kuis.ts`: model dan CRUD untuk `lms_kuis` + `lms_soal`.
- `src/components/KuisPanel.tsx` + `KuisBuilder.tsx`: daftar kuis + builder sidebar (daftar soal) + editor (pertanyaan, opsi, gambar, skor).
- Jenis soal: PG, PG Kompleks, Menjodohkan, Benar/Salah, Isian, Uraian.
- Gambar pertanyaan diunggah ke Storage (`lms/kuis/{kuisId}/...`, maks 5 MB).
- `docs/DATA_MODEL.md`: skema `lms_kuis` dan `lms_soal` ditambahkan.
- **Rules belum di-deploy** — koleksi `lms_kuis` dan `lms_soal` perlu ditambahkan di `firestore.rules` (shared).

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan keamanan & dokumentasi

- `firestore.rules`: ditulis ulang. Pendaftaran `users` hanya sebagai `orangtua`+`pending` (sebelumnya pengguna login mana pun bisa membuat profil dengan role apa pun, termasuk `admin`). Orang tua hanya boleh `get` anaknya sendiri di `siswa` (sebelumnya bisa `list` semua siswa). Guru hanya boleh mengubah `tamatIqro` pada `siswa`; `create/delete` siswa khusus admin. `setoran`/`menulis_log` dibatasi per kelas yang diampu dan immutable. Koleksi `students` dan `nilai` dihapus dari rules. **Belum di-deploy** — jalankan `npm run deploy:rules` setelah uji.
- `firebase.json`: ditambah header keamanan dan CSP mode Report-Only.
- `docs/DATA_MODEL.md` (baru): kontrak data dan keputusan terbuka (project Firebase tunggal, ID siswa).
- `docs/DEPLOY.md`: ditambah langkah custom domain, Authorized domains, dan peringatan bahwa rules tidak ikut ter-deploy otomatis.
- `README.md`: perintah `firebase use` diperbaiki, tabel status migrasi diperbarui.
- `ANTIREGRESI.md` (baru).

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan build & persiapan migrasi data

- `src/lib/siswaAdmin.ts`: perbaikan error TS2352 (`siswaToCsv`) — konversi tipe lewat `unknown`. `npm run build` lolos.
- `src/lib/firebase.ts`: Firestore diinisialisasi dengan `ignoreUndefinedProperties: true`. `normalizeSiswa()` menghasilkan field `undefined` untuk kolom kosong; tanpa opsi ini `setDoc`/`batch.set` melempar "Unsupported field value: undefined" saat menyimpan siswa.
- `scripts/migrate-firestore.mjs` (baru): salin 23 koleksi dari `sdm01-penilaianv2` ke `sdm01kukusan-2e735`. Dry-run bawaan, tidak menimpa dokumen yang sudah ada, ID dokumen dipertahankan.
- `docs/MIGRASI_DATA.md` (baru): langkah migrasi Auth + Firestore, verifikasi, cutover.
- `docs/DATA_MODEL.md`: keputusan #1 ditetapkan (project tunggal `sdm01kukusan-2e735`); skema `siswa` diperbarui sesuai kode.
- `.gitignore`: menolak file kunci service account dan laporan migrasi.

## Belum dirilis (basis: package.json 0.1.0) — Fondasi UI baru (gaya dashboard)

- `src/index.css`: token baru (palet peach, radius kartu 20px, latar hangat), kelas `.hero-banner`, dukungan `prefers-reduced-motion`. `.card-soft` dipertahankan agar halaman lama otomatis ikut tampilan baru.
- `src/components/Icon.tsx`, `src/components/ui.tsx` (baru): ikon SVG tanpa dependensi, `IconTile`, `Badge`, `HeroBanner`, `Chip`, `StatCard`, `ModuleCard`, `SectionTitle`.
- `src/components/Layout.tsx`: shell baru — sidebar berikon, header dengan judul bagian dan tanggal, kartu "Masuk sebagai", navigasi bawah bergaya ikon di mobile.
- `src/pages/Home.tsx`: beranda berisi banner sapaan, ringkasan siswa (terdaftar, Iqro, Al-Qur'an), diagram siswa per kelas, dan kartu modul.
- `src/lib/dashboardStats.ts` (baru): ringkasan memakai count aggregation (15 query per kelas + 1 nonaktif), tanpa mengunduh dokumen siswa.
- `src/lib/roles.ts` (baru): hak akses menu di satu tempat. `src/App.tsx`: `RoleGate` menjaga rute `/tahsin`, `/akademik`, `/admin` per role (sebelumnya semua pengguna login bisa membuka halaman admin; Firestore tetap menolak tulisnya).
- `TahsinHub`, `AkademikHub`, `AdminHub`, `Placeholder`, `Login`: tampilan baru memakai komponen di atas. Logika login tidak diubah.

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan privasi data siswa + fondasi Akademik

- **KEAMANAN**: `src/data/siswaSeed.json` (NISN, alamat, HP, email, nama orang tua 403 siswa) dihapus. File itu diimpor statis oleh `DataSiswa.tsx` sehingga ikut terbundel ke JS publik dan terbaca siapa pun yang membuka situs tanpa login. Tombol "Impor data resmi" dihapus; impor tetap lewat CSV/Dapodik oleh admin. `.gitignore` menolak `src/data/*.json`, `*seed*.json`, `*.xlsx`. Riwayat git masih menyimpan file lama: lihat `docs/AUDIT_MIGRASI.md` §1.
- `src/types/akademik.ts`, `src/lib/akademikRumus.ts` (rumus murni), `src/lib/akademik.ts` (Firestore), `src/lib/penugasan.ts` (baru): TypeScript port dari `firestore-data-akademik.js` v2 untuk mapel, config, TP/KKTP, bobot semester, nilai SLM.
- Halaman baru: `/akademik/setup-tp`, `/akademik/bobot-semester`, `/akademik/nilai-slm`. Validasi baru dibanding v2: rentang KKTP (0–100, naik, tidak tumpang tindih), bobot SLM+SAS = 100, nomor TP unik, penyimpanan nilai hanya untuk baris yang berubah (batch).
- `firestore.rules`: ditambah `bolehMapelKelas`, `bolehWaliKelas`, `config/akademik`, `nilai_tp`. **Belum di-deploy.**
- `src/types/user.ts`, `src/lib/auth.ts`: profil membawa `waliKelas`, `penugasanKelas`, `penugasanKelasMapel`.
- `scripts/cek-rumus-akademik.mjs` (baru): uji rumus nilai (`node --experimental-strip-types scripts/cek-rumus-akademik.mjs`).
- `docs/AUDIT_MIGRASI.md` (baru): temuan audit dan peta migrasi sisa modul.

## Belum dirilis (basis: package.json 0.1.0) — Beranda berorientasi akademik + catatan masa transisi

- `src/pages/Home.tsx`: kartu ringkasan sekarang Tahun ajaran/semester (dari `config/akademik`), siswa terdaftar, dan siswa di kelas saya (admin: rombongan belajar). Info Iqro/Al-Qur'an dihapus dari beranda. Untuk `guru_akademik` ditambah "Mapel dan kelas saya" (dari `penugasan`) dan akses cepat ke Setup TP, Bobot Semester, Input Nilai SLM. Diagram siswa per kelas menyorot kelas milik pengguna. Info dan kartu Tahsin disembunyikan di layar kecil bila pengguna juga punya modul Akademik atau admin.
- `src/components/Layout.tsx`: urutan menu Beranda, Akademik, Tahsin, Administrasi. Kartu "Masuk sebagai" memakai wali kelas/penugasan, bukan `kelasAmpu`.
- `src/lib/kelasSaya.ts` (baru): kelas wali dan kelas mengajar dari profil. `src/lib/dashboardStats.ts`: `loadAkademikConfig()` ditambah; hitungan Iqro/Al-Qur'an dihapus.
- `src/pages/TahsinHub.tsx`: catatan masa transisi (input setoran tetap di sistem lama).
- `docs/MIGRASI_DATA.md`: v2 tidak lagi dibekukan di awal; ditambah bagian "Masa transisi" dan sinkron ulang. `docs/DATA_MODEL.md`: catatan peran dan kelas.

## Belum dirilis (basis: package.json 0.1.0) — Koreksi catatan masa transisi

- Pemilik proyek memastikan v2 belum dipakai guru dan belum ada data nilai/setoran nyata. `docs/MIGRASI_DATA.md`: v2 diperlakukan sebagai referensi, bagian "Masa transisi" diganti menjadi panduan bila ada guru mulai menginput di dua tempat. `src/pages/TahsinHub.tsx`: catatan diubah menjadi netral ("Belum dibuka untuk guru"); sebelumnya menyebut input harian di sistem lama.

## Belum dirilis (basis: package.json 0.1.0) — Impor Excel Dapodik dan pemisahan biodata siswa

- `src/lib/siswaImport.ts` (baru): logika murni data siswa dipindah dari `siswaAdmin.ts` (tanpa perubahan perilaku) ditambah: `rapikanNama` (aturan Title Case v2), `normalisasiTanggal`, `pisahSiswa`/`gabungSiswa`, `praLihatImpor` (baru/update/duplikat), `bacaExcel`, `validasiLayoutDapodik`.
- `src/lib/siswaAdmin.ts`: biodata sekarang ditulis ke `identitas_siswa` (kunci mengikuti v2), `siswa` hanya data dasar; sisa biodata lama di `siswa` dihapus saat disimpan. Ditambah `listSiswaLengkap` (admin), `jalankanImpor`. `upsertSiswaBatch` dihapus (digantikan `jalankanImpor`). Impor tidak lagi menimpa `aktif`, `tamatIqro`, `jenjang` siswa yang sudah ada (sebelumnya impor mengaktifkan kembali siswa nonaktif dan mengosongkan `tamatIqro`).
- `src/pages/admin/DataSiswa.tsx`: impor file Excel Dapodik dengan pratinjau (baru/diperbarui/bermasalah, jumlah per kelas); impor teks CSV tetap ada (di bagian lipat). Daftar admin memuat data gabungan.
- `firestore.rules`: koleksi `identitas_siswa` (admin + wali kelas), mengembalikan pola v2.
- `docs/IMPOR_SISWA.md` (baru), `docs/DATA_MODEL.md` (skema dan pemetaan), `.gitignore` (`*.xlsx`, `*.xls`, `src/data/`).

## Belum dirilis (basis: package.json 0.1.0) — Hapus identitas nyata dari contoh template

- `src/pages/admin/DataSiswa.tsx`: baris contoh pada "Unduh template" memakai NIPD/NISN siswa sungguhan; diganti nilai palsu (`000000001`, `0000000001`). `.gitignore`: `*.patch` dan `*.diff` ditolak karena `fase1.patch` ternyata memuat data 403 siswa.

## Belum dirilis (basis: package.json 0.1.0) — Tahsin-Tahfizh: Baca & Tandai dan istilah status dikembalikan

- Penyebab fitur "menandai hafalan baik/kurang" hilang: `InputSetoran.tsx` menyimpan `detailAyat: []` dan `detailBacaanIqro: null` secara tetap, dan istilah status berbeda dari data v2.
- `src/components/BacaTandai.tsx` (baru): Baca & Tandai (ketuk kata = tajwid, lalu makhroj, lalu bersih; ayat Lulus / Perlu diulang; penanda ayat kritis ≥ 3 kata salah; statistik) dan Latihan Membaca Iqro. `src/lib/bacaTandai.ts` (baru, logika murni) dan `src/lib/quranText.ts` (baru, teks ayat dari equran.id dengan cache sesi dan batas waktu).
- `src/pages/tahsin/InputSetoran.tsx`: memakai komponen di atas; menyimpan `detailAyat`/`detailBacaanIqro` dalam bentuk v2; tanda ayat yang masih dalam rentang dipertahankan saat rentang digeser; validasi ayat akhir ≥ ayat mulai; label dihubungkan ke kontrol (aksesibilitas).
- `src/types/tahsin.ts`: `StatusHafalan` menjadi `'lulus' | 'ulang'` (sama dengan v2; sebelumnya `'mengulang' | 'belum'`, yang membuat status v2 tampil kosong). Data lama `'mengulang'`/`'belum'` dibaca sebagai `'ulang'` (`normalisasiStatus`).
- `src/pages/tahsin/RiwayatSiswa.tsx`, `src/lib/tahsinData.ts`: badge "Perlu diulang", ringkasan Baca & Tandai pada kartu, ubah (jenis/status/catatan) dan hapus catatan milik sendiri (admin boleh menghapus).
- `firestore.rules`: `setoran` dan `menulis_log` — update hanya oleh pembuat (setoran: hanya `jenis`, `statusHafalan`, `catatan`), delete oleh pembuat atau admin (sebelumnya update ditolak dan delete hanya admin). **Belum di-deploy.** `firebase.json`: CSP `connect-src` ditambah `https://equran.id`.
- `scripts/cek-baca-tandai.mts` (baru), `docs/PARITAS_FITUR.md` (baru, daftar fitur v2 vs situs baru dan daftar uji manual), `src/index.css` (gaya teks Arab dan tanda kata).

## Belum dirilis (basis: package.json 0.1.0) — Teks Al-Qur'an lengkap, tata letak PC Input Setoran, Target Hafalan

- Penyebab tulisan Arab kurang baik: situs memakai font sistem tanpa dukungan tanda baca Al-Qur'an yang baik, dan data hanya `teksArab`. `public/fonts/amiri-quran-arabic-400-normal.woff2` (+ lisensi SIL OFL 1.1) disajikan dari situs sendiri (sesuai CSP); semua 39 tanda baca Al-Qur'an yang diuji tersedia. `src/index.css`: `@font-face` dan ukuran teks 3 tingkat.
- `src/lib/quranText.ts` ditulis ulang: data surah dari EQuran.id berisi teks Arab, transliterasi, terjemahan Indonesia, audio per ayat dan surah penuh dari enam qari. URL audio hanya diterima bila https dan domain `equran.id`. Cache sesi memakai kunci baru (`tt_quran_v2_`). `src/lib/preferensiBaca.ts` (baru): qari, transliterasi, terjemahan, ukuran teks tersimpan per browser. `src/lib/useAudio.ts` (baru): satu pemutar, putar berurutan, berhenti sendiri.
- `src/components/BacaTandai.tsx`: bilah alat (qari, saklar transliterasi/terjemahan, ukuran, putar rentang, audio penuh), tombol putar per ayat dengan sorotan dan gulir otomatis, info surah, atribusi EQuran.id.
- `src/pages/tahsin/InputSetoran.tsx` dirombak untuk PC: dua kolom (daftar siswa tetap di kiri, area kerja di kanan), bilah simpan yang selalu terlihat, setoran terakhir + tombol Lanjutkan/Ulangi (`src/lib/lanjutan.ts`), Simpan & berikutnya, Ctrl+Enter. HP: daftar siswa diciutkan setelah memilih, bilah simpan diringkas, catatan dilipat. `src/components/PanelSiswa.tsx` (baru, dapat dipakai ulang).
- `src/components/Layout.tsx`: perbaikan `position: sticky` yang tidak berfungsi sejak pembungkus memakai `overflow-hidden` (sidebar dan header ikut tergulir); diganti `md:overflow-clip`. Halaman kerja harian memakai lebar penuh (`HALAMAN_LEBAR`).
- Target Hafalan: `src/pages/tahsin/TargetHafalan.tsx`, `src/lib/target.ts` (logika murni), `getTargetHafalan`/`saveTargetHafalan` di `tahsinData.ts`, rute `/tahsin/target`. Format data sama dengan v2. Riwayat Siswa → Ringkasan: Kualitas bacaan (5 sesi) dan progres terhadap target.
- `firebase.json`: CSP ditambah `media-src 'self' https://*.equran.id`. `scripts/cek-baca-tandai.mts` diperluas, `scripts/cek-target.mts` (baru), `docs/PARITAS_FITUR.md` diperbarui.

## Belum dirilis (basis: package.json 0.1.0) — Kelola Akun Guru

- `src/pages/admin/KelolaAkun.tsx`, rute `/admin/users`: admin membuat akun guru (Tahsin-Tahfizh, Akademik, atau administrator), mengubah kelas/mapel/wali kelas, mengirim tautan atur ulang password, dan menonaktifkan akun. Kartu di hub admin ditandai siap. Akun orang tua tidak disentuh. Halaman masuk daftar lebar (`HALAMAN_LEBAR`).
- `src/lib/akunGuru.ts`: penyusunan dokumen (`susunDokumenAkun`) selalu menulis `kelasAmpu`, `penugasan`, `waliKelas`, `penugasanKelas`, dan `penugasanKelasMapel` sekaligus. Peran yang tidak memakai sebuah tugas menyimpan array kosong. Uji: `node --experimental-strip-types scripts/cek-akun-guru.mjs`.
- `src/lib/akunGuruData.ts`: user Auth dibuat lewat aplikasi Firebase sekunder dengan persistence memori, supaya sesi admin tidak terganti. Password awal hanya ditampilkan sekali.
- `users.aktif`: `false` menolak login di aplikasi. `firestore.rules` menolak baca/tulis lewat `akunAktif()` (dokumen lama tanpa field ini tetap aktif). **Rules belum di-deploy** — jalankan `npm run deploy:rules`, lalu `npm run deploy` agar halaman tampil di situs.
- Admin tidak dapat menonaktifkan atau mengganti peran akunnya sendiri dari halaman ini.

## Belum dirilis — Pendaftaran mandiri guru & fitur akun

- Pendaftaran mandiri guru: halaman `/register` dengan dropdown nama guru resmi (dari penugasan 2026-2027). Akun dibuat dengan `status: pending`, menunggu persetujuan admin.
- Field `gelar` (pendidikan terakhir) ditambahkan pada profil guru. Dipakai untuk penandatanganan rapor (`nama, gelar`).
- Guru dapat mengedit nama dan gelar sendiri di `/profil`.
- Halaman login: toggle tampilkan/sembunyikan password (default sembunyi), fitur lupa password (kirim tautan reset).
- Admin tetap dapat membuat akun langsung di Kelola Akun. Ditambah tombol Ekspor JSON akun guru (untuk backup/impor ulang tanpa duplikat).
- `firestore.rules`: diperbarui agar mendukung create guru pending dan update `gelar` oleh pemilik.
- Data nama guru resmi: `src/lib/dataGuruResmi.ts`.

## Belum dirilis — Approval akun guru di Kelola Akun

- Filter baru **Menunggu** di halaman Kelola Akun.
- Badge status: Menunggu (peach), Ditolak, Aktif/Nonaktif.
- Panel samping: untuk akun pending muncul tombol **Setujui & atur tugas** (membuka form) dan **Tolak pendaftaran**.
- Menyimpan form akun pending otomatis mengubah status menjadi `approved`.
- Fungsi `setStatusAkun` ditambahkan di `akunGuruData.ts`.
- Nama + gelar ditampilkan di panel detail.

## Belum dirilis — Integrasi nama + gelar untuk rapor

- Komponen baru `TandaTanganGuru` yang menampilkan "Nama, Gelar".
- Halaman `/akademik/rapor` (pratinjau): tanda tangan diri sendiri dan wali kelas terpilih memakai gelar.
- Layout (sidebar & header) menampilkan gelar di samping nama jika ada.
- AkademikHub menandai halaman Rapor sebagai siap (pratinjau tanda tangan).

## Belum dirilis — Pendaftaran guru: pilih peran dan kelas

- Form `/register` diperlebar dan guru dapat memilih peran:
  - Guru Tahsin-Tahfizh
  - Guru Akademik (wali kelas / bidang studi)
  - Kombinasi
- Guru dapat memilih kelas Tahsin, wali kelas, dan penugasan mapel saat mendaftar.
- Data tersebut disimpan dengan status `pending`; admin meninjau dan menyetujui di Kelola Akun.
- `firestore.rules`: field kelasAmpu, penugasan, waliKelas, dan turunan diizinkan pada create pendaftaran guru.

## Belum dirilis — Form tambah guru admin selaras dengan pendaftaran

- Form Tambah/Ubah akun di Kelola Akun memakai pilihan peran yang sama:
  Guru Tahsin-Tahfizh, Guru Akademik, Kombinasi, Administrator.
- Pemilihan peran berupa kartu (bukan dropdown) dengan deskripsi singkat.
- Hint kelas dan penugasan diselaraskan dengan form pendaftaran mandiri.

## Belum dirilis — Daftar mapel dan tugas guru yang bisa digabung

- Admin → Mata Pelajaran: daftar bawaan (Pendidikan Pancasila sampai Tahfizh) langsung bisa dipilih, lalu disimpan ke Firestore.
- Form daftar dan tambah guru: tugas Tahsin-Tahfizh, Guru Kelas, dan Guru Bidang Studi bisa dipilih bersamaan. Tahsin + guru kelas tidak lagi tertutup oleh satu peran “Kombinasi”.
- Rules: akun kombinasi (`guru`) boleh mengakses data wali kelas dan mapel yang ditugaskan.

## Belum dirilis — Setup TP diselaraskan dengan penilaian-v2

- Daftar mapel bawaan memakai nama resmi v2: IPAS dan PJOK (bukan nama panjang). Tahsin dan Tahfizh dikeluarkan dari mapel akademik karena bukan TP/KKTP. Dokumen mapel yang sudah tersimpan tidak ditimpa.
- Halaman Mata Pelajaran menandai nama lama supaya bisa diganti manual.
- Setup TP: kartu mapel menampilkan jumlah TP (atau “Belum ada TP”) dan Fase A/B/C. Halaman detail menolak tingkatan di luar `tingkatanBerlaku`; gagal memuat data mapel tidak mengunci guru. Kartu TP menampilkan bobot SLM/SAS. Semester dan bobot mapel tetap hanya di halaman Bobot Semester.

## Belum dirilis — Input dan laporan SLM

- Input Nilai SLM menampilkan kelengkapan per mapel+kelas (semua TP / sebagian / belum ada TP) dan ringkasan rata-rata tertimbang SLM. Level KKTP dihitung dari SLM saja lewat `hitungNilaiAkhirTP`.
- Halaman baru `/akademik/laporan-slm`: tabel nilai per TP plus rata-rata, bisa dicetak. Hanya TP semester berjalan (dan yang belum dikelompokkan).
- Admin → Tahun Ajaran mengatur `config/akademik` (semester dan tahun ajaran) tanpa menimpa field lain. Mengganti semester tidak memindahkan nilai lama.
- `firestore.indexes.json`: indeks untuk `tp_kktp`, `nilai_tp`, dan `siswa`. **Belum di-deploy** — jalankan `npm run deploy:rules` supaya query nilai tidak ditolak Firestore.

## Belum dirilis — Guru kelas juga menyusun TP

- Keterangan Setup TP, bobot, dan input SLM tidak lagi menyebut hanya “guru mata pelajaran”. Yang menyusun TP adalah guru kelas maupun guru bidang studi yang mengampu mapel itu. Admin tetap tidak menulis TP.
- Formulir daftar dan Kelola Akun: guru kelas wajib memilih mapel yang diampu di kelas walinya. Pilihan itu disimpan sebagai penugasan, jadi guru kelas bisa membuka Setup TP, bobot, dan nilai SLM. Mapel di kelas lain tetap di bagian guru bidang studi.
- Kotak peringatan admin pada Setup TP, Bobot Semester, Input Nilai SLM, dan Laporan SLM memakai kalimat yang sama: disusun atau diisi oleh guru kelas maupun guru bidang studi; administrator tidak menulis.

## Belum dirilis — Akses guru kelas dan data sekolah

- Guru kelas membuka semua mapel di tingkat kelas walinya (termasuk PJOK dan mapel guru bidang studi) tanpa penugasan mapel. Guru bidang studi tetap hanya mapel yang ditugaskan. Guru Tahsin-Tahfizh tidak melihat menu Akademik.
- Admin dapat melihat TP, bobot, nilai, dan laporan SLM, tanpa tombol simpan atau hapus.
- Rules `nilai_tp`: guru kelas boleh menulis nilai di kelasnya; admin hanya membaca. **Belum di-deploy** — jalankan `npm run deploy:rules`.
- Administrasi → Data Sekolah: identitas, NPSN, alamat, kepala sekolah, tahun aj

## Belum dirilis — Nilai STS dan SAS

- Halaman `/akademik/nilai-sts`: guru memilih cakupan TP untuk STS atau SAS secara terpisah, lalu mengisi nilai per siswa. STS hanya menaikkan SLM bila lebih tinggi. SAS menampilkan SLM, STS, dan pratinjau nilai akhir TP.
- Koleksi `asesmen_cakupan`, `nilai_sts`, `nilai_sas`. Admin hanya membaca. **Rules dan indeks belum di-deploy** — jalankan `npm run deploy:rules`.

## Belum dirilis — Dashboard beranda per peran + filter admin + UI Data Sekolah

- `src/pages/Home.tsx`: ringkasan beranda disesuaikan per peran.
  - Guru akademik/kelas/bidang studi: **tidak lagi menampilkan daftar nama mapel**. Diganti kartu progres interaktif (Setup TP X/Y, TP tanpa bobot semester, pintasan nilai SLM) dengan badge "Perlu aksi".
  - Guru Tahsin: ringkasan siswa di kelas ampu + setoran 7 hari terakhir + pintasan Input Setoran.
  - Admin: tetap ringkasan sekolah + diagram siswa per kelas.
- `src/lib/dashboardStats.ts`: ditambah `loadGuruAkademikProgress`, `loadSiswaCountKelas`, `loadSetoranMingguIni`.
- `src/pages/akademik/SetupTp.tsx`: filter pencarian mapel + status (sudah/belum ada TP) di pemilih mapel×tingkatan.
- `src/pages/admin/Mapel.tsx`: kotak pencarian daftar mapel.
- `src/pages/admin/TahunAjaran.tsx` (Data Sekolah): UI dirapikan — section berikon, label wajib, layout 2 kolom, sticky tombol simpan di mobile, indikator jumlah DPL terpilih. Tidak mengikuti layout v2 secara ketat.

## Belum dirilis — Impor TP (JSON kurikulum → tp_kktp)

- `src/lib/tpImport.ts` (baru): parser murni untuk dua format — ekspor kurikulum (`tp[]` + `subjectKey`) dan format sistem (`items[]`). Mapel dinormalisasi ke nama resmi MAPEL_BAWAAN; `className` 5A → tingkatan `5`; `materiBuku` diabaikan; nomor TP diulang 1..n per mapel bila order sumber tidak berurutan.
- `src/lib/akademik.ts`: `importTPBatch` (mode `tambah` / `ganti`) memakai writeBatch; tidak menyentuh `semester`/`bobotMapel`.
- `src/pages/akademik/SetupTp.tsx`: panel **Impor JSON** di hub mapel×tingkatan dan di halaman detail mapel (filter otomatis ke pasangan aktif). Pratinjau ringkasan + peringatan sebelum tulis.
- `docs/tp-import-kelas5-faseC.json`: contoh siap impor (127 TP kelas 5 fase C) dari `tujuan-pembelajaran-20261013.json`. Deskripsi level KKTP masih kosong — guru melengkapi di Setup TP.

## Belum dirilis — Template Excel TP (ekspor + impor)

- `src/lib/tpImport.ts`: template Excel resmi (`TP_EXCEL_HEADERS`), `parseTpExcelRows`, `bacaExcelTp`, `buatExcelTp`, `unduhBlob`. Sheet "Petunjuk" menjelaskan kolom wajib. Baris contoh (`Contoh:…`) diabaikan saat impor. Nomor TP kosong diisi otomatis per mapel×tingkatan.
- `src/pages/akademik/SetupTp.tsx`: panel **Impor / Ekspor** — unduh template kosong, ekspor TP saat ini (detail mapel), unggah `.xlsx`/`.xls` atau JSON. Mode tambah/ganti tetap.

## Belum dirilis — TP per kelas paralel + template Excel KKTP

- **Skema**: `tp_kktp` sekarang per **mapel × kelas** (5A ≠ 5B). Field `kelas` wajib; `tingkatan` turunan. Mencegah guru rombel lain memakai TP tanpa menyusun sendiri.
- `getTPList`/`saveTP`/`importTPBatch`, Setup TP, Bobot Semester, Nilai SLM/STS/SAS, Laporan SLM, dashboard progres: memakai kelas.
- Template Excel: kolom `kelas` + deskripsi level KKTP (boleh kosong saat impor). UI filter Setup TP dirapikan (chip satu baris).
- Indeks Firestore: `tp_kktp` mapel+kelas. Deploy: `npm run deploy:rules`.

## Belum dirilis — Alokasi TP multi-semester + bobot live

- **Masalah**: TP hanya bisa masuk Semester 1 ATAU 2; praktik di lapangan ada TP yang dipakai di kedua semester. Total bobot per semester tidak mudah dipantau secara live.
- **Model data** (`types/akademik.ts`): field baru `bobotPerSemester?: { '1'?: number; '2'?: number }`. Key yang ada = TP dialokasikan ke semester itu (boleh keduanya, bobot berbeda). Field legacy `semester` + `bobotMapel` tetap ditulis sebagai fallback.
- **Rumus** (`akademikRumus.ts`): `tpMasukSemester` membaca `bobotPerSemester` dulu; helper baru `bobotTpDiSemester` dan `normalisasiAlokasiTp`. Uji di `scripts/cek-rumus-akademik.mjs` lolos.
- **Simpan** (`saveBobotSemesterBatch`): menulis `bobotPerSemester` + legacy `semester`/`bobotMapel` (primer = Sem 1 jika ada). TP tanpa alokasi → hapus ketiga field.
- **UI Bobot Semester**: checkbox per semester per TP (boleh centang keduanya), input bobot per semester, ringkasan live (progress bar + sisa/% kelebihan) di atas halaman, badge "Dipakai di kedua semester", tombol ratakan per semester.
- **Konsumen**: Nilai SLM, Laporan SLM, Setup TP memakai `bobotTpDiSemester` / `normalisasiAlokasiTp` agar bobot yang ditampilkan sesuai semester aktif.

## Belum dirilis — UI/UX Nilai STS & SAS (fokus guru senior)

- `src/pages/akademik/NilaiStsSas.tsx` dirombak untuk kenyamanan guru 50+:
  - Label lengkap: **Ujian Tengah (STS)** / **Ujian Akhir (SAS)** — bukan singkatan saja.
  - Cakupan diganti bahasa sehari-hari: **Pilih materi yang diujikan**; tombol Centang semua / Kosongkan; kartu checkbox besar.
  - Default: jika belum pernah atur cakupan, semua TP semester aktif sudah dicentang (guru hanya uncentang yang tidak diujikan).
  - Isi nilai: **satu materi fokus** (chip pilih materi), input besar (h-12 / h-14, font 17–18px), progress bar terisi, warna baris sudah/belum.
  - **Enter** = siswa berikutnya; di baris terakhir Enter = simpan.
  - Sticky tombol Simpan di bawah layar (mobile & desktop).
  - Halaman memakai lebar penuh (`HALAMAN_LEBAR`).
- `src/components/Layout.tsx`: `/akademik/nilai-sts` masuk daftar halaman lebar.
- `src/pages/AkademikHub.tsx`: deskripsi kartu STS/SAS diperjelas.

## Belum dirilis — Nilai STS/SAS: layout spreadsheet 1 tabel

- `NilaiStsSas.tsx`: diganti layout **satu tabel** (baris = siswa, kolom = materi yang dicentang) menggantikan daftar bertumpuk per TP.
- Panel kanan (desktop) / atas (mobile): centang materi diujikan, bisa **Tampilkan / Sembunyikan**.
- Tombol **Simpan** selalu tersedia: di bawah panel materi saat panel terbuka, atau sticky di bawah layar saat panel disembunyikan. Menyimpan semua perubahan di semua kolom sekaligus.
- Navigasi sel: Enter / panah kanan-kiri-atas-bawah.
- Default cakupan: semua TP semester aktif dicentang jika belum pernah disimpan.

## Belum dirilis — Nilai SLM: layout spreadsheet sama seperti STS/SAS

- `NilaiSlm.tsx`: diganti **satu tabel** (siswa × materi semester), panel kanan tampil/sembunyi kolom, simpan semua perubahan sekaligus, navigasi panah/Enter, kolom rata-rata tertimbang live, badge level KKTP per sel.
- `/akademik/nilai-slm` masuk HALAMAN_LEBAR.
- SAS sudah memakai layout spreadsheet yang sama di `NilaiStsSas.tsx` (toggle Ujian Akhir).

## Belum dirilis — Guard nilai belum disimpan + cache lokal draf

- `src/lib/nilaiDraftCache.ts` (baru): simpan/baca/hapus draf nilai di localStorage per mapel×kelas×semester×tahun×jenis (slm/sts/sas).
- `src/lib/useUnsavedGuard.ts` (baru): konfirmasi sebelum keluar jika ada perubahan — beforeunload (tutup tab/refresh), klik menu/back link, tombol back browser.
- `NilaiSlm.tsx` & `NilaiStsSas.tsx`: menulis draf lokal (debounce 400ms) saat ada perubahan; memulihkan draf saat buka ulang; menghapus cache setelah simpan sukses; dialog "Nilai belum disimpan".

## Belum dirilis — Salin TP+KKTP+bobot ke kelas paralel + konfirmasi Excel

- `src/lib/akademik.ts`: fungsi baru `salinTPKeKelas` — salin seluruh TP + levels (KKTP) dari satu kelas paralel ke kelas setingkat lain. Mode `tambah`/`ganti`. Opsi `termasukBobot` (default true) menyalin `bobotPerSemester` + field legacy. Nilai siswa tidak disalin. Kelas beda tingkatan otomatis ditolak.
- `src/pages/akademik/SetupTp.tsx`: panel **Salin ke kelas lain** (hanya muncul bila ada kelas paralel setingkat di penugasan). Centang kelas tujuan, mode tambah/ganti, opsi sertakan bobot. Konfirmasi sebelum menulis.
- Excel impor/ekspor template TP+KKTP sudah tersedia sebelumnya di Setup TP (template kosong, ekspor TP saat ini, unggah .xlsx/.json) untuk guru kelas maupun guru bidang studi — tidak diubah dalam patch ini.

## Belum dirilis — Ekspor nilai Tahsin-Tahfizh

- Halaman baru `/tahsin/ekspor`: unduh semua setoran dan catatan menulis satu kelas ke Excel (.xlsx).
- **Guru Tahsin**: kelas ampu saja. **Admin**: memilih kelas yang akan diekspor.
- File berisi sheet Setoran (periode aktif), sheet Menulis, dan sheet Info.
- `src/lib/eksporNilaiTahsin.ts` (baru): penyusunan baris + pembuatan Excel. Hanya membaca Firestore.
- Menu di TahsinHub; ikon `download` di `Icon.tsx`.

## Belum dirilis — Perbaikan generate TP/KKTP (Gemini 404)

- **Gejala (21 Okt 2026)**: generate TP dan KKTP gagal dengan pesan `Gemini (gemini-1.5-flash) 404: models/gemini-1.5-flash is not found ...`.
- **Penyebab**: ketiga model di `functions/generateAi.js` sudah dimatikan Google — `gemini-1.5-flash` (lama), `gemini-2.0-flash` (1 Jun 2026), `gemini-2.5-flash` (16 Okt 2026). Semua balas 404. Pesan hanya menampilkan model TERAKHIR yang dicoba, sehingga tampak seolah hanya 1.5 yang bermasalah.
- `functions/generateAi.js`: daftar model dipusatkan di `MODEL_GEMINI` = `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.1-flash-lite` (dipakai teks dan vision). Pengaturan berpikir: `thinkingBudget: 0` untuk 2.5, `thinkingLevel: 'low'` untuk 3.x (berpikir aktif secara bawaan di 3.x dan ikut memakan `maxOutputTokens`); jalur vision (generate aset) kini ikut memakainya. Pesan galat gabungan menyebut semua model yang gagal.
- **Perlu di-deploy**: `firebase deploy --only functions`. Kunci `GEMINI_API_KEY` tidak berubah.

## Belum dirilis — Kokurikuler: AI merancang proyek STEM hanya dari keterangan aktivitas

- **Masalah**: tab AI di Proyek STEM menolak berjalan bila kurang dari 3 DPL berstatus aktif, dan DPL baku (`pastikanDplBaku`) dibuat nonaktif dengan deskripsi level kosong, sehingga wali kelas harus menyiapkan DPL lebih dulu. Rubrik hasil AI hanya berisi nama aspek; deskripsi 4 rentang nilai kosong.
- `functions/generateAi.js` (`susunPromptStem`, `normalisasiStem`): AI memilih 3 DPL dari SEMUA DPL kelas (aktif atau belum), mapel+TP dari katalog kelas (minimal 2 mapel berbeda, kini sampai 200 TP), dan menyusun `rubrik` (4–6 aspek, masing-masing dengan 4 deskripsi untuk rentang 0–60, 61–75, 76–85, 86–100). Untuk DPL terpilih yang bank deskripsi levelnya kosong, AI mengusulkan `dplLevel` (4 kalimat umum, bukan topik proyek). Prompt melarang judul bergaya julukan/slogan/persona. Semua id tetap divalidasi terhadap katalog; `dplLevel` dibuang bila DPL tidak terpilih atau bank-nya sudah terisi; `mapel` rubrik yang bukan mapel terlibat dikosongkan.
- `functions/index.js`: meneruskan `dplKosongIds` ke normalisasi, pesan galat diperbarui, log mencatat jumlah rubrik dan dplLevel.
- `src/lib/generateAi.ts`: tipe `KatalogDplStem.levelDeskripsi`, `RubrikAiStem`, `DplLevelAiStem`, dan `HasilStemAi.rubrik/dplLevel`.
- `src/pages/akademik/Kokurikuler.tsx`: AI tidak lagi mensyaratkan DPL aktif. Hasil AI mengisi rubrik berdeskripsi. Saat proyek disimpan, DPL terpilih otomatis diaktifkan dan level yang kosong diisi dari usulan AI (level yang sudah terisi tidak ditimpa). Pilihan DPL di tab Tujuan menampilkan DPL aktif dan DPL terpilih yang belum aktif. Proyek baru dibuka di tab AI. Pesan TP kurang menyebut mapel yang belum punya TP.
- Akses AI tidak berubah: tetap hanya UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1` + email `arif.azwar79@gmail.com`.
- **Perlu di-deploy**: `npm run deploy:functions` dan `npm run deploy` (hosting). Tidak ada perubahan `firestore.rules`.

## Belum dirilis — Kokurikuler: 7KAIH menjadi daftar nilai 4 level, tanpa DPL

- **Masalah**: 7KAIH dibuat per siswa dengan catatan teks dan wajib menautkan tiap kebiasaan ke satu DPL (dan tab diblokir bila belum ada DPL aktif). Tautan itu tidak bermakna (mis. tidur cepat tidak mewakili dimensi profil mana pun) dan isiannya lambat.
- `src/types/kokurikuler.ts`: `CatatanKebiasaan` kini `{ level: 1–4 | null }`; `catatan` dan `dplId` jadi opsional (data lama). Konstanta `LEVEL_7KAIH_LABEL` (= 4 label skala DPL: Belum Terlihat, Mulai Terlihat, Berkembang Sesuai Harapan, Sangat Berkembang).
- `src/lib/kokurikuler.ts`: `normalisasiKebiasaan` membaca `level`; `catatan`/`dplId` lama dipertahankan bila ada. `simpanG7kaihBanyak` (baru): simpan banyak siswa sekaligus dalam batch.
- `src/pages/akademik/Kokurikuler.tsx` (tab 7KAIH): diganti tabel — baris siswa, kolom 7 kebiasaan, sel pilihan level 1–4 (kosong diperbolehkan; Bangun Pagi, Makan Sehat, Tidur Cepat ditandai boleh kosong). Ada "isi kosong…" per kolom (hanya mengisi sel yang masih kosong), penanda baris berubah, hitungan terisi per siswa, dan satu tombol simpan yang hanya menulis baris yang berubah. Tab tidak lagi bergantung pada DPL. Admin tetap hanya melihat.
- Tidak ada perubahan `firestore.rules` (isi `kebiasaan` tidak divalidasi di rules). Dokumen lama tetap terbaca; levelnya kosong sampai diisi.
- **Perlu di-deploy**: hosting saja (`npm run deploy`).

## Belum dirilis — Perbaikan tampilan tabel 7KAIH

- `src/pages/akademik/Kokurikuler.tsx` (tab 7KAIH): kontrol di header kolom sebelumnya tidak sejajar (kolom bertanda "boleh kosong" turun satu baris) dan lebarnya tidak seragam. Kini tiap kolom berlebar tetap, label diberi tinggi tetap, baris keterangan selalu ada, dan kontrol serta sel isian dipusatkan pada sumbu yang sama.
- Menu header diganti dari "isi kosong…" menjadi "Atur semua…": **Semua 1–4 menimpa seluruh isian kolom**, dan **Kosongkan** menghapus seluruh isian kolom. Sebelumnya hanya sel kosong yang terisi, sehingga bila semua sel sudah terisi, pilihan apa pun tidak mengubah apa-apa dan tidak ada cara menghapus massal. Hanya siswa yang nilainya berubah yang ditandai berubah; "Batalkan perubahan" mengembalikan ke data tersimpan.
- Perlu di-deploy: hosting saja.

## Belum dirilis (basis: package.json 0.1.0) — Tahsin-Tahfizh: Catat Menulis

- **Konsep penilaian** (disepakati 23 Okt 2026, hasil kajian literatur kitabah/imla' dan khat): satu konteks tugas (Salin / Dikte / Dari hafalan) + **tiga aspek inti** skala 1-4 yang masuk rata-rata: Huruf & Sambungan (`hurufSambungan`), Harakat & Tanda Baca (`harakat`), Kelengkapan Teks (`keutuhanTeks`). **Kerapian** (`kerapian`) menjadi aspek pelengkap opsional dan tidak lagi masuk rata-rata (di v2 ikut dirata-rata). Kesalahan umum sekali ketuk bersifat opsional. Sengaja tidak dinilai: insya', nahwu/sharaf, detail rasm, kecepatan, sikap, tajwid/makhraj.
- `src/pages/tahsin/CatatMenulis.tsx` (baru), rute `/tahsin/menulis`, menu "Catat Menulis" di TahsinHub (hanya guru Tahsin; admin memantau). Semua aspek diawali "3 Baik" agar guru hanya mengubah yang menyimpang; indikator tiap level tampil di bawah kontrol dan sebagai tabel "Panduan skor"; materi diisi dari catatan terakhir siswa; Simpan & berikutnya; Ctrl+Enter; bilah simpan selalu terlihat. Catatan sebelumnya dapat dihapus oleh pembuatnya.
- `src/lib/menulis.ts` (baru, logika murni): indikator rubrik, `rataInti`, `levelDariRata`, `bangunPenilaian`, `bangunKesalahan`, `ringkasMenulis` (rata-rata per aspek, tren ±0.3, kesalahan terbanyak, hanya periode terpilih). `src/types/tahsin.ts`: `JenisTugasMenulis`, `KesalahanMenulis`, `PenilaianMenulis`, `MenulisPayload`; `MenulisRecord` bertipe lebih jelas. `src/lib/tahsinData.ts`: `saveMenulis`, `deleteMenulis`.
- **Perubahan perilaku laporan** (`src/lib/tahsinLaporanRumus.ts`): `rataMenulis` kini rata-rata tiga aspek inti; catatan v2 empat aspek dihitung tanpa Kerapian (contoh 4,3,4,3 sebelumnya 3,5 kini 3,7). Narasi dan "Capaian Terakhir" memakai rata-rata untuk semua catatan yang punya skor (sebelumnya hanya materi Al-Qur'an) dan menyebut "menulis" (bukan "menyalin"); log memuat jenis tugas. Uji `scripts/cek-laporan-cetak.mjs` disesuaikan.
- `src/pages/tahsin/RiwayatSiswa.tsx`: tab Menulis menampilkan jenis tugas, skor tiap aspek, rata-rata, dan kesalahan umum; tab Ringkasan memuat rata-rata Menulis periode ini. `src/lib/eksporNilaiTahsin.ts`: sheet Menulis ditambah kolom jenis tugas, tiga aspek, rata-rata, Kerapian, kesalahan umum.
- `scripts/cek-menulis.mts` (baru). `docs/DATA_MODEL.md` dan `docs/PARITAS_FITUR.md` diperbarui.
- Tidak ada perubahan `firestore.rules` maupun indeks: rules `menulis_log` tidak membatasi daftar field. Perlu di-deploy: hosting saja (`npm run deploy`).
- Catatan: `scripts/cek-laporan-cetak.mjs` sudah memiliki 3 uji GAGAL terkait bobot STS (`bobot STS: pakai bobot semester`, `bobot STS: legacy bobotMapel`, `STS mapel tertimbang 60/40 = 74`) sebelum perubahan ini; tidak diubah di sini.

## Belum dirilis (basis: package.json 0.1.0) — Laporan Tahsin-Tahfizh: bagian Menulis selaras dengan Catat Menulis

- **Masalah**: narasi dan "Capaian Terakhir" memakai skor dari SATU catatan terbaru, padahal kalimatnya menyebut "rata-rata penilaian menulis". Rincian per aspek dan kesalahan umum dari Catat Menulis juga belum tampil di laporan.
- `src/lib/tahsinLaporanRumus.ts`: `susunLaporanSiswa` kini menghitung rata-rata seluruh catatan menulis dalam rentang tanggal laporan (`ringkasMenulis`). `narasiMenulis` memakai rata-rata itu (posisi menulis tetap dari catatan terbaru) dan menambahkan satu kalimat tren (lebih baik / sedikit di bawah sebelumnya). Fungsi baru `kalimatLatihan` ("Bagian yang perlu terus dilatih: …", maksimal dua kesalahan umum terbanyak). `LaporanSiswa.menulis` bertambah `aspek[]`, `rata`, `latihan`.
- `src/lib/tahsinLaporanHtml.ts`: bagian 3 menampilkan empat kotak (Rata-rata Periode + tiga aspek inti) menggantikan "Capaian Terakhir" dan "Kali Diperiksa" (jumlah pemeriksaan tetap disebut di narasi), sehingga tinggi halaman tidak bertambah. Tanpa skor (mis. catatan v2 tanpa penilaian) tampilan lama dipertahankan. Judul siswa Iqro menjadi "3. Menulis (Iqro)", siswa Al-Qur'an tetap "3. Menulis Al-Qur'an".
- `src/lib/menulis.ts`: perbaikan tren. Selisih rata-rata sekarang dibulatkan satu desimal sebelum dibandingkan dengan ambang 0,3 (sebelumnya 3,3 vs 3,0 terhitung 0,2999… dan dibaca "tetap").
- Uji: `scripts/cek-laporan-cetak.mjs` (10 uji baru: rata-rata rentang bukan catatan terakhir, level, tren, aspek, kalimat latihan, log, HTML, judul Iqro, tampilan tanpa skor) dan `scripts/cek-menulis.mts` (uji ambang tren). Tiga uji GAGAL bobot STS yang sudah ada sebelumnya tidak diubah.
- Tampilan cetak A4 diperiksa lewat wkhtmltoimage (mesin lama), bukan peramban sungguhan: sebaiknya cetak satu laporan penuh dari situs untuk memastikan tetap satu halaman. Perlu di-deploy: hosting saja.

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan: hasil impor Excel / tempel nilai STS & SAS hilang dari tabel

- **Gejala (dilaporkan guru, termasuk kelas 4A)**: impor Excel memakai template dari aplikasi tampak berhasil (muncul pesan "N nilai dimuat ke draf"), tetapi tabel tetap kosong dan tombol Simpan menunjukkan "Tidak ada perubahan". Hanya halaman **STS/SAS**; halaman **SLM tidak terkena**.
- **Penyebab**: di `src/pages/akademik/NilaiStsSas.tsx`, objek `config` dibuat baru di setiap render dan menjadi dependensi efek sinkron draf pada `<Detail>`. Pesan (toast) mengubah state induk, induk render ulang, efek berjalan lagi sebelum cache lokal sempat tertulis (jeda 400 ms), lalu mengembalikan draf ke nilai server. Hasil impor dan tempel (Ctrl+V) ikut terhapus. Ketik manual tidak terkena karena tidak memicu toast.
- `src/pages/akademik/NilaiStsSas.tsx`: `config` dibungkus `useMemo` (dependensi `periodeAk.ready`, `.semester`, `.tahunAjaran`). Tidak ada logika lain yang diubah; `NilaiSlm.tsx` tidak disentuh.
- `src/lib/nilaiImportExport.ts` (`parseNilaiExcelRows`): peringatan "N baris siswa tidak cocok" dan "Kolom tidak dikenali" kini berada di urutan pertama (`unshift`), karena halaman input hanya menampilkan dua peringatan pertama di toast; sebelumnya impor yang sebagian siswanya tidak cocok tampak sukses penuh. Isi pesan, pencocokan siswa/kolom, dan nilai yang diimpor tidak berubah.
- `scripts/cek-nilai-import.mts` (baru): `npx tsx scripts/cek-nilai-import.mts`. Menguji pencocokan NIS/nama, sel kosong tidak mengubah, koma desimal, urutan peringatan (gagal pada kode lama, lulus pada kode baru).
- Diperiksa: `npm run build` lolos; hasil semua skrip `scripts/cek-*` identik sebelum dan sesudah perubahan (kegagalan yang sudah ada tidak diubah: `cek-laporan-cetak.mjs`, `cek-rapor-sas.mjs`, `cek-generate-ai.mjs`, `cek-setup-tp.mjs`, `cek-akun-guru.mjs`).
- **Catatan**: perbaikan efek diverifikasi lewat replika komponen (pola efek + toast yang sama), bukan lewat peramban pada halaman asli. Setelah deploy, uji: impor template di STS, pastikan nilai tetap tampil di tabel dan tombol Simpan berisi jumlah perubahan.
- Perlu di-deploy: hosting saja (`npm run deploy`). Tidak ada perubahan `firestore.rules`.

## Belum dirilis — Tanda tangan digital Rapor STS + layout Profil

- **Tujuan**: STS sering dibagikan online; cetak perlu gambar tanda tangan guru (wali) dan kepala sekolah, bukan hanya ruang kosong untuk TTD basah. SAS tetap offline / tidak memaksa gambar.
- `src/lib/tandaTangan.ts` (baru): kompres gambar di klien (max ~480 px, <280 KB), unggah ke Firebase Storage, simpan download URL di Firestore.
  - Kepsek: path `tanda-tangan/kepsek.png` → `config/akademik.ttdKepsekUrl` (hanya admin).
  - Guru: path `tanda-tangan/guru/{uid}.png` → `users/{uid}.ttdUrl` (pemilik akun).
- `src/types/akademik.ts`: field opsional `ttdKepsekUrl`.
- `src/types/user.ts`: field opsional `ttdUrl`.
- `src/lib/akunGuruData.ts`: `dariDokumen` membaca `ttdUrl`.
- `src/lib/penandatangan.ts`: `cariWaliKelasLengkap` mengembalikan `{ nama, ttdUrl? }` (satu wali → TTD-nya; beberapa wali → nama digabung, TTD kosong).
- `src/lib/raporHtml.ts` / `raporSts.ts`: `DataRaporSts` menambah `ttdWaliUrl` / `ttdKepsekUrl`; blok tanda tangan STS menjadi **tiga kolom** (Ortu | Wali Kelas | Kepala Sekolah) dengan `<img class="rpr-ttd-img">` bila URL ada; kosong = ruang TTD basah seperti sebelumnya.
- `src/pages/ProfilSaya.tsx`: UI unggah/ganti/hapus TTD sendiri (staf).
- `src/pages/admin/TahunAjaran.tsx`: UI unggah/ganti/hapus TTD kepala sekolah di bagian Data Sekolah.
- `src/pages/akademik/Rapor.tsx`: memuat `ttdWaliUrl` lewat `cariWaliKelasLengkap` dan meneruskannya ke `muatDataRaporSts` / cetak kelas.
- `firestore.rules`: self-update `users/{uid}` boleh menyentuh `ttdUrl` (selain `nama`, `gelar`, `updatedAt`).
- `storage.rules` (baru) + `firebase.json`: Storage production; baca TTD untuk user login; tulis kepsek admin; tulis guru hanya path sendiri. CSP Report-Only: `img-src` menambah `https://*.firebasestorage.app` dan `https://firebasestorage.googleapis.com`.
- **Layout Profil**: `Layout.tsx` mengosongkan `HALAMAN_SEMPIT` (sebelumnya `/profil` → `max-w-xl`); `ProfilSaya` memakai `space-y-5` + grid `lg:grid-cols-2` agar tidak kolom sempit di tengah layar.
- **Perbaikan build**: `src/lib/akademik.ts` dan `src/lib/aksesAkademik.ts` membersihkan marker merge conflict (`<<<<<<<` / `PLACEHOLDER`) yang sempat ter-commit dan memblokir `tsc`.
- **Prasyarat**: aktifkan Firebase Storage (production mode; lokasi usahakan `asia-southeast2` bila tersedia), lalu `firebase deploy --only firestore:rules,storage` sebelum hosting.
- Perlu di-deploy: `firestore:rules`, `storage`, hosting. Tidak ada Cloud Functions baru.

## Belum dirilis — Stempel sekolah, NBM guru, perbaikan load profil & layout TTD

- **Stempel sekolah** (`config/akademik.stempelUrl`, Storage `tanda-tangan/stempel.png`): unggah di Admin → Data Sekolah. Di cetak STS, stempel menumpuk dengan TTD kepsek (TTD di depan / `z-index` lebih tinggi; stempel digeser sedikit ke kiri).
- **Kompresi**: TTD tetap PNG transparan; **stempel dikomposit ke latar putih** (`kompresStempel`) — mesin cetak sering menghitamkan piksel alpha. Jangan fallback JPEG.
- **Storage rules**: path guru adalah `tanda-tangan/guru/{uid}.png` — match rules harus `fileName == request.auth.uid + '.png'` (bukan `{uid}` saja, itu menyebabkan 403).
- **`fetchUserProfile` (`auth.ts`)**: wajib memetakan `ttdUrl` dan `nbm`. Tanpa ini unggah/simpan tampak sukses tetapi hilang setelah refresh.
- **Rules self-update users**: allowlist `nama`, `gelar`, `nbm`, `ttdUrl`, `updatedAt`.
- **NBM wali** di rapor STS dari `users.nbm` (isi di Profil Saya); tipe `DataRaporSts.waliNbm` + wiring `raporSts` / `Rapor.tsx` / `penandatangan`.
- **Layout tanda tangan STS**: tempat+tanggal hanya di kolom Kepala Sekolah (jarak sebelum jabatan); tinggi ruang TTD seragam agar nama sejajar; ukuran TTD ~60pt.
- **Pratinjau iframe**: `sandbox="allow-same-origin allow-scripts"` — hilangkan peringatan `about:srcdoc` (konten HTML aplikasi sendiri).
- **Layout Profil**: lebar penuh + grid kartu (bukan `max-w-md` / `HALAMAN_SEMPIT`).
- Perlu di-deploy: `firestore:rules`, `storage`, hosting. Setelah ubah kompresi stempel, **unggah ulang** file stempel di Storage.

## Belum dirilis — Hapus nilai SLM / STS / SAS yang dikosongkan

- **Bug**: nilai yang sudah diisi tidak bisa dihapus (sel dikosongkan lalu Simpan tidak mengubah apa pun). Menyentuh guru bidang studi maupun wali kelas.
- **Penyebab**: (1) UI mengabaikan sel kosong di daftar perubahan; (2) `saveNilaiTPBatch` / `saveNilaiAsesmenBatch` hanya upsert; (3) rules `nilai_tp` / `nilai_sts` / `nilai_sas` `allow delete: if false`.
- **Perbaikan**:
  - `firestore.rules`: `allow delete` untuk guru yang punya `tulisMapelKelas` (admin tetap tidak menulis).
  - `src/lib/akademik.ts`: batch menerima `null` → hapus dokumen yang sudah ada.
  - `NilaiSlm.tsx` + `NilaiStsSas.tsx`: sel yang dikosongkan setelah ada nilai masuk daftar perubahan; ringkasan total/rata memakai nilai draf (kosong = null); pesan simpan membedakan disimpan vs dihapus.
- **Deploy wajib**: `npm run deploy:rules` lalu hosting (`npm run deploy`).

## Belum dirilis (basis: package.json 0.1.0) — Guru bidang studi PJOK/IPAS tidak bisa memuat nilai (spinner terus)

- **Bug**: halaman input STS/SAS/SLM milik guru bidang studi PJOK (dan berpotensi IPAS, PPKn, Seni Budaya) memuat tanpa akhir; nilai yang sudah diinput tidak tampil. Wali kelas tidak terkena.
- **Penyebab**: `getCakupanTP`, `getNilaiAsesmenKelas`, `getNilaiTPKelas`, `getNilaiTPUntukTP` (commit `0456102`, multi-nama alias mapel) menjalankan satu query per nama alias dengan `Promise.all`. Rules `nilai_tp` / `nilai_sts` / `nilai_sas` / `asesmen_cakupan` hanya mengizinkan baca untuk nama mapel yang persis ada di `penugasanKelasMapel` guru (wali kelas lolos lewat `waliKelas`). Nama alias lain ditolak `permission-denied`; satu penolakan menggagalkan seluruh `muat()`, `siap` tidak pernah `true`, spinner tidak berhenti.
- **Perbaikan** (`src/lib/akademik.ts`): helper `selesaikanAlias()` memakai `Promise.allSettled`. `permission-denied` pada nama alias dilewati selama ada nama lain yang berhasil dibaca; error lain tetap dilempar; bila semua nama ditolak, penolakan dilempar. Leger/wali kelas tetap membaca semua alias.
- **Tidak perlu** `deploy:rules`. Cukup `npm run deploy` (hosting).

## Belum dirilis — Salinan rapor STS resmi untuk portal orang tua

- **Beda format**: portal merata-ratakan `nilai_sts` (satu angka + predikat). Cetak rapor STS memakai nilai akhir berbobot cakupan, kalimat capaian KKTP, identitas sekolah, TTD wali, TTD + stempel kepala sekolah.
- Portal tidak bisa menghitung itu sendiri: `mapel`, `tp_kktp`, `asesmen_cakupan`, dan `config/akademik` hanya boleh dibaca guru.
- **Perbaikan** (`src/lib/stsPublikasi.ts`): `publikasikanSts` menulis dulu satu dokumen per siswa di `rapor_sts_ortu/{siswaId}_{tahun}_{semester}` lewat `muatDataRaporStsKelas` + `kalimatCapaian` (fungsi yang sama dengan cetak). Lalu gerbang `sts_publikasi` menyimpan `snapshotIds`. `batalkanPublikasiSts` menandai salinan `published: false`.
- `PublikasiSts.tsx` mengirim profil pemanggil, `kotaRapor`, dan `tglRaporSts` periode. TTD wali kelas diambil `cariWaliKelasLengkap` (admin tidak menaruh TTD-nya sendiri).
- `firestore.rules`: koleksi `rapor_sts_ortu` — baca terbuka (portal tanpa Auth), tulis admin atau wali kelas dokumen.
- **Deploy wajib**: `npm run deploy:rules` lalu hosting. Wali kelas harus menekan **Publikasikan** lagi; publikasi lama tidak berisi salinan.
- Rumus nilai tidak diubah.


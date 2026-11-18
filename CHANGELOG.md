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


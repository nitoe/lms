## 2026-11-17 — Pengumpulan tugas oleh siswa (foto) + tab «Pengumpulan» guru

- **Siswa:** di detail tugas, tombol «Ambil / pilih foto» (maks. 3 foto, dikecilkan otomatis di perangkat), catatan opsional, «Kumpulkan». Bisa «Kirim ulang» selama belum dinilai; setelah dinilai terkunci. Kartu tugas menampilkan lencana «Terkumpul».
- **Guru:** tab baru «Pengumpulan» di detail tugas: daftar siswa yang mengumpulkan (waktu, jumlah foto, tanda «Terlambat» bila lewat tenggat), foto dimuat saat baris dibuka.
- Koleksi baru **`lms_pengumpulan`** (meta) dan **`lms_pengumpulan_foto`** (foto terkompres). Foto disimpan di Firestore (bukan Storage); `storage.rules` tidak berubah.
- **WAJIB deploy `firestore.rules`** (versi lengkap di zip, salin juga ke SDM01Penilaian → `npm run deploy:rules`). Tanpa itu, siswa/guru melihat pesan «belum bisa dibuka/dikumpulkan» (aplikasi tidak rusak).
- File: `firestore.rules`, `src/lib/pengumpulan.ts` (baru), `src/pages/siswa/PengumpulanSiswa.tsx` (baru), `src/components/PengumpulanPanel.tsx` (baru), `src/pages/siswa/SiswaTugas.tsx`, `src/pages/TugasDetail.tsx`, `src/styles/siswa.css`, `src/styles/tugas.css`.
- Antiregresi: ANTIREGRESI.md §132.

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


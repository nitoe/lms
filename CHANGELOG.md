# CHANGELOG

> Append-only: entri baru ditambahkan di BAWAH, entri lama tidak diubah.
> Versi mengacu ke `package.json` (saat ini `0.1.0`); belum ada rilis bertag.

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

## 2026-11-09 — Fase 2 awal: tabel nilai per TP (mode cepat) + UI kuis siswa dasar

- Di detail kuis (guru): untuk jenis SLM/STS/SAS ditambahkan **tabel nilai akhir per TP** (mode cepat). Guru bisa langsung mengisi nilai tanpa analisis. Jika nanti ada analisis, hasil analisis yang diutamakan.
- Field baru: `nilaiPerTp`, `sumberNilai` ('manual' | 'analisis').
- Halaman siswa `/siswa/kuis`: daftar kuis aktif di kelas siswa + halaman pengerjaan dasar (navigasi soal, placeholder jawaban). Skoring lewat Cloud Function menyusul.
- File: `src/components/KuisDetail.tsx`, `src/types/kuis.ts`, `src/pages/siswa/SiswaKuis.tsx`, `src/App.tsx`.
- ANTIREGRESI §70.

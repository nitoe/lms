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

## 2026-11-12 — Input sebaran kompetensi manual (try out di luar LMS)

- Tab mapel punya tombol **+ Input sebaran kompetensi manual**: poin maksimum per kompetensi sekali, poin tiap siswa; nilai akhir dihitung otomatis (boleh ditimpa); tersimpan sebagai nilai manual + `sebaran[mapel]`. MTK = L1, L2 + 3 materi; BI = L1–L3; IPA = L1–L3 + 2 domain. Validasi lengkap; satu baris salah → tidak ada yang disimpan. Siswa bernilai otomatis LMS tidak ditampilkan.
- File: `src/pages/tka/TkaSebaranManual.tsx`, `src/pages/tka/TkaRekapMapel.tsx`, `src/lib/sebaranTka.ts`, `src/lib/rekapTka.ts`.

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

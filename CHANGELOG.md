## 2026-11-12 — Detail tugas (guru): UI v2

- **Hero:** aksen mapel (`--tg-a`), monogram, chip jenis/kelas/status/penilaian, tenggat relatif (selaras katalog `tg-*`).
- **Tab utama:** tiga tab berhint (Pengaturan · Isi tugas · Input nilai) dengan state aktif beraksen.
- **Form kartu (`.td-*`):** identitas, mapel & TP, instruksi, kategori rubrik, rentang predikat — hierarki jelas; tombol memakai `.tg-btn`.
- **Daftar nilai:** toolbar, tabel kompak, input skor, tombol AI per baris, empty/skeleton.
- Build: hapus import/fungsi tak terpakai (`formatTenggat`, helper kategori lama); kolom siswa hanya `siswaNama` (tipe `BarisNilaiTugas` tanpa `nisn`).
- **Lebar & sub-tab:** `.td-form` tanpa `max-width` (hilangkan ruang kosong kanan); sub-tab nilai (Pengaturan penilaian / Daftar nilai) diperbesar selebar konten dengan hint, setinggi tab utama.
- **Daftar nilai responsif:** header kategori boleh patah baris tanpa mengubah `display` sel tabel; kolom siswa sticky; scroll horizontal bila perlu. (Perbaikan regresi: jangan `-webkit-line-clamp` pada `<th>`.)
- Tidak mengubah logika data (`lib/tugas.ts`, `nilaiTugas`, `penilaianTugas`), route, data model, maupun `firestore.rules`.
- File: `src/pages/TugasDetail.tsx`, `src/styles/tugas.css` (lanjutan katalog).

## 2026-11-12 — Input sebaran kompetensi manual (try out di luar LMS)

- Tab mapel (Matematika / Bahasa Indonesia / IPA) punya tombol **+ Input sebaran kompetensi manual** untuk Try Out tahap mana pun yang dikerjakan di luar LMS.
- Grid input: **poin maksimum** tiap kompetensi diisi sekali (baris pertama), lalu **poin diperoleh** tiap siswa. Nilai akhir dihitung otomatis (poin ÷ maks × 100, dibulatkan) dan boleh ditimpa; tersimpan sebagai nilai manual beserta `sebaran[mapel]`.
- Kelompok yang diisi: MTK = L1, L2 + Bilangan, Geometri dan Pengukuran, Data; BI = L1–L3 (tipe materi diturunkan); IPA = L1–L3 + Pengetahuan IPA, Keterampilan Proses Sains.
- Validasi: semua kompetensi wajib terisi, poin ≤ maks, dan jumlah poin kompetensi dasar harus sama dengan kompetensi materi. Bila ada baris salah, tidak ada yang disimpan.
- Siswa yang nilainya otomatis dari kuis LMS tidak ditampilkan (sebarannya sudah dari jawaban). Data yang sudah ada (mis. import Try Out I) ter-prefill dan bisa dikoreksi.
- `simpanNilaiManualTka` menerima `sebaran`; tanpa `sebaran` perilaku lama (sebaran dibuang jika nilai berubah) tetap.
- File: `src/pages/tka/TkaSebaranManual.tsx` (baru), `src/pages/tka/TkaRekapMapel.tsx`, `src/lib/sebaranTka.ts`, `src/lib/rekapTka.ts`, `src/styles/tka.css`. Tanpa perubahan `firestore.rules`.


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

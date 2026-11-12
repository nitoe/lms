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

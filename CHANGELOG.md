## 2026-11-17 — Lomba: kartu menu Lomba di dashboard (Beranda) siswa

- **Gejala:** Siswa yang sudah didaftarkan ikut lomba tidak melihat menu Lomba di dashboard akun siswa.
- **Akar:** Beranda siswa memakai daftar kartu sendiri yang tidak memuat Lomba (menu hanya ada di nav), dan pengecekan keterdaftaran di nav menelan galat tanpa jejak.
- **Perbaikan:** hook bersama `useLombaSiswa` (nav + Beranda); kartu «Lomba» tampil di Beranda bagi peserta; galat query dicatat di konsol (§Lomba.20).
- File: `src/pages/siswa/useLombaSiswa.ts` (baru), `src/pages/siswa/SiswaBeranda.tsx`, `src/pages/siswa/SiswaLayout.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md`.

## 2026-11-17 — Lomba: perbaiki «Missing or insufficient permissions» saat menyimpan kuis + draf lokal wizard

- **Gejala:** Kuis Lomba tidak dapat disimpan («Missing or insufficient permissions.») berulang kali, walau login `arif.nitoe@gmail.com`; kemajuan susunan kuis hilang saat halaman di-reload.
- **Akar (rules):**
  1. Update `lms_kuis`/`lms_materi`/`lms_tugas` milik Lomba ditolak: dokumen berisi `kelasList: ['LB']`, sehingga aturan `lmsKelasListBoleh` (butuh penugasan per kelas) selalu dijalankan dan gagal (§Lomba.17).
  2. Perbaikan sebelumnya (email admin, cabang Lomba-first) hanya tercatat di CHANGELOG/ANTIREGRESI; `firestore.rules` di repo belum memuatnya dan rules belum tentu dideploy.
- **Perbaikan `firestore.rules`:** `lombaKelasListSah()`; `isAdminLmsEmail()` + `lombaAdmin()` (scoped Lomba, `isAdmin()` global tidak berubah); cabang baca Lomba tanpa syarat `isGuru()`; `lombaKontenBoleh` kini cek `akunAktif()`; cabang create Lomba didahulukan.
- **Fitur baru:** Draf lokal wizard «Susun kuis» (`src/lib/kuisDraf.ts`) — autosave ke localStorage, banner «Lanjutkan / Buang draf», bertahan saat hard reload dan saat simpan gagal (§Lomba.18). Pesan galat `permission-denied` kini menjelaskan langkah deploy rules.
- **Wajib:** salin `firestore.rules` UTUH ke repo SDM01Penilaian, lalu `npm run deploy:rules` (deploy Hosting saja tidak cukup).
- File: `firestore.rules`, `src/lib/kuisDraf.ts` (baru), `src/components/KuisPanel.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.17–19).

## 2026-11-17 — Lomba: rules isAdmin selaras email admin LMS (perbaiki simpan kuis)

- **Gejala:** Admin LMS (`arif.nitoe@gmail.com`) bisa membuka paket/bank Lomba dan menyusun pratinjau kuis Gabungan, tetapi **simpan** gagal «Missing or insufficient permissions.»
- **Akar:** UI (`adalahAdminLms`) menganggap akun admin jika `role == 'admin'` **atau** email = `arif.nitoe@gmail.com`. Rules hanya `myRole() == 'admin'`. Jika dokumen `users/{uid}` belum / tidak ber-role `admin`, `isAdmin()` dan `lombaKontenBoleh` di rules gagal → create `lms_kuis` (kelas `LB` + `lombaId`) ditolak.
- **Perbaikan rules:**
  1. `isAdminEmail()` — email token = `arif.nitoe@gmail.com` (selaras `EMAIL_ADMIN_LMS`).
  2. `isAdmin()` = `(akunAktif && role == admin) || isAdminEmail()`.
  3. Cabang create Lomba didahulukan pada `lms_kuis`, `lms_paket_soal`, `lms_materi` (mapel «Gabungan» tidak ada di penugasan).
- **Wajib:** `firebase deploy --only firestore:rules` (Hosting saja tidak cukup). Opsional: pastikan dokumen `users` akun ini punya `role: "admin"`.
- File: `firestore.rules`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.16).

## 2026-11-17 — Lomba: perbaiki permission simpan kuis (create lms_kuis)

- **Gejala:** Menyusun pratinjau kuis Lomba (termasuk mode Gabungan) berhasil, tetapi saat simpan muncul «Missing or insufficient permissions.»
- **Akar / tindakan:** Cabang create `lms_kuis` untuk konten Lomba (`kelas == 'LB'` + `lombaId` + `lombaKontenBoleh`) sudah ada; cabang Lomba **didahulukan** dalam ekspresi OR agar mapel «Gabungan» / non-penugasan jelas memakai path Lomba. **Wajib deploy firestore.rules** — deploy Hosting saja tidak cukup.
- File: `firestore.rules`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.15).

## 2026-11-17 — Lomba kuis gabungan: opsi 40/50 soal & pemilihan paket lintas mapel lebih jelas

- **Opsi jumlah soal:** preset penyusunan otomatis ditambah **40** dan **50** (sebelumnya maksimal chip 30). Batas absolut tetap `BATAS_SOAL_PER_KUIS` (100). Cocok untuk lomba yang memakai 30+ soal.
- **Pemilihan paket di mode Gabungan:**
  - Teks bantu menjelaskan bahwa saring Mapel hanya memudahkan memilih; **penyusunan memakai seluruh paket yang dicentang** (lintas mapel), bukan hanya yang tampil di saring aktif.
  - Tombol **«Pilih semua paket Siap»** (hanya mode Gabungan) mencentang semua paket Siap dari seluruh mapel lomba sekaligus, tanpa mempedulikan saring Mapel/Materi.
  - Ringkasan «Terpilih: Mapel A (n) · Mapel B (m)» di atas daftar paket, plus catatan bila saring mapel aktif bahwa centang tetap berlaku untuk penyusunan.
- Tidak mengubah query, penyimpanan, atau perilaku ruang kelas/TKA. Diverifikasi perubahan lokal pada `KuisPanel.tsx`.
- File: `src/components/KuisPanel.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.14).

## 2026-11-17 — Lomba: kuis gabungan lintas mapel (satu kuis berisi soal dari beberapa mapel)

- **Kebutuhan:** kuis Lomba tidak harus per mapel; satu kuis bisa memuat soal dari beberapa mapel sekaligus (tidak terpisah). Sebelumnya wizard hanya menampilkan paket dari **satu** mapel aktif.
- **Cara pakai:** Lomba → tab **Kuis** → pilih chip **«Gabungan (semua mapel)»** (muncul bila lomba punya ≥ 2 mapel terkait; hanya di tab Kuis) → **Buat kuis**. Di langkah «Pilih paket soal» tampil paket **Siap** dari semua mapel lomba, dengan label mapel pada tiap kartu, chip saring Mapel, dan pencarian yang ikut mencari nama mapel. Penyusunan (otomatis/AI/manual, filter bentuk & kompleksitas) memakai kumpulan soal dari seluruh paket terpilih, jadi satu kuis dapat berisi campuran mapel.
- **Penyimpanan:** kuis tersimpan dengan `mapel = 'Gabungan'` (`MAPEL_GABUNGAN_LOMBA`) + `lombaId`; asal tiap soal dicatat di `SoalKuis.sumberMapel` (untuk analisis per mapel nanti). **Tidak ada perubahan `firestore.rules`** (rules hanya mewajibkan `mapel` string 1–80 karakter) — cukup deploy Hosting.
- **Perbaikan terkait pada kuis Lomba:**
  - `KuisDetail` («Tambah soal dari bank», «Perbarui TP dari paket») memuat paket lewat `daftarPaket(kuis.kelas, kuis.mapel)` = kelas bank «LB» + mapel: tercampur antar-lomba dan ditolak rules untuk guru pengampu non-admin. Kini memakai `daftarPaketUntukKuis` (paket se-lomba; kuis gabungan = semua mapel, kuis biasa = mapelnya saja).
  - Daftar kuis Lomba tidak lagi ikut menampilkan kuis kelas «LB» milik saya dari **lomba/mapel lain** (penggabungan «kuis saya» dilewati bila `lombaId` ada).
  - Fallback `buatKuisDariPaket` untuk lomba mengambil paket se-lomba, bukan `daftarPaket('LB', mapel)`.
  - Panel «Penilaian & TP» (SLM/STS/SAS → nilai per mapel) disembunyikan untuk kuis gabungan; jenis penilaian tetap «Latihan».
- Ruang kelas biasa dan TKA tidak berubah. Diverifikasi `tsc -b` lolos.
- **Belum ada (tahap berikutnya):** halaman siswa untuk mengerjakan kuis Lomba (`/siswa/lomba/:id` belum ada di routing; rules siswa membaca kuis lewat kelas rombel, bukan kelas bank «LB»). Kuis gabungan baru bisa dibuat, dipratinjau, dan dikelola guru.
- File: `src/lib/lombaAkses.ts`, `src/types/kuis.ts`, `src/lib/susunKuis.ts`, `src/lib/soal.ts`, `src/lib/kuis.ts`, `src/components/KuisPanel.tsx`, `src/components/KuisDetail.tsx`, `src/pages/lomba/LombaDetail.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.13).

## 2026-11-17 — Lomba: tombol kembali dari editor soal menuju dashboard Lomba (bukan Ruang Kelas)

- **Gejala:** di Lomba → tab Bank Soal → buka paket soal, tombol **←** (kembali) membawa ke halaman «Kelas LB · Matematika» lalu «← Semua ruang kelas» yang kosong («Belum ada penugasan», termasuk di akun admin), bukan ke dashboard Lomba.
- **Akar:** `SoalEditor` selalu kembali ke `/kelas/<ruangId>?tab=soal`. Untuk paket Lomba, `ruangId` berbentuk `LB--<Mapel>` (kelas bank «LB» hanya konvensi penyimpanan, bukan ruang kelas), sehingga mendarat di `KelasDetail` untuk «kelas LB». Halaman «Ruang Kelas» sendiri kosong untuk admin karena daftarnya hanya diisi dari penugasan/wali kelas profil guru — itu perilaku normal, bukan galat.
- **Perbaikan:**
  - `BankSoalPanel` membawa `?lomba=<lombaId>` saat membuka editor (tombol **Buka**, **+ Paket soal baru**, dan **Impor & buka editor**).
  - `SoalEditor` menentukan tujuan kembali: bila ada `lombaId` (dari query, atau field `lombaId` pada paket) → `/lomba/<lombaId>?tab=soal&mapel=<mapel>`; bila kelas `LB` tanpa lombaId → `/lomba`; selain itu perilaku lama (`/kelas/<ruangId>?tab=soal`).
  - `LombaDetail` membaca `?tab=` dan `?mapel=` sehingga pengguna mendarat tepat di **Bank Soal mapel yang sama** (mapel yang tidak termasuk lomba diabaikan).
  - `KelasDetail`: tautan lama/bookmark `/kelas/LB--…` dialihkan ke `/lomba` (kelas bank «LB» bukan ruang kelas).
- Ruang kelas biasa dan ruang TKA tidak berubah. Tidak ada perubahan rules maupun data. Diverifikasi `tsc -b` lolos.
- File: `src/pages/SoalEditor.tsx`, `src/components/BankSoalPanel.tsx`, `src/pages/lomba/LombaDetail.tsx`, `src/pages/KelasDetail.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.12).

## 2026-11-17 — Bank soal (Lomba & mapel biasa): import «Tanpa TP» gagal «File import tidak memuat mata pelajaran» + «File JSON tidak valid»

- **Gejala:** menambah soal ke paket bank soal **tanpa TP** lewat tombol **Import** (di kartu paket) ditolak dengan dua baris galat sekaligus: «File import tidak memuat mata pelajaran. Import dibatalkan.» dan «File JSON tidak valid.».
- **Akar:** galat pertama adalah **galat susulan palsu**. Saat `JSON.parse` gagal, `parseJsonImport` mengembalikan `mapel: ''`, lalu panel tetap menjalankan validasi metadata sehingga muncul «tidak memuat mata pelajaran» di atas galat yang sebenarnya. Penyebab nyata: file **bukan JSON yang valid** menurut parser ketat — pola yang lazim dari salinan AI/editor teks: BOM atau karakter tak terlihat, pagar ```` ```json ````, teks pembuka/penutup di luar kurung, koma sisa sebelum `}`/`]`, komentar, atau baris baru mentah di dalam string. Pesan lama juga tidak menunjukkan letak kesalahan.
- **Perbaikan:**
  - `parseJsonImport` kini mencoba **merapikan otomatis** (`rapikanJson`) bila parse pertama gagal: buang BOM/spasi tak terlihat, pagar kode, teks di luar kurung terluar, komentar `//` dan `/* */`, koma sisa, serta escape baris baru/tab di dalam string. Isi teks soal tidak diubah. Bila berhasil, notifikasi sukses menambahkan «(Format JSON dirapikan otomatis.)».
  - Bila tetap tidak valid, galat **hanya satu** dan informatif: perkiraan **baris/kolom + cuplikan**, petunjuk tanda kutip miring (“ ”) dan tanda kutip ganda di dalam teks soal. Galat susulan «tidak memuat mata pelajaran» tidak muncul lagi (`HasilParseImport.gagalParse`; berlaku untuk import ke paket baru **dan** ke paket yang sudah ada, JSON maupun CSV).
  - Isi JSON yang bukan objek/daftar (mis. `null`, angka) ditolak dengan pesan jelas, bukan error teknis; butir soal non-objek dilaporkan per baris.
  - **Mode «Tanpa TP»:** `mapel` di file kini **boleh kosong** (mengikuti ruang/paket tujuan), sehingga daftar soal polos `[ ... ]` bisa diimpor. Bila `mapel` diisi, tetap harus cocok; file yang memuat TP tetap ditolak. Mode «pilih TP» dan TKA tidak berubah (mapel tetap wajib).
  - CSV: kolom mapel yang tidak ada tidak lagi menghentikan parse; mode Tanpa TP menerimanya, mode lain tetap ditolak oleh validator dengan pesan «tidak memuat mata pelajaran».
- Tidak ada perubahan `firestore.rules`, model data, maupun fitur lain. Diverifikasi `tsc -b` lolos dan uji parse/validasi (BOM, pagar kode, koma sisa, komentar, baris baru mentah, teks pembuka, daftar polos tanpa mapel, JSON rusak, file ber-TP ditolak di mode Tanpa TP, CSV tanpa kolom mapel).
- File: `src/lib/importSoal.ts`, `src/components/BankSoalPanel.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§130).

## 2026-11-17 — Lomba: perbaiki «Missing or insufficient permissions» saat import soal / buat paket / tambah materi

- **Gejala:** di detail Lomba → tab Bank soal, **Import soal** (dan «+ Paket soal baru») gagal dengan `Missing or insufficient permissions`. Tambah materi di tab Materi berpotensi sama.
- **Akar utama (klien):** `buatPaket` (`soal.ts`) dan `tambahMateri` (`materi.ts`) menerima `lombaId` dari panel tetapi **tidak menuliskannya ke dokumen** (hanya `buatKuisDariPaket` yang menulis). Rules Lomba mengizinkan tulis kelas bank `LB` hanya bila `'lombaId' in request.resource.data && lombaKontenBoleh(lombaId)`; tanpa field itu admin pun ditolak (admin tidak lolos `lmsTulisMapelKelas`). Import gagal di langkah pertama (membuat paket), sebelum soal sempat disimpan.
- **Perbaikan klien:** `lombaId` kini ikut disimpan di paket soal dan materi lomba. Paket/materi lomba lama tidak ada (semua percobaan ditolak), jadi tidak perlu migrasi data.
- **Perbaikan rules (baca):** `lms_paket_soal` dan `lms_kuis` belum punya cabang baca untuk Lomba, sehingga **guru pengampu non-admin** tidak bisa memuat daftar paket/kuis lomba (kelas `LB` tidak ada di penugasannya). Ditambah cabang `isGuru() && 'lombaId' in resource.data && lombaKontenBoleh(resource.data.lombaId)`. Aturan tulis tidak berubah.
- **Salinan rules di repo LMS basi:** `firestore.rules` di repo `nitoe/lms` tidak memuat satu pun rules Lomba (`lms_lomba`, `lombaKontenBoleh`, cabang `LB`), padahal versi di `SDM01Penilaian` (sumber deploy) sudah. File yang dikirim sekarang berbasis versi `SDM01Penilaian` terbaru + perbaikan di atas, dan dikirim untuk **kedua repo** dengan isi yang sama.
- **Wajib deploy rules** (`npm run deploy:rules` dari SDM01Penilaian) **dan** Hosting; push klien saja tidak cukup untuk guru pengampu.
- Diverifikasi `tsc -b` dan `vite build` lolos; rules diperiksa keseimbangan tanda kurung (kode tanpa komentar) terhadap versi Penilaian.
- File: `src/lib/soal.ts`, `src/lib/materi.ts`, `firestore.rules` (utuh, kedua repo), `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.10, §Lomba.11).

## 2026-11-17 — Bank soal: template & import «Tanpa TP» (soal gabungan) + perbaikan import CSV

- **Tujuan:** admin dan guru pengampu (Lomba, juga ruang mapel biasa) bisa membuat bank soal tanpa terikat satu TP — mis. soal gabungan beberapa TP saat latihan/lomba mepet.
- **Unduh template:** dropdown TP kini punya pilihan **«Tanpa TP (soal gabungan beberapa TP)»**. Menghasilkan `template-soal-<mapel>-tanpa-TP.json/.csv` tanpa kolom/field TP (JSON bertanda `"tanpaTp": true`).
- **Import ke paket baru:** pilihan yang sama di dropdown TP. Paket tersimpan tanpa `tpId` (kartu berlabel «Tanpa TP»). Validasi: mapel harus sama; file **tidak boleh memuat TP** (supaya soal ber-TP tidak tercampur diam-diam) — pesan galat menunjuk ke pilihan yang benar. Sebaliknya, file tanpa TP yang diimpor ke mode «pilih TP» ditolak dengan petunjuk memilih «Tanpa TP».
- **Import ke paket yang sudah ada:** paket tanpa TP kini menerima file template «Tanpa TP» (sebelumnya selalu ditolak karena file wajib memuat TP).
- **Form «Paket soal baru»:** opsi kosong diberi label «Tanpa TP (soal gabungan)» (perilaku tidak berubah).
- **Perbaikan bug lama — import CSV gagal total:** semua template CSV (per-TP, TKA, dan baru) ditolak dengan «soal PG minimal harus punya 2 opsi» karena header dijadikan huruf kecil (`opsia`) sedangkan kode membaca `opsiA`. Kini kunci disimpan dengan nama asli **dan** huruf kecil.
- **Parser CSV lebih tahan:** sel bertanda kutip boleh memuat koma / baris baru / `""`; pemisah `,` atau `;` terdeteksi otomatis (Excel regional Indonesia menyimpan dengan `;`); BOM UTF-8 dibuang (`pecahCsv`).
- Tidak ada perubahan `firestore.rules` (rules paket soal tidak mewajibkan TP) maupun data model. Diverifikasi `tsc -b`, `vite build`, dan uji parse/validasi untuk JSON & CSV (TP, tanpa TP, TKA, `;`, BOM, multi-baris).
- File: `src/lib/importSoal.ts`, `src/components/BankSoalPanel.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§129).

## 2026-11-17 — Lomba: tampilan detail selaras ruang kelas & kuis/bank soal TKA

- **Bug tampilan:** pada tab Materi/Bank soal/Kuis, tombol mapel menjadi lingkaran besar dan «TP dari kelas» terhimpit satu kolom sempit. **Akar:** `.lomba-mapel-bar` didefinisikan dua kali di `lomba.css` — sebagai bilah warna form (`width: 0.28rem`) dan sebagai baris filter mapel; lebar 0,28rem ikut terbawa sehingga seluruh isi baris tertekan.
- **Tab** memakai komponen yang sama dengan ruang kelas (`rg-tabs`/`rg-tab`): berikon, urutan Ringkasan · Materi · Kuis · Bank Soal, ARIA tablist/tabpanel + navigasi panah/Home/End.
- **Filter mapel** memakai `KnChips` dalam `kn-bar` (sama dengan filter di dalam panel Kuis); «TP dari kelas» (admin) menjadi pemilih rapi di ujung kanan bar.
- **Aksen warna mengikuti mapel aktif** (`--rg-a` dari `aksenMapel`), sehingga tab, chip, menu segmen Kuis (Atur/Hasil), dan tombol di panel Kuis/Bank soal/Materi berwarna sama seperti di ruang kelas; oranye Lomba dipakai bila belum ada mapel.
- Kelas lama `.lomba-tabs`, `.lomba-tab`, `.lomba-mapel-bar` (versi bar), `.lomba-mapel-bar-label`, `.lomba-pill-btn`, `.lomba-tp-kelas` dihapus dari `lomba.css` (hanya dipakai `LombaDetail`). Bilah warna form `.lomba-mapel-bar` tidak berubah.
- Tidak mengubah data, query, rules, maupun panel Materi/Kuis/Bank soal. Diverifikasi `tsc -b` dan `vite build` lolos.
- File: `src/pages/lomba/LombaDetail.tsx`, `src/styles/lomba.css`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.9).

## 2026-11-17 — Lomba: perbaikan build deploy (TS6133 `tpKelas` di KuisPanel)

- **Gejala:** `npm run deploy` gagal di tahap `tsc -b`: `src/components/KuisPanel.tsx:110:60 - error TS6133: 'tpKelas' is declared but its value is never read.`
- **Akar:** pada Lomba Tahap 2, `KuisPanel` diberi prop opsional `tpKelas` (agar seragam dengan `MateriPanel`/`BankSoalPanel`) dan di-destructure di parameter, tetapi kuis tidak memakainya — TP kuis diturunkan dari paket sumber. `tsconfig` mengaktifkan pemeriksaan variabel tak terpakai.
- **Perbaikan:** `tpKelas` tetap ada di tipe `Props` (pemanggil `LombaDetail` tidak berubah) tetapi tidak lagi di-destructure di `KuisPanel`. Tidak ada perubahan perilaku.
- File: `src/components/KuisPanel.tsx`, `CHANGELOG.md`, `ANTIREGRESI.md` (§Lomba.8).

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

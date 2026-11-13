## §114. Cakupan kelas & mapel saat menyusun tugas

114.1 Pilihan kelas/mapel di form tugas **wajib** berasal dari `lib/cakupanTugas.ts` (`cakupanTugas`), bukan dari `DAFTAR_KELAS_SD` atau seluruh master mapel. Jangan menambahkan fallback «semua kelas» bila guru tidak punya penugasan — tampilkan peringatan dan blokir simpan (bug lama: guru bisa memilih kelas yang bukan miliknya).

114.2 Aturan harus tetap sejajar dengan `tulisMapelKelas` di firestore.rules: (a) kelas ∈ `waliKelas` → semua mapel di kelas itu; (b) `kelas::mapel` ∈ penugasan → hanya pasangan itu. Jika aturan server berubah, ubah `cakupanTugas` bersamaan.

114.3 Mapel dihitung **per kelas** (guru bidang studi multi kelas bisa mengampu mapel berbeda di tiap kelas). Ganti kelas mereset mapel; jangan menampilkan mapel dari kelas lain.

114.4 Saat mengedit tugas, kelas/mapel tersimpan harus tetap muncul di pilihan (`opsiKelas`/`opsiMapel` menambahkannya) agar `<select>` tidak tampil kosong; validasi simpan memakai daftar yang sama.

114.5 Master mapel `'Wali kelas'` tidak pernah menjadi pilihan mapel. Admin = tanpa batas (`bebas`).

## §115. Kuis TKA terpisah per mapel & daftar kuis aktif

115.1 Mapel TKA berbagi kelas bank «6». Daftar kuis ruang TKA HARUS difilter `mapel` yang sama; jangan menggabung `daftarKuisDibuatOleh()` tanpa memeriksa mapel untuk mapel TKA (penyebab kuis TKA mapel lain muncul). Toleransi mapel beda hanya untuk mapel non-TKA.

115.2 Setiap query `lms_kuis` harus `where kelas + mapel` (rules). Daftar kuis aktif di dashboard TKA melakukan satu query per mapel (`daftarKuis(ruangTka(m).kelas, m)`), bukan query lintas-mapel.

115.3 «Aktif» = `aktif === true` dan `waktuSelesai` kosong/di masa depan; `waktuMulai` di masa depan = «Terjadwal». Waktu bisa berupa string ISO atau Timestamp Firestore — gunakan `keTanggal`.

## §114. Ekspor TKA & konfirmasi hapus kuis

114.1 Ekspor XLSX dibuat tanpa dependensi (`exportTabel.ts`). Jangan menambah paket spreadsheet hanya untuk ekspor; bila diganti, pertahankan: header tebal, kolom nama dibekukan, angka tetap numerik (bukan teks), sheet ≤ 31 karakter.

114.2 CSV: UTF-8 **BOM**, pemisah `;`, desimal `,` (Excel lokal Indonesia membuka koma-pemisah dalam satu kolom). Sel teks berawalan `= + - @` diberi `'` (cegah injeksi rumus).

114.3 Ekspor mengikuti filter tahap/kelas yang tampil — jangan mengekspor kelas di luar `kelasRekapTkaBolehDilihat` (wali 6A tidak boleh membawa 6B).

114.4 Hapus kuis HARUS lewat `KonfirmasiHapusDialog` (ketik **HAPUS**). Jangan kembali ke `confirm()` satu klik. Dialog menyebut dampak ke Rekap TKA untuk kuis Try Out dan menyarankan «Nonaktifkan». `hapusKuis` hanya menghapus dokumen kuis — hasil `lms_jawaban` tertinggal (yatim); jangan menambah penghapusan massal jawaban tanpa konfirmasi terpisah.

## §113. Input sebaran manual

113.1 Sebaran manual disimpan sebagai **poin & maks** per kompetensi (bukan persen), lewat `bangunSebaranManual`. Jumlah poin & maks kompetensi dasar WAJIB sama dengan kompetensi materi (membagi soal yang sama); jika tidak, tolak.

113.2 Grid hanya memuat siswa dengan `sumber !== 'otomatis'`. Jangan menimpa nilai otomatis LMS lewat input manual — sebarannya sudah dari jawaban.

113.3 Menyimpan sebaran manual HARUS lewat `simpanNilaiManualTka({ sebaran })` agar nilai & sebaran tertulis bersamaan. Mengubah nilai manual tanpa `sebaran` membuang sebaran lama mapel itu (§109.3).

113.4 Validasi seluruh baris dulu; jika ada satu salah, jangan menyimpan apa pun. Setelah menyimpan, publikasi portal harus diperbarui manual («Perbarui publikasi»).

113.5 Catatan nomor: entri ini sebelumnya tertulis §112 dan tertimpa oleh §112 UI Beranda; dipulihkan sebagai §113. Sebelum menulis entri, selalu cek nomor terakhir di `main` terbaru.

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

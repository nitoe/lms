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


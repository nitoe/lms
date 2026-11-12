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

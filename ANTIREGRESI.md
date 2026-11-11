## §101. Reset TKA: attempt vs draf progress

101.1 `lms_jawaban` dihapus = izin mengerjakan ulang. **Tidak** menghapus draf di `localStorage` perangkat siswa.

101.2 Draf dihapus lewat marker `lms_tka_progress_reset/{kuisId}_{siswaId}` (`resetAt` / `resetAtMs`). Klien siswa wajib cek marker sebelum memakai progress lokal.

101.3 Mode CF: `attempt` | `progress` | `semua`. Default UI admin = `semua`.

101.4 Tulis marker hanya Admin SDK. Siswa hanya **read** dokumen dengan `siswaId == token.siswaId`.

101.5 Jangan mengandalkan admin dan siswa di perangkat yang sama untuk “hapus localStorage jarak jauh” tanpa marker server.

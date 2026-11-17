## 2026-11-17 — Lomba multi-pengampu: perbaiki updateDoc undefined

- Gejala: simpan >1 pengampu → `Unsupported field value: undefined`.
- Akar: objek nested di `siswaList`/`guruPengampuList` (mis. `nisn`/`email` opsional) membawa `undefined`; Firestore menolak.
- Perbaikan: `sanitasiPeserta` + normalisasi pengampu (`email: null`, tanpa key undefined) sebelum `addDoc`/`updateDoc`.
- File: `src/lib/lomba.ts`, `src/pages/lomba/LombaForm.tsx`.


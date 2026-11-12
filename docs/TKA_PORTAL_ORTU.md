# Try Out TKA → Portal Orang Tua

## Koleksi
- `lms_tka_publikasi/{kelas}_{tahap}` — gerbang published
- `lms_tka_hasil_ortu/{kelas}_{tahap}_{siswaId}` — snapshot nilai anak + sebaran
- `lms_tka_peringkat/{tahap}` — top 10 gabungan 6A+6B

## Field snapshot hasil (`lms_tka_hasil_ortu`)
| Field | Keterangan |
|-------|------------|
| nilai | `{ BI, MTK, IPA }` 0–100 atau null |
| sebaran | opsional: per mapel → `{ kompleksitas[], materi[], domain[] }` |
| rataRata / peringkat | ranking gabungan 6A+6B |

Sebaran dihitung saat **Publikasikan** dari jawaban kuis LMS + metadata soal (`kompleksitas`, `tipeMateri`, `domainTka`).
Nilai manual-only (tanpa kuis LMS) → sebaran kosong di portal.

## Rata ranking
- Tahap I: (Bahasa Indonesia + Matematika) / 2
- Tahap II–V: (Bahasa Indonesia + Matematika + IPA) / 3

## Alur
1. Wali/admin isi rekap di LMS (otomatis dari kuis atau manual)
2. Publikasikan per kelas × tahap (menghitung sebaran bila mungkin)
3. Orang tua kelas 6 melihat katalog tahap di portal → nilai + sebaran + ranking

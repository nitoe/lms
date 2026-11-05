# LMS — SD Muhammadiyah 01 Kukusan

Learning Management System untuk guru, siswa, dan orang tua.

**URL:** https://lms.sdmuhammadiyah01kks.sch.id

**Stack:** Vite + React 19 + TypeScript + Tailwind CSS v4 + Firebase (Auth, Firestore, Hosting)  
**Project Firebase:** `sdm01kukusan-2e735` (sama dengan Penilaian, Perpustakaan, Sarpras)

| Dokumen | Isi |
|---------|-----|
| [docs/RANCANGAN.md](docs/RANCANGAN.md) | Rancangan & fase |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Model data |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy Hosting |
| [CHANGELOG.md](CHANGELOG.md) | Riwayat versi |
| [ANTIREGRESI.md](ANTIREGRESI.md) | Catatan anti-regresi |

## Status

**Fase 0 dan Fase 1a–1b selesai di kode:** ruang kelas dari penugasan dan materi per Tujuan Pembelajaran. **Overhaul UI modern:** area guru (v0.4.0–0.4.1) dan area siswa (v0.4.2, termasuk Materi siswa) selesai. Berikutnya: fitur Tugas (v0.5.0). Riwayat lengkap di [CHANGELOG.md](CHANGELOG.md).

## Menjalankan di komputer

```bash
npm install
cp .env.example .env   # isi nilai Firebase (sama dengan Penilaian)
# Salin logo-sdm.png dan hero-lms.png ke public/
npm run dev
```

Buka http://localhost:5175

## Login

| Siapa | Cara |
|-------|------|
| Staf (guru/admin) | Email + sandi (akun Penilaian) → `/masuk` |
| Siswa | Kelas + nama + NISN → `/siswa/masuk` |
| Orang tua | Email + sandi (akun approved) → `/orangtua/masuk` |

## Perintah

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build ke `dist/` |
| `npm run deploy` | Build + deploy Hosting target `lms` |

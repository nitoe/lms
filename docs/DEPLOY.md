# Deploy LMS

## Prasyarat

1. Firebase project `sdm01kukusan-2e735`
2. Hosting target `lms` → site `sdm01-lms` (buat di Firebase Console jika belum)
3. Custom domain: `lms.sdmuhammadiyah01kks.sch.id`

## Langkah

```bash
npm install
cp .env.example .env   # isi config Firebase
# pastikan public/logo-sdm.png dan public/hero-lms.png ada
npm run build
firebase target:apply hosting lms sdm01-lms
npm run deploy
```

Atau: `firebase deploy --only hosting:lms`

## Rules

Perubahan koleksi LMS digabung ke `firestore.rules` di repo **SDM01Penilaian** (full file), lalu:

```bash
# di repo Penilaian
npm run deploy:rules
```

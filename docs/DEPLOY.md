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

## Login siswa (Cloud Function)

Siswa masuk lewat Cloud Function `loginSiswaLms` yang hidup di repo **SDM01Penilaian** (`functions/loginSiswaLms.js`, wilayah `asia-southeast2`).

Urutan deploy:

1. Di Google Cloud Console project `sdm01kukusan-2e735`: aktifkan API **IAM Service Account Credentials**, lalu beri peran **Service Account Token Creator** pada service account runtime function (biasanya `NOMOR_PROJECT-compute@developer.gserviceaccount.com`).
2. Di repo Penilaian: `firebase deploy --only functions:loginSiswaLms`.
3. Di repo LMS: `npm run deploy`.
4. Di repo Penilaian: `npm run deploy:rules` (rules baru membatasi baca `lms_materi` hanya untuk siswa yang login lewat function).

Gejala bila langkah 1 terlewat: siswa melihat «Layanan masuk belum bisa dihubungi» dan log function berisi kegagalan membuat custom token.

## Video bukti tugas — hapus otomatis (lifecycle Storage)

Video siswa disimpan di `lms/pengumpulan/…` dan **dihapus otomatis 120 hari** setelah diunggah (kuota Storage).
Atur sekali (butuh Google Cloud SDK `gcloud`). **Perintah ini MENGGANTI seluruh aturan lifecycle bucket**, jadi
periksa dulu aturan yang sudah ada:

```
gcloud storage buckets describe gs://<NAMA-BUCKET> --format="default(lifecycle_config)"
gcloud storage buckets update gs://<NAMA-BUCKET> --lifecycle-file=docs/storage-lifecycle-video.json
```

Nama bucket = nilai `VITE_FIREBASE_STORAGE_BUCKET` (Firebase Console → Storage). Bila sudah ada aturan lain,
gabungkan isinya ke file JSON sebelum menjalankan perintah kedua. Urutan deploy fitur video:
`firestore.rules` + `storage.rules` (`firebase deploy --only firestore:rules,storage`) → hosting LMS.

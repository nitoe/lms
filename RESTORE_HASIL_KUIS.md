# Restore HasilKuisPanel + laporan domain TKA

## Status remote

Beberapa commit bot menimpa `src/components/HasilKuisPanel.tsx` dengan konten tidak lengkap.
Isi **utuh terakhir yang valid** ada di commit:

`3bed0a42852e6d06192e3cca8f068dc750829447`

## Langkah cepat (lokal)

```bash
cd C:\\Users\\USER\\Documents\\GitHub\\lms
git fetch origin

# 1) Kembalikan file utuh dari commit valid
git checkout 3bed0a42852e6d06192e3cca8f068dc750829447 -- src/components/HasilKuisPanel.tsx
```

## 2) Perbaikan wajib TS2304 (`soalIds`)

Setelah `domainYangAda`, **sebelum** `const agregat = useMemo`, sisipkan:

```ts
  const soalIds = useMemo(() => (kuis.soal ?? []).map((s) => s.id), [kuis.soal])
```

## 3) (Opsional) Peningkatan laporan domain TKA §95

Unduh file lengkap dari chat (artifacts `HasilKuisPanel.tsx`) yang sudah berisi:

- `soalIds` (fix build)
- `rataDomain` + kartu rata-rata per domain di ringkasan
- Badge domain di header detail siswa
- Badge domain di setiap soal pada detail

Salin ke `src/components/HasilKuisPanel.tsx`, lalu:

```bash
npm run build
git add src/components/HasilKuisPanel.tsx CHANGELOG.md ANTIREGRESI.md
git commit -m "fix+feat(TKA): soalIds + rata domain kelas & detail siswa (§94–§95)"
git push origin main
```

Mapel non-TKA tidak berubah (ANTIREGRESI §92.5, §94.3, §95.3).

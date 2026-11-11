# Restore HasilKuisPanel (setelah commit bot terpotong)

Commit bot sempat menimpa `src/components/HasilKuisPanel.tsx` dengan konten tidak lengkap.
Isi utuh masih ada di commit:

`3bed0a42852e6d06192e3cca8f068dc750829447`

## Langkah di mesin lokal

```bash
cd C:\\Users\\USER\\Documents\\GitHub\\lms
git fetch origin

# Kembalikan file utuh dari commit terakhir yang valid
git checkout 3bed0a42852e6d06192e3cca8f068dc750829447 -- src/components/HasilKuisPanel.tsx
```

## Tambahkan definisi `soalIds` (perbaikan TS2304)

Di `HasilKuisPanel.tsx`, **tepat setelah** blok `domainYangAda` dan **sebelum** `const agregat = useMemo`, sisipkan:

```ts
  const soalIds = useMemo(() => (kuis.soal ?? []).map((s) => s.id), [kuis.soal])
```

Blok hasilnya:

```ts
  const domainYangAda = useMemo(() => {
    if (!isTka) return [] as DomainTka[]
    const set = new Set<DomainTka>()
    for (const s of kuis.soal ?? []) {
      const d = normalisasiDomainTka(s.domainTka)
      if (d) set.add(d)
    }
    return Array.from(set)
  }, [isTka, kuis.soal])

  const soalIds = useMemo(() => (kuis.soal ?? []).map((s) => s.id), [kuis.soal])

  const agregat = useMemo(() => {
    if (!list || list.length === 0) return {}
    const sumber = isTka
      ? barisTka.filter((b) => b.jawaban).map((b) => b.jawaban!)
      : tampil
    return agregatPerSoal(sumber, soalIds)
  }, [list, tampil, soalIds, isTka, barisTka])
```

## Commit & build

```bash
git add src/components/HasilKuisPanel.tsx
git commit -m "fix: restore soalIds useMemo in HasilKuisPanel (TS2304)"
npm run build
git push origin main
```

ANTIREGRESI §94 — hanya menambah definisi yang hilang; perilaku TKA/mapel tidak berubah.

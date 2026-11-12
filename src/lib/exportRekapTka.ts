/**
 * Menyusun lembar ekspor Rekap Try Out TKA (nilai akhir + sebaran kompetensi per siswa).
 * Murni (tanpa Firebase) agar mudah diuji. ANTIREGRESI §114.
 */
import type { LembarEks, SelEks } from './exportTabel'
import {
  KKM_TKA,
  agregatSebaran,
  kolomDariAgregat,
  kompetensiTerlemah,
} from './sebaranTka'
import { LABEL_MAPEL_TKA, MAPEL_TKA, type MapelTkaNama } from './tkaAkses'
import { NAMA_TAHAP_TRYOUT_TKA, type TahapTryOutTka } from '../types/kuis'
import type { BarisRekapTka } from '../types/rekapTka'

const LABEL_SINGKAT: Record<MapelTkaNama, string> = {
  'TKA Bahasa Indonesia': 'BI',
  'TKA Matematika': 'MTK',
  'TKA IPA': 'IPA',
}

function sumberTeks(s: string | null | undefined): string {
  if (s === 'otomatis') return 'LMS'
  if (s === 'manual') return 'Manual'
  return ''
}

/** Lembar nilai akhir seluruh mata pelajaran. */
export function susunLembarRekap(
  baris: BarisRekapTka[],
  rata: (r: BarisRekapTka) => number | null,
): LembarEks {
  return {
    nama: 'Rekap Nilai Akhir',
    kolom: ['Kelas', 'Nama Siswa', ...MAPEL_TKA.map((m) => LABEL_SINGKAT[m]), 'Rata-rata'],
    baris: baris.map((r): SelEks[] => [
      r.kelas,
      r.siswaNama,
      ...MAPEL_TKA.map((m) => r.perMapel[m]?.nilai ?? null),
      rata(r),
    ]),
    bekukanKolom: 2,
  }
}

/** Lembar satu mapel: nilai akhir + capaian (%) tiap kompetensi per siswa. */
export function susunLembarMapel(baris: BarisRekapTka[], mapel: MapelTkaNama): LembarEks {
  const ag = agregatSebaran(baris.map((r) => r.perMapel[mapel]?.sebaran ?? null))
  const kolom = kolomDariAgregat(ag)
  const headKompetensi = kolom.map((c) => {
    const awal = c.dim === 'kompleksitas' ? 'Dasar' : 'Materi'
    const nama = c.sub ? `${c.judul} / ${c.sub}` : c.judul
    return `${awal}: ${nama} (%)`
  })
  return {
    nama: LABEL_MAPEL_TKA[mapel],
    kolom: [
      'Kelas',
      'Nama Siswa',
      'Nilai Akhir',
      'Sumber',
      'Skor',
      'Skor Maks',
      ...headKompetensi,
      'Kompetensi Terlemah',
      'Catatan',
    ],
    baris: baris.map((r): SelEks[] => {
      const sel = r.perMapel[mapel]
      const s = sel?.sebaran ?? null
      const terlemah = kompetensiTerlemah(s)
      let catatan = ''
      if (s?.waktuHabis) catatan = 'Waktu habis (soal yang tidak sempat tampil tidak dihitung)'
      else if (sel?.nilai != null && !s) catatan = 'Tanpa data sebaran'
      return [
        r.kelas,
        r.siswaNama,
        sel?.nilai ?? null,
        sumberTeks(sel?.sumber),
        s?.skor ?? null,
        s?.maks ?? null,
        ...kolom.map((c) => s?.[c.dim]?.find((x) => x.key === c.key)?.persen ?? null),
        terlemah ? `${terlemah.nama} (${terlemah.persen}%)` : '',
        catatan,
      ]
    }),
    bekukanKolom: 2,
  }
}

export function susunLembarKeterangan(info: {
  tahap: TahapTryOutTka
  kelas: string
  jumlahSiswa: number
  tanggal: Date
}): LembarEks {
  const tgl = info.tanggal.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
  const rows: [string, string][] = [
    ['Dokumen', 'Rekap Nilai Try Out TKA · SD Muhammadiyah 01 Kukusan'],
    ['Tahap', NAMA_TAHAP_TRYOUT_TKA[info.tahap]],
    ['Kelas', info.kelas],
    ['Jumlah siswa', String(info.jumlahSiswa)],
    ['Diekspor', tgl],
    ['Nilai akhir', 'Skala 0–100. Otomatis dari kuis LMS atau input/import manual.'],
    ['Sumber', 'LMS = dihitung dari jawaban siswa di LMS; Manual = diinput/diimpor guru.'],
    ['Capaian kompetensi (%)', 'Poin diperoleh ÷ poin maksimum pada kompetensi tersebut (berbobot poin).'],
    ['Kompetensi dasar', 'Tingkat kompleksitas L1 Pemahaman, L2 Aplikasi, L3 Penalaran.'],
    ['Kompetensi materi', 'Matematika & Bahasa Indonesia: tipe materi. IPA: Pengetahuan IPA & Keterampilan Proses Sains.'],
    ['Bahasa Indonesia', 'L1/L2/L3 sama dengan Pemahaman Tekstual / Inferensial / Evaluasi dan Apresiasi (satu kolom).'],
    ['Ketuntasan', `Acuan ketuntasan Try Out: ${KKM_TKA}.`],
  ]
  return {
    nama: 'Keterangan',
    kolom: ['Keterangan', 'Isi'],
    baris: rows,
    lebar: [26, 90],
  }
}

/** Semua lembar untuk berkas Excel: rekap, tiap mapel yang punya nilai, keterangan. */
export function susunBerkasTka(input: {
  baris: BarisRekapTka[]
  tahap: TahapTryOutTka
  kelasLabel: string
  rata: (r: BarisRekapTka) => number | null
  tanggal?: Date
}): LembarEks[] {
  const lembar: LembarEks[] = [susunLembarRekap(input.baris, input.rata)]
  for (const m of MAPEL_TKA) {
    if (input.baris.some((r) => r.perMapel[m]?.nilai != null)) {
      lembar.push(susunLembarMapel(input.baris, m))
    }
  }
  lembar.push(
    susunLembarKeterangan({
      tahap: input.tahap,
      kelas: input.kelasLabel,
      jumlahSiswa: input.baris.length,
      tanggal: input.tanggal ?? new Date(),
    }),
  )
  return lembar
}

/** Nama berkas, mis. rekap-tka-tahap-i-6a-6b-2026-11-13.xlsx */
export function namaBerkasTka(
  tahap: TahapTryOutTka,
  kelasLabel: string,
  ekstensi: 'xlsx' | 'csv',
  bagian = '',
  tanggal = new Date(),
): string {
  const t = tanggal.toISOString().slice(0, 10)
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return ['rekap-tka', bagian && slug(bagian), `tahap-${slug(tahap)}`, slug(kelasLabel), t]
    .filter(Boolean)
    .join('-') + `.${ekstensi}`
}

/**
 * Sebaran capaian Try Out TKA — perhitungan murni (tanpa Firebase).
 *
 * Aturan (ANTIREGRESI §109):
 * - Berbobot POIN, bukan jumlah soal. Skor parsial (PGK / Benar-Salah) ikut dihitung.
 * - Penyebut = seluruh soal kuis (soal tanpa jawaban = 0 poin), bukan hanya soal yang tampil.
 * - Dimensi: kompleksitas (L1–L3), tipe materi, domain (IPA).
 */
import type { DetailJawabanSoal } from './jawabanKuis'
import { MATERI_TKA, type MapelTkaNama } from './tkaAkses'
import type { BarisSebaranTka, SebaranMapelTka } from '../types/rekapTka'
import {
  MAKS_BI_KOMPLEKSITAS,
  MAKS_MTK_KOMPLEKSITAS,
  MAKS_MTK_MATERI,
  type BarisTryOutImport,
} from '../data/tryoutTahap1'
import type { SebaranBarisOrtu, SebaranMapelOrtu } from '../types/tkaPublikasi'
import {
  NAMA_DOMAIN_TKA,
  URUTAN_DOMAIN_TKA,
  URUTAN_KOMPLEKSITAS,
  normalisasiDomainTka,
  normalisasiKompleksitas,
  type KompleksitasSoal,
  type Soal,
} from '../types/soal'

/** Batas ketuntasan Try Out TKA (persen). */
export const KKM_TKA = 70
/** Di bawah ini dianggap perlu penguatan intensif. */
export const BATAS_RENDAH_TKA = 50

/** Label kompleksitas selaras laporan TKA resmi (konsisten untuk semua tahap & portal). */
export const NAMA_KOMPLEKSITAS_TKA: Record<KompleksitasSoal, string> = {
  L1: 'L1 · Pemahaman',
  L2: 'L2 · Aplikasi',
  L3: 'L3 · Penalaran',
}

export type DimensiSebaran = 'kompleksitas' | 'materi' | 'domain'

export const NAMA_DIMENSI: Record<DimensiSebaran, string> = {
  kompleksitas: 'Tingkat kompleksitas',
  materi: 'Kompetensi materi',
  domain: 'Domain kompetensi',
}

export function persenPoin(poin: number, maks: number): number {
  if (!maks || maks <= 0) return 0
  return Math.round((poin / maks) * 1000) / 10
}

function bulat2(n: number): number {
  return Math.round(n * 100) / 100
}

type Acc = { key: string; nama: string; poin: number; maks: number }

function keBaris(m: Map<string, Acc>, urut: (a: Acc, b: Acc) => number): BarisSebaranTka[] {
  return [...m.values()]
    .sort(urut)
    .map((a) => ({
      key: a.key,
      nama: a.nama,
      poin: bulat2(a.poin),
      maks: bulat2(a.maks),
      persen: persenPoin(a.poin, a.maks),
    }))
}

function tambah(m: Map<string, Acc>, key: string, nama: string, poin: number, maks: number) {
  const a = m.get(key) ?? { key, nama, poin: 0, maks: 0 }
  a.poin += poin
  a.maks += maks
  m.set(key, a)
}

/**
 * Hitung sebaran dari snapshot soal kuis + detail jawaban satu siswa.
 * @returns null bila tidak ada soal / detail.
 */
export function hitungSebaranDariJawaban(
  soalList: Soal[] | undefined,
  detail: DetailJawabanSoal[] | undefined,
  mapel?: MapelTkaNama,
): SebaranMapelTka | null {
  if (!soalList?.length || !detail?.length) return null
  const byId = new Map(detail.map((d) => [d.soalId, d]))
  const kMap = new Map<string, Acc>()
  const mMap = new Map<string, Acc>()
  const dMap = new Map<string, Acc>()
  let skor = 0
  let maksTotal = 0

  for (const s of soalList) {
    const maks = Number(s.poin) || 0
    if (maks <= 0) continue
    const d = byId.get(s.id)
    let poin = 0
    if (d) {
      poin = typeof d.skor === 'number' ? d.skor : d.benar === true ? maks : 0
      poin = Math.min(Math.max(poin, 0), maks)
    }
    skor += poin
    maksTotal += maks

    const kk = normalisasiKompleksitas(s.kompleksitas)
    tambah(kMap, kk, NAMA_KOMPLEKSITAS_TKA[kk], poin, maks)

    const materi = (s.tipeMateri || '').trim()
    if (materi) tambah(mMap, materi, materi, poin, maks)

    const dom = normalisasiDomainTka(s.domainTka)
    if (dom) tambah(dMap, dom, NAMA_DOMAIN_TKA[dom], poin, maks)
  }
  if (maksTotal <= 0) return null

  const urutMateri = mapel ? MATERI_TKA[mapel] : undefined
  const out: SebaranMapelTka = { skor: bulat2(skor), maks: bulat2(maksTotal) }
  const kompleksitas = keBaris(
    kMap,
    (a, b) =>
      URUTAN_KOMPLEKSITAS.indexOf(a.key as KompleksitasSoal) -
      URUTAN_KOMPLEKSITAS.indexOf(b.key as KompleksitasSoal),
  )
  const materi = keBaris(mMap, (a, b) => {
    const ia = urutMateri ? urutMateri.indexOf(a.key) : -1
    const ib = urutMateri ? urutMateri.indexOf(b.key) : -1
    if (ia !== ib && ia >= 0 && ib >= 0) return ia - ib
    if (ia >= 0 && ib < 0) return -1
    if (ia < 0 && ib >= 0) return 1
    return a.nama.localeCompare(b.nama, 'id')
  })
  const domain = keBaris(
    dMap,
    (a, b) =>
      URUTAN_DOMAIN_TKA.indexOf(a.key as (typeof URUTAN_DOMAIN_TKA)[number]) -
      URUTAN_DOMAIN_TKA.indexOf(b.key as (typeof URUTAN_DOMAIN_TKA)[number]),
  )
  if (kompleksitas.length) out.kompleksitas = kompleksitas
  if (materi.length) out.materi = materi
  if (domain.length) out.domain = domain
  return out
}

/** Baris sebaran paling lemah (utamakan tipe materi; bila tak ada, kompleksitas). */
export function kompetensiTerlemah(s: SebaranMapelTka | null | undefined): BarisSebaranTka | null {
  if (!s) return null
  const sumber = s.materi?.length ? s.materi : s.kompleksitas
  if (!sumber?.length) return null
  return sumber.reduce((a, b) => (b.persen < a.persen ? b : a))
}

/** Konversi ke format snapshot portal orang tua (benar/total = poin/maks). */
export function keSebaranOrtu(s: SebaranMapelTka | null | undefined): SebaranMapelOrtu | null {
  if (!s) return null
  const conv = (rows?: BarisSebaranTka[]): SebaranBarisOrtu[] | undefined =>
    rows?.length
      ? rows.map((r) => ({
          key: r.key,
          nama: r.nama,
          benar: bulat2(r.poin),
          total: bulat2(r.maks),
          persen: r.persen,
        }))
      : undefined
  const out: SebaranMapelOrtu = {}
  const k = conv(s.kompleksitas)
  const m = conv(s.materi)
  const d = conv(s.domain)
  if (k) out.kompleksitas = k
  if (m) out.materi = m
  if (d) out.domain = d
  return k || m || d ? out : null
}

/* ---------------------------------------------------------------- agregat kelas */

export type BarisAgregat = {
  key: string
  nama: string
  poin: number
  maks: number
  /** Gabungan poin ÷ gabungan maks (pooled). */
  persen: number
  /** Jumlah siswa yang punya data baris ini. */
  n: number
  /** Siswa dengan capaian < BATAS_RENDAH_TKA. */
  rendah: number
  /** Siswa dengan capaian BATAS_RENDAH_TKA … < KKM_TKA. */
  sedang: number
  /** Siswa dengan capaian ≥ KKM_TKA. */
  tuntas: number
}

export type AgregatSebaran = {
  /** Jumlah siswa yang punya data sebaran. */
  n: number
  kompleksitas: BarisAgregat[]
  materi: BarisAgregat[]
  domain: BarisAgregat[]
}

function agregatDimensi(
  daftar: (BarisSebaranTka[] | undefined)[],
): BarisAgregat[] {
  const m = new Map<string, BarisAgregat>()
  const urutan: string[] = []
  for (const rows of daftar) {
    for (const r of rows ?? []) {
      let a = m.get(r.key)
      if (!a) {
        a = { key: r.key, nama: r.nama, poin: 0, maks: 0, persen: 0, n: 0, rendah: 0, sedang: 0, tuntas: 0 }
        m.set(r.key, a)
        urutan.push(r.key)
      }
      a.poin += r.poin
      a.maks += r.maks
      a.n += 1
      if (r.persen < BATAS_RENDAH_TKA) a.rendah += 1
      else if (r.persen < KKM_TKA) a.sedang += 1
      else a.tuntas += 1
    }
  }
  return urutan.map((k) => {
    const a = m.get(k)!
    return { ...a, poin: bulat2(a.poin), maks: bulat2(a.maks), persen: persenPoin(a.poin, a.maks) }
  })
}

export function agregatSebaran(list: (SebaranMapelTka | null | undefined)[]): AgregatSebaran {
  const ada = list.filter((x): x is SebaranMapelTka => !!x)
  return {
    n: ada.length,
    kompleksitas: agregatDimensi(ada.map((s) => s.kompleksitas)),
    materi: agregatDimensi(ada.map((s) => s.materi)),
    domain: agregatDimensi(ada.map((s) => s.domain)),
  }
}

/**
 * Pada Bahasa Indonesia, kompleksitas (L1–L3) dan tipe materi adalah pembagian soal yang SAMA
 * (L1=Tekstual, L2=Inferensial, L3=Evaluasi). Fungsi ini memasangkan baris yang identik
 * (poin & maks sama) agar UI menampilkannya sebagai satu tabel, bukan dua tabel kembar.
 * @returns null bila bukan pembagian yang sama (mis. Matematika) atau pemasangan ambigu.
 */
export function pasangkanDimensiSama<T extends { poin: number; maks: number }>(
  kompleksitas: T[],
  materi: T[],
): { kompleksitas: T; materi: T }[] | null {
  if (!kompleksitas.length || kompleksitas.length !== materi.length) return null
  const sisa = [...materi]
  const out: { kompleksitas: T; materi: T }[] = []
  for (const k of kompleksitas) {
    const cocok = sisa.filter((m) => m.poin === k.poin && m.maks === k.maks)
    if (cocok.length !== 1) return null
    out.push({ kompleksitas: k, materi: cocok[0] })
    sisa.splice(sisa.indexOf(cocok[0]), 1)
  }
  return out
}

/* ---------------------------------------------------------------- distribusi nilai */

export type BinNilai = { label: string; dari: number; sampai: number; jumlah: number }

export type DistribusiNilai = {
  n: number
  rata: number | null
  median: number | null
  min: number | null
  max: number | null
  tuntas: number
  bins: BinNilai[]
}

const BATAS_BIN: [number, number][] = [
  [0, 40],
  [40, 50],
  [50, 60],
  [60, 70],
  [70, 80],
  [80, 90],
  [90, 100],
]

export function distribusiNilai(nilai: number[]): DistribusiNilai {
  const n = nilai.length
  const bins: BinNilai[] = BATAS_BIN.map(([dari, sampai], i) => ({
    label: i === 0 ? '< 40' : i === BATAS_BIN.length - 1 ? '90–100' : `${dari}–${sampai - 1}`,
    dari,
    sampai,
    jumlah: nilai.filter((x) => (i === BATAS_BIN.length - 1 ? x >= dari : x >= dari && x < sampai)).length,
  }))
  if (n === 0) return { n: 0, rata: null, median: null, min: null, max: null, tuntas: 0, bins }
  const urut = [...nilai].sort((a, b) => a - b)
  const tengah = Math.floor(n / 2)
  const median = n % 2 ? urut[tengah] : (urut[tengah - 1] + urut[tengah]) / 2
  const rata = Math.round((nilai.reduce((a, b) => a + b, 0) / n) * 10) / 10
  return {
    n,
    rata,
    median: Math.round(median * 10) / 10,
    min: urut[0],
    max: urut[n - 1],
    tuntas: nilai.filter((x) => x >= KKM_TKA).length,
    bins,
  }
}

/* ---------------------------------------------------------------- data import (poin → sebaran) */

function barisSebaran(key: string, nama: string, poin: number, maks: number): BarisSebaranTka {
  return { key, nama, poin, maks, persen: persenPoin(poin, maks) }
}

/** Sebaran Matematika dari poin per kelompok (L1, L2 | Bilangan, Data, Geometri). */
export function bangunSebaranMtk(sb: NonNullable<BarisTryOutImport['sbMtk']>): SebaranMapelTka {
  const nm = MATERI_TKA['TKA Matematika'] // Bilangan, Geometri dan Pengukuran, Data
  const urutan: [string, number, number][] = [
    ['Bilangan', sb.m[0], MAKS_MTK_MATERI[0]],
    ['Data', sb.m[1], MAKS_MTK_MATERI[1]],
    ['Geometri dan Pengukuran', sb.m[2], MAKS_MTK_MATERI[2]],
  ]
  const materi = nm
    .map((nama) => urutan.find((u) => u[0] === nama))
    .filter((u): u is [string, number, number] => !!u)
    .map(([nama, poin, maks]) => barisSebaran(nama, nama, poin, maks))
  const kompleksitas = [
    barisSebaran('L1', NAMA_KOMPLEKSITAS_TKA.L1, sb.k[0], MAKS_MTK_KOMPLEKSITAS[0]),
    barisSebaran('L2', NAMA_KOMPLEKSITAS_TKA.L2, sb.k[1], MAKS_MTK_KOMPLEKSITAS[1]),
  ]
  const skor = sb.k[0] + sb.k[1]
  const maks = MAKS_MTK_KOMPLEKSITAS[0] + MAKS_MTK_KOMPLEKSITAS[1]
  return { skor, maks, kompleksitas, materi }
}

/**
 * Sebaran Bahasa Indonesia dari poin L1–L3. Tipe materi diturunkan karena pembagian soalnya
 * sama persis (L1=Pemahaman Tekstual, L2=Pemahaman Inferensial, L3=Evaluasi dan Apresiasi).
 */
export function bangunSebaranBi(sb: NonNullable<BarisTryOutImport['sbBi']>): SebaranMapelTka {
  const maks = sb.maks ?? MAKS_BI_KOMPLEKSITAS
  const nama = MATERI_TKA['TKA Bahasa Indonesia'] // Tekstual, Inferensial, Evaluasi
  const kompleksitas = [
    barisSebaran('L1', NAMA_KOMPLEKSITAS_TKA.L1, sb.k[0], maks[0]),
    barisSebaran('L2', NAMA_KOMPLEKSITAS_TKA.L2, sb.k[1], maks[1]),
    barisSebaran('L3', NAMA_KOMPLEKSITAS_TKA.L3, sb.k[2], maks[2]),
  ]
  const materi = nama.map((n, i) => barisSebaran(n, n, sb.k[i], maks[i]))
  const out: SebaranMapelTka = {
    skor: sb.k[0] + sb.k[1] + sb.k[2],
    maks: maks[0] + maks[1] + maks[2],
    kompleksitas,
    materi,
  }
  if (sb.waktuHabis) out.waktuHabis = true
  return out
}


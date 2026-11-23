/**
 * Kisi-kisi soal dari paket soal atau kuis guru (ANTIREGRESI §Kisi-kisi).
 *
 * Kolom: No · TP · Materi · Indikator soal · Level kognitif (L1–L3) · Bentuk soal · Poin · (Waktu) · (Domain TKA) · (Kunci).
 * - TP & materi diturunkan dari paket asal soal (kuis menyimpan soal sebagai salinan + sumberPaketId).
 * - Indikator soal = `soal.indikator` (diisi guru di editor soal); kosong tetap kosong — tidak dikarang.
 * - Keluaran: Word (.doc, lanskap, kop sekolah), Excel (.xlsx, 2 lembar), cetak/PDF lewat dialog cetak browser.
 */
import type { PaketSoal, Soal, TipeSoal, KompleksitasSoal } from '../types/soal'
import {
  NAMA_TIPE,
  NAMA_KOMPLEKSITAS,
  NAMA_DOMAIN_TKA,
  URUTAN_TIPE,
  URUTAN_KOMPLEKSITAS,
  normalisasiKompleksitas,
  normalisasiDomainTka,
} from '../types/soal'
import type { KuisLms } from '../types/kuis'
import { teksPolos } from './html'
import { ambilPaket } from './soal'
import { blobXlsx, unduhBlob, type LembarEks, type SelEks } from './exportTabel'
import { htmlKop, esc } from './exportKuisCetak'

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export type OpsiKisiKisi = {
  /** Sertakan kolom kunci jawaban (versi guru). Bawaan: tidak. */
  sertakanKunci?: boolean
  /** Sertakan kolom estimasi waktu. Bawaan: ya. */
  sertakanWaktu?: boolean
  /** Tahun pelajaran untuk kop. */
  tahunPelajaran?: string
}

export type BarisKisiKisi = {
  no: number
  tp: string
  materi: string
  indikator: string
  level: KompleksitasSoal
  bentuk: TipeSoal
  poin: number
  waktu: number
  domain: string
  kunci: string
}

export type RekapKisiKisi = {
  jumlahSoal: number
  totalPoin: number
  totalWaktu: number
  perBentuk: { nama: string; jumlah: number; poin: number }[]
  perLevel: { nama: string; jumlah: number; poin: number }[]
  perTp: { nama: string; jumlah: number; poin: number }[]
}

export type DataKisiKisi = {
  judul: string
  kelas: string
  mapel: string
  baris: BarisKisiKisi[]
  rekap: RekapKisiKisi
  /** Jumlah soal tanpa indikator (untuk peringatan). */
  tanpaIndikator: number
  adaDomain: boolean
}

/* ───────────────────────── Penyusunan data ───────────────────────── */

/** Label TP sebuah paket: «TP 3. Nama». */
export function labelTpPaket(p: Pick<PaketSoal, 'tpNomor' | 'tpNama' | 'tpId'> | null | undefined): string {
  if (!p) return ''
  const nama = (p.tpNama || '').trim()
  if (!nama && !p.tpNomor) return ''
  return `${p.tpNomor ? `TP ${p.tpNomor}. ` : ''}${nama}`.trim()
}

/** Teks kunci jawaban singkat untuk tabel (bukan pembahasan). */
export function kunciSingkat(s: Soal): string {
  switch (s.tipe) {
    case 'pg': {
      const i = s.opsi.findIndex((o) => o.id === s.kunci)
      return i >= 0 ? HURUF[i] : ''
    }
    case 'pgk':
      return s.opsi
        .map((o, i) => (s.kunci.includes(o.id) ? HURUF[i] : ''))
        .filter(Boolean)
        .join(', ')
    case 'bs':
      return s.pernyataan
        .map((p, i) => `${i + 1}${p.benar ? (s.labelBenar || 'B')[0] : (s.labelSalah || 'S')[0]}`)
        .join(' ')
    case 'jodoh':
      return s.pasangan.map((p, i) => `${i + 1}→${teksPolos(p.kanan).slice(0, 18)}`).join('; ')
    case 'isian':
      return s.kunci.join(' / ')
    case 'uraian':
      return teksPolos(s.kunciJawaban).slice(0, 120) || 'Rubrik penskoran'
  }
}

type KonteksSoal = { tp: string; materi: string }

function barisDari(soalList: Soal[], konteks: (s: Soal, i: number) => KonteksSoal): BarisKisiKisi[] {
  return soalList.map((s, i) => {
    const k = konteks(s, i)
    const domain = normalisasiDomainTka(s.domainTka)
    return {
      no: i + 1,
      tp: k.tp,
      materi: (s.tipeMateri || '').trim() || k.materi,
      indikator: (s.indikator || '').trim(),
      level: normalisasiKompleksitas(s.kompleksitas),
      bentuk: s.tipe,
      poin: Number(s.poin) || 0,
      waktu: Number(s.waktuMenit) || 0,
      domain: domain ? NAMA_DOMAIN_TKA[domain] : '',
      kunci: kunciSingkat(s),
    }
  })
}

function rekapDari(baris: BarisKisiKisi[]): RekapKisiKisi {
  const tambah = (m: Map<string, { jumlah: number; poin: number }>, k: string, poin: number) => {
    const v = m.get(k) ?? { jumlah: 0, poin: 0 }
    v.jumlah += 1
    v.poin += poin
    m.set(k, v)
  }
  const bentuk = new Map<string, { jumlah: number; poin: number }>()
  const level = new Map<string, { jumlah: number; poin: number }>()
  const tp = new Map<string, { jumlah: number; poin: number }>()
  for (const b of baris) {
    tambah(bentuk, b.bentuk, b.poin)
    tambah(level, b.level, b.poin)
    tambah(tp, b.tp || '(TP belum diisi)', b.poin)
  }
  return {
    jumlahSoal: baris.length,
    totalPoin: baris.reduce((a, b) => a + b.poin, 0),
    totalWaktu: baris.reduce((a, b) => a + b.waktu, 0),
    perBentuk: URUTAN_TIPE.filter((t) => bentuk.has(t)).map((t) => ({ nama: NAMA_TIPE[t], ...bentuk.get(t)! })),
    perLevel: URUTAN_KOMPLEKSITAS.filter((l) => level.has(l)).map((l) => ({ nama: NAMA_KOMPLEKSITAS[l], ...level.get(l)! })),
    perTp: [...tp.entries()].map(([nama, v]) => ({ nama, ...v })),
  }
}

function lengkapiData(
  judul: string,
  kelas: string,
  mapel: string,
  baris: BarisKisiKisi[],
): DataKisiKisi {
  return {
    judul,
    kelas,
    mapel,
    baris,
    rekap: rekapDari(baris),
    tanpaIndikator: baris.filter((b) => !b.indikator).length,
    adaDomain: baris.some((b) => b.domain),
  }
}

/** Kisi-kisi dari satu paket soal (tanpa akses jaringan). */
export function kisiKisiDariPaket(p: PaketSoal): DataKisiKisi {
  const tp = labelTpPaket(p)
  const baris = barisDari(p.soal ?? [], () => ({
    tp,
    materi: (p.tipeMateri || '').trim() || p.judul,
  }))
  return lengkapiData(p.judul, p.kelas, p.mapel, baris)
}

/**
 * Kisi-kisi dari kuis. Soal kuis adalah salinan; TP/materi diambil dari paket asalnya
 * (`sumberPaketId`). Paket yang tidak bisa dibaca → TP dari `kuis.tpNamaList`.
 */
export async function kisiKisiDariKuis(kuis: KuisLms): Promise<DataKisiKisi> {
  const idPaket = [...new Set((kuis.soal ?? []).map((s) => s.sumberPaketId).filter(Boolean))]
  const peta = new Map<string, PaketSoal | null>()
  await Promise.all(
    idPaket.map(async (id) => {
      try {
        peta.set(id, await ambilPaket(id))
      } catch {
        peta.set(id, null)
      }
    }),
  )
  const tpKuis = (kuis.tpNamaList ?? []).filter(Boolean).join('; ')
  // Soal kuis adalah salinan lama: indikator yang baru diisi di paket asal ikut dipakai
  // bila salinannya belum punya (tanpa harus menyusun ulang kuis).
  const soalKuis = (kuis.soal ?? []).map((s) => {
    if (s.indikator) return s
    const asal = peta.get(s.sumberPaketId)?.soal?.find((x) => x.id === s.sumberSoalId)
    return asal?.indikator ? ({ ...s, indikator: asal.indikator } as typeof s) : s
  })
  const baris = barisDari(soalKuis, (s) => {
    const sk = s as Soal & { sumberPaketId?: string; sumberPaketJudul?: string }
    const paket = sk.sumberPaketId ? peta.get(sk.sumberPaketId) ?? null : null
    return {
      tp: labelTpPaket(paket) || tpKuis,
      materi: (paket?.tipeMateri || '').trim() || sk.sumberPaketJudul || paket?.judul || '',
    }
  })
  return lengkapiData(kuis.judul, kuis.kelas, kuis.mapel, baris)
}

/* ───────────────────────── Keluaran ───────────────────────── */

function angka(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

function namaBerkas(d: DataKisiKisi, ekstensi: string): string {
  const aman = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `kisi-kisi-${aman(d.mapel)}-${aman(d.judul) || 'kuis'}.${ekstensi}`
}

function kolomUtama(opsi: OpsiKisiKisi, d: DataKisiKisi): { kepala: string; ambil: (b: BarisKisiKisi) => string | number }[] {
  const k: { kepala: string; ambil: (b: BarisKisiKisi) => string | number }[] = [
    { kepala: 'No', ambil: (b) => b.no },
    { kepala: 'Tujuan Pembelajaran', ambil: (b) => b.tp },
    { kepala: 'Materi', ambil: (b) => b.materi },
    { kepala: 'Indikator Soal', ambil: (b) => b.indikator },
    { kepala: 'Level Kognitif', ambil: (b) => NAMA_KOMPLEKSITAS[b.level] },
    { kepala: 'Bentuk Soal', ambil: (b) => NAMA_TIPE[b.bentuk] },
    { kepala: 'Poin', ambil: (b) => b.poin },
  ]
  if (opsi.sertakanWaktu !== false) k.push({ kepala: 'Waktu (menit)', ambil: (b) => b.waktu })
  if (d.adaDomain) k.push({ kepala: 'Domain', ambil: (b) => b.domain })
  if (opsi.sertakanKunci) k.push({ kepala: 'Kunci', ambil: (b) => b.kunci })
  return k
}

/** Dua lembar Excel: «Kisi-kisi» dan «Ringkasan». */
export function lembarKisiKisi(d: DataKisiKisi, opsi: OpsiKisiKisi = {}): LembarEks[] {
  const kol = kolomUtama(opsi, d)
  const utama: LembarEks = {
    nama: 'Kisi-kisi',
    kolom: kol.map((k) => k.kepala),
    baris: d.baris.map((b) => kol.map((k) => k.ambil(b) as SelEks)),
    lebar: kol.map((k) => ({ No: 5, 'Tujuan Pembelajaran': 40, Materi: 28, 'Indikator Soal': 52 }[k.kepala] ?? 16)),
    bekukanKolom: 1,
  }
  const ring: SelEks[][] = []
  ring.push(['Judul', d.judul, '', ''])
  ring.push(['Mata pelajaran', d.mapel, '', ''])
  ring.push(['Kelas', d.kelas, '', ''])
  ring.push(['Jumlah soal', d.rekap.jumlahSoal, '', ''])
  ring.push(['Total poin', d.rekap.totalPoin, '', ''])
  ring.push(['Total estimasi waktu (menit)', d.rekap.totalWaktu, '', ''])
  ring.push(['', '', '', ''])
  const blok = (judul: string, rows: { nama: string; jumlah: number; poin: number }[]) => {
    ring.push([judul, 'Jumlah soal', 'Poin', ''])
    for (const r of rows) ring.push([r.nama, r.jumlah, r.poin, ''])
    ring.push(['', '', '', ''])
  }
  blok('Sebaran per bentuk soal', d.rekap.perBentuk)
  blok('Sebaran per level kognitif', d.rekap.perLevel)
  blok('Sebaran per tujuan pembelajaran', d.rekap.perTp)
  const ringkasan: LembarEks = { nama: 'Ringkasan', kolom: ['Keterangan', 'Nilai', '', ''], baris: ring, lebar: [46, 16, 10, 4] }
  return [utama, ringkasan]
}

export function unduhKisiKisiXlsx(d: DataKisiKisi, opsi: OpsiKisiKisi = {}): void {
  unduhBlob(blobXlsx(lembarKisiKisi(d, opsi)), namaBerkas(d, 'xlsx'))
}

/** HTML lengkap (dipakai Word dan cetak). Lanskap A4. */
export function htmlKisiKisi(d: DataKisiKisi, opsi: OpsiKisiKisi = {}): string {
  const kol = kolomUtama(opsi, d)
  const tahun = opsi.tahunPelajaran?.trim() || '2026/2027'
  const sel = (v: string | number) => esc(String(v))
  // Lebar kolom (persen) — atribut HTML dasar agar Word/LibreOffice/Chrome sama.
  const LEBAR: Record<string, number> = {
    No: 4,
    'Tujuan Pembelajaran': 20,
    Materi: 14,
    'Indikator Soal': 28,
    'Level Kognitif': 9,
    'Bentuk Soal': 9,
    Poin: 5,
    'Waktu (menit)': 6,
    Domain: 10,
    Kunci: 9,
  }
  const kepala = kol.map((k) => `<th width="${LEBAR[k.kepala] ?? 8}%">${esc(k.kepala)}</th>`).join('')
  const isi = d.baris
    .map(
      (b) =>
        `<tr>${kol
          .map((k, i) => {
            const v = k.ambil(b)
            const kelas = k.kepala === 'No' || k.kepala === 'Poin' || k.kepala.startsWith('Waktu') ? ' class="c" align="center"' : ''
            return `<td${kelas}>${i === 0 ? sel(v) : sel(v) || '&nbsp;'}</td>`
          })
          .join('')}</tr>`,
    )
    .join('')
  const rekapTabel = (judul: string, rows: { nama: string; jumlah: number; poin: number }[]) =>
    `<table class="rekap" border="1" cellspacing="0" cellpadding="3"><tr><th>${esc(judul)}</th><th>Soal</th><th>Poin</th></tr>` +
    rows.map((r) => `<tr><td>${esc(r.nama)}</td><td class="c" align="center">${r.jumlah}</td><td class="c" align="center">${angka(r.poin)}</td></tr>`).join('') +
    `</table>`
  return (
    `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Kisi-kisi ${esc(d.judul)}</title>` +
    `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->` +
    `<style>` +
    `@page { size: 29.7cm 21cm; margin: 1.5cm; mso-page-orientation: landscape; }` +
    `body { font-family: 'Times New Roman', serif; font-size: 11pt; }` +
    `table.kop { width: 100%; border-collapse: collapse; } table.kop td { vertical-align: middle; }` +
    `.kop-logo { width: 70px; text-align: center; } .kop-tengah { text-align: center; }` +
    `.sekolah { font-size: 14pt; font-weight: bold; margin: 0; } .judul-utama { font-size: 13pt; font-weight: bold; margin: 2px 0; } .tahun { margin: 0; font-size: 11pt; }` +
    `.garis-ganda { border-top: 3px double #000; margin: 4px 0 8px; }` +
    `table.kisi { width: 100%; border-collapse: collapse; margin-top: 6px; }` +
    `table.kisi th, table.kisi td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; font-size: 10pt; }` +
    `table.kisi th { background: #e8eef7; text-align: center; } table.kisi thead { display: table-header-group; } table.kisi tr { page-break-inside: avoid; }` +
    `.c { text-align: center; } table.identitas td { padding: 1px 8px 1px 0; font-size: 11pt; }` +
    `table.rekap { border-collapse: collapse; margin: 10px 0 0 0; }` +
    `table.rekap th, table.rekap td { border: 1px solid #000; padding: 2px 6px; font-size: 10pt; } table.rekap th { background: #e8eef7; }` +
    `.cat { font-size: 9pt; color: #444; margin-top: 8px; }` +
    `</style></head><body>` +
    htmlKop(`KISI-KISI ${d.judul.toUpperCase()}`, tahun) +
    `<table class="identitas"><tr><td>Mata pelajaran</td><td>: ${esc(d.mapel)}</td><td>Kelas</td><td>: ${esc(d.kelas)}</td>` +
    `<td>Jumlah soal</td><td>: ${d.rekap.jumlahSoal}</td><td>Total poin</td><td>: ${angka(d.rekap.totalPoin)}</td></tr></table>` +
    `<table class="kisi" border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr>${kepala}</tr></thead><tbody>${isi}</tbody></table>` +
    `<p style="margin:10px 0 0"><b>Ringkasan sebaran soal</b></p>` +
    `${rekapTabel('Bentuk soal', d.rekap.perBentuk)}<br/>${rekapTabel('Level kognitif', d.rekap.perLevel)}<br/>${rekapTabel('Tujuan pembelajaran', d.rekap.perTp)}` +
    `<p class="cat">Level kognitif: L1 mengingat/mengenali; L2 memahami/menerapkan; L3 menganalisis/menalar.</p>` +
    `</body></html>`
  )
}

export function unduhKisiKisiWord(d: DataKisiKisi, opsi: OpsiKisiKisi = {}): void {
  const blob = new Blob(['\ufeff', htmlKisiKisi(d, opsi)], { type: 'application/msword' })
  unduhBlob(blob, namaBerkas(d, 'doc'))
}

/** Cetak / simpan PDF lewat dialog cetak browser (iframe tersembunyi, tanpa popup). */
export function cetakKisiKisi(d: DataKisiKisi, opsi: OpsiKisiKisi = {}): void {
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(f)
  const w = f.contentWindow
  if (!w) {
    f.remove()
    throw new Error('Tidak bisa membuka dialog cetak.')
  }
  w.document.open()
  w.document.write(htmlKisiKisi(d, opsi))
  w.document.close()
  setTimeout(() => {
    w.focus()
    w.print()
    setTimeout(() => f.remove(), 2000)
  }, 400)
}

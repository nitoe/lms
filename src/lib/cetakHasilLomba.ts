/**
 * Cetak rekapitulasi hasil kuis Lomba — A4 portrait, siap print / Simpan PDF.
 *
 * Pola sama kartu peserta & cetakKuisPdf: `window.open` SINKRON di awal klik pengguna,
 * HTML diisi setelah data siap. ANTIREGRESI §Lomba.30.
 */

import type { Lomba } from '../types/lomba'
import { TINGKAT_LOMBA } from '../types/lomba'
import type { KuisLms, SoalKuis } from '../types/kuis'
import type { JawabanKuis } from './jawabanKuis'
import { skorKe100 } from './jawabanKuis'

const NAMA_SEKOLAH = 'SD Muhammadiyah 01 Kukusan'

export type BarisCetakHasilLomba = {
  siswaId: string
  nama: string
  kelas: string
  /** null = belum mengerjakan */
  jawaban: JawabanKuis | null
}

export type OpsiCetakHasilLomba = {
  /** Nama petugas yang mencetak (opsional, footer). */
  dicetakOleh?: string
  /** Tampilkan kolom skor per mapel sumber (kuis Gabungan). Default: true bila ada sumberMapel. */
  kolomMapelSumber?: boolean
}

export type HasilCetakHasilLomba = {
  jumlahPeserta: number
  jumlahMengerjakan: number
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tglPanjang(d: Date): string {
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function tglPendek(d: Date): string {
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
}

function teksMasa(l: Lomba): string {
  if (l.mulai && l.selesai) {
    return l.mulai.toDateString() === l.selesai.toDateString()
      ? tglPendek(l.mulai)
      : `${tglPendek(l.mulai)} – ${tglPendek(l.selesai)}`
  }
  if (l.mulai) return `Mulai ${tglPendek(l.mulai)}`
  if (l.selesai) return `Sampai ${tglPendek(l.selesai)}`
  return '—'
}

function skorPerMapelSumber(
  jawaban: JawabanKuis | null,
  soalList: SoalKuis[],
  mapel: string,
): { skor: number; maks: number } {
  let skor = 0
  let maks = 0
  const byId = jawaban?.detail
    ? new Map(jawaban.detail.map((d) => [d.soalId, d]))
    : null
  for (const s of soalList) {
    if ((s.sumberMapel || '') !== mapel) continue
    maks += Number(s.poin) || 0
    if (byId) skor += Number(byId.get(s.id)?.skor) || 0
  }
  return { skor, maks }
}

function daftarMapelSumber(soalList: SoalKuis[]): string[] {
  const set = new Set<string>()
  for (const s of soalList) {
    if (s.sumberMapel) set.add(s.sumberMapel)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'id'))
}

type BarisRank = {
  rank: number | null
  nama: string
  kelas: string
  skor: number | null
  maks: number | null
  nilai100: number | null
  status: string
  perMapel: { mapel: string; skor: number; maks: number; nilai100: number }[]
}

/**
 * Urut: sudah mengerjakan (nilai 100 desc, skor raw desc, nama) → belum mengerjakan (nama).
 * Peringkat kompetisi: 1, 2, 2, 4 (tie sama rank, lompat nomor berikutnya).
 */
export function susunPeringkat(
  baris: BarisCetakHasilLomba[],
  soalList: SoalKuis[],
  mapelSumber: string[],
): BarisRank[] {
  const sudah: BarisRank[] = []
  const belum: BarisRank[] = []

  for (const b of baris) {
    const j = b.jawaban
    const perMapel = mapelSumber.map((m) => {
      const { skor, maks } = skorPerMapelSumber(j, soalList, m)
      return {
        mapel: m,
        skor,
        maks,
        nilai100: maks > 0 ? skorKe100(skor, maks) : 0,
      }
    })
    if (!j) {
      belum.push({
        rank: null,
        nama: b.nama,
        kelas: b.kelas,
        skor: null,
        maks: null,
        nilai100: null,
        status: 'Belum mengerjakan',
        perMapel,
      })
      continue
    }
    const nilai100 = skorKe100(j.skorOtomatis, j.totalPoin)
    sudah.push({
      rank: 0,
      nama: b.nama,
      kelas: b.kelas,
      skor: j.skorOtomatis,
      maks: j.totalPoin,
      nilai100,
      status: j.status === 'sebagian_manual' ? 'Perlu nilai manual' : 'Selesai',
      perMapel,
    })
  }

  sudah.sort((a, b) => {
    const na = a.nilai100 ?? -1
    const nb = b.nilai100 ?? -1
    if (nb !== na) return nb - na
    const sa = a.skor ?? -1
    const sb = b.skor ?? -1
    if (sb !== sa) return sb - sa
    return a.nama.localeCompare(b.nama, 'id')
  })
  belum.sort(
    (a, b) =>
      a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
      a.nama.localeCompare(b.nama, 'id'),
  )

  // Rank kompetisi
  let i = 0
  while (i < sudah.length) {
    const n = sudah[i].nilai100
    const s = sudah[i].skor
    let j = i + 1
    while (
      j < sudah.length &&
      sudah[j].nilai100 === n &&
      sudah[j].skor === s
    ) {
      j += 1
    }
    const rank = i + 1
    for (let k = i; k < j; k++) sudah[k].rank = rank
    i = j
  }

  return [...sudah, ...belum]
}

async function muatLogo(): Promise<string> {
  try {
    const r = await fetch('/logo-sdm.png', { cache: 'force-cache' })
    if (!r.ok) return ''
    const b = await r.blob()
    if (!b.type.startsWith('image/')) return ''
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.onerror = () => rej(fr.error)
      fr.readAsDataURL(b)
    })
  } catch (e) {
    console.warn('cetakHasilLomba: logo tidak dapat dimuat', e)
    return ''
  }
}

const CSS = `
@page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
body {
  font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #0f172a; background: #e2e8f0;
  font-size: 10.5pt; line-height: 1.35;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.no-print { font-size: 13px }
.bar {
  position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px;
  justify-content: space-between; padding: 10px 16px; background: #7c2d12; color: #fff;
}
.bar strong { display: block; font-size: 14px }
.bar span { font-size: 12px; opacity: .9 }
.bar button {
  border: 0; border-radius: 999px; padding: 9px 20px; font: 700 13px inherit;
  background: #fff; color: #9a3412; cursor: pointer;
}
.bar button:hover { background: #fff7ed }
.lembar {
  width: 210mm; min-height: 296.5mm; margin: 0 auto 10mm; padding: 12mm 14mm 14mm;
  background: #fff; box-shadow: 0 2px 14px rgba(15,23,42,.12);
}
.kop {
  display: grid; grid-template-columns: 18mm 1fr 18mm; gap: 4mm; align-items: center;
  padding-bottom: 3.5mm; border-bottom: 1.6pt solid #7c2d12;
}
.kop .logo { width: 16mm; height: 16mm; object-fit: contain }
.kop .logo-kosong { width: 16mm; height: 16mm; border: .4mm dashed #cbd5e1; border-radius: 2mm }
.kop .tengah { text-align: center }
.kop .sekolah {
  margin: 0; font-size: 11pt; font-weight: 800; letter-spacing: .04em;
  text-transform: uppercase; color: #7c2d12;
}
.kop .judul {
  margin: 1mm 0 0; font-size: 13.5pt; font-weight: 800; letter-spacing: -.01em; color: #0f172a;
}
.kop .sub {
  margin: 0.8mm 0 0; font-size: 8.5pt; color: #64748b; font-weight: 600;
}
.identitas {
  margin-top: 4mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 8mm;
  font-size: 9pt;
}
.identitas .row { display: grid; grid-template-columns: 28mm 1fr; gap: 1.5mm; }
.identitas .l { color: #64748b; font-weight: 600 }
.identitas .v { font-weight: 700; color: #0f172a }
.identitas .v.lebar { font-weight: 800 }
.ringkas {
  margin-top: 4mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm;
}
.ringkas .box {
  border: .35mm solid #e2e8f0; border-radius: 2mm; padding: 2.2mm 2.8mm;
  background: #f8fafc; text-align: center;
}
.ringkas .box .n {
  display: block; font-size: 14pt; font-weight: 800; color: #9a3412; line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.ringkas .box .k {
  display: block; margin-top: 0.6mm; font-size: 7.5pt; font-weight: 700;
  text-transform: uppercase; letter-spacing: .04em; color: #64748b;
}
.sec {
  margin: 5mm 0 2mm; font-size: 9.5pt; font-weight: 800; color: #7c2d12;
  letter-spacing: .02em; text-transform: uppercase;
}
table.rekap {
  width: 100%; border-collapse: collapse; font-size: 9pt;
}
table.rekap th, table.rekap td {
  border: .3mm solid #cbd5e1; padding: 1.8mm 2.2mm; vertical-align: middle;
}
table.rekap th {
  background: #fff7ed; color: #9a3412; font-size: 7.6pt; font-weight: 800;
  text-transform: uppercase; letter-spacing: .03em; text-align: center;
}
table.rekap td.num { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700 }
table.rekap td.nama { font-weight: 700; color: #0f172a }
table.rekap td.muted { color: #94a3b8; font-weight: 600; text-align: center }
table.rekap tr.top1 td { background: #fef3c7 }
table.rekap tr.top2 td { background: #f1f5f9 }
table.rekap tr.top3 td { background: #fff7ed }
table.rekap tr.belum td { background: #f8fafc; color: #64748b }
.rank-pill {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 6.5mm; height: 6.5mm; padding: 0 1.2mm; border-radius: 999px;
  font-size: 8pt; font-weight: 800; background: #e2e8f0; color: #334155;
}
.rank-pill.r1 { background: #fbbf24; color: #78350f }
.rank-pill.r2 { background: #cbd5e1; color: #1e293b }
.rank-pill.r3 { background: #fdba74; color: #7c2d12 }
.ttd {
  margin-top: 8mm; display: grid; grid-template-columns: 1fr 1fr; gap: 12mm;
  font-size: 9pt; page-break-inside: avoid;
}
.ttd .blok { text-align: center }
.ttd .label { color: #64748b; font-weight: 600; margin-bottom: 14mm }
.ttd .nama { font-weight: 800; border-top: .3mm solid #94a3b8; padding-top: 1.5mm; display: inline-block; min-width: 45mm }
.ttd .jab { font-size: 8pt; color: #64748b; margin-top: 0.5mm }
.kaki {
  margin-top: 6mm; padding-top: 2mm; border-top: .25mm solid #e2e8f0;
  font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; gap: 4mm;
}
@media print {
  body { background: #fff }
  .no-print { display: none !important }
  .lembar { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0 }
}
`

function htmlDokumen(args: {
  lomba: Lomba
  kuis: KuisLms
  ranks: BarisRank[]
  mapelSumber: string[]
  logo: string
  dicetakOleh: string
  ringkas: {
    peserta: number
    mengerjakan: number
    rata: number | null
    tertinggi: number | null
  }
}): string {
  const { lomba, kuis, ranks, mapelSumber, logo, dicetakOleh, ringkas } = args
  const sekarang = new Date()
  const pengampu =
    lomba.guruPengampuList?.map((p) => p.nama).filter(Boolean).join(', ') ||
    lomba.guruPengampuNama ||
    '—'
  const mapelTeks =
    kuis.mapel === 'Gabungan' || (lomba.mapelTerkait?.length ?? 0) > 1
      ? (lomba.mapelTerkait || []).join(', ') || kuis.mapel
      : kuis.mapel || (lomba.mapelTerkait || []).join(', ') || '—'

  const nKolomMapel = mapelSumber.length
  const colSpanMeta = 6 + nKolomMapel

  const rows = ranks
    .map((r) => {
      const isBelum = r.rank == null
      const cls = isBelum
        ? 'belum'
        : r.rank === 1
          ? 'top1'
          : r.rank === 2
            ? 'top2'
            : r.rank === 3
              ? 'top3'
              : ''
      const rankHtml = isBelum
        ? '<span class="muted">—</span>'
        : `<span class="rank-pill ${r.rank! <= 3 ? `r${r.rank}` : ''}">${r.rank}</span>`
      const nilaiHtml =
        r.nilai100 == null
          ? '<td class="muted">—</td>'
          : `<td class="num">${esc(
              Number.isInteger(r.nilai100)
                ? String(r.nilai100)
                : r.nilai100.toLocaleString('id-ID', { maximumFractionDigits: 1 }),
            )}</td>`
      const skorHtml =
        r.skor == null || r.maks == null
          ? '<td class="muted">—</td>'
          : `<td class="num">${esc(String(r.skor))}<span style="font-weight:600;color:#94a3b8">/${esc(String(r.maks))}</span></td>`
      const mapelCols = mapelSumber
        .map((m) => {
          const pm = r.perMapel.find((x) => x.mapel === m)
          if (isBelum || !pm || pm.maks <= 0) return '<td class="muted">—</td>'
          const n = Number.isInteger(pm.nilai100)
            ? String(pm.nilai100)
            : pm.nilai100.toLocaleString('id-ID', { maximumFractionDigits: 1 })
          return `<td class="num" title="${esc(String(pm.skor))}/${esc(String(pm.maks))}">${esc(n)}</td>`
        })
        .join('')
      return `<tr class="${cls}">
        <td class="num">${rankHtml}</td>
        <td class="nama">${esc(r.nama)}</td>
        <td class="num">${esc(r.kelas)}</td>
        ${skorHtml}
        ${nilaiHtml}
        ${mapelCols}
        <td class="num" style="font-size:8pt;font-weight:600">${esc(r.status)}</td>
      </tr>`
    })
    .join('\n')

  const headMapel = mapelSumber
    .map(
      (m) =>
        `<th title="Capaian ${esc(m)}">${esc(m.length > 14 ? m.slice(0, 12) + '…' : m)}</th>`,
    )
    .join('')

  const rataTeks =
    ringkas.rata == null
      ? '—'
      : Number.isInteger(ringkas.rata)
        ? String(ringkas.rata)
        : ringkas.rata.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  const maxTeks =
    ringkas.tertinggi == null
      ? '—'
      : Number.isInteger(ringkas.tertinggi)
        ? String(ringkas.tertinggi)
        : ringkas.tertinggi.toLocaleString('id-ID', { maximumFractionDigits: 1 })

  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="Logo" />`
    : '<div class="logo-kosong"></div>'

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Rekap Hasil — ${esc(lomba.nama)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="no-print bar">
    <div>
      <strong>Pratinjau rekap hasil lomba</strong>
      <span>${esc(lomba.nama)} · ${ringkas.mengerjakan}/${ringkas.peserta} mengerjakan</span>
    </div>
    <button type="button" onclick="window.print()">Cetak / Simpan PDF</button>
  </div>

  <div class="lembar">
    <header class="kop">
      ${logoHtml}
      <div class="tengah">
        <p class="sekolah">${esc(NAMA_SEKOLAH)}</p>
        <h1 class="judul">Rekapitulasi Hasil Lomba</h1>
        <p class="sub">${esc(lomba.nama)}</p>
      </div>
      ${logoHtml}
    </header>

    <div class="identitas">
      <div class="row"><span class="l">Nama lomba</span><span class="v lebar">${esc(lomba.nama)}</span></div>
      <div class="row"><span class="l">Tingkat</span><span class="v">${esc(labelTingkat(lomba.tingkat))}</span></div>
      <div class="row"><span class="l">Kuis</span><span class="v">${esc(kuis.judul || '—')}</span></div>
      <div class="row"><span class="l">Mapel</span><span class="v">${esc(mapelTeks)}</span></div>
      <div class="row"><span class="l">Pelaksanaan</span><span class="v">${esc(teksMasa(lomba))}</span></div>
      <div class="row"><span class="l">Pengampu</span><span class="v">${esc(pengampu)}</span></div>
      ${lomba.identitas ? `<div class="row"><span class="l">Identitas</span><span class="v">${esc(lomba.identitas)}</span></div><div class="row"></div>` : ''}
    </div>

    <div class="ringkas">
      <div class="box"><span class="n">${ringkas.peserta}</span><span class="k">Peserta</span></div>
      <div class="box"><span class="n">${ringkas.mengerjakan}</span><span class="k">Mengerjakan</span></div>
      <div class="box"><span class="n">${esc(rataTeks)}</span><span class="k">Rata-rata</span></div>
      <div class="box"><span class="n">${esc(maxTeks)}</span><span class="k">Tertinggi</span></div>
    </div>

    <p class="sec">Peringkat peserta</p>
    <table class="rekap">
      <thead>
        <tr>
          <th style="width:10mm">Peringkat</th>
          <th>Nama peserta</th>
          <th style="width:14mm">Kelas</th>
          <th style="width:18mm">Skor</th>
          <th style="width:14mm">Nilai</th>
          ${headMapel}
          <th style="width:22mm">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="${colSpanMeta}" class="muted">Belum ada data peserta.</td></tr>`}
      </tbody>
    </table>

    <div class="ttd">
      <div class="blok">
        <div class="label">Mengetahui,<br/>Kepala Sekolah</div>
        <div class="nama">&nbsp;</div>
        <div class="jab">NIP. …</div>
      </div>
      <div class="blok">
        <div class="label">${esc(NAMA_SEKOLAH)}<br/>${tglPendek(sekarang)}</div>
        <div class="nama">${esc(dicetakOleh || pengampu || 'Pengampu Lomba')}</div>
        <div class="jab">Pengampu / Panitia</div>
      </div>
    </div>

    <div class="kaki">
      <span>Dicetak ${esc(tglPanjang(sekarang))} · LMS ${esc(NAMA_SEKOLAH)}</span>
      <span>Nilai = skor ÷ total poin × 100 · Peringkat kompetisi (nilai sama = peringkat sama)</span>
    </div>
  </div>
</body>
</html>`
}

/**
 * Buka jendela cetak rekap hasil lomba.
 * @param winRef jendela yang sudah dibuka sinkron di handler klik (`window.open('about:blank')`).
 */
export async function cetakHasilLomba(
  win: Window | null,
  input: {
    lomba: Lomba
    kuis: KuisLms
    baris: BarisCetakHasilLomba[]
    opsi?: OpsiCetakHasilLomba
  },
): Promise<HasilCetakHasilLomba> {
  if (!win || win.closed) {
    throw new Error('Jendela cetak diblokir. Izinkan pop-up untuk situs ini, lalu coba lagi.')
  }

  const soalList = (input.kuis.soal ?? []) as SoalKuis[]
  const mapelSemua = daftarMapelSumber(soalList)
  const pakaiMapel =
    input.opsi?.kolomMapelSumber === false ? [] : mapelSemua.length >= 2 ? mapelSemua : []

  const ranks = susunPeringkat(input.baris, soalList, pakaiMapel)

  const sudah = ranks.filter((r) => r.nilai100 != null)
  let sum = 0
  let max: number | null = null
  for (const r of sudah) {
    const n = r.nilai100!
    sum += n
    if (max == null || n > max) max = n
  }
  const rata = sudah.length ? Math.round((sum / sudah.length) * 10) / 10 : null

  const logo = await muatLogo()
  const html = htmlDokumen({
    lomba: input.lomba,
    kuis: input.kuis,
    ranks,
    mapelSumber: pakaiMapel,
    logo,
    dicetakOleh: input.opsi?.dicetakOleh?.trim() || '',
    ringkas: {
      peserta: ranks.length,
      mengerjakan: sudah.length,
      rata,
      tertinggi: max,
    },
  })

  win.document.open()
  win.document.write(html)
  win.document.close()
  try {
    win.focus()
  } catch {
    /* ignore */
  }

  return {
    jumlahPeserta: ranks.length,
    jumlahMengerjakan: sudah.length,
  }
}

/**
 * Ekspor kuis ke dokumen siap cetak (Word membuka HTML sebagai .doc).
 * Layout mengikuti template Asesmen Sumatif SD Muhammadiyah 01 Kukusan:
 * header, identitas, tabel paraf, soal dikelompokkan per bentuk (PG / isian / uraian).
 * Tanpa dependensi baru — pola sama dengan unduhLaporanDoc (analisisKuisAi).
 * ANTIREGRESI §127.
 */
import type { KuisLms, SoalKuis, JenisPenilaianKuis } from '../types/kuis'
import type { Soal, TipeSoal } from '../types/soal'
import { NAMA_TIPE } from '../types/soal'
import { teksPolos } from './html'

export type OpsiCetakKuis = {
  /** Sertakan kunci jawaban di bagian akhir (versi guru). */
  sertakanKunci?: boolean
  /** Judul dokumen (override). Kosong = diturunkan dari jenis penilaian. */
  judulDokumen?: string
  /** Tahun pelajaran, mis. 2026/2027. */
  tahunPelajaran?: string
  /** Jumlah baris kosong di tabel nama/nilai (default 12). */
  barisParaf?: number
}

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function judulDariJenis(jenis: JenisPenilaianKuis | undefined, mapel: string): string {
  const j = jenis ?? 'latihan'
  if (j === 'sts') return `ASESMEN SUMATIF TENGAH SEMESTER — ${mapel}`
  if (j === 'sas') return `ASESMEN SUMATIF AKHIR SEMESTER — ${mapel}`
  if (j === 'slm') return `ASESMEN SUMATIF LINGKUP MATERI — ${mapel}`
  return `LEMBAR SOAL — ${mapel}`
}

function teksSoal(s: Soal): string {
  return teksPolos(s.teks) || '(tanpa teks soal)'
}

function stimulusHtml(s: Soal): string {
  const st = teksPolos(s.stimulus)
  if (!st) return ''
  return `<div class="stimulus"><em>Bacalah teks berikut!</em><br/>${esc(st)}</div>`
}

/** Kelompokkan: objektif (pg/pgk/bs/jodoh) → isian → uraian, pertahankan urutan dalam kelompok. */
function kelompokkan(soal: SoalKuis[]): {
  objektif: { no: number; s: SoalKuis }[]
  isian: { no: number; s: SoalKuis }[]
  uraian: { no: number; s: SoalKuis }[]
} {
  const objektif: { no: number; s: SoalKuis }[] = []
  const isian: { no: number; s: SoalKuis }[] = []
  const uraian: { no: number; s: SoalKuis }[] = []
  let no = 1
  for (const s of soal) {
    if (s.tipe === 'uraian') uraian.push({ no: no++, s })
    else if (s.tipe === 'isian') isian.push({ no: no++, s })
    else objektif.push({ no: no++, s })
  }
  return { objektif, isian, uraian }
}

function htmlOpsiPg(s: SoalKuis): string {
  const opsi = 'opsi' in s && Array.isArray(s.opsi) ? s.opsi : []
  if (!opsi.length) return ''
  return (
    `<ol class="opsi" type="A">` +
    opsi
      .map((o, i) => {
        const huruf = HURUF[i] ?? String(i + 1)
        return `<li value="${huruf}"><span class="huruf">${huruf}.</span> ${esc(o.teks || '')}</li>`
      })
      .join('') +
    `</ol>`
  )
}

function htmlBs(s: SoalKuis): string {
  if (s.tipe !== 'bs') return ''
  const labelB = s.labelBenar || 'Benar'
  const labelS = s.labelSalah || 'Salah'
  const rows = (s.pernyataan || [])
    .map(
      (p, i) =>
        `<tr><td class="no-per">${i + 1}.</td><td>${esc(teksPolos(p.teks))}</td>` +
        `<td class="bs-col">${esc(labelB)}</td><td class="bs-col">${esc(labelS)}</td></tr>`,
    )
    .join('')
  return `<table class="bs-tbl"><thead><tr><th></th><th>Pernyataan</th><th>${esc(labelB)}</th><th>${esc(labelS)}</th></tr></thead><tbody>${rows}</tbody></table>`
}

function htmlJodoh(s: SoalKuis): string {
  if (s.tipe !== 'jodoh') return ''
  const pasangan = s.pasangan || []
  const kiri = pasangan.map((p, i) => `<li>${i + 1}. ${esc(teksPolos(p.kiri))}</li>`).join('')
  const kanan = pasangan
    .map((p, i) => `<li>${HURUF[i] ?? i + 1}. ${esc(teksPolos(p.kanan))}</li>`)
    .join('')
  return `<div class="jodoh"><div class="jodoh-kol"><strong>Kolom A</strong><ol>${kiri}</ol></div>` +
    `<div class="jodoh-kol"><strong>Kolom B</strong><ol type="A">${kanan}</ol></div></div>` +
    `<p class="petunjuk-kecil">Jodohkan nomor di kolom A dengan huruf di kolom B.</p>`
}

function htmlSatuSoal(item: { no: number; s: SoalKuis }): string {
  const { no, s } = item
  const bagianStimulus = stimulusHtml(s)
  let isi = ''
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    isi = htmlOpsiPg(s)
    if (s.tipe === 'pgk') {
      isi =
        `<p class="petunjuk-kecil">Pilih lebih dari satu jawaban yang benar.</p>` + isi
    }
  } else if (s.tipe === 'bs') {
    isi = htmlBs(s)
  } else if (s.tipe === 'jodoh') {
    isi = htmlJodoh(s)
  } else if (s.tipe === 'isian') {
    isi = `<p class="garis-jawab">Jawaban: _______________________________________________</p>`
  } else if (s.tipe === 'uraian') {
    isi =
      `<div class="ruang-uraian">` +
      Array.from({ length: 5 }, () => `<div class="garis">&nbsp;</div>`).join('') +
      `</div>`
  }
  return (
    `<div class="soal">` +
    `<p class="soal-teks"><strong>${no}.</strong> ${esc(teksSoal(s))}</p>` +
    bagianStimulus +
    isi +
    `</div>`
  )
}

function htmlKunci(soal: SoalKuis[]): string {
  if (!soal.length) return ''
  const baris = soal.map((s, i) => {
    const no = i + 1
    let kunci = '—'
    if (s.tipe === 'pg') {
      const opsi = s.opsi || []
      const idx = opsi.findIndex((o) => o.id === s.kunci)
      kunci = idx >= 0 ? `${HURUF[idx]}. ${opsi[idx].teks}` : String(s.kunci)
    } else if (s.tipe === 'pgk') {
      const opsi = s.opsi || []
      const ids = s.kunci || []
      kunci = ids
        .map((id) => {
          const idx = opsi.findIndex((o) => o.id === id)
          return idx >= 0 ? HURUF[idx] : id
        })
        .join(', ')
    } else if (s.tipe === 'bs') {
      kunci = (s.pernyataan || [])
        .map((p, j) => `${j + 1}=${p.benar ? 'B' : 'S'}`)
        .join('; ')
    } else if (s.tipe === 'jodoh') {
      kunci = (s.pasangan || []).map((_, j) => `${j + 1}→${HURUF[j]}`).join(', ')
    } else if (s.tipe === 'isian') {
      kunci = (s.kunci || []).join(' / ')
    } else if (s.tipe === 'uraian') {
      kunci = teksPolos(s.kunciJawaban) || '(pedoman di sistem)'
    }
    return `<tr><td>${no}</td><td>${esc(NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe)}</td><td>${esc(kunci)}</td></tr>`
  })
  return (
    `<h2 class="bagian">Kunci jawaban (untuk guru)</h2>` +
    `<table class="kunci"><thead><tr><th>No</th><th>Tipe</th><th>Kunci / pedoman</th></tr></thead>` +
    `<tbody>${baris.join('')}</tbody></table>`
  )
}

function htmlTabelParaf(n: number): string {
  const rows = Array.from(
    { length: Math.max(4, n) },
    () =>
      `<tr><td style="height:22px">&nbsp;</td><td></td><td></td><td></td><td></td></tr>`,
  ).join('')
  return (
    `<table class="paraf">` +
    `<thead><tr><th style="width:8%">No.</th><th style="width:36%">Nama</th>` +
    `<th style="width:14%">Nilai</th><th style="width:21%">Paraf Guru</th>` +
    `<th style="width:21%">Paraf Orang Tua</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  )
}

/** Bangun HTML body dokumen cetak. */
export function htmlKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): string {
  const soal = kuis.soal ?? []
  const { objektif, isian, uraian } = kelompokkan(soal)
  const jenis = kuis.jenisPenilaian
  const judul =
    opsi.judulDokumen?.trim() ||
    judulDariJenis(jenis, kuis.mapel || 'Mata Pelajaran')
  const tahun = opsi.tahunPelajaran?.trim() || '2026/2027'
  const tpList = (kuis.tpNamaList ?? []).filter(Boolean)
  const tpHtml = tpList.length
    ? `<ol class="tp">${tpList.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`
    : `<p class="meta-isi">—</p>`

  let body =
    `<div class="header">` +
    `<p class="sekolah">SD MUHAMMADIYAH 01 KUKUSAN</p>` +
    `<h1>${esc(judul)}</h1>` +
    `<p class="tahun">TAHUN PELAJARAN ${esc(tahun)}</p>` +
    `</div>` +
    `<table class="identitas">` +
    `<tr><td class="label">Mata Pelajaran</td><td class="titik">:</td><td>${esc(kuis.mapel || '—')}</td></tr>` +
    `<tr><td class="label">Hari, Tanggal</td><td class="titik">:</td><td>........................................</td></tr>` +
    `<tr><td class="label">Kelas</td><td class="titik">:</td><td>${esc(kuis.kelas || '—')}</td></tr>` +
    `<tr><td class="label" style="vertical-align:top">TP</td><td class="titik" style="vertical-align:top">:</td><td>${tpHtml}</td></tr>` +
    `</table>` +
    htmlTabelParaf(opsi.barisParaf ?? 12)

  if (objektif.length) {
    body +=
      `<h2 class="bagian">I. Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!</h2>` +
      objektif.map(htmlSatuSoal).join('')
  }
  if (isian.length) {
    const romawi = objektif.length ? 'II' : 'I'
    body +=
      `<h2 class="bagian">${romawi}. Lengkapilah kalimat / soal berikut dengan jawaban yang singkat dan tepat!</h2>` +
      isian.map(htmlSatuSoal).join('')
  }
  if (uraian.length) {
    const n =
      (objektif.length ? 1 : 0) + (isian.length ? 1 : 0) + 1
    const romawi = n === 1 ? 'I' : n === 2 ? 'II' : 'III'
    body +=
      `<h2 class="bagian">${romawi}. Jawablah pertanyaan di bawah ini dengan jelas dan benar!</h2>` +
      uraian.map(htmlSatuSoal).join('')
  }
  if (!soal.length) {
    body += `<p><em>Belum ada soal di kuis ini.</em></p>`
  }

  if (opsi.sertakanKunci) {
    body += htmlKunci(soal)
  }

  body +=
    `<p class="footer-meta">${esc(kuis.judul || '')} · ${soal.length} soal · ${kuis.totalPoin ?? 0} poin` +
    (kuis.durasiMenit ? ` · ${kuis.durasiMenit} menit` : '') +
    `</p>`

  return body
}

const STYLE = `
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #111; line-height: 1.4; margin: 1.5cm; }
  .header { text-align: center; margin-bottom: 12pt; border-bottom: 2px solid #111; padding-bottom: 8pt; }
  .sekolah { font-size: 11pt; font-weight: bold; margin: 0; letter-spacing: 0.5px; }
  h1 { font-size: 13pt; margin: 4pt 0; text-transform: uppercase; }
  .tahun { font-size: 10pt; margin: 0; font-weight: bold; }
  .identitas { width: 100%; border-collapse: collapse; margin: 10pt 0 8pt; }
  .identitas td { padding: 2pt 4pt; vertical-align: top; }
  .identitas .label { width: 28%; font-weight: bold; }
  .identitas .titik { width: 12px; }
  .tp { margin: 0; padding-left: 18px; }
  .paraf { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 10pt; }
  .paraf th, .paraf td { border: 1px solid #333; padding: 4pt 6pt; }
  .paraf th { background: #f3f3f3; text-align: center; }
  h2.bagian { font-size: 11pt; margin: 14pt 0 8pt; page-break-after: avoid; }
  .soal { margin: 0 0 10pt; page-break-inside: avoid; }
  .soal-teks { margin: 0 0 4pt; text-align: justify; }
  .stimulus { margin: 4pt 0 6pt; padding: 6pt 8pt; border: 1px solid #999; background: #fafafa; font-size: 10.5pt; }
  ol.opsi { list-style: none; margin: 2pt 0 0 12pt; padding: 0; }
  ol.opsi li { margin: 2pt 0; }
  .huruf { font-weight: bold; margin-right: 4px; }
  .petunjuk-kecil { font-size: 9.5pt; font-style: italic; color: #333; margin: 2pt 0 4pt; }
  .garis-jawab { margin: 6pt 0 0 12pt; }
  .ruang-uraian { margin: 6pt 0 0 12pt; }
  .ruang-uraian .garis { border-bottom: 1px solid #666; height: 18pt; margin-bottom: 2pt; }
  table.bs-tbl { border-collapse: collapse; width: 100%; margin: 4pt 0 0; font-size: 10pt; }
  table.bs-tbl th, table.bs-tbl td { border: 1px solid #444; padding: 3pt 5pt; }
  table.bs-tbl .bs-col { width: 14%; text-align: center; }
  table.bs-tbl .no-per { width: 24px; text-align: right; }
  .jodoh { display: table; width: 100%; margin-top: 4pt; }
  .jodoh-kol { display: table-cell; width: 48%; vertical-align: top; padding-right: 8pt; }
  table.kunci { border-collapse: collapse; width: 100%; font-size: 10pt; margin-top: 6pt; }
  table.kunci th, table.kunci td { border: 1px solid #444; padding: 4pt 6pt; vertical-align: top; }
  table.kunci th { background: #eee; }
  .footer-meta { margin-top: 18pt; font-size: 9pt; color: #555; border-top: 1px solid #ccc; padding-top: 6pt; }
`

/** Unduh file .doc (HTML Word-compatible). */
export function unduhKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): void {
  const body = htmlKuisCetak(kuis, opsi)
  const judul =
    opsi.judulDokumen?.trim() ||
    judulDariJenis(kuis.jenisPenilaian, kuis.mapel || 'Kuis')
  const suffix = opsi.sertakanKunci ? '_kunci' : ''
  const namaMentah = `${kuis.kelas || 'kelas'}_${kuis.mapel || 'mapel'}_${kuis.judul || 'kuis'}${suffix}`
  const aman = namaMentah.replace(/[^\w.\-()\s\u00C0-\u024F]+/g, '_').slice(0, 80)

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${esc(judul)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = aman.endsWith('.doc') ? aman : `${aman}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

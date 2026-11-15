/**
 * Ekspor kuis ke dokumen siap cetak (Word membuka HTML sebagai .doc).
 * Layout mengikuti template Asesmen Sumatif SD Muhammadiyah 01 Kukusan:
 * header sekolah, identitas, tabel paraf, soal dikelompokkan per bentuk.
 * Optimasi cetak: @page A4, tipografi Times, opsi A–D menggantung, spasi tulis tangan.
 * Tanpa dependensi baru — pola sama dengan unduhLaporanDoc.
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
  /** Semester untuk judul STS/SAS: 'ganjil' | 'genap'. Default ganjil. */
  semester?: 'ganjil' | 'genap'
  /** Jumlah baris kosong di tabel nama/nilai (default 10). */
  barisParaf?: number
  /** Sembunyikan tabel paraf (cetak soal saja). */
  sembunyikanParaf?: boolean
}

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Judul formal tanpa mapel (mapel ada di baris identitas, seperti template sekolah). */
function judulUtama(jenis: JenisPenilaianKuis | undefined, semester: 'ganjil' | 'genap'): string {
  const sem = semester === 'genap' ? 'GENAP' : 'GANJIL'
  const j = jenis ?? 'latihan'
  if (j === 'sts') return `ASESMEN SUMATIF TENGAH SEMESTER ${sem}`
  if (j === 'sas') return `ASESMEN SUMATIF AKHIR SEMESTER ${sem}`
  if (j === 'slm') return 'ASESMEN SUMATIF LINGKUP MATERI'
  return 'LEMBAR SOAL'
}

function teksSoal(s: Soal): string {
  return teksPolos(s.teks) || '(tanpa teks soal)'
}

function stimulusHtml(s: Soal): string {
  const st = teksPolos(s.stimulus)
  if (!st) return ''
  // Pecah paragraf panjang agar mudah dibaca di kertas
  const paragraf = st
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="stimulus-p">${esc(p)}</p>`)
    .join('')
  return `<div class="stimulus"><p class="stimulus-label">Perhatikan teks berikut!</p>${paragraf}</div>`
}

/** Kelompokkan: objektif → isian → uraian; nomor global berurutan (seperti template sekolah). */
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

/** Opsi A–D sebagai tabel 2 kolom (huruf | teks) — stabil di Word. */
function htmlOpsiPg(s: SoalKuis): string {
  const opsi = 'opsi' in s && Array.isArray(s.opsi) ? s.opsi : []
  if (!opsi.length) return ''
  const rows = opsi
    .map((o, i) => {
      const huruf = HURUF[i] ?? String(i + 1)
      return (
        `<tr>` +
        `<td class="opsi-huruf">${huruf}.</td>` +
        `<td class="opsi-teks">${esc(o.teks || '')}</td>` +
        `</tr>`
      )
    })
    .join('')
  return `<table class="opsi-tbl" cellspacing="0" cellpadding="0">${rows}</table>`
}

function htmlBs(s: SoalKuis): string {
  if (s.tipe !== 'bs') return ''
  const labelB = s.labelBenar || 'Benar'
  const labelS = s.labelSalah || 'Salah'
  const rows = (s.pernyataan || [])
    .map(
      (p, i) =>
        `<tr>` +
        `<td class="no-per">${i + 1}.</td>` +
        `<td class="bs-teks">${esc(teksPolos(p.teks))}</td>` +
        `<td class="bs-col">☐ ${esc(labelB)}</td>` +
        `<td class="bs-col">☐ ${esc(labelS)}</td>` +
        `</tr>`,
    )
    .join('')
  return (
    `<table class="bs-tbl" cellspacing="0" cellpadding="0">` +
    `<thead><tr>` +
    `<th class="no-per"></th><th>Pernyataan</th>` +
    `<th class="bs-col">${esc(labelB)}</th><th class="bs-col">${esc(labelS)}</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  )
}

function htmlJodoh(s: SoalKuis): string {
  if (s.tipe !== 'jodoh') return ''
  const pasangan = s.pasangan || []
  const kiriRows = pasangan
    .map(
      (p, i) =>
        `<tr><td class="jodoh-no">${i + 1}.</td><td>${esc(teksPolos(p.kiri))}</td></tr>`,
    )
    .join('')
  const kananRows = pasangan
    .map(
      (p, i) =>
        `<tr><td class="jodoh-no">${HURUF[i] ?? i + 1}.</td><td>${esc(teksPolos(p.kanan))}</td></tr>`,
    )
    .join('')
  return (
    `<table class="jodoh-wrap" cellspacing="0" cellpadding="0"><tr>` +
    `<td class="jodoh-kol"><p class="jodoh-judul">Kolom A</p>` +
    `<table class="jodoh-inner">${kiriRows}</table></td>` +
    `<td class="jodoh-gap">&nbsp;</td>` +
    `<td class="jodoh-kol"><p class="jodoh-judul">Kolom B</p>` +
    `<table class="jodoh-inner">${kananRows}</table></td>` +
    `</tr></table>` +
    `<p class="petunjuk-kecil">Jodohkan nomor di kolom A dengan huruf di kolom B.</p>`
  )
}

function htmlSatuSoal(item: { no: number; s: SoalKuis }): string {
  const { no, s } = item
  const bagianStimulus = stimulusHtml(s)
  let isi = ''
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    if (s.tipe === 'pgk') {
      isi = `<p class="petunjuk-kecil">Pilih lebih dari satu jawaban yang benar.</p>`
    }
    isi += htmlOpsiPg(s)
  } else if (s.tipe === 'bs') {
    isi = htmlBs(s)
  } else if (s.tipe === 'jodoh') {
    isi = htmlJodoh(s)
  } else if (s.tipe === 'isian') {
    isi =
      `<p class="garis-jawab">` +
      `<span class="garis-label">Jawaban:</span> ` +
      `<span class="garis-isi">_______________________________________________</span>` +
      `</p>`
  } else if (s.tipe === 'uraian') {
    // 6 baris tulis tangan — cukup untuk jawaban pendek–sedang
    isi =
      `<table class="ruang-uraian" cellspacing="0" cellpadding="0">` +
      Array.from({ length: 6 }, () => `<tr><td class="garis-uraian">&nbsp;</td></tr>`).join('') +
      `</table>`
  }

  return (
    `<table class="soal-wrap" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="soal-no">${no}.</td>` +
    `<td class="soal-body">` +
    `<p class="soal-teks">${esc(teksSoal(s))}</p>` +
    bagianStimulus +
    isi +
    `</td>` +
    `</tr>` +
    `</table>`
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
      kunci = idx >= 0 ? `${HURUF[idx]}. ${teksPolos(opsi[idx].teks)}` : String(s.kunci)
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
    return (
      `<tr>` +
      `<td class="kunci-no">${no}</td>` +
      `<td class="kunci-tipe">${esc(NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe)}</td>` +
      `<td class="kunci-isi">${esc(kunci)}</td>` +
      `</tr>`
    )
  })
  return (
    `<br clear="all" style="page-break-before:always"/>` +
    `<h2 class="bagian kunci-judul">Kunci jawaban (untuk guru)</h2>` +
    `<table class="kunci" cellspacing="0" cellpadding="0">` +
    `<thead><tr><th class="kunci-no">No</th><th class="kunci-tipe">Tipe</th><th>Kunci / pedoman</th></tr></thead>` +
    `<tbody>${baris.join('')}</tbody></table>`
  )
}

function htmlTabelParaf(n: number): string {
  const rows = Array.from({ length: Math.max(4, n) }, (_, i) => {
    return (
      `<tr>` +
      `<td class="paraf-no">${i + 1}</td>` +
      `<td class="paraf-nama">&nbsp;</td>` +
      `<td class="paraf-nilai">&nbsp;</td>` +
      `<td class="paraf-ttd">&nbsp;</td>` +
      `<td class="paraf-ttd">&nbsp;</td>` +
      `</tr>`
    )
  }).join('')
  return (
    `<table class="paraf" cellspacing="0" cellpadding="0">` +
    `<thead><tr>` +
    `<th class="paraf-no">No.</th>` +
    `<th class="paraf-nama">Nama</th>` +
    `<th class="paraf-nilai">Nilai</th>` +
    `<th class="paraf-ttd">Paraf Guru</th>` +
    `<th class="paraf-ttd">Paraf Orang Tua</th>` +
    `</tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  )
}

/** Bangun HTML body dokumen cetak. */
export function htmlKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): string {
  const soal = kuis.soal ?? []
  const { objektif, isian, uraian } = kelompokkan(soal)
  const jenis = kuis.jenisPenilaian
  const semester = opsi.semester ?? 'ganjil'
  const judul = opsi.judulDokumen?.trim() || judulUtama(jenis, semester)
  const tahun = opsi.tahunPelajaran?.trim() || '2026/2027'
  const tpList = (kuis.tpNamaList ?? []).filter(Boolean)
  const tpHtml = tpList.length
    ? `<ol class="tp">${tpList.map((t, i) => `<li value="${i + 1}">${esc(t)}</li>`).join('')}</ol>`
    : `<span class="meta-kosong">—</span>`

  // Header: tabel 3 kolom (logo kiri | judul | logo kanan) — mirip template resmi
  let body =
    `<table class="kop" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="kop-logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAxCAMAAAC4V5rkAAAAwFBMVEUAAAAxL4r29vVQTpBmZZeTk65sapijo64kI3RCPI9yc3VkZKeyrc87QosyM3zo6eqLiqusq8V/f/4AAP93MXnZ3bVHSHxNT3iaZqWDfaZ9gaCCe6k4NYo7RHvEu9lpoahJTnk5N4U5QnepqMkuLqgfcXFeE6ozNW19gJ88O3xCPY+EgqO8wri6wMz//wA9Q2wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADpD0cwAAAAMHRSTlMA/Q/iolpoIAP8BQok+vlTjVgCAQQU514QZF6SoewwD6xppowEAwNOl6aawiw0AVgUQKGPAAADPElEQVR4nJ1V2VZbMQy0LPnad0lCQmkpHKBv/f8/7IyXJHdLe2oCxLbGksYj2bn94f2DzUfD7N9tw/1EZHdrOZLcbQ8iwx1OLg+jk/H6fZTZ5HHcXqQxEulxbLPb+s7QFmyn9KhXnO5CriYu4fCkQu+YIIy04GkrVCJHhCUBP/g4QfgjcY9D9ToeJPS0FxN8DF8Uhzj9mxokikzitJMeiTE3OvTboSIJDPyJcAnLzswDk4c36+jVuymbuExBA4r5CU7cSbyHKRy8MFLG+iKf2OX6CUy7ibszLiUMKnpiaKBTCaa/YHCNaFVOetQBhC2CLtnQhY/MSLqzZCPhQVFzAMVqxaeQPqYTLcBOg/edHsGoRT3i0ECLLW4jzySBvIKqHw8nvJiYtySuQGeNZItHipnqXVkkJIwE9Cis7C89LyIlPS6VWLWcTPRgAxboMSRHalaxJkKNLJmkcpR33vyZ4Ro5sS2Y8weyMWm+Dsy/vVPorHvUpCnO08mDnsMaSqn0nZugOMrzuaM8U76SASjXQYKLyzhxSfQNh3ncNzNL313QGHCnEaQgSjXuvmUh6ukGlTYgbhYQ8onUjc95O97o1eQG67owRu9rGwU1zw68mkKfT67cTDGmTRxD17XU5iNhbaTbJwm3lrMYCtI+UThdB5/VJg09nCuIGX5LEWwrfx9fYWo2ubGG0A7qLWb1G6BRf4h/zaFGF61vNreXAZn3lTYK+VwceFY0eS75aKik99rN77IULqskuR62imNa7bEq6v5KOR/C8yENp08UpaGcfK0HVQoL9It8bNRV0eLH+bP5aYx4mfTg/KbDDEM8Z9QPG4DV8qcx1M6Wc861voJmbtiwra/tpgEhFfZX1+drsfVT4CFvxBNKbWbeL+2LuwR2d9l8o1GIWguxXepVVdk+lbJcwbQ9+lcge9cdkLu6hGKPxP/Mk7AEls71it/oZ33V9y6/0+k9T7+WwNKC3nMiF9evE02/yv9+ASyrljaYqcBqNs2Bsd7LPnBoRMyBrlbtsAsc2/YKmFfGXeBQt5+3gfseh5bJfwHdFjA+BuZtqzV7A1oV0/qtmpGDPrMUwFcJYZ8cmY+bVuWWbBt/AOOqErAaaGrPAAAAAElFTkSuQmCC" alt="Logo SDM" width="48" height="42" /></td>` +
    `<td class="kop-tengah">` +
    `<p class="sekolah">SD MUHAMMADIYAH 01 KUKUSAN</p>` +
    `<p class="judul-utama">${esc(judul)}</p>` +
    `<p class="tahun">TAHUN PELAJARAN ${esc(tahun)}</p>` +
    `</td>` +
    `<td class="kop-logo"><img src="data:image/png;base64,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" alt="Logo Kota Depok" width="40" height="50" /></td>` +
    `</tr>` +
    `</table>` +
    `<div class="garis-ganda"></div>` +
    `<table class="identitas" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="id-label">Mata Pelajaran</td><td class="id-titik">:</td>` +
    `<td class="id-isi">${esc(kuis.mapel || '—')}</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label">Hari, Tanggal</td><td class="id-titik">:</td>` +
    `<td class="id-isi">................................................</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label">Kelas</td><td class="id-titik">:</td>` +
    `<td class="id-isi">${esc(kuis.kelas || '—')}</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label id-label-top">TP</td><td class="id-titik id-label-top">:</td>` +
    `<td class="id-isi">${tpHtml}</td>` +
    `</tr>` +
    `</table>`

  if (!opsi.sembunyikanParaf) {
    body += htmlTabelParaf(opsi.barisParaf ?? 10)
  }

  if (objektif.length) {
    body +=
      `<p class="bagian">I. Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!</p>` +
      objektif.map(htmlSatuSoal).join('')
  }
  if (isian.length) {
    const romawi = objektif.length ? 'II' : 'I'
    body +=
      `<p class="bagian">${romawi}. Lengkapilah kalimat rumpang / soal berikut dengan jawaban yang singkat dan tepat!</p>` +
      isian.map(htmlSatuSoal).join('')
  }
  if (uraian.length) {
    const n = (objektif.length ? 1 : 0) + (isian.length ? 1 : 0) + 1
    const romawi = n === 1 ? 'I' : n === 2 ? 'II' : 'III'
    body +=
      `<p class="bagian">${romawi}. Jawablah pertanyaan di bawah ini dengan jelas dan benar!</p>` +
      uraian.map(htmlSatuSoal).join('')
  }
  if (!soal.length) {
    body += `<p><em>Belum ada soal di kuis ini.</em></p>`
  }

  if (opsi.sertakanKunci) {
    body += htmlKunci(soal)
  }

  body +=
    `<p class="footer-meta">` +
    `${esc(kuis.judul || '')} · ${soal.length} soal · ${kuis.totalPoin ?? 0} poin` +
    (kuis.durasiMenit ? ` · ${kuis.durasiMenit} menit` : '') +
    `</p>`

  return body
}

/**
 * CSS dioptimasi untuk Microsoft Word / LibreOffice Writer:
 * - @page A4, margin 1,5 cm
 * - Tabel untuk layout (bukan flex/grid)
 * - Times New Roman 11pt (standar naskah sekolah)
 * - page-break-inside: avoid pada soal
 */
const STYLE = `
  @page {
    size: A4;
    margin: 1.5cm 1.6cm 1.5cm 1.6cm;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.4;
    margin: 0;
  }

  /* —— Kop surat —— */
  table.kop { width: 100%; border-collapse: collapse; margin: 0 0 2pt; }
  table.kop td { vertical-align: middle; }
  .kop-logo {
    width: 58px;
    text-align: center;
    vertical-align: middle;
    line-height: 1;
  }
  .kop-logo img {
    width: 48px;
    height: auto;
    max-height: 52px;
    display: block;
    margin: 0 auto;
  }
  .kop-tengah { text-align: center; padding: 0 6pt; }
  .sekolah {
    font-size: 11pt;
    font-weight: bold;
    margin: 0 0 2pt;
    letter-spacing: 0.4px;
  }
  .judul-utama {
    font-size: 12pt;
    font-weight: bold;
    margin: 0 0 2pt;
    text-transform: uppercase;
    line-height: 1.25;
  }
  .tahun {
    font-size: 10pt;
    font-weight: bold;
    margin: 0;
  }
  .garis-ganda {
    border-top: 1.5pt solid #000;
    border-bottom: 0.5pt solid #000;
    height: 3pt;
    margin: 4pt 0 8pt;
  }

  /* —— Identitas —— */
  table.identitas { width: 100%; border-collapse: collapse; margin: 0 0 8pt; }
  table.identitas td { padding: 1.5pt 2pt; vertical-align: top; }
  .id-label { width: 26%; font-weight: bold; white-space: nowrap; }
  .id-titik { width: 10px; font-weight: bold; }
  .id-isi { }
  .id-label-top { vertical-align: top; padding-top: 2pt; }
  ol.tp { margin: 0; padding-left: 18px; }
  ol.tp li { margin: 0 0 2pt; text-align: justify; }
  .meta-kosong { color: #666; }

  /* —— Tabel paraf —— */
  table.paraf {
    width: 100%;
    border-collapse: collapse;
    margin: 6pt 0 12pt;
    font-size: 10pt;
  }
  table.paraf th, table.paraf td {
    border: 1pt solid #000;
    padding: 3pt 5pt;
  }
  table.paraf th {
    background: #f0f0f0;
    text-align: center;
    font-weight: bold;
  }
  .paraf-no { width: 7%; text-align: center; }
  .paraf-nama { width: 38%; }
  .paraf-nilai { width: 12%; text-align: center; }
  .paraf-ttd { width: 21.5%; text-align: center; }
  table.paraf tbody td { height: 20pt; }

  /* —— Judul bagian —— */
  p.bagian {
    font-size: 11pt;
    font-weight: bold;
    margin: 12pt 0 6pt;
    page-break-after: avoid;
    page-break-before: auto;
  }

  /* —— Satu soal (tabel no | isi) —— */
  table.soal-wrap {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16pt;
    page-break-inside: avoid;
  }
  td.soal-no {
    width: 22px;
    vertical-align: top;
    font-weight: bold;
    padding: 0 4pt 0 0;
  }
  td.soal-body { vertical-align: top; }
  p.soal-teks {
    margin: 0 0 3pt;
    text-align: justify;
  }

  /* Stimulus / bacaan */
  .stimulus {
    margin: 3pt 0 5pt;
    padding: 5pt 7pt;
    border: 0.75pt solid #555;
    background: #fafafa;
  }
  .stimulus-label {
    font-style: italic;
    font-weight: bold;
    margin: 0 0 3pt;
    font-size: 10.5pt;
  }
  .stimulus-p { margin: 0 0 3pt; text-align: justify; }
  .stimulus-p:last-child { margin-bottom: 0; }

  /* Opsi PG */
  table.opsi-tbl {
    width: 100%;
    border-collapse: collapse;
    margin: 2pt 0 0 2pt;
  }
  td.opsi-huruf {
    width: 22px;
    vertical-align: top;
    font-weight: normal;
    padding: 1pt 4pt 1pt 0;
  }
  td.opsi-teks {
    vertical-align: top;
    padding: 1pt 0;
    text-align: justify;
  }

  .petunjuk-kecil {
    font-size: 9.5pt;
    font-style: italic;
    margin: 1pt 0 3pt;
  }

  /* Isian */
  .garis-jawab { margin: 5pt 0 0 0; }
  .garis-label { font-weight: bold; }

  /* Uraian — baris garis */
  table.ruang-uraian {
    width: 100%;
    border-collapse: collapse;
    margin: 4pt 0 0;
  }
  td.garis-uraian {
    border-bottom: 0.75pt solid #444;
    height: 16pt;
    font-size: 1pt;
  }

  /* Benar-salah */
  table.bs-tbl {
    width: 100%;
    border-collapse: collapse;
    margin: 3pt 0 0;
    font-size: 10pt;
  }
  table.bs-tbl th, table.bs-tbl td {
    border: 0.75pt solid #333;
    padding: 3pt 5pt;
    vertical-align: top;
  }
  table.bs-tbl th { background: #f0f0f0; text-align: center; }
  td.no-per, th.no-per { width: 22px; text-align: right; }
  td.bs-col, th.bs-col { width: 14%; text-align: center; white-space: nowrap; }

  /* Menjodohkan */
  table.jodoh-wrap { width: 100%; border-collapse: collapse; margin-top: 3pt; }
  td.jodoh-kol { width: 48%; vertical-align: top; }
  td.jodoh-gap { width: 4%; }
  .jodoh-judul { font-weight: bold; margin: 0 0 3pt; font-size: 10.5pt; }
  table.jodoh-inner { width: 100%; border-collapse: collapse; }
  table.jodoh-inner td { padding: 1pt 2pt; vertical-align: top; }
  td.jodoh-no { width: 22px; font-weight: bold; }

  /* Kunci */
  .kunci-judul { margin-top: 0; }
  table.kunci {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-top: 4pt;
  }
  table.kunci th, table.kunci td {
    border: 0.75pt solid #333;
    padding: 3pt 5pt;
    vertical-align: top;
  }
  table.kunci th { background: #eee; text-align: left; }
  .kunci-no { width: 8%; text-align: center; }
  .kunci-tipe { width: 22%; }

  .footer-meta {
    margin-top: 14pt;
    font-size: 9pt;
    color: #444;
    border-top: 0.5pt solid #999;
    padding-top: 5pt;
  }
`

/** Unduh file .doc (HTML Word-compatible). */
export function unduhKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): void {
  const body = htmlKuisCetak(kuis, opsi)
  const semester = opsi.semester ?? 'ganjil'
  const judul =
    opsi.judulDokumen?.trim() || judulUtama(kuis.jenisPenilaian, semester)
  const suffix = opsi.sertakanKunci ? '_kunci' : ''
  const namaMentah = `${kuis.kelas || 'kelas'}_${kuis.mapel || 'mapel'}_${kuis.judul || 'kuis'}${suffix}`
  const aman = namaMentah.replace(/[^\w.\-()\s\u00C0-\u024F]+/g, '_').slice(0, 80)

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="LMS SD Muhammadiyah 01 Kukusan">
<title>${esc(judul)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
${STYLE}
</style>
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

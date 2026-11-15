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
import { ambilGambar } from './gambar'

export type OpsiCetakKuis = {
  /** Sertakan kunci jawaban di bagian akhir (versi guru). */
  sertakanKunci?: boolean
  /** Judul dokumen (override). Kosong = diturunkan dari jenis penilaian. */
  judulDokumen?: string
  /** Tahun pelajaran, mis. 2026/2027. */
  tahunPelajaran?: string
  /** Semester untuk judul STS/SAS: 'ganjil' | 'genap'. Default ganjil. */
  semester?: 'ganjil' | 'genap'
  /** Jumlah baris tabel paraf multi-siswa. Default 0 = identitas tunggal (Nama + No. Absen). Isi >0 untuk lembar kolektif. */
  barisParaf?: number
  /** Sembunyikan blok identitas nama/paraf. */
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

/**
 * Word / cetak PDF andal hanya dengan JPEG/PNG.
 * Gambar LMS sering WebP — konversi lewat canvas sebelum disematkan.
 */
async function keJpegDataUrl(dataUrl: string, sisiMaks = 900): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null
  // Sudah JPEG kecil — pakai apa adanya
  if (dataUrl.startsWith('data:image/jpeg') && dataUrl.length < 180_000) return dataUrl
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('gagal muat gambar'))
      el.src = dataUrl
    })
    const skala = Math.min(1, sisiMaks / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * skala))
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * skala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl.startsWith('data:image/png') ? dataUrl : null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return null
  }
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
function htmlOpsiPg(s: SoalKuis, gambar: Map<string, string>): string {
  const opsi = 'opsi' in s && Array.isArray(s.opsi) ? s.opsi : []
  if (!opsi.length) return ''
  const rows = opsi
    .map((o, i) => {
      const huruf = HURUF[i] ?? String(i + 1)
      const img =
        o.gambarId && gambar.get(o.gambarId)
          ? `<img class="opsi-gambar" src="${gambar.get(o.gambarId)}" alt="" />`
          : ''
      return (
        `<tr>` +
        `<td class="opsi-huruf">${huruf}.</td>` +
        `<td class="opsi-teks">${esc(o.teks || '')}${img}</td>` +
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

function htmlJodoh(s: SoalKuis, gambar: Map<string, string>): string {
  if (s.tipe !== 'jodoh') return ''
  const pasangan = s.pasangan || []
  const kiriRows = pasangan
    .map((p, i) => {
      const img =
        p.kiriGambarId && gambar.get(p.kiriGambarId)
          ? `<img class="opsi-gambar" src="${gambar.get(p.kiriGambarId)}" alt="" />`
          : ''
      return `<tr><td class="jodoh-no">${i + 1}.</td><td>${esc(teksPolos(p.kiri))}${img}</td></tr>`
    })
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

function htmlSatuSoal(item: { no: number; s: SoalKuis }, gambar: Map<string, string>): string {
  const { no, s } = item
  const bagianStimulus = stimulusHtml(s)
  const imgSoal =
    s.gambarId && gambar.get(s.gambarId)
      ? `<img class="soal-gambar" src="${gambar.get(s.gambarId)}" alt="Ilustrasi soal ${no}" />`
      : ''
  let isi = ''
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    if (s.tipe === 'pgk') {
      isi = `<p class="petunjuk-kecil">Pilih lebih dari satu jawaban yang benar.</p>`
    }
    isi += htmlOpsiPg(s, gambar)
  } else if (s.tipe === 'bs') {
    isi = htmlBs(s)
  } else if (s.tipe === 'jodoh') {
    isi = htmlJodoh(s, gambar)
  } else if (s.tipe === 'isian') {
    isi =
      `<p class="garis-jawab">` +
      `<span class="garis-label">Jawaban:</span> ` +
      `<span class="garis-isi">_______________________________________________</span>` +
      `</p>`
  } else if (s.tipe === 'uraian') {
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
    imgSoal +
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

/** Identitas satu siswa (default cetak individual). */
function htmlIdentitasSiswa(): string {
  return (
    `<table class="identitas identitas-siswa" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="id-label">Nama</td><td class="id-titik">:</td>` +
    `<td class="id-isi">................................................................</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label">No. Absen</td><td class="id-titik">:</td>` +
    `<td class="id-isi">................</td>` +
    `</tr>` +
    `</table>`
  )
}

/** Tabel paraf multi-siswa (hanya jika barisParaf > 0). */
function htmlTabelParaf(n: number): string {
  const rows = Array.from({ length: Math.max(1, n) }, (_, i) => {
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

/** Kumpulkan semua ID gambar yang dipakai di soal (soal, opsi, jodoh). */
function kumpulkanGambarIds(soal: SoalKuis[]): string[] {
  const ids = new Set<string>()
  for (const s of soal) {
    if (s.gambarId) ids.add(s.gambarId)
    if ((s.tipe === 'pg' || s.tipe === 'pgk') && Array.isArray(s.opsi)) {
      for (const o of s.opsi) {
        if (o.gambarId) ids.add(o.gambarId)
      }
    }
    if (s.tipe === 'jodoh' && Array.isArray(s.pasangan)) {
      for (const p of s.pasangan) {
        if (p.kiriGambarId) ids.add(p.kiriGambarId)
      }
    }
  }
  return [...ids]
}

/** Muat data-URL gambar dari Firestore (paralel, gagal diabaikan). */
async function muatGambarMap(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  await Promise.all(
    ids.map(async (id) => {
      try {
        const data = await ambilGambar(id)
        if (!data) return
        const jpeg = await keJpegDataUrl(data)
        if (jpeg) map.set(id, jpeg)
      } catch {
        /* abaikan gambar gagal */
      }
    }),
  )
  return map
}

/** Bangun HTML body dokumen cetak. */
export async function htmlKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<string> {
  const soal = kuis.soal ?? []
  const gambar = await muatGambarMap(kumpulkanGambarIds(soal))
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
    `<td class="kop-logo"><img src="data:image/jpeg;base64,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" alt="Logo SDM" width="56" height="49" /></td>` +
    `<td class="kop-tengah">` +
    `<p class="sekolah">SD MUHAMMADIYAH 01 KUKUSAN</p>` +
    `<p class="judul-utama">${esc(judul)}</p>` +
    `<p class="tahun">TAHUN PELAJARAN ${esc(tahun)}</p>` +
    `</td>` +
    `<td class="kop-logo"><img src="data:image/jpeg;base64,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" alt="Logo Kota Depok" width="40" height="50" /></td>` +
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
    const nParaf = opsi.barisParaf ?? 0
    body += nParaf > 0 ? htmlTabelParaf(nParaf) : htmlIdentitasSiswa()
  }

  if (objektif.length) {
    body +=
      `<p class="bagian">I. Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!</p>` +
      objektif.map((it) => htmlSatuSoal(it, gambar)).join('')
  }
  if (isian.length) {
    const romawi = objektif.length ? 'II' : 'I'
    body +=
      `<p class="bagian">${romawi}. Lengkapilah kalimat rumpang / soal berikut dengan jawaban yang singkat dan tepat!</p>` +
      isian.map((it) => htmlSatuSoal(it, gambar)).join('')
  }
  if (uraian.length) {
    const n = (objektif.length ? 1 : 0) + (isian.length ? 1 : 0) + 1
    const romawi = n === 1 ? 'I' : n === 2 ? 'II' : 'III'
    body +=
      `<p class="bagian">${romawi}. Jawablah pertanyaan di bawah ini dengan jelas dan benar!</p>` +
      uraian.map((it) => htmlSatuSoal(it, gambar)).join('')
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
 * - page-break-inside: auto pada soal panjang
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
    line-height: 1.45;
    margin: 0;
  }

  /* —— Kop surat —— */
  table.kop { width: 100%; border-collapse: collapse; margin: 0 0 2pt; }
  table.kop td { vertical-align: middle; }
  .kop-logo {
    width: 64px;
    text-align: center;
    vertical-align: middle;
    line-height: 1;
  }
  .kop-logo img {
    width: 56px;
    height: auto;
    max-height: 60px;
    display: block;
    margin: 0 auto;
  }
  .kop-tengah { text-align: center; padding: 0 6pt; }
  .sekolah {
    font-size: 13pt;
    font-weight: bold;
    margin: 0 0 3pt;
    letter-spacing: 0.5px;
  }
  .judul-utama {
    font-size: 14pt;
    font-weight: bold;
    margin: 0 0 3pt;
    text-transform: uppercase;
    line-height: 1.3;
  }
  .tahun {
    font-size: 11pt;
    font-weight: bold;
    margin: 0;
  }
  .garis-ganda {
    border-top: 2pt solid #000;
    border-bottom: 0.75pt solid #000;
    height: 4pt;
    margin: 6pt 0 14pt;
  }

  /* —— Identitas —— */
  table.identitas { width: 100%; border-collapse: collapse; margin: 0 0 6pt; }
  .identitas-siswa { margin: 0 0 14pt !important; }
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
    margin: 0 0 18pt;
    /* auto: Word sering memotong isi jika force avoid pada soal panjang */
    page-break-inside: auto;
  }
  td.soal-no {
    width: 22px;
    vertical-align: top;
    font-weight: bold;
    padding: 0 4pt 0 0;
    page-break-after: avoid;
  }
  td.soal-body { vertical-align: top; padding-bottom: 6pt; }
  p.soal-teks {
    margin: 0 0 4pt;
    text-align: justify;
    orphans: 3;
    widows: 3;
  }
  .soal-gambar {
    max-width: 92%;
    max-height: 200pt;
    width: auto;
    height: auto;
    display: block;
    margin: 6pt auto 8pt;
  }
  .opsi-gambar {
    max-width: 110pt;
    max-height: 80pt;
    width: auto;
    height: auto;
    display: block;
    margin: 3pt 0;
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


async function bangunHtmlLengkap(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<{ html: string; judul: string; namaFile: string }> {
  const body = await htmlKuisCetak(kuis, opsi)
  const semester = opsi.semester ?? 'ganjil'
  const judul =
    opsi.judulDokumen?.trim() || judulUtama(kuis.jenisPenilaian, semester)
  const suffix = opsi.sertakanKunci ? '_kunci' : ''
  const namaMentah = `${kuis.kelas || 'kelas'}_${kuis.mapel || 'mapel'}_${kuis.judul || 'kuis'}${suffix}`
  const namaFile = namaMentah.replace(/[^\w.\-()\s\u00C0-\u024F]+/g, '_').slice(0, 80)

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
@media print {
  body { margin: 0; }
  table.soal-wrap { page-break-inside: auto; }
  .soal-gambar { max-height: 180pt; }
}
</style>
</head>
<body>
${body}
</body>
</html>`
  return { html, judul, namaFile }
}

/** Unduh file .doc (HTML Word-compatible). Gambar dikonversi JPEG agar Word menampilkannya. */
export async function unduhKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<void> {
  const { html, namaFile } = await bangunHtmlLengkap(kuis, opsi)
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile.endsWith('.doc') ? namaFile : `${namaFile}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Cetak / simpan PDF lewat dialog print browser.
 * Lebih andal untuk ilustrasi & layout (tidak bergantung pada filter HTML Word).
 * Pengguna memilih «Save as PDF» / «Microsoft Print to PDF».
 */
export async function cetakKuisPdf(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<void> {
  const { html } = await bangunHtmlLengkap(kuis, opsi)
  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Popup diblokir. Izinkan jendela baru untuk mencetak PDF.')
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Tunggu gambar data-URL selesai decode
  await new Promise<void>((r) => {
    const done = () => r()
    if (w.document.readyState === 'complete') setTimeout(done, 200)
    else w.addEventListener('load', () => setTimeout(done, 200))
  })
  try {
    w.focus()
    w.print()
  } catch {
    /* user dapat File > Print manual */
  }
}

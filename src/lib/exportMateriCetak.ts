/**
 * Cetak / simpan PDF materi untuk dipakai offline (ANTIREGRESI §Materi.Cetak).
 *
 * Materi multi-halaman (`jenis: 'halaman'`) dan materi HTML dicetak lewat jendela cetak browser
 * (Simpan sebagai PDF). Teks & rumus (KaTeX) ikut; gambar dicetak; video/audio tidak bisa
 * diputar di kertas → diganti kotak keterangan (YouTube: tautan tonton; unggahan: «tersedia di LMS»).
 */
import type { MateriHalaman } from '../types/materi'
import { bersihHtmlMateri, materiPunyaRumus } from './html'
import { htmlDenganRumus, muatKatex } from './matematika'
import { ekstrakYoutubeId } from './materi'
import { esc, htmlKop } from './exportKuisCetak'

export type MateriCetak = {
  judul: string
  mapel: string
  kelas: string
  bab?: string
  deskripsi?: string
  /** Teks TP (mis. «TP 2. Mengenal ekosistem»). */
  tp?: string
  halaman?: MateriHalaman[]
  /** Materi jenis HTML penuh. */
  kontenHtml?: string
}

export type OpsiCetakMateri = {
  tahunPelajaran?: string
  /** Mulai tiap halaman materi di lembar baru. Bawaan: ya. */
  halamanBaru?: boolean
  /** Sertakan kop sekolah. Bawaan: ya. */
  kop?: boolean
}

const STYLE = `
  @page { size: A4; margin: 1.8cm 1.6cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; line-height: 1.55; color: #111; margin: 0; }
  h1.judul { font-size: 18pt; margin: 6px 0 4px; }
  table.meta { border-collapse: collapse; margin: 4px 0 10px; font-size: 10.5pt; }
  table.meta td { padding: 1px 10px 1px 0; vertical-align: top; }
  .desk { margin: 0 0 12px; color: #333; }
  section.hal { margin: 0 0 14px; }
  section.hal.baru { page-break-before: always; }
  section.hal.baru:first-of-type { page-break-before: auto; }
  h2.hal-judul { font-size: 13.5pt; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #0f7a4d; color: #0b5a39; }
  .teks p { margin: 0 0 7px; } .teks ul, .teks ol { margin: 0 0 7px 20px; padding: 0; }
  .teks table { border-collapse: collapse; margin: 6px 0; } .teks td, .teks th { border: 1px solid #555; padding: 3px 6px; }
  figure { margin: 10px 0; text-align: center; page-break-inside: avoid; }
  figure img { max-width: 100%; max-height: 16cm; height: auto; }
  figcaption { font-size: 9.5pt; color: #444; margin-top: 3px; }
  .media { border: 1.5px dashed #64748b; border-radius: 8px; padding: 8px 12px; margin: 10px 0; font-size: 10.5pt; page-break-inside: avoid; background: #f8fafc; }
  .media b { color: #0b5a39; } .media .tautan { word-break: break-all; font-family: Consolas, monospace; font-size: 9.5pt; }
  .kop-logo img { display: block; } table.kop { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .sekolah { font-size: 14pt; font-weight: bold; margin: 0; } .judul-utama { font-size: 12pt; font-weight: bold; margin: 2px 0; } .tahun { margin: 0; font-size: 10.5pt; }
  .kop-tengah { text-align: center; } .garis-ganda { border-top: 3px double #000; margin: 4px 0 8px; }
  @media screen { body { max-width: 21cm; margin: 0 auto; padding: 1cm; } }
`

function htmlTeks(html: string, rumus: boolean): string {
  const bersih = bersihHtmlMateri(html || '')
  if (!bersih) return ''
  return rumus && materiPunyaRumus(bersih) ? htmlDenganRumus(bersih) : bersih
}

function htmlBlok(b: MateriHalaman['blok'][number], nomorHalaman: number, rumus: boolean): string {
  if (b.tipe === 'teks') {
    const h = htmlTeks(b.html, rumus)
    return h ? `<div class="teks">${h}</div>` : ''
  }
  if (b.tipe === 'gambar') {
    if (!b.url) return ''
    const cap = b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''
    return `<figure><img src="${esc(b.url)}" alt="${esc(b.alt || b.caption || 'Gambar materi')}" />${cap}</figure>`
  }
  if (b.tipe === 'video') {
    if (!b.url) return ''
    const yt = b.sumber === 'youtube' ? ekstrakYoutubeId(b.url) : null
    const cap = b.caption ? `: ${esc(b.caption)}` : ''
    return yt
      ? `<div class="media"><b>▶ Video${cap}</b><br/>Tonton secara daring: <span class="tautan">https://www.youtube.com/watch?v=${esc(yt)}</span></div>`
      : `<div class="media"><b>▶ Video${cap}</b><br/>Video ini tersedia di LMS (halaman ${nomorHalaman} materi ini).</div>`
  }
  if (b.tipe === 'audio') {
    if (!b.url) return ''
    const cap = b.caption ? `: ${esc(b.caption)}` : ''
    return `<div class="media"><b>🔊 Audio${cap}</b><br/>Audio ini tersedia di LMS (halaman ${nomorHalaman} materi ini).</div>`
  }
  return ''
}

/** HTML isi dokumen cetak (tanpa <html>); `rumus` = KaTeX sudah dimuat. */
export function htmlIsiMateriCetak(m: MateriCetak, opsi: OpsiCetakMateri, rumus: boolean): string {
  const tahun = opsi.tahunPelajaran?.trim() || '2026/2027'
  const meta =
    `<table class="meta">` +
    `<tr><td>Mata pelajaran</td><td>: ${esc(m.mapel)}</td></tr>` +
    `<tr><td>Kelas</td><td>: ${esc(m.kelas)}</td></tr>` +
    (m.tp ? `<tr><td>Tujuan Pembelajaran</td><td>: ${esc(m.tp)}</td></tr>` : '') +
    (m.bab ? `<tr><td>Bab / unit</td><td>: ${esc(m.bab)}</td></tr>` : '') +
    `</table>`
  const kepala =
    (opsi.kop === false ? '' : htmlKop(`MATERI PEMBELAJARAN`, tahun)) +
    `<h1 class="judul">${esc(m.judul)}</h1>` +
    meta +
    (m.deskripsi ? `<p class="desk">${esc(m.deskripsi)}</p>` : '')

  let isi = ''
  if (m.halaman && m.halaman.length) {
    const baru = opsi.halamanBaru !== false
    isi = m.halaman
      .map((h, i) => {
        const blok = h.blok.map((b) => htmlBlok(b, i + 1, rumus)).join('')
        if (!blok.trim()) return ''
        const judulH = h.judul?.trim() || `Halaman ${i + 1}`
        return `<section class="hal${baru ? ' baru' : ''}"><h2 class="hal-judul">${esc(judulH)}</h2>${blok}</section>`
      })
      .join('')
  } else if (m.kontenHtml) {
    isi = `<section class="hal"><div class="teks">${htmlTeks(m.kontenHtml, rumus)}</div></section>`
  }
  if (!isi.trim()) isi = '<p>(Materi ini belum berisi konten.)</p>'
  return kepala + isi
}

async function tungguGambar(doc: Document): Promise<void> {
  const daftar = Array.from(doc.querySelectorAll('img'))
  await Promise.all(
    daftar.map(
      (im) =>
        new Promise<void>((resolve) => {
          if (im.complete) return resolve()
          im.addEventListener('load', () => resolve(), { once: true })
          im.addEventListener('error', () => resolve(), { once: true })
          setTimeout(resolve, 8000) // jangan menggantung bila satu gambar lambat
        }),
    ),
  )
}

/** Salin stylesheet aplikasi (termasuk KaTeX) ke jendela cetak agar rumus tampil benar. */
function salinStylesheet(dari: Document, ke: Document): void {
  dari.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
    ke.head.appendChild(el.cloneNode(true))
  })
}

/**
 * Buka jendela cetak materi. Panggil langsung dari klik (popup-blocker). Pengguna memilih
 * «Simpan sebagai PDF» atau mencetak.
 */
export async function cetakMateriPdf(m: MateriCetak, opsi: OpsiCetakMateri = {}): Promise<void> {
  const w = window.open('', '_blank')
  if (!w) throw new Error('Popup diblokir. Izinkan jendela baru untuk mencetak PDF.')
  try {
    w.document.open()
    w.document.write(
      `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(`Materi ${m.judul}`)}</title></head>` +
        `<body><p style="font:14px sans-serif">Menyiapkan dokumen cetak…</p></body></html>`,
    )
    w.document.close()
    let rumus = false
    try {
      await muatKatex()
      rumus = true
    } catch {
      rumus = false // rumus tampil apa adanya bila KaTeX gagal dimuat
    }
    salinStylesheet(document, w.document)
    const gaya = w.document.createElement('style')
    gaya.textContent = STYLE
    w.document.head.appendChild(gaya)
    w.document.body.innerHTML = htmlIsiMateriCetak(m, opsi, rumus)
    await tungguGambar(w.document)
    await new Promise<void>((r) => w.setTimeout(r, 200))
  } catch (e) {
    try {
      w.close()
    } catch {
      /* abaikan */
    }
    throw e
  }
  try {
    w.focus()
    w.print()
  } catch {
    /* pengguna dapat memakai Ctrl+P */
  }
}

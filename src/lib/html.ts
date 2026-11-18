import DOMPurify from 'dompurify'

/**
 * Teks kaya soal disimpan sebagai HTML terbatas dan DIBERSIHKAN setiap kali ditampilkan
 * (ANTIREGRESI §9): jangan pernah memakai dangerouslySetInnerHTML tanpa bersihHtml().
 */
const TAG_BOLEH = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li']

export function bersihHtml(html: string | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAG_BOLEH, ALLOWED_ATTR: [] })
}

/** Teks polos dari HTML (untuk ringkasan di daftar & cek kosong). */
export function teksPolos(html: string | undefined): string {
  if (!html) return ''
  const bersih = bersihHtml(html)
  const el = document.createElement('div')
  el.innerHTML = bersih.replace(/<\/(p|li)>/gi, ' </$1>').replace(/<br\s*\/?>/gi, ' ')
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function htmlKosong(html: string | undefined): boolean {
  return teksPolos(html) === ''
}

/**
 * Stimulus / bacaan soal TKA: seperti bersihHtml, ditambah tabel (data numerasi).
 * Tetap tanpa atribut gaya/kelas/skrip (ANTIREGRESI §9).
 */
const TAG_STIMULUS = [...TAG_BOLEH, 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption']

export function bersihHtmlStimulus(html: string | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAG_STIMULUS,
    ALLOWED_ATTR: ['colspan', 'rowspan', 'scope'],
  })
}

/**
 * Stimulus yang diketik sebagai teks biasa (tanpa tag) → paragraf HTML (Enter dua kali = paragraf
 * baru, Enter sekali = baris baru). Stimulus yang sudah HTML dibiarkan.
 */
export function stimulusKeHtml(s: string | undefined): string {
  const t = (s ?? '').replace(/\r\n?/g, '\n').trim()
  if (!t) return ''
  if (/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(t)) return t
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * HTML materi halaman — selaras pipeline stimulus TKA:
 * heading (h2/h3) + tabel numerasi + format dasar.
 * Tanpa atribut style/class/onclick (ANTIREGRESI §9, §115.2).
 * Rumus `$...$` / `$$...$$` dibiarkan di teks; dirender KaTeX di viewer.
 */
const TAG_MATERI = [
  ...TAG_BOLEH,
  'h2',
  'h3',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
]

export function bersihHtmlMateri(html: string | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAG_MATERI,
    ALLOWED_ATTR: ['colspan', 'rowspan', 'scope'],
  })
}

/** Deteksi konten materi yang mungkin butuh KaTeX (tanda $). */
export function materiPunyaRumus(html: string | undefined): boolean {
  return typeof html === 'string' && html.includes('$')
}

/**
 * Apakah string terlihat mengandung tabel HTML (untuk mode sumber di editor).
 * Hanya heuristik UI — penyimpanan tetap lewat bersihHtmlMateri.
 */
export function materiPunyaTabel(html: string | undefined): boolean {
  return typeof html === 'string' && /<\s*table[\s>]/i.test(html)
}

/**
 * HTML materi jenis «html» (paste kode / file .html).
 * Mengizinkan gambar eksternal (imgbb, Postimages, Google Drive, CDN, dll.)
 * lewat <img src="https://…"> agar ilustrasi ter-load.
 *
 * Keamanan (ANTIREGRESI §9 + §MateriHtml):
 * - Tidak ada script, event handler, style inline berbahaya, object/embed.
 * - src/href hanya http(s) (DOMPurify default + ALLOWED_URI_REGEXP).
 * - Jika input dokumen penuh (<html>…), ambil isi <body>.
 */
const TAG_HTML_LENGKAP = [
  ...TAG_MATERI,
  'h1',
  'h4',
  'h5',
  'h6',
  'img',
  'a',
  'figure',
  'figcaption',
  'blockquote',
  'div',
  'span',
  'pre',
  'code',
  'hr',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'ul',
  'ol',
  'li',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
]

const ATTR_HTML_LENGKAP = [
  'colspan',
  'rowspan',
  'scope',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'loading',
  'decoding',
  'href',
  'target',
  'rel',
  'class',
  'id',
]

/** Ekstrak isi body jika string berupa dokumen HTML lengkap. */
export function ekstrakIsiHtml(raw: string): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const body = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (body) return body[1].trim()
  // Hilangkan doctype / html / head bila ada tanpa body eksplisit
  return t
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .trim()
}

/**
 * Bersihkan HTML untuk materi jenis «html».
 * Gambar eksternal (https://i.ibb.co, postimg, drive.google, dll.) tetap utuh
 * selama src valid http(s).
 */
export function bersihHtmlLengkap(html: string | undefined): string {
  if (!html) return ''
  const isi = ekstrakIsiHtml(html)
  return DOMPurify.sanitize(isi, {
    ALLOWED_TAGS: TAG_HTML_LENGKAP,
    ALLOWED_ATTR: ATTR_HTML_LENGKAP,
    ALLOW_DATA_ATTR: false,
    // Hanya protokol aman untuk src/href
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}

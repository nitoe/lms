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
 * - src/href hanya http(s) (DOMPurify + ALLOWED_URI_REGEXP + normalisasi).
 * - Jika input dokumen penuh (<html>…), ambil isi <body>.
 * - URL Drive/Dropbox dinormalisasi ke bentuk yang bisa ditampilkan langsung.
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
  'srcset',
  'sizes',
  'alt',
  'title',
  'width',
  'height',
  'loading',
  'decoding',
  'referrerpolicy',
  'crossorigin',
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
  return t
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .trim()
}

/**
 * Ambil file ID dari berbagai bentuk tautan Google Drive / Docs.
 */
function ekstrakGoogleDriveId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (!host.endsWith('google.com') && !host.endsWith('googleapis.com')) return null

    const mPath = u.pathname.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/)
    if (mPath) return mPath[1]

    const id = u.searchParams.get('id')
    if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return id

    return null
  } catch {
    return null
  }
}

/**
 * Normalisasi satu URL gambar agar lebih andal termuat:
 * - //host/… → https://host/…
 * - http:// → https://
 * - Google Drive share/view → uc?export=view&id=…
 * - Dropbox ?dl=0 → ?raw=1
 * - Tolak javascript: / data: / blob: / vbscript:
 */
export function normalisasiUrlGambar(src: string): string | null {
  let s = (src || '').trim()
  if (!s) return null

  if (s.startsWith('//')) s = `https:${s}`

  const lower = s.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('vbscript:')
  ) {
    return null
  }

  if (lower.startsWith('http://')) {
    s = `https://${s.slice(7)}`
  }

  if (!/^https:\/\//i.test(s)) return null

  const driveId = ekstrakGoogleDriveId(s)
  if (driveId) {
    return `https://drive.google.com/uc?export=view&id=${driveId}`
  }

  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
      u.searchParams.set('raw', '1')
      u.searchParams.delete('dl')
      return u.toString()
    }
  } catch {
    /* biarkan s */
  }

  return s
}

function terapkanOptimasiImg(img: Element): void {
  const rawSrc = img.getAttribute('src') || ''
  const norm = normalisasiUrlGambar(rawSrc)
  if (!norm) {
    img.remove()
    return
  }
  img.setAttribute('src', norm)

  const rawSrcset = img.getAttribute('srcset')
  if (rawSrcset) {
    const parts = rawSrcset
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const sp = p.split(/\s+/)
        const url = sp[0]
        const desc = sp.slice(1).join(' ')
        const n = normalisasiUrlGambar(url)
        if (!n) return null
        return desc ? `${n} ${desc}` : n
      })
      .filter(Boolean) as string[]
    if (parts.length) img.setAttribute('srcset', parts.join(', '))
    else img.removeAttribute('srcset')
  }

  if (!img.getAttribute('alt')) img.setAttribute('alt', '')
  if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy')
  if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async')
  // no-referrer membantu hotlink ketat (imgbb, postimg, beberapa CDN sekolah)
  if (!img.getAttribute('referrerpolicy')) {
    img.setAttribute('referrerpolicy', 'no-referrer')
  }
}

/**
 * Setelah DOMPurify: perbaiki setiap <img> (src, srcset, loading, referrerpolicy).
 * Prefer DOMParser; fallback regex jika document tidak tersedia.
 */
export function optimasiGambarEksternal(html: string): string {
  if (!html || !/<img\b/i.test(html)) return html

  if (typeof document !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(`<div id="__r">${html}</div>`, 'text/html')
      const root = doc.getElementById('__r')
      if (root) {
        root.querySelectorAll('img').forEach((img) => terapkanOptimasiImg(img))
        return root.innerHTML
      }
    } catch {
      /* fallback */
    }
  }

  return html.replace(/<img\b([^>]*?)>/gi, (_full, attrs: string) => {
    const m = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)
    if (!m) return _full
    const norm = normalisasiUrlGambar(m[2])
    if (!norm) return ''
    let a = attrs.replace(/\bsrc\s*=\s*(["']).*?\1/i, `src="${norm}"`)
    if (!/\balt\s*=/i.test(a)) a += ' alt=""'
    if (!/\bloading\s*=/i.test(a)) a += ' loading="lazy"'
    if (!/\bdecoding\s*=/i.test(a)) a += ' decoding="async"'
    if (!/\breferrerpolicy\s*=/i.test(a)) a += ' referrerpolicy="no-referrer"'
    return `<img${a}>`
  })
}

/**
 * Bersihkan HTML untuk materi jenis «html».
 * Pipeline: ekstrak body → DOMPurify → optimasi URL gambar eksternal.
 */
export function bersihHtmlLengkap(html: string | undefined): string {
  if (!html) return ''
  const isi = ekstrakIsiHtml(html)
  const sanitized = DOMPurify.sanitize(isi, {
    ALLOWED_TAGS: TAG_HTML_LENGKAP,
    ALLOWED_ATTR: ATTR_HTML_LENGKAP,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
  return optimasiGambarEksternal(sanitized)
}

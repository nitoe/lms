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
  'h4',
  // Elemen bacaan lanjutan (ANTIREGRESI §Materi.HtmlBlok): kunci jawaban lipat, kutipan, kode.
  'details',
  'summary',
  'blockquote',
  'hr',
  'mark',
  'code',
  'pre',
  'dl',
  'dt',
  'dd',
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

/**
 * Rapikan HTML pengumuman dari AI / tempel:
 * - buang fence markdown ```html
 * - decode entitas bila seluruh konten ter-escape (&lt;p&gt;…)
 * - teks polos / markdown ringan → paragraf & daftar HTML
 * - lalu sanitasi bersihHtmlMateri
 */
export function normalisasiHtmlPengumuman(raw: string | undefined): string {
  let s = String(raw ?? '').trim()
  if (!s) return ''

  // Fence code
  s = s.replace(/^```(?:html|HTML)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Konten HTML yang ter-escape penuh sebagai teks (&lt;p&gt;…)
  if ((s.match(/&lt;/g) || []).length >= 2 && !/<[a-zA-Z]/.test(s)) {
    s = s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
  }

  const punyaTag = /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(s)
  if (!punyaTag) {
    // Markdown ringan → HTML
    const esc = (x: string) =>
      x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const inline = (x: string) => {
      let y = esc(x)
      y = y.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      y = y.replace(/__(.+?)__/g, '<strong>$1</strong>')
      y = y.replace(/(^|[^*])\*([^*]+)\*(?![*])/g, '$1<em>$2</em>')
      y = y.replace(/_(.+?)_/g, '<em>$1</em>')
      return y
    }
    const baris = s.replace(/\r\n?/g, '\n').split('\n')
    const out: string[] = []
    let list: string[] = []
    let listOrdered = false
    const flushList = () => {
      if (!list.length) return
      const tag = listOrdered ? 'ol' : 'ul'
      out.push(`<${tag}>` + list.map((li) => `<li>${li}</li>`).join('') + `</${tag}>`)
      list = []
    }
    for (const line of baris) {
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/)
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/)
      if (bullet) {
        if (list.length && listOrdered) flushList()
        listOrdered = false
        list.push(inline(bullet[1]))
        continue
      }
      if (numbered) {
        if (list.length && !listOrdered) flushList()
        listOrdered = true
        list.push(inline(numbered[1]))
        continue
      }
      flushList()
      const t = line.trim()
      if (!t) continue
      out.push(`<p>${inline(t)}</p>`)
    }
    flushList()
    s = out.join('') || `<p>${inline(s)}</p>`
  } else {
    // Pastikan tidak hanya inline tanpa wrapper
    if (!/<\s*(p|ul|ol|h2|h3|h4|blockquote|div)\b/i.test(s)) {
      s = `<p>${s}</p>`
    }
  }

  return bersihHtmlMateri(s)
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
 * Apakah blok memuat elemen yang TIDAK dikenal editor visual (Tiptap StarterKit):
 * tabel, kunci jawaban lipat (details/summary), kutipan, garis, kode, daftar definisi, h4, mark.
 * Blok seperti ini hanya aman disunting di mode «HTML / tabel»; editor visual akan
 * membuang elemen tersebut saat blok diubah (ANTIREGRESI §Materi.HtmlBlok).
 */
export function materiPunyaStrukturLanjut(html: string | undefined): boolean {
  return (
    typeof html === 'string' &&
    /<\s*(table|details|summary|blockquote|hr|pre|code|dl|h4|mark)[\s>/]/i.test(html)
  )
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


/**
 * Apakah konten butuh dokumen penuh di iframe (modul interaktif).
 * Deteksi: doctype/html, style, script, details/summary, svg, form input/button.
 * Contoh nyata: MIPA Quest (CSS + JS + progress + kuis).
 */
export function htmlButuhDokumenPenuh(raw: string | undefined): boolean {
  if (!raw) return false
  const t = raw.slice(0, 200_000)
  return /<!DOCTYPE\s+html/i.test(t)
    || /<\s*html[\s>]/i.test(t)
    || /<\s*style[\s>]/i.test(t)
    || /<\s*script[\s>]/i.test(t)
    || /<\s*details[\s>]/i.test(t)
    || /<\s*svg[\s>]/i.test(t)
    || /<\s*(?:button|input|select|textarea|label)\b/i.test(t)
}

/**
 * Siapkan dokumen HTML utuh untuk iframe (srcdoc).
 * Mempertahankan style, script, SVG, details, form — tidak lewat DOMPurify.
 * Keamanan di lapisan viewer: sandbox iframe tanpa allow-same-origin.
 */
export function siapkanHtmlDokumen(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''

  /**
   * Polyfill localStorage/sessionStorage di origin opaque iframe (sandbox tanpa
   * allow-same-origin). Tanpa ini, modul seperti MIPA Quest melempar SecurityError
   * di baris pertama dan **semua** tombol/filter/kuis mati.
   */
  const polyfill = `<script>(function(){function memStore(){var m={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){for(var k in m)delete m[k]},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};};function ensure(name){try{var s=window[name];var k='__lms_ls_t__';s.setItem(k,'1');s.removeItem(k);}catch(e){try{Object.defineProperty(window,name,{value:memStore(),configurable:true});}catch(e2){window[name]=memStore();}}}ensure('localStorage');ensure('sessionStorage');})();</script>`

  let doc: string
  if (/<!DOCTYPE/i.test(t) || /<\s*html[\s>]/i.test(t)) {
    doc = t
  } else {
    const body = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const head = t.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    if (body) {
      const headInner = head
        ? head[1]
        : '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      doc = `<!DOCTYPE html><html lang="id"><head>${headInner}</head><body>${body[1]}</body></html>`
    } else {
      doc =
        '<!DOCTYPE html><html lang="id"><head>' +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
        '</head><body>' +
        t +
        '</body></html>'
    }
  }

  // Sisipkan polyfill sedini mungkin di <head> (atau sebelum </body>).
  if (/<head[^>]*>/i.test(doc)) {
    return doc.replace(/<head[^>]*>/i, (m) => m + polyfill)
  }
  if (/<body[^>]*>/i.test(doc)) {
    return doc.replace(/<body[^>]*>/i, (m) => m + polyfill)
  }
  return polyfill + doc
}

/**
 * Simpan materi HTML: jaga konten interaktif (style/script) agar modul seperti
 * MIPA Quest tetap utuh. Hanya tolak kosong & protokol berbahaya kasar di URL.
 * Sanitasi agresif (DOMPurify) hanya untuk mode cuplikan sederhana — lihat bersihHtmlLengkap.
 */
export function siapkanSimpanHtml(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  // Tolak javascript: di atribut umum (bukan menghapus <script> internal modul)
  const aman = t.replace(
    /\s(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
    ' $1=$2#$2',
  )
  return aman
}

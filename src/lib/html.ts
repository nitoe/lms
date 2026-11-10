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

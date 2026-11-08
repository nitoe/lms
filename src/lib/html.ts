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

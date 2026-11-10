import { useEffect, useState } from 'react'
import type KatexModul from 'katex'

/**
 * Rumus `$...$` (sebaris) dan `$$...$$` (blok) dengan KaTeX — dimuat malas agar bundel utama
 * tidak membengkak, dan HANYA dipakai bila soal bertanda `rumus: true` (soal TKA hasil migrasi).
 * Konten lain di LMS tidak diubah (tanda `$` tetap `$`).
 *
 * Keamanan: rumus dirender SETELAH HTML dibersihkan (bersihHtml / bersihHtmlStimulus); keluaran
 * KaTeX dibuat dari teks yang di-escape oleh KaTeX sendiri (trust = false).
 */

type Katex = typeof KatexModul

let katex: Katex | null = null
let janji: Promise<void> | null = null
const pendengar = new Set<() => void>()

export function muatKatex(): Promise<void> {
  if (katex) return Promise.resolve()
  if (!janji) {
    janji = Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([m]) => {
        katex = ((m as { default?: Katex }).default ?? (m as unknown as Katex)) as Katex
        pendengar.forEach((f) => f())
      })
      .catch(() => {
        // Gagal (offline): biarkan teks mentah tampil; coba lagi pada pemakaian berikutnya.
        janji = null
      })
  }
  return janji
}

/** true bila KaTeX sudah siap. Memicu pemuatan hanya bila `aktif`. */
export function useKatexSiap(aktif: boolean): boolean {
  const [siap, setSiap] = useState(() => katex !== null)
  useEffect(() => {
    if (!aktif) return
    if (katex) {
      setSiap(true)
      return
    }
    const f = () => setSiap(katex !== null)
    pendengar.add(f)
    void muatKatex()
    return () => {
      pendengar.delete(f)
    }
  }, [aktif])
  return aktif && siap
}

const POLA_RUMUS = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g

function dekodeEntitas(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Ganti rumus pada HTML yang SUDAH bersih. Bila KaTeX belum siap, kembalikan apa adanya. */
export function htmlDenganRumus(html: string): string {
  if (!katex || !html.includes('$')) return html
  const k = katex
  return html.replace(POLA_RUMUS, (asli: string, blok?: string, sebaris?: string) => {
    const tex = dekodeEntitas(blok ?? sebaris ?? '').trim()
    if (!tex) return asli
    try {
      return k.renderToString(tex, { displayMode: blok !== undefined, throwOnError: false })
    } catch {
      return asli
    }
  })
}

/** Teks polos (opsi, pernyataan) → HTML aman, dengan rumus bila KaTeX siap. */
export function teksDenganRumus(teks: string): string {
  return htmlDenganRumus(escapeHtml(teks))
}

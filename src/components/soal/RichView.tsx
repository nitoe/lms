import { bersihHtml } from '../../lib/html'
import { htmlDenganRumus, useKatexSiap } from '../../lib/matematika'

/**
 * Menampilkan teks kaya soal (HTML terbatas) dengan pembersihan wajib.
 * `rumus` = render `$...$` dengan KaTeX (hanya soal TKA; konten lain tetap apa adanya).
 */
export default function RichView({
  html,
  className = '',
  rumus = false,
}: {
  html?: string
  className?: string
  rumus?: boolean
}) {
  const siap = useKatexSiap(rumus)
  const bersih = bersihHtml(html)
  if (!bersih) return null
  const isi = siap ? htmlDenganRumus(bersih) : bersih
  return <div className={`soal-rich-view ${className}`} dangerouslySetInnerHTML={{ __html: isi }} />
}

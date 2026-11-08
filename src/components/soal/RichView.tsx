import { bersihHtml } from '../../lib/html'

/** Menampilkan teks kaya soal (HTML terbatas) dengan pembersihan wajib. */
export default function RichView({ html, className = '' }: { html?: string; className?: string }) {
  const bersih = bersihHtml(html)
  if (!bersih) return null
  return <div className={`soal-rich-view ${className}`} dangerouslySetInnerHTML={{ __html: bersih }} />
}

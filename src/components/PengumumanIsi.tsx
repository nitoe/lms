import { useMemo } from 'react'
import { htmlDenganRumus, useKatexSiap } from '../lib/matematika'
import { htmlPengumumanBersih } from '../lib/pengumumanHtml'
import '../styles/pengumuman.css'

/**
 * Tampilan isi pengumuman (guru & siswa) — satu komponen agar tampilan selalu sama.
 * Urutan wajib: sanitasi (htmlPengumumanBersih) → rumus KaTeX (§9: jangan dibalik).
 */
export default function PengumumanIsi({ html, className = '' }: { html: string; className?: string }) {
  const bersih = useMemo(() => htmlPengumumanBersih(html), [html])
  const siap = useKatexSiap(bersih.includes('$'))
  const isi = siap ? htmlDenganRumus(bersih) : bersih
  return (
    <div className={`pg-isi${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={{ __html: isi }} />
  )
}

import { bersihHtmlStimulus } from '../../lib/html'
import { htmlDenganRumus, useKatexSiap } from '../../lib/matematika'
import { GambarSoal } from './GambarSoal'
import type { Soal } from '../../types/soal'

/** Apakah soal punya bahan bacaan/gambar yang layak ditaruh di panel terpisah. */
export function punyaStimulus(soal: Soal): boolean {
  return !!(soal.stimulus && soal.stimulus.trim()) || !!soal.gambarId
}

/**
 * Panel stimulus (teks bacaan + gambar). Dipakai SoalTampil (bertumpuk) dan halaman TKA
 * (dua kolom di layar lebar: bacaan kiri, soal kanan).
 */
export default function StimulusSoal({ soal, className = '' }: { soal: Soal; className?: string }) {
  const siap = useKatexSiap(!!soal.rumus)
  const bersih = bersihHtmlStimulus(soal.stimulus)
  if (!bersih && !soal.gambarId) return null
  const isi = siap ? htmlDenganRumus(bersih) : bersih
  return (
    <aside className={`stimulus-soal ${className}`} aria-label="Bahan bacaan">
      {isi && <div className="stimulus-teks soal-rich-view" dangerouslySetInnerHTML={{ __html: isi }} />}
      {soal.gambarId && <GambarSoal id={soal.gambarId} className="soal-img--soal" />}
    </aside>
  )
}

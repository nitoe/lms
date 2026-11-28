import { useMemo } from 'react'
import { bersihHtmlMateri, materiPunyaRumus } from '../../lib/html'
import { htmlDenganRumus, useKatexSiap } from '../../lib/matematika'

type Props = {
  html: string
  label?: string
  kosong?: string
}

/**
 * Pratinjau satu blok teks materi persis seperti di pembaca siswa:
 * kelas sama (`mh-blok mh-blok--teks soal-rich-view`), sanitasi sama (bersihHtmlMateri),
 * dan rumus `$…$` dirender KaTeX (editor Visual/HTML hanya menampilkan teks mentah `$…$`).
 * ANTIREGRESI §Materi.VisualHtml.
 */
export default function MateriTeksPratinjau({
  html,
  label = 'Pratinjau bacaan',
  kosong = 'Belum ada isi.',
}: Props) {
  const bersih = useMemo(() => bersihHtmlMateri(html), [html])
  const butuhKatex = materiPunyaRumus(bersih)
  const katexSiap = useKatexSiap(butuhKatex)
  const isi = katexSiap && butuhKatex ? htmlDenganRumus(bersih) : bersih

  return (
    <div className="mh-html-preview-wrap">
      <p className="mh-html-preview-label">{label}</p>
      {bersih ? (
        <div
          className="mh-blok mh-blok--teks soal-rich-view mh-html-preview"
          dangerouslySetInnerHTML={{ __html: isi }}
        />
      ) : (
        <p className="mh-html-preview-empty">{kosong}</p>
      )}
    </div>
  )
}

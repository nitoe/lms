import { useMemo } from 'react'
import { bersihHtmlLengkap, materiPunyaRumus } from '../../lib/html'
import { htmlDenganRumus, useKatexSiap } from '../../lib/matematika'
import type { MateriLms } from '../../types/materi'

type Props = {
  materi: MateriLms
  onTutup?: () => void
  mode?: 'siswa' | 'guru'
}

/**
 * Pembaca materi jenis «html».
 * Gambar eksternal (imgbb, Postimages, Drive, CDN) dimuat lewat <img src="https://…">
 * setelah sanitasi DOMPurify (ANTIREGRESI §MateriHtml).
 */
export default function MateriHtmlViewer({ materi, onTutup, mode = 'siswa' }: Props) {
  const isiMentah = materi.kontenHtml || ''
  const butuhKatex = useMemo(() => materiPunyaRumus(isiMentah), [isiMentah])
  const katexSiap = useKatexSiap(butuhKatex)

  const isi = useMemo(() => {
    const bersih = bersihHtmlLengkap(isiMentah)
    if (!bersih) return ''
    return katexSiap && materiPunyaRumus(bersih) ? htmlDenganRumus(bersih) : bersih
  }, [isiMentah, katexSiap])

  return (
    <div className="mh-viewer mh-viewer--html">
      <header className="mh-viewer-head">
        <div className="min-w-0 flex-1">
          {onTutup && (
            <button type="button" className="mh-viewer-back" onClick={onTutup}>
              ← Kembali
            </button>
          )}
          <h1 className="mh-viewer-title">{materi.judul}</h1>
          {materi.deskripsi && mode === 'guru' && (
            <p className="mh-viewer-subtitle">{materi.deskripsi}</p>
          )}
        </div>
        <span className="materi-jenis-chip" title="Materi HTML">
          HTML
        </span>
      </header>

      <article className="mh-blok mh-blok--teks mh-html-body">
        {isi ? (
          <div
            className="mh-html-content prose max-w-none"
            dangerouslySetInnerHTML={{ __html: isi }}
          />
        ) : (
          <p className="lms-empty">Konten HTML kosong.</p>
        )}
      </article>

      {materi.deskripsi && mode === 'siswa' && (
        <p className="mh-viewer-deskripsi">{materi.deskripsi}</p>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import {
  bersihHtmlLengkap,
  htmlButuhDokumenPenuh,
  materiPunyaRumus,
  siapkanHtmlDokumen,
} from '../../lib/html'
import { htmlDenganRumus, useKatexSiap } from '../../lib/matematika'
import type { MateriLms } from '../../types/materi'

type Props = {
  materi: MateriLms
  onTutup?: () => void
  mode?: 'siswa' | 'guru'
}

/**
 * Pembaca materi jenis «html».
 *
 * Dua mode:
 * 1) Dokumen penuh / modul interaktif (style, script, details, SVG, form) →
 *    iframe sandboxed + srcdoc. Contoh: MIPA Quest. Jangan strip lewat DOMPurify.
 * 2) Cuplikan sederhana → DOMPurify + optimasi gambar eksternal (inline).
 *
 * Keamanan iframe: sandbox tanpa allow-same-origin (skrip tidak menyentuh parent).
 * ANTIREGRESI §MateriHtml.Iframe
 */
export default function MateriHtmlViewer({ materi, onTutup, mode = 'siswa' }: Props) {
  const isiMentah = materi.kontenHtml || ''
  const dokumenPenuh = useMemo(() => htmlButuhDokumenPenuh(isiMentah), [isiMentah])
  const butuhKatex = useMemo(
    () => !dokumenPenuh && materiPunyaRumus(isiMentah),
    [isiMentah, dokumenPenuh],
  )
  const katexSiap = useKatexSiap(butuhKatex)

  const srcDoc = useMemo(() => {
    if (!dokumenPenuh) return ''
    return siapkanHtmlDokumen(isiMentah)
  }, [isiMentah, dokumenPenuh])

  const isiInline = useMemo(() => {
    if (dokumenPenuh) return ''
    const bersih = bersihHtmlLengkap(isiMentah)
    if (!bersih) return ''
    return katexSiap && materiPunyaRumus(bersih) ? htmlDenganRumus(bersih) : bersih
  }, [isiMentah, dokumenPenuh, katexSiap])

  return (
    <div className={`mh-viewer mh-viewer--html${dokumenPenuh ? ' mh-viewer--html-full' : ''}`}>
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

      {dokumenPenuh ? (
        <div className="mh-html-frame-wrap">
          <iframe
            className="mh-html-iframe"
            title={materi.judul || 'Materi HTML'}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
            referrerPolicy="no-referrer"
            // Tanpa allow-same-origin: skrip modul jalan, tidak bisa akses DOM parent.
          />
        </div>
      ) : (
        <article className="mh-blok mh-blok--teks mh-html-body">
          {isiInline ? (
            <div
              className="mh-html-content prose max-w-none"
              dangerouslySetInnerHTML={{ __html: isiInline }}
            />
          ) : (
            <p className="lms-empty">Konten HTML kosong.</p>
          )}
        </article>
      )}

      {materi.deskripsi && mode === 'siswa' && !dokumenPenuh && (
        <p className="mh-viewer-deskripsi">{materi.deskripsi}</p>
      )}
    </div>
  )
}

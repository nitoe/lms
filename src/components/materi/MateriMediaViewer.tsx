import { useEffect, useMemo, useState } from 'react'
import { ekstrakYoutubeId } from '../../lib/materi'
import MateriGambarZoom from './MateriGambarZoom'

export type MediaJenisPreview = 'youtube' | 'gambar' | 'video' | 'pdf' | 'tautan'

type Props = {
  judul: string
  deskripsi?: string
  jenis: MediaJenisPreview
  /** URL http(s) atau blob: dari Object URL file lokal. */
  url: string
  fileName?: string
  onTutup: () => void
  /** true = URL blob lokal (pratinjau form); jangan tampilkan «Buka di tab baru» sebagai utama. */
  lokal?: boolean
}

/**
 * Pratinjau / baca materi file (gambar, PDF, video), YouTube, atau tautan.
 * Dipakai di form sebelum simpan dan di daftar materi guru.
 */
export default function MateriMediaViewer({
  judul,
  deskripsi,
  jenis,
  url,
  fileName,
  onTutup,
  lokal = false,
}: Props) {
  const [gagal, setGagal] = useState(false)

  const ytId = useMemo(() => {
    if (jenis !== 'youtube') return null
    return ekstrakYoutubeId(url)
  }, [jenis, url])

  const embedYt = ytId ? `https://www.youtube.com/embed/${ytId}` : null

  useEffect(() => {
    setGagal(false)
  }, [url, jenis])

  return (
    <div className="mm-viewer">
      <header className="mm-viewer-head">
        <div className="min-w-0 flex-1">
          <button type="button" className="mm-viewer-back" onClick={onTutup}>
            ← Kembali
          </button>
          <h1 className="mm-viewer-title">{judul}</h1>
          {fileName && <p className="mm-viewer-sub">{fileName}</p>}
          {deskripsi && <p className="mm-viewer-desc">{deskripsi}</p>}
        </div>
        {!lokal && url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="lms-btn-secondary shrink-0"
          >
            Buka di tab baru
          </a>
        )}
      </header>

      <div className="mm-viewer-body">
        {jenis === 'youtube' && (
          <>
            {embedYt ? (
              <div className="mm-embed-wrap">
                <iframe
                  src={embedYt}
                  title={judul}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="mm-embed"
                />
              </div>
            ) : (
              <p className="lms-empty">URL YouTube tidak dikenali. Periksa tautan lalu coba lagi.</p>
            )}
          </>
        )}

        {jenis === 'gambar' && (
          <div className="mm-figure">
            {!gagal ? (
              <MateriGambarZoom src={url} alt={judul} />
            ) : (
              <p className="lms-empty">Gambar tidak dapat dimuat.</p>
            )}
            {/* deteksi error lewat img tersembunyi jika perlu — overlay zoom memakai src yang sama */}
            <img
              src={url}
              alt=""
              className="sr-only"
              aria-hidden
              onError={() => setGagal(true)}
            />
          </div>
        )}

        {jenis === 'video' && (
          <div className="mm-video-wrap">
            {!gagal ? (
              <video
                src={url}
                controls
                playsInline
                className="mm-video"
                onError={() => setGagal(true)}
              >
                Browser tidak mendukung pemutar video.
              </video>
            ) : (
              <p className="lms-empty">Video tidak dapat diputar di pratinjau.</p>
            )}
          </div>
        )}

        {jenis === 'pdf' && (
          <div className="mm-pdf-wrap">
            {!gagal ? (
              <iframe
                src={url}
                title={judul}
                className="mm-pdf"
                onError={() => setGagal(true)}
              />
            ) : (
              <p className="lms-empty">
                PDF tidak dapat ditampilkan di pratinjau.{' '}
                {!lokal && (
                  <a href={url} target="_blank" rel="noreferrer">
                    Buka di tab baru
                  </a>
                )}
              </p>
            )}
            <p className="mm-hint">
              Jika PDF kosong di sini, gunakan «Buka di tab baru». Beberapa browser membatasi
              pratinjau PDF dari penyimpanan lokal.
            </p>
          </div>
        )}

        {jenis === 'tautan' && (
          <div className="mm-tautan">
            <p className="mm-tautan-url">
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </p>
            <p className="mm-hint">
              Tautan eksternal dibuka di tab baru. Pratinjau inline tidak selalu tersedia karena
              kebijakan keamanan situs tujuan.
            </p>
            <a href={url} target="_blank" rel="noreferrer" className="lms-btn-primary mt-3 inline-flex">
              Buka tautan
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

/** Infer jenis media dari File untuk pratinjau form. */
export function jenisDariFileLokal(file: File): MediaJenisPreview | null {
  if (file.type.startsWith('image/')) return 'gambar'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')) {
    return 'pdf'
  }
  return null
}

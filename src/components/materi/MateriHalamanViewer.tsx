import { useEffect, useMemo, useState } from 'react'
import { bersihHtmlMateri, materiPunyaRumus } from '../../lib/html'
import { htmlDenganRumus, useKatexSiap } from '../../lib/matematika'
import type { MateriHalaman, MateriLms } from '../../types/materi'

type Props = {
  materi: MateriLms
  /** Mulai dari indeks halaman (0-based). */
  awal?: number
  onTutup?: () => void
  /** Mode guru: tampilkan judul materi + tombol tutup. */
  mode?: 'siswa' | 'guru'
}

/**
 * Pembaca materi multi-halaman.
 * HTML lewat bersihHtmlMateri (+ tabel); rumus `$…$` dirender KaTeX bila ada (selaras stimulus TKA).
 */
export default function MateriHalamanViewer({ materi, awal = 0, onTutup, mode = 'siswa' }: Props) {
  const pages = useMemo(() => {
    const list = Array.isArray(materi.halaman) ? [...materi.halaman] : []
    list.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
    return list
  }, [materi.halaman])

  const [idx, setIdx] = useState(() => Math.max(0, Math.min(awal, pages.length - 1)))

  useEffect(() => {
    setIdx((i) => Math.max(0, Math.min(i, Math.max(0, pages.length - 1))))
  }, [pages.length])

  const page: MateriHalaman | undefined = pages[idx]
  const total = pages.length

  /** Muat KaTeX hanya jika halaman aktif (atau materi) memuat tanda rumus. */
  const butuhKatex = useMemo(() => {
    if (!page) return false
    return page.blok.some((b) => b.tipe === 'teks' && materiPunyaRumus(b.html))
  }, [page])

  const katexSiap = useKatexSiap(butuhKatex)

  function prev() {
    setIdx((i) => Math.max(0, i - 1))
  }
  function next() {
    setIdx((i) => Math.min(total - 1, i + 1))
  }

  if (total === 0) {
    return (
      <div className="mh-viewer">
        <p className="lms-empty">Materi ini belum punya halaman.</p>
        {onTutup && (
          <button type="button" className="sw-btn-primary mt-3" onClick={onTutup}>
            Kembali
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mh-viewer">
      <header className="mh-viewer-head">
        <div className="min-w-0 flex-1">
          {onTutup && (
            <button type="button" className="mh-viewer-back" onClick={onTutup}>
              ← Kembali
            </button>
          )}
          <h1 className="mh-viewer-title">{materi.judul}</h1>
          {page?.judul && <p className="mh-viewer-subtitle">{page.judul}</p>}
        </div>
        <div className="mh-viewer-pager" aria-live="polite">
          <span className="mh-page-pill">
            {idx + 1} / {total}
          </span>
        </div>
      </header>

      <article className="mh-page" key={page?.id || idx}>
        {page?.blok.map((b) => {
          if (b.tipe === 'teks') {
            const bersih = bersihHtmlMateri(b.html)
            if (!bersih) return null
            const isi =
              katexSiap && materiPunyaRumus(bersih) ? htmlDenganRumus(bersih) : bersih
            return (
              <div
                key={b.id}
                className="mh-blok mh-blok--teks soal-rich-view"
                dangerouslySetInnerHTML={{ __html: isi }}
              />
            )
          }
          if (b.tipe === 'gambar' && b.url) {
            return (
              <figure key={b.id} className="mh-blok mh-blok--gambar">
                <img src={b.url} alt={b.alt || b.caption || 'Gambar materi'} loading="lazy" />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            )
          }
          return null
        })}
      </article>

      <nav className="mh-viewer-nav" aria-label="Navigasi halaman">
        <button type="button" className="mh-nav-btn" disabled={idx <= 0} onClick={prev}>
          ← Sebelumnya
        </button>
        <div className="mh-dots" role="tablist" aria-label="Pilih halaman">
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={`mh-dot ${i === idx ? 'mh-dot--on' : ''}`}
              title={p.judul || `Halaman ${i + 1}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
        <button type="button" className="mh-nav-btn" disabled={idx >= total - 1} onClick={next}>
          Berikutnya →
        </button>
      </nav>

      {mode === 'guru' && materi.deskripsi && (
        <p className="mh-viewer-deskripsi">{materi.deskripsi}</p>
      )}
    </div>
  )
}

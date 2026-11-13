import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { bersihHtmlMateri } from '../../lib/materiHalaman'
import type { HalamanMateri } from '../../types/materi'

type Props = {
  /** Kunci unik (id materi) untuk mengingat halaman terakhir. */
  materiId: string
  judul: string
  mapel: string
  halaman: HalamanMateri[]
  /** Warna aksen mapel (CSS background untuk header). */
  aksen: string
  mode: 'siswa' | 'pratinjau'
  onTutup: () => void
}

const KUNCI_FONT = 'lms_baca_font'
const UKURAN_FONT = [0.95, 1.1, 1.3] as const

function bacaStorage(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function tulisStorage(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* mode privat / penuh: abaikan */
  }
}

/** Ubah figure[data-yt] menjadi iframe youtube-nocookie. ID divalidasi (bukan dari HTML mentah). */
function hidrasiYoutube(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('figure[data-yt]').forEach((fig) => {
    const id = fig.getAttribute('data-yt') ?? ''
    if (!/^[\w-]{11}$/.test(id) || fig.querySelector('iframe')) return
    const cap = fig.querySelector('figcaption')
    const kotak = document.createElement('div')
    kotak.className = 'mb-yt'
    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`
    iframe.title = cap?.textContent || 'Video YouTube'
    iframe.loading = 'lazy'
    iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen'
    iframe.setAttribute('allowfullscreen', '')
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    kotak.appendChild(iframe)
    fig.insertBefore(kotak, fig.firstChild)
  })
}

export default function MateriBaca({ materiId, judul, mapel, halaman, aksen, mode, onTutup }: Props) {
  const jumlah = halaman.length
  const kunciHal = `lms_baca_${materiId}`
  const [idx, setIdx] = useState(() => {
    if (mode !== 'siswa') return 0
    const n = Number(bacaStorage(kunciHal))
    return Number.isInteger(n) && n >= 0 && n < jumlah ? n : 0
  })
  const [font, setFont] = useState(() => {
    const n = Number(bacaStorage(KUNCI_FONT))
    return Number.isInteger(n) && n >= 0 && n < UKURAN_FONT.length ? n : 1
  })
  const [daftar, setDaftar] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  const [arah, setArah] = useState<'maju' | 'mundur'>('maju')
  const [dikunjungi, setDikunjungi] = useState<Set<number>>(() => new Set([idx]))
  const isiRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const sentuh = useRef<{ x: number; y: number; abaikan: boolean } | null>(null)

  const aman = Math.min(Math.max(idx, 0), Math.max(jumlah - 1, 0))
  const h = halaman[aman]
  const html = useMemo(() => bersihHtmlMateri(h?.html), [h])
  const terakhir = aman >= jumlah - 1

  const pindah = useCallback(
    (ke: number) => {
      if (ke < 0 || ke >= jumlah) return
      setArah(ke > aman ? 'maju' : 'mundur')
      setIdx(ke)
      setDikunjungi((s) => new Set(s).add(ke))
      setDaftar(false)
    },
    [aman, jumlah],
  )

  // Kunci scroll latar selama pembaca terbuka.
  useEffect(() => {
    const lama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = lama
    }
  }, [])

  // Ingat halaman terakhir (siswa) + gulir ke atas tiap ganti halaman.
  useEffect(() => {
    if (mode === 'siswa') tulisStorage(kunciHal, String(aman))
    areaRef.current?.scrollTo({ top: 0 })
  }, [aman, kunciHal, mode])

  useEffect(() => {
    tulisStorage(KUNCI_FONT, String(font))
  }, [font])

  useLayoutEffect(() => {
    if (isiRef.current) hidrasiYoutube(isiRef.current)
  }, [html])

  // Keyboard: ← → Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'ArrowRight') pindah(aman + 1)
      else if (e.key === 'ArrowLeft') pindah(aman - 1)
      else if (e.key === 'Escape') {
        if (zoom) setZoom(null)
        else if (daftar) setDaftar(false)
        else onTutup()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aman, daftar, onTutup, pindah, zoom])

  function mulaiSentuh(e: React.TouchEvent) {
    const t = e.touches[0]
    const el = e.target as HTMLElement
    // Jangan merebut geseran pada pemutar media, tabel yang bisa digulir, atau input.
    const abaikan = !!el.closest('audio, video, iframe, input, .mb-gulir, table')
    sentuh.current = { x: t.clientX, y: t.clientY, abaikan }
  }
  function akhirSentuh(e: React.TouchEvent) {
    const s = sentuh.current
    sentuh.current = null
    if (!s || s.abaikan) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Math.abs(dx) > Math.abs(dy) * 2) {
      pindah(aman + (dx < 0 ? 1 : -1))
    }
  }

  function klikIsi(e: React.MouseEvent) {
    const el = e.target as HTMLElement
    if (el.tagName === 'IMG' && el.closest('figure[data-gambar]')) {
      setZoom((el as HTMLImageElement).src)
    }
  }

  if (!h) {
    return (
      <div className="mb-root" role="dialog" aria-label={judul}>
        <div className="mb-kosong">
          Materi ini belum punya halaman.
          <button type="button" className="mb-btn mb-btn--utama" onClick={onTutup}>Kembali</button>
        </div>
      </div>
    )
  }

  const persen = jumlah <= 1 ? 100 : Math.round(((aman + 1) / jumlah) * 100)

  return (
    <div className="mb-root" role="dialog" aria-modal="true" aria-label={`Materi ${judul}`} style={{ ['--mb-font' as string]: `${UKURAN_FONT[font]}rem` }}>
      <header className="mb-head" style={{ background: aksen }}>
        <button type="button" className="mb-ikon" onClick={onTutup} aria-label={mode === 'pratinjau' ? 'Tutup pratinjau' : 'Tutup materi'}>
          ✕
        </button>
        <div className="mb-judul">
          <span className="mb-mapel">{mode === 'pratinjau' ? `Pratinjau · ${mapel}` : mapel}</span>
          <strong>{judul}</strong>
        </div>
        <div className="mb-alat">
          <button type="button" className="mb-ikon" onClick={() => setFont((f) => Math.max(0, f - 1))} disabled={font === 0} aria-label="Perkecil huruf">
            A−
          </button>
          <button type="button" className="mb-ikon" onClick={() => setFont((f) => Math.min(UKURAN_FONT.length - 1, f + 1))} disabled={font === UKURAN_FONT.length - 1} aria-label="Perbesar huruf">
            A+
          </button>
        </div>
      </header>
      <div className="mb-progres" role="progressbar" aria-valuemin={1} aria-valuemax={jumlah} aria-valuenow={aman + 1} aria-label="Kemajuan membaca">
        <span style={{ width: `${persen}%` }} />
      </div>

      <div className="mb-area" ref={areaRef} onTouchStart={mulaiSentuh} onTouchEnd={akhirSentuh}>
        <article className={`mb-halaman mb-halaman--${arah}`} key={h.id}>
          <p className="mb-nomor">Halaman {aman + 1} dari {jumlah}</p>
          {h.judul && <h1 className="mb-h1">{h.judul}</h1>}
          <div
            ref={isiRef}
            className="mt-isi mb-isi"
            onClick={klikIsi}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {terakhir && (
            <div className="mb-selesai">
              <strong>Itu halaman terakhir.</strong>
              <span>{mode === 'pratinjau' ? 'Akhir pratinjau.' : 'Kamu sudah membaca sampai selesai.'}</span>
            </div>
          )}
        </article>
      </div>

      <nav className="mb-nav" aria-label="Navigasi halaman">
        <button type="button" className="mb-btn" onClick={() => pindah(aman - 1)} disabled={aman === 0}>
          ‹ <span>Sebelumnya</span>
        </button>
        <button type="button" className="mb-btn mb-btn--tengah" onClick={() => setDaftar(true)} aria-haspopup="dialog">
          ☰ <span>{aman + 1} / {jumlah}</span>
        </button>
        {terakhir ? (
          <button type="button" className="mb-btn mb-btn--utama" onClick={onTutup}>
            <span>Selesai</span> ✓
          </button>
        ) : (
          <button type="button" className="mb-btn mb-btn--utama" onClick={() => pindah(aman + 1)}>
            <span>Lanjut</span> ›
          </button>
        )}
      </nav>

      {daftar && (
        <div className="mb-lapis" onClick={() => setDaftar(false)}>
          <aside className="mb-daftar" role="dialog" aria-label="Daftar halaman" onClick={(e) => e.stopPropagation()}>
            <div className="mb-daftar-kepala">
              <strong>Daftar halaman</strong>
              <button type="button" className="mb-ikon mb-ikon--gelap" onClick={() => setDaftar(false)} aria-label="Tutup daftar">✕</button>
            </div>
            <ol>
              {halaman.map((p, i) => (
                <li key={p.id}>
                  <button type="button" className={`mb-daftar-item ${i === aman ? 'mb-daftar-item--on' : ''}`} onClick={() => pindah(i)}>
                    <span className={`mb-bulat ${dikunjungi.has(i) && i !== aman ? 'mb-bulat--sudah' : ''}`}>{i + 1}</span>
                    <span>{p.judul || `Halaman ${i + 1}`}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}

      {zoom && (
        <div className="mb-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Gambar diperbesar">
          <img src={zoom} alt="Gambar diperbesar" />
          <span>Ketuk di mana saja untuk menutup</span>
        </div>
      )}
    </div>
  )
}

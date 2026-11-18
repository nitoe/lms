import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  src: string
  alt?: string
  caption?: string
  /** Class tambahan pada <img> inline (mis. dari CSS mh-blok). */
  className?: string
}

const MIN = 1
const MAX = 5
const STEP = 0.35

type Pt = { x: number; y: number }

/**
 * Gambar materi: ketuk / klik → layar penuh dengan pinch-zoom, gulir, dan tombol ±.
 * Inline tetap object-fit contain; detail dibaca di overlay.
 */
export default function MateriGambarZoom({ src, alt, caption, className }: Props) {
  const [buka, setBuka] = useState(false)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 })

  const scaleRef = useRef(1)
  const posRef = useRef<Pt>({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPan = useRef<Pt | null>(null)
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const setScaleBoth = useCallback((s: number) => {
    const v = Math.min(MAX, Math.max(MIN, s))
    scaleRef.current = v
    setScale(v)
  }, [])

  const setPosBoth = useCallback((p: Pt) => {
    posRef.current = p
    setPos(p)
  }, [])

  const resetView = useCallback(() => {
    setScaleBoth(1)
    setPosBoth({ x: 0, y: 0 })
  }, [setPosBoth, setScaleBoth])

  const tutup = useCallback(() => {
    setBuka(false)
    resetView()
  }, [resetView])

  useEffect(() => {
    if (!buka) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') tutup()
      if (e.key === '+' || e.key === '=') setScaleBoth(scaleRef.current + STEP)
      if (e.key === '-') setScaleBoth(scaleRef.current - STEP)
      if (e.key === '0') resetView()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [buka, resetView, setScaleBoth, tutup])

  function bukaZoom() {
    resetView()
    setBuka(true)
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -STEP : STEP
    setScaleBoth(scaleRef.current + delta)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    dragging.current = true
    lastPan.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || !lastPan.current) return
    if (scaleRef.current <= 1.02) return
    const dx = e.clientX - lastPan.current.x
    const dy = e.clientY - lastPan.current.y
    lastPan.current = { x: e.clientX, y: e.clientY }
    setPosBoth({
      x: posRef.current.x + dx,
      y: posRef.current.y + dy,
    })
  }

  function onPointerUp(e: React.PointerEvent) {
    dragging.current = false
    lastPan.current = null
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  function distTouches(a: Touch, b: Touch) {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.hypot(dx, dy)
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      dragging.current = false
      pinchStart.current = {
        dist: distTouches(e.touches[0], e.touches[1]),
        scale: scaleRef.current,
      }
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault()
      const d = distTouches(e.touches[0], e.touches[1])
      const ratio = d / Math.max(1, pinchStart.current.dist)
      setScaleBoth(pinchStart.current.scale * ratio)
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchStart.current = null
  }

  function onDoubleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (scaleRef.current > 1.2) {
      resetView()
    } else {
      setScaleBoth(2.5)
    }
  }

  return (
    <>
      <figure className="mh-blok mh-blok--gambar mh-zoom-inline">
        <button
          type="button"
          className="mh-zoom-hit"
          onClick={bukaZoom}
          aria-label="Perbesar gambar"
          title="Ketuk untuk perbesar · cubit untuk zoom"
        >
          <img
            src={src}
            alt={alt || caption || 'Gambar materi'}
            loading="lazy"
            className={className}
            draggable={false}
          />
          <span className="mh-zoom-hint" aria-hidden>
            Ketuk untuk perbesar
          </span>
        </button>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>

      {buka && (
        <div
          className="mh-zoom-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Perbesar gambar"
          ref={overlayRef}
        >
          <div className="mh-zoom-toolbar">
            <button type="button" className="mh-zoom-btn" onClick={tutup} title="Tutup (Esc)">
              ✕ Tutup
            </button>
            <div className="mh-zoom-tools">
              <button
                type="button"
                className="mh-zoom-btn"
                onClick={() => setScaleBoth(scaleRef.current - STEP)}
                disabled={scale <= MIN}
                title="Perkecil (−)"
              >
                −
              </button>
              <span className="mh-zoom-pct">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="mh-zoom-btn"
                onClick={() => setScaleBoth(scaleRef.current + STEP)}
                disabled={scale >= MAX}
                title="Perbesar (+)"
              >
                +
              </button>
              <button type="button" className="mh-zoom-btn" onClick={resetView} title="Reset (0)">
                1×
              </button>
            </div>
          </div>

          <div
            className="mh-zoom-stage"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={onDoubleClick}
          >
            <img
              src={src}
              alt={alt || caption || 'Gambar materi'}
              className="mh-zoom-img"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              }}
              draggable={false}
            />
          </div>

          <p className="mh-zoom-legenda">
            Cubit untuk zoom · seret untuk geser · ketuk dua kali perbesar/reset
            {caption ? ` · ${caption}` : ''}
          </p>
        </div>
      )}
    </>
  )
}

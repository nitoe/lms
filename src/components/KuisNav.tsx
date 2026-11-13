import type { KeyboardEvent, ReactNode } from 'react'
import { IkonKembali } from './ikonRuang'
import '../styles/kuis-nav.css'

/**
 * Komponen navigasi di dalam panel Kuis (detail kuis & laporan hasil).
 * Aksen mengikuti `--rg-a` yang diset KelasDetail (warna mapel); fallback ke ungu sekolah.
 */

export type OpsiNav<T extends string> = {
  v: T
  teks: string
  ikon?: ReactNode
  /** Angka kecil di sebelah label (opsional). */
  n?: number
}

type SegmenProps<T extends string> = {
  label: string
  nilai: T
  opsi: OpsiNav<T>[]
  onPilih: (v: T) => void
  /** Bila diisi, dipakai sebagai tablist ARIA (id `${idPrefix}-tab-<v>`, kontrol `${idPrefix}-panel`). */
  idPrefix?: string
  kecil?: boolean
}

/** Kontrol segmen (satu pilihan aktif). Dengan `idPrefix` berperan sebagai tab + navigasi panah. */
export function KnSegmen<T extends string>({ label, nilai, opsi, onPilih, idPrefix, kecil }: SegmenProps<T>) {
  const sebagaiTab = !!idPrefix

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (!sebagaiTab) return
    let ke = -1
    if (e.key === 'ArrowRight') ke = (i + 1) % opsi.length
    else if (e.key === 'ArrowLeft') ke = (i - 1 + opsi.length) % opsi.length
    else if (e.key === 'Home') ke = 0
    else if (e.key === 'End') ke = opsi.length - 1
    if (ke < 0) return
    e.preventDefault()
    onPilih(opsi[ke].v)
    document.getElementById(`${idPrefix}-tab-${opsi[ke].v}`)?.focus()
  }

  return (
    <div
      className={`kn-seg${kecil ? ' kn-seg--kecil' : ''}`}
      role={sebagaiTab ? 'tablist' : 'group'}
      aria-label={label}
    >
      {opsi.map((o, i) => {
        const aktif = nilai === o.v
        return (
          <button
            key={o.v}
            type="button"
            id={sebagaiTab ? `${idPrefix}-tab-${o.v}` : undefined}
            role={sebagaiTab ? 'tab' : undefined}
            aria-selected={sebagaiTab ? aktif : undefined}
            aria-controls={sebagaiTab ? `${idPrefix}-panel` : undefined}
            aria-pressed={sebagaiTab ? undefined : aktif}
            tabIndex={sebagaiTab && !aktif ? -1 : undefined}
            className={`kn-seg-btn${aktif ? ' kn-seg-btn--on' : ''}`}
            onClick={() => onPilih(o.v)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.ikon}
            {o.teks}
            {o.n !== undefined && <span className="kn-seg-n">{o.n}</span>}
          </button>
        )
      })}
    </div>
  )
}

type ChipsProps<T extends string> = {
  label: string
  nilai: T
  opsi: OpsiNav<T>[]
  onPilih: (v: T) => void
}

/** Pilihan saringan berbentuk chip (satu aktif) dengan label di kiri. */
export function KnChips<T extends string>({ label, nilai, opsi, onPilih }: ChipsProps<T>) {
  return (
    <div className="kn-chips" role="group" aria-label={label}>
      <span className="kn-chips-label">{label}</span>
      {opsi.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`kn-chip-btn${nilai === o.v ? ' kn-chip-btn--on' : ''}`}
          aria-pressed={nilai === o.v}
          onClick={() => onPilih(o.v)}
        >
          {o.teks}
          {o.n !== undefined && <span className="kn-seg-n">{o.n}</span>}
        </button>
      ))}
    </div>
  )
}

/** Tombol kembali bergaya sama di seluruh panel kuis. */
export function KnKembali({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="kn-kembali" onClick={onClick}>
      <IkonKembali size={15} />
      {children}
    </button>
  )
}

export type ChipKepala = { teks: string; nada?: 'aktif' | 'nonaktif' | 'online' | 'offline' | 'jenis' | 'netral'; title?: string }

type KepalaProps<T extends string> = {
  onKembali: () => void
  labelKembali: string
  judul: string
  chips: ChipKepala[]
  nav: Omit<SegmenProps<T>, 'kecil'>
}

/** Kepala detail kuis: tombol kembali, judul + chip status, dan menu segmen. */
export function KuisKepala<T extends string>({ onKembali, labelKembali, judul, chips, nav }: KepalaProps<T>) {
  return (
    <header className="kn-kepala">
      <div className="kn-kepala-atas">
        <KnKembali onClick={onKembali}>{labelKembali}</KnKembali>
        <div className="kn-judul-blok">
          <h3 className="kn-judul" title={judul}>
            {judul || 'Kuis tanpa judul'}
          </h3>
          <div className="kn-meta">
            {chips.map((c) => (
              <span key={c.teks} className={`kn-chip kn-chip--${c.nada ?? 'netral'}`} title={c.title}>
                {c.teks}
              </span>
            ))}
          </div>
        </div>
      </div>
      <KnSegmen {...nav} />
    </header>
  )
}

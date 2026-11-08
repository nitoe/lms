import { useEffect, useRef, useState } from 'react'
import { ambilGambar, unggahGambar } from '../../lib/gambar'

/** Menampilkan gambar soal dari `lms_gambar`. */
export function GambarSoal({ id, className = '', alt = '' }: { id?: string; className?: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [gagal, setGagal] = useState(false)

  useEffect(() => {
    let batal = false
    setSrc(null)
    setGagal(false)
    if (!id) return
    void ambilGambar(id).then((d) => {
      if (batal) return
      if (d) setSrc(d)
      else setGagal(true)
    })
    return () => {
      batal = true
    }
  }, [id])

  if (!id) return null
  if (gagal) return <div className={`soal-img-ph ${className}`}>Gambar tidak dapat dimuat</div>
  if (!src) return <div className={`soal-img-ph soal-img-ph--load ${className}`} aria-busy />
  return <img src={src} alt={alt} className={`soal-img ${className}`} />
}

type PickerProps = {
  gambarId?: string
  onChange: (id: string | undefined) => void
  /** Tampilan ringkas untuk baris pilihan. */
  kecil?: boolean
  label?: string
}

/** Tombol unggah + pratinjau + hapus gambar. */
export function GambarPicker({ gambarId, onChange, kecil = false, label = 'Tambah gambar' }: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [galat, setGalat] = useState('')

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setGalat('')
    try {
      onChange(await unggahGambar(file))
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mengunggah gambar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`soal-picker ${kecil ? 'soal-picker--kecil' : ''}`}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void pilih(e)} />
      {gambarId ? (
        <div className="soal-picker-pratinjau">
          <GambarSoal id={gambarId} className={kecil ? 'soal-img--kecil' : 'soal-img--besar'} />
          <div className="soal-picker-aksi">
            <button type="button" className="soal-ikon-btn" disabled={busy} onClick={() => inputRef.current?.click()}
              title="Ganti gambar" aria-label="Ganti gambar">
              ⟳
            </button>
            <button type="button" className="soal-ikon-btn soal-ikon-btn--bahaya" disabled={busy}
              onClick={() => onChange(undefined)} title="Hapus gambar" aria-label="Hapus gambar">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="soal-picker-tambah" disabled={busy} onClick={() => inputRef.current?.click()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>{busy ? 'Mengunggah…' : label}</span>
        </button>
      )}
      {galat && <p className="soal-galat">{galat}</p>}
    </div>
  )
}

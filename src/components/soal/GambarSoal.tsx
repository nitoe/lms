import { useEffect, useRef, useState } from 'react'
import {
  ambilGambar,
  ambilGambarDariClipboardApi,
  ambilGambarDariDataTransfer,
  salinDataUrlKeClipboard,
  unggahGambar,
} from '../../lib/gambar'
import { bolehGenerateSoalAi, generateDanSimpanIlustrasiSoal } from '../../lib/generateSoalAi'
import { auth } from '../../lib/firebase'

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
  kecil?: boolean
  label?: string
  /** Konteks soal untuk ilustrasi AI. */
  ai?: {
    teksSoal: string
    kelas?: string
    mapel?: string
  }
}

/**
 * Unggah manual, tempel dari clipboard (Ctrl+V / tombol Tempel), opsional generate ilustrasi AI.
 * Salin gambar yang sudah ada agar bisa ditempel ke soal lain tanpa file sumber.
 */
export function GambarPicker({ gambarId, onChange, kecil = false, label = 'Tambah gambar', ai }: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const zonaRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [busyAi, setBusyAi] = useState(false)
  const [busySalin, setBusySalin] = useState(false)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [deskripsiAi, setDeskripsiAi] = useState('')
  const [formDetail, setFormDetail] = useState(false)
  const [zonaAktif, setZonaAktif] = useState(false)
  const bolehAi = bolehGenerateSoalAi(auth.currentUser?.uid) && !!ai

  async function prosesFile(file: File | null | undefined) {
    if (!file) return
    setBusy(true)
    setGalat('')
    setInfo('')
    try {
      onChange(await unggahGambar(file))
      setInfo('Gambar berhasil ditambahkan.')
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mengunggah gambar.')
    } finally {
      setBusy(false)
    }
  }

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    await prosesFile(file)
  }

  function onPaste(e: React.ClipboardEvent) {
    const file = ambilGambarDariDataTransfer(e.clipboardData)
    if (!file) return
    // Hanya cegah default bila clipboard berisi gambar — biarkan teks tertempel di editor lain.
    e.preventDefault()
    e.stopPropagation()
    void prosesFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setZonaAktif(false)
    const file = ambilGambarDariDataTransfer(e.dataTransfer)
    void prosesFile(file)
  }

  async function tempelDariClipboard() {
    setGalat('')
    setInfo('')
    setBusy(true)
    try {
      const file = await ambilGambarDariClipboardApi()
      if (!file) {
        setGalat('Clipboard tidak berisi gambar. Salin gambar dulu (screenshot atau Salin di soal lain).')
        return
      }
      onChange(await unggahGambar(file))
      setInfo('Gambar dari clipboard berhasil ditambahkan.')
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal membaca clipboard.')
    } finally {
      setBusy(false)
    }
  }

  async function salinGambar() {
    if (!gambarId) return
    setBusySalin(true)
    setGalat('')
    setInfo('')
    try {
      const dataUrl = await ambilGambar(gambarId)
      if (!dataUrl) throw new Error('Gambar tidak dapat dimuat untuk disalin.')
      await salinDataUrlKeClipboard(dataUrl)
      setInfo('Gambar disalin. Pindah ke soal lain lalu Tempel atau Ctrl+V.')
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyalin gambar.')
    } finally {
      setBusySalin(false)
    }
  }

  async function generateAi() {
    if (!ai) return
    const teks = (ai.teksSoal || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const petunjuk = deskripsiAi.trim()
    if (teks.length < 8 && petunjuk.length < 4) {
      setGalat('Tulis narasi soal dulu, atau isi deskripsi opsional bila ingin lebih spesifik.')
      return
    }
    setBusyAi(true)
    setGalat('')
    setInfo('')
    try {
      const id = await generateDanSimpanIlustrasiSoal({
        teksSoal: ai.teksSoal,
        petunjukGambar: petunjuk || undefined,
        kelas: ai.kelas,
        mapel: ai.mapel,
      })
      onChange(id)
      setFormDetail(false)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal membuat ilustrasi AI.')
    } finally {
      setBusyAi(false)
    }
  }

  const sibuk = busy || busyAi || busySalin

  return (
    <div
      ref={zonaRef}
      className={`soal-picker ${kecil ? 'soal-picker--kecil' : ''} ${zonaAktif ? 'soal-picker--tempel' : ''}`}
      tabIndex={0}
      onPaste={onPaste}
      onDragEnter={(e) => {
        e.preventDefault()
        setZonaAktif(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setZonaAktif(true)
      }}
      onDragLeave={(e) => {
        if (!zonaRef.current?.contains(e.relatedTarget as Node)) setZonaAktif(false)
      }}
      onDrop={onDrop}
      aria-label="Area gambar soal — unggah, tempel, atau seret gambar"
    >
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void pilih(e)} />
      {gambarId ? (
        <div className="soal-picker-pratinjau">
          <GambarSoal id={gambarId} className={kecil ? 'soal-img--kecil' : 'soal-img--besar'} />
          <div className="soal-picker-aksi">
            <button
              type="button"
              className="soal-ikon-btn"
              disabled={sibuk}
              onClick={() => void salinGambar()}
              title="Salin gambar (untuk ditempel ke soal lain)"
              aria-label="Salin gambar"
            >
              {busySalin ? '…' : '⧉'}
            </button>
            <button
              type="button"
              className="soal-ikon-btn"
              disabled={sibuk}
              onClick={() => inputRef.current?.click()}
              title="Ganti gambar (unggah file)"
              aria-label="Ganti gambar"
            >
              ⟳
            </button>
            <button
              type="button"
              className="soal-ikon-btn"
              disabled={sibuk}
              onClick={() => void tempelDariClipboard()}
              title="Tempel gambar dari clipboard"
              aria-label="Tempel gambar"
            >
              ⎘
            </button>
            {bolehAi && (
              <button
                type="button"
                className="soal-ikon-btn"
                disabled={sibuk}
                onClick={() => void generateAi()}
                title="Buat ulang ilustrasi AI (tanpa membocorkan jawaban)"
                aria-label="Ilustrasi AI"
              >
                {busyAi ? '…' : '✦'}
              </button>
            )}
            <button
              type="button"
              className="soal-ikon-btn soal-ikon-btn--bahaya"
              disabled={sibuk}
              onClick={() => onChange(undefined)}
              title="Hapus gambar"
              aria-label="Hapus gambar"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="soal-picker-kosong">
          <button
            type="button"
            className="soal-picker-tambah"
            disabled={sibuk}
            onClick={() => inputRef.current?.click()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{busy ? 'Mengunggah…' : label}</span>
          </button>
          <div className="soal-picker-tempel-bar">
            <button
              type="button"
              className="soal-picker-tempel"
              disabled={sibuk}
              onClick={() => void tempelDariClipboard()}
              title="Tempel gambar yang sudah disalin (Ctrl+V juga bisa di area ini)"
            >
              {busy ? 'Menempel…' : '⎘ Tempel gambar'}
            </button>
            <span className="soal-picker-tempel-hint">
              atau fokus di sini lalu Ctrl+V / ⌘V · seret file juga bisa
            </span>
          </div>
          {bolehAi && (
            <div className="soal-picker-ai-bar">
              <button
                type="button"
                className="soal-picker-ai"
                disabled={sibuk}
                onClick={() => void generateAi()}
              >
                {busyAi ? 'AI menggambar…' : '✦ Generate ilustrasi'}
              </button>
              <button
                type="button"
                className="soal-picker-ai-detail"
                disabled={sibuk}
                aria-expanded={formDetail}
                onClick={() => setFormDetail((v) => !v)}
                title="Tambahkan deskripsi agar ilustrasi lebih tepat (organ, sudut pandang, tabel, dll.)"
              >
                {formDetail ? '▾ Sembunyikan deskripsi' : '▸ Deskripsi ilustrasi (opsional)'}
              </button>
            </div>
          )}
        </div>
      )}

      {bolehAi && formDetail && (
        <div className="soal-picker-ai-form">
          <label className="materi-field">
            <span>Deskripsi ilustrasi (opsional) — agar AI lebih tepat</span>
            <textarea
              rows={3}
              maxLength={3000}
              value={deskripsiAi}
              onChange={(e) => setDeskripsiAi(e.target.value)}
              placeholder={
                'Kosongkan jika AI cukup membaca soal. Isi hanya bila perlu lebih spesifik, mis. ' +
                '"tabel 2 kolom Hari|Suhu" atau "diagram paru dengan panah ke salah satu bagian, tanpa nama organ".'
              }
            />
          </label>
          <p className="soal-picker-ai-hint">
            Ilustrasi tidak boleh membocorkan jawaban (tanpa label nama yang diminta soal) dan tidak boleh
            tampak seperti screenshot lembar soal dari internet.
          </p>
          <button
            type="button"
            className="lms-btn-primary"
            disabled={busyAi}
            onClick={() => void generateAi()}
          >
            {busyAi ? 'AI menggambar…' : 'Generate dengan opsi ini'}
          </button>
        </div>
      )}

      {info && !galat && <p className="soal-picker-info">{info}</p>}
      {galat && <p className="soal-galat">{galat}</p>}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ambilGambar, unggahGambar } from '../../lib/gambar'
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
    targetJawaban?: string
  }
}

/**
 * Unggah manual + opsional generate ilustrasi AI.
 * Deskripsi AI opsional — hanya untuk spesifikasi tambahan (tabel/grafik, dll.).
 */
export function GambarPicker({ gambarId, onChange, kecil = false, label = 'Tambah gambar', ai }: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [busyAi, setBusyAi] = useState(false)
  const [galat, setGalat] = useState('')
  const [deskripsiAi, setDeskripsiAi] = useState('')
  const [formDetail, setFormDetail] = useState(false)
  const bolehAi = bolehGenerateSoalAi(auth.currentUser?.uid) && !!ai

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
    try {
      const id = await generateDanSimpanIlustrasiSoal({
        teksSoal: ai.teksSoal,
        petunjukGambar: petunjuk || undefined,
        kelas: ai.kelas,
        mapel: ai.mapel,
        targetJawaban: ai.targetJawaban,
        variasi: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      onChange(id)
      setFormDetail(false)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal membuat ilustrasi AI.')
    } finally {
      setBusyAi(false)
    }
  }

  return (
    <div className={`soal-picker ${kecil ? 'soal-picker--kecil' : ''}`}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void pilih(e)} />
      {gambarId ? (
        <div className="soal-picker-pratinjau">
          <GambarSoal id={gambarId} className={kecil ? 'soal-img--kecil' : 'soal-img--besar'} />
          <div className="soal-picker-aksi">
            <button type="button" className="soal-ikon-btn" disabled={busy || busyAi} onClick={() => inputRef.current?.click()}
              title="Ganti gambar" aria-label="Ganti gambar">⟳</button>
            {bolehAi && (
              <button type="button" className="soal-ikon-btn" disabled={busy || busyAi}
                onClick={() => void generateAi()}
                title="Buat ulang ilustrasi AI (tanpa membocorkan jawaban)" aria-label="Ilustrasi AI">
                {busyAi ? '…' : '✦'}
              </button>
            )}
            <button type="button" className="soal-ikon-btn soal-ikon-btn--bahaya" disabled={busy || busyAi}
              onClick={() => onChange(undefined)} title="Hapus gambar" aria-label="Hapus gambar">✕</button>
          </div>
        </div>
      ) : (
        <div className="soal-picker-kosong">
          <button type="button" className="soal-picker-tambah" disabled={busy || busyAi} onClick={() => inputRef.current?.click()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{busy ? 'Mengunggah…' : label}</span>
          </button>
          {bolehAi && (
            <div className="soal-picker-ai-bar">
              <button
                type="button"
                className="soal-picker-ai"
                disabled={busy || busyAi}
                onClick={() => void generateAi()}
              >
                {busyAi ? 'AI menggambar…' : '✦ Generate ilustrasi'}
              </button>
              <button
                type="button"
                className="soal-picker-ai-detail"
                disabled={busy || busyAi}
                aria-expanded={formDetail}
                onClick={() => setFormDetail((v) => !v)}
              >
                {formDetail ? 'Sembunyikan opsi' : 'Opsi deskripsi (opsional)'}
              </button>
            </div>
          )}
        </div>
      )}

      {bolehAi && formDetail && (
        <div className="soal-picker-ai-form">
          <label className="materi-field">
            <span>Deskripsi tambahan (opsional)</span>
            <textarea
              rows={3}
              maxLength={600}
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

      {galat && <p className="soal-galat">{galat}</p>}
    </div>
  )
}

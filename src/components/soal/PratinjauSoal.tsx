import { useEffect, useMemo, useState } from 'react'
import SoalTampil from './SoalTampil'
import { nilaiJawaban } from '../../lib/penilaian'
import type { JawabanSoal, PaketSoal } from '../../types/soal'

/** Pratinjau paket seperti dilihat siswa, lengkap dengan "Periksa jawaban" untuk menguji kunci. */
export default function PratinjauSoal({ paket, onTutup }: { paket: PaketSoal; onTutup: () => void }) {
  const [jawaban, setJawaban] = useState<Record<string, JawabanSoal>>({})
  const [diperiksa, setDiperiksa] = useState(false)
  const seed = useMemo(() => Math.random().toString(36).slice(2), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', onKey)
    const lama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = lama
    }
  }, [onTutup])

  const soalTampil = useMemo(() => {
    if (!paket.acakSoal) return paket.soal
    // Pengacakan sederhana berbasis seed sesi pratinjau.
    return [...paket.soal].sort((a, b) => (a.id + seed).localeCompare(b.id + seed))
  }, [paket.soal, paket.acakSoal, seed])

  const hasil = useMemo(
    () => (diperiksa ? soalTampil.map((s) => nilaiJawaban(s, jawaban[s.id])) : []),
    [diperiksa, soalTampil, jawaban],
  )
  const skor = hasil.reduce((t, h) => t + h.skor, 0)
  const maks = soalTampil.reduce((t, s) => t + s.poin, 0)
  const adaManual = hasil.some((h) => h.status === 'manual')

  function ulangi() {
    setJawaban({})
    setDiperiksa(false)
  }

  return (
    <div className="soal-modal" role="dialog" aria-modal="true" aria-label="Pratinjau paket soal">
      <div className="soal-modal-kotak">
        <header className="soal-modal-kepala">
          <div className="min-w-0">
            <p className="soal-modal-sub">Pratinjau tampilan siswa</p>
            <h2 className="truncate text-base font-bold text-slate-900">{paket.judul || 'Paket soal'}</h2>
          </div>
          <button type="button" className="lms-btn-secondary" onClick={onTutup}>Tutup</button>
        </header>

        <div className="soal-modal-badan">
          {soalTampil.length === 0 && <div className="lms-empty">Belum ada soal.</div>}
          {soalTampil.map((s, i) => (
            <SoalTampil
              key={s.id}
              soal={s}
              nomor={i + 1}
              seed={seed}
              jawaban={jawaban[s.id]}
              onJawab={(j) => setJawaban((p) => ({ ...p, [s.id]: j }))}
              diperiksa={diperiksa}
              hasil={hasil[i]}
            />
          ))}
        </div>

        <footer className="soal-modal-kaki">
          {diperiksa ? (
            <>
              <p className="text-sm font-semibold text-slate-800">
                Skor uji: {Math.round(skor * 100) / 100} / {maks}
                {adaManual && <span className="font-normal text-muted"> (uraian dinilai guru)</span>}
              </p>
              <button type="button" className="lms-btn-secondary" onClick={ulangi}>Coba lagi</button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">Ini hanya uji coba — jawaban tidak disimpan.</p>
              <button type="button" className="lms-btn-primary" onClick={() => setDiperiksa(true)}>
                Periksa jawaban
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

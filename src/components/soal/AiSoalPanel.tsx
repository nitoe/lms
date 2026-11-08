import { useState } from 'react'
import {
  bolehGenerateSoalAi,
  generateSoalLmsAi,
  type DrafSoalAi,
} from '../../lib/generateSoalAi'
import type { KompleksitasSoal, Soal, TipeSoal } from '../../types/soal'
import {
  NAMA_KOMPLEKSITAS,
  NAMA_TIPE,
  URUTAN_KOMPLEKSITAS,
  URUTAN_TIPE,
} from '../../types/soal'

type Props = {
  uid?: string
  kelas: string
  mapel: string
  tpNama?: string
  tpNomor?: number
  onTerima: (soal: Soal[]) => void
}

export default function AiSoalPanel({ uid, kelas, mapel, tpNama, tpNomor, onTerima }: Props) {
  const boleh = bolehGenerateSoalAi(uid)
  const [buka, setBuka] = useState(false)
  const [tipe, setTipe] = useState<TipeSoal>('pg')
  const [kompleksitas, setKompleksitas] = useState<KompleksitasSoal>('L1')
  const [jumlah, setJumlah] = useState(2)
  const [konteks, setKonteks] = useState('')
  const [butuhStimulus, setButuhStimulus] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draf, setDraf] = useState<DrafSoalAi[] | null>(null)

  if (!boleh) return null

  async function jalankan(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setDraf(null)
    try {
      const list = await generateSoalLmsAi({
        mapel,
        kelas,
        tpNama,
        tpNomor,
        tipe,
        kompleksitas,
        jumlah,
        konteks: konteks.trim() || undefined,
        butuhStimulus,
      })
      setDraf(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal generate soal.')
    } finally {
      setBusy(false)
    }
  }

  function terimaSemua() {
    if (!draf?.length) return
    onTerima(draf.map(({ butuhGambar: _b, petunjukGambar: _p, ...s }) => s as Soal))
    setDraf(null)
    setBuka(false)
  }

  return (
    <div className="ai-soal">
      <button
        type="button"
        className="lms-btn-secondary ai-soal-toggle"
        aria-expanded={buka}
        onClick={() => setBuka((v) => !v)}
      >
        {buka ? 'Tutup AI soal' : '✦ Buat soal dengan AI'}
      </button>

      {buka && (
        <form className="materi-form ai-soal-form" onSubmit={(e) => void jalankan(e)}>
          <div className="materi-form-head">
            <h3 className="text-sm font-semibold text-slate-900">Generate soal (Gemini)</h3>
            <span className="text-xs text-muted">Kunci API tidak pernah ke peramban</span>
          </div>
          <p className="ai-soal-hint">
            AI mengikuti prinsip Buku Saku: tepat sasaran (selaras TP & level), stem jelas,
            stimulus hanya jika fungsional, distractor bermakna. Hasil tetap perlu Anda tinjau.
          </p>
          <div className="materi-form-grid">
            <label className="materi-field">
              <span>Bentuk soal</span>
              <select value={tipe} onChange={(e) => setTipe(e.target.value as TipeSoal)}>
                {URUTAN_TIPE.map((t) => (
                  <option key={t} value={t}>{NAMA_TIPE[t]}</option>
                ))}
              </select>
            </label>
            <label className="materi-field">
              <span>Kompleksitas</span>
              <select value={kompleksitas} onChange={(e) => setKompleksitas(e.target.value as KompleksitasSoal)}>
                {URUTAN_KOMPLEKSITAS.map((k) => (
                  <option key={k} value={k}>{NAMA_KOMPLEKSITAS[k]}</option>
                ))}
              </select>
            </label>
            <label className="materi-field">
              <span>Jumlah</span>
              <select value={jumlah} onChange={(e) => setJumlah(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} soal</option>
                ))}
              </select>
            </label>
            <label className="soal-cek" style={{ alignSelf: 'end', paddingBottom: '0.35rem' }}>
              <input
                type="checkbox"
                checked={butuhStimulus}
                onChange={(e) => setButuhStimulus(e.target.checked)}
              />
              <span>Wajibkan stimulus fungsional</span>
            </label>
            <label className="materi-field materi-field--full">
              <span>Fokus materi / catatan (opsional)</span>
              <input
                value={konteks}
                maxLength={800}
                onChange={(e) => setKonteks(e.target.value)}
                placeholder="Contoh: pecahan senilai; hindari soal cerita terlalu panjang"
              />
            </label>
          </div>
          {tpNama && (
            <p className="ai-soal-tp" title={tpNama}>
              TP terpilih: {tpNomor ? `${tpNomor}. ` : ''}{tpNama}
            </p>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <button type="submit" className="lms-btn-primary" disabled={busy}>
              {busy ? 'Menghubungi AI…' : 'Generate soal'}
            </button>
          </div>

          {draf && draf.length > 0 && (
            <div className="ai-soal-draf">
              <div className="ai-soal-draf-kepala">
                <strong>{draf.length} draf siap ditinjau</strong>
                <button type="button" className="lms-btn-primary" onClick={terimaSemua}>
                  Masukkan ke paket
                </button>
              </div>
              <ol className="ai-soal-draf-list">
                {draf.map((s, i) => (
                  <li key={s.id}>
                    <span className="ai-soal-draf-meta">
                      {NAMA_TIPE[s.tipe]} · {s.kompleksitas} · {s.poin} poin
                      {s.butuhGambar ? ' · perlu ilustrasi' : ''}
                    </span>
                    <p className="ai-soal-draf-teks">
                      {(s.teks || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)}
                      {(s.teks || '').length > 280 ? '…' : ''}
                    </p>
                    {s.petunjukGambar && (
                      <p className="ai-soal-petunjuk-gbr">Ilustrasi: {s.petunjukGambar}</p>
                    )}
                    <span className="sr-only">Draf {i + 1}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

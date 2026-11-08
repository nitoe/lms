import { useState } from 'react'
import {
  bolehGenerateSoalAi,
  generateSoalLmsAi,
} from '../../lib/generateSoalAi'
import type { KompleksitasSoal, Soal } from '../../types/soal'
import { NAMA_KOMPLEKSITAS, NAMA_TIPE, normalisasiKompleksitas } from '../../types/soal'

type Props = {
  uid?: string
  /** Soal aktif yang akan diisi ulang AI (id dipertahankan). */
  soal: Soal
  nomor: number
  kelas: string
  mapel: string
  tpNama?: string
  tpNomor?: number
  onTerapkan: (soal: Soal) => void
}

/**
 * AI untuk SATU nomor soal saja — guru meninjau per soal.
 * Memakai tipe & kompleksitas yang sudah dipilih di kartu.
 */
export default function AiSoalPanel({
  uid, soal, nomor, kelas, mapel, tpNama, tpNomor, onTerapkan,
}: Props) {
  const boleh = bolehGenerateSoalAi(uid)
  const [buka, setBuka] = useState(false)
  const [fokus, setFokus] = useState('')
  const [butuhStimulus, setButuhStimulus] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!boleh) return null

  const kompleksitas = normalisasiKompleksitas(soal.kompleksitas) as KompleksitasSoal

  async function jalankan(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const list = await generateSoalLmsAi({
        mapel,
        kelas,
        tpNama,
        tpNomor,
        tipe: soal.tipe,
        kompleksitas,
        jumlah: 1,
        konteks: fokus.trim() || undefined,
        butuhStimulus,
      })
      const draf = list[0]
      if (!draf) throw new Error('AI tidak mengembalikan soal.')
      // Pertahankan id & (opsional) gambar yang sudah ada kecuali AI minta ganti lewat alur ilustrasi.
      const { butuhGambar: _b, petunjukGambar: _p, ...isi } = draf
      onTerapkan({
        ...isi,
        id: soal.id,
        gambarId: soal.gambarId,
      } as Soal)
      setBuka(false)
      setFokus('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal generate soal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-soal ai-soal--kartu">
      <button
        type="button"
        className="lms-btn-secondary ai-soal-toggle"
        aria-expanded={buka}
        onClick={() => setBuka((v) => !v)}
      >
        {buka ? 'Tutup AI' : `✦ AI tulis soal ${nomor}`}
      </button>

      {buka && (
        <form className="ai-soal-form-inline" onSubmit={(e) => void jalankan(e)}>
          <p className="ai-soal-hint">
            Satu soal saja — tipe <strong>{NAMA_TIPE[soal.tipe]}</strong>,{' '}
            <strong>{NAMA_KOMPLEKSITAS[kompleksitas]}</strong>.
            Sesuaikan tipe/kompleksitas di kartu dulu bila generate. Tinjau hasil sebelum lanjut ke nomor berikutnya.
          </p>
          <label className="materi-field">
            <span>Fokus materi / konteks (opsional)</span>
            <input
              value={fokus}
              maxLength={800}
              onChange={(e) => setFokus(e.target.value)}
              placeholder="Contoh: membaca tabel suhu; pecahan senilai; siklus air"
            />
          </label>
          <label className="soal-cek">
            <input
              type="checkbox"
              checked={butuhStimulus}
              onChange={(e) => setButuhStimulus(e.target.checked)}
            />
            <span>Sertakan stimulus fungsional (teks/data yang dipakai menjawab)</span>
          </label>
          {tpNama && (
            <p className="ai-soal-tp" title={tpNama}>
              TP: {tpNomor ? `${tpNomor}. ` : ''}{tpNama}
            </p>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="lms-btn-ghost" disabled={busy} onClick={() => setBuka(false)}>
              Batal
            </button>
            <button type="submit" className="lms-btn-primary" disabled={busy}>
              {busy ? 'Menulis…' : `Generate soal ${nomor}`}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

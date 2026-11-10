import { useState } from 'react'
import {
  bolehGenerateSoalAi,
  generateSoalLmsAi,
  type LevelStimulusAi,
} from '../../lib/generateSoalAi'
import type { KompleksitasSoal, Soal } from '../../types/soal'
import { adalahMapelTka } from '../../lib/tkaAkses'
import { NAMA_KOMPLEKSITAS, NAMA_TIPE, normalisasiKompleksitas } from '../../types/soal'

const OPSI_STIMULUS: { id: LevelStimulusAi; label: string; deskripsi: string }[] = [
  {
    id: 'tanpa',
    label: 'Tanpa stimulus',
    deskripsi: 'Hanya stem (pertanyaan). Cocok recall fakta singkat.',
  },
  {
    id: 'ringan',
    label: 'Ringan',
    deskripsi: '1–2 kalimat konteks atau data minimal yang dipakai menjawab.',
  },
  {
    id: 'sedang',
    label: 'Sedang',
    deskripsi: 'Paragraf pendek / tabel kecil / dialog singkat — fungsional.',
  },
  {
    id: 'kaya',
    label: 'Kaya (teks panjang)',
    deskripsi: 'Narasi atau eksplanasi panjang (mis. Bahasa Indonesia), proporsional kelas & TP.',
  },
]

type Props = {
  uid?: string
  soal: Soal
  nomor: number
  kelas: string
  mapel: string
  tpNama?: string
  tpNomor?: number
  onTerapkan: (soal: Soal) => void
  soalLain?: string[]
}

/**
 * AI untuk SATU nomor soal — menulis ulang teks soal + opsi/kunci (id soal tetap).
 */
export default function AiSoalPanel({
  uid, soal, nomor, kelas, mapel, tpNama, tpNomor, onTerapkan, soalLain = [],
}: Props) {
  const boleh = bolehGenerateSoalAi(uid)
  const [buka, setBuka] = useState(false)
  const [fokus, setFokus] = useState('')
  const [levelStimulus, setLevelStimulus] = useState<LevelStimulusAi>('ringan')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!boleh) return null

  const kompleksitas = normalisasiKompleksitas(soal.kompleksitas) as KompleksitasSoal

  async function jalankan(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const hindari = soalLain
        .map((t) => String(t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length > 8)
        .slice(0, 12)
      const list = await generateSoalLmsAi({
        mapel,
        kelas,
        tpNama,
        tpNomor,
        tipe: soal.tipe,
        kompleksitas,
        jumlah: 1,
        konteks: fokus.trim() || undefined,
        levelStimulus,
        gantiTeks: true,
        variasi: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        hindariSoal: hindari.length ? hindari : undefined,
      })
      const draf = list[0]
      if (!draf) throw new Error('AI tidak mengembalikan soal.')
      const teksBaru = (draf.teks || '').trim()
      if (!teksBaru) throw new Error('AI tidak mengisi narasi soal. Coba generate lagi.')

      const { butuhGambar: _b, petunjukGambar: _p, ...isi } = draf
      const tka = adalahMapelTka(mapel)
      const level = levelStimulus
      // TKA: teks panjang dari AI masuk ke kotak stimulus; pertanyaan singkat di teks soal.
      // Mapel biasa: perilaku lama (semua di teks soal). ANTIREGRESI §86.
      let stimulus: string | undefined = (draf as { stimulus?: string }).stimulus?.trim() || undefined
      let teksHasil = teksBaru
      if (tka && level && level !== 'tanpa') {
        if (!stimulus) {
          stimulus = teksBaru
          teksHasil =
            soal.tipe === 'bs'
              ? 'Berdasarkan bacaan di atas, tentukan kebenaran setiap pernyataan.'
              : soal.tipe === 'pgk'
                ? 'Berdasarkan bacaan di atas, pilihlah semua jawaban yang tepat.'
                : 'Berdasarkan bacaan di atas, pilihlah jawaban yang tepat.'
        }
      }
      onTerapkan({
        ...isi,
        teks: teksHasil,
        ...(stimulus ? { stimulus } : {}),
        id: soal.id,
        // Gambar lama sering tidak cocok dengan narasi baru — lepas agar guru pilih ulang / AI ilustrasi.
        gambarId: undefined,
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
            AI akan <strong>menulis ulang narasi soal</strong> beserta pilihan/kunci sesuai tipe{' '}
            <strong>{NAMA_TIPE[soal.tipe]}</strong> dan <strong>{NAMA_KOMPLEKSITAS[kompleksitas]}</strong>.
            Sesuaikan tipe & kompleksitas di kartu sebelum generate.
          </p>

          <label className="materi-field">
            <span>Fokus materi / konteks (opsional)</span>
            <input
              value={fokus}
              maxLength={800}
              onChange={(e) => setFokus(e.target.value)}
              placeholder="Contoh: teks eksplanasi siklus air; tabel suhu harian; pecahan senilai"
            />
          </label>

          <fieldset className="ai-stimulus-field">
            <legend>Level stimulus</legend>
            <p className="ai-soal-hint" style={{ marginBottom: '0.35rem' }}>
              Stimulus = bahan yang harus dibaca/dilihat untuk menjawab (bukan hiasan).
              Pilih <strong>Kaya</strong> untuk teks narasi/eksplanasi panjang (mis. Bahasa Indonesia).
            </p>
            <div className="ai-stimulus-opsi">
              {OPSI_STIMULUS.map((o) => (
                <label key={o.id} className={`ai-stimulus-kartu ${levelStimulus === o.id ? 'ai-stimulus-kartu--aktif' : ''}`}>
                  <input
                    type="radio"
                    name={`stimulus-${nomor}`}
                    value={o.id}
                    checked={levelStimulus === o.id}
                    onChange={() => setLevelStimulus(o.id)}
                  />
                  <span className="ai-stimulus-judul">{o.label}</span>
                  <span className="ai-stimulus-desk">{o.deskripsi}</span>
                </label>
              ))}
            </div>
          </fieldset>

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

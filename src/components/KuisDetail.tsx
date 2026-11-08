import { useEffect, useState } from 'react'
import { updateKuis } from '../lib/kuis'
import { hitungRingkasanKuis } from '../lib/susunKuis'
import { teksPolos } from '../lib/html'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_TIPE } from '../types/soal'

type Props = {
  kuis: KuisLms
  onUpdated?: () => void
}

export default function KuisDetail({ kuis, onUpdated }: Props) {
  const [soal, setSoal] = useState<SoalKuis[]>(() => [...(kuis.soal ?? [])])
  const [judul, setJudul] = useState(kuis.judul)
  const [deskripsi, setDeskripsi] = useState(kuis.deskripsi ?? '')
  const [durasi, setDurasi] = useState(kuis.durasiMenit ?? 0)
  const [acakSoal, setAcakSoal] = useState(!!kuis.acakSoal)
  const [acakOpsi, setAcakOpsi] = useState(kuis.acakOpsi !== false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    setSoal([...(kuis.soal ?? [])])
    setJudul(kuis.judul)
    setDeskripsi(kuis.deskripsi ?? '')
    setDurasi(kuis.durasiMenit ?? 0)
    setAcakSoal(!!kuis.acakSoal)
    setAcakOpsi(kuis.acakOpsi !== false)
  }, [kuis])

  const ringkas = hitungRingkasanKuis(soal)

  function setPoin(idx: number, poin: number) {
    setSoal((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], poin: Math.max(0, poin) }
      return next
    })
  }

  function naik(idx: number) {
    if (idx <= 0) return
    setSoal((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function turun(idx: number) {
    setSoal((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  function hapusSoal(idx: number) {
    if (!confirm('Hapus soal ini dari kuis? (Bank soal tidak berubah.)')) return
    setSoal((prev) => prev.filter((_, i) => i !== idx))
  }

  async function simpan() {
    if (!judul.trim()) {
      setError('Judul wajib diisi.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await updateKuis(kuis.id, {
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || undefined,
        soal,
        durasiMenit: durasi > 0 ? durasi : undefined,
        acakSoal,
        acakOpsi,
      })
      setInfo('Tersimpan.')
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="materi-form space-y-3">
        <label className="materi-field">
          <span>Judul</span>
          <input value={judul} onChange={(e) => setJudul(e.target.value)} />
        </label>
        <label className="materi-field">
          <span>Deskripsi</span>
          <textarea rows={2} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="materi-field" style={{ maxWidth: '8rem' }}>
            <span>Durasi (menit)</span>
            <input
              type="number"
              min={0}
              value={durasi}
              onChange={(e) => setDurasi(Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input type="checkbox" checked={acakSoal} onChange={(e) => setAcakSoal(e.target.checked)} />
            Acak urutan soal
          </label>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input type="checkbox" checked={acakOpsi} onChange={(e) => setAcakOpsi(e.target.checked)} />
            Acak opsi PG
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="lms-count-pill">
          {ringkas.jumlahSoal} soal · {ringkas.totalPoin} poin
        </span>
        <button type="button" className="lms-btn-primary" disabled={busy} onClick={() => void simpan()}>
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <ul className="space-y-2">
        {soal.map((s, i) => (
          <li
            key={`${s.sumberPaketId}-${s.id}-${i}`}
            className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap gap-2 items-start"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-800">
                <span className="font-semibold text-slate-500 mr-1">{i + 1}.</span>
                {teksPolos(s.teks).slice(0, 160) || '(tanpa teks)'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-2">
                <span>{NAMA_TIPE[s.tipe]}</span>
                <span>{s.kompleksitas || 'L1'}</span>
                {s.sumberPaketJudul && <span title="Sumber paket">← {s.sumberPaketJudul}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-xs text-slate-600 flex items-center gap-1">
                Poin
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={s.poin}
                  onChange={(e) => setPoin(i, Number(e.target.value) || 0)}
                  className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                />
              </label>
              <button type="button" className="lms-btn-ghost text-xs" onClick={() => naik(i)} title="Naikkan">
                ↑
              </button>
              <button type="button" className="lms-btn-ghost text-xs" onClick={() => turun(i)} title="Turunkan">
                ↓
              </button>
              <button
                type="button"
                className="materi-btn-danger text-xs"
                onClick={() => hapusSoal(i)}
              >
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>

      {soal.length === 0 && (
        <div className="lms-empty">Tidak ada soal. Buat ulang kuis dari bank soal.</div>
      )}
    </div>
  )
}

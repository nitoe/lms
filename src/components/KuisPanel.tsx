import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { daftarKuis, buatKuis, hapusKuis } from '../lib/kuis'
import type { KuisLms } from '../types/kuis'
import KuisBuilder from './KuisBuilder'

type Props = {
  kelas: string
  mapel: string
}

export default function KuisPanel({ kelas, mapel }: Props) {
  const { profil } = useAuth()
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [judulBaru, setJudulBaru] = useState('')
  const [modeTambah, setModeTambah] = useState(false)

  const muat = useCallback(async () => {
    setError('')
    try {
      const data = await daftarKuis(kelas, mapel)
      setList(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kuis.')
      setList([])
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  async function onBuat(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const id = await buatKuis({
        kelas,
        mapel,
        judul: judulBaru,
        namaGuru: profil?.nama,
      })
      setJudulBaru('')
      setModeTambah(false)
      await muat()
      setSelectedId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat kuis.')
    } finally {
      setBusy(false)
    }
  }

  async function onHapus(k: KuisLms) {
    if (!confirm(`Hapus kuis «${k.judul}» beserta semua soalnya?`)) return
    setBusy(true)
    setError('')
    try {
      await hapusKuis(k.id)
      if (selectedId === k.id) setSelectedId(null)
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  if (selectedId) {
    const kuis = list?.find((k) => k.id === selectedId)
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="text-sm font-semibold text-muh-600 hover:underline"
          onClick={() => setSelectedId(null)}
        >
          ← Kembali ke daftar kuis
        </button>
        {kuis && <KuisBuilder kuis={kuis} onUpdated={muat} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="lms-count-pill">
            {list === null ? '…' : `${list.length} kuis`}
          </span>
        </div>
        <button
          type="button"
          className="lms-btn-primary"
          onClick={() => setModeTambah(true)}
        >
          + Kuis baru
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {modeTambah && (
        <form onSubmit={(e) => void onBuat(e)} className="materi-form">
          <div className="materi-form-head">
            <h3 className="text-sm font-semibold text-slate-900">Buat kuis baru</h3>
            <button type="button" className="lms-btn-ghost" onClick={() => setModeTambah(false)}>
              Batal
            </button>
          </div>
          <label className="materi-field">
            <span>Judul kuis</span>
            <input
              required
              value={judulBaru}
              onChange={(e) => setJudulBaru(e.target.value)}
              placeholder="Contoh: Kuis Perkalian Kelas 3"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="lms-btn-secondary" onClick={() => setModeTambah(false)} disabled={busy}>
              Batal
            </button>
            <button type="submit" className="lms-btn-primary" disabled={busy}>
              {busy ? 'Membuat…' : 'Buat'}
            </button>
          </div>
        </form>
      )}

      {list === null && <div className="lms-empty">Memuat kuis…</div>}

      {list && list.length === 0 && !modeTambah && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada kuis</p>
          <p className="mt-1">Buat kuis pertama untuk mulai menambahkan soal.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="materi-list">
          {list.map((k) => (
            <li key={k.id} className="materi-item">
              <div className="materi-item-body">
                <div className="materi-item-title">{k.judul}</div>
                <div className="materi-item-meta">
                  <span>{k.jumlahSoal ?? 0} soal</span>
                  <span className={k.aktif ? 'text-emerald-700' : 'text-slate-500'}>
                    {k.aktif ? 'Aktif' : 'Draf'}
                  </span>
                </div>
              </div>
              <div className="materi-item-actions">
                <button
                  type="button"
                  className="lms-btn-primary"
                  onClick={() => setSelectedId(k.id)}
                >
                  Buka
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onHapus(k)}
                  className="materi-btn-danger"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

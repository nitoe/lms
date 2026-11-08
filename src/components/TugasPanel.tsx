import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { daftarTugas, buatTugas, hapusTugas, updateTugas } from '../lib/tugas'
import type { TugasLms } from '../types/tugas'

type Props = {
  kelas: string
  mapel: string
}

export default function TugasPanel({ kelas, mapel }: Props) {
  const { profil } = useAuth()
  const [list, setList] = useState<TugasLms[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [judulBaru, setJudulBaru] = useState('')
  const [deskripsiBaru, setDeskripsiBaru] = useState('')
  const [modeTambah, setModeTambah] = useState(false)

  const muat = useCallback(async () => {
    setError('')
    try {
      const data = await daftarTugas(kelas, mapel)
      setList(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat tugas.')
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
      await buatTugas({
        kelas,
        mapel,
        judul: judulBaru,
        deskripsi: deskripsiBaru,
        namaGuru: profil?.nama,
      })
      setJudulBaru('')
      setDeskripsiBaru('')
      setModeTambah(false)
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat tugas.')
    } finally {
      setBusy(false)
    }
  }

  async function onHapus(t: TugasLms) {
    if (!confirm(`Hapus tugas «${t.judul}»?`)) return
    setBusy(true)
    setError('')
    try {
      await hapusTugas(t.id)
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleAktif(t: TugasLms) {
    setBusy(true)
    try {
      await updateTugas(t.id, { aktif: !t.aktif })
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="lms-count-pill">
            {list === null ? '…' : `${list.length} tugas`}
          </span>
        </div>
        <button
          type="button"
          className="lms-btn-primary"
          onClick={() => setModeTambah(true)}
        >
          + Tugas baru
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
            <h3 className="text-sm font-semibold text-slate-900">Buat tugas baru</h3>
            <button type="button" className="lms-btn-ghost" onClick={() => setModeTambah(false)}>
              Batal
            </button>
          </div>
          <label className="materi-field">
            <span>Judul tugas</span>
            <input
              required
              value={judulBaru}
              onChange={(e) => setJudulBaru(e.target.value)}
              placeholder="Contoh: Tugas Menggambar Pemandangan"
            />
          </label>
          <label className="materi-field">
            <span>Deskripsi (opsional)</span>
            <textarea
              value={deskripsiBaru}
              onChange={(e) => setDeskripsiBaru(e.target.value)}
              rows={3}
              placeholder="Instruksi untuk siswa…"
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

      {list === null && <div className="lms-empty">Memuat tugas…</div>}

      {list && list.length === 0 && !modeTambah && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada tugas</p>
          <p className="mt-1">Buat tugas pertama untuk mulai memberikan pekerjaan kepada siswa.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="materi-list">
          {list.map((t) => (
            <li key={t.id} className="materi-item">
              <div className="materi-item-body">
                <div className="materi-item-title">{t.judul}</div>
                {t.deskripsi && <div className="text-sm text-muted mt-1">{t.deskripsi}</div>}
                <div className="materi-item-meta">
                  <span className={t.aktif ? 'text-emerald-700' : 'text-slate-500'}>
                    {t.aktif ? 'Aktif' : 'Draf'}
                  </span>
                </div>
              </div>
              <div className="materi-item-actions">
                <button
                  type="button"
                  className="lms-btn-secondary"
                  onClick={() => void toggleAktif(t)}
                  disabled={busy}
                >
                  {t.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onHapus(t)}
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

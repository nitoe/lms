import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { buatPaket, daftarPaket, hapusPaket } from '../lib/soal'
import { getTpMapelKelas } from '../lib/tpData'
import type { TpRingkas } from '../types/materi'
import type { PaketSoal } from '../types/soal'
import '../styles/soal.css'

type Props = { kelas: string; mapel: string; ruangId: string }

function formatTanggal(v: unknown): string {
  const t = v as { toDate?: () => Date } | undefined
  if (!t || typeof t.toDate !== 'function') return 'baru saja'
  return t.toDate().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function BankSoalPanel({ kelas, mapel, ruangId }: Props) {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<PaketSoal[] | null>(null)
  const [tpList, setTpList] = useState<TpRingkas[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formBuka, setFormBuka] = useState(false)
  const [judul, setJudul] = useState('')
  const [tpId, setTpId] = useState('')
  const [q, setQ] = useState('')

  const muat = useCallback(async () => {
    setError('')
    try {
      const [p, tp] = await Promise.all([daftarPaket(kelas, mapel), getTpMapelKelas(mapel, kelas).catch(() => [])])
      setList(p)
      setTpList(tp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat bank soal.')
      setList([])
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  const tersaring = useMemo(() => {
    if (!list) return []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((p) => p.judul.toLowerCase().includes(s) || (p.tpNama ?? '').toLowerCase().includes(s))
  }, [list, q])

  async function buat(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const tp = tpList.find((t) => t.id === tpId)
      const id = await buatPaket({
        kelas,
        mapel,
        judul,
        tpId: tp?.id,
        tpNomor: tp?.nomorTp,
        tpNama: tp?.namaTp,
        namaGuru: profil?.nama,
      })
      navigate(`/kelas/${encodeURIComponent(ruangId)}/soal/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat paket soal.')
      setBusy(false)
    }
  }

  async function hapus(p: PaketSoal) {
    if (!confirm(`Hapus paket «${p.judul}» beserta ${p.jumlahSoal} soalnya? Tindakan ini tidak bisa dibatalkan.`)) return
    setBusy(true)
    setError('')
    try {
      await hapusPaket(p.id)
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus paket.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="lms-count-pill">
            {list === null ? '…' : `${tersaring.length}${q ? ` / ${list.length}` : ''} paket`}
          </span>
          <div className="lms-search" style={{ maxWidth: '16rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
            <input type="search" placeholder="Cari paket soal…" value={q} onChange={(e) => setQ(e.target.value)}
              aria-label="Cari paket soal" />
          </div>
        </div>
        <button type="button" className="lms-btn-primary" onClick={() => setFormBuka((v) => !v)}>
          + Paket soal baru
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</div>
      )}

      {formBuka && (
        <form onSubmit={(e) => void buat(e)} className="materi-form">
          <div className="materi-form-head">
            <h3 className="text-sm font-semibold text-slate-900">Paket soal baru</h3>
            <button type="button" className="lms-btn-ghost" onClick={() => setFormBuka(false)}>Batal</button>
          </div>
          <div className="materi-form-grid">
            <label className="materi-field">
              <span>Judul paket</span>
              <input required value={judul} maxLength={200} onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Latihan pecahan senilai" />
            </label>
            <label className="materi-field">
              <span>Tujuan Pembelajaran (opsional)</span>
              <select value={tpId} onChange={(e) => setTpId(e.target.value)}>
                <option value="">— tanpa TP —</option>
                {tpList.map((t) => (
                  <option key={t.id} value={t.id}>TP {t.nomorTp}. {t.namaTp}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" className="lms-btn-primary" disabled={busy || !judul.trim()}>
              {busy ? 'Membuat…' : 'Buat & buka editor'}
            </button>
          </div>
        </form>
      )}

      {list === null && <div className="lms-empty">Memuat bank soal…</div>}
      {list !== null && list.length === 0 && !error && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada paket soal</p>
          <p className="mt-1">Buat paket pertama: ketik soal sendiri, tambahkan gambar, lalu uji dengan pratinjau.</p>
        </div>
      )}

      <ul className="paket-list">
        {tersaring.map((p) => (
          <li key={p.id} className="paket-item">
            <div className="paket-ikon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/kelas/${encodeURIComponent(ruangId)}/soal/${p.id}`} className="paket-judul">
                {p.judul}
              </Link>
              <div className="paket-meta">
                <span className={`paket-status paket-status--${p.status}`}>{p.status === 'siap' ? 'Siap' : 'Draf'}</span>
                <span>{p.jumlahSoal} soal</span>
                <span>{p.totalPoin} poin</span>
                {p.tpNama && <span className="paket-tp">TP {p.tpNomor ? `${p.tpNomor}. ` : ''}{p.tpNama}</span>}
                <span>Diubah {formatTanggal(p.updatedAt)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link to={`/kelas/${encodeURIComponent(ruangId)}/soal/${p.id}`} className="lms-btn-secondary">Buka</Link>
              <button type="button" className="materi-btn-danger" disabled={busy} onClick={() => void hapus(p)}>
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

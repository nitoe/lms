import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { buatPaket, daftarPaket, hapusPaket } from '../lib/soal'
import { getTpMapelKelas } from '../lib/tpData'
import type { TpRingkas } from '../types/materi'
import type { KompleksitasSoal, PaketSoal, TipeSoal } from '../types/soal'
import {
  NAMA_KOMPLEKSITAS,
  NAMA_TIPE,
  URUTAN_KOMPLEKSITAS,
  URUTAN_TIPE,
  normalisasiKompleksitas,
} from '../types/soal'
import '../styles/soal.css'

type Props = { kelas: string; mapel: string; ruangId: string }

type GrupMode = 'tidak' | 'tp' | 'tipe' | 'kompleksitas'

function formatTanggal(v: unknown): string {
  const t = v as { toDate?: () => Date } | undefined
  if (!t || typeof t.toDate !== 'function') return 'baru saja'
  return t.toDate().toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function hitungTipe(p: PaketSoal): Partial<Record<TipeSoal, number>> {
  if (p.jumlahPerTipe && Object.keys(p.jumlahPerTipe).length) return p.jumlahPerTipe
  const out: Partial<Record<TipeSoal, number>> = {}
  for (const s of p.soal ?? []) {
    out[s.tipe] = (out[s.tipe] ?? 0) + 1
  }
  return out
}

function hitungKompleksitas(p: PaketSoal): Partial<Record<KompleksitasSoal, number>> {
  if (p.jumlahPerKompleksitas && Object.keys(p.jumlahPerKompleksitas).length) {
    return p.jumlahPerKompleksitas
  }
  const out: Partial<Record<KompleksitasSoal, number>> = {}
  for (const s of p.soal ?? []) {
    const k = normalisasiKompleksitas(s.kompleksitas)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
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

  /* Filter & pengelompokan */
  const [filterTp, setFilterTp] = useState('')
  const [filterTipe, setFilterTipe] = useState<'' | TipeSoal>('')
  const [filterKompleksitas, setFilterKompleksitas] = useState<'' | KompleksitasSoal>('')
  const [filterStatus, setFilterStatus] = useState<'' | 'draf' | 'siap'>('')
  const [grupMode, setGrupMode] = useState<GrupMode>('tidak')

  const muat = useCallback(async () => {
    setError('')
    try {
      const [p, tp] = await Promise.all([
        daftarPaket(kelas, mapel),
        getTpMapelKelas(mapel, kelas).catch(() => []),
      ])
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
    return list.filter((p) => {
      if (s) {
        const hay = `${p.judul} ${p.tpNama ?? ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (filterStatus && p.status !== filterStatus) return false
      if (filterTp) {
        if (filterTp === '__tanpa__') {
          if (p.tpId) return false
        } else if (p.tpId !== filterTp) return false
      }
      if (filterTipe) {
        const jt = hitungTipe(p)
        if (!(jt[filterTipe] ?? 0)) return false
      }
      if (filterKompleksitas) {
        const jk = hitungKompleksitas(p)
        if (!(jk[filterKompleksitas] ?? 0)) return false
      }
      return true
    })
  }, [list, q, filterStatus, filterTp, filterTipe, filterKompleksitas])

  type Grup = { kunci: string; label: string; item: PaketSoal[] }

  const grupList: Grup[] = useMemo(() => {
    if (grupMode === 'tidak') {
      return [{ kunci: 'semua', label: '', item: tersaring }]
    }
    const map = new Map<string, Grup>()
    const pastikan = (kunci: string, label: string) => {
      let g = map.get(kunci)
      if (!g) {
        g = { kunci, label, item: [] }
        map.set(kunci, g)
      }
      return g
    }

    for (const p of tersaring) {
      if (grupMode === 'tp') {
        const kunci = p.tpId || '__tanpa__'
        const label = p.tpId
          ? `TP ${p.tpNomor ? `${p.tpNomor}. ` : ''}${p.tpNama || p.tpId}`
          : 'Tanpa Tujuan Pembelajaran'
        pastikan(kunci, label).item.push(p)
      } else if (grupMode === 'tipe') {
        const jt = hitungTipe(p)
        const tipeAda = URUTAN_TIPE.filter((t) => (jt[t] ?? 0) > 0)
        if (tipeAda.length === 0) {
          pastikan('__kosong__', 'Belum ada soal').item.push(p)
        } else {
          for (const t of tipeAda) {
            pastikan(t, NAMA_TIPE[t]).item.push(p)
          }
        }
      } else if (grupMode === 'kompleksitas') {
        const jk = hitungKompleksitas(p)
        const ada = URUTAN_KOMPLEKSITAS.filter((k) => (jk[k] ?? 0) > 0)
        if (ada.length === 0) {
          pastikan('L1', NAMA_KOMPLEKSITAS.L1).item.push(p)
        } else {
          for (const k of ada) {
            pastikan(k, NAMA_KOMPLEKSITAS[k]).item.push(p)
          }
        }
      }
    }

    const urutan =
      grupMode === 'tipe'
        ? [...URUTAN_TIPE, '__kosong__']
        : grupMode === 'kompleksitas'
          ? [...URUTAN_KOMPLEKSITAS]
          : null

    const listG = [...map.values()]
    if (urutan) {
      listG.sort((a, b) => {
        const ia = urutan.indexOf(a.kunci as never)
        const ib = urutan.indexOf(b.kunci as never)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })
    } else {
      listG.sort((a, b) => a.label.localeCompare(b.label, 'id'))
    }
    return listG
  }, [tersaring, grupMode])

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

  function renderKartu(p: PaketSoal) {
    const jt = hitungTipe(p)
    const jk = hitungKompleksitas(p)
    return (
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
            {p.tpNama && (
              <span className="paket-tp" title={p.tpNama}>
                TP {p.tpNomor ? `${p.tpNomor}. ` : ''}{p.tpNama}
              </span>
            )}
            <span>Diubah {formatTanggal(p.updatedAt)}</span>
          </div>
          <div className="paket-chips" aria-label="Bentuk dan kompleksitas soal">
            {URUTAN_TIPE.filter((t) => (jt[t] ?? 0) > 0).map((t) => (
              <span key={t} className="paket-chip paket-chip--tipe" title={NAMA_TIPE[t]}>
                {t.toUpperCase()} {jt[t]}
              </span>
            ))}
            {URUTAN_KOMPLEKSITAS.filter((k) => (jk[k] ?? 0) > 0).map((k) => (
              <span key={k} className={`paket-chip paket-chip--${k.toLowerCase()}`} title={NAMA_KOMPLEKSITAS[k]}>
                {k} · {jk[k]}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link to={`/kelas/${encodeURIComponent(ruangId)}/soal/${p.id}`} className="lms-btn-secondary">Buka</Link>
          <button type="button" className="materi-btn-danger" disabled={busy} onClick={() => void hapus(p)}>
            Hapus
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="lms-search min-w-0 flex-1" style={{ maxWidth: '18rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Cari paket soal…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari paket soal"
          />
        </div>
        <button type="button" className="lms-btn-primary" onClick={() => setFormBuka((v) => !v)}>
          + Paket soal baru
        </button>
      </div>

      {/* Filter & grup — bantu merancang kuis dari bank */}
      <div className="paket-filter" role="search" aria-label="Filter dan kelompokkan bank soal">
        <label className="paket-filter-field">
          <span>TP / materi</span>
          <select value={filterTp} onChange={(e) => setFilterTp(e.target.value)}>
            <option value="">Semua TP</option>
            <option value="__tanpa__">Tanpa TP</option>
            {tpList.map((t) => (
              <option key={t.id} value={t.id}>TP {t.nomorTp}. {t.namaTp}</option>
            ))}
          </select>
        </label>
        <label className="paket-filter-field">
          <span>Bentuk soal</span>
          <select value={filterTipe} onChange={(e) => setFilterTipe(e.target.value as '' | TipeSoal)}>
            <option value="">Semua bentuk</option>
            {URUTAN_TIPE.map((t) => (
              <option key={t} value={t}>{NAMA_TIPE[t]}</option>
            ))}
          </select>
        </label>
        <label className="paket-filter-field">
          <span>Kompleksitas</span>
          <select
            value={filterKompleksitas}
            onChange={(e) => setFilterKompleksitas(e.target.value as '' | KompleksitasSoal)}
          >
            <option value="">Semua level</option>
            {URUTAN_KOMPLEKSITAS.map((k) => (
              <option key={k} value={k}>{NAMA_KOMPLEKSITAS[k]}</option>
            ))}
          </select>
        </label>
        <label className="paket-filter-field">
          <span>Status</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as '' | 'draf' | 'siap')}>
            <option value="">Semua status</option>
            <option value="draf">Draf</option>
            <option value="siap">Siap</option>
          </select>
        </label>
        <label className="paket-filter-field">
          <span>Kelompokkan</span>
          <select value={grupMode} onChange={(e) => setGrupMode(e.target.value as GrupMode)}>
            <option value="tidak">Tidak dikelompokkan</option>
            <option value="tp">Menurut TP / materi</option>
            <option value="tipe">Menurut bentuk soal</option>
            <option value="kompleksitas">Menurut kompleksitas</option>
          </select>
        </label>
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
              <input
                required
                value={judul}
                maxLength={200}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Latihan pecahan senilai"
              />
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
      {list !== null && list.length > 0 && tersaring.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Tidak ada paket yang cocok</p>
          <p className="mt-1">Ubah filter atau kata kunci pencarian.</p>
        </div>
      )}

      {grupList.map((g) => (
        <div key={g.kunci} className="paket-grup">
          {g.label && (
            <h3 className="paket-grup-judul">
              {g.label}
              <span className="paket-grup-jumlah">{g.item.length} paket</span>
            </h3>
          )}
          <ul className="paket-list">
            {g.item.map((p) => renderKartu(p))}
          </ul>
        </div>
      ))}
    </div>
  )
}

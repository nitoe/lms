import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import RuangCard from '../components/RuangCard'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'

export default function KelasList() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))
  const [catatan, setCatatan] = useState('')
  const [q, setQ] = useState('')
  const [filterKelas, setFilterKelas] = useState('')

  useEffect(() => {
    const dasar = daftarRuangKelas(profil)
    setRuang(dasar)

    const waliKosong = kelasWaliTanpaMapel(profil)
    if (!waliKosong.length) {
      setCatatan('')
      return
    }

    let batal = false
    ;(async () => {
      try {
        const mapel = await getDaftarMapel()
        if (batal) return
        if (!mapel.length) {
          setCatatan(
            `Anda wali kelas ${waliKosong.join(', ')} tetapi belum ada penugasan mapel. ` +
              'Isi penugasan di aplikasi Penilaian, atau pastikan master mapel sudah ada.',
          )
          return
        }
        setRuang(perluasDenganMapelMaster(profil, mapel))
        setCatatan(
          `Sebagai wali ${waliKosong.join(', ')}, ditampilkan semua mata pelajaran agar Anda dapat mengelola materi per mapel.`,
        )
      } catch {
        if (!batal) {
          setCatatan(
            `Anda wali kelas ${waliKosong.join(', ')} tanpa penugasan mapel. Gagal memuat daftar mapel — coba muat ulang.`,
          )
        }
      }
    })()

    return () => {
      batal = true
    }
  }, [profil])

  const daftarKelasUnik = useMemo(() => {
    return [...new Set(ruang.map((r) => r.kelas))].sort()
  }, [ruang])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return ruang.filter((r) => {
      if (filterKelas && r.kelas !== filterKelas) return false
      if (!s) return true
      return r.mapel.toLowerCase().includes(s) || r.kelas.toLowerCase().includes(s)
    })
  }, [ruang, q, filterKelas])

  return (
    <div className="space-y-5">
      <div className="lms-page-intro">
        <p className="max-w-2xl text-sm text-muted">
          Setiap kartu adalah satu mata pelajaran di satu kelas. Materi dan Tujuan Pembelajaran
          terhubung ke mapel tersebut.
        </p>
      </div>

      {catatan && (
        <div className="rounded-xl border border-muh-100 bg-muh-50 px-4 py-3 text-sm text-muh-800">
          {catatan}
        </div>
      )}

      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="lms-count-pill">{filtered.length} ruang</span>
          {daftarKelasUnik.length > 1 && (
            <div className="lms-filter-chips">
              <button
                type="button"
                className={`lms-filter-chip ${!filterKelas ? 'lms-filter-chip--on' : ''}`}
                onClick={() => setFilterKelas('')}
              >
                Semua
              </button>
              {daftarKelasUnik.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`lms-filter-chip ${filterKelas === k ? 'lms-filter-chip--on' : ''}`}
                  onClick={() => setFilterKelas(k === filterKelas ? '' : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lms-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            type="search"
            placeholder="Cari mapel atau kelas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari ruang kelas"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="lms-empty">
          {q || filterKelas ? (
            <p>Tidak ada ruang yang cocok dengan filter saat ini.</p>
          ) : peran === 'admin' ? (
            <p>
              Akun admin belum memiliki penugasan mapel. Daftar diisi dari field{' '}
              <code className="rounded bg-surface-2 px-1 text-xs">penugasan</code> /{' '}
              <code className="rounded bg-surface-2 px-1 text-xs">waliKelas</code> di profil guru.
            </p>
          ) : (
            <p>
              Belum ada kelas atau mapel yang terhubung. Pastikan penugasan mapel sudah diisi di
              aplikasi Penilaian.
            </p>
          )}
        </div>
      ) : (
        <div className="lms-card-grid">
          {filtered.map((r) => (
            <RuangCard key={r.id} ruang={r} />
          ))}
        </div>
      )}
    </div>
  )
}

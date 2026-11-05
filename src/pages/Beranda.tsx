import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RuangCard from '../components/RuangCard'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import { NAMA_PERAN } from '../lib/peran'

export default function Beranda() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))
  const [q, setQ] = useState('')

  useEffect(() => {
    const dasar = daftarRuangKelas(profil)
    setRuang(dasar)
    if (!kelasWaliTanpaMapel(profil).length) return
    let batal = false
    ;(async () => {
      try {
        const mapel = await getDaftarMapel()
        if (!batal && mapel.length) setRuang(perluasDenganMapelMaster(profil, mapel))
      } catch {
        /* biarkan daftar dasar */
      }
    })()
    return () => {
      batal = true
    }
  }, [profil])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return ruang
    return ruang.filter(
      (r) =>
        r.mapel.toLowerCase().includes(s) ||
        r.kelas.toLowerCase().includes(s),
    )
  }, [ruang, q])

  const preview = filtered.slice(0, 8)
  const namaPanggil = profil?.nama?.split(' ')[0] || 'Bapak/Ibu'
  const jumlahKelasUnik = new Set(ruang.map((r) => r.kelas)).size

  return (
    <div className="space-y-6">
      {/* Hero ringkas */}
      <section className="lms-hero">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muh-200/90">
            Assalamu&apos;alaikum
          </p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {namaPanggil}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-white/80">
            Masuk sebagai <strong className="text-white">{peran ? NAMA_PERAN[peran] : '—'}</strong>.
            Kelola materi dan tugas dari ruang kelas Anda.
          </p>
        </div>
        <div className="lms-hero-stats">
          <div className="lms-hero-stat">
            <div className="text-2xl font-bold tabular text-white">{ruang.length}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Ruang
            </div>
          </div>
          <div className="lms-hero-stat">
            <div className="text-2xl font-bold tabular text-white">{jumlahKelasUnik}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Kelas
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar daftar */}
      <section className="space-y-3">
        <div className="lms-toolbar">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Ruang kelas Anda</h3>
            <span className="lms-count-pill">{filtered.length} konten</span>
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
          {ruang.length > 8 && (
            <Link to="/kelas" className="text-xs font-semibold text-muh-600 hover:underline">
              Lihat semua →
            </Link>
          )}
        </div>

        {preview.length === 0 ? (
          <div className="lms-empty">
            {q ? (
              <p>Tidak ada ruang yang cocok dengan &ldquo;{q}&rdquo;.</p>
            ) : (
              <>
                <p>
                  Belum ada kelas/mapel yang terhubung. Pastikan penugasan mapel sudah diisi di
                  aplikasi Penilaian.
                </p>
                <Link to="/kelas" className="lms-btn-primary mt-3 inline-flex">
                  Buka daftar kelas
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="lms-card-grid">
            {preview.map((r) => (
              <RuangCard key={r.id} ruang={r} />
            ))}
          </div>
        )}
      </section>

      {/* Modul berikutnya — kartu status, bukan placeholder mati */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Modul pembelajaran</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/kelas" className="lms-module-tile">
            <span className="lms-module-icon bg-sky-50 text-sky-700" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Materi</div>
              <p className="mt-0.5 text-xs text-muted">PDF, video, tautan · terhubung TP</p>
            </div>
            <span className="lms-module-status lms-module-status--on">Aktif</span>
          </Link>
          <div className="lms-module-tile lms-module-tile--muted">
            <span className="lms-module-icon bg-amber-50 text-amber-700" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Tugas</div>
              <p className="mt-0.5 text-xs text-muted">Buat, kumpul, nilai, komentar</p>
            </div>
            <span className="lms-module-status">Segera</span>
          </div>
          <div className="lms-module-tile lms-module-tile--muted">
            <span className="lms-module-icon bg-violet-50 text-violet-700" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Kuis</div>
              <p className="mt-0.5 text-xs text-muted">Pilihan ganda, timer, capaian TP</p>
            </div>
            <span className="lms-module-status">Fase 2</span>
          </div>
        </div>
      </section>
    </div>
  )
}

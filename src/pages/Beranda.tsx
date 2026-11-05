import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import { NAMA_PERAN } from '../lib/peran'

/** Palet lembut per mapel — konsisten visual, tidak berlebihan. */
const AKSEEN = [
  { bar: '#313083', chip: 'bg-muh-50 text-muh-700', soft: 'bg-[#eff0fa]' },
  { bar: '#0369a1', chip: 'bg-sky-50 text-sky-800', soft: 'bg-sky-50' },
  { bar: '#0f766e', chip: 'bg-teal-50 text-teal-800', soft: 'bg-teal-50' },
  { bar: '#a16207', chip: 'bg-amber-50 text-amber-900', soft: 'bg-amber-50' },
  { bar: '#9f1239', chip: 'bg-rose-50 text-rose-800', soft: 'bg-rose-50' },
  { bar: '#6d28d9', chip: 'bg-violet-50 text-violet-800', soft: 'bg-violet-50' },
  { bar: '#c2410c', chip: 'bg-orange-50 text-orange-900', soft: 'bg-orange-50' },
  { bar: '#15803d', chip: 'bg-green-50 text-green-800', soft: 'bg-green-50' },
]

function aksenMapel(nama: string) {
  let h = 0
  for (let i = 0; i < nama.length; i++) h = (h * 31 + nama.charCodeAt(i)) >>> 0
  return AKSEEN[h % AKSEEN.length]
}

function inisialMapel(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Beranda() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))

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

  const preview = ruang.slice(0, 8)
  const namaPanggil = profil?.nama?.split(' ')[0] || 'Bapak/Ibu'

  return (
    <div className="space-y-7">
      {/* Banner sapaan */}
      <section className="guru-welcome">
        <div className="guru-welcome-inner">
          <p className="text-xs font-semibold uppercase tracking-wider text-muh-200/90">
            LMS · SD Muhammadiyah 01 Kukusan
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Assalamu&apos;alaikum, {namaPanggil}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Anda masuk sebagai <strong className="text-white">{peran ? NAMA_PERAN[peran] : '—'}</strong>.
            Kelola materi dan tugas dari ruang kelas di bawah.
          </p>
        </div>
        <div className="guru-welcome-stat">
          <div className="text-2xl font-bold tabular text-white">{ruang.length}</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-white/75">
            Ruang kelas
          </div>
        </div>
      </section>

      {/* Ruang kelas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muh-900">Ruang kelas Anda</h2>
          {ruang.length > 0 && (
            <Link
              to="/kelas"
              className="text-xs font-semibold text-muh-600 hover:text-muh-800 hover:underline"
            >
              Lihat semua ({ruang.length}) →
            </Link>
          )}
        </div>

        {preview.length === 0 ? (
          <div className="card-soft flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted">
              Belum ada kelas/mapel yang terhubung. Pastikan penugasan mapel sudah diisi di aplikasi
              Penilaian (menu admin / kelola akun).
            </div>
            <Link
              to="/kelas"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-muh-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-muh-700"
            >
              Buka daftar kelas
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {preview.map((r) => {
              const a = aksenMapel(r.mapel)
              return (
                <Link
                  key={r.id}
                  to={`/kelas/${encodeURIComponent(r.id)}`}
                  className="ruang-card group"
                  style={{ ['--ruang-bar' as string]: a.bar }}
                >
                  <div className="ruang-card-bar" aria-hidden />
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className={`ruang-card-icon ${a.soft}`}
                      style={{ color: a.bar }}
                      aria-hidden
                    >
                      {inisialMapel(r.mapel)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${a.chip}`}>
                          Kelas {r.kelas}
                        </span>
                        {r.sebagaiWali && (
                          <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Wali
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-muh-800">
                        {r.mapel}
                      </div>
                      <div className="mt-2 text-xs font-medium text-muh-600 opacity-0 transition group-hover:opacity-100">
                        Buka ruang kelas →
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Pintasan fitur */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muh-900">Pintasan pembelajaran</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/kelas" className="fitur-tile fitur-tile--aktif">
            <span className="fitur-tile-icon bg-sky-50 text-sky-700" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Materi pembelajaran</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Unggah PDF, gambar, video, atau tautan — hubungkan ke Tujuan Pembelajaran.
              </p>
            </div>
          </Link>
          <div className="fitur-tile fitur-tile--segera">
            <span className="fitur-tile-icon bg-amber-50 text-amber-700" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Tugas</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Segera
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Buat tugas, pantau pengumpulan, beri nilai dan komentar.
              </p>
            </div>
          </div>
          <div className="fitur-tile fitur-tile--segera">
            <span className="fitur-tile-icon bg-violet-50 text-violet-700" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Kuis & asesmen</span>
                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                  Fase 2
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Pilihan ganda, isian, timer, dan capaian per TP.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

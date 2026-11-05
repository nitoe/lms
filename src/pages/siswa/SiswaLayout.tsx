import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'

const NAV = [
  { to: '/siswa', end: true, label: 'Beranda', emoji: '🏠' },
  { to: '/siswa/materi', end: false, label: 'Materi', emoji: '📚' },
  { to: '/siswa/tugas', end: false, label: 'Tugas', emoji: '✏️' },
  { to: '/siswa/kuis', end: false, label: 'Kuis', emoji: '🎯' },
] as const

export default function SiswaLayout() {
  const { sesi, keluar } = useSiswa()
  const navigate = useNavigate()

  if (!sesi) {
    navigate('/siswa/masuk', { replace: true })
    return null
  }

  function handleKeluar() {
    keluar()
    navigate('/siswa/masuk', { replace: true })
  }

  return (
    <div className="siswa-shell min-h-full flex flex-col bg-surface-2">
      {/* Header ringkas */}
      <header className="siswa-header sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo-sdm.png"
              alt=""
              className="h-9 w-9 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-muh-800">{sesi.nama}</div>
              <div className="text-xs font-medium text-muted">Kelas {sesi.kelas}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleKeluar}
            className="siswa-btn-keluar shrink-0"
            aria-label="Keluar dari akun siswa"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Konten */}
      <main className="siswa-main flex-1 mx-auto w-full max-w-lg px-4 py-5 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation — ikon besar, target sentuh nyaman */}
      <nav
        className="siswa-bottom-nav fixed bottom-0 inset-x-0 z-20 border-t border-border bg-white/95 backdrop-blur-sm"
        aria-label="Menu utama siswa"
      >
        <div className="mx-auto flex max-w-lg justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `siswa-nav-item ${isActive ? 'siswa-nav-item--active' : ''}`
              }
            >
              <span className="siswa-nav-emoji" aria-hidden>
                {item.emoji}
              </span>
              <span className="siswa-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import SiswaIcon, { type SiswaIconName } from './SiswaIcon'

const NAV: { to: string; end: boolean; label: string; icon: SiswaIconName }[] = [
  { to: '/siswa', end: true, label: 'Beranda', icon: 'home' },
  { to: '/siswa/materi', end: false, label: 'Materi', icon: 'book' },
  { to: '/siswa/tugas', end: false, label: 'Tugas', icon: 'pencil' },
  { to: '/siswa/kuis', end: false, label: 'Kuis', icon: 'target' },
]

/**
 * Shell area siswa: header + konten full-width + navigasi.
 * HP: nav bawah fixed. Tablet/PC: nav strip di bawah header (lihat siswa.css).
 * ANTIREGRESI §54 — jangan bungkus Outlet dengan max-width sempit.
 */
export default function SiswaLayout() {
  const { sesi, keluar } = useSiswa()
  const navigate = useNavigate()

  // Jangan memanggil navigate() saat render (lihat ANTIREGRESI §12).
  if (!sesi) return <Navigate to="/siswa/masuk" replace />

  async function handleKeluar() {
    await keluar()
    navigate('/siswa/masuk', { replace: true })
  }

  return (
    <div className="sw-app">
      <header className="sw-header">
        <div className="sw-header-inner">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-sdm.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-muh-900">{sesi.nama}</div>
              <div className="truncate text-xs font-medium text-muted">
                Kelas {sesi.kelas} · SDM 01 Kukusan
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleKeluar()}
            className="sw-btn-keluar"
            aria-label="Keluar dari akun siswa"
          >
            Keluar
          </button>
        </div>
      </header>

      <nav className="sw-nav" aria-label="Menu utama siswa">
        <div className="sw-nav-inner">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sw-nav-item ${isActive ? 'sw-nav-item--active' : ''}`
              }
            >
              <SiswaIcon name={item.icon} size={22} />
              <span className="sw-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="sw-main">
        <Outlet />
      </main>
    </div>
  )
}

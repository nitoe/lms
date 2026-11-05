import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'
import { NAMA_PERAN } from '../lib/peran'

/**
 * Halaman yang memakai lebar hampir penuh (max-w-[1600px]).
 * Pola sama dengan HALAMAN_LEBAR di aplikasi Penilaian agar tidak ada
 * ruang kosong kiri-kanan saat zoom-out / layar lebar.
 */
const HALAMAN_LEBAR = ['/', '/kelas']

export default function Layout() {
  const { profil, peran } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function keluar() {
    await logout()
    navigate('/masuk', { replace: true })
  }

  const lebarPenuh = HALAMAN_LEBAR.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )

  return (
    <div className="min-h-full flex flex-col bg-surface-2">
      <header className="guru-header border-b border-border bg-white">
        <div
          className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 ${
            lebarPenuh ? 'max-w-[1600px]' : 'max-w-6xl'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-sdm.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-muh-800">LMS Sekolah</div>
              <div className="truncate text-xs text-muted">SD Muhammadiyah 01 Kukusan</div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Menu utama">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `guru-nav-link ${isActive ? 'guru-nav-link--active' : ''}`
              }
            >
              Beranda
            </NavLink>
            <NavLink
              to="/kelas"
              className={({ isActive }) =>
                `guru-nav-link ${isActive ? 'guru-nav-link--active' : ''}`
              }
            >
              Kelas
            </NavLink>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="max-w-[12rem] truncate text-sm font-medium">{profil?.nama}</div>
              <div className="text-xs text-muted">{peran ? NAMA_PERAN[peran] : '—'}</div>
            </div>
            <button
              type="button"
              onClick={() => void keluar()}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-muted transition hover:border-muh-200 hover:bg-muh-50 hover:text-muh-800"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-5 sm:py-6">
        <div className={`mx-auto w-full ${lebarPenuh ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

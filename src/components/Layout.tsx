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
      <header className="border-b border-border bg-white">
        <div
          className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 ${
            lebarPenuh ? 'max-w-[1600px]' : 'max-w-6xl'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo-sdm.png" alt="" className="h-9 w-9 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-muh-800 truncate">LMS Sekolah</div>
              <div className="text-xs text-muted truncate">SD Muhammadiyah 01 Kukusan</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-muh-50 text-muh-700' : 'text-muted hover:bg-surface-2'
                }`
              }
            >
              Beranda
            </NavLink>
            <NavLink
              to="/kelas"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-muh-50 text-muh-700' : 'text-muted hover:bg-surface-2'
                }`
              }
            >
              Kelas
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium truncate max-w-[12rem]">{profil?.nama}</div>
              <div className="text-xs text-muted">{peran ? NAMA_PERAN[peran] : '—'}</div>
            </div>
            <button
              type="button"
              onClick={() => void keluar()}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-5 sm:py-6">
        <div
          className={`mx-auto w-full ${
            lebarPenuh ? 'max-w-[1600px]' : 'max-w-6xl'
          }`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}

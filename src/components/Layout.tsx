import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'
import { NAMA_PERAN } from '../lib/peran'

export default function Layout() {
  const { profil, peran } = useAuth()
  const navigate = useNavigate()

  async function keluar() {
    await logout()
    navigate('/masuk', { replace: true })
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo-sdm.png" alt="" className="h-9 w-9 object-contain" />
            <div>
              <div className="text-sm font-semibold text-muh-800">LMS Sekolah</div>
              <div className="text-xs text-muted">SD Muhammadiyah 01 Kukusan</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-muh-50 text-muh-700' : 'text-muted hover:bg-surface-2'}`
              }
            >
              Beranda
            </NavLink>
            <NavLink
              to="/kelas"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-muh-50 text-muh-700' : 'text-muted hover:bg-surface-2'}`
              }
            >
              Kelas
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{profil?.nama}</div>
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
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

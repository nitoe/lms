import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'
import { NAMA_PERAN } from '../lib/peran'

type NavItem = {
  to: string
  end?: boolean
  label: string
  icon: 'home' | 'class' | 'task' | 'quiz'
  soon?: boolean
}

const NAV_UTAMA: NavItem[] = [
  { to: '/', end: true, label: 'Beranda', icon: 'home' },
  { to: '/kelas', label: 'Ruang Kelas', icon: 'class' },
  { to: '/kelas', label: 'Tugas', icon: 'task', soon: true },
  { to: '/kelas', label: 'Kuis', icon: 'quiz', soon: true },
]

function Icon({ name }: { name: NavItem['icon'] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'class':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    case 'task':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      )
    case 'quiz':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
  }
}

export default function Layout() {
  const { profil, peran } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function keluar() {
    await logout()
    navigate('/masuk', { replace: true })
  }

  const judulHalaman =
    pathname.startsWith('/kelas/') ? 'Detail ruang kelas'
    : pathname.startsWith('/kelas') ? 'Ruang Kelas'
    : 'Beranda'

  return (
    <div className="lms-app">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <button
          type="button"
          className="lms-sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`lms-sidebar ${sidebarOpen ? 'lms-sidebar--open' : ''}`}>
        <div className="lms-sidebar-brand">
          <img src="/logo-sdm.png" alt="" className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-muh-900">LMS Sekolah</div>
            <div className="truncate text-[11px] text-muted">SDM 01 Kukusan</div>
          </div>
        </div>

        <nav className="lms-sidebar-nav" aria-label="Menu utama">
          <p className="lms-sidebar-section">Menu</p>
          {NAV_UTAMA.map((item) =>
            item.soon ? (
              <div key={item.label} className="lms-side-link lms-side-link--soon" title="Segera hadir">
                <span className="lms-side-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="flex-1">{item.label}</span>
                <span className="lms-soon-pill">Segera</span>
              </div>
            ) : (
              <NavLink
                key={item.label + item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `lms-side-link ${isActive ? 'lms-side-link--active' : ''}`
                }
              >
                <span className="lms-side-icon">
                  <Icon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="lms-sidebar-footer">
          <div className="lms-sidebar-user">
            <div className="lms-avatar" aria-hidden>
              {(profil?.nama || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{profil?.nama}</div>
              <div className="truncate text-[11px] text-muted">
                {peran ? NAMA_PERAN[peran] : '—'}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => void keluar()} className="lms-btn-ghost w-full">
            Keluar
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="lms-main">
        <header className="lms-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="lms-icon-btn lg:hidden"
              aria-label="Buka menu"
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                {judulHalaman}
              </h1>
              <p className="hidden truncate text-xs text-muted sm:block">
                SD Muhammadiyah 01 Kukusan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/kelas" className="lms-btn-secondary hidden sm:inline-flex">
              Semua kelas
            </NavLink>
            <NavLink to="/kelas" className="lms-btn-primary">
              + Ruang kelas
            </NavLink>
          </div>
        </header>

        <div className="lms-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

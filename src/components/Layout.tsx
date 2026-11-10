import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'
import { NAMA_PERAN } from '../lib/peran'
import { bolehAksesTkaStaf } from '../lib/tkaAkses'

type NavItem = {
  to: string
  end?: boolean
  label: string
  icon: 'home' | 'class' | 'task' | 'quiz' | 'table' | 'tka'
  soon?: boolean
}

const NAV_UTAMA: NavItem[] = [
  { to: '/', end: true, label: 'Beranda', icon: 'home' },
  { to: '/kelas', label: 'Ruang Kelas', icon: 'class' },
  { to: '/tugas', label: 'Tugas', icon: 'task' },
  { to: '/rekap-nilai', label: 'Rekap Nilai', icon: 'table' },
]

/** Menu TKA hanya tampil untuk admin TKA dan wali kelas 6 (ANTIREGRESI §76). */
const NAV_TKA: NavItem = { to: '/tka', label: 'TKA', icon: 'tka' }

const LS_SIDEBAR = 'lms-sidebar-collapsed'

function bacaCollapsedAwal(pathname: string): boolean {
  try {
    const v = localStorage.getItem(LS_SIDEBAR)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    /* ignore */
  }
  // Default: ciut di editor soal agar ruang kerja maksimal
  return pathname.includes('/soal/')
}

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
    case 'table':
      return (
        <svg {...common}>
          <path d="M3 5h18" />
          <path d="M3 12h18" />
          <path d="M3 19h18" />
          <path d="M9 5v14" />
        </svg>
      )
    case 'tka':
      return (
        <svg {...common}>
          <path d="M22 10 12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c3 2.5 9 2.5 12 0v-5" />
          <line x1="22" y1="10" x2="22" y2="16" />
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
  const { user, profil, peran } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  /** Drawer mobile */
  const [sidebarOpen, setSidebarOpen] = useState(false)
  /** Desktop: hanya ikon */
  const [collapsed, setCollapsed] = useState(() => bacaCollapsedAwal(pathname))

  useEffect(() => {
    try {
      localStorage.setItem(LS_SIDEBAR, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  async function keluar() {
    await logout()
    navigate('/masuk', { replace: true })
  }

  const navItems = bolehAksesTkaStaf(user, profil) ? [...NAV_UTAMA, NAV_TKA] : NAV_UTAMA

  const judulHalaman =
    pathname.includes('/soal/') ? 'Editor soal'
    : pathname.startsWith('/kelas/') ? 'Detail ruang kelas'
    : pathname.startsWith('/kelas') ? 'Ruang Kelas'
    : pathname.startsWith('/tugas/') ? 'Detail tugas'
    : pathname.startsWith('/tugas') ? 'Tugas'
    : pathname.startsWith('/rekap-nilai') ? 'Rekap Nilai'
    : pathname.startsWith('/tka') ? 'TKA — Tes Kemampuan Akademik'
    : 'Beranda'

  return (
    <div className={`lms-app ${collapsed ? 'lms-app--nav-ciut' : ''}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="lms-sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          'lms-sidebar',
          sidebarOpen ? 'lms-sidebar--open' : '',
          collapsed ? 'lms-sidebar--ciut' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Navigasi utama"
      >
        <div className="lms-sidebar-brand">
          <img src="/logo-sdm.png" alt="" className="lms-sidebar-logo" />
          <div className="lms-sidebar-brand-teks min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-muh-900">LMS Sekolah</div>
            <div className="truncate text-[11px] text-muted">SDM 01 Kukusan</div>
          </div>
          <button
            type="button"
            className="lms-sidebar-toggle"
            aria-label={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
            aria-pressed={collapsed}
            title={collapsed ? 'Perluas menu' : 'Ciutkan menu (ikon saja)'}
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {collapsed ? (
                <>
                  <polyline points="9 18 15 12 9 6" />
                </>
              ) : (
                <>
                  <polyline points="15 18 9 12 15 6" />
                </>
              )}
            </svg>
          </button>
        </div>

        <nav className="lms-sidebar-nav">
          <div className="lms-sidebar-section">Menu</div>
          {navItems.map((item) =>
            item.soon ? (
              <div
                key={item.label + item.to}
                className="lms-side-link lms-side-link--soon"
                title={`${item.label} (segera)`}
              >
                <span className="lms-side-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="lms-side-label">{item.label}</span>
                <span className="lms-soon-pill">Soon</span>
              </div>
            ) : (
              <NavLink
                key={item.label + item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `lms-side-link ${isActive ? 'lms-side-link--active' : ''}`
                }
              >
                <span className="lms-side-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="lms-side-label">{item.label}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="lms-sidebar-footer">
          <div className="lms-sidebar-user" title={profil?.nama || undefined}>
            <div className="lms-avatar" aria-hidden>
              {(profil?.nama || '?').charAt(0).toUpperCase()}
            </div>
            <div className="lms-sidebar-user-teks min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{profil?.nama}</div>
              <div className="truncate text-[11px] text-muted">
                {peran ? NAMA_PERAN[peran] : '—'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void keluar()}
            className="lms-btn-ghost w-full lms-sidebar-keluar"
            title="Keluar"
          >
            <span className="lms-sidebar-keluar-teks">Keluar</span>
            <span className="lms-sidebar-keluar-ikon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
          </button>
        </div>
      </aside>

      <div className="lms-main">
        <header className="lms-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="lms-icon-btn lg:hidden"
              aria-label="Buka menu navigasi"
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              className="lms-icon-btn hidden lg:inline-flex"
              aria-label={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
              title={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
              onClick={() => setCollapsed((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
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
          {/* Aksi kanan topbar dihapus: "Semua kelas" dan "+ Ruang kelas" hanya
              mengarah ke /kelas dan menyesatkan (ruang kelas dari penugasan Penilaian).
              Navigasi ruang kelas tetap lewat sidebar / menu Ruang Kelas. */}
          <div className="flex items-center gap-2" aria-hidden="true" />
        </header>

        <div className="lms-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

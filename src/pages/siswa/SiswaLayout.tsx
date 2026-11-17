import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { bolehTkaSiswa } from '../../lib/tkaAkses'
import SiswaIcon, { type SiswaIconName } from './SiswaIcon'
import { useLombaSiswa } from './useLombaSiswa'

const NAV: { to: string; end: boolean; label: string; icon: SiswaIconName }[] = [
  { to: '/siswa', end: true, label: 'Beranda', icon: 'home' },
  { to: '/siswa/materi', end: false, label: 'Materi', icon: 'book' },
  { to: '/siswa/tugas', end: false, label: 'Tugas', icon: 'pencil' },
  { to: '/siswa/kuis', end: false, label: 'Kuis', icon: 'target' },
]

/** Menu TKA hanya untuk siswa kelas 6 (ANTIREGRESI §76). */
const NAV_TKA = { to: '/siswa/tka', end: false, label: 'TKA', icon: 'tka' as SiswaIconName }

/** Menu Lomba hanya jika siswa terdaftar di ≥1 lomba (ANTIREGRESI §Lomba.1). */
const NAV_LOMBA = { to: '/siswa/lomba', end: false, label: 'Lomba', icon: 'lomba' as SiswaIconName }

/**
 * Shell area siswa: header + konten full-width + navigasi.
 * HP: nav bawah fixed. Tablet/PC: nav strip di bawah header (lihat siswa.css).
 * ANTIREGRESI §54 — jangan bungkus Outlet dengan max-width sempit.
 */
export default function SiswaLayout() {
  const { sesi, keluar } = useSiswa()
  const navigate = useNavigate()
  const { list: daftarLomba } = useLombaSiswa()
  const punyaLomba = daftarLomba.length > 0

  // Jangan memanggil navigate() saat render (lihat ANTIREGRESI §12).
  if (!sesi) return <Navigate to="/siswa/masuk" replace />

  async function handleKeluar() {
    const ok = window.confirm(
      'Keluar dari akun siswa?\n\nJika sedang mengerjakan kuis/TKA, pastikan jawaban sudah dikirim. Progress draf tersimpan di perangkat ini.',
    )
    if (!ok) return
    await keluar()
    navigate('/siswa/masuk', { replace: true })
  }

  let navItems = [...NAV]
  if (bolehTkaSiswa(sesi.kelas)) navItems = [...navItems, NAV_TKA]
  if (punyaLomba) navItems = [...navItems, NAV_LOMBA]

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
          {navItems.map((item) => (
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

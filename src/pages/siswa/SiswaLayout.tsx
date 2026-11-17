import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { bolehTkaSiswa } from '../../lib/tkaAkses'
import SiswaIcon, { type SiswaIconName } from './SiswaIcon'
import { useLombaSiswa } from './useLombaSiswa'

/** Kunci warna menu → kelas `sw-tone-*` di siswa.css (dipakai juga kartu menu Beranda). */
export type SiswaTone = 'indigo' | 'sky' | 'amber' | 'violet' | 'rose' | 'orange' | 'emerald'

type NavItem = { to: string; end: boolean; label: string; icon: SiswaIconName; tone: SiswaTone }

const NAV: NavItem[] = [
  { to: '/siswa', end: true, label: 'Beranda', icon: 'home', tone: 'indigo' },
  { to: '/siswa/materi', end: false, label: 'Materi', icon: 'book', tone: 'sky' },
  { to: '/siswa/tugas', end: false, label: 'Tugas', icon: 'pencil', tone: 'amber' },
  { to: '/siswa/kuis', end: false, label: 'Kuis', icon: 'target', tone: 'violet' },
]

/** Menu TKA hanya untuk siswa kelas 6 (ANTIREGRESI §76). */
const NAV_TKA: NavItem = { to: '/siswa/tka', end: false, label: 'TKA', icon: 'tka', tone: 'rose' }

/** Menu Lomba hanya jika siswa terdaftar di ≥1 lomba (ANTIREGRESI §Lomba.1). */
const NAV_LOMBA: NavItem = {
  to: '/siswa/lomba',
  end: false,
  label: 'Lomba',
  icon: 'lomba',
  tone: 'orange',
}

/**
 * Shell area siswa.
 * - PC/tablet landscape (≥1024px): sidebar kiri (`.sw-nav`) + kolom isi (`.sw-body`).
 * - HP/tablet portrait: header ringkas + nav melayang di bawah (`.sw-nav`).
 *
 * KONTRAK dengan halaman lain (ANTIREGRESI §131): SiswaKuis, SiswaTka, SiswaLombaDetail
 * mencari `.sw-nav` dan `.sw-main` lewat document.querySelector untuk menyembunyikan nav
 * saat mengerjakan. Jangan ganti nama class, dan `.sw-nav` harus satu elemen utuh.
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

  const inisial = (sesi.nama || 'S').trim().charAt(0).toUpperCase()

  return (
    <div className="sw-app">
      <nav className="sw-nav" aria-label="Menu utama siswa">
        <div className="sw-nav-brand">
          <img src="/logo-sdm.png" alt="" className="sw-nav-logo" />
          <div className="min-w-0">
            <div className="sw-nav-brand-title">Ruang Belajar</div>
            <div className="sw-nav-brand-sub">SD Muhammadiyah 01 Kukusan</div>
          </div>
        </div>
        <div className="sw-nav-inner">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sw-nav-item sw-tone-${item.tone} ${isActive ? 'sw-nav-item--active' : ''}`
              }
            >
              <span className="sw-nav-icon">
                <SiswaIcon name={item.icon} size={22} />
              </span>
              <span className="sw-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="sw-body">
        <header className="sw-header">
          <div className="sw-header-inner">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/logo-sdm.png" alt="" className="sw-header-logo" />
              <span className="sw-avatar" aria-hidden>
                {inisial}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-muh-900">{sesi.nama}</div>
                <div className="truncate text-xs font-semibold text-muted">
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
              <SiswaIcon name="logout" size={18} />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <main className="sw-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

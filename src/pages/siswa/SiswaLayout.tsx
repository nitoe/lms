import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'

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
    <div className="min-h-full flex flex-col bg-surface-2">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-sdm.png" alt="" className="h-8 w-8 object-contain" />
            <div>
              <div className="text-sm font-semibold text-muh-800">{sesi.nama}</div>
              <div className="text-xs text-muted">Kelas {sesi.kelas}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleKeluar}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted"
          >
            Keluar
          </button>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-5">
        <Outlet />
      </main>
      <nav className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-lg justify-around py-2">
          <NavLink to="/siswa" end className={({ isActive }) => `text-xs font-medium px-3 py-1 ${isActive ? 'text-muh-600' : 'text-muted'}`}>
            Beranda
          </NavLink>
          <NavLink to="/siswa/kelas" className={({ isActive }) => `text-xs font-medium px-3 py-1 ${isActive ? 'text-muh-600' : 'text-muted'}`}>
            Kelas
          </NavLink>
        </div>
      </nav>
    </div>
  )
}

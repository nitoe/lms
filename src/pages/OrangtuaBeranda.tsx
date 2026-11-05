import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/auth'

export default function OrangtuaBeranda() {
  const { profil } = useAuth()
  const navigate = useNavigate()

  async function keluar() {
    await logout()
    navigate('/orangtua/masuk', { replace: true })
  }

  return (
    <div className="min-h-full bg-surface-2">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-sdm.png" alt="" className="h-8 w-8" />
            <div>
              <div className="text-sm font-semibold text-muh-800">Portal Orang Tua · LMS</div>
              <div className="text-xs text-muted">{profil?.nama}</div>
            </div>
          </div>
          <button type="button" onClick={() => void keluar()} className="text-xs font-medium text-muted border border-border rounded-md px-2.5 py-1">
            Keluar
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-muh-900">Perkembangan anak</h1>
        <p className="text-sm text-muted">
          Dashboard orang tua akan menampilkan nilai, tugas, dan kehadiran anak.
          Fitur penuh menyusul di fase berikutnya.
        </p>
        <div className="card-soft p-5 text-sm text-muted">
          Saat ini belum ada data yang ditampilkan. Pastikan akun sudah disetujui admin dan anak terhubung (anakIds).
        </div>
      </main>
    </div>
  )
}

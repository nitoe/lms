import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NAMA_PERAN } from '../lib/peran'

export default function Beranda() {
  const { profil, peran } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-muh-900">
          Assalamu&apos;alaikum, {profil?.nama?.split(' ')[0] || 'Bapak/Ibu'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Anda masuk sebagai <strong>{peran ? NAMA_PERAN[peran] : '—'}</strong>. Ini adalah dashboard Fase 0.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/kelas" className="card-soft block p-5 hover:border-muh-300 transition-colors">
          <div className="text-sm font-semibold text-muh-800">Ruang kelas</div>
          <p className="mt-1 text-xs text-muted">
            Kelas & mapel yang diampu. Materi dan tugas akan muncul di sini (Fase 1).
          </p>
        </Link>
        <div className="card-soft p-5 opacity-70">
          <div className="text-sm font-semibold text-muh-800">Materi pembelajaran</div>
          <p className="mt-1 text-xs text-muted">Segera — unggah PDF, gambar, video, tautan YouTube.</p>
        </div>
        <div className="card-soft p-5 opacity-70">
          <div className="text-sm font-semibold text-muh-800">Tugas</div>
          <p className="mt-1 text-xs text-muted">Segera — buat, kumpul, nilai, dan komentar.</p>
        </div>
      </div>

      <div className="card-soft p-4 text-sm text-muted">
        <strong className="text-muh-800">Fase 0 selesai.</strong> Fondasi auth, peran, dan shell siap.
        Langkah berikutnya: ruang kelas digital + materi + tugas (Fase 1).
      </div>
    </div>
  )
}

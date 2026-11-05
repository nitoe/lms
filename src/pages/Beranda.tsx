import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas } from '../lib/kelasLms'
import { NAMA_PERAN } from '../lib/peran'

export default function Beranda() {
  const { profil, peran } = useAuth()
  const ruang = daftarRuangKelas(profil)
  const preview = ruang.slice(0, 4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-muh-900 tracking-tight">
          Assalamu&apos;alaikum, {profil?.nama?.split(' ')[0] || 'Bapak/Ibu'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Anda masuk sebagai <strong>{peran ? NAMA_PERAN[peran] : '—'}</strong>.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muh-800">Ruang kelas Anda</h2>
          {ruang.length > 0 && (
            <Link to="/kelas" className="text-xs font-medium text-muh-600 hover:underline">
              Lihat semua ({ruang.length})
            </Link>
          )}
        </div>

        {preview.length === 0 ? (
          <div className="card-soft p-5 text-sm text-muted">
            Belum ada kelas/mapel yang terhubung. Pastikan penugasan sudah diisi di aplikasi Penilaian.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {preview.map((r) => (
              <Link
                key={r.id}
                to={`/kelas/${encodeURIComponent(r.id)}`}
                className="card-soft group flex flex-col gap-1.5 p-4 transition hover:border-muh-300"
              >
                <span className="text-xs font-semibold text-muh-700">Kelas {r.kelas}</span>
                <span className="text-sm font-semibold text-slate-900 group-hover:text-muh-800">
                  {r.mapel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card-soft p-4 opacity-70">
          <div className="text-sm font-semibold text-muh-800">Materi pembelajaran</div>
          <p className="mt-1 text-xs text-muted">Segera — unggah PDF, gambar, video, tautan.</p>
        </div>
        <div className="card-soft p-4 opacity-70">
          <div className="text-sm font-semibold text-muh-800">Tugas</div>
          <p className="mt-1 text-xs text-muted">Segera — buat, kumpul, nilai, dan komentar.</p>
        </div>
        <div className="card-soft p-4 opacity-70">
          <div className="text-sm font-semibold text-muh-800">Kuis & asesmen</div>
          <p className="mt-1 text-xs text-muted">Fase 2 — pilihan ganda, isian, timer.</p>
        </div>
      </div>
    </div>
  )
}

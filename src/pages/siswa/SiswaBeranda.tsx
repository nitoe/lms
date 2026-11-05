import { useSiswa } from '../../context/SiswaContext'

export default function SiswaBeranda() {
  const { sesi } = useSiswa()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-muh-900">Halo, {sesi?.nama?.split(' ')[0]}!</h1>
        <p className="text-sm text-muted">Selamat datang di ruang belajar digitalmu.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card-soft flex flex-col items-center gap-2 p-4 text-center">
          <span className="text-2xl" aria-hidden>📚</span>
          <span className="text-sm font-semibold text-muh-800">Materi</span>
          <span className="text-xs text-muted">Segera</span>
        </div>
        <div className="card-soft flex flex-col items-center gap-2 p-4 text-center">
          <span className="text-2xl" aria-hidden>✏️</span>
          <span className="text-sm font-semibold text-muh-800">Tugas</span>
          <span className="text-xs text-muted">Segera</span>
        </div>
        <div className="card-soft flex flex-col items-center gap-2 p-4 text-center">
          <span className="text-2xl" aria-hidden>🎮</span>
          <span className="text-sm font-semibold text-muh-800">Kuis</span>
          <span className="text-xs text-muted">Segera</span>
        </div>
        <div className="card-soft flex flex-col items-center gap-2 p-4 text-center">
          <span className="text-2xl" aria-hidden>🏆</span>
          <span className="text-sm font-semibold text-muh-800">Pencapaian</span>
          <span className="text-xs text-muted">Segera</span>
        </div>
      </div>
      <p className="text-center text-xs text-muted">
        Fase 0 — tampilan dasar. Fitur lengkap menyusul di Fase 1.
      </p>
    </div>
  )
}

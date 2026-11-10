import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { aksenMapel, inisialMapel } from '../../lib/uiAksen'
import { EMAIL_AKSES_KHUSUS_TKA, MAPEL_TKA, kelasTkaDikelola, ruangTka } from '../../lib/tkaAkses'

/**
 * Pusat menu TKA untuk guru. Tiap kartu = ruang kelas khusus (kelas 6 × mapel TKA) yang membuka
 * halaman ruang LMS biasa (Bank Soal + Kuis). Penegak akses: firestore.rules (ruangTka).
 */
export default function TkaBeranda() {
  const { user, profil } = useAuth()
  const kelasList = kelasTkaDikelola(user, profil)
  const akunUji = (user?.email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA

  return (
    <div className="space-y-6">
      <section className="lms-hero">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muh-200/90">Kelas 6</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            TKA — Tes Kemampuan Akademik
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Kelola bank soal dan kuis TKA. Siswa kelas 6 mengerjakannya dari menu <strong className="text-white">TKA</strong> di
            dashboard mereka.
            {akunUji && ' Akun ini memiliki akses uji ke semua kelas 6.'}
          </p>
        </div>
      </section>

      {kelasList.map((kelas) => (
        <section key={kelas} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Kelas {kelas}</h3>
          <div className="lms-card-grid">
            {MAPEL_TKA.map((mapel) => {
              const r = ruangTka(kelas, mapel)
              const a = aksenMapel(mapel)
              return (
                <Link
                  key={r.id}
                  to={`/kelas/${encodeURIComponent(r.id)}?tab=soal`}
                  className="lms-card"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="lms-card-body flex items-center gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold"
                      style={{ background: a.cover, color: a.coverFg }}
                      aria-hidden
                    >
                      {inisialMapel(mapel)}
                    </div>
                    <div className="min-w-0">
                      <div className="lms-card-title">{mapel}</div>
                      <p className="text-sm text-muted">Bank soal · Kuis · Hasil</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

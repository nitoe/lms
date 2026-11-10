import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { aksenMapel, inisialMapel } from '../../lib/uiAksen'
import { EMAIL_AKSES_KHUSUS_TKA, MAPEL_TKA, bolehAksesTkaStaf, ruangTka } from '../../lib/tkaAkses'

/**
 * Pusat menu TKA untuk guru. Satu kartu per mapel TKA (Matematika, Bahasa Indonesia, IPA).
 * Bank soal bersama untuk 6A dan 6B — tidak ada pemisahan per rombel (ANTIREGRESI §85).
 */
export default function TkaBeranda() {
  const { user, profil } = useAuth()
  const akunUji = (user?.email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA
  const boleh = bolehAksesTkaStaf(user, profil)

  if (!boleh) {
    return (
      <div className="lms-empty">
        <p className="font-medium text-slate-700">Akses TKA terbatas</p>
        <p className="mt-1 text-sm text-slate-600">
          Menu ini hanya untuk wali kelas 6A/6B atau akun uji sistem.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="lms-hero">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muh-200/90">Kelas 6</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            TKA — Tes Kemampuan Akademik
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Kelola bank soal dan kuis TKA. Bank soal berlaku untuk seluruh kelas 6 (6A dan 6B).
            Siswa mengerjakannya dari menu <strong className="text-white">TKA</strong> di dashboard mereka.
            {akunUji && ' Akun ini memiliki akses uji sistem.'}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Mata pelajaran TKA</h3>
        <div className="lms-card-grid">
          {MAPEL_TKA.map((mapel) => {
            const r = ruangTka(mapel)
            const a = aksenMapel(mapel)
            const label = mapel.replace(/^TKA\s+/, '')
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
                    {inisialMapel(label)}
                  </div>
                  <div className="min-w-0">
                    <div className="lms-card-title">{label}</div>
                    <p className="text-sm text-muted">Bank soal · Kuis · Hasil</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

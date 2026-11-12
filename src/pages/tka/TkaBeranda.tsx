import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  EMAIL_AKSES_KHUSUS_TKA,
  LABEL_MAPEL_TKA,
  MAPEL_TKA,
  MATERI_TKA,
  bolehAksesTkaStaf,
  bolehImportRekapTka,
  ruangTka,
  type MapelTkaNama,
} from '../../lib/tkaAkses'
import '../../styles/tka.css'

const META_MAPEL: Record<
  MapelTkaNama,
  { inisial: string; gradien: string; aksen: string; ringkas: string }
> = {
  'TKA Matematika': {
    inisial: 'MTK',
    gradien: 'linear-gradient(145deg, #0f766e 0%, #14b8a6 55%, #5eead4 100%)',
    aksen: '#ccfbf1',
    ringkas: 'Bilangan · Geometri · Data',
  },
  'TKA Bahasa Indonesia': {
    inisial: 'BI',
    gradien: 'linear-gradient(145deg, #1e3a8a 0%, #3b82f6 55%, #93c5fd 100%)',
    aksen: '#dbeafe',
    ringkas: 'Tekstual · Inferensial · Evaluasi',
  },
  'TKA IPA': {
    inisial: 'IPA',
    gradien: 'linear-gradient(145deg, #9f1239 0%, #e11d48 55%, #fb7185 100%)',
    aksen: '#ffe4e6',
    ringkas: 'Fase B & C · keterampilan proses',
  },
}

export default function TkaBeranda() {
  const { user, profil } = useAuth()
  const akunUji = (user?.email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA
  const boleh = bolehAksesTkaStaf(user, profil)
  const bolehImport = bolehImportRekapTka(user, profil)

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
    <div className="tka-dash space-y-6">
      <section className="tka-dash-hero">
        <div className="tka-dash-hero-inner">
          <p className="tka-dash-eyebrow">Kelas 6 · Bank bersama 6A &amp; 6B</p>
          <h1 className="tka-dash-judul">Tes Kemampuan Akademik</h1>
          <p className="tka-dash-lead">
            Kelola bank soal, susun try out, pantau hasil, dan publikasikan rekap ke portal orang
            tua. Siswa mengerjakan dari menu <strong>TKA</strong> di dashboard mereka.
            {akunUji ? ' Akun ini memiliki akses uji sistem.' : null}
          </p>
        </div>
      </section>

      <section className="tka-dash-aksi-grid" aria-label="Aksi cepat TKA">
        <Link to="/tka/rekap" className="tka-dash-rekap">
          <div className="tka-dash-rekap-icon" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19V5M4 19h16M8 17V9M12 17v-5M16 17V7" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="tka-dash-rekap-judul">Rekap Nilai Try Out</h2>
            <p className="tka-dash-rekap-desc">
              Nilai per tahap (I–V) untuk BI, Matematika, dan IPA — otomatis dari kuis LMS atau
              input manual.
            </p>
          </div>
          <span className="tka-dash-rekap-cta">Buka rekap →</span>
        </Link>

        {bolehImport && (
          <Link to="/tka/import-rekap" className="tka-dash-rekap tka-dash-rekap--admin">
            <div className="tka-dash-rekap-icon tka-dash-rekap-icon--admin" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="tka-dash-rekap-judul">Import Rekap Try Out</h2>
              <p className="tka-dash-rekap-desc">
                Impor massal nilai try out (portal tka2026 atau JSON) ke rekap tahap I–V.
              </p>
            </div>
            <span className="tka-dash-rekap-cta">Buka tool →</span>
          </Link>
        )}
      </section>

      <div>
        <p className="tka-dash-section-label">Mata pelajaran TKA</p>
        <section className="tka-dash-grid mt-2" aria-label="Mata pelajaran TKA">
          {MAPEL_TKA.map((mapel) => {
            const r = ruangTka(mapel)
            const meta = META_MAPEL[mapel]
            const label = LABEL_MAPEL_TKA[mapel]
            const materi = MATERI_TKA[mapel]
            return (
              <Link
                key={r.id}
                to={`/kelas/${encodeURIComponent(r.id)}?tab=soal`}
                className="tka-dash-kartu"
              >
                <div className="tka-dash-kartu-head" style={{ background: meta.gradien }}>
                  <span className="tka-dash-inisial" style={{ color: meta.aksen }}>
                    {meta.inisial}
                  </span>
                  <span className="tka-dash-kartu-label">{label}</span>
                </div>
                <div className="tka-dash-kartu-body">
                  <p className="tka-dash-kartu-ringkas">{meta.ringkas}</p>
                  <ul className="tka-dash-materi">
                    {materi.slice(0, 4).map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                    {materi.length > 4 && <li>+{materi.length - 4} materi lain</li>}
                  </ul>
                  <p className="tka-dash-kartu-cta">
                    Bank soal · Kuis · Hasil
                    <span aria-hidden>→</span>
                  </p>
                </div>
              </Link>
            )
          })}
        </section>
      </div>
    </div>
  )
}

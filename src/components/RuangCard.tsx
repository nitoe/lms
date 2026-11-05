import { Link } from 'react-router-dom'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import type { RuangKelas } from '../lib/kelasLms'

type Props = {
  ruang: RuangKelas
  /** Tampilkan meta ringan di bawah judul */
  meta?: string
}

/**
 * Kartu ruang kelas gaya LMS modern:
 * cover gradien + dekorasi, judul, chip kelas, CTA soft.
 */
export default function RuangCard({ ruang, meta }: Props) {
  const a = aksenMapel(ruang.mapel)

  return (
    <Link
      to={`/kelas/${encodeURIComponent(ruang.id)}`}
      className="lms-card group"
    >
      <div className="lms-card-cover" style={{ background: a.cover }}>
        <div className="lms-card-cover-deco" aria-hidden />
        <div className="lms-card-cover-badge">
          Kelas {ruang.kelas}
          {ruang.sebagaiWali ? ' · Wali' : ''}
        </div>
        <div className="lms-card-cover-mark" style={{ color: a.coverFg }} aria-hidden>
          {inisialMapel(ruang.mapel)}
        </div>
      </div>
      <div className="lms-card-body">
        <h3 className="lms-card-title">{ruang.mapel}</h3>
        <p className="lms-card-meta">
          {meta ?? `Ruang belajar · Kelas ${ruang.kelas}`}
        </p>
        <div className="lms-card-footer">
          <span className={`lms-chip ${a.chip}`}>Kelas {ruang.kelas}</span>
          <span className="lms-card-cta">Buka →</span>
        </div>
      </div>
    </Link>
  )
}

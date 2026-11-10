import { Link } from 'react-router-dom'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import type { RuangKelas } from '../lib/kelasLms'

export type RingkasRuang = {
  tugasAktif: number
  kuisAktif: number
}

type Props = {
  ruang: RuangKelas
  /** Tampilkan meta ringan di bawah judul */
  meta?: string
  /** Jumlah tugas/kuis aktif untuk ruang ini */
  ringkas?: RingkasRuang
}

/**
 * Kartu ruang kelas gaya LMS modern:
 * cover gradien + dekorasi, judul, chip kelas, CTA soft.
 */
export default function RuangCard({ ruang, meta, ringkas }: Props) {
  const a = aksenMapel(ruang.mapel)
  const nTugas = ringkas?.tugasAktif ?? 0
  const nKuis = ringkas?.kuisAktif ?? 0
  const adaAktif = nTugas > 0 || nKuis > 0

  const metaTeks =
    meta ??
    (adaAktif
      ? [
          nTugas > 0 ? `${nTugas} tugas aktif` : null,
          nKuis > 0 ? `${nKuis} kuis aktif` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : `Ruang belajar · Kelas ${ruang.kelas}`)

  return (
    <Link to={`/kelas/${encodeURIComponent(ruang.id)}`} className="lms-card group">
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
        <p className="lms-card-meta">{metaTeks}</p>
        <div className="lms-card-footer">
          <span className={`lms-chip ${a.chip}`}>Kelas {ruang.kelas}</span>
          {adaAktif ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muh-800">
              {nTugas > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200/80">
                  {nTugas} tugas
                </span>
              )}
              {nKuis > 0 && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800 ring-1 ring-sky-200/80">
                  {nKuis} kuis
                </span>
              )}
            </span>
          ) : (
            <span className="lms-card-cta">Buka →</span>
          )}
        </div>
      </div>
    </Link>
  )
}

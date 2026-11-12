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
 * Kartu ruang kelas — cover beraksen mapel, chip kelas, ringkas tugas/kuis aktif.
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
    <Link
      to={`/kelas/${encodeURIComponent(ruang.id)}`}
      className="rk-kartu"
      style={{ ['--rk-a' as string]: a.bar, ['--rk-cover' as string]: a.cover, ['--rk-fg' as string]: a.coverFg }}
    >
      <div className="rk-kartu-cover" aria-hidden>
        <div className="rk-kartu-deco" />
        <span className="rk-kartu-badge">
          Kelas {ruang.kelas}
          {ruang.sebagaiWali ? ' · Wali' : ''}
        </span>
        <span className="rk-kartu-mark">{inisialMapel(ruang.mapel)}</span>
      </div>
      <div className="rk-kartu-badan">
        <h3 className="rk-kartu-judul">{ruang.mapel}</h3>
        <p className="rk-kartu-meta">{metaTeks}</p>
        <div className="rk-kartu-kaki">
          <span className="rk-chip">Kelas {ruang.kelas}</span>
          {adaAktif ? (
            <span className="rk-kartu-aktif">
              {nTugas > 0 && <span className="rk-pill rk-pill--tugas">{nTugas} tugas</span>}
              {nKuis > 0 && <span className="rk-pill rk-pill--kuis">{nKuis} kuis</span>}
            </span>
          ) : (
            <span className="rk-kartu-cta">Buka →</span>
          )}
        </div>
      </div>
    </Link>
  )
}

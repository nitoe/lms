import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import type { RuangKelas } from '../lib/kelasLms'
import type { RingkasRuang } from '../lib/ringkasanRuang'
import { IkonPanah } from './ikonRuang'
import '../styles/ruang.css'

export type { RingkasRuang }

type Props = {
  ruang: RuangKelas
  /** Teks pengganti baris meta di bawah judul. */
  meta?: string
  /** Jumlah tugas/kuis aktif untuk ruang ini; undefined = belum dimuat. */
  ringkas?: RingkasRuang
}

/**
 * Kartu ruang kelas: cover gradien per mapel, badge kelas/wali, hitungan tugas & kuis aktif,
 * ajakan buka ruang. Seluruh kartu adalah satu tautan.
 */
export default function RuangCard({ ruang, meta, ringkas }: Props) {
  const a = aksenMapel(ruang.mapel)
  const gaya = { '--rg-a': a.bar } as CSSProperties
  const nTugas = ringkas?.tugasAktif ?? 0
  const nKuis = ringkas?.kuisAktif ?? 0

  return (
    <Link to={`/kelas/${encodeURIComponent(ruang.id)}`} className="rg-ruang" style={gaya}>
      <div className="rg-ruang-cover" style={{ background: a.cover }}>
        <div className="rg-ruang-badges">
          <span className="rg-ruang-badge">Kelas {ruang.kelas}</span>
          {ruang.sebagaiWali && <span className="rg-ruang-badge rg-ruang-badge--wali">Wali</span>}
        </div>
        <span className="rg-ruang-mono" style={{ color: a.coverFg }} aria-hidden="true">
          {inisialMapel(ruang.mapel)}
        </span>
      </div>
      <div className="rg-ruang-body">
        <h3 className="rg-ruang-judul">{ruang.mapel}</h3>
        {(meta || !ringkas) && (
          <p className="rg-ruang-meta">{meta ?? 'Materi · Kuis · Bank soal'}</p>
        )}
        {ringkas && (
          <div className="rg-ruang-hitung">
            <div className={`rg-hitung${nTugas > 0 ? ' rg-hitung--tugas' : ''}`}>
              <b>{nTugas}</b>
              <span>tugas aktif</span>
            </div>
            <div className={`rg-hitung${nKuis > 0 ? ' rg-hitung--kuis' : ''}`}>
              <b>{nKuis}</b>
              <span>kuis aktif</span>
            </div>
          </div>
        )}
        <span className="rg-ruang-cta">
          Buka ruang
          <IkonPanah size={13} />
        </span>
      </div>
    </Link>
  )
}

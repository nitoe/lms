import { useEffect, useState } from 'react'
import PengumumanIsi from '../../components/PengumumanIsi'
import { daftarPengumumanSiswa } from '../../lib/pengumuman'
import type { PengumumanLms } from '../../types/pengumuman'
import '../../styles/pengumuman.css'

type Props = { kelas: string }

/**
 * Cuplikan pengumuman aktif di beranda siswa (semua mapel, pin di atas).
 */
export default function SiswaPengumumanStrip({ kelas }: Props) {
  const [list, setList] = useState<PengumumanLms[] | null>(null)

  useEffect(() => {
    if (!kelas) return
    let batal = false
    daftarPengumumanSiswa(kelas)
      .then((rows) => {
        if (!batal) setList(rows.slice(0, 5))
      })
      .catch(() => {
        if (!batal) setList([])
      })
    return () => {
      batal = true
    }
  }, [kelas])

  if (!list || list.length === 0) return null

  return (
    <section className="pg-siswa sw-panel" aria-label="Pengumuman kelas">
      <h2 className="pg-siswa-judul">Pengumuman</h2>
      <ul className="pg-list">
        {list.map((p) => (
          <li key={p.id} className={`pg-kartu${p.pin ? ' pg-kartu--pin' : ''}`}>
            <div className="pg-kartu-kepala">
              <h3 className="pg-kartu-judul">{p.judul}</h3>
              {p.pin && <span className="pg-badge pg-badge--pin">Penting</span>}
            </div>
            <p className="pg-meta">
              <span>{p.mapel}</span>
              {p.dibuatOlehNama && <span>{p.dibuatOlehNama}</span>}
            </p>
            <PengumumanIsi html={p.kontenHtml} />
          </li>
        ))}
      </ul>
    </section>
  )
}

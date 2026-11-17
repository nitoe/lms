import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import {
  hitungBintang,
  hitungPencapaian,
  muatDataPencapaian,
  pesanGagalPencapaian,
  susunLencana,
  type DataPencapaian,
} from '../../lib/pencapaianSiswa'
import SiswaIcon from './SiswaIcon'

type Muat =
  | { status: 'loading' }
  | { status: 'error'; pesan: string }
  | { status: 'ok'; data: DataPencapaian }

function angka(n: number | null): string {
  if (n === null) return '—'
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

/** Pencapaian: bintang & lencana, dihitung dari kuis dan tugas yang sudah ada (hanya baca). */
export default function SiswaPencapaian() {
  const { sesi } = useSiswa()
  const siswaId = sesi?.id ?? ''
  const kelas = sesi?.kelas ?? ''
  const [muat, setMuat] = useState<Muat>({ status: 'loading' })

  const ambil = useCallback(async () => {
    if (!siswaId || !kelas) return
    setMuat({ status: 'loading' })
    try {
      const { jawaban, nilai } = await muatDataPencapaian(siswaId, kelas)
      setMuat({ status: 'ok', data: hitungPencapaian(jawaban, nilai) })
    } catch (e) {
      console.warn('Pencapaian siswa gagal dimuat', e)
      setMuat({ status: 'error', pesan: pesanGagalPencapaian(e) })
    }
  }, [siswaId, kelas])

  useEffect(() => {
    void ambil()
  }, [ambil])

  const data = muat.status === 'ok' ? muat.data : null
  const lencana = useMemo(() => (data ? susunLencana(data) : []), [data])
  const bintang = data ? hitungBintang(data) : 0
  const terbuka = lencana.filter((l) => l.terbuka).length

  const berikutnya = useMemo(() => {
    const terkunci = lencana.filter((l) => !l.terbuka)
    if (terkunci.length === 0) return null
    return [...terkunci].sort((a, b) => a.target - a.nilai - (b.target - b.nilai))[0]
  }, [lencana])

  if (muat.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="sw-skel" style={{ height: '9rem' }} />
        <div className="sw-skel" style={{ height: '6rem' }} />
        <div className="sw-skel" style={{ height: '12rem' }} />
      </div>
    )
  }

  if (muat.status === 'error') {
    return (
      <div className="lms-empty space-y-3">
        <p className="font-medium text-slate-700">{muat.pesan}</p>
        <button type="button" className="sw-btn-primary" onClick={() => void ambil()}>
          Coba lagi
        </button>
      </div>
    )
  }

  const d = muat.data

  let pesan = 'Kerjakan kuis atau tugas untuk mengumpulkan bintang pertamamu.'
  if (bintang > 0) {
    pesan = berikutnya
      ? `Tinggal ${berikutnya.target - berikutnya.nilai} lagi untuk lencana «${berikutnya.judul}».`
      : 'Semua lencana sudah kamu dapatkan. Hebat!'
  }

  return (
    <div className="space-y-5">
      <div className="sw-page-head sw-tone-emerald">
        <span className="sw-page-ico" aria-hidden>
          <SiswaIcon name="star" size={26} />
        </span>
        <div className="min-w-0">
          <h1 className="sw-page-title">Pencapaian</h1>
          <p className="sw-page-sub">Bintang dan lencana dari kuis & tugasmu</p>
        </div>
      </div>

      <section className="sw-hero sw-hero--emerald">
        <div className="sw-hero-main">
          <div className="sw-hero-avatar" aria-hidden>
            <SiswaIcon name="star" size={32} />
          </div>
          <div className="min-w-0">
            <p className="sw-hero-kicker">Bintangmu</p>
            <h2 className="sw-hero-title">{bintang} bintang</h2>
            <p className="sw-hero-msg">{pesan}</p>
          </div>
        </div>
        <div className="sw-hero-side">
          <div className="sw-hero-stat">
            <span className="sw-hero-stat-n">
              {terbuka}/{lencana.length}
            </span>
            <span className="sw-hero-stat-l">Lencana</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="sw-section-title">Ringkasan</h2>
        <div className="sw-pen-stats">
          <div className="sw-pen-stat">
            <span className="sw-pen-stat-n">{d.kuisSelesai}</span>
            <span className="sw-pen-stat-l">Kuis selesai</span>
          </div>
          <div className="sw-pen-stat">
            <span className="sw-pen-stat-n">{angka(d.rataKuis)}</span>
            <span className="sw-pen-stat-l">Rata-rata skor kuis</span>
          </div>
          <div className="sw-pen-stat">
            <span className="sw-pen-stat-n">{d.tugasDinilai}</span>
            <span className="sw-pen-stat-l">Tugas dinilai</span>
          </div>
          <div className="sw-pen-stat">
            <span className="sw-pen-stat-n">{angka(d.rataTugas)}</span>
            <span className="sw-pen-stat-l">Rata-rata nilai tugas</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="sw-section-title">Lencana</h2>
        <ul className="sw-badge-grid">
          {lencana.map((l) => (
            <li
              key={l.id}
              className={`sw-badge sw-tone-${l.tone} ${l.terbuka ? 'sw-badge--on' : 'sw-badge--off'}`}
            >
              <span className="sw-badge-ico" aria-hidden>
                <SiswaIcon name={l.terbuka ? l.ikon : 'check'} size={26} />
              </span>
              <span className="sw-badge-body">
                <span className="sw-badge-title">{l.judul}</span>
                <span className="sw-badge-syarat">{l.syarat}</span>
                {!l.terbuka && (
                  <span className="sw-badge-bar" aria-hidden>
                    <span style={{ width: `${(l.nilai / l.target) * 100}%` }} />
                  </span>
                )}
              </span>
              <span className="sw-badge-state">
                {l.terbuka ? 'Dapat' : `${l.nilai}/${l.target}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="sw-kat-hint">
        Satu bintang untuk setiap kuis yang sudah kamu kerjakan dan setiap tugas yang sudah dinilai.
        Skor kuis dihitung dari penilaian otomatis; soal uraian yang dinilai gurumu tidak ikut
        terhitung di sini.
      </p>

      <div>
        <Link to="/siswa" className="sw-btn-primary">
          ← Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}

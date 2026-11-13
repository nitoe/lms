import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MateriBaca from '../components/materi/MateriBaca'
import { useSiswa } from '../context/SiswaContext'
import { ambilMateri, muatIsi } from '../lib/materiHalaman'
import { aksenMapel } from '../lib/uiAksen'
import type { IsiMateri, MateriLms } from '../types/materi'
import '../styles/materi.css'

type Muat =
  | { status: 'loading' }
  | { status: 'error'; pesan: string }
  | { status: 'ok'; materi: MateriLms; isi: IsiMateri }

function pesanGalat(e: unknown, siswa: boolean): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (code.includes('permission-denied')) {
    return siswa ? 'Materi ini belum bisa dibuka. Beri tahu gurumu ya.' : 'Anda tidak punya akses ke materi ini.'
  }
  return 'Materi gagal dimuat. Periksa internet lalu coba lagi.'
}

/**
 * Pembaca materi tulis-sendiri.
 * Siswa: /siswa/materi/:materiId — Staf: /kelas/:ruangId/materi/:materiId/baca (boleh membaca draf).
 */
export default function MateriBacaPage({ peran }: { peran: 'siswa' | 'staf' }) {
  const { materiId = '', ruangId = '' } = useParams()
  const { sesi } = useSiswa()
  const navigate = useNavigate()
  const [muat, setMuat] = useState<Muat>({ status: 'loading' })
  const [percobaan, setPercobaan] = useState(0)

  useEffect(() => {
    let batal = false
    Promise.all([ambilMateri(materiId), muatIsi(materiId)])
      .then(([materi, isi]) => {
        if (batal) return
        const salahKelas = peran === 'siswa' && materi && sesi && materi.kelas !== sesi.kelas
        if (!materi || !isi || materi.jenis !== 'halaman' || salahKelas) {
          return setMuat({ status: 'error', pesan: 'Materi tidak ditemukan.' })
        }
        if (peran === 'siswa' && materi.status !== 'terbit') {
          return setMuat({ status: 'error', pesan: 'Materi ini belum diterbitkan.' })
        }
        setMuat({ status: 'ok', materi, isi })
      })
      .catch((e: unknown) => !batal && setMuat({ status: 'error', pesan: pesanGalat(e, peran === 'siswa') }))
    return () => {
      batal = true
    }
  }, [materiId, peran, sesi, percobaan])

  const kembaliKe =
    peran === 'siswa'
      ? muat.status === 'ok'
        ? `/siswa/materi?mapel=${encodeURIComponent(muat.materi.mapel)}`
        : '/siswa/materi'
      : `/kelas/${ruangId}?tab=materi`

  if (muat.status === 'loading') return <div className="lms-empty">Memuat materi…</div>
  if (muat.status === 'error') {
    return (
      <div className="lms-empty space-y-3">
        <p className="font-medium text-slate-700">{muat.pesan}</p>
        <button type="button" className="lms-btn-secondary" onClick={() => { setMuat({ status: 'loading' }); setPercobaan((n) => n + 1) }}>
          Coba lagi
        </button>{' '}
        <Link to={kembaliKe} className="lms-btn-primary">Kembali</Link>
      </div>
    )
  }

  return (
    <MateriBaca
      materiId={muat.materi.id}
      judul={muat.materi.judul}
      mapel={muat.materi.mapel}
      halaman={muat.isi.halaman}
      aksen={aksenMapel(muat.materi.mapel).bar}
      mode={peran === 'siswa' ? 'siswa' : 'pratinjau'}
      onTutup={() => navigate(kembaliKe)}
    />
  )
}

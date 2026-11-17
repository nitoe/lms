import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { getLomba } from '../../lib/lomba'
import { labelStatusLomba, lombaSedangBerlangsung } from '../../lib/lombaAkses'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import '../../styles/lomba.css'

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Detail lomba untuk siswa peserta. Rute: /siswa/lomba/:lombaId.
 * Hanya peserta (siswaIds memuat sesi.id) yang boleh melihat — rules `get` sudah menegakkan; cek klien
 * hanya untuk pesan ramah. ANTIREGRESI §Lomba.22.
 */
export default function SiswaLombaDetail() {
  const { lombaId } = useParams<{ lombaId: string }>()
  const { sesi } = useSiswa()
  const [lomba, setLomba] = useState<Lomba | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!lombaId) return
    let batal = false
    setMemuat(true)
    setGalat('')
    getLomba(lombaId)
      .then((l) => {
        if (!batal) setLomba(l)
      })
      .catch((e) => {
        console.warn('getLomba (siswa) gagal:', e)
        if (!batal) {
          setLomba(null)
          setGalat('Lomba tidak dapat dibuka. Kamu mungkin belum terdaftar sebagai peserta.')
        }
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [lombaId])

  if (memuat) return <div className="p-6 text-sm text-muted">Memuat lomba…</div>

  const peserta = !!lomba && !!sesi?.id && lomba.siswaIds.includes(sesi.id)

  if (!lomba || !peserta) {
    return (
      <div className="lomba-dash space-y-3 p-4 sm:p-6">
        <Link to="/siswa/lomba" className="lomba-back">
          ← Daftar lomba
        </Link>
        <div className="lomba-kosong">
          <h3>Lomba tidak ditemukan</h3>
          <p>{galat || 'Lomba ini tidak ada atau kamu tidak terdaftar sebagai peserta.'}</p>
        </div>
      </div>
    )
  }

  const berlangsung = lombaSedangBerlangsung(lomba)
  const tingkat = TINGKAT_LOMBA.find((x) => x.value === lomba.tingkat)?.label ?? lomba.tingkat

  return (
    <div className="lomba-dash space-y-4 p-4 sm:p-6">
      <Link to="/siswa/lomba" className="lomba-back">
        ← Daftar lomba
      </Link>

      <section className="lomba-hero">
        <div className="lomba-hero-inner">
          <p className="lomba-eyebrow">{tingkat}</p>
          <h1 className="lomba-judul">{lomba.nama}</h1>
          {lomba.identitas ? <p className="lomba-lead">{lomba.identitas}</p> : null}
          <span
            className={
              berlangsung
                ? 'lomba-badge lomba-badge--aktif'
                : lomba.status === 'draf'
                  ? 'lomba-badge lomba-badge--draf'
                  : 'lomba-badge lomba-badge--selesai'
            }
          >
            {berlangsung ? 'Berlangsung' : labelStatusLomba(lomba.status)}
          </span>
        </div>
      </section>

      <section className="lomba-kartu">
        <dl className="lomba-kartu-meta">
          <div>
            <dd>
              <span className="label">Masa</span>
              <span className="nilai">
                {formatTanggal(lomba.mulai)} – {formatTanggal(lomba.selesai)}
              </span>
            </dd>
          </div>
          <div>
            <dd>
              <span className="label">Pengampu</span>
              <span className="nilai">{lomba.guruPengampuNama || '—'}</span>
            </dd>
          </div>
          <div>
            <dd>
              <span className="label">Peserta</span>
              <span className="nilai">{lomba.siswaIds.length} siswa</span>
            </dd>
          </div>
        </dl>
        {lomba.mapelTerkait.length > 0 && (
          <div className="px-[1.1rem] pb-3">
            <div className="lomba-pill-row">
              {lomba.mapelTerkait.map((m) => (
                <span key={m} className="lomba-pill">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {lomba.deskripsi ? (
          <p className="px-[1.1rem] pb-4 text-sm leading-relaxed text-slate-700">{lomba.deskripsi}</p>
        ) : null}
      </section>

      <div className="lomba-kosong">
        <h3>Materi &amp; kuis latihan</h3>
        <p>Materi dan kuis latihan untuk lomba ini akan muncul di sini setelah gurumu menyiapkannya.</p>
      </div>
    </div>
  )
}

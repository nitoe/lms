import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getLomba } from '../../lib/lomba'
import {
  adalahAdminLms,
  bolehKelolaKontenLomba,
  labelStatusLomba,
} from '../../lib/lombaAkses'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import '../../styles/lomba.css'

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
}

function badgeClass(status: string): string {
  if (status === 'aktif') return 'lomba-badge lomba-badge--aktif'
  if (status === 'draf') return 'lomba-badge lomba-badge--draf'
  return 'lomba-badge lomba-badge--selesai'
}

export default function LombaDetail() {
  const { lombaId } = useParams<{ lombaId: string }>()
  const { user, profil } = useAuth()
  const admin = adalahAdminLms(user, profil)
  const [lomba, setLomba] = useState<Lomba | null>(null)
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')

  const muat = useCallback(async () => {
    if (!lombaId) return
    setLoading(true)
    setGalat('')
    try {
      const l = await getLomba(lombaId)
      setLomba(l)
      if (!l) setGalat('Lomba tidak ditemukan.')
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat.')
      setLomba(null)
    } finally {
      setLoading(false)
    }
  }, [lombaId])

  useEffect(() => {
    void muat()
  }, [muat])

  if (loading) {
    return <div className="lms-empty p-8 text-sm text-muted">Memuat lomba…</div>
  }

  if (!lomba) {
    return (
      <div className="lomba-dash space-y-3">
        <Link to="/lomba" className="lomba-back">
          ← Daftar lomba
        </Link>
        <div className="lomba-kosong">
          <h3>{galat || 'Lomba tidak ditemukan'}</h3>
        </div>
      </div>
    )
  }

  const bolehKonten = bolehKelolaKontenLomba(user, profil, lomba)

  if (!bolehKonten && !admin) {
    return (
      <div className="lms-empty p-8 text-sm text-slate-600">
        Anda tidak memiliki akses ke lomba ini.
      </div>
    )
  }

  return (
    <div className="lomba-dash space-y-5">
      <section className="lomba-hero">
        <div className="lomba-hero-inner">
          <p className="lomba-eyebrow">{labelTingkat(lomba.tingkat)}</p>
          <h1 className="lomba-judul">{lomba.nama}</h1>
          {lomba.identitas ? <p className="lomba-lead">{lomba.identitas}</p> : null}
          <div className="lomba-hero-aksi">
            <span className={badgeClass(lomba.status)} style={{ alignSelf: 'center' }}>
              {labelStatusLomba(lomba.status)}
            </span>
            {admin && (
              <Link to={`/lomba/${lomba.id}/edit`} className="lomba-btn-ghost">
                Ubah meta
              </Link>
            )}
            <Link to="/lomba" className="lomba-btn-ghost">
              ← Daftar
            </Link>
          </div>
        </div>
      </section>

      <div className="lomba-detail-grid">
        <section className="lomba-panel">
          <h3>Informasi</h3>
          <dl className="lomba-dl">
            <div>
              <dt>Mapel terkait</dt>
              <dd>
                {lomba.mapelTerkait.length ? (
                  <div className="lomba-pill-row mt-1">
                    {lomba.mapelTerkait.map((m) => (
                      <span key={m} className="lomba-pill">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Masa berlaku</dt>
              <dd>
                {formatTanggal(lomba.mulai)} – {formatTanggal(lomba.selesai)}
              </dd>
            </div>
            <div>
              <dt>Guru pengampu</dt>
              <dd>
                {lomba.guruPengampuNama || '—'}
                {lomba.guruPengampuEmail ? (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ({lomba.guruPengampuEmail})
                  </span>
                ) : null}
              </dd>
            </div>
            {lomba.deskripsi ? (
              <div>
                <dt>Deskripsi</dt>
                <dd className="font-medium leading-relaxed text-slate-700">{lomba.deskripsi}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="lomba-panel">
          <h3>Peserta ({lomba.siswaIds.length}/20)</h3>
          {lomba.siswaList.length > 0 ? (
            <ul className="lomba-peserta-list">
              {lomba.siswaList.map((p) => (
                <li key={p.id}>
                  <span>{p.nama}</span>
                  <span className="kelas">Kelas {p.kelas}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Belum ada peserta.</p>
          )}
        </section>
      </div>

      <section className="lomba-placeholder">
        <p>Konten lomba (Tahap 2)</p>
        <span>
          Materi, bank soal, dan kuis persiapan/lomba akan dikelola di sini. TP dibatasi ke mapel
          terkait di atas.
        </span>
        <div className="lomba-placeholder-pills">
          <span>Materi — segera</span>
          <span>Bank soal — segera</span>
          <span>Kuis — segera</span>
        </div>
      </section>
    </div>
  )
}

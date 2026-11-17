import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  daftarLombaPengampu,
  daftarSemuaLomba,
  hapusLomba,
} from '../../lib/lomba'
import {
  adalahAdminLms,
  bolehAksesLombaStaf,
  labelStatusLomba,
} from '../../lib/lombaAkses'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import '../../styles/lomba.css'

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
}

function badgeClass(status: string): string {
  if (status === 'aktif') return 'lomba-badge lomba-badge--aktif'
  if (status === 'draf') return 'lomba-badge lomba-badge--draf'
  return 'lomba-badge lomba-badge--selesai'
}

export default function LombaList() {
  const { user, profil } = useAuth()
  const admin = adalahAdminLms(user, profil)
  const [list, setList] = useState<Lomba[]>([])
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  const [hapusId, setHapusId] = useState<string | null>(null)

  const muat = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setGalat('')
    try {
      if (admin) {
        setList(await daftarSemuaLomba())
      } else {
        setList(await daftarLombaPengampu(user.uid))
      }
    } catch (e) {
      console.error(e)
      setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar lomba.')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [user, admin])

  useEffect(() => {
    void muat()
  }, [muat])

  const bolehLihat = bolehAksesLombaStaf(user, profil, list)

  async function handleHapus(l: Lomba) {
    if (!admin) return
    const ok = window.confirm(
      `Hapus lomba «${l.nama}»?\n\nMateri, bank soal, dan kuis terkait (jika ada) tidak ikut terhapus otomatis di tahap ini. Tindakan tidak dapat dibatalkan.`,
    )
    if (!ok) return
    setHapusId(l.id)
    try {
      await hapusLomba(l.id)
      setList((prev) => prev.filter((x) => x.id !== l.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus.')
    } finally {
      setHapusId(null)
    }
  }

  if (loading) {
    return <div className="lms-empty p-8 text-sm text-muted">Memuat daftar lomba…</div>
  }

  if (!admin && list.length === 0) {
    return (
      <div className="lomba-dash">
        <section className="lomba-hero">
          <div className="lomba-hero-inner">
            <p className="lomba-eyebrow">Modul lomba</p>
            <h1 className="lomba-judul">Akses terbatas</h1>
            <p className="lomba-lead">
              Menu ini hanya untuk administrator LMS atau guru yang ditunjuk sebagai pengampu
              sebuah lomba. Hubungi admin jika Anda seharusnya menjadi pengampu.
            </p>
          </div>
        </section>
      </div>
    )
  }

  if (!bolehLihat && !admin) {
    return (
      <div className="lms-empty p-8 text-sm text-slate-600">
        Anda tidak memiliki akses ke modul Lomba.
      </div>
    )
  }

  return (
    <div className="lomba-dash space-y-5">
      <section className="lomba-hero">
        <div className="lomba-hero-inner">
          <p className="lomba-eyebrow">
            {admin ? 'Administrator LMS' : 'Guru pengampu'}
          </p>
          <h1 className="lomba-judul">Lomba</h1>
          <p className="lomba-lead">
            {admin
              ? 'Kelola lomba, tentukan guru pengampu dan peserta (maks. 20 siswa). Materi, bank soal, dan kuis disiapkan di halaman detail tiap lomba.'
              : 'Lomba yang Anda ampu. Buka detail untuk menyiapkan materi, bank soal, dan kuis.'}
          </p>
          {admin && (
            <div className="lomba-hero-aksi">
              <Link to="/lomba/baru" className="lomba-btn-utama">
                <span aria-hidden>+</span> Lomba baru
              </Link>
            </div>
          )}
        </div>
      </section>

      {galat && <div className="lomba-alert">{galat}</div>}

      {list.length === 0 ? (
        <div className="lomba-kosong">
          <h3>Belum ada lomba</h3>
          <p>
            {admin
              ? 'Buat lomba pertama untuk menugaskan guru pengampu dan memilih peserta.'
              : 'Belum ada lomba yang menugaskan Anda sebagai pengampu.'}
          </p>
          {admin && (
            <p className="mt-4">
              <Link to="/lomba/baru" className="lomba-btn-utama" style={{ display: 'inline-flex' }}>
                + Buat lomba
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="lomba-grid">
          {list.map((l) => (
            <li key={l.id} className="lomba-kartu">
              <div className="lomba-kartu-head">
                <div className="min-w-0">
                  <h2 className="lomba-kartu-nama">
                    <Link to={`/lomba/${l.id}`}>{l.nama}</Link>
                  </h2>
                  {l.identitas ? (
                    <p className="lomba-kartu-identitas">{l.identitas}</p>
                  ) : null}
                </div>
                <span className={badgeClass(l.status)}>{labelStatusLomba(l.status)}</span>
              </div>

              <dl className="lomba-kartu-meta">
                <div>
                  <dd>
                    <span className="label">Tingkat</span>
                    <span className="nilai">{labelTingkat(l.tingkat)}</span>
                  </dd>
                </div>
                <div>
                  <dd>
                    <span className="label">Masa</span>
                    <span className="nilai">
                      {formatTanggal(l.mulai)} – {formatTanggal(l.selesai)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dd>
                    <span className="label">Pengampu</span>
                    <span className="nilai">{l.guruPengampuNama || '—'}</span>
                  </dd>
                </div>
                <div>
                  <dd>
                    <span className="label">Peserta</span>
                    <span className="nilai">{l.siswaIds.length} / 20 siswa</span>
                  </dd>
                </div>
              </dl>

              {l.mapelTerkait.length > 0 && (
                <div className="px-[1.1rem] pb-2">
                  <div className="lomba-pill-row">
                    {l.mapelTerkait.map((m) => (
                      <span key={m} className="lomba-pill">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="lomba-kartu-foot">
                <Link to={`/lomba/${l.id}`}>Buka</Link>
                {admin && (
                  <>
                    <Link to={`/lomba/${l.id}/edit`}>Ubah</Link>
                    <button
                      type="button"
                      className="danger"
                      disabled={hapusId === l.id}
                      onClick={() => void handleHapus(l)}
                    >
                      {hapusId === l.id ? 'Menghapus…' : 'Hapus'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

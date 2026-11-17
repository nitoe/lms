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
      <div className="lms-empty space-y-2 p-8">
        <p className="font-medium text-slate-700">{galat || 'Lomba tidak ditemukan'}</p>
        <Link to="/lomba" className="text-sm text-muh-700 hover:underline">
          ← Kembali ke daftar
        </Link>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/lomba" className="text-sm text-muh-700 hover:underline">
            ← Daftar lomba
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{lomba.nama}</h2>
          {lomba.identitas && (
            <p className="mt-0.5 text-sm text-muted">{lomba.identitas}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              lomba.status === 'aktif'
                ? 'bg-emerald-50 text-emerald-700'
                : lomba.status === 'draf'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-slate-100 text-slate-600',
            ].join(' ')}
          >
            {labelStatusLomba(lomba.status)}
          </span>
          {admin && (
            <Link
              to={`/lomba/${lomba.id}/edit`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Ubah meta
            </Link>
          )}
        </div>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted">Tingkat</dt>
            <dd className="font-medium text-slate-800">{labelTingkat(lomba.tingkat)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Mapel terkait</dt>
            <dd className="font-medium text-slate-800">
              {lomba.mapelTerkait.length ? lomba.mapelTerkait.join(', ') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Masa berlaku</dt>
            <dd className="font-medium text-slate-800">
              {formatTanggal(lomba.mulai)} – {formatTanggal(lomba.selesai)}
            </dd>
          </div>
        </dl>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted">Guru pengampu</dt>
            <dd className="font-medium text-slate-800">
              {lomba.guruPengampuNama || '—'}
              {lomba.guruPengampuEmail ? (
                <span className="ml-1 text-xs font-normal text-muted">
                  ({lomba.guruPengampuEmail})
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Peserta</dt>
            <dd className="font-medium text-slate-800">{lomba.siswaIds.length} / 20 siswa</dd>
          </div>
          {lomba.deskripsi && (
            <div>
              <dt className="text-xs text-muted">Deskripsi</dt>
              <dd className="text-slate-700">{lomba.deskripsi}</dd>
            </div>
          )}
        </dl>
      </section>

      {lomba.siswaList.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Daftar peserta</h3>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {lomba.siswaList.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="font-medium">{p.nama}</span>
                <span className="text-xs text-muted">Kelas {p.kelas}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tahap 2: Materi · Bank Soal · Kuis */}
      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
        <p className="text-sm font-medium text-slate-700">Konten lomba (Tahap 2)</p>
        <p className="mt-1 text-xs text-muted">
          Materi, bank soal, dan kuis persiapan/lomba akan dikelola di sini. Mekanisme
          mengikuti alur mapel; TP dibatasi ke mapel terkait lomba ini.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            Materi — segera
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            Bank soal — segera
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            Kuis — segera
          </span>
        </div>
      </section>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { daftarLombaSiswa } from '../../lib/lomba'
import { labelStatusLomba, lombaSedangBerlangsung } from '../../lib/lombaAkses'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
}

/**
 * Dashboard Lomba siswa — daftar lomba yang diikuti.
 * Detail materi/kuis/riwayat (Tahap 3) menyusul.
 */
export default function SiswaLomba() {
  const { sesi } = useSiswa()
  const [list, setList] = useState<Lomba[]>([])
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')

  const muat = useCallback(async () => {
    if (!sesi?.id) return
    setLoading(true)
    setGalat('')
    try {
      setList(await daftarLombaSiswa(sesi.id))
    } catch (e) {
      console.error(e)
      setGalat(e instanceof Error ? e.message : 'Gagal memuat lomba.')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [sesi?.id])

  useEffect(() => {
    void muat()
  }, [muat])

  if (loading) {
    return <div className="p-6 text-sm text-muted">Memuat lomba…</div>
  }

  if (galat) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-700">{galat}</p>
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="font-medium text-slate-700">Belum ada lomba</p>
        <p className="mt-1 text-sm text-muted">
          Kamu belum terdaftar sebagai peserta lomba. Tanya guru atau admin jika seharusnya ikut.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Lomba</h1>
        <p className="text-sm text-muted">
          Materi, kuis latihan, dan riwayat untuk lomba yang kamu ikuti.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((l) => {
          const berlangsung = lombaSedangBerlangsung(l)
          return (
            <li
              key={l.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{l.nama}</h2>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    berlangsung
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600',
                  ].join(' ')}
                >
                  {berlangsung ? 'Berlangsung' : labelStatusLomba(l.status)}
                </span>
              </div>
              {l.identitas && (
                <p className="mt-0.5 text-xs text-muted">{l.identitas}</p>
              )}
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                <div>
                  <span className="text-muted">Tingkat · </span>
                  {labelTingkat(l.tingkat)}
                </div>
                <div>
                  <span className="text-muted">Mapel · </span>
                  {l.mapelTerkait.join(', ') || '—'}
                </div>
                <div>
                  <span className="text-muted">Masa · </span>
                  {formatTanggal(l.mulai)} – {formatTanggal(l.selesai)}
                </div>
                <div>
                  <span className="text-muted">Pengampu · </span>
                  {l.guruPengampuNama || '—'}
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <span className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                  Materi — segera
                </span>
                <span className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                  Kuis — segera
                </span>
                <span className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                  Riwayat — segera
                </span>
              </div>
              {/* Route detail siswa akan ditambahkan di Tahap 3 */}
              <Link
                to={`/siswa/lomba/${l.id}`}
                className="mt-3 inline-block text-xs font-medium text-muh-700 hover:underline"
              >
                Lihat detail →
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

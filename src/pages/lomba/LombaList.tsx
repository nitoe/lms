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

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
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
  // Admin selalu boleh; guru hanya jika sudah ada lomba yang diampu (setelah muat)
  // atau kita biarkan halaman kosong dengan pesan.

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
      <div className="lms-empty space-y-2 p-8">
        <p className="font-medium text-slate-700">Akses Lomba terbatas</p>
        <p className="text-sm text-slate-600">
          Menu ini hanya untuk administrator LMS atau guru yang ditunjuk sebagai pengampu
          sebuah lomba. Hubungi admin jika Anda seharusnya menjadi pengampu.
        </p>
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
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Lomba</h2>
          <p className="mt-0.5 text-sm text-muted">
            {admin
              ? 'Kelola lomba, tentukan guru pengampu dan peserta (maks. 20 siswa per lomba).'
              : 'Lomba yang Anda ampu sebagai guru pengampu.'}
          </p>
        </div>
        {admin && (
          <Link
            to="/lomba/baru"
            className="inline-flex items-center gap-1.5 rounded-lg bg-muh-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-muh-700"
          >
            <span aria-hidden>+</span> Lomba baru
          </Link>
        )}
      </section>

      {galat && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {galat}
        </div>
      )}

      {list.length === 0 ? (
        <div className="lms-empty rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
          <p className="font-medium text-slate-700">Belum ada lomba</p>
          <p className="mt-1 text-sm text-muted">
            {admin
              ? 'Buat lomba pertama untuk menugaskan guru pengampu dan memilih peserta.'
              : 'Belum ada lomba yang menugaskan Anda sebagai pengampu.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((l) => (
            <li
              key={l.id}
              className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-muh-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/lomba/${l.id}`}
                    className="block truncate text-base font-semibold text-slate-900 hover:text-muh-700"
                  >
                    {l.nama}
                  </Link>
                  {l.identitas && (
                    <p className="mt-0.5 truncate text-xs text-muted">{l.identitas}</p>
                  )}
                </div>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    l.status === 'aktif'
                      ? 'bg-emerald-50 text-emerald-700'
                      : l.status === 'draf'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-slate-100 text-slate-600',
                  ].join(' ')}
                >
                  {labelStatusLomba(l.status)}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Tingkat</dt>
                  <dd>{labelTingkat(l.tingkat)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Mapel</dt>
                  <dd className="min-w-0 truncate">
                    {l.mapelTerkait.length ? l.mapelTerkait.join(', ') : '—'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Masa</dt>
                  <dd>
                    {formatTanggal(l.mulai)} – {formatTanggal(l.selesai)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Pengampu</dt>
                  <dd className="truncate">{l.guruPengampuNama || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Peserta</dt>
                  <dd>{l.siswaIds.length} / 20 siswa</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Link
                  to={`/lomba/${l.id}`}
                  className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Buka
                </Link>
                {admin && (
                  <>
                    <Link
                      to={`/lomba/${l.id}/edit`}
                      className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Ubah
                    </Link>
                    <button
                      type="button"
                      disabled={hapusId === l.id}
                      onClick={() => void handleHapus(l)}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
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

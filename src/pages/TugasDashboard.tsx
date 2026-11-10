import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas } from '../lib/kelasLms'
import { daftarTugasGuru, formatTenggat, hapusTugas, updateTugas } from '../lib/tugas'
import type { TugasLms } from '../types/tugas'
import { labelJenisTugas, NAMA_JENIS_PENILAIAN_TUGAS, semuaMapelTugas } from '../types/tugas'

export default function TugasDashboard() {
  const { profil } = useAuth()
  const [list, setList] = useState<TugasLms[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filterJenis, setFilterJenis] = useState<'semua' | 'mapel' | 'proyek'>('semua')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'draf'>('semua')
  const [q, setQ] = useState('')

  const ruang = useMemo(() => daftarRuangKelas(profil), [profil])

  const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'

  const muat = useCallback(async () => {
    setError('')
    try {
      const data = await daftarTugasGuru(ruang, { sebagaiAdmin })
      setList(data)
      if (data.length === 0 && ruang.length === 0 && !sebagaiAdmin) {
        setError(
          'Profil Anda belum punya penugasan kelas×mapel. Atur penugasan di aplikasi Penilaian, atau pastikan tugas lama masih tercatat dengan dibuatOleh akun ini.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar tugas.')
      setList([])
    }
  }, [ruang, sebagaiAdmin])

  useEffect(() => {
    void muat()
  }, [muat])

  const filtered = useMemo(() => {
    if (!list) return []
    let rows = list
    if (filterJenis !== 'semua') rows = rows.filter((t) => t.jenis === filterJenis)
    if (filterStatus === 'aktif') rows = rows.filter((t) => t.aktif)
    if (filterStatus === 'draf') rows = rows.filter((t) => !t.aktif)
    const s = q.trim().toLowerCase()
    if (s) {
      rows = rows.filter(
        (t) =>
          t.judul.toLowerCase().includes(s) ||
          t.mapel.toLowerCase().includes(s) ||
          t.kelas.toLowerCase().includes(s) ||
          (t.deskripsi && t.deskripsi.toLowerCase().includes(s)),
      )
    }
    return rows
  }, [list, filterJenis, filterStatus, q])

  async function onToggleAktif(t: TugasLms) {
    setBusy(true)
    setError('')
    try {
      await updateTugas(t.id, { aktif: !t.aktif })
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status.')
    } finally {
      setBusy(false)
    }
  }

  async function onHapus(t: TugasLms) {
    if (!confirm(`Hapus tugas «${t.judul}»? Tindakan ini tidak dapat dibatalkan.`)) return
    setBusy(true)
    setError('')
    try {
      await hapusTugas(t.id)
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="lms-page-intro flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tugas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Katalog semua tugas (mapel & proyek). Buat tugas baru, atur tenggat, lampirkan Tujuan
            Pembelajaran, lalu input nilai manual.
          </p>
        </div>
        <Link to="/tugas/baru" className="lms-btn-primary shrink-0">
          + Tugas baru
        </Link>
      </div>

      <div className="lms-toolbar flex-wrap gap-2">
        <input
          type="search"
          className="lms-input min-w-[180px] flex-1"
          placeholder="Cari judul, mapel, kelas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari tugas"
        />
        <select
          className="lms-input w-auto"
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value as typeof filterJenis)}
          aria-label="Filter jenis"
        >
          <option value="semua">Semua jenis</option>
          <option value="mapel">Mapel</option>
          <option value="proyek">Proyek</option>
        </select>
        <select
          className="lms-input w-auto"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          aria-label="Filter status"
        >
          <option value="semua">Semua status</option>
          <option value="aktif">Aktif</option>
          <option value="draf">Draf</option>
        </select>
        <span className="lms-count-pill">
          {list === null ? '…' : `${filtered.length} tugas`}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {list === null && <div className="lms-empty">Memuat katalog tugas…</div>}

      {list && list.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada tugas</p>
          <p className="mt-1">Buat tugas pertama untuk mulai memberikan pekerjaan kepada siswa.</p>
          <Link to="/tugas/baru" className="lms-btn-primary mt-4 inline-flex">
            + Tugas baru
          </Link>
        </div>
      )}

      {list && list.length > 0 && filtered.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Tidak ada yang cocok</p>
          <p className="mt-1">Ubah filter atau kata kunci pencarian.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const mapels = semuaMapelTugas(t)
            return (
              <article
                key={t.id}
                className="card-soft flex flex-col gap-3 p-4 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          t.jenis === 'proyek'
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {labelJenisTugas(t.jenis)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          t.aktif
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.aktif ? 'Aktif' : 'Draf'}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2">
                      <Link to={`/tugas/${t.id}`} className="hover:text-muh-700 hover:underline">
                        {t.judul}
                      </Link>
                    </h3>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted">
                  <div>
                    <span className="font-medium text-slate-600">Kelas</span> {t.kelas}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Mapel</span>{' '}
                    {mapels.join(', ')}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Penilaian</span>{' '}
                    {NAMA_JENIS_PENILAIAN_TUGAS[
                      t.jenisPenilaian === 'latihan' ||
                      t.jenisPenilaian === 'sts' ||
                      t.jenisPenilaian === 'sas' ||
                      t.jenisPenilaian === 'slm'
                        ? t.jenisPenilaian
                        : 'slm'
                    ].split(' ')[0]}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Tenggat</span>{' '}
                    {formatTenggat(t.tenggat)}
                  </div>
                  {t.tpList && t.tpList.length > 0 && (
                    <div>
                      <span className="font-medium text-slate-600">TP</span>{' '}
                      {t.tpList.length === 1
                        ? `TP ${t.tpList[0].nomor}`
                        : `${t.tpList.length} tujuan`}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-slate-600">Pengumpulan</span>{' '}
                    {t.jumlahPengumpulan ?? 0}
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link to={`/tugas/${t.id}`} className="lms-btn-secondary text-xs">
                    Buka
                  </Link>
                  <button
                    type="button"
                    className="lms-btn-ghost text-xs"
                    disabled={busy}
                    onClick={() => void onToggleAktif(t)}
                  >
                    {t.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    className="materi-btn-danger text-xs"
                    disabled={busy}
                    onClick={() => void onHapus(t)}
                  >
                    Hapus
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

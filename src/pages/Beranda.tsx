import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import { NAMA_PERAN } from '../lib/peran'

export default function Beranda() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))

  useEffect(() => {
    const dasar = daftarRuangKelas(profil)
    setRuang(dasar)
    if (!kelasWaliTanpaMapel(profil).length) return
    let batal = false
    ;(async () => {
      try {
        const mapel = await getDaftarMapel()
        if (!batal && mapel.length) setRuang(perluasDenganMapelMaster(profil, mapel))
      } catch {
        /* biarkan daftar dasar */
      }
    })()
    return () => {
      batal = true
    }
  }, [profil])

  const preview = ruang.slice(0, 4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-muh-900 tracking-tight">
          Assalamu&apos;alaikum, {profil?.nama?.split(' ')[0] || 'Bapak/Ibu'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Anda masuk sebagai <strong>{peran ? NAMA_PERAN[peran] : '—'}</strong>. Kelola materi dan
          tugas dari ruang kelas di bawah.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muh-800">Ruang kelas Anda</h2>
          {ruang.length > 0 && (
            <Link to="/kelas" className="text-xs font-medium text-muh-600 hover:underline">
              Lihat semua ({ruang.length})
            </Link>
          )}
        </div>

        {preview.length === 0 ? (
          <div className="card-soft flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted">
              Belum ada kelas/mapel yang terhubung. Pastikan penugasan mapel sudah diisi di aplikasi
              Penilaian (menu admin / kelola akun).
            </div>
            <Link
              to="/kelas"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-muh-700 hover:bg-muh-50"
            >
              Buka daftar kelas
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {preview.map((r) => (
              <Link
                key={r.id}
                to={`/kelas/${encodeURIComponent(r.id)}`}
                className="card-soft group flex flex-col gap-1.5 p-4 transition hover:border-muh-300 hover:shadow-sm"
              >
                <span className="inline-flex w-fit items-center rounded-md bg-muh-50 px-2 py-0.5 text-xs font-semibold text-muh-700">
                  Kelas {r.kelas}
                </span>
                <span className="text-sm font-semibold text-slate-900 group-hover:text-muh-800">
                  {r.mapel}
                </span>
                <span className="mt-auto pt-1 text-xs font-medium text-muh-600 opacity-0 transition group-hover:opacity-100">
                  Buka ruang kelas →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muh-800">Fitur pembelajaran</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/kelas"
            className="card-soft group flex gap-3 p-4 transition hover:border-muh-300 hover:shadow-sm"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg"
              aria-hidden
            >
              📚
            </span>
            <div>
              <div className="text-sm font-semibold text-muh-800 group-hover:text-muh-700">
                Materi pembelajaran
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Unggah PDF, gambar, video, atau tautan — hubungkan ke Tujuan Pembelajaran.
              </p>
            </div>
          </Link>
          <div className="card-soft flex gap-3 p-4 opacity-80">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg"
              aria-hidden
            >
              ✏️
            </span>
            <div>
              <div className="text-sm font-semibold text-muh-800">Tugas</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Segera — buat tugas, pantau pengumpulan, beri nilai dan komentar.
              </p>
            </div>
          </div>
          <div className="card-soft flex gap-3 p-4 opacity-80">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-lg"
              aria-hidden
            >
              🎯
            </span>
            <div>
              <div className="text-sm font-semibold text-muh-800">Kuis & asesmen</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Fase 2 — pilihan ganda, isian, timer, dan capaian per TP.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

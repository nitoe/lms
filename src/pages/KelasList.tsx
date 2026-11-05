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

const AKSEEN = [
  { bar: '#313083', chip: 'bg-muh-50 text-muh-700', soft: 'bg-[#eff0fa]' },
  { bar: '#0369a1', chip: 'bg-sky-50 text-sky-800', soft: 'bg-sky-50' },
  { bar: '#0f766e', chip: 'bg-teal-50 text-teal-800', soft: 'bg-teal-50' },
  { bar: '#a16207', chip: 'bg-amber-50 text-amber-900', soft: 'bg-amber-50' },
  { bar: '#9f1239', chip: 'bg-rose-50 text-rose-800', soft: 'bg-rose-50' },
  { bar: '#6d28d9', chip: 'bg-violet-50 text-violet-800', soft: 'bg-violet-50' },
  { bar: '#c2410c', chip: 'bg-orange-50 text-orange-900', soft: 'bg-orange-50' },
  { bar: '#15803d', chip: 'bg-green-50 text-green-800', soft: 'bg-green-50' },
]

function aksenMapel(nama: string) {
  let h = 0
  for (let i = 0; i < nama.length; i++) h = (h * 31 + nama.charCodeAt(i)) >>> 0
  return AKSEEN[h % AKSEEN.length]
}

function inisialMapel(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function KelasList() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))
  const [catatan, setCatatan] = useState('')

  useEffect(() => {
    const dasar = daftarRuangKelas(profil)
    setRuang(dasar)

    const waliKosong = kelasWaliTanpaMapel(profil)
    if (!waliKosong.length) {
      setCatatan('')
      return
    }

    let batal = false
    ;(async () => {
      try {
        const mapel = await getDaftarMapel()
        if (batal) return
        if (!mapel.length) {
          setCatatan(
            `Anda wali kelas ${waliKosong.join(', ')} tetapi belum ada penugasan mapel. ` +
              'Isi penugasan di aplikasi Penilaian, atau pastikan master mapel sudah ada.',
          )
          return
        }
        setRuang(perluasDenganMapelMaster(profil, mapel))
        setCatatan(
          `Sebagai wali ${waliKosong.join(', ')}, ditampilkan semua mata pelajaran agar Anda dapat mengelola materi per mapel.`,
        )
      } catch {
        if (!batal) {
          setCatatan(
            `Anda wali kelas ${waliKosong.join(', ')} tanpa penugasan mapel. Gagal memuat daftar mapel — coba muat ulang.`,
          )
        }
      }
    })()

    return () => {
      batal = true
    }
  }, [profil])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-muh-900">Ruang kelas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Setiap kartu = satu mata pelajaran di satu kelas. Materi dan TP terhubung ke mapel tersebut.
          </p>
        </div>
        {ruang.length > 0 && (
          <div className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted">
            <span className="tabular font-semibold text-muh-800">{ruang.length}</span> ruang
          </div>
        )}
      </div>

      {catatan && (
        <div className="rounded-lg border border-muh-100 bg-muh-50 px-3.5 py-2.5 text-sm text-muh-800">
          {catatan}
        </div>
      )}

      {ruang.length === 0 ? (
        <div className="card-soft p-6 text-sm text-muted">
          {peran === 'admin' ? (
            <>
              Akun admin belum memiliki penugasan mapel. Daftar ruang kelas diisi dari field{' '}
              <code className="rounded bg-surface-2 px-1 text-xs">penugasan</code> /{' '}
              <code className="rounded bg-surface-2 px-1 text-xs">waliKelas</code> di profil guru.
            </>
          ) : (
            <>
              Belum ada kelas atau mapel yang terhubung ke akun Anda. Pastikan penugasan mapel sudah
              diisi di aplikasi Penilaian (bukan hanya wali kelas).
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ruang.map((r) => {
            const a = aksenMapel(r.mapel)
            return (
              <Link
                key={r.id}
                to={`/kelas/${encodeURIComponent(r.id)}`}
                className="ruang-card group"
                style={{ ['--ruang-bar' as string]: a.bar }}
              >
                <div className="ruang-card-bar" aria-hidden />
                <div className="flex items-start gap-3 p-4">
                  <div
                    className={`ruang-card-icon ${a.soft}`}
                    style={{ color: a.bar }}
                    aria-hidden
                  >
                    {inisialMapel(r.mapel)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${a.chip}`}
                      >
                        Kelas {r.kelas}
                      </span>
                      {r.sebagaiWali && (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          Wali
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-muh-800">
                      {r.mapel}
                    </div>
                    <div className="mt-2 text-xs font-medium text-muh-600 opacity-0 transition group-hover:opacity-100">
                      Buka ruang kelas →
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

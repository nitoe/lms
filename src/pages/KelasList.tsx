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
      <div>
        <h1 className="text-xl font-semibold text-muh-900 tracking-tight">Ruang kelas</h1>
        <p className="mt-1 text-sm text-muted">
          Setiap kartu = satu mata pelajaran di satu kelas. Materi dan TP terhubung ke mapel tersebut.
        </p>
      </div>

      {catatan && (
        <div className="rounded-md border border-muh-100 bg-muh-50 px-3 py-2 text-sm text-muh-800">
          {catatan}
        </div>
      )}

      {ruang.length === 0 ? (
        <div className="card-soft p-6 text-sm text-muted">
          {peran === 'admin' ? (
            <>
              Akun admin belum memiliki penugasan mapel. Daftar ruang kelas diisi dari field{' '}
              <code className="text-xs bg-surface-2 px-1 rounded">penugasan</code> /{' '}
              <code className="text-xs bg-surface-2 px-1 rounded">waliKelas</code> di profil guru.
            </>
          ) : (
            <>
              Belum ada kelas atau mapel yang terhubung ke akun Anda.
              Pastikan penugasan mapel sudah diisi di aplikasi Penilaian (bukan hanya wali kelas).
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ruang.map((r) => (
            <Link
              key={r.id}
              to={`/kelas/${encodeURIComponent(r.id)}`}
              className="card-soft group flex flex-col gap-2 p-4 transition hover:border-muh-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center rounded-md bg-muh-50 px-2 py-0.5 text-xs font-semibold text-muh-700">
                  Kelas {r.kelas}
                </span>
                {r.sebagaiWali && (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                    Wali
                  </span>
                )}
              </div>
              <div className="text-[15px] font-semibold text-slate-900 leading-snug group-hover:text-muh-800">
                {r.mapel}
              </div>
              <div className="mt-auto pt-1 text-xs font-medium text-muh-600 opacity-0 transition group-hover:opacity-100">
                Buka ruang kelas →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

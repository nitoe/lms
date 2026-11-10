import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RuangCard, { type RingkasRuang } from '../components/RuangCard'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import { daftarTugasGuru, formatTenggat } from '../lib/tugas'
import { daftarKuis } from '../lib/kuis'
import type { TugasLms } from '../types/tugas'
import type { KuisLms } from '../types/kuis'

type ItemAktif = {
  id: string
  jenis: 'tugas' | 'kuis'
  judul: string
  kelas: string
  mapel: string
  /** Label samping (tenggat / status) */
  keterangan: string
  href: string
}

function kunciRuang(kelas: string, mapel: string): string {
  return `${String(kelas).toUpperCase()}::${mapel}`
}

export default function KelasList() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))
  const [catatanWali, setCatatanWali] = useState('')
  const [q, setQ] = useState('')
  const [filterKelas, setFilterKelas] = useState('')

  const [ringkasPerRuang, setRingkasPerRuang] = useState<Record<string, RingkasRuang>>({})
  const [itemAktif, setItemAktif] = useState<ItemAktif[] | null>(null)
  const [muatMonitor, setMuatMonitor] = useState(false)
  const [errorMonitor, setErrorMonitor] = useState('')

  useEffect(() => {
    const dasar = daftarRuangKelas(profil)
    setRuang(dasar)

    const waliKosong = kelasWaliTanpaMapel(profil)
    if (!waliKosong.length) {
      setCatatanWali('')
      return
    }

    let batal = false
    ;(async () => {
      try {
        const mapel = await getDaftarMapel()
        if (batal) return
        if (!mapel.length) {
          setCatatanWali(
            `Wali ${waliKosong.join(', ')}: belum ada penugasan mapel — isi di aplikasi Penilaian.`,
          )
          return
        }
        setRuang(perluasDenganMapelMaster(profil, mapel))
        setCatatanWali(
          `Wali ${waliKosong.join(', ')}: semua mapel ditampilkan agar materi per mapel dapat dikelola.`,
        )
      } catch {
        if (!batal) {
          setCatatanWali(
            `Wali ${waliKosong.join(', ')}: gagal memuat daftar mapel — coba muat ulang.`,
          )
        }
      }
    })()

    return () => {
      batal = true
    }
  }, [profil])

  const muatRingkasan = useCallback(async () => {
    if (!ruang.length) {
      setRingkasPerRuang({})
      setItemAktif([])
      return
    }
    setMuatMonitor(true)
    setErrorMonitor('')
    try {
      const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'
      const tugasList = await daftarTugasGuru(ruang, { sebagaiAdmin }).catch((e) => {
        console.warn('monitor tugas', e)
        return [] as TugasLms[]
      })

      // Kuis per pasangan unik (paralel, toleran gagal)
      const pasangan = new Map<string, { kelas: string; mapel: string }>()
      for (const r of ruang) {
        const k = kunciRuang(r.kelas, r.mapel)
        if (!pasangan.has(k)) pasangan.set(k, { kelas: r.kelas, mapel: r.mapel })
      }
      const kuisPerPasangan = await Promise.all(
        [...pasangan.values()].map(async ({ kelas, mapel }) => {
          try {
            const list = await daftarKuis(kelas, mapel)
            return { kelas, mapel, list }
          } catch (e) {
            console.warn('monitor kuis', kelas, mapel, e)
            return { kelas, mapel, list: [] as KuisLms[] }
          }
        }),
      )

      const hitung: Record<string, RingkasRuang> = {}
      for (const r of ruang) {
        hitung[kunciRuang(r.kelas, r.mapel)] = { tugasAktif: 0, kuisAktif: 0 }
      }

      const aktif: ItemAktif[] = []

      for (const t of tugasList) {
        if (!t.aktif) continue
        const k = kunciRuang(t.kelas, t.mapel)
        if (!hitung[k]) hitung[k] = { tugasAktif: 0, kuisAktif: 0 }
        hitung[k].tugasAktif += 1
        aktif.push({
          id: `tugas:${t.id}`,
          jenis: 'tugas',
          judul: t.judul,
          kelas: t.kelas,
          mapel: t.mapel,
          keterangan: t.tenggat ? `Tenggat ${formatTenggat(t.tenggat)}` : 'Aktif',
          href: `/tugas/${t.id}`,
        })
      }

      for (const { kelas, mapel, list } of kuisPerPasangan) {
        const k = kunciRuang(kelas, mapel)
        if (!hitung[k]) hitung[k] = { tugasAktif: 0, kuisAktif: 0 }
        for (const qz of list) {
          if (!qz.aktif) continue
          hitung[k].kuisAktif += 1
          aktif.push({
            id: `kuis:${qz.id}`,
            jenis: 'kuis',
            judul: qz.judul,
            kelas: qz.kelas,
            mapel: qz.mapel,
            keterangan: qz.modePelaksanaan === 'offline' ? 'Offline · aktif' : 'Online · aktif',
            href: `/kelas/${encodeURIComponent(`${String(kelas).toUpperCase()}--${mapel.replace(/\s+/g, '_')}`)}?tab=kuis`,
          })
        }
      }

      // Urut: tugas dulu, lalu kuis; di dalam jenis by kelas/mapel
      aktif.sort((a, b) => {
        if (a.jenis !== b.jenis) return a.jenis === 'tugas' ? -1 : 1
        const c = a.kelas.localeCompare(b.kelas, 'id')
        if (c !== 0) return c
        return a.mapel.localeCompare(b.mapel, 'id')
      })

      setRingkasPerRuang(hitung)
      setItemAktif(aktif)
    } catch (e) {
      setErrorMonitor(e instanceof Error ? e.message : 'Gagal memuat ringkasan tugas/kuis.')
      setItemAktif([])
    } finally {
      setMuatMonitor(false)
    }
  }, [ruang, profil])

  useEffect(() => {
    void muatRingkasan()
  }, [muatRingkasan])

  const daftarKelasUnik = useMemo(() => {
    return [...new Set(ruang.map((r) => r.kelas))].sort()
  }, [ruang])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return ruang.filter((r) => {
      if (filterKelas && r.kelas !== filterKelas) return false
      if (!s) return true
      return r.mapel.toLowerCase().includes(s) || r.kelas.toLowerCase().includes(s)
    })
  }, [ruang, q, filterKelas])

  const totalTugasAktif = useMemo(
    () => Object.values(ringkasPerRuang).reduce((s, x) => s + x.tugasAktif, 0),
    [ringkasPerRuang],
  )
  const totalKuisAktif = useMemo(
    () => Object.values(ringkasPerRuang).reduce((s, x) => s + x.kuisAktif, 0),
    [ringkasPerRuang],
  )

  const itemAktifFilter = useMemo(() => {
    if (!itemAktif) return null
    if (!filterKelas) return itemAktif
    return itemAktif.filter((i) => i.kelas === filterKelas)
  }, [itemAktif, filterKelas])

  return (
    <div className="space-y-5">
      {/* Monitor penugasan aktif — mengganti intro generik */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Penugasan aktif</h2>
            <p className="mt-0.5 text-xs text-muted">
              Tugas dan kuis yang masih aktif di ruang Anda — pantau dari sini.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
              {muatMonitor ? '…' : totalTugasAktif} tugas aktif
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200/80">
              {muatMonitor ? '…' : totalKuisAktif} kuis aktif
            </span>
            <button
              type="button"
              className="lms-btn-secondary text-xs"
              disabled={muatMonitor}
              onClick={() => void muatRingkasan()}
            >
              {muatMonitor ? 'Memuat…' : 'Muat ulang'}
            </button>
          </div>
        </div>

        {errorMonitor && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
            {errorMonitor}
          </div>
        )}

        {muatMonitor && itemAktif === null && (
          <p className="px-4 py-4 text-sm text-muted">Memuat daftar penugasan aktif…</p>
        )}

        {!muatMonitor && itemAktifFilter && itemAktifFilter.length === 0 && (
          <div className="px-4 py-4 text-sm text-muted">
            Belum ada tugas atau kuis aktif
            {filterKelas ? ` di kelas ${filterKelas}` : ''}.{' '}
            <Link to="/tugas" className="font-medium text-muh-800 underline-offset-2 hover:underline">
              Buat tugas
            </Link>
            {' · '}
            buka kartu mapel untuk mengelola kuis.
          </div>
        )}

        {itemAktifFilter && itemAktifFilter.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {itemAktifFilter.slice(0, 12).map((item) => (
              <li key={item.id}>
                <Link
                  to={item.href}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm transition hover:bg-slate-50"
                >
                  <span
                    className={
                      item.jenis === 'tugas'
                        ? 'w-14 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-amber-900'
                        : 'w-14 shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-sky-900'
                    }
                  >
                    {item.jenis === 'tugas' ? 'Tugas' : 'Kuis'}
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-slate-800">{item.judul}</span>
                  <span className="text-xs text-muted">
                    {item.mapel} · {item.kelas}
                  </span>
                  <span className="text-xs text-slate-500">{item.keterangan}</span>
                </Link>
              </li>
            ))}
            {itemAktifFilter.length > 12 && (
              <li className="px-4 py-2 text-xs text-muted">
                +{itemAktifFilter.length - 12} penugasan aktif lainnya — lihat per kartu mapel di
                bawah.
              </li>
            )}
          </ul>
        )}

        {catatanWali && (
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-muted">{catatanWali}</div>
        )}
      </div>

      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="lms-count-pill">{filtered.length} ruang</span>
          {daftarKelasUnik.length > 1 && (
            <div className="lms-filter-chips">
              <button
                type="button"
                className={`lms-filter-chip ${!filterKelas ? 'lms-filter-chip--on' : ''}`}
                onClick={() => setFilterKelas('')}
              >
                Semua
              </button>
              {daftarKelasUnik.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`lms-filter-chip ${filterKelas === k ? 'lms-filter-chip--on' : ''}`}
                  onClick={() => setFilterKelas(k === filterKelas ? '' : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lms-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            type="search"
            placeholder="Cari mapel atau kelas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari ruang kelas"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="lms-empty">
          {q || filterKelas ? (
            <p>Tidak ada ruang yang cocok dengan filter saat ini.</p>
          ) : peran === 'admin' ? (
            <p>
              Akun admin belum memiliki penugasan mapel. Daftar diisi dari field{' '}
              <code className="rounded bg-surface-2 px-1 text-xs">penugasan</code> /{' '}
              <code className="rounded bg-surface-2 px-1 text-xs">waliKelas</code> di profil guru.
            </p>
          ) : (
            <p>
              Belum ada kelas atau mapel yang terhubung. Pastikan penugasan mapel sudah diisi di
              aplikasi Penilaian.
            </p>
          )}
        </div>
      ) : (
        <div className="lms-card-grid">
          {filtered.map((r) => (
            <RuangCard
              key={r.id}
              ruang={r}
              ringkas={ringkasPerRuang[kunciRuang(r.kelas, r.mapel)]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

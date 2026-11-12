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
import '../styles/kelas.css'

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

  const totalRuang = ruang.length
  const nKelas = daftarKelasUnik.length

  return (
    <div className="rk-halaman">
      <header className="rk-kepala">
        <div className="rk-kepala-teks">
          <h2 className="rk-judul-halaman">Ruang kelas</h2>
          <p className="rk-sub">
            Pilih ruang mapel untuk mengelola materi, kuis, dan bank soal. Pantau tugas serta kuis
            aktif di strip di bawah.
          </p>
        </div>
      </header>

      {totalRuang > 0 && (
        <section className="rk-ringkas" aria-label="Ringkasan ruang">
          <div className="rk-ringkas-item">
            <b>{totalRuang}</b>
            <span>Ruang</span>
          </div>
          <div className="rk-ringkas-item rk-ringkas-item--ungu">
            <b>{nKelas}</b>
            <span>Kelas</span>
          </div>
          <div className="rk-ringkas-item rk-ringkas-item--kuning">
            <b>{muatMonitor ? '…' : totalTugasAktif}</b>
            <span>Tugas aktif</span>
          </div>
          <div className="rk-ringkas-item rk-ringkas-item--sky">
            <b>{muatMonitor ? '…' : totalKuisAktif}</b>
            <span>Kuis aktif</span>
          </div>
        </section>
      )}

      {/* Monitor penugasan aktif */}
      <section className="rk-monitor" aria-label="Penugasan aktif">
        <div className="rk-monitor-kepala">
          <div>
            <h3 className="rk-monitor-judul">Penugasan aktif</h3>
            <p className="rk-monitor-sub">
              Tugas dan kuis yang masih aktif di ruang Anda
              {filterKelas ? ` · filter kelas ${filterKelas}` : ''}.
            </p>
          </div>
          <button
            type="button"
            className="rk-btn"
            disabled={muatMonitor}
            onClick={() => void muatRingkasan()}
          >
            {muatMonitor ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>

        {errorMonitor && (
          <div className="rk-galat" role="alert">
            {errorMonitor}
          </div>
        )}

        {muatMonitor && itemAktif === null && (
          <div className="rk-monitor-kosong" aria-busy="true">
            Memuat daftar penugasan aktif…
          </div>
        )}

        {!muatMonitor && itemAktifFilter && itemAktifFilter.length === 0 && (
          <div className="rk-monitor-kosong">
            Belum ada tugas atau kuis aktif
            {filterKelas ? ` di kelas ${filterKelas}` : ''}.{' '}
            <Link to="/tugas" className="rk-tautan">
              Buat tugas
            </Link>
            {' · '}
            buka kartu mapel untuk mengelola kuis.
          </div>
        )}

        {itemAktifFilter && itemAktifFilter.length > 0 && (
          <ul className="rk-monitor-list">
            {itemAktifFilter.slice(0, 12).map((item) => (
              <li key={item.id}>
                <Link to={item.href} className="rk-monitor-item">
                  <span
                    className={
                      item.jenis === 'tugas' ? 'rk-badge rk-badge--tugas' : 'rk-badge rk-badge--kuis'
                    }
                  >
                    {item.jenis === 'tugas' ? 'Tugas' : 'Kuis'}
                  </span>
                  <span className="rk-monitor-judul-item">{item.judul}</span>
                  <span className="rk-monitor-meta">
                    {item.mapel} · {item.kelas}
                  </span>
                  <span className="rk-monitor-ket">{item.keterangan}</span>
                </Link>
              </li>
            ))}
            {itemAktifFilter.length > 12 && (
              <li className="rk-monitor-lebih">
                +{itemAktifFilter.length - 12} penugasan aktif lainnya — lihat per kartu mapel di
                bawah.
              </li>
            )}
          </ul>
        )}

        {catatanWali && <div className="rk-catatan">{catatanWali}</div>}
      </section>

      {/* Alat: filter + cari */}
      {totalRuang > 0 && (
        <section className="rk-alat" aria-label="Cari dan saring ruang">
          <div className="rk-cari">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Cari mapel atau kelas…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari ruang kelas"
            />
          </div>
          {daftarKelasUnik.length > 1 && (
            <div className="rk-filter" role="group" aria-label="Filter kelas">
              <span className="rk-filter-label">Kelas</span>
              <button
                type="button"
                className={`rk-seg${!filterKelas ? ' rk-seg--on' : ''}`}
                aria-pressed={!filterKelas}
                onClick={() => setFilterKelas('')}
              >
                Semua
              </button>
              {daftarKelasUnik.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`rk-seg${filterKelas === k ? ' rk-seg--on' : ''}`}
                  aria-pressed={filterKelas === k}
                  onClick={() => setFilterKelas(k === filterKelas ? '' : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
          <span className="rk-jumlah" aria-live="polite">
            {filtered.length} ruang
          </span>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="rk-kosong">
          {q || filterKelas ? (
            <>
              <b>Tidak ada ruang yang cocok</b>
              <p>Ubah kata kunci atau filter kelas yang sedang dipakai.</p>
              <button
                type="button"
                className="rk-btn rk-btn--utama"
                onClick={() => {
                  setQ('')
                  setFilterKelas('')
                }}
              >
                Reset saringan
              </button>
            </>
          ) : peran === 'admin' ? (
            <>
              <b>Belum ada ruang</b>
              <p>
                Akun admin belum memiliki penugasan mapel. Daftar diisi dari field penugasan /
                waliKelas di profil guru.
              </p>
            </>
          ) : (
            <>
              <b>Belum ada ruang</b>
              <p>
                Belum ada kelas atau mapel yang terhubung. Pastikan penugasan mapel sudah diisi di
                aplikasi Penilaian.
              </p>
            </>
          )}
        </div>
      ) : (
        <ul className="rk-grid">
          {filtered.map((r) => (
            <li key={r.id}>
              <RuangCard
                ruang={r}
                ringkas={ringkasPerRuang[kunciRuang(r.kelas, r.mapel)]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

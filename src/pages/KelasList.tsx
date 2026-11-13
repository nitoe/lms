import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RuangCard from '../components/RuangCard'
import {
  IkonCari,
  IkonJam,
  IkonKuis,
  IkonRefresh,
  IkonRuang,
  IkonTugas,
} from '../components/ikonRuang'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import { kunciRuang, urutkanAgenda, useRingkasanRuang } from '../lib/ringkasanRuang'
import { infoTenggat } from '../lib/tugasUi'
import '../styles/ruang.css'

const JUMLAH_AGENDA_AWAL = 6

export default function KelasList() {
  const { profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))
  const [catatanWali, setCatatanWali] = useState('')
  const [q, setQ] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [agendaPenuh, setAgendaPenuh] = useState(false)

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

  const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'
  const { ringkas, aktif, memuat, error, muat } = useRingkasanRuang(ruang, sebagaiAdmin)

  const sekarang = useMemo(() => new Date(), [aktif])

  const daftarKelasUnik = useMemo(
    () => [...new Set(ruang.map((r) => r.kelas))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })),
    [ruang],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return ruang.filter((r) => {
      if (filterKelas && r.kelas !== filterKelas) return false
      if (!s) return true
      return r.mapel.toLowerCase().includes(s) || r.kelas.toLowerCase().includes(s)
    })
  }, [ruang, q, filterKelas])

  /** Kelompok per kelas mengikuti urutan `ruang` (sudah terurut kelas → mapel). */
  const kelompok = useMemo(() => {
    const peta = new Map<string, RuangKelas[]>()
    for (const r of filtered) {
      const l = peta.get(r.kelas)
      if (l) l.push(r)
      else peta.set(r.kelas, [r])
    }
    return [...peta.entries()]
  }, [filtered])

  const totalTugasAktif = aktif ? aktif.filter((i) => i.jenis === 'tugas').length : null
  const totalKuisAktif = aktif ? aktif.filter((i) => i.jenis === 'kuis').length : null

  const agenda = useMemo(() => {
    if (!aktif) return null
    const rows = filterKelas ? aktif.filter((i) => i.kelas === filterKelas) : aktif
    return urutkanAgenda(rows, sekarang)
  }, [aktif, filterKelas, sekarang])

  const agendaTampil = agenda ? (agendaPenuh ? agenda : agenda.slice(0, JUMLAH_AGENDA_AWAL)) : []
  const bergrup = daftarKelasUnik.length > 1

  return (
    <div className="rg-halaman">
      <header className="rg-kepala">
        <div>
          <h2 className="rg-judul">Ruang Kelas</h2>
          <p className="rg-sub">
            Pilih ruang untuk mengelola materi, kuis, dan bank soal. Tugas dikelola di menu Tugas.
          </p>
        </div>
        <Link to="/tugas" className="rg-btn">
          Buka katalog Tugas
        </Link>
      </header>

      {/* Penugasan aktif */}
      <section className="rg-panel" aria-label="Penugasan aktif">
        <div className="rg-panel-kepala">
          <div>
            <h3 className="rg-panel-judul">Penugasan aktif</h3>
            <p className="rg-panel-sub">
              Diurutkan menurut tenggat terdekat{filterKelas ? ` · kelas ${filterKelas}` : ''}.
            </p>
          </div>
          <div className="rg-panel-aksi">
            <span className="rg-pill rg-pill--tugas">{totalTugasAktif ?? '…'} tugas</span>
            <span className="rg-pill rg-pill--kuis">{totalKuisAktif ?? '…'} kuis</span>
            <button
              type="button"
              className="rg-btn"
              disabled={memuat}
              onClick={() => void muat()}
              aria-label="Muat ulang penugasan aktif"
            >
              <IkonRefresh />
              {memuat ? 'Memuat…' : 'Muat ulang'}
            </button>
          </div>
        </div>

        {error && (
          <p className="rg-galat" role="alert">
            {error}
          </p>
        )}

        {agenda === null && (
          <div aria-busy="true" aria-label="Memuat penugasan aktif">
            <div className="rg-baris-skel" />
            <div className="rg-baris-skel" />
          </div>
        )}

        {agenda && agenda.length === 0 && (
          <p className="rg-kosong-baris">
            Belum ada tugas atau kuis aktif{filterKelas ? ` di kelas ${filterKelas}` : ''}.{' '}
            <Link to="/tugas/baru">Buat tugas</Link> · buka kartu mapel untuk mengelola kuis.
          </p>
        )}

        {agenda && agenda.length > 0 && (
          <ul className="rg-agenda">
            {agendaTampil.map((item) => {
              const info = item.jenis === 'tugas' ? infoTenggat(item.tenggat, sekarang) : null
              return (
                <li key={item.id}>
                  <Link to={item.href} className="rg-agenda-item">
                    <span className={`rg-jenis rg-jenis--${item.jenis}`} aria-hidden="true">
                      {item.jenis === 'tugas' ? <IkonTugas size={17} /> : <IkonKuis size={17} />}
                    </span>
                    <span className="min-w-0">
                      <span className="rg-agenda-judul">{item.judul}</span>
                      <span className="rg-agenda-meta">
                        {item.jenis === 'tugas' ? 'Tugas' : 'Kuis'} · {item.mapel} · {item.kelas}
                      </span>
                    </span>
                    {info ? (
                      <span className={`rg-nada rg-nada--${info.nada}`} title={info.tanggal || undefined}>
                        {info.nada !== 'tanpa' && <IkonJam />}
                        {info.label}
                      </span>
                    ) : (
                      <span className="rg-nada rg-nada--kuis">{item.mode}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {agenda && agenda.length > JUMLAH_AGENDA_AWAL && (
          <div className="rg-panel-kaki">
            <button
              type="button"
              className="rg-link rg-link--tombol"
              onClick={() => setAgendaPenuh((v) => !v)}
              aria-expanded={agendaPenuh}
            >
              {agendaPenuh
                ? 'Ringkas daftar'
                : `Tampilkan ${agenda.length - JUMLAH_AGENDA_AWAL} penugasan lainnya`}
            </button>
          </div>
        )}

        {catatanWali && <div className="rg-panel-kaki">{catatanWali}</div>}
      </section>

      {/* Cari & saring */}
      <div className="rg-seksi-kepala">
        <h3 className="rg-seksi-judul">Semua ruang</h3>
        <span className="rg-jumlah">{filtered.length} ruang</span>
        {daftarKelasUnik.length > 1 && (
          <div className="rg-filter" role="group" aria-label="Saring kelas">
            <button
              type="button"
              className={`rg-seg${!filterKelas ? ' rg-seg--on' : ''}`}
              aria-pressed={!filterKelas}
              onClick={() => setFilterKelas('')}
            >
              Semua
            </button>
            {daftarKelasUnik.map((k) => (
              <button
                key={k}
                type="button"
                className={`rg-seg${filterKelas === k ? ' rg-seg--on' : ''}`}
                aria-pressed={filterKelas === k}
                onClick={() => setFilterKelas(k === filterKelas ? '' : k)}
              >
                {k}
              </button>
            ))}
          </div>
        )}
        <span className="rg-spasi" />
        <div className="rg-cari">
          <IkonCari />
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
        <div className="rg-kosong">
          <span className="rg-kosong-ikon">
            <IkonRuang size={22} />
          </span>
          {q || filterKelas ? (
            <>
              <b>Tidak ada ruang yang cocok</b>
              <p>Ubah kata kunci atau saringan kelas yang sedang dipakai.</p>
              <button
                type="button"
                className="rg-btn"
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
              <b>Belum ada penugasan</b>
              <p>
                Akun admin belum memiliki penugasan mapel. Daftar diisi dari field{' '}
                <code>penugasan</code> / <code>waliKelas</code> di profil guru.
              </p>
            </>
          ) : (
            <>
              <b>Belum ada ruang kelas</b>
              <p>
                Belum ada kelas atau mapel yang terhubung. Pastikan penugasan mapel sudah diisi di
                aplikasi Penilaian.
              </p>
            </>
          )}
        </div>
      ) : (
        kelompok.map(([kelas, rows]) => (
          <section key={kelas} className="rg-kelompok" aria-label={`Kelas ${kelas}`}>
            {bergrup && (
              <div className="rg-kelompok-kepala">
                <h4 className="rg-kelompok-judul">Kelas {kelas}</h4>
                {rows.some((r) => r.sebagaiWali) && <span className="rg-badge-wali">Wali kelas</span>}
                <span className="rg-kelompok-n">{rows.length} mapel</span>
                <span className="rg-kelompok-garis" />
              </div>
            )}
            <ul className="rg-grid">
              {rows.map((r) => (
                <li key={r.id}>
                  <RuangCard
                    ruang={r}
                    ringkas={
                      aktif
                        ? (ringkas[kunciRuang(r.kelas, r.mapel)] ?? { tugasAktif: 0, kuisAktif: 0 })
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

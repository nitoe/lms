import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RuangCard from '../components/RuangCard'
import {
  IkonCari,
  IkonJam,
  IkonKuis,
  IkonPanah,
  IkonPlus,
  IkonRekap,
  IkonRuang,
  IkonTka,
  IkonTugas,
} from '../components/ikonRuang'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
  type RuangKelas,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import { NAMA_PERAN } from '../lib/peran'
import { kunciRuang, urutkanAgenda, useRingkasanRuang } from '../lib/ringkasanRuang'
import { bolehAksesTkaStaf } from '../lib/tkaAkses'
import { infoTenggat } from '../lib/tugasUi'
import '../styles/ruang.css'

const JUMLAH_RUANG_PREVIEW = 8
const JUMLAH_AGENDA = 5

function salamWaktu(d: Date): string {
  const j = d.getHours()
  if (j < 11) return 'Selamat pagi'
  if (j < 15) return 'Selamat siang'
  if (j < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export default function Beranda() {
  const { user, profil, peran } = useAuth()
  const [ruang, setRuang] = useState<RuangKelas[]>(() => daftarRuangKelas(profil))
  const [q, setQ] = useState('')

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

  const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'
  const { ringkas, aktif, memuat, error } = useRingkasanRuang(ruang, sebagaiAdmin)

  const sekarang = useMemo(() => new Date(), [aktif])
  const agenda = useMemo(() => (aktif ? urutkanAgenda(aktif, sekarang) : null), [aktif, sekarang])
  const nTugas = aktif ? aktif.filter((i) => i.jenis === 'tugas').length : null
  const nKuis = aktif ? aktif.filter((i) => i.jenis === 'kuis').length : null

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return ruang
    return ruang.filter(
      (r) => r.mapel.toLowerCase().includes(s) || r.kelas.toLowerCase().includes(s),
    )
  }, [ruang, q])

  const preview = filtered.slice(0, JUMLAH_RUANG_PREVIEW)
  const namaPanggil = profil?.nama?.split(' ')[0] || 'Bapak/Ibu'
  const jumlahKelasUnik = new Set(ruang.map((r) => r.kelas)).size
  const tanggal = sekarang.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const bolehTka = bolehAksesTkaStaf(user, profil)

  return (
    <div className="rg-halaman">
      {/* Hero */}
      <section className="rg-hero" aria-label="Selamat datang">
        <div className="rg-hero-teks">
          <p className="rg-hero-salam">
            {salamWaktu(sekarang)} · Assalamu&apos;alaikum
          </p>
          <h2 className="rg-hero-nama">{namaPanggil}</h2>
          <p className="rg-hero-info">
            <span className="rg-hero-chip">{peran ? NAMA_PERAN[peran] : 'Pengguna'}</span>
            <span className="rg-hero-chip">{tanggal}</span>
          </p>
        </div>
        <div className="rg-hero-stats">
          <Link to="/kelas" className="rg-hero-stat">
            <b>{ruang.length}</b>
            <span>Ruang</span>
          </Link>
          <div className="rg-hero-stat">
            <b>{jumlahKelasUnik}</b>
            <span>Kelas</span>
          </div>
          <Link to="/tugas" className="rg-hero-stat">
            <b>{nTugas ?? '…'}</b>
            <span>Tugas aktif</span>
          </Link>
          <Link to="/kelas" className="rg-hero-stat">
            <b>{nKuis ?? '…'}</b>
            <span>Kuis aktif</span>
          </Link>
        </div>
      </section>

      <div className="rg-bgrid">
        {/* Ruang kelas */}
        <section className="rg-utama" aria-label="Ruang kelas Anda">
          <div className="rg-seksi-kepala">
            <h3 className="rg-seksi-judul">Ruang kelas Anda</h3>
            <span className="rg-jumlah">{filtered.length} ruang</span>
            <span className="rg-spasi" />
            {ruang.length > 0 && (
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
            )}
          </div>

          {preview.length === 0 ? (
            <div className="rg-kosong">
              <span className="rg-kosong-ikon">
                <IkonRuang size={22} />
              </span>
              {q ? (
                <>
                  <b>Tidak ada ruang yang cocok</b>
                  <p>Tidak ada ruang untuk &ldquo;{q}&rdquo;. Coba kata kunci lain.</p>
                </>
              ) : (
                <>
                  <b>Belum ada ruang kelas</b>
                  <p>
                    Belum ada kelas/mapel yang terhubung. Pastikan penugasan mapel sudah diisi di
                    aplikasi Penilaian.
                  </p>
                  <Link to="/kelas" className="rg-btn rg-btn--utama">
                    Buka daftar kelas
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className="rg-grid">
              {preview.map((r) => (
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
          )}

          {filtered.length > JUMLAH_RUANG_PREVIEW && (
            <Link to="/kelas" className="rg-link">
              Lihat semua {filtered.length} ruang
              <IkonPanah size={13} />
            </Link>
          )}
        </section>

        {/* Aside: agenda + pintasan */}
        <aside className="rg-aside" aria-label="Agenda dan pintasan">
          <section className="rg-panel">
            <div className="rg-panel-kepala">
              <div>
                <h3 className="rg-panel-judul">Agenda penugasan</h3>
                <p className="rg-panel-sub">Tugas &amp; kuis yang sedang aktif</p>
              </div>
              {agenda && agenda.length > 0 && (
                <span className="rg-pill rg-pill--netral">{agenda.length}</span>
              )}
            </div>

            {error && (
              <p className="rg-galat" role="alert">
                {error}
              </p>
            )}

            {agenda === null && memuat && (
              <div aria-busy="true" aria-label="Memuat agenda">
                <div className="rg-baris-skel" />
                <div className="rg-baris-skel" />
                <div className="rg-baris-skel" />
              </div>
            )}

            {agenda && agenda.length === 0 && (
              <p className="rg-kosong-baris">
                Belum ada tugas atau kuis aktif.{' '}
                <Link to="/tugas/baru">Buat tugas baru</Link>
              </p>
            )}

            {agenda && agenda.length > 0 && (
              <ul className="rg-agenda">
                {agenda.slice(0, JUMLAH_AGENDA).map((item) => {
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
                          <span
                            className={`rg-nada rg-nada--${info.nada}`}
                            title={info.tanggal || undefined}
                          >
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

            {agenda && agenda.length > 0 && (
              <div className="rg-panel-kaki">
                <Link to="/tugas" className="rg-link">
                  {agenda.length > JUMLAH_AGENDA
                    ? `Lihat semua (${agenda.length}) di Tugas`
                    : 'Buka katalog Tugas'}
                  <IkonPanah size={13} />
                </Link>
              </div>
            )}
          </section>

          <section className="rg-panel">
            <div className="rg-panel-kepala">
              <h3 className="rg-panel-judul">Pintasan</h3>
            </div>
            <div className="rg-pintas">
              <Link to="/tugas/baru" className="rg-pintas-item">
                <span className="rg-pintas-ikon rg-pintas-ikon--kuning">
                  <IkonPlus size={16} />
                </span>
                <span>
                  <b>Tugas baru</b>
                  <span className="rg-pintas-ket">Buat penugasan</span>
                </span>
              </Link>
              <Link to="/kelas" className="rg-pintas-item">
                <span className="rg-pintas-ikon rg-pintas-ikon--ungu">
                  <IkonRuang size={17} />
                </span>
                <span>
                  <b>Ruang kelas</b>
                  <span className="rg-pintas-ket">Materi, kuis, bank soal</span>
                </span>
              </Link>
              <Link to="/rekap-nilai" className="rg-pintas-item">
                <span className="rg-pintas-ikon rg-pintas-ikon--teal">
                  <IkonRekap size={17} />
                </span>
                <span>
                  <b>Rekap nilai</b>
                  <span className="rg-pintas-ket">Nilai per siswa</span>
                </span>
              </Link>
              {bolehTka && (
                <Link to="/tka" className="rg-pintas-item">
                  <span className="rg-pintas-ikon rg-pintas-ikon--biru">
                    <IkonTka size={17} />
                  </span>
                  <span>
                    <b>TKA</b>
                    <span className="rg-pintas-ket">Try out kelas 6</span>
                  </span>
                </Link>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

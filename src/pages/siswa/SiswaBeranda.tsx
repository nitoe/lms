import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { bolehTkaSiswa } from '../../lib/tkaAkses'
import { aksenMapel, inisialMapel } from '../../lib/uiAksen'
import { formatTenggatRelatif, tenggatMs, type TugasSiswaRingkas } from '../../lib/tugasSiswa'
import SiswaIcon, { type SiswaIconName } from './SiswaIcon'
import type { SiswaTone } from './SiswaLayout'
import { useBerandaSiswa } from './useBerandaSiswa'
import { useLombaSiswa } from './useLombaSiswa'

type MenuItem = {
  to: string
  label: string
  deskripsi: string
  icon: SiswaIconName
  tone: SiswaTone
  segera: boolean
}

/** Menu utama beranda siswa — ubin berwarna, ikon jelas, target sentuh besar. */
const MENU: MenuItem[] = [
  { to: '/siswa/materi', label: 'Materi', deskripsi: 'Baca & tonton pelajaran', icon: 'book', tone: 'sky', segera: false },
  { to: '/siswa/tugas', label: 'Tugas', deskripsi: 'Kerjakan & kumpulkan', icon: 'pencil', tone: 'amber', segera: false },
  { to: '/siswa/kuis', label: 'Kuis', deskripsi: 'Latihan soal', icon: 'target', tone: 'violet', segera: false },
  { to: '/siswa/pencapaian', label: 'Pencapaian', deskripsi: 'Bintang & lencana', icon: 'star', tone: 'emerald', segera: true },
]

const MENU_TKA: MenuItem = {
  to: '/siswa/tka',
  label: 'TKA',
  deskripsi: 'Try out & latihan TKA',
  icon: 'tka',
  tone: 'rose',
  segera: false,
}

/** Kartu Lomba: hanya untuk siswa yang terdaftar di ≥1 lomba (ANTIREGRESI §Lomba.20). */
const MENU_LOMBA: MenuItem = {
  to: '/siswa/lomba',
  label: 'Lomba',
  deskripsi: 'Materi & latihan lombamu',
  icon: 'lomba',
  tone: 'orange',
  segera: false,
}

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const HARI_MS = 24 * 60 * 60 * 1000

function sapaanWaktu(): string {
  const jam = new Date().getHours()
  if (jam < 11) return 'Selamat pagi'
  if (jam < 15) return 'Selamat siang'
  if (jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function awalHari(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Tujuh hari pekan berjalan (Senin–Minggu) + tanda tenggat tugas yang belum dinilai. */
function susunPekan(tugas: TugasSiswaRingkas[]) {
  const hariIni = awalHari(Date.now())
  const dow = new Date(hariIni).getDay() // 0 = Minggu
  const senin = hariIni - ((dow + 6) % 7) * HARI_MS
  const tenggatHari = new Map<number, number>()
  for (const r of tugas) {
    if (r.status === 'dinilai') continue
    const ms = tenggatMs(r.tugas.tenggat)
    if (!ms) continue
    const k = awalHari(ms)
    tenggatHari.set(k, (tenggatHari.get(k) ?? 0) + 1)
  }
  return Array.from({ length: 7 }, (_, i) => {
    const ms = senin + i * HARI_MS
    return {
      ms,
      singkat: HARI_SINGKAT[new Date(ms).getDay()],
      tanggal: new Date(ms).getDate(),
      hariIni: ms === hariIni,
      jumlahTenggat: tenggatHari.get(ms) ?? 0,
    }
  })
}

/** Urutan «Tugas untukmu»: belum dinilai (tenggat terdekat dulu), lalu yang sudah lewat. */
function urutkanMenunggu(tugas: TugasSiswaRingkas[]): TugasSiswaRingkas[] {
  const menunggu = tugas.filter((r) => r.status !== 'dinilai')
  const skor = (r: TugasSiswaRingkas) => {
    const ms = tenggatMs(r.tugas.tenggat)
    return ms || Number.MAX_SAFE_INTEGER
  }
  const belum = menunggu.filter((r) => r.status === 'belum').sort((a, b) => skor(a) - skor(b))
  const lewat = menunggu.filter((r) => r.status === 'lewat').sort((a, b) => skor(b) - skor(a))
  return [...belum, ...lewat]
}

function badgeTugas(r: TugasSiswaRingkas): { teks: string; kelas: string } | null {
  if (r.status === 'lewat') return { teks: 'Lewat', kelas: 'sw-kat-badge--danger' }
  const ms = tenggatMs(r.tugas.tenggat)
  if (!ms) return null
  const selisih = Math.round((awalHari(ms) - awalHari(Date.now())) / HARI_MS)
  if (selisih <= 0) return { teks: 'Hari ini', kelas: 'sw-kat-badge--warn' }
  if (selisih === 1) return { teks: 'Besok', kelas: 'sw-kat-badge--warn' }
  return { teks: `${selisih} hari`, kelas: 'sw-kat-badge--info' }
}

/** Hiasan hero: bentuk sederhana (buku terbuka, bintang, lingkaran) — murni dekoratif. */
function HeroDeco() {
  return (
    <svg className="sw-hero-deco" viewBox="0 0 220 160" fill="none" aria-hidden>
      <circle cx="170" cy="48" r="34" fill="rgba(255,255,255,0.10)" />
      <circle cx="36" cy="132" r="22" fill="rgba(255,255,255,0.08)" />
      <path
        d="M52 98c18-9 36-9 58 2v34c-22-11-40-11-58-2z"
        fill="#fde68a"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M168 98c-18-9-36-9-58 2v34c22-11 40-11 58-2z"
        fill="#fff"
        stroke="#e0e7ff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M110 100v34" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M154 34l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4-8.4-4.4-8.4 4.4 1.6-9.4-6.9-6.7 9.5-1.4z"
        fill="#fcd34d"
      />
      <path
        d="M62 52l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9z"
        fill="#fda4af"
      />
      <circle cx="96" cy="30" r="4" fill="#67e8f9" />
      <circle cx="196" cy="108" r="5" fill="#fdba74" />
    </svg>
  )
}

function Cincin({ persen }: { persen: number }) {
  const r = 30
  const k = 2 * Math.PI * r
  return (
    <svg className="sw-ring" viewBox="0 0 76 76" aria-hidden>
      <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="#fde68a"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(persen / 100) * k} ${k}`}
        transform="rotate(-90 38 38)"
      />
      <text
        x="38"
        y="43"
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fill="#fff"
        style={{ fontFamily: 'inherit' }}
      >
        {persen}%
      </text>
    </svg>
  )
}

export default function SiswaBeranda() {
  const { sesi } = useSiswa()
  const { list: daftarLomba } = useLombaSiswa()
  const { tugas, mapel } = useBerandaSiswa()
  const namaPanggil = sesi?.nama?.split(' ')[0] || 'Siswa'

  let menu: MenuItem[] = MENU.filter((m) => !m.segera)
  if (bolehTkaSiswa(sesi?.kelas)) menu = [...menu, MENU_TKA]
  if (daftarLomba.length > 0) menu = [...menu, MENU_LOMBA]
  // «Pencapaian» (Segera) tetap paling akhir.
  menu = [...menu, ...MENU.filter((m) => m.segera)]

  const tanggalTeks = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const ringkas = useMemo(() => {
    const total = tugas?.length ?? 0
    const dinilai = tugas?.filter((r) => r.status === 'dinilai').length ?? 0
    const menunggu = total - dinilai
    return { total, dinilai, menunggu, persen: total ? Math.round((dinilai / total) * 100) : 0 }
  }, [tugas])

  const pekan = useMemo(() => susunPekan(tugas ?? []), [tugas])
  const daftarMenunggu = useMemo(() => urutkanMenunggu(tugas ?? []).slice(0, 4), [tugas])

  let pesan = 'Siap belajar hari ini?'
  if (tugas && tugas.length > 0) {
    pesan =
      ringkas.menunggu > 0
        ? `Ada ${ringkas.menunggu} tugas yang menunggumu.`
        : 'Semua tugasmu sudah dinilai. Hebat!'
  }

  return (
    <div className="sw-beranda">
      <section className="sw-hero">
        <HeroDeco />
        <div className="sw-hero-main">
          <div className="sw-hero-avatar" aria-hidden>
            {namaPanggil.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="sw-hero-kicker">
              {sapaanWaktu()} · {tanggalTeks}
            </p>
            <h1 className="sw-hero-title">Halo, {namaPanggil}!</h1>
            <p className="sw-hero-msg">{pesan}</p>
            <div className="sw-hero-cta">
              <Link to="/siswa/materi" className="sw-hero-btn">
                Buka materi
                <SiswaIcon name="arrow" size={18} />
              </Link>
              {ringkas.menunggu > 0 && (
                <Link to="/siswa/tugas" className="sw-hero-btn sw-hero-btn--ghost">
                  Lihat tugas
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="sw-hero-side">
          {tugas && ringkas.total > 0 ? (
            <div className="sw-hero-stat sw-hero-stat--ring">
              <Cincin persen={ringkas.persen} />
              <div className="sw-hero-stat-text">
                <span className="sw-hero-stat-n">
                  {ringkas.dinilai}/{ringkas.total}
                </span>
                <span className="sw-hero-stat-l">Tugas sudah dinilai</span>
              </div>
            </div>
          ) : null}
          <div className="sw-hero-stat">
            <span className="sw-hero-stat-n">{sesi?.kelas}</span>
            <span className="sw-hero-stat-l">Kelasmu</span>
          </div>
        </div>
      </section>

      <div className="sw-beranda-grid">
        <section className="sw-area-menu">
          <h2 className="sw-section-title">Menu belajar</h2>
          <div className="sw-tile-grid">
            {menu.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`sw-tile sw-tone-${item.tone} ${item.segera ? 'sw-tile--soon' : ''}`}
              >
                {item.segera && <span className="sw-soon-pill">Segera</span>}
                <span className="sw-tile-icon">
                  <SiswaIcon name={item.icon} size={28} />
                </span>
                <span className="sw-tile-label">{item.label}</span>
                <span className="sw-tile-desc">{item.deskripsi}</span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="sw-area-side">
          <section className="sw-panel">
            <div className="sw-panel-head">
              <h2 className="sw-panel-title">
                <SiswaIcon name="calendar" size={18} />
                Pekan ini
              </h2>
            </div>
            <div className="sw-week" role="list">
              {pekan.map((h) => (
                <div
                  key={h.ms}
                  role="listitem"
                  className={`sw-week-day ${h.hariIni ? 'sw-week-day--today' : ''}`}
                  aria-label={
                    h.jumlahTenggat > 0
                      ? `${h.singkat} ${h.tanggal}, ${h.jumlahTenggat} tugas jatuh tempo`
                      : `${h.singkat} ${h.tanggal}`
                  }
                >
                  <span className="sw-week-name">{h.singkat}</span>
                  <span className="sw-week-num">{h.tanggal}</span>
                  <span
                    className={`sw-week-dot ${h.jumlahTenggat > 0 ? 'sw-week-dot--on' : ''}`}
                    aria-hidden
                  />
                </div>
              ))}
            </div>
            <p className="sw-week-legend">
              <span className="sw-week-dot sw-week-dot--on" aria-hidden /> Titik oranye = ada tugas
              jatuh tempo
            </p>
          </section>

          <section className="sw-panel">
            <div className="sw-panel-head">
              <h2 className="sw-panel-title">
                <SiswaIcon name="pencil" size={18} />
                Tugas untukmu
              </h2>
              <Link to="/siswa/tugas" className="sw-panel-link">
                Semua
              </Link>
            </div>
            {tugas === null ? (
              <div className="sw-skel-list" aria-hidden>
                <div className="sw-skel" />
                <div className="sw-skel" />
              </div>
            ) : daftarMenunggu.length === 0 ? (
              <div className="sw-todo-empty">
                <span className="sw-todo-empty-ico">
                  <SiswaIcon name={ringkas.total > 0 ? 'check' : 'sparkles'} size={22} />
                </span>
                <p>
                  {ringkas.total > 0
                    ? 'Tidak ada tugas yang menunggu.'
                    : 'Belum ada tugas dari gurumu.'}
                </p>
              </div>
            ) : (
              <ul className="sw-todo-list">
                {daftarMenunggu.map((r) => {
                  const a = aksenMapel(r.tugas.mapel)
                  const badge = badgeTugas(r)
                  const tenggat = formatTenggatRelatif(r.tugas.tenggat)
                  return (
                    <li key={r.tugas.id}>
                      <Link
                        to={`/siswa/tugas?id=${encodeURIComponent(r.tugas.id)}`}
                        className="sw-todo"
                        style={{ '--aksen': a.bar } as CSSProperties}
                      >
                        <span className="sw-todo-mark">{inisialMapel(r.tugas.mapel)}</span>
                        <span className="sw-todo-body">
                          <span className="sw-todo-title">{r.tugas.judul}</span>
                          <span className="sw-todo-meta">
                            {r.tugas.mapel}
                            {tenggat ? ` · ${tenggat}` : ''}
                          </span>
                        </span>
                        {badge && <span className={`sw-kat-badge ${badge.kelas}`}>{badge.teks}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>

        {mapel && mapel.length > 0 && (
          <section className="sw-area-mapel">
            <div className="sw-panel-head sw-panel-head--plain">
              <h2 className="sw-section-title" style={{ margin: 0 }}>
                Pelajaranmu
              </h2>
              <Link to="/siswa/materi" className="sw-panel-link">
                Lihat semua
              </Link>
            </div>
            <div className="sw-mapel-rail">
              {mapel.map((p) => {
                const a = aksenMapel(p.mapel)
                return (
                  <Link
                    key={p.mapel}
                    to={`/siswa/materi?mapel=${encodeURIComponent(p.mapel)}`}
                    className="sw-mapel-chip"
                    style={{ background: a.cover }}
                  >
                    <span className="sw-mapel-chip-mark" style={{ color: a.coverFg }} aria-hidden>
                      {inisialMapel(p.mapel)}
                    </span>
                    <span className="sw-mapel-chip-name">{p.mapel}</span>
                    <span className="sw-mapel-chip-n">{p.jumlah} materi</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}


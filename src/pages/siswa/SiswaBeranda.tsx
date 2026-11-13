import { Link } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { bolehTkaSiswa } from '../../lib/tkaAkses'
import SiswaIcon, { type SiswaIconName } from './SiswaIcon'

type MenuItem = {
  to: string
  label: string
  deskripsi: string
  icon: SiswaIconName
  /** Kelas Tailwind untuk kotak ikon (warna lembut + teks). */
  tone: string
  segera: boolean
}

/** Menu utama beranda siswa — kartu besar, ikon jelas, target sentuh nyaman. */
const MENU: MenuItem[] = [
  {
    to: '/siswa/materi',
    label: 'Materi',
    deskripsi: 'Baca & tonton pelajaran',
    icon: 'book',
    tone: 'bg-sky-50 text-sky-700',
    segera: false,
  },
  {
    to: '/siswa/tugas',
    label: 'Tugas',
    deskripsi: 'Kerjakan & kumpulkan',
    icon: 'pencil',
    tone: 'bg-amber-50 text-amber-700',
    segera: false,
  },
  {
    to: '/siswa/kuis',
    label: 'Kuis',
    deskripsi: 'Latihan soal seru',
    icon: 'target',
    tone: 'bg-violet-50 text-violet-700',
    segera: false,
  },
  {
    to: '/siswa/pencapaian',
    label: 'Pencapaian',
    deskripsi: 'Bintang & lencana',
    icon: 'star',
    tone: 'bg-emerald-50 text-emerald-700',
    segera: true,
  },
]

function sapaanWaktu(): string {
  const jam = new Date().getHours()
  if (jam < 11) return 'Selamat pagi'
  if (jam < 15) return 'Selamat siang'
  if (jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const MENU_TKA: MenuItem = {
  to: '/siswa/tka',
  label: 'TKA',
  deskripsi: 'Try out & latihan TKA',
  icon: 'tka',
  tone: 'bg-rose-50 text-rose-700',
  segera: false,
}

export default function SiswaBeranda() {
  const { sesi } = useSiswa()
  const namaPanggil = sesi?.nama?.split(' ')[0] || 'Siswa'
  const menu = bolehTkaSiswa(sesi?.kelas) ? [...MENU, MENU_TKA] : MENU

  return (
    <div className="space-y-6">
      {/* Sapaan — gradien merek, selaras hero guru */}
      <section className="lms-hero">
        <div className="relative z-10 flex min-w-0 items-center gap-3.5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white ring-1 ring-white/25"
            aria-hidden
          >
            {namaPanggil.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80">{sapaanWaktu()}</p>
            <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
              Halo, {namaPanggil}!
            </h1>
            <p className="mt-0.5 text-xs text-white/80">Siap belajar hari ini?</p>
          </div>
        </div>
        <div className="lms-hero-stats">
          <div className="lms-hero-stat">
            <span className="text-2xl font-bold leading-none text-white">{sesi?.kelas}</span>
            <span className="mt-1 text-[11px] font-medium text-white/80">Kelasmu</span>
          </div>
        </div>
      </section>

      {/* Menu belajar */}
      <section>
        <h2 className="sw-section-title">Menu belajar</h2>
        <div className="sw-menu-grid">
          {menu.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sw-menu-card ${item.segera ? 'sw-menu-card--soon' : ''}`}
            >
              {item.segera && <span className="sw-soon-pill">Segera</span>}
              <span className={`sw-menu-icon ${item.tone}`}>
                <SiswaIcon name={item.icon} size={28} />
              </span>
              <span className="text-base font-bold leading-tight text-slate-900">
                {item.label}
              </span>
              <span className="text-xs leading-snug text-muted">{item.deskripsi}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sw-tip">
        <span className="text-base" aria-hidden>
          💡
        </span>
        <p className="text-xs leading-relaxed text-slate-700">
          Tekan kartu <strong>Materi</strong> untuk membuka pelajaran dari gurumu. Kalau ada yang
          sulit, tanya guru atau orang tua ya.
        </p>
      </section>
    </div>
  )
}

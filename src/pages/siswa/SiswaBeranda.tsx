import { Link } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'

/** Menu utama beranda siswa — ikon besar, warna lembut, target sentuh besar. */
const MENU = [
  {
    to: '/siswa/materi',
    label: 'Materi',
    deskripsi: 'Baca & tonton pelajaran',
    emoji: '📚',
    bg: 'bg-sky-50',
    border: 'border-sky-100',
    accent: 'text-sky-700',
    segera: false,
  },
  {
    to: '/siswa/tugas',
    label: 'Tugas',
    deskripsi: 'Kerjakan & kumpulkan',
    emoji: '✏️',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    accent: 'text-amber-700',
    segera: true,
  },
  {
    to: '/siswa/kuis',
    label: 'Kuis',
    deskripsi: 'Latihan soal seru',
    emoji: '🎯',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    accent: 'text-violet-700',
    segera: true,
  },
  {
    to: '/siswa/pencapaian',
    label: 'Pencapaian',
    deskripsi: 'Bintang & lencana',
    emoji: '⭐',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    accent: 'text-emerald-700',
    segera: true,
  },
] as const

function sapaanWaktu(): string {
  const jam = new Date().getHours()
  if (jam < 11) return 'Selamat pagi'
  if (jam < 15) return 'Selamat siang'
  if (jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export default function SiswaBeranda() {
  const { sesi } = useSiswa()
  const namaPanggil = sesi?.nama?.split(' ')[0] || 'Siswa'

  return (
    <div className="siswa-page space-y-6">
      {/* Sapaan */}
      <section className="siswa-hero-card">
        <div className="flex items-center gap-3">
          <div
            className="siswa-avatar"
            aria-hidden
            title={sesi?.nama}
          >
            {namaPanggil.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muh-600/90">{sapaanWaktu()}</p>
            <h1 className="truncate text-lg font-bold tracking-tight text-muh-900">
              Halo, {namaPanggil}!
            </h1>
            <p className="text-xs text-muted">
              Kelas {sesi?.kelas} · Siap belajar hari ini?
            </p>
          </div>
        </div>
      </section>

      {/* Menu utama — grid 2 kolom, kartu besar */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Menu belajar
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MENU.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`siswa-menu-card ${item.bg} ${item.border} ${
                item.segera ? 'siswa-menu-card--soon' : ''
              }`}
            >
              <span className="siswa-menu-emoji" aria-hidden>
                {item.emoji}
              </span>
              <span className={`text-[15px] font-bold leading-tight ${item.accent}`}>
                {item.label}
              </span>
              <span className="text-[11px] leading-snug text-slate-600">
                {item.segera ? 'Segera hadir' : item.deskripsi}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Tips singkat */}
      <section className="siswa-tip">
        <span className="text-base" aria-hidden>
          💡
        </span>
        <p className="text-xs leading-relaxed text-slate-700">
          Tekan kartu di atas untuk membuka materi atau tugas. Kalau ada yang sulit, tanya guru
          atau orang tua ya.
        </p>
      </section>
    </div>
  )
}

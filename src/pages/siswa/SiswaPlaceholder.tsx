import { Link } from 'react-router-dom'
import SiswaIcon, { type SiswaIconName } from './SiswaIcon'

type Props = {
  judul: string
  icon: SiswaIconName
  deskripsi: string
  /** Kelas Tailwind untuk kotak ikon (warna lembut + teks). */
  tone?: string
}

/**
 * Halaman placeholder ramah anak untuk fitur yang belum aktif.
 * Dipakai sementara agar navigasi siswa tidak “mati”.
 */
export default function SiswaPlaceholder({
  judul,
  icon,
  deskripsi,
  tone = 'bg-muh-50 text-muh-700',
}: Props) {
  return (
    <div className="sw-placeholder">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-2xl ${tone}`}
        aria-hidden
      >
        <SiswaIcon name={icon} size={40} />
      </div>
      <div className="space-y-1.5">
        <span className="sw-soon-pill" style={{ position: 'static', display: 'inline-block' }}>
          Segera hadir
        </span>
        <h1 className="text-lg font-bold text-slate-900">{judul}</h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted">{deskripsi}</p>
      </div>
      <Link to="/siswa" className="sw-btn-primary">
        ← Kembali ke Beranda
      </Link>
    </div>
  )
}

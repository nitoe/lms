import { Link } from 'react-router-dom'

type Props = {
  judul: string
  emoji: string
  deskripsi: string
  warna?: string
}

/**
 * Halaman placeholder ramah anak untuk fitur yang belum aktif.
 * Dipakai sementara agar navigasi siswa tidak “mati”.
 */
export default function SiswaPlaceholder({
  judul,
  emoji,
  deskripsi,
  warna = 'bg-muh-50',
}: Props) {
  return (
    <div className="siswa-page flex flex-col items-center gap-5 py-6 text-center">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-2xl text-4xl shadow-sm ${warna}`}
        aria-hidden
      >
        {emoji}
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-bold text-muh-900">{judul}</h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted">{deskripsi}</p>
      </div>
      <Link to="/siswa" className="siswa-btn-primary">
        ← Kembali ke Beranda
      </Link>
    </div>
  )
}

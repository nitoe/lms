import { Navigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { bolehTkaSiswa } from '../../lib/tkaAkses'
import SiswaPlaceholder from './SiswaPlaceholder'

/**
 * Halaman TKA untuk siswa kelas 6.
 * Tahap 1: kerangka + penjaga kelas. Pengerjaan (token, timer, penilaian server) menyusul di Tahap 2.
 * Jangan memanggil navigate() saat render (ANTIREGRESI §12) — pakai <Navigate />.
 */
export default function SiswaTka() {
  const { sesi } = useSiswa()
  if (!sesi) return <Navigate to="/siswa/masuk" replace />
  if (!bolehTkaSiswa(sesi.kelas)) return <Navigate to="/siswa" replace />

  return (
    <SiswaPlaceholder
      judul="TKA"
      icon="tka"
      deskripsi="Latihan dan try out Tes Kemampuan Akademik untuk kelas 6 akan tampil di sini. Siapkan dirimu ya!"
      tone="bg-rose-50 text-rose-700"
    />
  )
}

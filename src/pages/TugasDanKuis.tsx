/**
 * Halaman lama /tugas-kuis — diganti dashboard /tugas.
 * Komponen ini hanya mengalihkan; rute di App.tsx juga sudah redirect.
 */
import { Navigate } from 'react-router-dom'

export default function TugasDanKuis() {
  return <Navigate to="/tugas" replace />
}

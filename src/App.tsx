import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { useSiswa } from './context/SiswaContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import OrangtuaMasuk from './pages/OrangtuaMasuk'
import Beranda from './pages/Beranda'
import KelasList from './pages/KelasList'
import KelasDetail from './pages/KelasDetail'
import TugasDanKuis from './pages/TugasDanKuis'
import SiswaMasuk from './pages/siswa/SiswaMasuk'
import SiswaLayout from './pages/siswa/SiswaLayout'
import SiswaBeranda from './pages/siswa/SiswaBeranda'
import SiswaMateri from './pages/siswa/SiswaMateri'
import SiswaPlaceholder from './pages/siswa/SiswaPlaceholder'
import SiswaKuis from './pages/siswa/SiswaKuis'
import OrangtuaBeranda from './pages/OrangtuaBeranda'
import { isStaf } from './lib/peran'

// Dimuat malas: editor teks kaya (TipTap) cukup besar dan hanya dipakai guru (ANTIREGRESI §13).
const SoalEditor = lazy(() => import('./pages/SoalEditor'))

function WajibStaf({ children }: { children: ReactNode }) {
  const { user, profil, peran, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-muted">Memuat…</div>
  if (!user || !profil || !isStaf(peran)) return <Navigate to="/masuk" replace />
  return children
}

function WajibOrangtua({ children }: { children: ReactNode }) {
  const { user, profil, peran, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-muted">Memuat…</div>
  if (!user || !profil || (peran !== 'orangtua' && peran !== 'admin')) {
    return <Navigate to="/orangtua/masuk" replace />
  }
  return children
}

function WajibSiswa({ children }: { children: ReactNode }) {
  const { sesi, loading } = useSiswa()
  if (loading) return <div className="p-8 text-sm text-muted">Memuat…</div>
  if (!sesi) return <Navigate to="/siswa/masuk" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/masuk" element={<Login />} />
      <Route path="/siswa/masuk" element={<SiswaMasuk />} />
      <Route path="/orangtua/masuk" element={<OrangtuaMasuk />} />

      <Route
        path="/siswa"
        element={
          <WajibSiswa>
            <SiswaLayout />
          </WajibSiswa>
        }
      >
        <Route index element={<SiswaBeranda />} />
        <Route path="materi" element={<SiswaMateri />} />
        <Route
          path="tugas"
          element={
            <SiswaPlaceholder
              judul="Tugas"
              icon="pencil"
              deskripsi="Tugas dari guru akan tampil di sini. Kamu bisa mengerjakan, mengunggah foto atau file, lalu mengirimnya."
              tone="bg-amber-50 text-amber-700"
            />
          }
        />
        <Route path="kuis" element={<SiswaKuis />} />
        <Route
          path="pencapaian"
          element={
            <SiswaPlaceholder
              judul="Pencapaian"
              icon="star"
              deskripsi="Bintang, lencana, dan catatan belajarmu akan dikumpulkan di sini. Terus semangat!"
              tone="bg-emerald-50 text-emerald-700"
            />
          }
        />
        {/* Alias lama */}
        <Route path="kelas" element={<Navigate to="/siswa/materi" replace />} />
      </Route>

      <Route
        path="/orangtua"
        element={
          <WajibOrangtua>
            <OrangtuaBeranda />
          </WajibOrangtua>
        }
      />

      <Route
        element={
          <WajibStaf>
            <Layout />
          </WajibStaf>
        }
      >
        <Route index element={<Beranda />} />
        <Route path="kelas" element={<KelasList />} />
        <Route path="kelas/:ruangId" element={<KelasDetail />} />
        <Route path="tugas-kuis" element={<TugasDanKuis />} />
        <Route
          path="kelas/:ruangId/soal/:paketId"
          element={
            <Suspense fallback={<div className="lms-empty">Memuat editor soal…</div>}>
              <SoalEditor />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { useSiswa } from './context/SiswaContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import OrangtuaMasuk from './pages/OrangtuaMasuk'
import Beranda from './pages/Beranda'
import KelasList from './pages/KelasList'
import KelasDetail from './pages/KelasDetail'
import SiswaMasuk from './pages/siswa/SiswaMasuk'
import SiswaLayout from './pages/siswa/SiswaLayout'
import SiswaBeranda from './pages/siswa/SiswaBeranda'
import OrangtuaBeranda from './pages/OrangtuaBeranda'
import { isStaf } from './lib/peran'

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
        <Route path="kelas" element={<div className="text-sm text-muted p-4">Daftar kelas siswa — segera (Fase 1).</div>} />
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

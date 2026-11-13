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
import TugasDashboard from './pages/TugasDashboard'
import TugasDetail from './pages/TugasDetail'
import RekapNilai from './pages/RekapNilai'
import SiswaMasuk from './pages/siswa/SiswaMasuk'
import SiswaLayout from './pages/siswa/SiswaLayout'
import SiswaBeranda from './pages/siswa/SiswaBeranda'
import SiswaMateri from './pages/siswa/SiswaMateri'
import SiswaPlaceholder from './pages/siswa/SiswaPlaceholder'
import SiswaKuis from './pages/siswa/SiswaKuis'
import SiswaTka from './pages/siswa/SiswaTka'
import TkaBeranda from './pages/tka/TkaBeranda'
import TkaRekap from './pages/tka/TkaRekap'
import TkaImportRekap from './pages/tka/TkaImportRekap'
import OrangtuaBeranda from './pages/OrangtuaBeranda'
import { isStaf } from './lib/peran'
import { bolehAksesTkaStaf, bolehImportRekapTka } from './lib/tkaAkses'

// Dimuat malas: editor teks kaya (TipTap) cukup besar dan hanya dipakai guru (ANTIREGRESI §13).
const SoalEditor = lazy(() => import('./pages/SoalEditor'))
// Editor materi halaman (TipTap + tabel + media) juga dimuat malas (ANTIREGRESI §13, §117).
const MateriEditorPage = lazy(() => import('./pages/MateriEditorPage'))
const MateriBacaPage = lazy(() => import('./pages/MateriBacaPage'))

function WajibStaf({ children }: { children: ReactNode }) {
  const { user, profil, peran, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-muted">Memuat…</div>
  if (!user || !profil || !isStaf(peran)) return <Navigate to="/masuk" replace />
  return children
}

/** Menu TKA: hanya admin TKA (pembuat aplikasi) dan wali kelas 6. Penegak sebenarnya: firestore.rules. */
function WajibTkaStaf({ children }: { children: ReactNode }) {
  const { user, profil, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-muted">Memuat…</div>
  if (!bolehAksesTkaStaf(user, profil)) return <Navigate to="/" replace />
  return children
}

/** Import rekap TKA: admin LMS atau admin TKA (email khusus). */
function WajibImportRekapTka({ children }: { children: ReactNode }) {
  const { user, profil, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-muted">Memuat…</div>
  if (!bolehImportRekapTka(user, profil)) return <Navigate to="/tka" replace />
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
          path="materi/:materiId"
          element={
            <Suspense fallback={<div className="lms-empty">Memuat materi…</div>}>
              <MateriBacaPage peran="siswa" />
            </Suspense>
          }
        />
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
        <Route path="tka" element={<SiswaTka />} />
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
        <Route path="tugas" element={<TugasDashboard />} />
        <Route path="tugas/:tugasId" element={<TugasDetail />} />
        {/* Alias lama: /tugas-kuis → /tugas */}
        <Route path="tugas-kuis" element={<Navigate to="/tugas" replace />} />
        <Route path="rekap-nilai" element={<RekapNilai />} />
        <Route
          path="tka"
          element={
            <WajibTkaStaf>
              <TkaBeranda />
            </WajibTkaStaf>
          }
        />
        <Route
          path="tka/rekap"
          element={
            <WajibTkaStaf>
              <TkaRekap />
            </WajibTkaStaf>
          }
        />
        <Route
          path="tka/import-rekap"
          element={
            <WajibTkaStaf>
              <WajibImportRekapTka>
                <TkaImportRekap />
              </WajibImportRekapTka>
            </WajibTkaStaf>
          }
        />
        <Route
          path="kelas/:ruangId/materi/:materiId"
          element={
            <Suspense fallback={<div className="lms-empty">Memuat editor materi…</div>}>
              <MateriEditorPage />
            </Suspense>
          }
        />
        <Route
          path="kelas/:ruangId/materi/:materiId/baca"
          element={
            <Suspense fallback={<div className="lms-empty">Memuat materi…</div>}>
              <MateriBacaPage peran="staf" />
            </Suspense>
          }
        />
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

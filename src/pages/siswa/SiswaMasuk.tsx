import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { DAFTAR_KELAS, muatSiswaKelas } from '../../lib/siswaAuth'
import type { SiswaDasar } from '../../lib/siswaAuth'

function pesanGalat(e: unknown): string {
  const kode = (e as { code?: string })?.code ?? ''
  if (kode === 'permission-denied') {
    return 'Belum bisa memuat daftar siswa. Hubungi admin agar aturan Firestore mengizinkan baca daftar siswa.'
  }
  // Pesan dari Cloud Function loginSiswaLms sudah berbahasa Indonesia dan aman ditampilkan.
  if (
    kode === 'functions/permission-denied' ||
    kode === 'functions/invalid-argument' ||
    kode === 'functions/failed-precondition' ||
    kode === 'functions/resource-exhausted'
  ) {
    return e instanceof Error ? e.message : 'Gagal masuk.'
  }
  if (kode === 'functions/internal' || kode === 'functions/not-found') {
    return 'Layanan masuk belum bisa dihubungi. Coba lagi, atau hubungi admin.'
  }
  if (kode.includes('network') || kode === 'functions/unavailable') {
    return 'Tidak ada koneksi internet.'
  }
  return e instanceof Error ? e.message : 'Gagal masuk.'
}

export default function SiswaMasuk() {
  const { sesi, loading, masuk } = useSiswa()
  const [kelas, setKelas] = useState('')
  const [daftar, setDaftar] = useState<SiswaDasar[]>([])
  const [siswaId, setSiswaId] = useState('')
  const [nisn, setNisn] = useState('')
  const [galat, setGalat] = useState('')
  const [muatDaftar, setMuatDaftar] = useState(false)
  const [proses, setProses] = useState(false)
  const [tampilNisn, setTampilNisn] = useState(false)

  useEffect(() => {
    if (!kelas) {
      setDaftar([])
      setSiswaId('')
      return
    }
    let batal = false
    setMuatDaftar(true)
    setGalat('')
    setSiswaId('')
    void muatSiswaKelas(kelas)
      .then((list) => {
        if (!batal) {
          setDaftar(list)
          if (list.length === 0) {
            setGalat(`Tidak ada siswa aktif di kelas ${kelas}.`)
          }
        }
      })
      .catch((e) => {
        if (!batal) {
          setDaftar([])
          setGalat(pesanGalat(e))
        }
      })
      .finally(() => {
        if (!batal) setMuatDaftar(false)
      })
    return () => {
      batal = true
    }
  }, [kelas])

  if (!loading && sesi) return <Navigate to="/siswa" replace />

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat('')
    const pilih = daftar.find((s) => s.id === siswaId)
    if (!pilih) {
      setGalat('Pilih nama siswa terlebih dahulu.')
      return
    }
    setProses(true)
    try {
      await masuk(pilih.id, nisn)
    } catch (err) {
      setGalat(pesanGalat(err))
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-brand-row">
            <div className="auth-logo-tile">
              <img src="/logo-sdm.png" alt="" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <div className="auth-brand-name">LMS Sekolah</div>
              <div className="auth-brand-tag">Belajar, tumbuh, berakhlak</div>
            </div>
          </div>

          <p className="auth-hero-kicker">Untuk siswa · SD Muhammadiyah 01 Kukusan</p>
          <h1 className="auth-hero-title">Belajar dengan ikon besar, warna cerah, dan materi yang mudah dipahami.</h1>
          <p className="auth-hero-desc">
            Pilih kelas dan nama, masukkan NISN, lalu buka ruang kelas, materi, dan tugasmu.
          </p>

          <div className="auth-hero-pills">
            <div className="auth-hero-pill">
              <strong>Materi digital</strong>
              <span>PDF, video, tautan</span>
            </div>
            <div className="auth-hero-pill">
              <strong>Tugas & kuis</strong>
              <span>Kumpul dengan mudah</span>
            </div>
            <div className="auth-hero-pill">
              <strong>Tanpa akun baru</strong>
              <span>Cukup kelas, nama, NISN</span>
            </div>
          </div>

          <div className="auth-hero-quote">
            “Barangsiapa menempuh jalan untuk mencari ilmu, maka Allah akan mudahkan baginya jalan menuju surga.”
            <cite>— HR. Muslim</cite>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-card">
          <div className="auth-mobile-brand">
            <div className="auth-logo-tile auth-logo-tile--light">
              <img src="/logo-sdm.png" alt="" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <strong>LMS Sekolah</strong>
              <span>SD Muhammadiyah 01 Kukusan</span>
            </div>
          </div>

          <div className="auth-tabs">
            <button type="button" className="auth-tab auth-tab--active">Siswa</button>
            <Link to="/masuk" className="auth-tab">Staf</Link>
            <Link to="/orangtua/masuk" className="auth-tab">Orang Tua</Link>
          </div>

          <h2 className="auth-panel-title">Assalamu&apos;alaikum wr. wb.</h2>
          <p className="auth-panel-sub">
            Pilih kelas dan nama, lalu masukkan NISN sebagai kata sandi.
          </p>

          {galat && <div className="auth-alert auth-alert--error">{galat}</div>}

          <form onSubmit={kirim} className="space-y-4">
            <div className="auth-field">
              <label htmlFor="kelas">Kelas</label>
              <select id="kelas" required value={kelas} onChange={(e) => setKelas(e.target.value)} autoComplete="off">
                <option value="">— Pilih kelas —</option>
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="nama">Nama siswa</label>
              <select
                id="nama"
                required
                value={siswaId}
                onChange={(e) => setSiswaId(e.target.value)}
                disabled={!kelas || muatDaftar}
                autoComplete="off"
              >
                <option value="">
                  {muatDaftar ? 'Memuat…' : !kelas ? 'Pilih kelas dulu' : '— Pilih nama —'}
                </option>
                {daftar.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="nisn">NISN (kata sandi)</label>
              <div className="auth-password-wrap">
                <input
                  id="nisn"
                  type={tampilNisn ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  required
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="Masukkan NISN"
                />
                <button
                  type="button"
                  className="auth-toggle-visibility"
                  onClick={() => setTampilNisn((v) => !v)}
                  aria-label={tampilNisn ? 'Sembunyikan NISN' : 'Tampilkan NISN'}
                >
                  {tampilNisn ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-btn-primary" disabled={proses || !siswaId}>
              {proses ? 'Memeriksa…' : 'Masuk ke ruang kelas'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            <Link to="/masuk" className="font-medium text-muh-600 hover:underline">
              masuk staf
            </Link>
            {' · '}
            <Link to="/orangtua/masuk" className="font-medium text-muh-600 hover:underline">
              orang tua
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

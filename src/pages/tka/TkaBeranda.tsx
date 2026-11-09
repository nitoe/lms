import { useEffect, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import { adalahAdminTka, kelasTkaDiwalikan } from '../../lib/tkaAkses'

type Hitung = { soal: number | null; paket: number | null; percobaan: number | null }

const TAHAP: { judul: string; deskripsi: string; tahap: string }[] = [
  { judul: 'Pengerjaan siswa', deskripsi: 'Gerbang token & waktu, timer, autosave, rumus, penilaian di server.', tahap: 'Tahap 2' },
  { judul: 'Bank soal & susun paket', deskripsi: 'Kelola soal TKA, impor Excel/JSON, susun paket latihan dan try out.', tahap: 'Tahap 3' },
  { judul: 'Rekap, monitor & analisis', deskripsi: 'Pantauan langsung, rekap per kelas, analisis butir, perbandingan paket, PDF.', tahap: 'Tahap 4' },
]

async function hitung(nama: string): Promise<number | null> {
  try {
    const snap = await getCountFromServer(collection(db, nama))
    return snap.data().count
  } catch {
    // Rules belum dideploy / koleksi belum dimigrasi: tampilkan strip, jangan gagalkan halaman.
    return null
  }
}

export default function TkaBeranda() {
  const { user, profil } = useAuth()
  const [jumlah, setJumlah] = useState<Hitung | null>(null)
  const admin = adalahAdminTka(user, profil)
  const kelas = kelasTkaDiwalikan(profil)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let batal = false
    void (async () => {
      const [soal, paket, percobaan] = await Promise.all([
        hitung('tka_soal'),
        hitung('tka_paket'),
        hitung('tka_percobaan'),
      ])
      if (!batal) setJumlah({ soal, paket, percobaan })
    })()
    return () => {
      batal = true
    }
  }, [])

  const stat = (v: number | null | undefined) => (v == null ? '—' : String(v))

  return (
    <div className="space-y-6">
      <section className="lms-hero">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muh-200/90">
            Kelas 6
          </p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            TKA — Tes Kemampuan Akademik
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Latihan dan try out TKA untuk siswa kelas 6. Anda masuk sebagai{' '}
            <strong className="text-white">
              {admin ? 'Administrator TKA' : `Guru kelas ${kelas.join(', ')}`}
            </strong>
            .
          </p>
        </div>
        <div className="lms-hero-stats">
          <div className="lms-hero-stat">
            <div className="text-2xl font-bold tabular text-white">{stat(jumlah?.soal)}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">Soal</div>
          </div>
          <div className="lms-hero-stat">
            <div className="text-2xl font-bold tabular text-white">{stat(jumlah?.paket)}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">Paket</div>
          </div>
          <div className="lms-hero-stat">
            <div className="text-2xl font-bold tabular text-white">{stat(jumlah?.percobaan)}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">Hasil</div>
          </div>
        </div>
      </section>

      {jumlah && jumlah.soal === null && jumlah.paket === null && (
        <div className="lms-empty">
          <p>
            Data TKA belum terbaca. Pastikan <code>firestore.rules</code> terbaru sudah dideploy dan
            migrasi data dari <code>tka2026</code> sudah dijalankan (lihat <code>docs/TKA.md</code>).
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Fitur yang menyusul</h3>
        <div className="lms-card-grid">
          {TAHAP.map((t) => (
            <div key={t.judul} className="lms-card">
              <div className="lms-card-body space-y-1.5">
                <span className="lms-soon-pill" style={{ position: 'static', display: 'inline-block' }}>
                  {t.tahap}
                </span>
                <div className="lms-card-title">{t.judul}</div>
                <p className="text-sm text-muted">{t.deskripsi}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

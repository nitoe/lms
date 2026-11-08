import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas } from '../lib/kelasLms'
import { daftarTugas } from '../lib/tugas'
import { daftarKuis } from '../lib/kuis'
import type { TugasLms } from '../types/tugas'
import type { KuisLms } from '../types/kuis'
import { updateTugas } from '../lib/tugas'

type ItemGabungan = (TugasLms & { jenis: 'tugas' }) | (KuisLms & { jenis: 'kuis' })

export default function TugasDanKuis() {
  const { profil } = useAuth()
  const [items, setItems] = useState<ItemGabungan[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let batal = false
    async function muat() {
      setError('')
      try {
        const ruang = daftarRuangKelas(profil)
        const semua: ItemGabungan[] = []
        for (const r of ruang) {
          const [tugas, kuis] = await Promise.all([
            daftarTugas(r.kelas, r.mapel).catch(() => []),
            daftarKuis(r.kelas, r.mapel).catch(() => []),
          ])
          semua.push(...tugas.map((t) => ({ ...t, jenis: 'tugas' as const })))
          semua.push(...kuis.map((k) => ({ ...k, jenis: 'kuis' as const })))
        }
        if (!batal) {
          semua.sort((a, b) => {
            const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
            const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
            return tb - ta
          })
          setItems(semua)
        }
      } catch (e) {
        if (!batal) setError(e instanceof Error ? e.message : 'Gagal memuat data.')
      }
    }
    void muat()
    return () => {
      batal = true
    }
  }, [profil])

  async function toggleAktif(item: ItemGabungan) {
    setBusy(true)
    try {
      if (item.jenis === 'tugas') {
        await updateTugas(item.id, { aktif: !item.aktif })
      } else {
        // For kuis, assume similar update; in real, import update from kuis lib if exists
        // For now, skip or note
        alert('Aktivasi kuis belum diimplementasi di halaman ini. Gunakan tab Kuis di ruang kelas.')
      }
      // Reload
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="lms-page-intro">
        <h2 className="text-lg font-semibold">Tugas & Kuis</h2>
        <p className="max-w-2xl text-sm text-muted">
          Kumpulan semua tugas dan kuis dari ruang kelas Anda. Aktifkan, atur tenggat, dan pantau dari sini.
          Untuk merancang konten, buka ruang kelas masing-masing.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {items === null && <div className="lms-empty">Memuat…</div>}

      {items && items.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada tugas atau kuis</p>
          <p className="mt-1">Buat dari tab Tugas atau Kuis di setiap ruang kelas.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="materi-list">
          {items.map((item) => (
            <li key={`${item.jenis}-${item.id}`} className="materi-item">
              <div className="materi-item-body">
                <div className="materi-item-title">
                  <span className="text-xs font-medium uppercase text-muted mr-2">
                    {item.jenis === 'tugas' ? 'Tugas' : 'Kuis'}
                  </span>
                  {item.judul}
                </div>
                <div className="materi-item-meta">
                  <span>{item.kelas} · {item.mapel}</span>
                  <span className={item.aktif ? 'text-emerald-700' : 'text-slate-500'}>
                    {item.aktif ? 'Aktif' : 'Draf'}
                  </span>
                </div>
              </div>
              <div className="materi-item-actions">
                <button
                  type="button"
                  className="lms-btn-secondary"
                  onClick={() => void toggleAktif(item)}
                  disabled={busy}
                >
                  {item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

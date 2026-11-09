import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import type { KuisLms } from '../../types/kuis'
import { NAMA_JENIS_PENILAIAN } from '../../types/kuis'

export default function SiswaKuis() {
  const { sesi } = useSiswa()
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [aktif, setAktif] = useState<KuisLms | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sesi) return
    const q = query(
      collection(db, 'lms_kuis'),
      where('kelas', '==', sesi.kelas),
      where('aktif', '==', true),
    )
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KuisLms)
        setList(data)
      })
      .catch((e) => setError(e.message || 'Gagal memuat kuis'))
  }, [sesi])

  if (aktif) {
    return <KerjakanKuis kuis={aktif} onSelesai={() => setAktif(null)} />
  }

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800">Kuis</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {list === null && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && <p className="text-slate-500">Belum ada kuis aktif.</p>}
      <ul className="space-y-3">
        {list?.map((k) => (
          <li key={k.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-semibold">{k.judul}</div>
            <div className="text-xs text-slate-500 mt-1">
              {k.mapel} · {NAMA_JENIS_PENILAIAN[k.jenisPenilaian ?? 'latihan']} · {k.jumlahSoal} soal
              {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
            </div>
            <button
              type="button"
              className="mt-3 lms-btn-primary text-sm"
              onClick={() => setAktif(k)}
            >
              Kerjakan
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function KerjakanKuis({ kuis, onSelesai }: { kuis: KuisLms; onSelesai: () => void }) {
  const [idx, setIdx] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, any>>({})
  const soal = kuis.soal?.[idx]

  if (!soal) return <div className="p-4">Tidak ada soal.</div>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{kuis.judul}</div>
          <div className="text-xs text-slate-500">Soal {idx + 1} dari {kuis.soal?.length}</div>
        </div>
        <button type="button" onClick={onSelesai} className="text-xs text-slate-500">Keluar</button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="rounded-xl bg-white border p-4">
          <div className="text-sm font-medium mb-2">Soal {idx + 1}</div>
          <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: soal.teks || '' }} />
          {/* Placeholder untuk opsi — nanti dilengkapi per tipe */}
          <div className="mt-4 text-xs text-slate-400">Form jawaban per tipe akan dilengkapi di iterasi berikutnya.</div>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
            className="lms-btn-secondary text-sm"
          >
            Sebelumnya
          </button>
          {idx < (kuis.soal?.length ?? 1) - 1 ? (
            <button type="button" onClick={() => setIdx((i) => i + 1)} className="lms-btn-primary text-sm">
              Berikutnya
            </button>
          ) : (
            <button type="button" onClick={() => { alert('Jawaban akan dikirim ke Cloud Function untuk dinilai.'); onSelesai() }} className="lms-btn-primary text-sm">
              Selesai
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

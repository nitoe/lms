import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import type { KuisLms, SoalKuis } from '../../types/kuis'
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
      .then((snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KuisLms)))
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
            <button type="button" className="mt-3 lms-btn-primary text-sm" onClick={() => setAktif(k)}>
              Kerjakan
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FormJawaban({ soal, value, onChange }: { soal: SoalKuis; value: any; onChange: (v: any) => void }) {
  if (soal.tipe === 'pg') {
    return (
      <div className="space-y-2 mt-3">
        {soal.opsi?.map((o) => (
          <label key={o.id} className="flex items-start gap-2 cursor-pointer rounded-lg border p-3 hover:bg-slate-50">
            <input type="radio" name={soal.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>{o.teks}</span>
          </label>
        ))}
      </div>
    )
  }
  if (soal.tipe === 'pgk') {
    const arr: string[] = Array.isArray(value) ? value : []
    return (
      <div className="space-y-2 mt-3">
        {soal.opsi?.map((o) => (
          <label key={o.id} className="flex items-start gap-2 cursor-pointer rounded-lg border p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={arr.includes(o.id)}
              onChange={() => {
                const next = arr.includes(o.id) ? arr.filter((x) => x !== o.id) : [...arr, o.id]
                onChange(next)
              }}
            />
            <span>{o.teks}</span>
          </label>
        ))}
      </div>
    )
  }
  if (soal.tipe === 'isian') {
    return (
      <input
        className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ketik jawaban…"
      />
    )
  }
  if (soal.tipe === 'uraian') {
    return (
      <textarea
        rows={5}
        className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tulis jawaban lengkap…"
      />
    )
  }
  return <p className="mt-3 text-xs text-slate-400">Tipe {soal.tipe} — form menyusul.</p>
}

function KerjakanKuis({ kuis, onSelesai }: { kuis: KuisLms; onSelesai: () => void }) {
  const [idx, setIdx] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const soal = kuis.soal?.[idx]

  async function kirim() {
    setBusy(true)
    try {
      const fn = httpsCallable(functions, 'nilaiKuisLms')
      const res = await fn({ kuisId: kuis.id, jawaban })
      alert('Jawaban terkirim.\n' + JSON.stringify((res.data as any)?.pesan ?? res.data))
      onSelesai()
    } catch (e: any) {
      alert(e.message || 'Gagal mengirim jawaban.')
    } finally {
      setBusy(false)
    }
  }

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
          <FormJawaban
            soal={soal}
            value={jawaban[soal.id]}
            onChange={(v) => setJawaban((prev) => ({ ...prev, [soal.id]: v }))}
          />
        </div>

        <div className="flex justify-between">
          <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="lms-btn-secondary text-sm">
            Sebelumnya
          </button>
          {idx < (kuis.soal?.length ?? 1) - 1 ? (
            <button type="button" onClick={() => setIdx((i) => i + 1)} className="lms-btn-primary text-sm">
              Berikutnya
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void kirim()} className="lms-btn-primary text-sm">
              {busy ? 'Mengirim…' : 'Selesai & Kirim'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

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
    const q = query(collection(db, 'lms_kuis'), where('kelas', '==', sesi.kelas), where('aktif', '==', true))
    getDocs(q)
      .then((snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KuisLms)))
      .catch((e) => setError(e.message || 'Gagal memuat kuis'))
  }, [sesi])

  if (aktif) return <KerjakanKuis kuis={aktif} onSelesai={() => setAktif(null)} />

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800">Kuis</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {list === null && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && <p className="text-slate-500">Belum ada kuis aktif.</p>}
      <ul className="space-y-3">
        {list?.map((k) => (
          <li key={k.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-slate-800">{k.judul}</div>
            <div className="text-xs text-slate-500 mt-1">
              {k.mapel} · {NAMA_JENIS_PENILAIAN[k.jenisPenilaian ?? 'latihan']} · {k.jumlahSoal} soal
              {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
            </div>
            <button type="button" className="mt-3 lms-btn-primary text-sm" onClick={() => setAktif(k)}>
              Mulai Kerjakan
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
      <div className="space-y-2 mt-4">
        {soal.opsi?.map((o, i) => (
          <label key={o.id} className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3.5 transition ${value === o.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" className="mt-0.5" name={soal.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span className="text-sm"><span className="font-medium text-slate-500 mr-1">{String.fromCharCode(65 + i)}.</span>{o.teks}</span>
          </label>
        ))}
      </div>
    )
  }
  if (soal.tipe === 'pgk') {
    const arr: string[] = Array.isArray(value) ? value : []
    return (
      <div className="space-y-2 mt-4">
        {soal.opsi?.map((o, i) => (
          <label key={o.id} className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3.5 transition ${arr.includes(o.id) ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="checkbox" className="mt-0.5" checked={arr.includes(o.id)} onChange={() => onChange(arr.includes(o.id) ? arr.filter((x) => x !== o.id) : [...arr, o.id])} />
            <span className="text-sm"><span className="font-medium text-slate-500 mr-1">{String.fromCharCode(65 + i)}.</span>{o.teks}</span>
          </label>
        ))}
      </div>
    )
  }
  if (soal.tipe === 'isian') {
    return <input className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Ketik jawaban singkat…" />
  }
  if (soal.tipe === 'uraian') {
    return <textarea rows={6} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tulis jawaban lengkap…" />
  }
  return <p className="mt-4 text-xs text-slate-400">Tipe soal ini belum didukung di pengerjaan online.</p>
}

function KerjakanKuis({ kuis, onSelesai }: { kuis: KuisLms; onSelesai: () => void }) {
  const [idx, setIdx] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [sisaDetik, setSisaDetik] = useState((kuis.durasiMenit ?? 0) * 60)
  const soalList = kuis.soal ?? []
  const soal = soalList[idx]
  const sudahJawab = (id: string) => jawaban[id] != null && jawaban[id] !== '' && !(Array.isArray(jawaban[id]) && jawaban[id].length === 0)

  useEffect(() => {
    if (!kuis.durasiMenit || kuis.durasiMenit <= 0) return
    const t = setInterval(() => setSisaDetik((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [kuis.durasiMenit])

  const menit = Math.floor(sisaDetik / 60)
  const detik = sisaDetik % 60
  const waktuHabis = kuis.durasiMenit && sisaDetik <= 0

  async function kirim() {
    if (waktuHabis) return
    setBusy(true)
    try {
      const fn = httpsCallable(functions, 'nilaiKuisLms')
      const res = await fn({ kuisId: kuis.id, jawaban })
      const data = res.data as any
      alert(`Selesai!\\nSkor: ${data?.skor ?? '-'} / ${data?.totalPoin ?? '-'}`)
      onSelesai()
    } catch (e: any) {
      alert(e.message || 'Gagal mengirim jawaban.')
    } finally {
      setBusy(false)
    }
  }

  if (!soal) return <div className="p-6 text-center text-slate-500">Tidak ada soal.</div>

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{kuis.judul}</div>
          <div className="text-xs text-slate-500">Soal {idx + 1} dari {soalList.length}</div>
        </div>
        <div className="flex items-center gap-3">
          {kuis.durasiMenit ? (
            <div className={`text-sm font-mono font-semibold px-3 py-1 rounded-full ${sisaDetik < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
              {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
            </div>
          ) : null}
          <button type="button" onClick={onSelesai} className="text-xs text-slate-500 hover:text-slate-700">Keluar</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-4">
        <aside className="bg-white rounded-xl border p-3 h-fit md:sticky md:top-20">
          <div className="text-xs font-semibold text-slate-500 mb-2">Navigasi</div>
          <div className="grid grid-cols-5 gap-1.5">
            {soalList.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-8 rounded text-xs font-medium transition ${
                  i === idx ? 'bg-violet-600 text-white' : sudahJawab(s.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-slate-400 space-y-0.5">
            <div><span className="inline-block w-2 h-2 rounded-sm bg-violet-600 mr-1" /> Sedang dikerjakan</div>
            <div><span className="inline-block w-2 h-2 rounded-sm bg-emerald-100 mr-1" /> Sudah dijawab</div>
          </div>
        </aside>

        <main className="bg-white rounded-xl border p-5">
          <div className="text-xs font-medium text-slate-400 mb-1">Soal {idx + 1}</div>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: soal.teks || '<p>(tanpa teks)</p>' }} />
          <FormJawaban soal={soal} value={jawaban[soal.id]} onChange={(v) => setJawaban((prev) => ({ ...prev, [soal.id]: v }))} />

          <div className="flex justify-between mt-6 pt-4 border-t">
            <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="lms-btn-secondary text-sm">
              ← Sebelumnya
            </button>
            {idx < soalList.length - 1 ? (
              <button type="button" onClick={() => setIdx((i) => i + 1)} className="lms-btn-primary text-sm">
                Berikutnya →
              </button>
            ) : (
              <button type="button" disabled={busy || !!waktuHabis} onClick={() => void kirim()} className="lms-btn-primary text-sm">
                {busy ? 'Mengirim…' : waktuHabis ? 'Waktu habis' : 'Selesai & Kirim'}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

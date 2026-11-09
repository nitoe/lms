import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import type { KuisLms, SoalKuis } from '../../types/kuis'
import { NAMA_JENIS_PENILAIAN } from '../../types/kuis'
import type { JawabanSoal } from '../../types/soal'
import SoalTampil from '../../components/soal/SoalTampil'
import '../../styles/soal.css'

/** Versi kunci progres — naikkan jika bentuk data berubah. */
const PROGRESS_PREFIX = 'lms_kuis_progress_v2_'

type Progress = {
  jawaban: Record<string, JawabanSoal>
  idx: number
  /**
   * Sisa waktu (detik) pada saat terakhir disimpan.
   * Timer bersifat pause saat siswa keluar: saat kembali, nilai ini dilanjutkan.
   */
  sisaDetik?: number
  updatedAt: number
}

function progressKey(siswaId: string, kuisId: string) {
  return `${PROGRESS_PREFIX}${siswaId}_${kuisId}`
}

function loadProgress(siswaId: string, kuisId: string): Progress | null {
  if (!siswaId || !kuisId) return null
  try {
    const raw = localStorage.getItem(progressKey(siswaId, kuisId))
    if (!raw) return null
    const p = JSON.parse(raw) as Progress
    if (!p || typeof p !== 'object') return null
    if (typeof p.jawaban !== 'object' || p.jawaban == null) p.jawaban = {}
    return p
  } catch {
    return null
  }
}

function saveProgress(siswaId: string, kuisId: string, p: Progress) {
  if (!siswaId || !kuisId) return
  try {
    localStorage.setItem(
      progressKey(siswaId, kuisId),
      JSON.stringify({ ...p, updatedAt: Date.now() }),
    )
  } catch {
    /* quota / private mode */
  }
}

function clearProgress(siswaId: string, kuisId: string) {
  if (!siswaId || !kuisId) return
  try {
    localStorage.removeItem(progressKey(siswaId, kuisId))
  } catch {
    /* ignore */
  }
}

export default function SiswaKuis() {
  const { sesi } = useSiswa()
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [aktif, setAktif] = useState<KuisLms | null>(null)
  const [error, setError] = useState('')

  // Field sesi: { id, nama, kelas } — bukan siswaId
  const siswaId = sesi?.id ?? ''

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

  if (aktif && sesi && siswaId) {
    return (
      <KerjakanKuis
        kuis={aktif}
        siswaId={siswaId}
        onSelesai={() => setAktif(null)}
      />
    )
  }

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800">Kuis</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {list === null && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && <p className="text-slate-500">Belum ada kuis aktif.</p>}
      <ul className="space-y-3">
        {list?.map((k) => {
          const saved = siswaId ? loadProgress(siswaId, k.id) : null
          const nJawab = saved ? Object.keys(saved.jawaban ?? {}).length : 0
          const sisa = saved?.sisaDetik
          return (
            <li key={k.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-800">{k.judul}</div>
              <div className="text-xs text-slate-500 mt-1">
                {k.mapel} · {NAMA_JENIS_PENILAIAN[k.jenisPenilaian ?? 'latihan']} · {k.jumlahSoal} soal
                {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
              </div>
              {nJawab > 0 && (
                <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded-full">
                  Progres tersimpan · {nJawab} soal terjawab
                  {typeof sisa === 'number' && k.durasiMenit
                    ? ` · sisa ${Math.floor(sisa / 60)}:${String(sisa % 60).padStart(2, '0')}`
                    : ''}
                </div>
              )}
              <button type="button" className="mt-3 lms-btn-primary text-sm" onClick={() => setAktif(k)}>
                {nJawab > 0 ? 'Lanjutkan' : 'Mulai Kerjakan'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function KerjakanKuis({
  kuis,
  siswaId,
  onSelesai,
}: {
  kuis: KuisLms
  siswaId: string
  onSelesai: () => void
}) {
  // Baca progres sekali di awal (bukan di render loop)
  const awalRef = useRef<Progress | null | undefined>(undefined)
  if (awalRef.current === undefined) {
    awalRef.current = loadProgress(siswaId, kuis.id)
  }
  const saved = awalRef.current

  const [idx, setIdx] = useState(() => {
    if (saved && typeof saved.idx === 'number') {
      return Math.min(Math.max(0, saved.idx), Math.max(0, (kuis.soal?.length ?? 1) - 1))
    }
    return 0
  })
  const [jawaban, setJawaban] = useState<Record<string, JawabanSoal>>(() => saved?.jawaban ?? {})
  const [busy, setBusy] = useState(false)
  const [sisaDetik, setSisaDetik] = useState(() => {
    // Lanjutkan sisa waktu yang tersimpan (mode pause saat keluar)
    if (saved && typeof saved.sisaDetik === 'number' && saved.sisaDetik >= 0) {
      return saved.sisaDetik
    }
    return (kuis.durasiMenit ?? 0) * 60
  })
  const [confirmKeluar, setConfirmKeluar] = useState(false)

  // Ref supaya flush saat unmount selalu memakai nilai terbaru
  const stateRef = useRef({ jawaban, idx, sisaDetik })
  stateRef.current = { jawaban, idx, sisaDetik }

  const soalList: SoalKuis[] = kuis.soal ?? []
  const soal = soalList[idx]
  const seed = `${siswaId}:${kuis.id}`
  const punyaTimer = !!(kuis.durasiMenit && kuis.durasiMenit > 0)

  const sudahJawab = useCallback(
    (id: string) => {
      const v = jawaban[id]
      if (v == null || v === '') return false
      if (Array.isArray(v) && v.length === 0) return false
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false
      return true
    },
    [jawaban],
  )

  function flushProgress() {
    const s = stateRef.current
    saveProgress(siswaId, kuis.id, {
      jawaban: s.jawaban,
      idx: s.idx,
      sisaDetik: punyaTimer ? s.sisaDetik : undefined,
      updatedAt: Date.now(),
    })
  }

  // Simpan progres setiap perubahan (jawaban / nomor / sisa waktu)
  useEffect(() => {
    saveProgress(siswaId, kuis.id, {
      jawaban,
      idx,
      sisaDetik: punyaTimer ? sisaDetik : undefined,
      updatedAt: Date.now(),
    })
  }, [jawaban, idx, sisaDetik, siswaId, kuis.id, punyaTimer])

  // Flush saat komponen dilepas (keluar / navigasi)
  useEffect(() => {
    return () => {
      flushProgress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId, kuis.id])

  // Timer: hitung mundur tiap detik
  useEffect(() => {
    if (!punyaTimer) return
    const t = setInterval(() => {
      setSisaDetik((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [punyaTimer])

  // Cegah refresh / tutup tab tanpa sengaja + flush progres
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      flushProgress()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId, kuis.id])

  // Sembunyikan navigasi bawah siswa selama mengerjakan
  useEffect(() => {
    const nav = document.querySelector('.sw-nav') as HTMLElement | null
    if (nav) nav.style.display = 'none'
    return () => {
      if (nav) nav.style.display = ''
    }
  }, [])

  const menit = Math.floor(sisaDetik / 60)
  const detik = sisaDetik % 60
  const waktuHabis = punyaTimer && sisaDetik <= 0

  async function kirim() {
    if (waktuHabis && Object.keys(jawaban).length === 0) return
    setBusy(true)
    try {
      const fn = httpsCallable(functions, 'nilaiKuisLms')
      const res = await fn({ kuisId: kuis.id, jawaban })
      const data = res.data as { skor?: number; totalPoin?: number }
      clearProgress(siswaId, kuis.id)
      alert(`Selesai!\nSkor: ${data?.skor ?? '-'} / ${data?.totalPoin ?? '-'}`)
      onSelesai()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mengirim jawaban.'
      alert(msg)
    } finally {
      setBusy(false)
    }
  }

  function mintaKeluar() {
    flushProgress()
    setConfirmKeluar(true)
  }

  function konfirmasiKeluar() {
    flushProgress()
    setConfirmKeluar(false)
    onSelesai()
  }

  if (!soal) {
    return (
      <div className="p-6 text-center text-slate-500">
        Tidak ada soal di kuis ini.
        <div className="mt-4">
          <button type="button" className="lms-btn-secondary text-sm" onClick={onSelesai}>
            Kembali
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{kuis.judul}</div>
          <div className="text-xs text-slate-500">
            Soal {idx + 1} dari {soalList.length}
            <span className="ml-2 text-emerald-600">· Progres tersimpan otomatis</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {punyaTimer ? (
            <div
              className={`text-sm font-mono font-semibold px-3 py-1 rounded-full ${
                sisaDetik < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
            </div>
          ) : null}
          <button type="button" onClick={mintaKeluar} className="text-xs text-slate-500 hover:text-slate-700">
            Keluar
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-4 pb-24">
        <aside className="bg-white rounded-xl border p-3 h-fit md:sticky md:top-20">
          <div className="text-xs font-semibold text-slate-500 mb-2">Navigasi soal</div>
          <div className="grid grid-cols-5 gap-1.5">
            {soalList.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-8 rounded text-xs font-medium transition ${
                  i === idx
                    ? 'bg-violet-600 text-white'
                    : sudahJawab(s.id)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-slate-400 space-y-0.5">
            <div>
              <span className="inline-block w-2 h-2 rounded-sm bg-violet-600 mr-1" /> Sedang dikerjakan
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-sm bg-emerald-100 mr-1" /> Sudah dijawab
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <SoalTampil
            soal={soal}
            nomor={idx + 1}
            jawaban={jawaban[soal.id]}
            onJawab={(j) => setJawaban((prev) => ({ ...prev, [soal.id]: j }))}
            seed={seed}
          />

          <div className="flex justify-between mt-4 pt-2">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => setIdx((i) => i - 1)}
              className="lms-btn-secondary text-sm"
            >
              ← Sebelumnya
            </button>
            {idx < soalList.length - 1 ? (
              <button type="button" onClick={() => setIdx((i) => i + 1)} className="lms-btn-primary text-sm">
                Berikutnya →
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || (!!waktuHabis && Object.keys(jawaban).length === 0)}
                onClick={() => void kirim()}
                className="lms-btn-primary text-sm"
              >
                {busy ? 'Mengirim…' : waktuHabis ? 'Waktu habis · Kirim' : 'Selesai & Kirim'}
              </button>
            )}
          </div>
        </main>
      </div>

      {confirmKeluar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <h2 className="font-bold text-slate-800 text-base">Keluar dari kuis?</h2>
            <p className="text-sm text-slate-600">
              Jawaban dan sisa waktu disimpan di perangkat ini. Saat kamu kembali, pengerjaan dilanjutkan
              dari soal dan timer terakhir.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" className="lms-btn-secondary text-sm" onClick={() => setConfirmKeluar(false)}>
                Lanjut mengerjakan
              </button>
              <button type="button" className="lms-btn-primary text-sm" onClick={konfirmasiKeluar}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

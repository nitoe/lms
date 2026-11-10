import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import type { KuisLms, SoalKuis } from '../../types/kuis'
import { adalahMapelTka } from '../../lib/tkaAkses'
import { NAMA_JENIS_PENILAIAN } from '../../types/kuis'
import type { JawabanSoal } from '../../types/soal'
import SoalTampil from '../../components/soal/SoalTampil'
import '../../styles/soal.css'

const PROGRESS_PREFIX = 'lms_kuis_progress_v2_'

type Progress = {
  jawaban: Record<string, JawabanSoal>
  idx: number
  sisaDetik?: number
  updatedAt: number
}

/** Ringkasan satu percobaan dari lms_jawaban. */
export type RiwayatPercobaan = {
  id: string
  skorOtomatis: number
  totalPoin: number
  percobaan: number
  status: string
  createdAtMs: number
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
    /* quota */
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

function tsMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'number') return v
  return 0
}

/** Skor ke skala 100 (satu desimal bila perlu). */
function skorKe100(skor: number, totalPoin: number): number {
  if (!totalPoin || totalPoin <= 0) return 0
  const n = (Number(skor) / Number(totalPoin)) * 100
  return Math.round(n * 10) / 10
}

/** Teks tampilan: "82,1" (skala 100). */
function formatSkor100(skor: number, totalPoin: number): string {
  const n = skorKe100(skor, totalPoin)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

async function muatRiwayat(siswaId: string, kuisId: string): Promise<RiwayatPercobaan[]> {
  const q = query(
    collection(db, 'lms_jawaban'),
    where('siswaId', '==', siswaId),
    where('kuisId', '==', kuisId),
  )
  const snap = await getDocs(q)
  const list: RiwayatPercobaan[] = snap.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      skorOtomatis: Number(x.skorOtomatis) || 0,
      totalPoin: Number(x.totalPoin) || 0,
      percobaan: Number(x.percobaan) || 1,
      status: String(x.status || 'selesai'),
      createdAtMs: tsMs(x.createdAt),
    }
  })
  list.sort((a, b) => b.createdAtMs - a.createdAtMs || b.percobaan - a.percobaan)
  return list
}

function formatWaktu(ms: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

type ModeKerja = {
  kuis: KuisLms
  /** true = mulai bersih (abaikan progres lokal) */
  dariAwal: boolean
}

type HasilKirim = {
  kuis: KuisLms
  skor: number
  totalPoin: number
  percobaan: number
  status: string
}

function kuisUntukSiswa(k: { aktif?: boolean; modePelaksanaan?: string; mapel?: string }) {
  // Kuis TKA tampil di menu TKA (SiswaTka), bukan di sini (ANTIREGRESI §77).
  return k.aktif === true && k.modePelaksanaan !== 'offline' && !adalahMapelTka(k.mapel)
}

export default function SiswaKuis() {
  const { sesi } = useSiswa()
  const siswaId = sesi?.id ?? ''
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [riwayatMap, setRiwayatMap] = useState<Record<string, RiwayatPercobaan[]>>({})
  const [mode, setMode] = useState<ModeKerja | null>(null)
  const [hasil, setHasil] = useState<HasilKirim | null>(null)
  const [error, setError] = useState('')
  const [konfirmUlangId, setKonfirmUlangId] = useState<string | null>(null)

  const muatSemua = useCallback(async () => {
    if (!sesi || !siswaId) return
    setError('')
    try {
      const q = query(
        collection(db, 'lms_kuis'),
        where('kelas', '==', sesi.kelas),
        where('aktif', '==', true),
      )
      const snap = await getDocs(q)
      const kuisList = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as KuisLms)
        .filter((k) => kuisUntukSiswa(k))
      setList(kuisList)

      const entries = await Promise.all(
        kuisList.map(async (k) => {
          try {
            return [k.id, await muatRiwayat(siswaId, k.id)] as const
          } catch {
            return [k.id, [] as RiwayatPercobaan[]] as const
          }
        }),
      )
      const map: Record<string, RiwayatPercobaan[]> = {}
      for (const [id, r] of entries) map[id] = r
      setRiwayatMap(map)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kuis')
    }
  }, [sesi, siswaId])

  useEffect(() => {
    void muatSemua()
  }, [muatSemua])

  function mulaiBaru(kuis: KuisLms) {
    clearProgress(siswaId, kuis.id)
    setHasil(null)
    setMode({ kuis, dariAwal: true })
  }

  function lanjutkan(kuis: KuisLms) {
    setHasil(null)
    setMode({ kuis, dariAwal: false })
  }

  if (hasil) {
    return (
      <HasilLatihan
        hasil={hasil}
        bolehUlang={(hasil.kuis.jenisPenilaian ?? 'latihan') === 'latihan'}
        onKembali={() => {
          setHasil(null)
          void muatSemua()
        }}
        onUlang={() => mulaiBaru(hasil.kuis)}
      />
    )
  }

  if (mode && siswaId) {
    return (
      <KerjakanKuis
        kuis={mode.kuis}
        siswaId={siswaId}
        dariAwal={mode.dariAwal}
        onSelesai={() => {
          setMode(null)
          void muatSemua()
        }}
        onKirimSukses={(h) => {
          setMode(null)
          setHasil(h)
          void muatSemua()
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-800">Kuis</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {list === null && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && <p className="text-slate-500">Belum ada kuis aktif.</p>}
      <ul className="space-y-3">
        {list?.map((k) => {
          const saved = siswaId ? loadProgress(siswaId, k.id) : null
          const nJawab = saved ? Object.keys(saved.jawaban ?? {}).length : 0
          const sisa = saved?.sisaDetik
          const riwayat = riwayatMap[k.id] ?? []
          const sudahKirim = riwayat.length > 0
          const terakhir = riwayat[0]
          const isLatihan = (k.jenisPenilaian ?? 'latihan') === 'latihan'
          const adaProgresLokal = nJawab > 0 && !sudahKirim

          return (
            <li key={k.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="font-semibold text-slate-800">{k.judul}</div>
              <div className="mt-1 text-xs text-slate-500">
                {k.mapel} · {NAMA_JENIS_PENILAIAN[k.jenisPenilaian ?? 'latihan']} · {k.jumlahSoal} soal
                {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
              </div>

              {sudahKirim && terakhir && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                  <div className="font-semibold">
                    Sudah dikerjakan {riwayat.length}×
                    {terakhir.totalPoin > 0
                      ? ` · skor terakhir ${formatSkor100(terakhir.skorOtomatis, terakhir.totalPoin)}`
                      : ''}
                  </div>
                  <div className="mt-0.5 text-emerald-800/80">
                    Percobaan ke-{terakhir.percobaan} · {formatWaktu(terakhir.createdAtMs)}
                  </div>
                  {riwayat.length > 1 && (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-emerald-800/70">
                      {riwayat.slice(0, 3).map((r) => (
                        <li key={r.id}>
                          #{r.percobaan}: {formatSkor100(r.skorOtomatis, r.totalPoin)} · {formatWaktu(r.createdAtMs)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {adaProgresLokal && (
                <div className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Draf tersimpan · {nJawab} soal terjawab
                  {typeof sisa === 'number' && k.durasiMenit
                    ? ` · sisa ${Math.floor(sisa / 60)}:${String(sisa % 60).padStart(2, '0')}`
                    : ''}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {!sudahKirim && (
                  <button
                    type="button"
                    className="lms-btn-primary text-sm"
                    onClick={() => (adaProgresLokal ? lanjutkan(k) : mulaiBaru(k))}
                  >
                    {adaProgresLokal ? 'Lanjutkan' : 'Mulai Kerjakan'}
                  </button>
                )}

                {sudahKirim && isLatihan && (
                  <>
                    <button
                      type="button"
                      className="lms-btn-primary text-sm"
                      onClick={() => setKonfirmUlangId(k.id)}
                    >
                      Kerjakan lagi dari awal
                    </button>
                  </>
                )}

                {sudahKirim && !isLatihan && (
                  <span className="self-center text-xs text-slate-500">
                    Jawaban sudah dikirim. Tidak dapat diubah.
                  </span>
                )}
              </div>

              {konfirmUlangId === k.id && (
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-800">Mulai dari awal?</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Kamu sudah mengirim jawaban sebelumnya. Jika lanjut, kamu mengerjakan semua soal dari
                    awal dan mengirim sebagai percobaan baru (ke-{(riwayat[0]?.percobaan ?? 0) + 1}).
                    Jawaban lama tetap tersimpan di riwayat.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="lms-btn-primary text-sm"
                      onClick={() => {
                        setKonfirmUlangId(null)
                        mulaiBaru(k)
                      }}
                    >
                      Ya, mulai dari awal
                    </button>
                    <button
                      type="button"
                      className="lms-btn-secondary text-sm"
                      onClick={() => setKonfirmUlangId(null)}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function HasilLatihan({
  hasil,
  bolehUlang,
  onKembali,
  onUlang,
}: {
  hasil: HasilKirim
  bolehUlang: boolean
  onKembali: () => void
  onUlang: () => void
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-sm font-medium text-slate-500">Hasil dikirim</div>
        <h2 className="mt-1 text-lg font-bold text-slate-800">{hasil.kuis.judul}</h2>
        <div className="mt-4 text-4xl font-bold text-muh-700">
          {formatSkor100(hasil.skor, hasil.totalPoin)}
          <span className="text-lg font-semibold text-slate-400"> / 100</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {hasil.skor} dari {hasil.totalPoin} poin
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Percobaan ke-{hasil.percobaan}
          {hasil.status === 'sebagian_manual' ? ' · sebagian dinilai guru' : ''}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className="lms-btn-secondary text-sm" onClick={onKembali}>
            Kembali ke daftar
          </button>
          {bolehUlang && (
            <button type="button" className="lms-btn-primary text-sm" onClick={onUlang}>
              Kerjakan lagi dari awal
            </button>
          )}
        </div>
        {bolehUlang && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Latihan boleh diulang. Setiap pengiriman dihitung sebagai percobaan terpisah.
          </p>
        )}
        {!bolehUlang && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Penilaian ini tidak dapat dikerjakan ulang dari akun siswa.
          </p>
        )}
      </div>
    </div>
  )
}

function KerjakanKuis({
  kuis,
  siswaId,
  dariAwal,
  onSelesai,
  onKirimSukses,
}: {
  kuis: KuisLms
  siswaId: string
  dariAwal: boolean
  onSelesai: () => void
  onKirimSukses: (h: HasilKirim) => void
}) {
  const awalRef = useRef<Progress | null | undefined>(undefined)
  if (awalRef.current === undefined) {
    awalRef.current = dariAwal ? null : loadProgress(siswaId, kuis.id)
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
    if (saved && typeof saved.sisaDetik === 'number' && saved.sisaDetik >= 0) return saved.sisaDetik
    return (kuis.durasiMenit ?? 0) * 60
  })
  const [confirmKeluar, setConfirmKeluar] = useState(false)

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

  useEffect(() => {
    saveProgress(siswaId, kuis.id, {
      jawaban,
      idx,
      sisaDetik: punyaTimer ? sisaDetik : undefined,
      updatedAt: Date.now(),
    })
  }, [jawaban, idx, sisaDetik, siswaId, kuis.id, punyaTimer])

  useEffect(() => {
    return () => {
      flushProgress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId, kuis.id])

  useEffect(() => {
    if (!punyaTimer) return
    const t = setInterval(() => setSisaDetik((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [punyaTimer])

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

  useEffect(() => {
    const nav = document.querySelector('.sw-nav') as HTMLElement | null
    const main = document.querySelector('.sw-main') as HTMLElement | null
    if (nav) nav.style.display = 'none'
    if (main) main.classList.add('sw-main--kuis')
    return () => {
      if (nav) nav.style.display = ''
      if (main) main.classList.remove('sw-main--kuis')
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
      const data = res.data as {
        skor?: number
        totalPoin?: number
        percobaan?: number
        status?: string
      }
      clearProgress(siswaId, kuis.id)
      onKirimSukses({
        kuis,
        skor: data?.skor ?? 0,
        totalPoin: data?.totalPoin ?? kuis.totalPoin ?? 0,
        percobaan: data?.percobaan ?? 1,
        status: data?.status ?? 'selesai',
      })
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
    <div className="sw-kuis-kerja">
      <header className="sw-kuis-kerja-head">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{kuis.judul}</div>
          <div className="text-xs text-slate-500">
            Soal {idx + 1} dari {soalList.length}
            <span className="ml-2 font-medium text-emerald-600">· Progres tersimpan</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {punyaTimer ? (
            <div
              className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${
                sisaDetik < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
            </div>
          ) : null}
          <button type="button" onClick={mintaKeluar} className="sw-kuis-keluar">
            Keluar
          </button>
        </div>
      </header>

      <div className="sw-kuis-kerja-body">
        <aside className="sw-kuis-nav" aria-label="Navigasi soal">
          <div className="mb-2 text-xs font-semibold text-slate-500">Navigasi soal</div>
          <div className="sw-kuis-nav-grid">
            {soalList.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                className={
                  i === idx
                    ? 'sw-kuis-nav-btn sw-kuis-nav-btn--aktif'
                    : sudahJawab(s.id)
                      ? 'sw-kuis-nav-btn sw-kuis-nav-btn--jawab'
                      : 'sw-kuis-nav-btn'
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="sw-kuis-nav-legend">
            <span>
              <i className="sw-kuis-dot sw-kuis-dot--aktif" /> Sedang dikerjakan
            </span>
            <span>
              <i className="sw-kuis-dot sw-kuis-dot--jawab" /> Sudah dijawab
            </span>
          </div>
        </aside>

        <div className="sw-kuis-soal min-w-0">
          <SoalTampil
            soal={soal}
            nomor={idx + 1}
            jawaban={jawaban[soal.id]}
            onJawab={(j) => setJawaban((prev) => ({ ...prev, [soal.id]: j }))}
            seed={seed}
          />
        </div>
      </div>

      <footer className="sw-kuis-kerja-foot">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => setIdx((i) => i - 1)}
          className="lms-btn-secondary text-sm"
        >
          ← Sebelumnya
        </button>
        <div className="sw-kuis-foot-meta">
          {idx + 1} / {soalList.length}
        </div>
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
      </footer>

      {confirmKeluar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-slate-800">Keluar dari kuis?</h2>
            <p className="text-sm text-slate-600">
              Jawaban dan sisa waktu disimpan di perangkat ini. Saat kamu kembali, pengerjaan dilanjutkan
              dari soal dan timer terakhir (selama belum dikirim).
            </p>
            <div className="flex justify-end gap-2 pt-1">
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

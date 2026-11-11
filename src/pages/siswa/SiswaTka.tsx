import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import { MAPEL_TKA, KELAS_TKA_BANK, adalahMapelTka, bolehTkaSiswa } from '../../lib/tkaAkses'
import type { KuisLms, SoalKuis } from '../../types/kuis'
import { NAMA_JENIS_PENILAIAN } from '../../types/kuis'
import type { JawabanSoal } from '../../types/soal'
import { NAMA_KOMPLEKSITAS, normalisasiKompleksitas } from '../../types/soal'
import SoalTampil from '../../components/soal/SoalTampil'
import StimulusSoal, { punyaStimulus } from '../../components/soal/StimulusSoal'
import '../../styles/soal.css'
import '../../styles/tka.css'

/**
 * Menu TKA siswa kelas 6. Memakai mesin kuis LMS (lms_kuis → nilaiKuisLms → lms_jawaban),
 * dengan tampilan pengerjaan yang disempurnakan: bacaan + soal dua kolom, penanda ragu-ragu,
 * tinjau sebelum kirim, zoom huruf, penghitung waktu berbasis tenggat, kirim otomatis saat
 * waktu habis. Jangan memanggil navigate() saat render (ANTIREGRESI §12).
 */

const PROGRESS_PREFIX = 'tka_progress_v1_'
const ZOOM_KEY = 'tka_zoom_v1'

type Progress = {
  jawaban: Record<string, JawabanSoal>
  ragu: string[]
  idx: number
  mulaiMs: number
  updatedAt: number
}

type Riwayat = {
  id: string
  skor: number
  totalPoin: number
  percobaan: number
  createdAtMs: number
}

type Hasil = {
  kuis: KuisLms
  skor: number
  totalPoin: number
  percobaan: number
  status: string
  detail: { soalId: string; benar: boolean }[]
}

/* ───────────── util ───────────── */

function progressKey(siswaId: string, kuisId: string) {
  return `${PROGRESS_PREFIX}${siswaId}_${kuisId}`
}

function muatProgress(siswaId: string, kuisId: string): Progress | null {
  try {
    const raw = localStorage.getItem(progressKey(siswaId, kuisId))
    if (!raw) return null
    const p = JSON.parse(raw) as Progress
    if (!p || typeof p !== 'object' || typeof p.mulaiMs !== 'number') return null
    if (typeof p.jawaban !== 'object' || p.jawaban == null) p.jawaban = {}
    if (!Array.isArray(p.ragu)) p.ragu = []
    return p
  } catch {
    return null
  }
}

function simpanProgress(siswaId: string, kuisId: string, p: Progress) {
  try {
    localStorage.setItem(progressKey(siswaId, kuisId), JSON.stringify({ ...p, updatedAt: Date.now() }))
  } catch {
    /* kuota penuh */
  }
}

function hapusProgress(siswaId: string, kuisId: string) {
  try {
    localStorage.removeItem(progressKey(siswaId, kuisId))
  } catch {
    /* ignore */
  }
}

/**
 * Jika guru mereset draf di server, hapus progress lokal yang lebih lama / sama.
 * Marker: lms_tka_progress_reset/{kuisId}_{siswaId}
 */
async function sinkronProgressSetelahReset(siswaId: string, kuisId: string): Promise<void> {
  if (!siswaId || !kuisId) return
  try {
    const id = `${kuisId}_${siswaId}`.slice(0, 150)
    const snap = await getDoc(doc(db, 'lms_tka_progress_reset', id))
    if (!snap.exists()) return
    const data = snap.data() as { resetAtMs?: number; resetAt?: { toMillis?: () => number } }
    const resetMs =
      Number(data.resetAtMs) ||
      (typeof data.resetAt?.toMillis === 'function' ? data.resetAt.toMillis() : 0)
    if (!resetMs) {
      hapusProgress(siswaId, kuisId)
      return
    }
    const lokal = muatProgress(siswaId, kuisId)
    if (!lokal || (Number(lokal.updatedAt) || 0) <= resetMs) {
      hapusProgress(siswaId, kuisId)
    }
  } catch {
    /* ignore — jangan gagalkan muat daftar */
  }
}


function waktuMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isNaN(t) ? 0 : t
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) return Number((v as { seconds: number }).seconds) * 1000
  return 0
}

function formatWaktu(ms: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function skor100(skor: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((Number(skor) / Number(total)) * 1000) / 10
}

function teksSkor(skor: number, total: number): string {
  const n = skor100(skor, total)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

type Jadwal = 'buka' | 'belum' | 'tutup'

function statusJadwal(k: KuisLms, sekarang: number): Jadwal {
  const mulai = waktuMs(k.waktuMulai)
  const selesai = waktuMs(k.waktuSelesai)
  if (mulai && sekarang < mulai) return 'belum'
  if (selesai && sekarang > selesai) return 'tutup'
  return 'buka'
}

function hitungBerakhir(k: KuisLms, mulaiMs: number): number | null {
  const kandidat: number[] = []
  if (k.durasiMenit && k.durasiMenit > 0) kandidat.push(mulaiMs + k.durasiMenit * 60_000)
  const selesai = waktuMs(k.waktuSelesai)
  if (selesai) kandidat.push(selesai)
  return kandidat.length ? Math.min(...kandidat) : null
}

type StatusJawab = 'kosong' | 'sebagian' | 'lengkap'

/** Kosong / sebagian (mis. tabel B/S baru terisi sebagian) / lengkap. */
function statusJawab(soal: SoalKuis, v: JawabanSoal | undefined): StatusJawab {
  if (v == null || v === '') return 'kosong'
  if (Array.isArray(v)) return v.length === 0 ? 'kosong' : 'lengkap'
  if (typeof v === 'object') {
    const n = Object.keys(v).length
    if (n === 0) return 'kosong'
    if (soal.tipe === 'bs') return n < soal.pernyataan.length ? 'sebagian' : 'lengkap'
    if (soal.tipe === 'jodoh') {
      const terisi = Object.values(v as Record<string, string>).filter(Boolean).length
      return terisi < soal.pasangan.length ? 'sebagian' : 'lengkap'
    }
    return 'lengkap'
  }
  return 'lengkap'
}

async function muatRiwayat(siswaId: string, kuisId: string): Promise<Riwayat[]> {
  const snap = await getDocs(
    query(collection(db, 'lms_jawaban'), where('siswaId', '==', siswaId), where('kuisId', '==', kuisId)),
  )
  const list = snap.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      skor: Number(x.skorOtomatis) || 0,
      totalPoin: Number(x.totalPoin) || 0,
      percobaan: Number(x.percobaan) || 1,
      createdAtMs: waktuMs(x.createdAt),
    }
  })
  list.sort((a, b) => b.createdAtMs - a.createdAtMs || b.percobaan - a.percobaan)
  return list
}

/* ───────────── halaman ───────────── */

export default function SiswaTka() {
  const { sesi } = useSiswa()
  if (!sesi) return <Navigate to="/siswa/masuk" replace />
  if (!bolehTkaSiswa(sesi.kelas)) return <Navigate to="/siswa" replace />
  return <TkaIsi siswaId={sesi.id} kelas={sesi.kelas} />
}

function TkaIsi({ siswaId, kelas }: { siswaId: string; kelas: string }) {
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [riwayatMap, setRiwayatMap] = useState<Record<string, Riwayat[]>>({})
  const [kerja, setKerja] = useState<{ kuis: KuisLms; dariAwal: boolean } | null>(null)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [galat, setGalat] = useState('')
  const [tokenUntuk, setTokenUntuk] = useState<KuisLms | null>(null)
  const [sekarang, setSekarang] = useState(() => Date.now())

  const muat = useCallback(async () => {
    setGalat('')
    try {
      // Hanya equality. Cabang rules siswa (ANTIREGRESI §99):
      //   rombel sendiri (6A/6B) DAN bank TKA kelas «6».
      // Query bank «6» tidak boleh digabung gagal dengan rombel — fetch terpisah.
      // Filter mapel TKA di klien (dan opsional where mapel in untuk bank).
      const byId = new Map<string, KuisLms>()
      const ambil = async (kelasQ: string) => {
        try {
          const snap = await getDocs(
            query(collection(db, 'lms_kuis'), where('kelas', '==', kelasQ), where('aktif', '==', true)),
          )
          for (const d of snap.docs) {
            byId.set(d.id, { id: d.id, ...d.data() } as KuisLms)
          }
        } catch (err) {
          console.warn('SiswaTka: gagal muat kuis kelas', kelasQ, err)
        }
      }
      await ambil(kelas)
      if (KELAS_TKA_BANK !== kelas) {
        await ambil(KELAS_TKA_BANK)
      }
      const kuis = [...byId.values()].filter(
        (k) => adalahMapelTka(k.mapel) && k.modePelaksanaan !== 'offline',
      )
      setList(kuis)
      // Hapus draf lokal jika guru sudah reset progress di server
      await Promise.all(kuis.map((k) => sinkronProgressSetelahReset(siswaId, k.id)))
      const pasang = await Promise.all(
        kuis.map(async (k) => {
          try {
            return [k.id, await muatRiwayat(siswaId, k.id)] as const
          } catch {
            return [k.id, [] as Riwayat[]] as const
          }
        }),
      )
      setRiwayatMap(Object.fromEntries(pasang))
    } catch (e: unknown) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat kuis TKA')
    }
  }, [kelas, siswaId])

  useEffect(() => {
    void muat()
  }, [muat])

  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  async function mulai(kuis: KuisLms, dariAwal: boolean) {
    await sinkronProgressSetelahReset(siswaId, kuis.id)
    if (dariAwal) hapusProgress(siswaId, kuis.id)
    setHasil(null)
    setTokenUntuk(null)
    setKerja({ kuis, dariAwal })
  }

  if (hasil) {
    return (
      <HasilTka
        hasil={hasil}
        onKembali={() => {
          setHasil(null)
          void muat()
        }}
      />
    )
  }

  if (kerja) {
    return (
      <KerjakanTka
        key={kerja.kuis.id}
        kuis={kerja.kuis}
        siswaId={siswaId}
        dariAwal={kerja.dariAwal}
        onKeluar={() => {
          setKerja(null)
          void muat()
        }}
        onSukses={(h) => {
          setKerja(null)
          setHasil(h)
          void muat()
        }}
      />
    )
  }

  const perMapel = MAPEL_TKA.map((m) => ({ mapel: m, kuis: (list ?? []).filter((k) => k.mapel === m) }))

  return (
    <div className="space-y-5">
      <section className="tka-hero">
        <div>
          <p className="tka-hero-kecil">Kelas {kelas}</p>
          <h1 className="tka-hero-judul">TKA — Tes Kemampuan Akademik</h1>
          <p className="tka-hero-isi">Kerjakan latihan dan try out TKA di sini. Jawabanmu tersimpan otomatis selama mengerjakan.</p>
        </div>
      </section>

      {galat && <div className="text-sm text-red-600">{galat}</div>}
      {list === null && !galat && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && (
        <div className="tka-kosong">Belum ada kuis TKA yang aktif untuk kelasmu. Tanyakan kepada gurumu.</div>
      )}

      {perMapel
        .filter((g) => g.kuis.length > 0)
        .map((g) => (
          <section key={g.mapel} className="space-y-3">
            <h2 className="tka-bagian">{g.mapel.replace(/^TKA\s+/, '')}</h2>
            <ul className="tka-daftar">
              {g.kuis.map((k) => {
                const riwayat = riwayatMap[k.id] ?? []
                const terakhir = riwayat[0]
                const sudah = riwayat.length > 0
                const dipublish = k.hasilDipublish === true
                const jadwal = statusJadwal(k, sekarang)
                const draf = muatProgress(siswaId, k.id)
                const nJawab = draf ? Object.keys(draf.jawaban).length : 0
                const adaDraf = !sudah && nJawab > 0
                const mulaiMs = waktuMs(k.waktuMulai)
                const selesaiMs = waktuMs(k.waktuSelesai)
                return (
                  <li key={k.id} className="tka-kartu">
                    <div className="tka-kartu-atas">
                      <h3 className="tka-kartu-judul">{k.judul}</h3>
                      {jadwal === 'belum' && <span className="tka-pil tka-pil--belum">Belum dibuka</span>}
                      {jadwal === 'tutup' && <span className="tka-pil tka-pil--tutup">Sudah ditutup</span>}
                      {jadwal === 'buka' && <span className="tka-pil tka-pil--buka">Dibuka</span>}
                    </div>
                    <p className="tka-kartu-meta">
                      {NAMA_JENIS_PENILAIAN[k.jenisPenilaian ?? 'latihan']} · {k.jumlahSoal} soal
                      {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
                    </p>
                    {(mulaiMs > 0 || selesaiMs > 0) && (
                      <p className="tka-kartu-meta">
                        {mulaiMs > 0 && <>Buka {formatWaktu(mulaiMs)}</>}
                        {mulaiMs > 0 && selesaiMs > 0 && ' · '}
                        {selesaiMs > 0 && <>Tutup {formatWaktu(selesaiMs)}</>}
                      </p>
                    )}

                    {sudah && terakhir && (
                      <div className="tka-riwayat">
                        <strong>
                          Sudah dikerjakan
                          {dipublish && terakhir.totalPoin > 0
                            ? ` · skor ${teksSkor(terakhir.skor, terakhir.totalPoin)}`
                            : !dipublish
                              ? ' · nilai belum dipublikasikan'
                              : ''}
                        </strong>
                        <span>{formatWaktu(terakhir.createdAtMs)}</span>
                      </div>
                    )}
                    {adaDraf && <div className="tka-draf">Draf tersimpan · {nJawab} soal terjawab</div>}

                    <div className="tka-kartu-aksi">
                      {jadwal === 'buka' && !sudah && (
                        <button
                          type="button"
                          className="lms-btn-primary text-sm"
                          onClick={() => {
                            if (adaDraf) void mulai(k, false)
                            else if (k.token?.trim()) setTokenUntuk(k)
                            else void mulai(k, true)
                          }}
                        >
                          {adaDraf ? 'Lanjutkan' : 'Mulai Kerjakan'}
                        </button>
                      )}
                      {sudah && (
                        <span className="text-xs text-slate-500">
                          TKA hanya satu kali pengerjaan. Jawaban tidak dapat diubah.
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

      {tokenUntuk && <DialogToken kuis={tokenUntuk} onBatal={() => setTokenUntuk(null)} onBenar={() => void mulai(tokenUntuk, true)} />}
    </div>
  )
}

/**
 * Pemeriksaan token DI KLIEN (sama seperti TKA lama): mencegah salah masuk, BUKAN proteksi
 * kriptografis — token ikut terbaca dari dokumen kuis. Penegakan server menyusul bila diperlukan.
 */
function DialogToken({ kuis, onBatal, onBenar }: { kuis: KuisLms; onBatal: () => void; onBenar: () => void }) {
  const [nilai, setNilai] = useState('')
  const [salah, setSalah] = useState(false)
  function cek() {
    if (nilai.trim().toLowerCase() === (kuis.token ?? '').trim().toLowerCase()) onBenar()
    else setSalah(true)
  }
  return (
    <div className="tka-overlay" role="dialog" aria-modal="true" aria-label="Masukkan token">
      <div className="tka-dialog">
        <h2 className="tka-dialog-judul">Masukkan token</h2>
        <p className="tka-dialog-isi">Minta token kepada gurumu untuk memulai «{kuis.judul}».</p>
        <input
          className="soal-input"
          autoFocus
          value={nilai}
          maxLength={40}
          onChange={(e) => {
            setNilai(e.target.value)
            setSalah(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && cek()}
          placeholder="Token"
        />
        {salah && <p className="text-xs text-red-600">Token tidak cocok. Periksa lagi.</p>}
        <div className="tka-dialog-aksi">
          <button type="button" className="lms-btn-secondary text-sm" onClick={onBatal}>
            Batal
          </button>
          <button type="button" className="lms-btn-primary text-sm" onClick={cek}>
            Mulai
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────── pengerjaan ───────────── */

function KerjakanTka({
  kuis,
  siswaId,
  dariAwal,
  onKeluar,
  onSukses,
}: {
  kuis: KuisLms
  siswaId: string
  dariAwal: boolean
  onKeluar: () => void
  onSukses: (h: Hasil) => void
}) {
  const soalList: SoalKuis[] = useMemo(() => kuis.soal ?? [], [kuis.soal])
  const awalRef = useRef<Progress | null | undefined>(undefined)
  if (awalRef.current === undefined) awalRef.current = dariAwal ? null : muatProgress(siswaId, kuis.id)
  const saved = awalRef.current

  const mulaiMs = useRef(saved?.mulaiMs ?? Date.now()).current
  const berakhirMs = useMemo(() => hitungBerakhir(kuis, mulaiMs), [kuis, mulaiMs])

  const [idx, setIdx] = useState(() =>
    saved && typeof saved.idx === 'number' ? Math.min(Math.max(0, saved.idx), Math.max(0, soalList.length - 1)) : 0,
  )
  const [jawaban, setJawaban] = useState<Record<string, JawabanSoal>>(() => saved?.jawaban ?? {})
  const [ragu, setRagu] = useState<string[]>(() => saved?.ragu ?? [])
  const [sekarang, setSekarang] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [galat, setGalat] = useState('')
  const [tinjau, setTinjau] = useState(false)
  const [konfirmKeluar, setKonfirmKeluar] = useState(false)
  const [zoom, setZoom] = useState(() => {
    try {
      const z = Number(localStorage.getItem(ZOOM_KEY))
      return z >= 0.9 && z <= 1.5 ? z : 1
    } catch {
      return 1
    }
  })
  const kirimRef = useRef(false)
  const stateRef = useRef({ jawaban, ragu, idx })
  stateRef.current = { jawaban, ragu, idx }

  const soal = soalList[idx]
  const sisaDetik = berakhirMs ? Math.max(0, Math.ceil((berakhirMs - sekarang) / 1000)) : null
  const waktuHabis = sisaDetik !== null && sisaDetik <= 0

  const status = useMemo(
    () => soalList.map((s) => statusJawab(s, jawaban[s.id])),
    [soalList, jawaban],
  )
  const nLengkap = status.filter((s) => s === 'lengkap').length
  const nKosong = status.filter((s) => s === 'kosong').length
  const nSebagian = status.length - nLengkap - nKosong

  const flush = useCallback(() => {
    const s = stateRef.current
    simpanProgress(siswaId, kuis.id, { jawaban: s.jawaban, ragu: s.ragu, idx: s.idx, mulaiMs, updatedAt: Date.now() })
  }, [siswaId, kuis.id, mulaiMs])

  useEffect(() => {
    flush()
  }, [jawaban, ragu, idx, flush])

  useEffect(() => () => flush(), [flush])

  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      flush()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [flush])

  // Sembunyikan nav bawah siswa saat mengerjakan (pola sama dengan SiswaKuis).
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

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [idx])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (tinjau || konfirmKeluar) return
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, soalList.length - 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [soalList.length, tinjau, konfirmKeluar])

  const kirim = useCallback(async () => {
    if (kirimRef.current) return
    kirimRef.current = true
    setBusy(true)
    setGalat('')
    try {
      const fn = httpsCallable(functions, 'nilaiKuisLms')
      const res = await fn({ kuisId: kuis.id, jawaban: stateRef.current.jawaban })
      const d = res.data as {
        skor?: number
        totalPoin?: number
        percobaan?: number
        status?: string
        detail?: { soalId: string; benar: boolean }[]
      }
      hapusProgress(siswaId, kuis.id)
      onSukses({
        kuis,
        skor: d?.skor ?? 0,
        totalPoin: d?.totalPoin ?? kuis.totalPoin ?? 0,
        percobaan: d?.percobaan ?? 1,
        status: d?.status ?? 'selesai',
        detail: Array.isArray(d?.detail) ? d.detail : [],
      })
    } catch (e: unknown) {
      kirimRef.current = false
      setBusy(false)
      setGalat(e instanceof Error ? e.message : 'Gagal mengirim jawaban. Periksa koneksi lalu coba lagi.')
    }
  }, [kuis, siswaId, onSukses])

  // Waktu habis → kirim otomatis (sekali).
  useEffect(() => {
    if (waktuHabis) void kirim()
  }, [waktuHabis, kirim])

  function setZoomSimpan(z: number) {
    const v = Math.min(1.5, Math.max(0.9, Math.round(z * 100) / 100))
    setZoom(v)
    try {
      localStorage.setItem(ZOOM_KEY, String(v))
    } catch {
      /* abaikan */
    }
  }

  function toggleRagu(id: string) {
    setRagu((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))
  }

  if (!soal) {
    return (
      <div className="p-6 text-center text-slate-500">
        Tidak ada soal di kuis ini.
        <div className="mt-4">
          <button type="button" className="lms-btn-secondary text-sm" onClick={onKeluar}>
            Kembali
          </button>
        </div>
      </div>
    )
  }

  const menit = sisaDetik !== null ? Math.floor(sisaDetik / 60) : 0
  const detik = sisaDetik !== null ? sisaDetik % 60 : 0
  const terakhir = idx === soalList.length - 1
  const pisah = punyaStimulus(soal)
  const persen = soalList.length ? Math.round((nLengkap / soalList.length) * 100) : 0

  return (
    <div className="sw-kuis-kerja tka-kerja" style={{ ['--tka-zoom' as string]: String(zoom) }}>
      <header className="sw-kuis-kerja-head tka-kepala">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{kuis.judul}</div>
          <div className="text-xs text-slate-500">
            Soal {idx + 1} dari {soalList.length}
            <span className="ml-2 font-medium text-emerald-600">· Tersimpan otomatis</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="tka-zoom" role="group" aria-label="Ukuran huruf">
            <button type="button" onClick={() => setZoomSimpan(zoom - 0.1)} disabled={zoom <= 0.9} aria-label="Perkecil huruf">
              A−
            </button>
            <button type="button" onClick={() => setZoomSimpan(zoom + 0.1)} disabled={zoom >= 1.5} aria-label="Perbesar huruf">
              A+
            </button>
          </div>
          {sisaDetik !== null && (
            <div className={`tka-timer ${sisaDetik < 60 ? 'tka-timer--habis' : sisaDetik < 300 ? 'tka-timer--hampir' : ''}`}>
              {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
            </div>
          )}
          <button type="button" onClick={() => { flush(); setKonfirmKeluar(true) }} className="sw-kuis-keluar">
            Keluar
          </button>
        </div>
        <div className="tka-progres" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100} aria-label="Soal terjawab">
          <div className="tka-progres-isi" style={{ width: `${persen}%` }} />
        </div>
      </header>

      <div className="tka-badan">
        <aside className="sw-kuis-nav tka-nav" aria-label="Navigasi soal">
          <div className="mb-2 text-xs font-semibold text-slate-500">
            {nLengkap}/{soalList.length} terjawab
          </div>
          <div className="sw-kuis-nav-grid">
            {soalList.map((s, i) => {
              const st = status[i]
              const kls = [
                'sw-kuis-nav-btn',
                i === idx ? 'sw-kuis-nav-btn--aktif' : st === 'lengkap' ? 'sw-kuis-nav-btn--jawab' : '',
                st === 'sebagian' && i !== idx ? 'tka-nav--sebagian' : '',
                ragu.includes(s.id) ? 'tka-nav--ragu' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button key={s.id} type="button" className={kls} onClick={() => setIdx(i)} aria-label={`Soal ${i + 1}${ragu.includes(s.id) ? ', ragu-ragu' : ''}`}>
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="sw-kuis-nav-legend">
            <span><i className="sw-kuis-dot sw-kuis-dot--aktif" /> Sekarang</span>
            <span><i className="sw-kuis-dot sw-kuis-dot--jawab" /> Terjawab</span>
            <span><i className="sw-kuis-dot tka-dot--sebagian" /> Sebagian</span>
            <span><i className="sw-kuis-dot tka-dot--ragu" /> Ragu-ragu</span>
          </div>
        </aside>

        <div className={`tka-isi ${pisah ? 'tka-isi--dua' : ''}`}>
          {pisah && <StimulusSoal soal={soal} className="tka-stimulus" />}
          <div className="tka-soal min-w-0">
            <SoalTampil
              soal={soal}
              nomor={idx + 1}
              jawaban={jawaban[soal.id]}
              onJawab={(j) => setJawaban((prev) => ({ ...prev, [soal.id]: j }))}
              seed={`${siswaId}:${kuis.id}`}
              tanpaStimulus={pisah}
            />
          </div>
        </div>
      </div>

      {galat && (
        <div className="tka-galat" role="alert">
          {galat}
        </div>
      )}

      <footer className="sw-kuis-kerja-foot tka-kaki">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="lms-btn-secondary text-sm">
          ← Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => toggleRagu(soal.id)}
          className={`tka-ragu ${ragu.includes(soal.id) ? 'tka-ragu--aktif' : ''}`}
          aria-pressed={ragu.includes(soal.id)}
        >
          ⚑ Ragu-ragu
        </button>
        {terakhir ? (
          <button type="button" onClick={() => setTinjau(true)} className="lms-btn-primary text-sm" disabled={busy}>
            Tinjau &amp; Kirim
          </button>
        ) : (
          <button type="button" onClick={() => setIdx((i) => i + 1)} className="lms-btn-primary text-sm">
            Berikutnya →
          </button>
        )}
      </footer>

      {!terakhir && (
        <div className="tka-tinjau-link">
          <button type="button" onClick={() => setTinjau(true)} className="text-xs font-semibold text-muh-600 hover:underline">
            Tinjau semua jawaban
          </button>
        </div>
      )}

      {tinjau && (
        <div className="tka-overlay" role="dialog" aria-modal="true" aria-label="Tinjau jawaban">
          <div className="tka-dialog tka-dialog--lebar">
            <h2 className="tka-dialog-judul">Tinjau sebelum kirim</h2>
            <div className="tka-ringkas">
              <div><b>{nLengkap}</b><span>terjawab</span></div>
              <div><b>{nSebagian}</b><span>sebagian</span></div>
              <div><b>{nKosong}</b><span>kosong</span></div>
              <div><b>{ragu.length}</b><span>ragu-ragu</span></div>
            </div>
            {(nKosong > 0 || nSebagian > 0 || ragu.length > 0) ? (
              <div className="tka-perhatian">
                <p className="text-xs text-slate-600">Ketuk nomor untuk kembali ke soal yang perlu diperiksa:</p>
                <div className="tka-perhatian-grid">
                  {soalList.map((s, i) =>
                    status[i] !== 'lengkap' || ragu.includes(s.id) ? (
                      <button
                        key={s.id}
                        type="button"
                        className={`sw-kuis-nav-btn ${status[i] === 'kosong' ? '' : status[i] === 'sebagian' ? 'tka-nav--sebagian' : 'sw-kuis-nav-btn--jawab'} ${ragu.includes(s.id) ? 'tka-nav--ragu' : ''}`}
                        onClick={() => {
                          setIdx(i)
                          setTinjau(false)
                        }}
                      >
                        {i + 1}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">Semua soal sudah terjawab.</p>
            )}
            {waktuHabis && <p className="text-sm font-semibold text-red-600">Waktu habis — jawaban dikirim otomatis.</p>}
            {galat && <p className="text-sm text-red-600">{galat}</p>}
            <div className="tka-dialog-aksi">
              <button type="button" className="lms-btn-secondary text-sm" onClick={() => setTinjau(false)} disabled={busy}>
                Kembali mengerjakan
              </button>
              <button type="button" className="lms-btn-primary text-sm" onClick={() => void kirim()} disabled={busy}>
                {busy ? 'Mengirim…' : 'Kirim jawaban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {waktuHabis && !tinjau && busy && (
        <div className="tka-overlay" role="alert">
          <div className="tka-dialog">
            <h2 className="tka-dialog-judul">Waktu habis</h2>
            <p className="tka-dialog-isi">Jawabanmu sedang dikirim…</p>
          </div>
        </div>
      )}

      {konfirmKeluar && (
        <div className="tka-overlay" role="dialog" aria-modal="true">
          <div className="tka-dialog">
            <h2 className="tka-dialog-judul">Keluar dari TKA?</h2>
            <p className="tka-dialog-isi">
              Jawabanmu tersimpan di perangkat ini dan bisa dilanjutkan. <b>Waktu tetap berjalan</b> selama kamu keluar.
            </p>
            <div className="tka-dialog-aksi">
              <button type="button" className="lms-btn-secondary text-sm" onClick={() => setKonfirmKeluar(false)}>
                Lanjut mengerjakan
              </button>
              <button type="button" className="lms-btn-primary text-sm" onClick={() => { flush(); onKeluar() }}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── hasil ───────────── */

function HasilTka({
  hasil,
  onKembali,
}: {
  hasil: Hasil
  onKembali: () => void
}) {
  // TKA: skor hanya ke siswa setelah guru set hasilDipublish (ANTIREGRESI §96).
  // TKA hanya 1× pengerjaan — tanpa ulang (ANTIREGRESI §99.11).
  const dipublish = hasil.kuis.hasilDipublish === true
  const peta = useMemo(() => new Map(hasil.detail.map((d) => [d.soalId, d.benar])), [hasil.detail])

  const rincian = useMemo(() => {
    type Baris = { nama: string; benar: number; total: number }
    const k = new Map<string, Baris>()
    const m = new Map<string, Baris>()
    for (const s of hasil.kuis.soal ?? []) {
      const benar = peta.get(s.id) === true ? 1 : 0
      const kn = NAMA_KOMPLEKSITAS[normalisasiKompleksitas(s.kompleksitas)]
      const kb = k.get(kn) ?? { nama: kn, benar: 0, total: 0 }
      kb.benar += benar
      kb.total += 1
      k.set(kn, kb)
      if (s.tipeMateri) {
        const mb = m.get(s.tipeMateri) ?? { nama: s.tipeMateri, benar: 0, total: 0 }
        mb.benar += benar
        mb.total += 1
        m.set(s.tipeMateri, mb)
      }
    }
    return { kompleksitas: [...k.values()], materi: [...m.values()] }
  }, [hasil.kuis.soal, peta])

  const tabel = (judul: string, baris: { nama: string; benar: number; total: number }[]) =>
    baris.length > 0 && (
      <div className="tka-rincian">
        <h3>{judul}</h3>
        <ul>
          {baris.map((b) => (
            <li key={b.nama}>
              <span>{b.nama}</span>
              <span className="tka-rincian-bar" aria-hidden>
                <i style={{ width: `${b.total ? (b.benar / b.total) * 100 : 0}%` }} />
              </span>
              <b>
                {b.benar}/{b.total}
              </b>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="tka-hasil">
        <div className="text-sm font-medium text-slate-500">Jawaban terkirim</div>
        <h2 className="mt-1 text-lg font-bold text-slate-800">{hasil.kuis.judul}</h2>
        {dipublish ? (
          <>
            <div className="tka-hasil-skor">
              {teksSkor(hasil.skor, hasil.totalPoin)}
              <span> / 100</span>
            </div>
            <p className="text-xs text-slate-500">
              {hasil.skor} dari {hasil.totalPoin} poin
              {hasil.status === 'sebagian_manual' ? ' · sebagian dinilai guru' : ''}
            </p>
            {tabel('Per tingkat kompleksitas', rincian.kompleksitas)}
            {tabel('Per materi', rincian.materi)}
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Nilai belum dipublikasikan</p>
            <p className="mt-1 text-xs text-amber-800/90">
              Jawabanmu sudah tersimpan. Skor dan rincian akan tampil setelah guru
              mempublikasikan hasil kuis ini.
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className="lms-btn-secondary text-sm" onClick={onKembali}>
            Kembali ke daftar
          </button>
        </div>
      </div>
    </div>
  )
}

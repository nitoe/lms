import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { muatSiswaKelas, type SiswaDasar } from '../lib/siswaAuth'
import { simpanJawabanOffline } from '../lib/offlineKuis'
import {
  daftarJawabanKuis,
  formatSkor100,
  ringkasPerSiswa,
  simpanNilaiManual,
  type JawabanKuis,
} from '../lib/jawabanKuis'
import { teksPolos } from '../lib/html'
import {
  analisisSiswaDenganAi,
  bolehAnalisisKuisAi,
  type HasilAnalisisSiswaAi,
} from '../lib/analisisKuisAi'
import { useAuth } from '../context/AuthContext'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_TIPE, type TipeSoal } from '../types/soal'
import RichView from './soal/RichView'
import { GambarSoal } from './soal/GambarSoal'

type Props = {
  kuis: KuisLms
  onTersimpan?: () => void
}

function kosongkanJawabanObj(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) return true
  return false
}

/**
 * Prefill form dari dokumen lms_jawaban (percobaan terbaru siswa).
 * Mengembalikan state jawaban + skorOverride (isian/uraian dari detail).
 */
function dariJawabanTersimpan(
  j: JawabanKuis,
  soalList: SoalKuis[],
): { jawaban: Record<string, unknown>; skorOverride: Record<string, number> } {
  const jawaban: Record<string, unknown> = {}
  const raw = j.jawaban ?? {}
  for (const s of soalList) {
    if (Object.prototype.hasOwnProperty.call(raw, s.id)) {
      jawaban[s.id] = raw[s.id]
    }
  }
  const skorOverride: Record<string, number> = {}
  for (const d of j.detail ?? []) {
    if (typeof d.skor !== 'number') continue
    const s = soalList.find((x) => x.id === d.soalId)
    if (!s) continue
    // Isian/uraian & yang dinilai manual: tampilkan skor tersimpan
    if (s.tipe === 'isian' || s.tipe === 'uraian' || d.butuhManual || d.dinilaiManual) {
      skorOverride[d.soalId] = d.skor
    }
  }
  return { jawaban, skorOverride }
}

/**
 * Input jawaban kuis offline: pilih siswa → isi/edit jawaban → nilai otomatis + AI.
 * - Memuat ulang jawaban & skor yang sudah tersimpan saat siswa dipilih ulang.
 * - Bantu AI memakai jawabanId percobaan terbaru (tanpa wajib simpan ulang dulu).
 */

/** Web Speech API (Chrome/Edge). null jika tidak didukung. */
type SpeechRecLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

function buatSpeechRecognition(): SpeechRecLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecLike
    webkitSpeechRecognition?: new () => SpeechRecLike
  }
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!SR) return null
  const r = new SR()
  r.lang = 'id-ID'
  r.continuous = true
  r.interimResults = true
  return r
}

export default function OfflineKuisPanel({ kuis, onTersimpan }: Props) {
  const { user } = useAuth()
  const bolehAi = bolehAnalisisKuisAi(user?.uid)
  const [siswaList, setSiswaList] = useState<SiswaDasar[] | null>(null)
  const [ringkasJawaban, setRingkasJawaban] = useState<Map<string, JawabanKuis>>(new Map())
  const [cari, setCari] = useState('')
  const [siswaId, setSiswaId] = useState('')
  const [jawaban, setJawaban] = useState<Record<string, unknown>>({})
  const [skorOverride, setSkorOverride] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [busyAi, setBusyAi] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [hasilAi, setHasilAi] = useState<HasilAnalisisSiswaAi | null>(null)
  const [lastJawabanId, setLastJawabanId] = useState<string | null>(null)
  const [lastSkor, setLastSkor] = useState<{ skor: number; total: number; percobaan: number } | null>(
    null,
  )
  /** true = form diisi dari data tersimpan; simpan ulang = percobaan baru */
  const [modeEditTersimpan, setModeEditTersimpan] = useState(false)

  /** Soal yang sedang direkam suara (isian/uraian). */
  const [dengarSoalId, setDengarSoalId] = useState<string | null>(null)
  const [dukungSuara, setDukungSuara] = useState(false)
  const recRef = useRef<SpeechRecLike | null>(null)

  const soal = kuis.soal ?? []
  const siswaNama = useMemo(
    () => siswaList?.find((s) => s.id === siswaId)?.nama || '',
    [siswaList, siswaId],
  )

  const muatStatus = useCallback(async () => {
    try {
      const list = await daftarJawabanKuis(kuis.id, kuis.kelas, kuis.mapel)
      const ringkas = ringkasPerSiswa(list)
      const map = new Map<string, JawabanKuis>()
      for (const j of ringkas) {
        if (j.siswaId) map.set(j.siswaId, j)
      }
      setRingkasJawaban(map)
      return map
    } catch {
      setRingkasJawaban(new Map())
      return new Map<string, JawabanKuis>()
    }
  }, [kuis.id, kuis.kelas, kuis.mapel])

  useEffect(() => {
    void (async () => {
      try {
        setSiswaList(await muatSiswaKelas(kuis.kelas))
      } catch {
        setSiswaList([])
      }
    })()
  }, [kuis.kelas])

  useEffect(() => {
    void muatStatus()
  }, [muatStatus])

  const siswaTerfilter = useMemo(() => {
    const list = siswaList || []
    const q = cari.trim().toLowerCase()
    const filtered = q ? list.filter((s) => s.nama.toLowerCase().includes(q)) : list
    return [...filtered].sort((a, b) => {
      const aDone = ringkasJawaban.has(a.id) ? 1 : 0
      const bDone = ringkasJawaban.has(b.id) ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return a.nama.localeCompare(b.nama, 'id')
    })
  }, [siswaList, cari, ringkasJawaban])

  const sudahIsiCount = useMemo(() => {
    let n = 0
    for (const s of soal) {
      if (!kosongkanJawabanObj(jawaban[s.id])) n += 1
    }
    return n
  }, [jawaban, soal])

  const setJawab = useCallback((soalId: string, v: unknown) => {
    setJawaban((prev) => ({ ...prev, [soalId]: v }))
  }, [])

  function kosongkanFormSaja() {
    setJawaban({})
    setSkorOverride({})
    setHasilAi(null)
    setInfo('')
    setError('')
  }

  /** Muat form dari dokumen tersimpan (jika ada). */
  function muatDariTersimpan(j: JawabanKuis) {
    const { jawaban: jw, skorOverride: so } = dariJawabanTersimpan(j, soal)
    setJawaban(jw)
    setSkorOverride(so)
    setLastJawabanId(j.id)
    setLastSkor({
      skor: j.skorOtomatis,
      total: j.totalPoin,
      percobaan: j.percobaan,
    })
    setModeEditTersimpan(true)
    setHasilAi(null)
    setError('')
    setInfo(
      `Memuat percobaan #${j.percobaan} (skor ${formatSkor100(j.skorOtomatis, j.totalPoin)}/100). ` +
        `Ubah jawaban lalu simpan = percobaan baru. Bantu AI & skor manual memakai data tersimpan ini.`,
    )
  }

  function pilihSiswa(id: string) {
    setSiswaId(id)
    setHasilAi(null)
    setError('')
    setInfo('')
    if (!id) {
      setJawaban({})
      setSkorOverride({})
      setLastJawabanId(null)
      setLastSkor(null)
      setModeEditTersimpan(false)
      return
    }
    const existing = ringkasJawaban.get(id)
    if (existing) {
      muatDariTersimpan(existing)
    } else {
      setJawaban({})
      setSkorOverride({})
      setLastJawabanId(null)
      setLastSkor(null)
      setModeEditTersimpan(false)
    }
  }

  function mulaiPercobaanBaru() {
    kosongkanFormSaja()
    setLastJawabanId(null)
    setLastSkor(null)
    setModeEditTersimpan(false)
    setInfo('Form dikosongkan. Simpan akan membuat percobaan baru.')
  }

  async function simpan() {
    if (!siswaId) {
      setError('Pilih siswa terlebih dahulu.')
      return
    }
    if (sudahIsiCount < soal.length) {
      const ok = window.confirm(
        `Baru ${sudahIsiCount} dari ${soal.length} soal yang diisi. Simpan tetap?`,
      )
      if (!ok) return
    }
    setBusy(true)
    setError('')
    setInfo('')
    setHasilAi(null)
    try {
      const res = await simpanJawabanOffline({
        kuisId: kuis.id,
        siswaId,
        siswaNama,
        jawaban: jawaban as Record<string, never>,
        skorOverride: Object.keys(skorOverride).length ? skorOverride : undefined,
      })
      setLastJawabanId(res.jawabanId)
      setLastSkor({ skor: res.skor, total: res.totalPoin, percobaan: res.percobaan })
      setModeEditTersimpan(true)
      setInfo(
        `Tersimpan. Skor ${formatSkor100(res.skor, res.totalPoin)}/100 (${res.skor}/${res.totalPoin} poin) · percobaan #${res.percobaan}` +
          (res.status === 'sebagian_manual' ? ' · ada uraian perlu dinilai' : '') +
          (bolehAi ? ' · Anda bisa memakai Bantu nilai AI sekarang.' : ''),
      )
      await muatStatus()
      onTersimpan?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function bantuNilaiAi() {
    if (!lastJawabanId) {
      setError(
        'Belum ada dokumen jawaban tersimpan. Simpan dulu (atau pilih siswa yang sudah diinput), lalu bantu nilai AI.',
      )
      return
    }
    setBusyAi(true)
    setError('')
    try {
      const h = await analisisSiswaDenganAi(kuis.id, lastJawabanId)
      setHasilAi(h)
      const next: Record<string, number> = { ...skorOverride }
      for (const p of h.penilaian) {
        if (typeof p.skor === 'number') next[p.soalId] = p.skor
      }
      setSkorOverride(next)
      setInfo(
        `Saran skor AI siap (${h.penilaian.length} butir). Tinjau di bawah, lalu klik «Terapkan skor AI ke nilai».`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memanggil AI.')
    } finally {
      setBusyAi(false)
    }
  }

  async function terapkanSkorAi() {
    if (!hasilAi || !lastJawabanId) {
      setError('Tidak ada saran AI atau dokumen jawaban. Jalankan Bantu nilai AI dulu.')
      return
    }
    if (!hasilAi.penilaian.length) {
      setError('AI tidak mengembalikan penilaian butir isian/uraian.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let ok = 0
      for (const p of hasilAi.penilaian) {
        await simpanNilaiManual({
          jawabanId: lastJawabanId,
          soalId: p.soalId,
          skor: p.skor,
        })
        ok += 1
      }
      setInfo(`Skor AI diterapkan pada ${ok} butir isian/uraian.`)
      const map = await muatStatus()
      const j = siswaId ? map.get(siswaId) : undefined
      if (j) {
        setLastSkor({ skor: j.skorOtomatis, total: j.totalPoin, percobaan: j.percobaan })
        // Sinkron skorOverride dari detail terbaru
        const { skorOverride: so } = dariJawabanTersimpan(j, soal)
        setSkorOverride(so)
      }
      onTersimpan?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menerapkan skor AI.')
    } finally {
      setBusy(false)
    }
  }

  function soalTerisi(soalId: string): boolean {
    return !kosongkanJawabanObj(jawaban[soalId])
  }

  useEffect(() => {
    setDukungSuara(!!buatSpeechRecognition())
    return () => {
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
      recRef.current = null
    }
  }, [])

  function stopDengar() {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    recRef.current = null
    setDengarSoalId(null)
  }

  function mulaiDengar(soalId: string) {
    if (dengarSoalId === soalId) {
      stopDengar()
      return
    }
    stopDengar()
    const rec = buatSpeechRecognition()
    if (!rec) {
      setError('Peramban tidak mendukung input suara. Gunakan Chrome/Edge, atau ketik manual.')
      return
    }
    rec.onresult = (ev) => {
      let potongan = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i]
        if (row && row.isFinal) potongan += row[0].transcript
      }
      if (!potongan.trim()) return
      setJawaban((prev) => {
        const cur = typeof prev[soalId] === 'string' ? String(prev[soalId]) : ''
        const gap = cur && !/\s$/.test(cur) ? ' ' : ''
        return { ...prev, [soalId]: cur + gap + potongan.trim() }
      })
    }
    rec.onerror = (ev) => {
      const code = ev?.error || ''
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Izin mikrofon ditolak. Izinkan mikrofon di pengaturan peramban, lalu coba lagi.')
      } else if (code && code !== 'aborted' && code !== 'no-speech') {
        setError(`Input suara gagal (${code}). Coba lagi atau ketik manual.`)
      }
      setDengarSoalId(null)
      recRef.current = null
    }
    rec.onend = () => {
      // Hentikan UI bila recognition berakhir sendiri
      setDengarSoalId((cur) => (cur === soalId ? null : cur))
      if (recRef.current === rec) recRef.current = null
    }
    try {
      rec.start()
      recRef.current = rec
      setDengarSoalId(soalId)
      setError('')
      setInfo('Mendengarkan… ucapkan jawaban siswa. Klik lagi untuk berhenti.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak bisa memulai input suara.')
      setDengarSoalId(null)
    }
  }

  function renderInput(s: SoalKuis) {

    const val = jawaban[s.id]
    if (s.tipe === 'pg') {
      return (
        <div className="mt-3 space-y-2">
          {(s.opsi || []).map((o) => {
            const aktif = val === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setJawab(s.id, o.id)}
                className={`flex w-full min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  aktif
                    ? 'border-muh-500 bg-muh-50 ring-2 ring-muh-200'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                    aktif
                      ? 'border-muh-600 bg-muh-600 text-white'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                  aria-hidden
                >
                  {o.id.toUpperCase().slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 text-slate-800">{o.teks}</span>
                {o.gambarId ? (
                  <GambarSoal id={o.gambarId} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : null}
              </button>
            )
          })}
        </div>
      )
    }
    if (s.tipe === 'pgk') {
      const arr = Array.isArray(val) ? (val as string[]) : []
      return (
        <div className="mt-3 space-y-2">
          {(s.opsi || []).map((o) => {
            const on = arr.includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  const next = on ? arr.filter((x) => x !== o.id) : [...arr, o.id]
                  setJawab(s.id, next)
                }}
                className={`flex w-full min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  on
                    ? 'border-muh-500 bg-muh-50 ring-2 ring-muh-200'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-bold ${
                    on
                      ? 'border-muh-600 bg-muh-600 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                  }`}
                  aria-hidden
                >
                  {on ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 text-slate-800">{o.teks}</span>
                {o.gambarId ? (
                  <GambarSoal id={o.gambarId} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : null}
              </button>
            )
          })}
        </div>
      )
    }
    if (s.tipe === 'bs') {
      const obj = (val && typeof val === 'object' && !Array.isArray(val) ? val : {}) as Record<
        string,
        boolean
      >
      return (
        <div className="mt-3 space-y-3">
          {(s.pernyataan || []).map((p) => {
            const v = obj[p.id]
            const pilihB = v === true
            const pilihS = v === false
            return (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <p className="min-w-0 flex-1 text-sm leading-snug text-slate-800">
                  {teksPolos(p.teks)}
                </p>
                <div
                  className="flex shrink-0 gap-2 self-end sm:self-center"
                  role="group"
                  aria-label={`Benar atau salah: ${teksPolos(p.teks).slice(0, 40)}`}
                >
                  <button
                    type="button"
                    onClick={() => setJawab(s.id, { ...obj, [p.id]: true })}
                    className={`inline-flex min-h-11 min-w-[3.25rem] items-center justify-center rounded-xl border-2 px-4 text-sm font-bold transition ${
                      pilihB
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                    aria-pressed={pilihB}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setJawab(s.id, { ...obj, [p.id]: false })}
                    className={`inline-flex min-h-11 min-w-[3.25rem] items-center justify-center rounded-xl border-2 px-4 text-sm font-bold transition ${
                      pilihS
                        ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50'
                    }`}
                    aria-pressed={pilihS}
                  >
                    S
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )
    }
    if (s.tipe === 'jodoh') {
      const obj = (val && typeof val === 'object' && !Array.isArray(val) ? val : {}) as Record<
        string,
        string
      >
      const kananIds = (s.pasangan || []).map((p) => p.id)
      return (
        <div className="mt-3 space-y-3">
          {(s.pasangan || []).map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="min-w-0 flex-1 text-sm text-slate-800">{teksPolos(p.kiri)}</span>
              <select
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-muh-500 focus:outline-none focus:ring-2 focus:ring-muh-200 sm:max-w-xs"
                value={obj[p.id] || ''}
                onChange={(e) => setJawab(s.id, { ...obj, [p.id]: e.target.value })}
              >
                <option value="">— pilih —</option>
                {kananIds.map((id) => {
                  const pair = s.pasangan.find((x) => x.id === id)
                  return (
                    <option key={id} value={id}>
                      {pair ? teksPolos(pair.kanan) : id}
                    </option>
                  )
                })}
              </select>
            </div>
          ))}
        </div>
      )
    }
    // isian / uraian
    const teksIsian = typeof val === 'string' ? val : ''
    const sedangDengar = dengarSoalId === s.id
    return (
      <div className="mt-2 space-y-2">
        <div className="relative">
          <textarea
            rows={s.tipe === 'uraian' ? 4 : 2}
            className={`w-full rounded-lg border px-3 py-2 pr-12 text-sm shadow-sm focus:outline-none focus:ring-2 ${
              sedangDengar
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                : 'border-slate-300 focus:border-muh-500 focus:ring-muh-200'
            }`}
            value={teksIsian}
            onChange={(e) => setJawab(s.id, e.target.value)}
            placeholder={
              s.tipe === 'uraian'
                ? 'Jawaban uraian siswa… (ketik atau pakai mikrofon)'
                : 'Jawaban isian… (ketik atau pakai mikrofon)'
            }
          />
          {dukungSuara ? (
            <button
              type="button"
              title={sedangDengar ? 'Berhenti merekam' : 'Input suara (Bahasa Indonesia)'}
              aria-pressed={sedangDengar}
              onClick={() => mulaiDengar(s.id)}
              className={`absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${
                sedangDengar
                  ? 'border-rose-500 bg-rose-600 text-white shadow animate-pulse'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-muh-300 hover:bg-muh-50 hover:text-muh-800'
              }`}
            >
              <span aria-hidden>{sedangDengar ? '■' : '🎤'}</span>
              <span className="sr-only">{sedangDengar ? 'Berhenti' : 'Mikrofon'}</span>
            </button>
          ) : null}
        </div>
        {sedangDengar ? (
          <p className="text-[11px] font-medium text-rose-700">
            Mendengarkan… klik tombol mikrofon lagi untuk berhenti. Teks ditambahkan otomatis.
          </p>
        ) : dukungSuara ? (
          <p className="text-[11px] text-slate-500">
            Tips: klik 🎤 lalu ucapkan jawaban siswa (Bahasa Indonesia). Bisa dikoreksi manual setelahnya.
          </p>
        ) : null}
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          Skor (opsional, maks {s.poin}
          {bolehAi ? ', bisa dari AI' : ''})
          <input
            type="number"
            min={0}
            max={Number(s.poin) || 1}
            step={0.5}
            className="w-20 rounded border border-slate-300 px-2 py-1"
            value={skorOverride[s.id] ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setSkorOverride((prev) => {
                const n = { ...prev }
                if (v === '') delete n[s.id]
                else n[s.id] = Number(v)
                return n
              })
            }}
          />
          {lastJawabanId && skorOverride[s.id] !== undefined && (
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-muh-700 hover:bg-muh-50"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError('')
                  try {
                    await simpanNilaiManual({
                      jawabanId: lastJawabanId,
                      soalId: s.id,
                      skor: Number(skorOverride[s.id]),
                    })
                    setInfo(`Skor soal ${s.poin} poin disimpan.`)
                    const map = await muatStatus()
                    const j = siswaId ? map.get(siswaId) : undefined
                    if (j) {
                      setLastSkor({
                        skor: j.skorOtomatis,
                        total: j.totalPoin,
                        percobaan: j.percobaan,
                      })
                    }
                    onTersimpan?.()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Gagal menyimpan skor.')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Simpan skor ini
            </button>
          )}
        </label>
      </div>
    )
  }

  const totalSiswa = siswaList?.length ?? 0
  const sudahInput = ringkasJawaban.size
  const statusSiswaAktif = siswaId ? ringkasJawaban.get(siswaId) : undefined

  return (
    <div className="space-y-4 pb-28">
      {/* Header + pilih siswa */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Input jawaban offline</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Guru memasukkan jawaban siswa. Sistem menilai otomatis dengan kunci di server.
              Uraian / skor khusus bisa diisi manual
              {bolehAi ? ' atau dibantu AI setelah ada dokumen jawaban tersimpan.' : '.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              {sudahInput}/{totalSiswa} siswa sudah diinput
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              {soal.length} soal · {kuis.totalPoin ?? 0} poin
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-semibold text-slate-600">Cari siswa</span>
            <input
              type="search"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-muh-500 focus:outline-none focus:ring-2 focus:ring-muh-200"
              placeholder="Ketik nama…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-semibold text-slate-600">Siswa (kelas {kuis.kelas})</span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={siswaId}
              onChange={(e) => pilihSiswa(e.target.value)}
            >
              <option value="">— pilih siswa —</option>
              {siswaTerfilter.map((s) => {
                const j = ringkasJawaban.get(s.id)
                const label = j
                  ? `${s.nama} · ✓ ${formatSkor100(j.skorOtomatis, j.totalPoin)}/100`
                  : s.nama
                return (
                  <option key={s.id} value={s.id}>
                    {label}
                  </option>
                )
              })}
            </select>
          </label>
        </div>

        {statusSiswaAktif && modeEditTersimpan && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-semibold">Data tersimpan dimuat</span>
            <span>
              skor {formatSkor100(statusSiswaAktif.skorOtomatis, statusSiswaAktif.totalPoin)}
              /100 · percobaan #{statusSiswaAktif.percobaan}
              {statusSiswaAktif.sumber === 'offline' ? ' · offline' : ''}
            </span>
            <button
              type="button"
              className="ml-auto rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
              onClick={() => mulaiPercobaanBaru()}
            >
              Kosongkan → percobaan baru
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {info}
        </div>
      )}

      {siswaId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{siswaNama}</p>
              <p className="text-[11px] text-slate-500">
                {sudahIsiCount}/{soal.length} soal terisi
                {lastJawabanId ? ` · id jawaban ${lastJawabanId.slice(0, 8)}…` : ' · belum tersimpan'}
              </p>
            </div>
            <div className="h-2 w-40 max-w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-muh-500 transition-all"
                style={{
                  width: `${soal.length ? Math.round((sudahIsiCount / soal.length) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <ol className="space-y-3">
            {soal.map((s, i) => {
              const terisi = soalTerisi(s.id)
              return (
                <li
                  key={s.id}
                  className={
                    'overflow-hidden rounded-2xl border bg-white shadow-sm ' +
                    (terisi ? 'border-emerald-200' : 'border-slate-200')
                  }
                >
                  <div
                    className={
                      'border-b px-4 py-2.5 ' +
                      (terisi ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/80')
                    }
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                        {i + 1}
                      </span>
                      <span className="inline-flex rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe}
                      </span>
                      <span className="text-xs text-slate-400">{s.poin} poin</span>
                      {terisi && (
                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          terisi
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm text-slate-800">
                      <RichView html={s.teks} className="soal-rich-view--compact" />
                      {!s.teks && <span className="text-slate-400">(tanpa teks)</span>}
                    </div>
                    {s.gambarId ? (
                      <div className="mt-2">
                        <GambarSoal id={s.gambarId} className="max-h-40 rounded-lg object-contain" />
                      </div>
                    ) : null}
                  </div>
                  <div className="px-4 py-3">{renderInput(s)}</div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {hasilAi && (
        <div className="rounded-2xl border border-muh-100 bg-muh-50/30 p-4 text-sm">
          <p className="font-semibold text-muh-900">Saran AI</p>
          <p className="mt-1 text-slate-700">{hasilAi.ringkasSiswa}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {hasilAi.penilaian.map((p) => (
              <li key={p.soalId}>
                Soal {p.no}: <strong>{p.skor}/{p.poinMaks}</strong> — {p.alasan}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky action bar */}
      {siswaId && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:static sm:rounded-2xl sm:border sm:shadow-sm sm:backdrop-blur-none">
          {/* justify-start + tanpa mx-auto: tetap kiri di semua tingkat zoom */}
          <div className="flex w-full flex-wrap items-center justify-start gap-2">
            <button
              type="button"
              className="lms-btn-primary text-sm"
              disabled={busy}
              onClick={() => void simpan()}
            >
              {busy ? 'Menyimpan & menilai…' : 'Simpan & nilai otomatis'}
            </button>
            {bolehAi && (
              <button
                type="button"
                className="lms-btn-secondary text-sm"
                disabled={busyAi || !lastJawabanId}
                onClick={() => void bantuNilaiAi()}
                title={
                  !lastJawabanId
                    ? 'Simpan dulu atau pilih siswa yang sudah diinput agar AI bisa membaca jawaban'
                    : 'AI menilai isian/uraian vs kunci'
                }
              >
                {busyAi ? 'AI menilai…' : 'Bantu nilai AI (isian/uraian)'}
              </button>
            )}
            {hasilAi && bolehAi && lastJawabanId && (
              <button
                type="button"
                className="lms-btn-primary text-sm"
                disabled={busy}
                onClick={() => void terapkanSkorAi()}
              >
                Terapkan skor AI ke nilai
              </button>
            )}
            {lastSkor && (
              <button
                type="button"
                className="lms-btn-secondary text-sm"
                disabled={busy}
                onClick={() => {
                  const idx = siswaTerfilter.findIndex((s) => s.id === siswaId)
                  const next =
                    siswaTerfilter.slice(idx + 1).find((s) => !ringkasJawaban.has(s.id)) ??
                    siswaTerfilter.find((s) => !ringkasJawaban.has(s.id) && s.id !== siswaId)
                  if (next) pilihSiswa(next.id)
                  else {
                    setSiswaId('')
                    setJawaban({})
                    setSkorOverride({})
                    setLastJawabanId(null)
                    setLastSkor(null)
                    setModeEditTersimpan(false)
                    setInfo('Semua siswa di daftar sudah diinput (atau tidak ada yang tersisa).')
                  }
                }}
              >
                Siswa berikutnya (belum diinput)
              </button>
            )}
            <button
              type="button"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
              disabled={busy}
              onClick={() => mulaiPercobaanBaru()}
            >
              Kosongkan form
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

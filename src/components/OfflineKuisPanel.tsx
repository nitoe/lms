import { useCallback, useEffect, useMemo, useState } from 'react'
import { muatSiswaKelas, type SiswaDasar } from '../lib/siswaAuth'
import { simpanJawabanOffline } from '../lib/offlineKuis'
import { simpanNilaiManual } from '../lib/jawabanKuis'
import { teksPolos } from '../lib/html'
import {
  analisisSiswaDenganAi,
  bolehAnalisisKuisAi,
  type HasilAnalisisSiswaAi,
} from '../lib/analisisKuisAi'
import { useAuth } from '../context/AuthContext'
import { formatSkor100 } from '../lib/jawabanKuis'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_TIPE, type TipeSoal } from '../types/soal'

type Props = {
  kuis: KuisLms
  onTersimpan?: () => void
}

/**
 * Input jawaban kuis offline: pilih siswa → isi jawaban → sistem nilai vs kunci.
 * Bantu AI isian/uraian hanya akun AI.
 */
export default function OfflineKuisPanel({ kuis, onTersimpan }: Props) {
  const { user } = useAuth()
  const bolehAi = bolehAnalisisKuisAi(user?.uid)
  const [siswaList, setSiswaList] = useState<SiswaDasar[] | null>(null)
  const [siswaId, setSiswaId] = useState('')
  const [jawaban, setJawaban] = useState<Record<string, unknown>>({})
  const [skorOverride, setSkorOverride] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [busyAi, setBusyAi] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [hasilAi, setHasilAi] = useState<HasilAnalisisSiswaAi | null>(null)
  const [lastJawabanId, setLastJawabanId] = useState<string | null>(null)

  const soal = kuis.soal ?? []
  const siswaNama = useMemo(
    () => siswaList?.find((s) => s.id === siswaId)?.nama || '',
    [siswaList, siswaId],
  )

  useEffect(() => {
    void (async () => {
      try {
        setSiswaList(await muatSiswaKelas(kuis.kelas))
      } catch {
        setSiswaList([])
      }
    })()
  }, [kuis.kelas])

  const setJawab = useCallback((soalId: string, v: unknown) => {
    setJawaban((prev) => ({ ...prev, [soalId]: v }))
  }, [])

  async function simpan() {
    if (!siswaId) {
      setError('Pilih siswa terlebih dahulu.')
      return
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
      setInfo(
        `Tersimpan. Skor ${formatSkor100(res.skor, res.totalPoin)}/100 (${res.skor}/${res.totalPoin} poin) · percobaan #${res.percobaan}` +
          (res.status === 'sebagian_manual' ? ' · ada uraian perlu dinilai' : ''),
      )
      onTersimpan?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function bantuNilaiAi() {
    if (!lastJawabanId) {
      setError('Simpan jawaban dulu, lalu gunakan bantu nilai AI.')
      return
    }
    setBusyAi(true)
    setError('')
    try {
      const h = await analisisSiswaDenganAi(kuis.id, lastJawabanId)
      setHasilAi(h)
      const next: Record<string, number> = { ...skorOverride }
      for (const p of h.penilaian) next[p.soalId] = p.skor
      setSkorOverride(next)
      setInfo('Saran skor AI siap. Tinjau, lalu klik «Terapkan skor AI ke nilai».')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memanggil AI.')
    } finally {
      setBusyAi(false)
    }
  }

  function renderInput(s: SoalKuis) {
    const val = jawaban[s.id]
    if (s.tipe === 'pg') {
      return (
        <div className="mt-2 space-y-1.5">
          {(s.opsi || []).map((o) => (
            <label key={o.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name={`off-${s.id}`}
                className="mt-0.5 text-muh-600"
                checked={val === o.id}
                onChange={() => setJawab(s.id, o.id)}
              />
              <span>{o.teks}</span>
            </label>
          ))}
        </div>
      )
    }
    if (s.tipe === 'pgk') {
      const arr = Array.isArray(val) ? (val as string[]) : []
      return (
        <div className="mt-2 space-y-1.5">
          {(s.opsi || []).map((o) => {
            const on = arr.includes(o.id)
            return (
              <label key={o.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded text-muh-600"
                  checked={on}
                  onChange={() => {
                    const next = on ? arr.filter((x) => x !== o.id) : [...arr, o.id]
                    setJawab(s.id, next)
                  }}
                />
                <span>{o.teks}</span>
              </label>
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
        <div className="mt-2 space-y-2">
          {(s.pernyataan || []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 text-slate-700">{teksPolos(p.teks)}</span>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name={`bs-${s.id}-${p.id}`}
                  checked={obj[p.id] === true}
                  onChange={() => setJawab(s.id, { ...obj, [p.id]: true })}
                />
                B
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name={`bs-${s.id}-${p.id}`}
                  checked={obj[p.id] === false}
                  onChange={() => setJawab(s.id, { ...obj, [p.id]: false })}
                />
                S
              </label>
            </div>
          ))}
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
        <div className="mt-2 space-y-2">
          {(s.pasangan || []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-[8rem] flex-1 text-slate-700">{teksPolos(p.kiri)}</span>
              <select
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
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
    return (
      <div className="mt-2 space-y-2">
        <textarea
          rows={s.tipe === 'uraian' ? 4 : 2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-muh-500 focus:outline-none focus:ring-2 focus:ring-muh-200"
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => setJawab(s.id, e.target.value)}
          placeholder={s.tipe === 'uraian' ? 'Jawaban uraian siswa…' : 'Jawaban isian…'}
        />
        {(s.tipe === 'isian' || s.tipe === 'uraian') && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
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
          </label>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">Input jawaban offline</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Guru memasukkan jawaban siswa. Sistem menilai otomatis dengan kunci di server (PG, isian,
          dll.). Uraian / skor khusus bisa diisi manual
          {bolehAi ? ' atau dibantu AI setelah simpan.' : '.'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-semibold text-slate-600">Siswa (kelas {kuis.kelas})</span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={siswaId}
              onChange={(e) => {
                setSiswaId(e.target.value)
                setJawaban({})
                setSkorOverride({})
                setHasilAi(null)
                setLastJawabanId(null)
                setInfo('')
              }}
            >
              <option value="">— pilih siswa —</option>
              {(siswaList || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </select>
          </label>
        </div>
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
        <ol className="space-y-3">
          {soal.map((s, i) => (
            <li
              key={s.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {i + 1}
                </span>
                <span className="mr-1.5 inline-flex rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                  {NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {teksPolos(s.teks).slice(0, 200) || '(tanpa teks)'}
                </span>
                <span className="ml-2 text-xs text-slate-400">{s.poin} poin</span>
              </div>
              <div className="px-4 py-3">{renderInput(s)}</div>
            </li>
          ))}
        </ol>
      )}

      {siswaId && (
        <div className="flex flex-wrap items-center gap-2">
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
              title={!lastJawabanId ? 'Simpan dulu agar AI bisa membaca jawaban' : undefined}
            >
              {busyAi ? 'AI menilai…' : 'Bantu nilai AI (isian/uraian)'}
            </button>
          )}
          {hasilAi && bolehAi && lastJawabanId && (
            <button
              type="button"
              className="lms-btn-primary text-sm"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError('')
                  try {
                    for (const p of hasilAi.penilaian) {
                      await simpanNilaiManual({
                        jawabanId: lastJawabanId,
                        soalId: p.soalId,
                        skor: p.skor,
                      })
                    }
                    setInfo(`Skor AI diterapkan pada ${hasilAi.penilaian.length} butir isian/uraian.`)
                    onTersimpan?.()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Gagal menerapkan skor AI.')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Terapkan skor AI ke nilai
            </button>
          )}
        </div>
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
    </div>
  )
}

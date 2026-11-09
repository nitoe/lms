import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  agregatPerSoal,
  daftarJawabanKuis,
  formatSkor100,
  ringkasPerSiswa,
  jawabanTsMs,
  simpanNilaiManual,
  type JawabanKuis,
} from '../lib/jawabanKuis'
import { teksPolos } from '../lib/html'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_JENIS_PENILAIAN, type JenisPenilaianKuis } from '../types/kuis'
import { NAMA_TIPE, type TipeSoal } from '../types/soal'

type Props = {
  kuis: KuisLms
}

function teksJawaban(soal: SoalKuis, jawab: unknown): string {
  if (jawab == null || jawab === '') return '(kosong)'
  if (soal.tipe === 'pg') {
    const op = soal.opsi?.find((o) => o.id === jawab)
    return op ? op.teks : String(jawab)
  }
  if (soal.tipe === 'pgk') {
    const ids = Array.isArray(jawab) ? jawab : []
    return ids
      .map((id) => soal.opsi?.find((o) => o.id === id)?.teks ?? String(id))
      .join('; ') || '(kosong)'
  }
  if (soal.tipe === 'isian' || soal.tipe === 'uraian') {
    return String(jawab)
  }
  if (soal.tipe === 'bs' && jawab && typeof jawab === 'object') {
    const j = jawab as Record<string, boolean>
    return soal.pernyataan
      .map((p) => `${teksPolos(p.teks).slice(0, 40)}… → ${j[p.id] === true ? 'B' : j[p.id] === false ? 'S' : '?'}`)
      .join(' | ')
  }
  if (soal.tipe === 'jodoh' && jawab && typeof jawab === 'object') {
    return Object.entries(jawab as Record<string, string>)
      .map(([a, b]) => `${a}→${b}`)
      .join(', ')
  }
  return JSON.stringify(jawab)
}

function teksKunci(soal: SoalKuis): string {
  if (soal.tipe === 'pg') {
    return soal.opsi?.find((o) => o.id === soal.kunci)?.teks ?? String(soal.kunci)
  }
  if (soal.tipe === 'pgk') {
    return (soal.kunci || [])
      .map((id) => soal.opsi?.find((o) => o.id === id)?.teks ?? id)
      .join('; ')
  }
  if (soal.tipe === 'isian') {
    return (soal.kunci || []).join(' / ')
  }
  if (soal.tipe === 'uraian') {
    return soal.kunciJawaban ? teksPolos(soal.kunciJawaban).slice(0, 200) : '(pedoman di kunci jawaban soal)'
  }
  return '—'
}

/**
 * Daftar nilai + analisis + penilaian manual (uraian / koreksi isian).
 * ANTIREGRESI §55.
 */
export default function HasilKuisPanel({ kuis }: Props) {
  const [list, setList] = useState<JawabanKuis[] | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'siswa' | 'soal'>('siswa')
  const [hanyaTerbaru, setHanyaTerbaru] = useState(true)
  const [pilihId, setPilihId] = useState<string | null>(null)
  const [skorDraft, setSkorDraft] = useState<Record<string, string>>({})
  const [busySoal, setBusySoal] = useState<string | null>(null)
  const [info, setInfo] = useState('')

  const muat = useCallback(async () => {
    setError('')
    try {
      const data = await daftarJawabanKuis(kuis.id, kuis.kelas, kuis.mapel)
      setList(data)
    } catch (e) {
      setList([])
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        msg.includes('permission') || msg.includes('Permission')
          ? 'Tidak punya izin membaca hasil. Pastikan rules lms_jawaban sudah di-deploy dan Anda pengampu kelas×mapel ini.'
          : msg || 'Gagal memuat hasil.',
      )
    }
  }, [kuis.id, kuis.kelas, kuis.mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  const tampil = useMemo(() => {
    if (!list) return []
    return hanyaTerbaru ? ringkasPerSiswa(list) : list
  }, [list, hanyaTerbaru])

  const soalIds = useMemo(() => (kuis.soal ?? []).map((s) => s.id), [kuis.soal])
  const agregat = useMemo(() => {
    if (!list || list.length === 0) return {}
    return agregatPerSoal(tampil, soalIds)
  }, [list, tampil, soalIds])

  const terpilih = list?.find((j) => j.id === pilihId) ?? null

  const jenis = (kuis.jenisPenilaian ?? 'latihan') as JenisPenilaianKuis
  const labelJenis = NAMA_JENIS_PENILAIAN[jenis] ?? jenis

  async function simpanSkor(jawabanId: string, soalId: string, maks: number) {
    const raw = skorDraft[`${jawabanId}:${soalId}`]
    const n = Number(String(raw ?? '').replace(',', '.'))
    if (Number.isNaN(n) || n < 0) {
      setError('Skor tidak valid.')
      return
    }
    if (n > maks) {
      setError(`Skor tidak boleh melebihi poin soal (${maks}).`)
      return
    }
    setBusySoal(soalId)
    setError('')
    setInfo('')
    try {
      await simpanNilaiManual({ jawabanId, soalId, skor: n })
      setInfo('Skor tersimpan.')
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan skor.')
    } finally {
      setBusySoal(null)
    }
  }

  if (list === null) {
    return <div className="lms-empty">Memuat hasil pengerjaan…</div>
  }

  if (terpilih) {
    const detailById = new Map((terpilih.detail ?? []).map((d) => [d.soalId, d]))
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="text-sm font-semibold text-muh-600 hover:underline"
          onClick={() => {
            setPilihId(null)
            setInfo('')
            setError('')
          }}
        >
          ← Kembali ke daftar nilai
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {terpilih.siswaNama || terpilih.siswaId || 'Siswa'}
              </h3>
              <p className="text-xs text-slate-500">
                Percobaan #{terpilih.percobaan}
                {' · '}
                skor {formatSkor100(terpilih.skorOtomatis, terpilih.totalPoin)} / 100
                {' '}
                ({terpilih.skorOtomatis}/{terpilih.totalPoin} poin)
                {terpilih.status === 'sebagian_manual' ? ' · perlu nilai manual' : ''}
              </p>
            </div>
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

        <div className="space-y-3">
          {(kuis.soal ?? []).map((s, i) => {
            const d = detailById.get(s.id)
            const jawab = terpilih.jawaban?.[s.id]
            const maks = Number(s.poin) || 1
            const perluNilai =
              s.tipe === 'uraian' || d?.butuhManual === true || s.tipe === 'isian'
            const key = `${terpilih.id}:${s.id}`
            const draft =
              skorDraft[key] ??
              (d && typeof d.skor === 'number' ? String(d.skor) : '')
            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 text-sm text-slate-800">
                    <span className="mr-1 font-semibold text-slate-500">{i + 1}.</span>
                    <span className="text-xs font-medium text-slate-500">
                      [{NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe}]
                    </span>{' '}
                    {teksPolos(s.teks).slice(0, 160) || '(tanpa teks)'}
                  </div>
                  <div className="text-xs text-slate-600 shrink-0">
                    {d?.butuhManual ? (
                      <span className="font-semibold text-amber-700">Perlu dinilai</span>
                    ) : d?.benar ? (
                      <span className="font-semibold text-emerald-700">
                        Benar · {d.skor}/{maks}
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-700">
                        {d ? `${d.skor ?? 0}/${maks}` : `0/${maks}`}
                        {d?.dinilaiManual ? ' · manual' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
                  <span className="text-xs font-semibold text-slate-500">Jawaban siswa: </span>
                  {teksJawaban(s, jawab)}
                </div>
                {(s.tipe === 'isian' || s.tipe === 'uraian' || s.tipe === 'pg' || s.tipe === 'pgk') && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold">Kunci / pedoman: </span>
                    {teksKunci(s)}
                  </div>
                )}
                {perluNilai && (
                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <label className="text-xs text-slate-600">
                      Skor (maks {maks})
                      <input
                        type="number"
                        min={0}
                        max={maks}
                        step={0.5}
                        value={draft}
                        onChange={(e) =>
                          setSkorDraft((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="mt-0.5 block w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      className="lms-btn-primary text-xs"
                      disabled={busySoal === s.id}
                      onClick={() => void simpanSkor(terpilih.id, s.id, maks)}
                    >
                      {busySoal === s.id ? 'Menyimpan…' : 'Simpan skor'}
                    </button>
                    {s.tipe === 'isian' && (
                      <span className="text-[11px] text-slate-500">
                        Isian dinilai otomatis (teks/angka). Guru boleh mengoreksi skor di sini.
                      </span>
                    )}
                    {s.tipe === 'uraian' && (
                      <span className="text-[11px] text-slate-500">
                        Uraian tidak dinilai otomatis — isi skor sesuai pedoman.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Daftar nilai & analisis</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {labelJenis}
            {jenis === 'latihan'
              ? ' — tidak masuk rapor; tetap bisa dinilai dan dianalisis.'
              : ' — skor di sini dari LMS; sinkron ke rapor (SLM/STS/SAS) terpisah bila diaktifkan.'}
          </p>
        </div>
        <button type="button" className="lms-btn-secondary text-xs" onClick={() => void muat()}>
          Muat ulang
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === 'siswa' ? 'bg-white text-muh-700 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setMode('siswa')}
          >
            Daftar nilai
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === 'soal' ? 'bg-white text-muh-700 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setMode('soal')}
          >
            Analisis per soal
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={hanyaTerbaru}
            onChange={(e) => setHanyaTerbaru(e.target.checked)}
          />
          Hanya percobaan terbaru per siswa
        </label>
        <span className="text-xs text-slate-500">
          {list.length} kiriman · {ringkasPerSiswa(list).length} siswa
        </span>
      </div>

      {list.length === 0 && !error && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada jawaban terkirim</p>
          <p className="mt-1">
            Setelah siswa menekan «Selesai &amp; Kirim», baris nilai muncul di sini (termasuk
            latihan).
          </p>
        </div>
      )}

      {mode === 'siswa' && tampil.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2">Siswa</th>
                <th className="px-3 py-2">Percobaan</th>
                <th className="px-3 py-2">Nilai (skala 100)</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tampil.map((j) => {
                const t = jawabanTsMs(j.createdAt)
                const perlu = j.status === 'sebagian_manual' || (j.detail ?? []).some((d) => d.butuhManual)
                return (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {j.siswaNama || j.siswaId || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">#{j.percobaan}</td>
                    <td className="px-3 py-2 tabular">
                      <span className="font-semibold text-slate-900">
                        {formatSkor100(j.skorOtomatis, j.totalPoin)}
                      </span>
                      <span className="text-slate-400"> / 100</span>
                      <span className="ml-1 text-xs text-slate-500">
                        ({j.skorOtomatis}/{j.totalPoin})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {perlu ? (
                        <span className="font-semibold text-amber-700">Perlu nilai manual</span>
                      ) : (
                        <span className="text-slate-600">{j.status || 'selesai'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {t
                        ? new Date(t).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="lms-btn-secondary text-xs"
                        onClick={() => {
                          setPilihId(j.id)
                          setError('')
                          setInfo('')
                        }}
                      >
                        Detail / nilai
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'soal' && list.length > 0 && (
        <div className="space-y-2">
          {(kuis.soal ?? []).map((s, i) => {
            const a = agregat[s.id]
            const cuplikan = teksPolos(s.teks).slice(0, 120) || '(tanpa teks)'
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <div className="text-sm text-slate-800">
                  <span className="mr-1 font-semibold text-slate-500">{i + 1}.</span>
                  <span className="text-xs text-slate-500">
                    [{NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe}]
                  </span>{' '}
                  {cuplikan}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>
                    Benar: <strong className="text-emerald-700">{a?.benar ?? 0}</strong>
                  </span>
                  <span>
                    Salah: <strong className="text-red-700">{a?.salah ?? 0}</strong>
                  </span>
                  <span>
                    Kosong: <strong>{a?.kosong ?? 0}</strong>
                  </span>
                  {(a?.manual ?? 0) > 0 && (
                    <span>
                      Perlu manual:{' '}
                      <strong className="text-amber-700">{a?.manual}</strong>
                    </span>
                  )}
                  <span>
                    Rata poin: <strong>{a?.rataSkor ?? 0}</strong>
                  </span>
                  <span className="text-slate-400">n={a?.total ?? 0}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

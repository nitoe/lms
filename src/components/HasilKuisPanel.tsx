import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  agregatPerSoal,
  daftarJawabanKuis,
  ringkasPerSiswa,
  jawabanTsMs,
  type JawabanKuis,
} from '../lib/jawabanKuis'
import { teksPolos } from '../lib/html'
import type { KuisLms } from '../types/kuis'
import { NAMA_JENIS_PENILAIAN, type JenisPenilaianKuis } from '../types/kuis'

type Props = {
  kuis: KuisLms
}

/**
 * Analisis hasil pengerjaan kuis untuk guru.
 * Berlaku untuk SEMUA jenisPenilaian termasuk latihan.
 * ANTIREGRESI §55.
 */
export default function HasilKuisPanel({ kuis }: Props) {
  const [list, setList] = useState<JawabanKuis[] | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'siswa' | 'soal'>('siswa')
  const [hanyaTerbaru, setHanyaTerbaru] = useState(true)

  const muat = useCallback(async () => {
    setError('')
    try {
      // kelas + mapel wajib di query (rules lihatMapelKelas)
      const data = await daftarJawabanKuis(kuis.id, kuis.kelas, kuis.mapel)
      setList(data)
    } catch (e) {
      setList([])
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        msg.includes('permission') || msg.includes('Permission')
          ? 'Tidak punya izin membaca hasil. Pastikan: (1) rules lms_jawaban sudah di-deploy dari SDM01Penilaian, (2) Anda pengampu kelas×mapel kuis ini.'
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

  const jenis = (kuis.jenisPenilaian ?? 'latihan') as JenisPenilaianKuis
  const labelJenis = NAMA_JENIS_PENILAIAN[jenis] ?? jenis

  if (list === null) {
    return <div className="lms-empty">Memuat hasil pengerjaan…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Hasil & analisis siswa</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {labelJenis}
            {jenis === 'latihan'
              ? ' — tidak masuk rapor, tetapi jawaban tetap tercatat dan bisa dianalisis.'
              : ' — skor otomatis tersimpan; nilai rapor diatur terpisah di bagian penilaian kuis.'}
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
            Per siswa
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === 'soal' ? 'bg-white text-muh-700 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setMode('soal')}
          >
            Per soal
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
            Setelah siswa menekan «Selesai &amp; Kirim», hasil muncul di sini — termasuk untuk
            latihan.
          </p>
        </div>
      )}

      {mode === 'siswa' && tampil.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2">Siswa</th>
                <th className="px-3 py-2">Percobaan</th>
                <th className="px-3 py-2">Skor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((j) => {
                const pct =
                  j.totalPoin > 0
                    ? Math.round((j.skorOtomatis / j.totalPoin) * 1000) / 10
                    : 0
                const t = jawabanTsMs(j.createdAt)
                return (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {j.siswaNama || j.siswaId || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">#{j.percobaan}</td>
                    <td className="px-3 py-2 tabular">
                      <span className="font-semibold text-slate-900">{j.skorOtomatis}</span>
                      <span className="text-slate-400"> / {j.totalPoin}</span>
                      <span className="ml-1 text-xs text-slate-500">({pct}%)</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {j.status === 'sebagian_manual' ? 'Perlu nilai manual' : j.status || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {t
                        ? new Date(t).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
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
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-3"
              >
                <div className="text-sm text-slate-800">
                  <span className="mr-1 font-semibold text-slate-500">{i + 1}.</span>
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
                      Manual: <strong className="text-amber-700">{a?.manual}</strong>
                    </span>
                  )}
                  <span>
                    Rata skor: <strong>{a?.rataSkor ?? 0}</strong>
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

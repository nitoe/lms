import { useCallback, useEffect, useMemo, useState } from 'react'
import { daftarKuis } from '../lib/kuis'
import { daftarJawabanKuis, formatSkor100, ringkasPerSiswa, type JawabanKuis } from '../lib/jawabanKuis'
import { sinkronNilaiKuisKePenilaian } from '../lib/sinkronNilaiKuis'
import { useAuth } from '../context/AuthContext'
import type { KuisLms } from '../types/kuis'
import { NAMA_JENIS_PENILAIAN, type JenisPenilaianKuis } from '../types/kuis'

/** Halaman rekap nilai kuis (online + offline) + sinkron ke Penilaian (SLM/STS/SAS). */
export default function RekapKuis() {
  const { profil } = useAuth()
  const penugasan = useMemo(() => {
    const pk = Array.isArray(profil?.penugasanKelasMapel) ? profil!.penugasanKelasMapel! : []
    const pairs: { kelas: string; mapel: string }[] = []
    for (const s of pk) {
      const [kelas, mapel] = String(s).split('::')
      if (kelas && mapel) pairs.push({ kelas: kelas.toUpperCase(), mapel })
    }
    // unik
    const seen = new Set<string>()
    return pairs.filter((p) => {
      const k = `${p.kelas}::${p.mapel}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [profil])

  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [pilihId, setPilihId] = useState<string | null>(null)
  const [jawaban, setJawaban] = useState<JawabanKuis[] | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [busySync, setBusySync] = useState(false)
  const [overwrite, setOverwrite] = useState(true)

  useEffect(() => {
    if (penugasan.length && !kelas) {
      setKelas(penugasan[0].kelas)
      setMapel(penugasan[0].mapel)
    }
  }, [penugasan, kelas])

  const muatKuis = useCallback(async () => {
    if (!kelas || !mapel) return
    setBusy(true)
    setError('')
    try {
      const data = await daftarKuis(kelas, mapel)
      setList(data)
      if (pilihId && !data.some((k) => k.id === pilihId)) {
        setPilihId(null)
        setJawaban(null)
      }
    } catch (e) {
      setList([])
      setError(e instanceof Error ? e.message : 'Gagal memuat kuis.')
    } finally {
      setBusy(false)
    }
  }, [kelas, mapel, pilihId])

  useEffect(() => {
    void muatKuis()
  }, [muatKuis])

  const kuis = list?.find((k) => k.id === pilihId) ?? null

  const muatJawaban = useCallback(async () => {
    if (!kuis) {
      setJawaban(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await daftarJawabanKuis(kuis.id, kuis.kelas, kuis.mapel)
      setJawaban(ringkasPerSiswa(data))
    } catch (e) {
      setJawaban([])
      setError(e instanceof Error ? e.message : 'Gagal memuat nilai.')
    } finally {
      setBusy(false)
    }
  }, [kuis])

  useEffect(() => {
    void muatJawaban()
  }, [muatJawaban])

  const jenis = (kuis?.jenisPenilaian ?? 'latihan') as JenisPenilaianKuis
  const bisaSinkron = jenis === 'slm' || jenis === 'sts' || jenis === 'sas'

  async function sinkron() {
    if (!kuis) return
    setBusySync(true)
    setError('')
    setInfo('')
    try {
      const h = await sinkronNilaiKuisKePenilaian({
        kuisId: kuis.id,
        overwrite,
      })
      setInfo(
        `Sinkron OK → ${h.koleksi}: ${h.ditulis} nilai ditulis` +
          (h.dilewati ? `, ${h.dilewati} dilewati` : '') +
          ` · ${h.nSiswa} siswa · ${h.nTp} TP · sem ${h.semester} · ${h.tahunAjaran}`,
      )
      await muatKuis()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal sinkron.')
    } finally {
      setBusySync(false)
    }
  }

  const rata =
    jawaban && jawaban.length
      ? Math.round(
          (jawaban.reduce(
            (a, j) => a + (j.totalPoin > 0 ? (j.skorOtomatis / j.totalPoin) * 100 : 0),
            0,
          ) /
            jawaban.length) *
            10,
        ) / 10
      : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Rekap hasil kuis</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Tabel nilai (online &amp; offline). Untuk SLM/STS/SAS, sinkronkan ke database nilai aplikasi
          Penilaian.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Kelas</span>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={kelas}
            onChange={(e) => {
              const k = e.target.value
              setKelas(k)
              const m = penugasan.find((p) => p.kelas === k)?.mapel
              if (m) setMapel(m)
              setPilihId(null)
            }}
          >
            {[...new Set(penugasan.map((p) => p.kelas))].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Mapel</span>
          <select
            className="min-w-[12rem] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={mapel}
            onChange={(e) => {
              setMapel(e.target.value)
              setPilihId(null)
            }}
          >
            {penugasan
              .filter((p) => p.kelas === kelas)
              .map((p) => (
                <option key={p.mapel} value={p.mapel}>
                  {p.mapel}
                </option>
              ))}
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-sm">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Kuis</span>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={pilihId || ''}
            onChange={(e) => setPilihId(e.target.value || null)}
          >
            <option value="">— pilih kuis —</option>
            {(list || []).map((k) => (
              <option key={k.id} value={k.id}>
                {k.judul}
                {k.modePelaksanaan === 'offline' ? ' · offline' : ''}
                {' · '}
                {NAMA_JENIS_PENILAIAN[(k.jenisPenilaian as JenisPenilaianKuis) || 'latihan'] ||
                  k.jenisPenilaian}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" className="lms-btn-secondary text-xs" onClick={() => void muatKuis()}>
            Muat ulang
          </button>
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

      {!kuis && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Pilih kuis untuk melihat rekap nilai.
        </div>
      )}

      {kuis && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Siswa</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{jawaban?.length ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Rata-rata</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-muh-700">
                {rata != null ? rata : '—'}
                {rata != null ? <span className="text-sm text-slate-400"> /100</span> : null}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Jenis</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {NAMA_JENIS_PENILAIAN[jenis] || jenis}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Mode</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {kuis.modePelaksanaan === 'offline' ? 'Offline' : 'Online'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            {bisaSinkron ? (
              <>
                <div className="min-w-0 flex-1 text-sm text-slate-600">
                  Sinkron ke aplikasi Penilaian (
                  {jenis === 'slm' ? 'nilai_tp / SLM' : jenis === 'sts' ? 'nilai_sts' : 'nilai_sas'}
                  ). Pastikan TP di kuis cocok dengan TP di Penilaian.
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  Timpa nilai yang sudah ada
                </label>
                <button
                  type="button"
                  className="lms-btn-primary text-xs"
                  disabled={busySync || !jawaban?.length}
                  onClick={() => void sinkron()}
                >
                  {busySync ? 'Menyinkron…' : 'Sinkronkan ke Penilaian'}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Kuis ini berjenis <strong>latihan</strong> — tidak masuk rapor. Ubah jenis di Atur kuis
                menjadi SLM/STS/SAS bila ingin sinkron.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {busy && !jawaban ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">Memuat nilai…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">No</th>
                      <th className="px-3 py-3">Siswa</th>
                      <th className="px-3 py-3">Perc.</th>
                      <th className="px-3 py-3">Nilai /100</th>
                      <th className="px-3 py-3">Poin</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Sumber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(jawaban || []).map((j, i) => (
                      <tr key={j.id} className="hover:bg-muh-50/30">
                        <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                          {j.siswaNama || j.siswaId || '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">#{j.percobaan}</td>
                        <td className="px-3 py-2.5 font-bold tabular-nums text-muh-700">
                          {formatSkor100(j.skorOtomatis, j.totalPoin)}
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">
                          {j.skorOtomatis}/{j.totalPoin}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{j.status || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {(j as { sumber?: string }).sumber === 'offline' ? 'Offline' : 'Online'}
                        </td>
                      </tr>
                    ))}
                    {jawaban && jawaban.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                          Belum ada nilai untuk kuis ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

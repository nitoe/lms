/**
 * Rekap Nilai — pusat agregasi nilai TP (SLM / STS / SAS) per mapel×kelas.
 * Tahap 1: shell UI (pilih kelas/mapel → tab TP → sub-tab SLM/STS/SAS + tabel roster).
 * Tahap berikutnya: sumber nilai otomatis, bobot live, sinkron ke Penilaian.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTpMapelKelas } from '../lib/tpData'
import { muatSiswaKelas, type SiswaDasar } from '../lib/siswaAuth'
import { daftarMapelKelasGuru } from '../lib/rekapNilai'
import type { TpRingkas } from '../types/materi'
import {
  NAMA_JENIS_NILAI_TP,
  type JenisNilaiTp,
} from '../types/rekapNilai'

type SubTab = JenisNilaiTp

export default function RekapNilai() {
  const { profil } = useAuth()
  const pasangan = useMemo(() => daftarMapelKelasGuru(profil), [profil])

  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [tpList, setTpList] = useState<TpRingkas[] | null>(null)
  const [tpAktifId, setTpAktifId] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('slm')
  const [siswa, setSiswa] = useState<SiswaDasar[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Inisialisasi kelas/mapel dari penugasan
  useEffect(() => {
    if (!pasangan.length) return
    if (!kelas || !pasangan.some((p) => p.kelas === kelas && p.mapel === mapel)) {
      setKelas(pasangan[0].kelas)
      setMapel(pasangan[0].mapel)
    }
  }, [pasangan, kelas, mapel])

  const opsiKelas = useMemo(() => {
    const s = new Set(pasangan.map((p) => p.kelas))
    return [...s].sort((a, b) => a.localeCompare(b, 'id'))
  }, [pasangan])

  const opsiMapel = useMemo(() => {
    return pasangan
      .filter((p) => p.kelas === kelas)
      .map((p) => p.mapel)
      .filter((m, i, arr) => arr.indexOf(m) === i)
      .sort((a, b) => a.localeCompare(b, 'id'))
  }, [pasangan, kelas])

  const muatTpDanSiswa = useCallback(async () => {
    if (!kelas || !mapel) {
      setTpList([])
      setSiswa([])
      setTpAktifId(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      const [tps, roster] = await Promise.all([
        getTpMapelKelas(mapel, kelas),
        muatSiswaKelas(kelas),
      ])
      setTpList(tps)
      setSiswa(roster)
      setTpAktifId((prev) => {
        if (prev && tps.some((t) => t.id === prev)) return prev
        return tps[0]?.id ?? null
      })
    } catch (e) {
      setTpList([])
      setSiswa([])
      setError(e instanceof Error ? e.message : 'Gagal memuat TP / roster siswa.')
    } finally {
      setBusy(false)
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muatTpDanSiswa()
  }, [muatTpDanSiswa])

  const tpAktif = useMemo(
    () => tpList?.find((t) => t.id === tpAktifId) ?? null,
    [tpList, tpAktifId],
  )

  if (!pasangan.length) {
    return (
      <div className="space-y-4">
        <div className="lms-page-intro">
          <h2 className="text-lg font-semibold">Rekap Nilai</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pusat sinkronisasi nilai TP (SLM, STS, SAS) ke aplikasi Penilaian.
          </p>
        </div>
        <div className="lms-empty rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          Belum ada penugasan mapel×kelas di profil Anda. Atur penugasan di aplikasi Penilaian
          terlebih dahulu.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="lms-page-intro">
        <h2 className="text-lg font-semibold">Rekap Nilai</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Agregasi nilai per Tujuan Pembelajaran (SLM dari tugas &amp; kuis, STS &amp; SAS dari
          asesmen) untuk disinkronkan ke aplikasi Penilaian.
        </p>
      </div>

      {/* Filter kelas + mapel */}
      <div className="lms-toolbar flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Kelas
          <select
            className="lms-input min-w-[100px]"
            value={kelas}
            onChange={(e) => {
              const k = e.target.value
              setKelas(k)
              const mapels = pasangan.filter((p) => p.kelas === k).map((p) => p.mapel)
              setMapel(mapels[0] ?? '')
            }}
          >
            {opsiKelas.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Mata pelajaran
          <select
            className="lms-input min-w-[180px]"
            value={mapel}
            onChange={(e) => setMapel(e.target.value)}
          >
            {opsiMapel.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {busy && <span className="text-xs text-muted self-center">Memuat…</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Tab TP */}
      {tpList && tpList.length === 0 && !busy && (
        <div className="lms-empty rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Belum ada Tujuan Pembelajaran untuk {mapel} · {kelas}. Buat TP di aplikasi Penilaian
          terlebih dahulu.
        </div>
      )}

      {tpList && tpList.length > 0 && (
        <>
          <div className="lms-tabs overflow-x-auto" role="tablist" aria-label="Tujuan Pembelajaran">
            {tpList.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tpAktifId === t.id}
                onClick={() => {
                  setTpAktifId(t.id)
                  setSubTab('slm')
                }}
                className={`lms-tab whitespace-nowrap ${tpAktifId === t.id ? 'lms-tab--active' : ''}`}
                title={t.namaTp}
              >
                TP {t.nomorTp || '—'}
              </button>
            ))}
          </div>

          {tpAktif && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">
                  Tujuan Pembelajaran {tpAktif.nomorTp}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-800">{tpAktif.namaTp}</div>
              </div>

              {/* Sub-tab SLM / STS / SAS */}
              <div className="lms-tabs" role="tablist" aria-label="Jenis penilaian">
                {(['slm', 'sts', 'sas'] as SubTab[]).map((j) => (
                  <button
                    key={j}
                    type="button"
                    role="tab"
                    aria-selected={subTab === j}
                    onClick={() => setSubTab(j)}
                    className={`lms-tab ${subTab === j ? 'lms-tab--active' : ''}`}
                  >
                    {NAMA_JENIS_NILAI_TP[j]}
                  </button>
                ))}
              </div>

              {/* Konten sub-tab — Tahap 1: roster + placeholder */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                {subTab === 'slm' && (
                  <div className="space-y-3 p-4">
                    <p className="text-sm text-muted">
                      Nilai SLM digabung dari tugas dan kuis (jenis SLM) yang terhubung ke TP ini.
                      Bobot per sumber dapat diatur live (tahap berikutnya).
                    </p>
                    <TabelRosterPlaceholder
                      siswa={siswa}
                      kolomEkstra={['Nilai akhir SLM']}
                      catatan="Sumber nilai &amp; bobot akan muncul di sini setelah tahap agregasi."
                    />
                  </div>
                )}
                {subTab === 'sts' && (
                  <div className="space-y-3 p-4">
                    <p className="text-sm text-muted">
                      Nilai STS berasal dari kuis/asesmen STS (biasanya satu event). Input offline
                      sudah tersedia di modul Kuis.
                    </p>
                    <TabelRosterPlaceholder
                      siswa={siswa}
                      kolomEkstra={['Nilai STS']}
                      catatan="Nilai STS otomatis terisi setelah guru input kuis offline (tahap berikutnya)."
                    />
                  </div>
                )}
                {subTab === 'sas' && (
                  <div className="space-y-3 p-4">
                    <p className="text-sm text-muted">
                      Nilai SAS berasal dari kuis/asesmen SAS (biasanya satu event). Sama pola
                      dengan STS.
                    </p>
                    <TabelRosterPlaceholder
                      siswa={siswa}
                      kolomEkstra={['Nilai SAS']}
                      catatan="Nilai SAS otomatis terisi setelah guru input kuis offline (tahap berikutnya)."
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Area rekap final — placeholder */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5">
        <h3 className="text-sm font-semibold text-slate-700">Rekap nilai akhir mapel</h3>
        <p className="mt-1 text-sm text-muted">
          Tabel seluruh nilai akhir TP (SLM / STS / SAS) untuk dikirim ke aplikasi Penilaian akan
          ditampilkan di sini pada tahap sinkronisasi.
        </p>
      </div>
    </div>
  )
}

function TabelRosterPlaceholder({
  siswa,
  kolomEkstra,
  catatan,
}: {
  siswa: SiswaDasar[] | null
  kolomEkstra: string[]
  catatan: string
}) {
  if (siswa === null) {
    return <p className="text-sm text-muted">Memuat roster…</p>
  }
  if (siswa.length === 0) {
    return (
      <p className="text-sm text-muted">
        Belum ada siswa aktif di kelas ini.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <table className="w-full min-w-[320px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2 font-medium">No</th>
            <th className="px-2 py-2 font-medium">Nama siswa</th>
            {kolomEkstra.map((k) => (
              <th key={k} className="px-2 py-2 font-medium text-right">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {siswa.map((s, i) => (
            <tr key={s.id} className="border-b border-slate-100 last:border-0">
              <td className="px-2 py-2 text-muted">{i + 1}</td>
              <td className="px-2 py-2 font-medium text-slate-800">{s.nama}</td>
              {kolomEkstra.map((k) => (
                <td key={k} className="px-2 py-2 text-right text-muted">
                  —
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">{catatan}</p>
    </div>
  )
}

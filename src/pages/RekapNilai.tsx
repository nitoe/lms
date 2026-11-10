/**
 * Rekap Nilai — pusat agregasi nilai TP (SLM / STS / SAS) per mapel×kelas.
 * Tahap 2: sumber otomatis tugas/kuis, bobot SLM live; daftar kelas×mapel = penugasan + perluasan wali.
 * Belum: tulis cache nilai akhir + Cloud Function sinkron ke Penilaian.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTpMapelKelas } from '../lib/tpData'
import { muatSiswaKelas, type SiswaDasar } from '../lib/siswaAuth'
import {
  temukanSumberSlm,
  muatBobotSlm,
  gabungSumberDenganBobot,
  simpanBobotSlm,
  muatNilaiPerSumberSlm,
  bangunNilaiSlmSiswa,
  temukanSumberStsSas,
  muatNilaiStsSas,
  hitungNilaiBerbobot,
  jumlahPersen,
} from '../lib/rekapNilai'
import {
  daftarRuangKelas,
  kelasWaliTanpaMapel,
  perluasDenganMapelMaster,
} from '../lib/kelasLms'
import { getDaftarMapel } from '../lib/mapelData'
import type { TpRingkas } from '../types/materi'
import type { SumberNilaiSlm, NilaiSiswaTp } from '../types/rekapNilai'
import {
  NAMA_JENIS_NILAI_TP,
  type JenisNilaiTp,
} from '../types/rekapNilai'

type SubTab = JenisNilaiTp

function formatNilai(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

export default function RekapNilai() {
  const { profil } = useAuth()

  /** Sama sumber dengan Ruang Kelas: penugasan + perluasan wali × master mapel. */
  const [pasangan, setPasangan] = useState<{ kelas: string; mapel: string }[]>(() =>
    daftarRuangKelas(profil).map((r) => ({ kelas: r.kelas, mapel: r.mapel })),
  )
  const [muatPasangan, setMuatPasangan] = useState(false)

  useEffect(() => {
    let batal = false
    ;(async () => {
      setMuatPasangan(true)
      try {
        let ruang = daftarRuangKelas(profil)
        const waliKosong = kelasWaliTanpaMapel(profil)
        if (waliKosong.length) {
          try {
            const mapelMaster = await getDaftarMapel()
            if (mapelMaster.length) {
              ruang = perluasDenganMapelMaster(profil, mapelMaster)
            }
          } catch (e) {
            console.warn('rekap: gagal muat master mapel untuk wali', e)
          }
        }
        if (batal) return
        const seen = new Set<string>()
        const out: { kelas: string; mapel: string }[] = []
        for (const r of ruang) {
          const k = `${r.kelas}::${r.mapel}`
          if (seen.has(k)) continue
          seen.add(k)
          out.push({ kelas: r.kelas, mapel: r.mapel })
        }
        out.sort((a, b) => {
          const ck = a.kelas.localeCompare(b.kelas, 'id')
          if (ck !== 0) return ck
          return a.mapel.localeCompare(b.mapel, 'id')
        })
        setPasangan(out)
      } finally {
        if (!batal) setMuatPasangan(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [profil])

  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [tpList, setTpList] = useState<TpRingkas[] | null>(null)
  const [tpAktifId, setTpAktifId] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('slm')
  const [siswa, setSiswa] = useState<SiswaDasar[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyNilai, setBusyNilai] = useState(false)
  const [pesan, setPesan] = useState('')

  // SLM state
  const [sumberSlm, setSumberSlm] = useState<SumberNilaiSlm[]>([])
  const [nilaiSlm, setNilaiSlm] = useState<NilaiSiswaTp[] | null>(null)
  const [bobotDirty, setBobotDirty] = useState(false)
  const [menyimpanBobot, setMenyimpanBobot] = useState(false)

  // STS / SAS
  const [sumberSts, setSumberSts] = useState<SumberNilaiSlm[]>([])
  const [nilaiSts, setNilaiSts] = useState<NilaiSiswaTp[] | null>(null)
  const [sumberSas, setSumberSas] = useState<SumberNilaiSlm[]>([])
  const [nilaiSas, setNilaiSas] = useState<NilaiSiswaTp[] | null>(null)

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

  /** Muat sumber + nilai untuk TP aktif (semua sub-tab disiapkan). */
  const muatNilaiTp = useCallback(async () => {
    if (!kelas || !mapel || !tpAktifId || !siswa) {
      setSumberSlm([])
      setNilaiSlm(null)
      setSumberSts([])
      setNilaiSts(null)
      setSumberSas([])
      setNilaiSas(null)
      return
    }
    setBusyNilai(true)
    setError('')
    setPesan('')
    setBobotDirty(false)
    try {
      const roster = siswa.map((s) => ({ id: s.id, nama: s.nama }))

      // SLM
      const [terdeteksi, bobotDok] = await Promise.all([
        temukanSumberSlm(kelas, mapel, tpAktifId),
        muatBobotSlm(kelas, mapel, tpAktifId),
      ])
      const sumber = gabungSumberDenganBobot(terdeteksi, bobotDok)
      setSumberSlm(sumber)
      if (sumber.length) {
        const perSrc = await muatNilaiPerSumberSlm(kelas, mapel, sumber)
        setNilaiSlm(bangunNilaiSlmSiswa(roster, sumber, perSrc))
      } else {
        setNilaiSlm(
          roster.map((s) => ({
            siswaId: s.id,
            siswaNama: s.nama,
            perSumber: {},
            nilaiAkhir: null,
          })),
        )
      }

      // STS
      const srcSts = await temukanSumberStsSas(kelas, mapel, tpAktifId, 'sts')
      setSumberSts(srcSts)
      setNilaiSts(await muatNilaiStsSas(kelas, mapel, srcSts, roster))

      // SAS
      const srcSas = await temukanSumberStsSas(kelas, mapel, tpAktifId, 'sas')
      setSumberSas(srcSas)
      setNilaiSas(await muatNilaiStsSas(kelas, mapel, srcSas, roster))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat nilai TP.')
      setNilaiSlm(null)
      setNilaiSts(null)
      setNilaiSas(null)
    } finally {
      setBusyNilai(false)
    }
  }, [kelas, mapel, tpAktifId, siswa])

  useEffect(() => {
    void muatNilaiTp()
  }, [muatNilaiTp])

  const ubahBobot = (sumberId: string, bobotBaru: number) => {
    setSumberSlm((prev) =>
      prev.map((s) =>
        s.id === sumberId
          ? {
              ...s,
              bobot: Number.isFinite(bobotBaru)
                ? Math.round(Math.max(0, Math.min(100, bobotBaru)) * 10) / 10
                : 0,
            }
          : s,
      ),
    )
    setBobotDirty(true)
  }

  const totalPersenSlm = useMemo(() => jumlahPersen(sumberSlm), [sumberSlm])
  const persenOk = Math.abs(totalPersenSlm - 100) < 0.15

  // Hitung ulang nilai akhir SLM saat bobot berubah (tanpa fetch ulang)
  useEffect(() => {
    if (!nilaiSlm || !sumberSlm.length) return
    setNilaiSlm((prev) => {
      if (!prev) return prev
      return prev.map((row) => ({
        ...row,
        nilaiAkhir: hitungNilaiBerbobot(row.perSumber ?? {}, sumberSlm),
      }))
    })
    // Hanya saat sumberSlm (bobot) berubah — jangan loop pada nilaiSlm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumberSlm])

  const simpanBobot = async () => {
    if (!kelas || !mapel || !tpAktifId || !tpAktif) return
    if (!persenOk) {
      setError(
        `Jumlah bobot ${totalPersenSlm}% — harus 100%. Sesuaikan persen tiap sumber.`,
      )
      return
    }
    setMenyimpanBobot(true)
    setError('')
    setPesan('')
    try {
      await simpanBobotSlm({
        kelas,
        mapel,
        tpId: tpAktifId,
        tpNomor: tpAktif.nomorTp,
        tpNama: tpAktif.namaTp,
        sumber: sumberSlm,
      })
      setBobotDirty(false)
      setPesan('Bobot SLM disimpan.')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Gagal menyimpan bobot. Pastikan rules lms_bobot_slm sudah di-deploy.',
      )
    } finally {
      setMenyimpanBobot(false)
    }
  }

  if (muatPasangan && !pasangan.length) {
    return (
      <div className="space-y-4">
        <div className="lms-page-intro">
          <h2 className="text-lg font-semibold">Rekap Nilai</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pusat sinkronisasi nilai TP (SLM, STS, SAS) ke aplikasi Penilaian.
          </p>
        </div>
        <p className="text-sm text-muted">Memuat daftar kelas × mapel…</p>
      </div>
    )
  }

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
          Belum ada kelas × mapel yang bisa dibuka. Pastikan penugasan mapel atau status wali kelas
          sudah diisi di aplikasi Penilaian (sama seperti sumber kartu di Ruang Kelas).
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
        <button
          type="button"
          className="lms-btn-secondary text-sm"
          disabled={busy || busyNilai}
          onClick={() => {
            void muatTpDanSiswa()
          }}
        >
          {busy || busyNilai ? 'Memuat…' : 'Muat ulang'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {pesan && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {pesan}
        </div>
      )}

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

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                {busyNilai && (
                  <p className="p-4 text-sm text-muted">Memuat nilai dari tugas &amp; kuis…</p>
                )}

                {!busyNilai && subTab === 'slm' && (
                  <div className="space-y-4 p-4">
                    <p className="text-sm text-muted">
                      Nilai SLM digabung dari tugas dan kuis yang terhubung ke TP ini. Atur{' '}
                      <strong>bobot persen</strong> tiap sumber (jumlah harus 100%), lalu simpan.
                    </p>

                    {sumberSlm.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        Belum ada tugas atau kuis SLM yang terhubung ke TP ini. Buat tugas (lampirkan
                        TP) atau kuis dengan jenis penilaian <strong>SLM</strong> dan pilih TP ini.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-end gap-3">
                          {sumberSlm.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <div className="text-xs text-muted">
                                {s.jenis === 'tugas' ? 'Tugas' : 'Kuis'}
                              </div>
                              <div className="max-w-[200px] truncate text-sm font-medium text-slate-800" title={s.judul}>
                                {s.judul}
                              </div>
                              <label className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                                Bobot
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  className="lms-input w-16 py-1 text-sm"
                                  value={s.bobot}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value)
                                    ubahBobot(s.id, Number.isFinite(v) ? v : 0)
                                  }}
                                />
                                <span className="font-medium text-slate-700">%</span>
                              </label>
                            </div>
                          ))}
                          <div className="flex flex-col gap-1">
                            <span
                              className={
                                persenOk
                                  ? 'text-xs font-medium text-emerald-700'
                                  : 'text-xs font-medium text-amber-700'
                              }
                            >
                              Total {totalPersenSlm}%
                              {persenOk ? ' (OK)' : ' — harus 100%'}
                            </span>
                            <button
                              type="button"
                              className="lms-btn-primary text-sm"
                              disabled={!bobotDirty || menyimpanBobot || !persenOk}
                              onClick={() => void simpanBobot()}
                            >
                              {menyimpanBobot ? 'Menyimpan…' : 'Simpan bobot'}
                            </button>
                          </div>
                        </div>

                        <TabelNilaiSlm
                          siswa={siswa}
                          sumber={sumberSlm}
                          nilai={nilaiSlm}
                        />
                      </>
                    )}
                  </div>
                )}

                {!busyNilai && subTab === 'sts' && (
                  <div className="space-y-3 p-4">
                    <p className="text-sm text-muted">
                      Nilai STS dari kuis/asesmen dengan jenis penilaian <strong>STS</strong>
                      {sumberSts.length
                        ? ` (${sumberSts.map((s) => s.judul).join(', ')})`
                        : ''}.
                      Input offline tersedia di modul Kuis.
                    </p>
                    {sumberSts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        Belum ada kuis STS untuk TP / mapel ini.
                      </div>
                    ) : (
                      <TabelNilaiSederhana
                        siswa={siswa}
                        nilai={nilaiSts}
                        labelKolom="Nilai STS"
                      />
                    )}
                  </div>
                )}

                {!busyNilai && subTab === 'sas' && (
                  <div className="space-y-3 p-4">
                    <p className="text-sm text-muted">
                      Nilai SAS dari kuis/asesmen dengan jenis penilaian <strong>SAS</strong>
                      {sumberSas.length
                        ? ` (${sumberSas.map((s) => s.judul).join(', ')})`
                        : ''}.
                    </p>
                    {sumberSas.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        Belum ada kuis SAS untuk TP / mapel ini.
                      </div>
                    ) : (
                      <TabelNilaiSederhana
                        siswa={siswa}
                        nilai={nilaiSas}
                        labelKolom="Nilai SAS"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5">
        <h3 className="text-sm font-semibold text-slate-700">Rekap nilai akhir mapel</h3>
        <p className="mt-1 text-sm text-muted">
          Tabel seluruh nilai akhir TP (SLM / STS / SAS) untuk dikirim ke aplikasi Penilaian akan
          ditampilkan di sini pada tahap sinkronisasi (Tahap 3).
        </p>
      </div>
    </div>
  )
}

function TabelNilaiSlm({
  siswa,
  sumber,
  nilai,
}: {
  siswa: SiswaDasar[] | null
  sumber: SumberNilaiSlm[]
  nilai: NilaiSiswaTp[] | null
}) {
  if (siswa === null || nilai === null) {
    return <p className="text-sm text-muted">Memuat roster…</p>
  }
  if (siswa.length === 0) {
    return <p className="text-sm text-muted">Belum ada siswa aktif di kelas ini.</p>
  }
  const byId = new Map(nilai.map((n) => [n.siswaId, n]))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2 font-medium">No</th>
            <th className="px-2 py-2 font-medium">Nama siswa</th>
            {sumber.map((s) => (
              <th key={s.id} className="px-2 py-2 font-medium text-right" title={s.judul}>
                <span className="block max-w-[120px] truncate">{s.judul}</span>
                <span className="font-normal normal-case text-[10px]">{s.bobot}%</span>
              </th>
            ))}
            <th className="px-2 py-2 font-medium text-right text-muh-800">Nilai SLM</th>
          </tr>
        </thead>
        <tbody>
          {siswa.map((s, i) => {
            const row = byId.get(s.id)
            return (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-2 text-muted">{i + 1}</td>
                <td className="px-2 py-2 font-medium text-slate-800">{s.nama}</td>
                {sumber.map((src) => (
                  <td key={src.id} className="px-2 py-2 text-right tabular-nums text-slate-700">
                    {formatNilai(row?.perSumber?.[src.id])}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-muh-900">
                  {formatNilai(row?.nilaiAkhir)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabelNilaiSederhana({
  siswa,
  nilai,
  labelKolom,
}: {
  siswa: SiswaDasar[] | null
  nilai: NilaiSiswaTp[] | null
  labelKolom: string
}) {
  if (siswa === null || nilai === null) {
    return <p className="text-sm text-muted">Memuat roster…</p>
  }
  if (siswa.length === 0) {
    return <p className="text-sm text-muted">Belum ada siswa aktif di kelas ini.</p>
  }
  const byId = new Map(nilai.map((n) => [n.siswaId, n]))
  return (
    <table className="w-full min-w-[320px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-muted">
          <th className="px-2 py-2 font-medium">No</th>
          <th className="px-2 py-2 font-medium">Nama siswa</th>
          <th className="px-2 py-2 font-medium text-right">{labelKolom}</th>
        </tr>
      </thead>
      <tbody>
        {siswa.map((s, i) => (
          <tr key={s.id} className="border-b border-slate-100 last:border-0">
            <td className="px-2 py-2 text-muted">{i + 1}</td>
            <td className="px-2 py-2 font-medium text-slate-800">{s.nama}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-800">
              {formatNilai(byId.get(s.id)?.nilaiAkhir)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

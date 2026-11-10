/**
 * Rekap Nilai — pusat agregasi nilai TP (SLM / STS / SAS) per mapel×kelas.
 * Tahap 2: sumber otomatis tugas/kuis, bobot SLM live; daftar kelas×mapel = penugasan + perluasan wali.
 * Belum: tulis cache nilai akhir + Cloud Function sinkron ke Penilaian.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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

/** Warna skor: hijau ≥75, amber 60–74, merah <60, netral jika kosong */
function skorClass(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return 'text-slate-400'
  if (n >= 75) return 'text-emerald-700'
  if (n >= 60) return 'text-amber-700'
  return 'text-red-700'
}

function skorBadgeClass(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return 'bg-slate-100 text-slate-500'
  if (n >= 75) return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
  if (n >= 60) return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
  return 'bg-red-50 text-red-800 ring-1 ring-red-200/80'
}

function ringkasNilai(nilai: NilaiSiswaTp[] | null): {
  rata: number | null
  min: number | null
  max: number | null
  terisi: number
  total: number
} {
  if (!nilai?.length) return { rata: null, min: null, max: null, terisi: 0, total: 0 }
  const angka = nilai
    .map((r) => r.nilaiAkhir)
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
  if (!angka.length) return { rata: null, min: null, max: null, terisi: 0, total: nilai.length }
  const sum = angka.reduce((a, b) => a + b, 0)
  return {
    rata: Math.round((sum / angka.length) * 10) / 10,
    min: Math.min(...angka),
    max: Math.max(...angka),
    terisi: angka.length,
    total: nilai.length,
  }
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

  const ringkasAktif = useMemo(() => {
    if (subTab === 'slm') return ringkasNilai(nilaiSlm)
    if (subTab === 'sts') return ringkasNilai(nilaiSts)
    return ringkasNilai(nilaiSas)
  }, [subTab, nilaiSlm, nilaiSts, nilaiSas])

  if (muatPasangan && !pasangan.length) {
    return (
      <div className="space-y-4">
        <HeaderRekap />
        <div className="card-soft flex items-center gap-3 px-4 py-5 text-sm text-muted">
          <Spinner />
          Memuat daftar kelas × mapel…
        </div>
      </div>
    )
  }

  if (!pasangan.length) {
    return (
      <div className="space-y-4">
        <HeaderRekap />
        <div className="lms-empty">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <p className="font-medium text-slate-800">Belum ada kelas × mapel</p>
          <p className="mx-auto mt-1 max-w-md text-sm">
            Pastikan penugasan mapel atau status wali kelas sudah diisi di aplikasi Penilaian
            (sumber yang sama dengan kartu di Ruang Kelas).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <HeaderRekap />

      {/* Filter kelas × mapel + ringkasan konteks */}
      <div className="card-soft px-3.5 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="shrink-0">Kelas</span>
            <select
              className="lms-input w-auto min-w-[4.5rem] py-1.5 text-sm font-semibold text-slate-800"
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

          <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

          <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="shrink-0">Mapel</span>
            <select
              className="lms-input max-w-[16rem] py-1.5 text-sm font-medium text-slate-800 sm:max-w-[18rem]"
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

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {tpList && tpList.length > 0 && (
              <span className="lms-count-pill">{tpList.length} TP</span>
            )}
            {siswa && siswa.length > 0 && (
              <span className="lms-count-pill">{siswa.length} siswa</span>
            )}
            <button
              type="button"
              className="lms-btn-secondary text-sm"
              disabled={busy || busyNilai}
              onClick={() => {
                void muatTpDanSiswa()
              }}
              title="Muat ulang data TP dan nilai"
            >
              {busy || busyNilai ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner small /> Memuat…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    <path d="M21 3v6h-6" />
                  </svg>
                  Muat ulang
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          role="alert"
        >
          <span className="mt-0.5 shrink-0 font-bold" aria-hidden>
            !
          </span>
          <span>{error}</span>
        </div>
      )}
      {pesan && (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
          role="status"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            ✓
          </span>
          <span>{pesan}</span>
        </div>
      )}

      {tpList && tpList.length === 0 && !busy && (
        <div className="lms-empty">
          <p className="font-medium text-slate-800">Belum ada Tujuan Pembelajaran</p>
          <p className="mx-auto mt-1 max-w-md text-sm">
            Tidak ada TP untuk <strong>{mapel}</strong> · <strong>{kelas}</strong>. Buat TP di
            aplikasi Penilaian terlebih dahulu.
          </p>
        </div>
      )}

      {tpList && tpList.length > 0 && (
        <>
          {/* TP tabs */}
          <div
            className="lms-tabs overflow-x-auto pb-px"
            role="tablist"
            aria-label="Tujuan Pembelajaran"
          >
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
              {/* Konteks TP */}
              <div className="card-soft overflow-hidden">
                <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-muh-50/80 to-white px-4 py-3.5">
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-muh-600 px-2.5 py-1 text-xs font-bold tracking-wide text-white">
                    TP {tpAktif.nomorTp}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muh-600">
                      Tujuan Pembelajaran
                    </div>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-800">
                      {tpAktif.namaTp}
                    </p>
                  </div>
                </div>

                {/* Sub-tab jenis + ringkasan */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-2 pt-1">
                  <div className="lms-tabs border-0" role="tablist" aria-label="Jenis penilaian">
                    {(['slm', 'sts', 'sas'] as SubTab[]).map((j) => {
                      const count =
                        j === 'slm'
                          ? sumberSlm.length
                          : j === 'sts'
                            ? sumberSts.length
                            : sumberSas.length
                      return (
                        <button
                          key={j}
                          type="button"
                          role="tab"
                          aria-selected={subTab === j}
                          onClick={() => setSubTab(j)}
                          className={`lms-tab ${subTab === j ? 'lms-tab--active' : ''}`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {NAMA_JENIS_NILAI_TP[j]}
                            {count > 0 && (
                              <span
                                className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                  subTab === j
                                    ? 'bg-muh-100 text-muh-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {!busyNilai && ringkasAktif.total > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-2 pb-2 text-xs text-muted">
                      <StatChip
                        label="Rata-rata"
                        value={formatNilai(ringkasAktif.rata)}
                        emphasize
                      />
                      <StatChip label="Min" value={formatNilai(ringkasAktif.min)} />
                      <StatChip label="Max" value={formatNilai(ringkasAktif.max)} />
                      <StatChip
                        label="Terisi"
                        value={`${ringkasAktif.terisi}/${ringkasAktif.total}`}
                      />
                    </div>
                  )}
                </div>

                <div className="min-h-[12rem]">
                  {busyNilai && (
                    <div className="flex items-center gap-3 p-6 text-sm text-muted">
                      <Spinner />
                      Memuat nilai dari tugas &amp; kuis…
                    </div>
                  )}

                  {!busyNilai && subTab === 'slm' && (
                    <div className="space-y-4 p-4">
                      <p className="text-sm leading-relaxed text-muted">
                        Nilai SLM digabung dari tugas dan kuis yang terhubung ke TP ini. Atur{' '}
                        <strong className="text-slate-700">bobot persen</strong> tiap sumber
                        (jumlah harus 100%), lalu simpan.
                      </p>

                      {sumberSlm.length === 0 ? (
                        <EmptySumber
                          judul="Belum ada sumber SLM"
                          deskripsi={
                            <>
                              Buat tugas (lampirkan TP) atau kuis dengan jenis penilaian{' '}
                              <strong>SLM</strong> dan pilih TP ini.
                            </>
                          }
                        />
                      ) : (
                        <>
                          {/* Panel bobot */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Bobot sumber
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    persenOk
                                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                      : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      persenOk ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  Total {totalPersenSlm}%
                                  {persenOk ? ' · OK' : ' · harus 100%'}
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

                            {/* Progress total */}
                            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  persenOk
                                    ? 'bg-emerald-500'
                                    : totalPersenSlm > 100
                                      ? 'bg-red-500'
                                      : 'bg-amber-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, totalPersenSlm))}%`,
                                }}
                              />
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                              {sumberSlm.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span
                                      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                        s.jenis === 'tugas'
                                          ? 'bg-sky-50 text-sky-800'
                                          : 'bg-violet-50 text-violet-800'
                                      }`}
                                    >
                                      {s.jenis === 'tugas' ? 'Tugas' : 'Kuis'}
                                    </span>
                                  </div>
                                  <div
                                    className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-800"
                                    title={s.judul}
                                  >
                                    {s.judul}
                                  </div>
                                  <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-600">
                                    <span className="font-medium">Bobot</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={1}
                                      className="lms-input w-16 py-1 text-center text-sm font-semibold"
                                      value={s.bobot}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value)
                                        ubahBobot(s.id, Number.isFinite(v) ? v : 0)
                                      }}
                                    />
                                    <span className="font-semibold text-slate-700">%</span>
                                  </label>
                                </div>
                              ))}
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
                      <p className="text-sm leading-relaxed text-muted">
                        Nilai STS dari kuis/asesmen dengan jenis penilaian{' '}
                        <strong className="text-slate-700">STS</strong>
                        {sumberSts.length
                          ? ` (${sumberSts.map((s) => s.judul).join(', ')})`
                          : ''}
                        . Input offline tersedia di modul Kuis.
                      </p>
                      {sumberSts.length === 0 ? (
                        <EmptySumber
                          judul="Belum ada kuis STS"
                          deskripsi="Buat kuis dengan jenis penilaian STS dan kaitkan ke TP / mapel ini."
                        />
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
                      <p className="text-sm leading-relaxed text-muted">
                        Nilai SAS dari kuis/asesmen dengan jenis penilaian{' '}
                        <strong className="text-slate-700">SAS</strong>
                        {sumberSas.length
                          ? ` (${sumberSas.map((s) => s.judul).join(', ')})`
                          : ''}
                        .
                      </p>
                      {sumberSas.length === 0 ? (
                        <EmptySumber
                          judul="Belum ada kuis SAS"
                          deskripsi="Buat kuis dengan jenis penilaian SAS dan kaitkan ke TP / mapel ini."
                        />
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
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Rekap nilai akhir mapel</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Tabel seluruh nilai akhir TP (SLM / STS / SAS) untuk dikirim ke aplikasi Penilaian
              akan ditampilkan di sini pada tahap sinkronisasi (Tahap 3).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderRekap() {
  return (
    <div className="lms-page-intro">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Rekap Nilai</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
        Agregasi nilai per Tujuan Pembelajaran (SLM dari tugas &amp; kuis, STS &amp; SAS dari
        asesmen) untuk disinkronkan ke aplikasi Penilaian.
      </p>
    </div>
  )
}

function StatChip({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200/80">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular-nums ${emphasize ? 'text-muh-800' : 'text-slate-800'}`}>
        {value}
      </span>
    </span>
  )
}

function EmptySumber({
  judul,
  deskripsi,
}: {
  judul: string
  deskripsi: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M12 18v-6M9 15h6" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-800">{judul}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{deskripsi}</p>
    </div>
  )
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <svg
      className={`animate-spin text-muh-600 ${size}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
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
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted">
        <Spinner small /> Memuat roster…
      </div>
    )
  }
  if (siswa.length === 0) {
    return <p className="py-4 text-sm text-muted">Belum ada siswa aktif di kelas ini.</p>
  }
  const byId = new Map(nilai.map((n) => [n.siswaId, n]))
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50/95 px-3 py-2.5 font-semibold">No</th>
              <th className="sticky left-8 z-10 min-w-[10rem] bg-slate-50/95 px-3 py-2.5 font-semibold">
                Nama siswa
              </th>
              {sumber.map((s) => (
                <th key={s.id} className="px-3 py-2.5 text-right font-semibold" title={s.judul}>
                  <span className="block max-w-[7.5rem] truncate normal-case tracking-normal text-slate-700">
                    {s.judul}
                  </span>
                  <span className="mt-0.5 block font-normal normal-case text-[10px] text-slate-400">
                    {s.bobot}%
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-semibold text-muh-800">Nilai SLM</th>
            </tr>
          </thead>
          <tbody>
            {siswa.map((s, i) => {
              const row = byId.get(s.id)
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 transition-colors last:border-0 hover:bg-muh-50/40"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-muted group-hover:bg-muh-50/40">
                    {i + 1}
                  </td>
                  <td className="sticky left-8 z-10 bg-white px-3 py-2.5 font-medium text-slate-800">
                    {s.nama}
                  </td>
                  {sumber.map((src) => (
                    <td
                      key={src.id}
                      className={`px-3 py-2.5 text-right tabular-nums ${skorClass(row?.perSumber?.[src.id])}`}
                    >
                      {formatNilai(row?.perSumber?.[src.id])}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${skorBadgeClass(row?.nilaiAkhir)}`}
                    >
                      {formatNilai(row?.nilaiAkhir)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted">
        <Spinner small /> Memuat roster…
      </div>
    )
  }
  if (siswa.length === 0) {
    return <p className="py-4 text-sm text-muted">Belum ada siswa aktif di kelas ini.</p>
  }
  const byId = new Map(nilai.map((n) => [n.siswaId, n]))
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 font-semibold">No</th>
              <th className="px-3 py-2.5 font-semibold">Nama siswa</th>
              <th className="px-3 py-2.5 text-right font-semibold">{labelKolom}</th>
            </tr>
          </thead>
          <tbody>
            {siswa.map((s, i) => {
              const n = byId.get(s.id)?.nilaiAkhir
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 transition-colors last:border-0 hover:bg-muh-50/40"
                >
                  <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{s.nama}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${skorBadgeClass(n)}`}
                    >
                      {formatNilai(n)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

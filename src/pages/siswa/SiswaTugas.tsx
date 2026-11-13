import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import { aksenMapel, inisialMapel } from '../../lib/uiAksen'
import { bersihHtml, teksPolos } from '../../lib/html'
import {
  daftarTugasAktifKelas,
  formatTenggatRelatif,
  statusTugasSiswa,
  type StatusTugasSiswa,
  type TugasSiswaRingkas,
} from '../../lib/tugasSiswa'
import {
  NAMA_JENIS_PENILAIAN_TUGAS_SISWA,
  type JenisPenilaianTugas,
  type TugasLms,
} from '../../types/tugas'
import type { NilaiTugasDok } from '../../lib/nilaiTugas'

const FILTER_STATUS_LABEL: Record<StatusTugasSiswa | 'semua', string> = {
  semua: 'Semua',
  belum: 'Belum dinilai',
  dinilai: 'Sudah dinilai',
  lewat: 'Lewat tenggat',
}

type FilterStatus = StatusTugasSiswa | 'semua'

/**
 * Katalog tugas siswa: dikelompokkan per mapel + filter status.
 * Pengumpulan file belum diaktifkan (koleksi lms_pengumpulan menyusul);
 * status «Sudah dinilai» memakai lms_nilai_tugas milik siswa.
 */
export default function SiswaTugas() {
  const { sesi } = useSiswa()
  const kelas = sesi?.kelas ?? ''
  const siswaId = sesi?.id ?? ''
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState<TugasLms[] | null>(null)
  const [nilaiMap, setNilaiMap] = useState<Record<string, NilaiTugasDok>>({})
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('semua')
  const [filterMapel, setFilterMapel] = useState<string>('semua')
  const [detail, setDetail] = useState<TugasLms | null>(null)

  const muat = useCallback(async () => {
    if (!kelas || !siswaId) return
    setError('')
    try {
      const tugas = await daftarTugasAktifKelas(kelas)
      setList(tugas)

      // Nilai milik siswa (rules: hanya milik sendiri)
      const qn = query(
        collection(db, 'lms_nilai_tugas'),
        where('siswaId', '==', siswaId),
        where('kelas', '==', String(kelas).toUpperCase()),
      )
      const snap = await getDocs(qn)
      const map: Record<string, NilaiTugasDok> = {}
      for (const d of snap.docs) {
        const data = d.data() as NilaiTugasDok
        if (data.tugasId) map[data.tugasId] = { ...data, id: d.id }
      }
      setNilaiMap(map)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat tugas')
      setList([])
    }
  }, [kelas, siswaId])

  useEffect(() => {
    void muat()
  }, [muat])

  // Buka detail dari URL ?id=
  useEffect(() => {
    const id = params.get('id')
    if (!id || !list) return
    const t = list.find((x) => x.id === id)
    if (t) setDetail(t)
  }, [params, list])

  const ringkas = useMemo((): TugasSiswaRingkas[] => {
    if (!list) return []
    return list.map((t) => {
      const nilai = nilaiMap[t.id]
      const st = statusTugasSiswa(t, nilai)
      return { tugas: t, status: st, nilai }
    })
  }, [list, nilaiMap])

  const daftarMapel = useMemo(() => {
    const set = new Set<string>()
    for (const r of ringkas) if (r.tugas.mapel) set.add(r.tugas.mapel)
    return [...set].sort((a, b) => a.localeCompare(b, 'id'))
  }, [ringkas])

  const terfilter = useMemo(() => {
    return ringkas.filter((r) => {
      if (filterMapel !== 'semua' && r.tugas.mapel !== filterMapel) return false
      if (filterStatus === 'semua') return true
      return r.status === filterStatus
    })
  }, [ringkas, filterMapel, filterStatus])

  const perMapel = useMemo(() => {
    const map = new Map<string, TugasSiswaRingkas[]>()
    for (const r of terfilter) {
      const m = r.tugas.mapel || 'Lainnya'
      const arr = map.get(m) ?? []
      arr.push(r)
      map.set(m, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ta = tenggatMs(a.tugas.tenggat)
        const tb = tenggatMs(b.tugas.tenggat)
        if (ta && tb) return ta - tb
        if (ta) return -1
        if (tb) return 1
        return (a.tugas.judul || '').localeCompare(b.tugas.judul || '', 'id')
      })
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'id'))
      .map(([mapel, items]) => ({ mapel, items }))
  }, [terfilter])

  const hitungStatus = useMemo(() => {
    const c: Record<FilterStatus, number> = { semua: 0, belum: 0, dinilai: 0, lewat: 0 }
    for (const r of ringkas) {
      if (filterMapel !== 'semua' && r.tugas.mapel !== filterMapel) continue
      c.semua++
      c[r.status]++
    }
    return c
  }, [ringkas, filterMapel])

  function bukaDetail(t: TugasLms) {
    setDetail(t)
    setParams({ id: t.id })
  }

  function tutupDetail() {
    setDetail(null)
    setParams({})
  }

  if (detail) {
    const nilai = nilaiMap[detail.id]
    const st = statusTugasSiswa(detail, nilai)
    const a = aksenMapel(detail.mapel)
    const jenis = (detail.jenisPenilaian ?? 'slm') as JenisPenilaianTugas
    return (
      <div className="space-y-4">
        <section className="kelas-hero" style={{ background: a.cover }}>
          <div className="kelas-hero-deco" aria-hidden />
          <div className="kelas-hero-inner">
            <button
              type="button"
              className="kelas-hero-back min-h-10 cursor-pointer items-center border-0 bg-transparent p-0"
              onClick={tutupDetail}
            >
              ← Daftar tugas
            </button>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <span className="kelas-hero-badge">{detail.mapel}</span>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {detail.judul}
                </h1>
                <p className="mt-1 text-xs text-white/85">
                  {NAMA_JENIS_PENILAIAN_TUGAS_SISWA[jenis]}
                  {detail.jenis === 'proyek' ? ' · Proyek' : ''}
                </p>
              </div>
              <div className="kelas-hero-mark" style={{ color: a.coverFg }} aria-hidden>
                {inisialMapel(detail.mapel)}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={
              st === 'dinilai'
                ? 'rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800'
                : st === 'lewat'
                  ? 'rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-800'
                  : 'rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800'
            }
          >
            {st === 'dinilai' ? 'Sudah dinilai' : st === 'lewat' ? 'Lewat tenggat' : 'Belum dinilai'}
          </span>
          {detail.tenggat != null && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
              Tenggat: {formatTenggatRelatif(detail.tenggat)}
            </span>
          )}
        </div>

        {nilai && typeof nilai.nilai === 'number' && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
            <div className="text-xs font-medium text-emerald-800/80">Nilai</div>
            <div className="mt-0.5 text-3xl font-bold text-emerald-900">
              {Number.isInteger(nilai.nilai) ? nilai.nilai : nilai.nilai.toLocaleString('id-ID')}
              <span className="text-base font-semibold text-emerald-700/70"> / 100</span>
            </div>
            {nilai.predikat && (
              <div className="mt-1 text-sm font-semibold text-emerald-800">
                Predikat {nilai.predikat}
              </div>
            )}
            {nilai.komentar?.trim() && (
              <p className="mt-2 text-sm leading-relaxed text-emerald-900/90">{nilai.komentar}</p>
            )}
          </div>
        )}

        {detail.deskripsi?.trim() && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">Deskripsi</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {detail.deskripsi}
            </p>
          </section>
        )}

        {teksPolos(detail.instruksi) ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">Instruksi</h2>
            <div
              className="prose prose-sm mt-2 max-w-none text-slate-700"
              dangerouslySetInnerHTML={{ __html: bersihHtml(detail.instruksi) }}
            />
          </section>
        ) : null}

        {!detail.deskripsi?.trim() && !teksPolos(detail.instruksi) && (
          <p className="text-sm text-slate-500">Belum ada deskripsi atau instruksi tambahan.</p>
        )}

        <p className="text-xs leading-relaxed text-slate-500">
          Pengumpulan tugas lewat aplikasi (unggah foto/file) akan segera tersedia. Untuk sementara,
          ikuti petunjuk guru di kelas atau di instruksi di atas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-lg font-bold text-slate-900">Tugas</h1>
        {list && list.length > 0 && (
          <span className="lms-count-pill">{list.length} tugas aktif</span>
        )}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {list === null && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada tugas aktif</p>
          <p className="mt-1 text-sm text-muted">Tugas dari gurumu akan muncul di sini.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status tugas">
            {(Object.keys(FILTER_STATUS_LABEL) as FilterStatus[]).map((key) => {
              const aktif = filterStatus === key
              const n = hitungStatus[key]
              return (
                <button
                  key={key}
                  type="button"
                  className={
                    aktif
                      ? 'rounded-full bg-muh-700 px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-muh-300'
                  }
                  onClick={() => setFilterStatus(key)}
                  aria-pressed={aktif}
                >
                  {FILTER_STATUS_LABEL[key]}
                  <span className={aktif ? 'ml-1 opacity-80' : 'ml-1 text-slate-400'}>{n}</span>
                </button>
              )
            })}
          </div>

          {daftarMapel.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter mata pelajaran">
              <button
                type="button"
                className={
                  filterMapel === 'semua'
                    ? 'rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600'
                }
                onClick={() => setFilterMapel('semua')}
              >
                Semua mapel
              </button>
              {daftarMapel.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={
                    filterMapel === m
                      ? 'rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600'
                  }
                  onClick={() => setFilterMapel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {terfilter.length === 0 && (
            <p className="text-sm text-slate-500">Tidak ada tugas untuk filter ini.</p>
          )}

          {perMapel.map((grup) => (
            <section key={grup.mapel} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                {grup.mapel}
                <span className="text-xs font-medium text-slate-400">{grup.items.length}</span>
              </h2>
              <ul className="space-y-3">
                {grup.items.map(({ tugas: t, status: st, nilai }) => {
                  const jenis = (t.jenisPenilaian ?? 'slm') as JenisPenilaianTugas
                  const tenggatTeks = formatTenggatRelatif(t.tenggat)
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-muh-300 sm:p-5"
                        onClick={() => bukaDetail(t)}
                      >
                        <div className="font-semibold text-slate-800">{t.judul}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {NAMA_JENIS_PENILAIAN_TUGAS_SISWA[jenis]}
                          {t.jenis === 'proyek' ? ' · Proyek' : ''}
                          {tenggatTeks ? ` · ${tenggatTeks}` : ''}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={
                              st === 'dinilai'
                                ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800'
                                : st === 'lewat'
                                  ? 'rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800'
                                  : 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800'
                            }
                          >
                            {st === 'dinilai'
                              ? nilai && typeof nilai.nilai === 'number'
                                ? `Nilai ${nilai.nilai}`
                                : 'Sudah dinilai'
                              : st === 'lewat'
                                ? 'Lewat tenggat'
                                : 'Belum dinilai'}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function tenggatMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  return 0
}

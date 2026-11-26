import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import { aksenMapel, inisialMapel } from '../../lib/uiAksen'
import { teksPolos } from '../../lib/html'
import { htmlInstruksiSiswa } from '../../lib/instruksiTugas'
import { LABEL_TAHAP } from '../../types/tugas'
import {
  daftarTugasAktifKelas,
  infoBatasAkhirSiswa,
  statusTugasSiswa,
  type StatusTugasSiswa,
  type TugasSiswaRingkas,
} from '../../lib/tugasSiswa'
import {
  NAMA_JENIS_PENILAIAN_TUGAS_SISWA,
  type JenisPenilaianTugas,
  type TugasLms,
} from '../../types/tugas'
import { rapikanPoin, rapikanRiwayat, type NilaiTugasDok } from '../../lib/nilaiTugas'
import {
  dibukaMs,
  normKesempatanMaks,
  normNilaiDipakai,
  percobaanTerpakai,
  perbaikanTerbuka,
  teksAturanKesempatan,
  tugasBerulang,
} from '../../lib/kesempatanTugas'
import '../../styles/tugas-ditutup.css'
import { alasanTugasDitutup } from '../../lib/tugasTutup'
import SiswaIcon from './SiswaIcon'
import PengumpulanSiswa from './PengumpulanSiswa'
import KelompokSiswaPanel from './KelompokSiswaPanel'
import { muatPengumpulanSaya, type PengumpulanDok } from '../../lib/pengumpulan'
import {
  kelompokKelasSaya,
  kelompokSaya,
  ketuaSudahMengumpulkan,
  type TugasKelompokDok,
  isKetua,
} from '../../lib/tugasKelompok'

const FILTER_STATUS_LABEL: Record<StatusTugasSiswa | 'semua', string> = {
  semua: 'Semua',
  belum: 'Belum dinilai',
  dinilai: 'Sudah dinilai',
  lewat: 'Lewat batas akhir',
  ditutup: 'Ditutup',
}

type FilterStatus = StatusTugasSiswa | 'semua'

/**
 * Katalog tugas siswa: dikelompokkan per mapel + filter status.
 * Pengumpulan foto: lms_pengumpulan (ANTIREGRESI §132). Status «Sudah dinilai» tetap memakai
 * lms_nilai_tugas milik siswa; «Terkumpul» hanya lencana tambahan, bukan status filter.
 */

/** Hitungan mundur hidup ke batas akhir (diperbarui tiap 30 detik). */
function BatasAkhirBlok({
  tenggat,
  mode = 'kartu',
}: {
  tenggat: unknown
  mode?: 'kartu' | 'badge'
}) {
  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setSekarang(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const batas = infoBatasAkhirSiswa(tenggat, sekarang)
  if (!batas) return null
  if (mode === 'badge') {
    return (
      <span
        className={
          batas.lewat
            ? 'sw-kat-badge sw-kat-badge--danger'
            : batas.mendesak
              ? 'sw-kat-badge sw-kat-badge--warn'
              : 'sw-kat-badge sw-kat-badge--info'
        }
      >
        {batas.tanggal}
        {batas.sisa ? ` · ${batas.sisa}` : ''}
      </span>
    )
  }
  return (
    <div
      className={
        batas.lewat
          ? 'sw-kat-batas sw-kat-batas--lewat'
          : batas.mendesak
            ? 'sw-kat-batas sw-kat-batas--segera'
            : 'sw-kat-batas'
      }
      aria-live="polite"
    >
      <span className="sw-kat-batas-tgl">{batas.tanggal}</span>
      <span className="sw-kat-batas-sisa">{batas.sisa}</span>
    </div>
  )
}

export default function SiswaTugas() {
  const { sesi } = useSiswa()
  const kelas = sesi?.kelas ?? ''
  const siswaId = sesi?.id ?? ''
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState<TugasLms[] | null>(null)
  const [nilaiMap, setNilaiMap] = useState<Record<string, NilaiTugasDok>>({})
  const [kumpulMap, setKumpulMap] = useState<Record<string, PengumpulanDok>>({})
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('semua')
  const [filterMapel, setFilterMapel] = useState<string>('semua')
  const [detail, setDetail] = useState<TugasLms | null>(null)
  const [kelompokDetail, setKelompokDetail] = useState<TugasKelompokDok | null>(null)
  const [loadingKelompok, setLoadingKelompok] = useState(false)
  /** Kelompok milik siswa per tugas (untuk lencana katalog). Gagal muat → kosong, katalog tetap jalan. */
  const [kelompokMap, setKelompokMap] = useState<Record<string, TugasKelompokDok>>({})
  const [izinMandiri, setIzinMandiri] = useState(false)
  const [kumpulKetua, setKumpulKetua] = useState<boolean | null>(null)

  const muat = useCallback(async () => {
    if (!kelas || !siswaId) return
    setError('')
    try {
      const tugas = await daftarTugasAktifKelas(kelas)
      setList(tugas)

      // Kelompok sendiri (lencana katalog): gagal baca tidak boleh menggagalkan daftar tugas.
      try {
        const ks = await kelompokKelasSaya(kelas, siswaId)
        const peta: Record<string, TugasKelompokDok> = {}
        for (const k of ks) peta[k.tugasId] = k
        setKelompokMap(peta)
      } catch (e3) {
        console.warn('Kelompok siswa gagal dimuat', e3)
      }

      // Pengumpulan sendiri: gagal baca tidak boleh menggagalkan daftar tugas.
      try {
        setKumpulMap(await muatPengumpulanSaya(siswaId))
      } catch (e2) {
        console.warn('Pengumpulan siswa gagal dimuat', e2)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat tugas')
      setList([])
    }
  }, [kelas, siswaId])


  // Realtime nilai: «Minta perbaikan» dari guru langsung membuka kirim ulang (tanpa refresh manual).
  useEffect(() => {
    if (!kelas || !siswaId) return
    const qn = query(
      collection(db, 'lms_nilai_tugas'),
      where('siswaId', '==', siswaId),
      where('kelas', '==', String(kelas).toUpperCase()),
    )
    const unsub = onSnapshot(
      qn,
      (snap) => {
        const map: Record<string, NilaiTugasDok> = {}
        for (const d of snap.docs) {
          const data = d.data() as NilaiTugasDok
          if (data.tugasId) map[data.tugasId] = { ...data, id: d.id }
        }
        setNilaiMap(map)
      },
      (err) => {
        console.warn('Nilai siswa realtime gagal', err)
      },
    )
    return () => unsub()
  }, [kelas, siswaId])


  useEffect(() => {
    void muat()
  }, [muat])

  useEffect(() => {
    const id = params.get('id')
    if (!id || !list) return
    const t = list.find((x) => x.id === id)
    if (t) setDetail(t)
    else setDetail(null)
  }, [params, list])

  // Muat kelompok siswa untuk tugas detail (modeKelompok)
  useEffect(() => {
    if (!detail?.modeKelompok || !siswaId) {
      setKelompokDetail(null)
      return
    }
    let batal = false
    setLoadingKelompok(true)
    void kelompokSaya(detail.id, siswaId, String(kelas).toUpperCase())
      .then((k) => {
        if (!batal) setKelompokDetail(k)
      })
      .catch((e) => {
        console.warn('kelompokSaya', e)
        if (!batal) setKelompokDetail(null)
      })
      .finally(() => {
        if (!batal) setLoadingKelompok(false)
      })
    return () => {
      batal = true
    }
  }, [detail?.id, detail?.modeKelompok, siswaId, kelas])

  // Anggota non-ketua: apakah ketua sudah mengumpulkan? (hanya baca; null = tidak diketahui)
  useEffect(() => {
    setKumpulKetua(null)
    if (!kelompokDetail || kelompokDetail.ketuaId === siswaId) return
    let batal = false
    void ketuaSudahMengumpulkan(kelompokDetail).then((v) => {
      if (!batal) setKumpulKetua(v)
    })
    return () => {
      batal = true
    }
  }, [kelompokDetail, siswaId])

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
    const c: Record<FilterStatus, number> = { semua: 0, belum: 0, dinilai: 0, lewat: 0, ditutup: 0 }
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
    const kategoriDinilai = (detail.pengaturanPenilaian?.kategori ?? []).filter((k) =>
      String(k.nama ?? '').trim(),
    )
    // —— Tugas berulang (ANTIREGRESI §Tugas.Kesempatan) ——
    const berulang = tugasBerulang(detail)
    const bolehPerbaiki = berulang && perbaikanTerbuka(nilai) && alasanTugasDitutup(detail) === null
    const kirimanBaru = bolehPerbaiki && (kumpulMap[detail.id]?.diubahMs ?? 0) > dibukaMs(nilai)
    const terpakai = nilai ? percobaanTerpakai(nilai) : 0
    const percobaanSekarang = bolehPerbaiki ? terpakai + 1 : Math.max(1, terpakai)
    const maksKes = normKesempatanMaks(detail.kesempatanMaks)
    const poinPerbaikan = rapikanPoin(nilai?.poinPerbaikan) ?? []
    const riwayatNilai = rapikanRiwayat(nilai?.riwayat) ?? []
    const hero = (
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
    )

    // Guru menandai tugas selesai → ditutup untuk siswa: hanya keterangan, tidak ada isi tugas,
    // kelompok, maupun form pengumpulan. Tugas tetap muncul di katalog sampai diarsipkan guru.
    // Rules (lmsSiswaBolehKumpul + Storage) menolak tulis juga — ANTIREGRESI §Tugas.Selesai.Ditutup.
    const alasanTutup = alasanTugasDitutup(detail)
    if (alasanTutup !== null) {
      return (
        <div className="space-y-4">
          {hero}
          <section className="sw-kat-panel sw-tugas-ditutup" role="status">
            <h2>Penugasan telah ditutup</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-700">
              {alasanTutup === 'tenggat'
                ? 'Batas waktu pengumpulan tugas ini sudah berakhir, jadi kamu tidak dapat lagi membuka atau mengirimkan tugas ini.'
                : 'Guru sudah menutup tugas ini, jadi kamu tidak dapat lagi membuka atau mengirimkan tugas ini.'}{' '}
              Jika ada yang ingin ditanyakan, hubungi gurumu.
            </p>
          </section>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {hero}

        <div className="sw-kat-detail-meta">
          <span
            className={
              bolehPerbaiki
                ? 'sw-kat-badge sw-kat-badge--warn'
                : st === 'dinilai'
                  ? 'sw-kat-badge sw-kat-badge--ok'
                  : st === 'lewat'
                    ? 'sw-kat-badge sw-kat-badge--danger'
                    : 'sw-kat-badge sw-kat-badge--warn'
            }
          >
            {bolehPerbaiki
              ? kirimanBaru
                ? 'Perbaikan terkirim · menunggu dinilai'
                : 'Perbaiki lalu kirim lagi'
              : st === 'dinilai'
                ? 'Sudah dinilai'
                : st === 'lewat'
                  ? 'Lewat batas akhir'
                  : 'Belum dinilai'}
          </span>
          {berulang ? (
            <span className="sw-kat-badge sw-kat-badge--info">
              Percobaan ke-{percobaanSekarang}
              {maksKes === 0 ? '' : ` dari ${maksKes}`}
            </span>
          ) : null}
          <BatasAkhirBlok tenggat={detail.tenggat} mode="badge" />
        </div>

        {nilai && typeof nilai.nilai === 'number' && (
          <div className="sw-kat-nilai">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-800/70">Nilai</div>
            <div className="sw-kat-nilai-n">
              {Number.isInteger(nilai.nilai) ? nilai.nilai : nilai.nilai.toLocaleString('id-ID')}
              <span> / 100</span>
            </div>
            {nilai.predikat && (
              <div className="mt-1 text-sm font-bold text-emerald-800">Predikat {nilai.predikat}</div>
            )}
            {nilai.komentar?.trim() && (
              <p className="mt-2 text-sm leading-relaxed text-emerald-900/90">{nilai.komentar}</p>
            )}
            {berulang && riwayatNilai.length > 1 ? (
              <p className="mt-2 text-xs text-emerald-900/80">
                {normNilaiDipakai(detail.nilaiDipakai) === 'terakhir'
                  ? 'Nilai yang dipakai: percobaan terakhir.'
                  : 'Nilai yang dipakai: nilai terbaik dari semua percobaanmu.'}
              </p>
            ) : null}
          </div>
        )}

        {berulang && (
          <section className="sw-kat-panel">
            <h2>Aturan mengerjakan</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-700">{teksAturanKesempatan(detail)}</p>
            <p className="sw-kat-hint">
              {bolehPerbaiki
                ? kirimanBaru
                  ? 'Perbaikanmu sudah terkirim. Tunggu gurumu menilainya ya.'
                  : 'Gurumu membuka kesempatan memperbaiki. Baca poin perbaikan di bawah, lalu kirim karya barumu.'
                : 'Kalau karyamu masih bisa lebih baik, gurumu bisa membuka kesempatan memperbaiki setelah menilai.'}
            </p>
          </section>
        )}

        {poinPerbaikan.length > 0 && (
          <section className="sw-kat-panel">
            <h2>Yang bisa kamu perbaiki</h2>
            <p className="sw-kat-hint">
              {bolehPerbaiki
                ? 'Baca satu per satu, perbaiki karyamu, lalu kirim lagi.'
                : 'Catatan dari gurumu untuk karyamu.'}
            </p>
            <ol className="m-0 space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
              {poinPerbaikan.map((x, i) => (
                <li key={i} className="whitespace-pre-wrap">{x}</li>
              ))}
            </ol>
          </section>
        )}

        {berulang && riwayatNilai.length > 1 && (
          <section className="sw-kat-panel">
            <h2>Perjalanan nilaimu</h2>
            <ul className="m-0 space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
              {riwayatNilai.map((r) => (
                <li key={r.ke}>
                  Percobaan {r.ke}: <strong>{r.nilai}</strong>
                  {r.predikat ? ` (${r.predikat})` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}

        {detail.deskripsi?.trim() && (
          <section className="sw-kat-panel">
            <h2>Deskripsi</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {detail.deskripsi}
            </p>
          </section>
        )}

        {teksPolos(detail.instruksi) ? (
          <section className="sw-kat-panel">
            <h2>Instruksi</h2>
            <div
              className="sw-ins"
              dangerouslySetInnerHTML={{ __html: htmlInstruksiSiswa(detail.instruksi) }}
            />
          </section>
        ) : null}

        {kategoriDinilai.length > 0 && (
          <section className="sw-kat-panel sw-dinilai">
            <h2>Yang akan dinilai gurumu</h2>
            <p className="sw-kat-hint">Baca dulu supaya tahu bagian mana yang perlu kamu kerjakan dengan baik.</p>
            <ul className="sw-dinilai-list">
              {kategoriDinilai.map((k) => (
                <li key={k.id} className="sw-dinilai-item">
                  <span className="sw-dinilai-nama">{k.nama}</span>
                  {k.mapel ? <span className="sw-dinilai-mapel">{k.mapel}</span> : null}
                  {k.tahap ? <span className="sw-dinilai-mapel">{LABEL_TAHAP[k.tahap]}</span> : null}
                  {k.sumber === 'observasi' ? (
                    <span className="sw-dinilai-mapel">Dinilai lewat pengamatan guru</span>
                  ) : null}
                  {k.deskripsi?.trim() ? <span className="sw-dinilai-desk">{k.deskripsi}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!detail.deskripsi?.trim() && !teksPolos(detail.instruksi) && (
          <div className="sw-kat-empty">
            <p className="sw-kat-empty-title">Belum ada deskripsi</p>
            <p className="sw-kat-empty-desc">Tanyakan ke gurumu jika ada yang kurang jelas.</p>
          </div>
        )}

        
        {detail.lampiranList && detail.lampiranList.length > 0 && (
          <section className="sw-kat-panel sw-lampiran">
            <h2>Berkas dari gurumu</h2>
            <p className="sw-kat-hint">Unduh template atau file pendukung, lalu kerjakan sesuai instruksi.</p>
            <ul className="sw-lampiran-list">
              {detail.lampiranList.map((L) => (
                <li key={L.id}>
                  <a href={L.url} target="_blank" rel="noreferrer" className="sw-lampiran-tautan">
                    {L.nama}
                  </a>
                  <span className="sw-lampiran-meta">
                    {L.jenis}
                    {L.ukuran ? ` · ${L.ukuran >= 1048576 ? `${(L.ukuran / 1048576).toFixed(1)} MB` : `${Math.round(L.ukuran / 1024)} KB`}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {detail.modeKelompok && (
          loadingKelompok ? (
            <p className="sw-hint">Memuat info kelompok…</p>
          ) : (
            <KelompokSiswaPanel
              tugas={detail}
              siswaId={siswaId}
              siswaNama={sesi?.nama ?? ''}
              kelas={String(kelas).toUpperCase()}
              kelompok={kelompokDetail}
              terkunci={st === 'dinilai'}
              onKelompokChange={(k) => {
                setKelompokDetail(k)
                if (k) setKelompokMap((prev) => ({ ...prev, [detail.id]: k }))
                else
                  setKelompokMap((prev) => {
                    const n = { ...prev }
                    delete n[detail.id]
                    return n
                  })
              }}
              onIzinChange={setIzinMandiri}
            />
          )
        )}

        <PengumpulanSiswa
          key={`${detail.id}-${bolehPerbaiki ? 'perbaiki' : 'normal'}`}
          tugas={detail}
          siswaId={siswaId}
          siswaNama={sesi?.nama ?? ''}
          kelas={String(kelas).toUpperCase()}
          ada={kumpulMap[detail.id] ?? null}
          terkunci={st === 'dinilai' && !bolehPerbaiki}
          modePerbaikan={bolehPerbaiki}
          onTersimpan={(d) => setKumpulMap((prev) => ({ ...prev, [detail.id]: d }))}
          modeKelompok={detail.modeKelompok === true}
          isKetuaKelompok={detail.modeKelompok ? isKetua(kelompokDetail, siswaId) : true}
          punyaKelompok={detail.modeKelompok ? !!kelompokDetail : true}
          izinMandiri={detail.modeKelompok ? izinMandiri : false}
          terkumpulLewatKetua={kumpulKetua}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="sw-kat-head">
        <div className="sw-page-head sw-tone-amber">
          <span className="sw-page-ico" aria-hidden>
            <SiswaIcon name="pencil" size={26} />
          </span>
          <div className="min-w-0">
            <h1 className="sw-page-title">Tugas</h1>
            <p className="sw-page-sub">Kerjakan & kumpulkan dari gurumu</p>
          </div>
        </div>
        {list && list.length > 0 && (
          <div className="sw-kat-stats" aria-label="Ringkasan tugas">
            <div className="sw-kat-stat">
              <span className="sw-kat-stat-n">{hitungStatus.semua}</span>
              <span className="sw-kat-stat-l">Aktif</span>
            </div>
            <div className="sw-kat-stat">
              <span className="sw-kat-stat-n">{hitungStatus.belum}</span>
              <span className="sw-kat-stat-l">Belum</span>
            </div>
            <div className="sw-kat-stat">
              <span className="sw-kat-stat-n">{hitungStatus.dinilai}</span>
              <span className="sw-kat-stat-l">Dinilai</span>
            </div>
            {hitungStatus.lewat > 0 && (
              <div className="sw-kat-stat">
                <span className="sw-kat-stat-n">{hitungStatus.lewat}</span>
                <span className="sw-kat-stat-l">Lewat</span>
              </div>
            )}
            {hitungStatus.ditutup > 0 && (
              <div className="sw-kat-stat">
                <span className="sw-kat-stat-n">{hitungStatus.ditutup}</span>
                <span className="sw-kat-stat-l">Ditutup</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {list === null && <p className="text-slate-500">Memuat…</p>}
      {list?.length === 0 && (
        <div className="sw-kat-empty">
          <div className="sw-kat-card-icon bg-amber-50 text-amber-700" aria-hidden>
            <SiswaIcon name="pencil" size={28} />
          </div>
          <p className="sw-kat-empty-title">Belum ada tugas aktif</p>
          <p className="sw-kat-empty-desc">Tugas dari gurumu akan muncul di sini.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="sw-kat-filters">
          <div className="sw-kat-chip-row" role="group" aria-label="Filter status tugas">
            {(Object.keys(FILTER_STATUS_LABEL) as FilterStatus[]).map((key) => {
              const on = filterStatus === key
              return (
                <button
                  key={key}
                  type="button"
                  className={`sw-kat-chip${on ? ' sw-kat-chip--on' : ''}`}
                  onClick={() => setFilterStatus(key)}
                  aria-pressed={on}
                >
                  {FILTER_STATUS_LABEL[key]}
                  <span className="sw-kat-chip-n">{hitungStatus[key]}</span>
                </button>
              )
            })}
          </div>

          {daftarMapel.length > 1 && (
            <div className="sw-kat-chip-row" role="group" aria-label="Filter mata pelajaran">
              <button
                type="button"
                className={`sw-kat-chip sw-kat-chip--mapel${filterMapel === 'semua' ? ' sw-kat-chip--on' : ''}`}
                onClick={() => setFilterMapel('semua')}
              >
                Semua mapel
              </button>
              {daftarMapel.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`sw-kat-chip sw-kat-chip--mapel${filterMapel === m ? ' sw-kat-chip--on' : ''}`}
                  onClick={() => setFilterMapel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {list && list.length > 0 && terfilter.length === 0 && (
        <div className="sw-kat-empty">
          <p className="sw-kat-empty-title">Tidak ada tugas untuk filter ini</p>
          <p className="sw-kat-empty-desc">Coba pilih status atau mapel lain.</p>
        </div>
      )}

      {perMapel.map((grup) => {
        const a = aksenMapel(grup.mapel)
        return (
          <section key={grup.mapel} className="sw-kat-section">
            <div className="sw-kat-section-head">
              <span className="sw-kat-section-bar" style={{ background: a.bar }} aria-hidden />
              <h2 className="sw-kat-section-title">{grup.mapel}</h2>
              <span className="sw-kat-section-count">{grup.items.length}</span>
            </div>
            <ul className="sw-kat-grid">
              {grup.items.map(({ tugas: t, status: st, nilai }) => {
                const jenis = (t.jenisPenilaian ?? 'slm') as JenisPenilaianTugas
                const am = aksenMapel(t.mapel || grup.mapel)
                return (
                  <li key={t.id}>
                    <button type="button" className="sw-kat-card" onClick={() => bukaDetail(t)}>
                      <span className="sw-kat-card-accent" style={{ background: am.bar }} aria-hidden />
                      <div className="sw-kat-card-top">
                        <div className="min-w-0 flex-1">
                          <h3 className="sw-kat-card-title">{t.judul}</h3>
                          <div className="sw-kat-card-meta">
                            <span>{NAMA_JENIS_PENILAIAN_TUGAS_SISWA[jenis]}</span>
                            {t.jenis === 'proyek' && (
                              <>
                                <span className="sw-kat-card-meta-dot" aria-hidden />
                                <span>Proyek</span>
                              </>
                            )}
                          </div>
                          <BatasAkhirBlok tenggat={t.tenggat} mode="kartu" />
                        </div>
                        <div
                          className="sw-kat-card-icon"
                          style={{ background: am.soft, color: am.bar }}
                          aria-hidden
                        >
                          <SiswaIcon name="pencil" size={22} />
                        </div>
                      </div>
                      <div className="sw-kat-card-body">
                        <span
                          className={
                            st === 'dinilai'
                              ? 'sw-kat-badge sw-kat-badge--ok'
                              : st === 'ditutup'
                                ? 'sw-kat-badge sw-kat-badge--info'
                                : st === 'lewat'
                                  ? 'sw-kat-badge sw-kat-badge--danger'
                                  : 'sw-kat-badge sw-kat-badge--warn'
                          }
                        >
                          {st === 'dinilai'
                            ? nilai && typeof nilai.nilai === 'number'
                              ? `Nilai ${nilai.nilai}`
                              : 'Sudah dinilai'
                            : st === 'ditutup'
                              ? 'Penugasan ditutup'
                              : st === 'lewat'
                                ? 'Lewat batas akhir'
                                : 'Belum dinilai'}
                        </span>
                        {tugasBerulang(t) && perbaikanTerbuka(nilai) && alasanTugasDitutup(t) === null && (
                          <span className="sw-kat-badge sw-kat-badge--warn">Boleh diperbaiki</span>
                        )}
                        {kumpulMap[t.id] && (
                          <span className="sw-kat-badge sw-kat-badge--info">Terkumpul</span>
                        )}
                        {t.modeKelompok && (
                          <span className="sw-kat-badge sw-kat-badge--info">
                            {kelompokMap[t.id]
                              ? kelompokMap[t.id].ketuaId === siswaId
                                ? 'Ketua kelompok'
                                : `Kelompok ${kelompokMap[t.id].ketuaNama}`
                              : 'Tugas kelompok'}
                          </span>
                        )}
                      </div>
                      <div className="sw-kat-card-actions">
                        <span className="sw-btn-primary" style={{ pointerEvents: 'none' }}>
                          Lihat detail
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
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

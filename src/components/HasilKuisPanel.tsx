import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  agregatPerSoal,
  daftarJawabanKuis,
  daftarJawabanKuisMultiKelas,
  formatSkor100,
  ringkasPerSiswa,
  jawabanTsMs,
  simpanNilaiManual,
  skorKe100,
  resetJawabanKuisTka,
  type JawabanKuis,
} from '../lib/jawabanKuis'
import { teksPolos } from '../lib/html'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_JENIS_PENILAIAN, type JenisPenilaianKuis } from '../types/kuis'
import { NAMA_TIPE, type TipeSoal, normalisasiDomainTka, NAMA_DOMAIN_TKA, type DomainTka } from '../types/soal'
import { useAuth } from '../context/AuthContext'
import {
  analisisKuisDenganAi,
  analisisSiswaDenganAi,
  bolehAnalisisKuisAi,
  htmlLaporanKuis,
  htmlLaporanSiswa,
  unduhLaporanDoc,
  type HasilAnalisisKuisAi,
  type HasilAnalisisSiswaAi,
} from '../lib/analisisKuisAi'
import { sinkronNilaiKuisKePenilaian } from '../lib/sinkronNilaiKuis'
import { updateKuis } from '../lib/kuis'
import { klasifikasiDomainTkaDenganAi } from '../lib/domainTkaAi'
import {
  adalahAdminTka,
  adalahMapelTka,
  kelasHasilTkaBolehDilihat,
} from '../lib/tkaAkses'
import { muatSiswaKelas, type SiswaDasar } from '../lib/siswaAuth'

type Props = {
  kuis: KuisLms
  /** Dipanggil setelah guru mengubah status publikasi hasil (TKA). */
  onUpdated?: () => void
}

/** Baris roster hasil TKA: siswa selalu tampil, jawaban opsional. */
/** Baris roster hasil TKA: siswa selalu tampil, jawaban opsional. */
type BarisHasilTka = {
  siswaId: string
  siswaNama: string
  kelas: string
  jawaban: JawabanKuis | null
}

/** Hitung skor per domain TKA (hanya soal yang berdomain). */
function skorPerDomain(jawaban: JawabanKuis | null, soalList: SoalKuis[]): Record<string, { skor: number; maks: number }> {
  const out: Record<string, { skor: number; maks: number }> = {
    pengetahuan: { skor: 0, maks: 0 },
    keterampilan_proses: { skor: 0, maks: 0 },
  }
  if (!jawaban?.detail) return out
  const byId = new Map(jawaban.detail.map((d) => [d.soalId, d]))
  for (const s of soalList) {
    const dom = normalisasiDomainTka(s.domainTka)
    if (!dom) continue
    out[dom].maks += Number(s.poin) || 0
    const d = byId.get(s.id)
    out[dom].skor += Number(d?.skor) || 0
  }
  return out
}

/** Persentase 0–100 per domain; null jika domain tidak punya soal (maks=0). */
function pctDomain(cell: { skor: number; maks: number } | undefined): number | null {
  if (!cell || cell.maks <= 0) return null
  return Math.round((cell.skor / cell.maks) * 1000) / 10
}

/**
 * Nilai akhir TKA = rata-rata persentase domain yang ada soalnya.
 * Bila kedua domain ada → (P + KP) / 2; bila satu → domain itu saja.
 */
function nilaiAkhirTka(dom: Record<string, { skor: number; maks: number }>): number | null {
  const p = pctDomain(dom.pengetahuan)
  const k = pctDomain(dom.keterampilan_proses)
  if (p == null && k == null) return null
  if (p == null) return k
  if (k == null) return p
  return Math.round(((p + k) / 2) * 10) / 10
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

function teksJawaban(soal: SoalKuis, jawab: unknown): string {
  if (jawab == null || jawab === '') return '(kosong)'
  if (soal.tipe === 'pg') {
    const op = soal.opsi?.find((o) => o.id === jawab)
    return op ? op.teks : String(jawab)
  }
  if (soal.tipe === 'pgk') {
    const ids = Array.isArray(jawab) ? jawab : []
    return (
      ids.map((id) => soal.opsi?.find((o) => o.id === id)?.teks ?? String(id)).join('; ') ||
      '(kosong)'
    )
  }
  if (soal.tipe === 'isian' || soal.tipe === 'uraian') {
    return String(jawab)
  }
  if (soal.tipe === 'bs' && jawab && typeof jawab === 'object') {
    const j = jawab as Record<string, boolean>
    return soal.pernyataan
      .map(
        (p) =>
          `${teksPolos(p.teks).slice(0, 40)}… → ${
            j[p.id] === true ? 'B' : j[p.id] === false ? 'S' : '?'
          }`,
      )
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
    return soal.kunciJawaban
      ? teksPolos(soal.kunciJawaban).slice(0, 200)
      : '(pedoman di kunci jawaban soal)'
  }
  return '—'
}

function BadgeStatus({ perluManual, status }: { perluManual: boolean; status: string }) {
  if (perluManual) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
        Perlu dinilai
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
      {status === 'selesai' ? 'Selesai' : status || 'Selesai'}
    </span>
  )
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-lg bg-muh-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm'
          : 'rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900'
      }
    >
      {children}
    </button>
  )
}


async function jalankanAnalisisSiswa(
  kuisId: string,
  jawabanId: string,
  setBusy: (v: boolean) => void,
  setErr: (v: string) => void,
  setHasil: (v: HasilAnalisisSiswaAi | null) => void,
) {
  setBusy(true)
  setErr('')
  try {
    const h = await analisisSiswaDenganAi(kuisId, jawabanId)
    setHasil(h)
  } catch (e) {
    setHasil(null)
    setErr(e instanceof Error ? e.message : 'Gagal menganalisis siswa.')
  } finally {
    setBusy(false)
  }
}

/** Daftar nilai + analisis + penilaian manual. ANTIREGRESI §55. */
export default function HasilKuisPanel({ kuis, onUpdated }: Props) {
  const { user, profil } = useAuth()
  const isTka = adalahMapelTka(kuis.mapel)
  const adminTka = adalahAdminTka(user, profil)
  const [hasilDipublish, setHasilDipublish] = useState(!!kuis.hasilDipublish)
  const [busyPublish, setBusyPublish] = useState(false)
  const [busyResetId, setBusyResetId] = useState<string | null>(null)
  const [busyDomainAi, setBusyDomainAi] = useState(false)
  const kelasTkaIzin = useMemo(
    () => (isTka ? kelasHasilTkaBolehDilihat(user, profil) : []),
    [isTka, user, profil],
  )
  // Analisis AI isian/uraian tidak dipakai untuk TKA (soal otomatis PG/PGK/BS).
  const bolehAi = !isTka && bolehAnalisisKuisAi(user?.uid)
  const bolehDomainAi = bolehAnalisisKuisAi(user?.uid)
  const [list, setList] = useState<JawabanKuis[] | null>(null)
  const [rosterTka, setRosterTka] = useState<SiswaDasar[] | null>(null)
  const [filterKelasTka, setFilterKelasTka] = useState<string>('semua')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'siswa' | 'soal'>('siswa')
  const [hanyaTerbaru, setHanyaTerbaru] = useState(true)
  const [pilihId, setPilihId] = useState<string | null>(null)
  const [skorDraft, setSkorDraft] = useState<Record<string, string>>({})
  const [busySoal, setBusySoal] = useState<string | null>(null)
  const [info, setInfo] = useState('')
  const [analisisAi, setAnalisisAi] = useState<HasilAnalisisKuisAi | null>(null)
  const [busyAi, setBusyAi] = useState(false)
  const [errorAi, setErrorAi] = useState('')
  const [analisisSiswaAi, setAnalisisSiswaAi] = useState<HasilAnalisisSiswaAi | null>(null)
  const [busySiswaAi, setBusySiswaAi] = useState(false)
  const [errorSiswaAi, setErrorSiswaAi] = useState('')
  const [terapanAi, setTerapanAi] = useState('')
  const [busySync, setBusySync] = useState(false)
  const [overwrite, setOverwrite] = useState(true)
  const [infoSync, setInfoSync] = useState('')

  const muat = useCallback(async () => {
    setError('')
    try {
      if (isTka) {
        const izin = kelasHasilTkaBolehDilihat(user, profil)
        if (izin.length === 0) {
          setList([])
          setRosterTka([])
          setError('Anda tidak punya akses melihat hasil TKA untuk rombel mana pun.')
          return
        }
        const [data, ...siswaBatches] = await Promise.all([
          daftarJawabanKuisMultiKelas(kuis.id, izin, kuis.mapel),
          ...izin.map((k) => muatSiswaKelas(k)),
        ])
        setList(data)
        setRosterTka(siswaBatches.flat().sort((a, b) => a.nama.localeCompare(b.nama, 'id')))
      } else {
        const data = await daftarJawabanKuis(kuis.id, kuis.kelas, kuis.mapel)
        setList(data)
        setRosterTka(null)
      }
    } catch (e) {
      setList([])
      if (isTka) setRosterTka([])
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        msg.includes('permission') || msg.includes('Permission')
          ? 'Tidak punya izin membaca hasil. Pastikan rules lms_jawaban sudah di-deploy dan Anda pengampu kelas×mapel ini.'
          : msg || 'Gagal memuat hasil.',
      )
    }
  }, [kuis.id, kuis.kelas, kuis.mapel, isTka, user, profil])

  useEffect(() => {
    void muat()
  }, [muat])

  useEffect(() => {
    setHasilDipublish(!!kuis.hasilDipublish)
  }, [kuis.id, kuis.hasilDipublish])

  async function togglePublishHasil() {
    if (!isTka) return
    const next = !hasilDipublish
    const msg = next
      ? 'Publikasikan skor ke siswa? Siswa yang sudah mengerjakan akan melihat nilai dan rinciannya.'
      : 'Sembunyikan skor dari siswa? Siswa hanya akan melihat status «jawaban terkirim» tanpa angka.'
    if (!confirm(msg)) return
    setBusyPublish(true)
    setError('')
    setInfo('')
    try {
      await updateKuis(kuis.id, { hasilDipublish: next })
      setHasilDipublish(next)
      setInfo(next ? 'Hasil dipublikasikan ke siswa.' : 'Hasil disembunyikan dari siswa.')
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status publikasi.')
    } finally {
      setBusyPublish(false)
    }
  }


  async function deteksiDomainAi(overwrite = false) {
    if (!isTka) return
    if (nSoalTanpaDomain === 0 && !overwrite) {
      const ok = confirm(
        'Semua soal sudah punya domain. Klasifikasi ulang dan timpa label yang ada?',
      )
      if (!ok) return
      overwrite = true
    } else if (nSoalTanpaDomain > 0) {
      const ok = confirm(
        `Deteksi domain AI untuk ${nSoalTanpaDomain} soal yang belum berlabel?\n\nHasil akan disimpan ke snapshot soal kuis ini (pengetahuan / keterampilan_proses).`,
      )
      if (!ok) return
    }
    setBusyDomainAi(true)
    setError('')
    setInfo('')
    try {
      const h = await klasifikasiDomainTkaDenganAi(kuis.id, { overwrite })
      if (!h.hasil.length) {
        setInfo('Tidak ada soal yang diklasifikasi.')
        return
      }
      const peta = new Map(h.hasil.map((x) => [x.soalId, x.domainTka]))
      const soalBaru = (kuis.soal ?? []).map((s) => {
        const d = peta.get(s.id)
        return d ? { ...s, domainTka: d } : s
      })
      await updateKuis(kuis.id, { soal: soalBaru })
      setInfo(
        `Domain disimpan: ${h.diklasifikasi} soal diklasifikasi` +
          (h.dilewati ? `, ${h.dilewati} dilewati (sudah berlabel)` : '') +
          '.',
      )
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal deteksi domain AI.')
    } finally {
      setBusyDomainAi(false)
    }
  }

  async function resetAttemptTka(siswaId: string, siswaNama: string) {
    if (!isTka || !siswaId) return
    const ok = confirm(
      `Reset attempt «${siswaNama || siswaId}»?\n\nSemua kiriman jawaban siswa ini pada kuis TKA ini akan dihapus. Siswa dapat mengerjakan ulang dari awal.\n\nTindakan ini tidak dapat dibatalkan.`,
    )
    if (!ok) return
    setBusyResetId(siswaId)
    setError('')
    setInfo('')
    try {
      const h = await resetJawabanKuisTka({ kuisId: kuis.id, siswaId })
      setInfo(
        h.dihapus > 0
          ? `Attempt direset (${h.dihapus} kiriman dihapus) — ${siswaNama || siswaId}.`
          : `Tidak ada kiriman untuk dihapus — ${siswaNama || siswaId}.`,
      )
      if (pilihId) setPilihId(null)
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mereset attempt.')
    } finally {
      setBusyResetId(null)
    }
  }

  useEffect(() => {
    if (!isTka) return
    if (filterKelasTka !== 'semua' && !kelasTkaIzin.includes(filterKelasTka)) {
      setFilterKelasTka('semua')
    }
  }, [isTka, kelasTkaIzin, filterKelasTka])

  const tampil = useMemo(() => {
    if (!list) return []
    // TKA: satu attempt — selalu ringkas per siswa (ANTIREGRESI §98)
    const ringkas = isTka || hanyaTerbaru
    return ringkas ? ringkasPerSiswa(list) : list
  }, [list, hanyaTerbaru, isTka])

  const barisTka = useMemo((): BarisHasilTka[] => {
    if (!isTka || rosterTka === null) return []
    const bySiswa = new Map<string, JawabanKuis>()
    for (const j of tampil) {
      const key = j.siswaId || j.siswaUid || ''
      if (!key) continue
      const prev = bySiswa.get(key)
      if (!prev || jawabanTsMs(j.createdAt) > jawabanTsMs(prev.createdAt) || j.percobaan > prev.percobaan) {
        bySiswa.set(key, j)
      }
    }
    let rows = rosterTka.map((s) => ({
      siswaId: s.id,
      siswaNama: s.nama,
      kelas: s.kelas,
      jawaban: bySiswa.get(s.id) ?? null,
    }))
    if (filterKelasTka !== 'semua') {
      rows = rows.filter((r) => r.kelas.toUpperCase() === filterKelasTka.toUpperCase())
    }
    return rows
  }, [isTka, rosterTka, tampil, filterKelasTka])

  const soalIds = useMemo(() => (kuis.soal ?? []).map((s) => s.id), [kuis.soal])

  /** TKA: selalu siapkan kedua domain (kolom tetap), meski belum ada soal berlabel. */
  const domainYangAda = useMemo(() => {
    if (!isTka) return [] as DomainTka[]
    // Selalu tampilkan kedua kolom domain + nilai akhir (ANTIREGRESI §98)
    return ['pengetahuan', 'keterampilan_proses'] as DomainTka[]
  }, [isTka])

  const nSoalTanpaDomain = useMemo(() => {
    if (!isTka) return 0
    return (kuis.soal ?? []).filter((s) => !normalisasiDomainTka(s.domainTka)).length
  }, [isTka, kuis.soal])

  const agregat = useMemo(() => {
    if (!list || list.length === 0) return {}
    const sumber = isTka
      ? barisTka.filter((b) => b.jawaban).map((b) => b.jawaban!)
      : tampil
    return agregatPerSoal(sumber, soalIds)
  }, [list, tampil, soalIds, isTka, barisTka])

  const ringkas = useMemo(() => {
    if (isTka) {
      const nRoster = barisTka.length
      const sudah = barisTka.filter((b) => b.jawaban)
      const n = sudah.length
      if (n === 0) return { n: 0, nRoster, rata: 0, perlu: 0, selesai: 0 }
      let sum = 0
      let perlu = 0
      for (const b of sudah) {
        const j = b.jawaban!
        sum += skorKe100(j.skorOtomatis, j.totalPoin)
        if (j.status === 'sebagian_manual' || (j.detail ?? []).some((d) => d.butuhManual)) perlu += 1
      }
      return {
        n,
        nRoster,
        rata: Math.round((sum / n) * 10) / 10,
        perlu,
        selesai: n - perlu,
      }
    }
    const n = tampil.length
    if (n === 0) return { n: 0, nRoster: 0, rata: 0, perlu: 0, selesai: 0 }
    let sum = 0
    let perlu = 0
    for (const j of tampil) {
      sum += skorKe100(j.skorOtomatis, j.totalPoin)
      if (j.status === 'sebagian_manual' || (j.detail ?? []).some((d) => d.butuhManual)) perlu += 1
    }
    return { n, nRoster: n, rata: Math.round((sum / n) * 10) / 10, perlu, selesai: n - perlu }
  }, [tampil, isTka, barisTka])

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

  const bisaSinkron = jenis === 'slm' || jenis === 'sts' || jenis === 'sas'

  async function sinkron() {
    setBusySync(true)
    setError('')
    setInfo('')
    setInfoSync('')
    try {
      const h = await sinkronNilaiKuisKePenilaian({
        kuisId: kuis.id,
        overwrite,
      })
      setInfoSync(
        `Sinkron OK → ${h.koleksi}: ${h.ditulis} nilai ditulis` +
          (h.dilewati ? `, ${h.dilewati} dilewati` : '') +
          ` · ${h.nSiswa} siswa · ${h.nTp} TP · sem ${h.semester} · ${h.tahunAjaran}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal sinkron ke Penilaian.')
    } finally {
      setBusySync(false)
    }
  }

  if (list === null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
        Memuat hasil pengerjaan…
      </div>
    )
  }

  if (terpilih) {
    const detailById = new Map((terpilih.detail ?? []).map((d) => [d.soalId, d]))
    const perluHeader =
      terpilih.status === 'sebagian_manual' ||
      (terpilih.detail ?? []).some((d) => d.butuhManual)

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muh-700 hover:text-muh-800"
            onClick={() => {
              setPilihId(null)
              setInfo('')
              setError('')
              setAnalisisSiswaAi(null)
              setErrorSiswaAi('')
              setTerapanAi('')
            }}
          >
            <span aria-hidden>←</span> Kembali ke daftar nilai
          </button>
          {isTka && terpilih.siswaId && (
            <button
              type="button"
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
              disabled={busyResetId === terpilih.siswaId}
              onClick={() =>
                void resetAttemptTka(terpilih.siswaId!, terpilih.siswaNama || terpilih.siswaId || '')
              }
            >
              {busyResetId === terpilih.siswaId ? 'Mereset…' : 'Reset attempt siswa ini'}
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-muh-50 to-white px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muh-600">
                  Detail pengerjaan
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                  {terpilih.siswaNama || terpilih.siswaId || 'Siswa'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">Percobaan #{terpilih.percobaan}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold tabular-nums text-muh-700">
                  {formatSkor100(terpilih.skorOtomatis, terpilih.totalPoin)}
                  <span className="text-base font-semibold text-slate-400"> / 100</span>
                </div>
                <p className="text-xs text-slate-500">
                  {terpilih.skorOtomatis} dari {terpilih.totalPoin} poin
                </p>
                <div className="mt-1.5 flex justify-end">
                  <BadgeStatus perluManual={perluHeader} status={terpilih.status} />
                </div>
              </div>
            </div>
          </div>

          
        {bolehDomainAi && (
          <div className="overflow-hidden rounded-2xl border border-muh-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-muh-50 bg-muh-50/40 px-4 py-3">
              <div>
                <h4 className="text-sm font-bold text-muh-900">Analisis AI siswa</h4>
                <p className="text-[11px] text-muh-700/80">
                  Nilai isian &amp; uraian (skor boleh 0,5) + catatan untuk guru &amp; orang tua
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {analisisSiswaAi && (
                  <button
                    type="button"
                    className="lms-btn-secondary text-xs"
                    onClick={() =>
                      unduhLaporanDoc({
                        namaFile: `analisis-${analisisSiswaAi.meta?.siswaNama || 'siswa'}`,
                        judul: 'Laporan penilaian siswa',
                        htmlBody: htmlLaporanSiswa(analisisSiswaAi),
                      })
                    }
                  >
                    Unduh .doc
                  </button>
                )}
                <button
                  type="button"
                  className="lms-btn-primary text-xs"
                  disabled={busySiswaAi}
                  onClick={() =>
                    void jalankanAnalisisSiswa(
                      kuis.id,
                      terpilih.id,
                      setBusySiswaAi,
                      setErrorSiswaAi,
                      setAnalisisSiswaAi,
                    )
                  }
                >
                  {busySiswaAi
                    ? 'Menganalisis…'
                    : analisisSiswaAi
                      ? 'Analisis ulang'
                      : 'Analisis AI'}
                </button>
              </div>
            </div>
            {errorSiswaAi && (
              <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
                {errorSiswaAi}
              </div>
            )}
            {terapanAi && (
              <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                {terapanAi}
              </div>
            )}
            {analisisSiswaAi && (
              <div className="space-y-3 p-4 text-sm">
                <p className="text-slate-800">{analisisSiswaAi.ringkasSiswa}</p>
                {analisisSiswaAi.catatanOrangTua ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Untuk orang tua: </span>
                    {analisisSiswaAi.catatanOrangTua}
                  </p>
                ) : null}
                {analisisSiswaAi.saranBelajar.length > 0 ? (
                  <ul className="list-disc pl-5 text-xs text-slate-600">
                    {analisisSiswaAi.saranBelajar.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">No</th>
                        <th className="px-3 py-2">Skor saran</th>
                        <th className="px-3 py-2">Alasan</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analisisSiswaAi.penilaian.map((p) => (
                        <tr key={p.soalId}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{p.no}</td>
                          <td className="px-3 py-2 tabular-nums font-bold text-muh-700">
                            {p.skor}
                            <span className="font-normal text-slate-400"> / {p.poinMaks}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{p.alasan}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 px-2 py-1 font-semibold text-muh-700 hover:bg-muh-50"
                              disabled={busySoal === p.soalId}
                              onClick={() => {
                                void (async () => {
                                  setBusySoal(p.soalId)
                                  setTerapanAi('')
                                  setErrorSiswaAi('')
                                  try {
                                    await simpanNilaiManual({
                                      jawabanId: terpilih.id,
                                      soalId: p.soalId,
                                      skor: p.skor,
                                    })
                                    setTerapanAi(`Skor soal ${p.no} diterapkan (${p.skor}).`)
                                    setSkorDraft((prev) => ({
                                      ...prev,
                                      [`${terpilih.id}:${p.soalId}`]: String(p.skor),
                                    }))
                                    await muat()
                                  } catch (e) {
                                    setErrorSiswaAi(
                                      e instanceof Error ? e.message : 'Gagal menerapkan skor.',
                                    )
                                  } finally {
                                    setBusySoal(null)
                                  }
                                })()
                              }}
                            >
                              Terapkan
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="lms-btn-primary text-xs"
                  disabled={busySiswaAi || analisisSiswaAi.penilaian.length === 0}
                  onClick={() => {
                    void (async () => {
                      setBusySiswaAi(true)
                      setTerapanAi('')
                      setErrorSiswaAi('')
                      try {
                        for (const p of analisisSiswaAi.penilaian) {
                          await simpanNilaiManual({
                            jawabanId: terpilih.id,
                            soalId: p.soalId,
                            skor: p.skor,
                          })
                        }
                        setTerapanAi(
                          `Semua skor AI diterapkan (${analisisSiswaAi.penilaian.length} butir).`,
                        )
                        await muat()
                      } catch (e) {
                        setErrorSiswaAi(
                          e instanceof Error ? e.message : 'Gagal menerapkan semua skor.',
                        )
                      } finally {
                        setBusySiswaAi(false)
                      }
                    })()
                  }}
                >
                  Terapkan semua skor AI
                </button>
              </div>
            )}
          </div>
        )}

{(error || info) && (
            <div className="space-y-2 border-b border-slate-100 px-5 py-3">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {info}
                </div>
              )}
            </div>
          )}

          <ol className="divide-y divide-slate-100">
            {(kuis.soal ?? []).map((s, i) => {
              const d = detailById.get(s.id)
              const jawab = terpilih.jawaban?.[s.id]
              const maks = Number(s.poin) || 1
              const perluNilai =
                s.tipe === 'uraian' || d?.butuhManual === true || s.tipe === 'isian'
              const key = `${terpilih.id}:${s.id}`
              const draft =
                skorDraft[key] ?? (d && typeof d.skor === 'number' ? String(d.skor) : '')
              const statusSoal = d?.butuhManual
                ? 'manual'
                : d?.benar
                  ? 'benar'
                  : d
                    ? 'skor'
                    : 'kosong'

              return (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        statusSoal === 'benar'
                          ? 'bg-emerald-100 text-emerald-800'
                          : statusSoal === 'manual'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="mr-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe}
                          </span>
                          <span className="text-sm font-medium text-slate-800">
                            {teksPolos(s.teks).slice(0, 180) || '(tanpa teks)'}
                          </span>
                        </div>
                        <div className="text-right text-xs font-semibold tabular-nums text-slate-700">
                          {d?.butuhManual ? (
                            <span className="text-amber-700">Perlu dinilai</span>
                          ) : (
                            <span>
                              {d?.skor ?? 0}
                              <span className="font-normal text-slate-400"> / {maks}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Jawaban siswa
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">
                          {teksJawaban(s, jawab)}
                        </p>
                      </div>

                      {(s.tipe === 'isian' ||
                        s.tipe === 'uraian' ||
                        s.tipe === 'pg' ||
                        s.tipe === 'pgk') && (
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">Kunci / pedoman: </span>
                          {teksKunci(s)}
                        </p>
                      )}

                      {perluNilai && (
                        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-muh-100 bg-muh-50/50 px-3 py-2.5">
                          <label className="text-xs font-medium text-slate-700">
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
                              className="mt-1 block w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-muh-500 focus:outline-none focus:ring-2 focus:ring-muh-200"
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
                          <span className="max-w-xs text-[11px] leading-snug text-slate-500">
                            {s.tipe === 'uraian'
                              ? 'Uraian tidak dinilai otomatis — isi sesuai pedoman.'
                              : 'Isian dinilai otomatis; Anda boleh mengoreksi skor.'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {isTka ? 'Laporan hasil TKA' : 'Hasil pengerjaan siswa'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {isTka
              ? 'Penilaian otomatis · tidak masuk rapor akademik · roster siswa selalu ditampilkan'
              : labelJenis +
                (jenis === 'latihan'
                  ? ' · tidak masuk rapor, tetap dapat dianalisis dan dinilai'
                  : ' · skor LMS; bisa disinkronkan ke Penilaian')}
          </p>
        </div>
        <button type="button" className="lms-btn-secondary text-xs" onClick={() => void muat()}>
          Muat ulang
        </button>
      </div>

      {isTka && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
            hasilDipublish
              ? 'border-emerald-200 bg-emerald-50/80'
              : 'border-amber-200 bg-amber-50/80'
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {hasilDipublish ? 'Hasil sudah dipublikasikan ke siswa' : 'Hasil belum dipublikasikan'}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {hasilDipublish
                ? 'Siswa yang sudah mengerjakan dapat melihat skor dan rincian (kompleksitas / materi / domain).'
                : 'Siswa hanya melihat status «jawaban terkirim». Skor disembunyikan sampai Anda mempublikasikan.'}
            </p>
          </div>
          <button
            type="button"
            className={hasilDipublish ? 'lms-btn-secondary text-xs' : 'lms-btn-primary text-xs'}
            disabled={busyPublish}
            onClick={() => void togglePublishHasil()}
          >
            {busyPublish
              ? 'Menyimpan…'
              : hasilDipublish
                ? 'Sembunyikan dari siswa'
                : 'Publikasikan hasil ke siswa'}
          </button>
        </div>
      )}

      {isTka && nSoalTanpaDomain > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950">
              {nSoalTanpaDomain} soal belum berdomain
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              Kolom Pengetahuan / Keterampilan Proses / Nilai Akhir membutuhkan label domain per
              soal. Deteksi otomatis memakai AI (akun khusus), atau isi manual di editor soal bank.
            </p>
          </div>
          {bolehDomainAi && (
            <button
              type="button"
              className="lms-btn-primary text-xs"
              disabled={busyDomainAi}
              onClick={() => void deteksiDomainAi(false)}
            >
              {busyDomainAi ? 'Mendeteksi…' : 'Deteksi domain AI'}
            </button>
          )}
        </div>
      )}

      {isTka && nSoalTanpaDomain === 0 && bolehDomainAi && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="lms-btn-secondary text-xs"
            disabled={busyDomainAi}
            onClick={() => void deteksiDomainAi(true)}
          >
            {busyDomainAi ? 'Mendeteksi…' : 'Klasifikasi ulang domain AI'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {isTka ? 'Mengerjakan' : 'Siswa'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {isTka ? (
              <>
                {ringkas.n}
                <span className="text-sm font-semibold text-slate-400"> / {ringkas.nRoster}</span>
              </>
            ) : (
              ringkas.n
            )}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rata-rata</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-muh-700">
            {ringkas.n ? ringkas.rata : '—'}
            {ringkas.n ? <span className="text-sm font-semibold text-slate-400"> / 100</span> : null}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selesai</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{ringkas.selesai}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Perlu dinilai</p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              ringkas.perlu > 0 ? 'text-amber-700' : 'text-slate-400'
            }`}
          >
            {ringkas.perlu}
          </p>
        </div>
      </div>

      {isTka && kelasTkaIzin.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-xs font-semibold text-slate-600">Filter kelas</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                filterKelasTka === 'semua'
                  ? 'bg-muh-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => setFilterKelasTka('semua')}
            >
              Semua ({kelasTkaIzin.join(' · ')})
            </button>
            {kelasTkaIzin.map((k) => (
              <button
                key={k}
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  filterKelasTka === k
                    ? 'bg-muh-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => setFilterKelasTka(k)}
              >
                {k}
              </button>
            ))}
          </div>
          {adminTka && (
            <span className="ml-auto text-[11px] text-slate-400">Admin TKA · rekap 6A &amp; 6B</span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      {infoSync && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {infoSync}
        </div>
      )}

      {bisaSinkron && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
            disabled={busySync || ringkas.n === 0}
            onClick={() => void sinkron()}
          >
            {busySync ? 'Menyinkron…' : 'Sinkronkan ke Penilaian'}
          </button>
        </div>
      )}
      {!bisaSinkron && !isTka && (
        <p className="text-xs text-slate-500">
          Kuis ini berjenis <strong>latihan</strong> — tidak masuk rapor. Ubah jenis di Atur kuis menjadi SLM/STS/SAS bila ingin sinkron.
        </p>
      )}
      {isTka && (
        <p className="text-xs text-slate-500">
          Kuis TKA dinilai otomatis dan <strong>tidak disinkronkan</strong> ke nilai rapor akademik (Penilaian).
        </p>
      )}

      {bolehAi && (
        <div className="overflow-hidden rounded-2xl border border-muh-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-muh-50 bg-muh-50/40 px-4 py-3">
            <div>
              <h4 className="text-sm font-bold text-muh-900">Analisis AI</h4>
              <p className="text-[11px] text-muh-700/80">
                Interpretasi hasil, butir bermasalah, dan saran tindak lanjut (khusus akun Anda)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {analisisAi && (
                <button
                  type="button"
                  className="lms-btn-secondary text-xs"
                  onClick={() =>
                    unduhLaporanDoc({
                      namaFile: `analisis-kuis-${kuis.judul || kuis.id}`,
                      judul: 'Analisis hasil kuis',
                      htmlBody: htmlLaporanKuis(analisisAi),
                    })
                  }
                >
                  Unduh .doc
                </button>
              )}
              <button
                type="button"
                className="lms-btn-primary text-xs"
                disabled={busyAi || list.length === 0}
                onClick={() => {
                  void (async () => {
                    setBusyAi(true)
                    setErrorAi('')
                    try {
                      const h = await analisisKuisDenganAi(kuis.id)
                      setAnalisisAi(h)
                    } catch (e) {
                      setErrorAi(e instanceof Error ? e.message : 'Gagal menganalisis.')
                    } finally {
                      setBusyAi(false)
                    }
                  })()
                }}
              >
                {busyAi ? 'Menganalisis…' : analisisAi ? 'Analisis ulang' : 'Jalankan analisis AI'}
              </button>
            </div>
          </div>
          {errorAi && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">{errorAi}</div>
          )}
          {analisisAi && (
            <div className="space-y-4 p-4 text-sm text-slate-700">
              <p className="leading-relaxed text-slate-800">{analisisAi.ringkas}</p>
              {analisisAi.meta && (
                <p className="text-xs text-slate-500">
                  Dasar: {analisisAi.meta.nSiswa} siswa · rata-rata {analisisAi.meta.rata100}/100 ·{' '}
                  {analisisAi.meta.nSoal} soal
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {analisisAi.kekuatan.length > 0 && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Kekuatan</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-950">
                      {analisisAi.kekuatan.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analisisAi.kelemahan.length > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Kelemahan</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-950">
                      {analisisAi.kelemahan.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {analisisAi.butirBermasalah.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Butir bermasalah</p>
                  <ul className="mt-2 space-y-2">
                    {analisisAi.butirBermasalah.map((b, i) => (
                      <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                        <span className="font-bold text-slate-800">Soal {b.no}.</span> {b.alasan}
                        {b.saran ? (
                          <span className="mt-0.5 block text-slate-600">Saran: {b.saran}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analisisAi.miskonsepsi.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Miskonsepsi</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                    {analisisAi.miskonsepsi.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analisisAi.tindakLanjutGuru.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tindak lanjut guru</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                    {analisisAi.tindakLanjutGuru.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analisisAi.perbaikanSoal.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Perbaikan soal</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                    {analisisAi.perbaikanSoal.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-slate-100/90 p-1">
          <TabPill active={mode === 'siswa'} onClick={() => setMode('siswa')}>
            Daftar nilai
          </TabPill>
          <TabPill active={mode === 'soal'} onClick={() => setMode('soal')}>
            Analisis per soal
          </TabPill>
        </div>
        {!isTka && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-muh-600 focus:ring-muh-500"
              checked={hanyaTerbaru}
              onChange={(e) => setHanyaTerbaru(e.target.checked)}
            />
            Hanya percobaan terbaru
          </label>
        )}
        <span className="text-xs text-slate-400">
          {isTka
            ? `${ringkas.n} mengerjakan · ${ringkas.nRoster} siswa roster`
            : `${list.length} kiriman · ${ringkasPerSiswa(list).length} siswa`}
        </span>
      </div>

      {list.length === 0 && !error && !(isTka && (rosterTka?.length ?? 0) > 0) && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Belum ada jawaban terkirim</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            {isTka
              ? 'Roster siswa akan tampil di bawah bila data kelas tersedia. Setelah siswa mengirim, nilai muncul otomatis.'
              : 'Setelah siswa menekan «Selesai & Kirim», nilai muncul di sini — termasuk untuk latihan.'}
          </p>
        </div>
      )}

      {mode === 'siswa' && isTka && barisTka.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Siswa</th>
                  <th className="px-3 py-3">Kelas</th>
                  <th className="px-3 py-3" title="Pengetahuan IPA">
                    Pengetahuan
                  </th>
                  <th className="px-3 py-3" title="Keterampilan Proses Sains">
                    Keterampilan Proses
                  </th>
                  <th className="px-3 py-3" title="Rata-rata kedua domain">
                    Nilai Akhir
                  </th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Waktu</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {barisTka.map((row) => {
                  const j = row.jawaban
                  if (!j) {
                    return (
                      <tr key={row.siswaId} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {(row.siswaNama || '?').trim().charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{row.siswaNama || '—'}</p>
                              <p className="text-[11px] text-slate-400">{row.siswaId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-slate-600">{row.kelas}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-300">—</td>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-300">—</td>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-300">—</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            Belum mengerjakan
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400">—</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-300">—</td>
                      </tr>
                    )
                  }
                  const perlu =
                    j.status === 'sebagian_manual' || (j.detail ?? []).some((d) => d.butuhManual)
                  const ts = jawabanTsMs(j.createdAt)
                  return (
                    <tr key={j.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muh-100 text-xs font-bold text-muh-700">
                            {(row.siswaNama || '?').trim().charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{row.siswaNama || j.siswaId || '—'}</p>
                            <p className="text-[11px] text-slate-400">{row.siswaId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-slate-600">{row.kelas || j.kelas}</td>
                      {(() => {
                        const dom = skorPerDomain(j, kuis.soal ?? [])
                        const p = pctDomain(dom.pengetahuan)
                        const k = pctDomain(dom.keterampilan_proses)
                        const akhir = nilaiAkhirTka(dom)
                        return (
                          <>
                            <td className="px-3 py-3 tabular-nums text-sm text-slate-700">
                              {formatPct(p)}
                              {p != null ? <span className="text-[10px] text-slate-400"> /100</span> : null}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-sm text-slate-700">
                              {formatPct(k)}
                              {k != null ? <span className="text-[10px] text-slate-400"> /100</span> : null}
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-base font-bold tabular-nums text-muh-700">
                                {formatPct(akhir)}
                              </span>
                              {akhir != null ? <span className="text-xs text-slate-400"> /100</span> : null}
                            </td>
                          </>
                        )
                      })()}
                      <td className="px-3 py-3">
                        <BadgeStatus perluManual={perlu} status={j.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {ts
                          ? new Date(ts).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-muh-700 hover:text-muh-900"
                            onClick={() => {
                              setPilihId(j.id)
                              setAnalisisSiswaAi(null)
                              setErrorSiswaAi('')
                              setTerapanAi('')
                            }}
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            disabled={busyResetId === row.siswaId}
                            onClick={() => void resetAttemptTka(row.siswaId, row.siswaNama)}
                          >
                            {busyResetId === row.siswaId ? 'Reset…' : 'Reset'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'siswa' && !isTka && tampil.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Siswa</th>
                  <th className="px-3 py-3">Perc.</th>
                  <th className="px-3 py-3">Nilai</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Waktu</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((j) => {
                  const perlu =
                    j.status === 'sebagian_manual' || (j.detail ?? []).some((d) => d.butuhManual)
                  const ts = jawabanTsMs(j.createdAt)
                  return (
                    <tr key={j.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muh-100 text-xs font-bold text-muh-700">
                            {(j.siswaNama || '?').trim().charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{j.siswaNama || j.siswaId || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">#{j.percobaan}</td>
                      <td className="px-3 py-3">
                        <span className="text-base font-bold tabular-nums text-muh-700">
                          {formatSkor100(j.skorOtomatis, j.totalPoin)}
                        </span>
                        <span className="text-xs text-slate-400"> /100</span>
                      </td>
                      <td className="px-3 py-3">
                        <BadgeStatus perluManual={perlu} status={j.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {ts
                          ? new Date(ts).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-muh-700 hover:text-muh-900"
                          onClick={() => {
                            setPilihId(j.id)
                            setAnalisisSiswaAi(null)
                            setErrorSiswaAi('')
                            setTerapanAi('')
                          }}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {mode === 'soal' && list.length > 0 && (
        <div className="space-y-2">
          {(kuis.soal ?? []).map((s, i) => {
            const a = agregat[s.id]
            const cuplikan = teksPolos(s.teks).slice(0, 140) || '(tanpa teks)'
            const total = a?.total ?? 0
            const pctBenar = total > 0 ? Math.round(((a?.benar ?? 0) / total) * 100) : 0
            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-800">
                      <span className="mr-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe}
                      </span>
                      {cuplikan}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pctBenar}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>
                        Benar <strong className="text-emerald-700">{a?.benar ?? 0}</strong>
                      </span>
                      <span>
                        Salah <strong className="text-red-700">{a?.salah ?? 0}</strong>
                      </span>
                      <span>
                        Kosong <strong>{a?.kosong ?? 0}</strong>
                      </span>
                      {(a?.manual ?? 0) > 0 && (
                        <span>
                          Perlu manual <strong className="text-amber-700">{a?.manual}</strong>
                        </span>
                      )}
                      <span className="text-slate-400">n={total}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

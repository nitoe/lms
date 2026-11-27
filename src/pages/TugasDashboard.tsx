import { alasanTugasDitutup } from '../lib/tugasTutup'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import KonfirmasiHapusDialog from '../components/KonfirmasiHapusDialog'
import { daftarRuangKelas } from '../lib/kelasLms'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import { daftarTugasGuru, hapusTugas, updateTugas } from '../lib/tugas'
import { hitungTerkumpulTugasCache, terkumpulDiCache } from '../lib/terkumpulTugas'
import {
  BATAS_HARI_SEGERA,
  infoTenggat,
  LABEL_PENILAIAN_SINGKAT,
  penilaianTugas,
  tenggatKeDate,
} from '../lib/tugasUi'
import type { StatusTugas, TugasLms } from '../types/tugas'
import {
  LABEL_STATUS_TUGAS,
  NAMA_JENIS_PENILAIAN_TUGAS,
  normalisasiStatusTugas,
  semuaMapelTugas,
} from '../types/tugas'
import '../styles/tugas.css'

type FilterJenis = 'semua' | 'mapel' | 'proyek'
type FilterStatus = 'semua' | 'draf' | 'aktif_guru' | 'aktif_siswa' | 'segera' | 'selesai' | 'arsip'
type Urut = 'terbaru' | 'tenggat' | 'judul' | 'kumpul'

function IkonCari() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IkonPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IkonJam() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IkonTugas() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H16" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

function IkonTitik() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

/** Ubin ringkasan yang sekaligus menjadi pintasan saringan (klik lagi = kembali ke «Semua»). */
function Ubin({
  kelas,
  angka,
  label,
  title,
  aktif,
  onKlik,
}: {
  kelas?: string
  angka: number
  label: string
  title?: string
  aktif: boolean
  onKlik: () => void
}) {
  return (
    <button
      type="button"
      className={`tg-ringkas-item tg-ringkas-item--tombol${kelas ? ` ${kelas}` : ''}${aktif ? ' tg-ringkas-item--on' : ''}`}
      title={title}
      aria-pressed={aktif}
      onClick={onKlik}
    >
      <b>{angka}</b>
      <span>{label}</span>
    </button>
  )
}

/** Kelompok tombol pilihan (filter) dengan hitungan. */
function Segmen<T extends string>({
  label,
  nilai,
  opsi,
  onPilih,
}: {
  label: string
  nilai: T
  opsi: { v: T; teks: string; n?: number }[]
  onPilih: (v: T) => void
}) {
  return (
    <div className="tg-grup" role="group" aria-label={label}>
      <span className="tg-grup-label">{label}</span>
      {opsi.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`tg-seg${nilai === o.v ? ' tg-seg--on' : ''}${o.n === undefined ? ' tg-seg--sepi' : ''}`}
          aria-pressed={nilai === o.v}
          onClick={() => onPilih(o.v)}
        >
          {o.teks}
          {o.n !== undefined && <i>{o.n}</i>}
        </button>
      ))}
    </div>
  )
}

export default function TugasDashboard() {
  const { profil } = useAuth()
  const [list, setList] = useState<TugasLms[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filterJenis, setFilterJenis] = useState<FilterJenis>('semua')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('semua')
  const [filterKelas, setFilterKelas] = useState('semua')
  const [urut, setUrut] = useState<Urut>('terbaru')
  const [q, setQ] = useState('')
  /** Id kartu yang baris «Lainnya»-nya terbuka (aksi sekunder: selesai, arsip, hapus). */
  const [lainId, setLainId] = useState<string | null>(null)
  /** Tugas yang menunggu konfirmasi hapus (dialog ketik HAPUS). */
  const [hapusTarget, setHapusTarget] = useState<TugasLms | null>(null)
  /** Umpan balik singkat setelah aksi berhasil (hilang sendiri). */
  const [info, setInfo] = useState('')
  const infoTimer = useRef<number | undefined>(undefined)
  /**
   * Jumlah SISWA yang sudah mengumpulkan per tugas (angka «Terkumpul»). undefined = sedang dihitung,
   * null = gagal dihitung. Field `jumlahPengumpulan` di dokumen tugas tidak pernah dinaikkan → tak dipakai.
   * ANTIREGRESI §Tugas.Terkumpul.
   */
  const [terkumpul, setTerkumpul] = useState<Record<string, number | null>>({})

  const ruang = useMemo(() => daftarRuangKelas(profil), [profil])

  const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'

  const muat = useCallback(async () => {
    setError('')
    try {
      const data = await daftarTugasGuru(ruang, { sebagaiAdmin })
      setList(data)
      if (data.length === 0 && ruang.length === 0 && !sebagaiAdmin) {
        setError(
          'Profil Anda belum punya penugasan kelas×mapel. Atur penugasan di aplikasi Penilaian, atau pastikan tugas lama masih tercatat dengan dibuatOleh akun ini.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar tugas.')
      setList([])
    }
  }, [ruang, sebagaiAdmin])

  useEffect(() => {
    void muat()
  }, [muat])

  useEffect(() => () => window.clearTimeout(infoTimer.current), [])

  // Hitung siswa yang sudah mengumpulkan untuk tugas non-draf
  // (aktif_siswa, aktif_guru, selesai, arsip). Field jumlahPengumpulan selalu 0 → jangan dipakai.
  // 3 paralel, cache 90 dtk. ANTIREGRESI §Tugas.Terkumpul.
  useEffect(() => {
    if (!list) return
    const target = list.filter((t) => {
      const st = normalisasiStatusTugas(t.statusTugas, t.aktif)
      // Draf murni belum punya pengumpulan; sisanya (termasuk arsip) dihitung agar angka historis tetap tampil.
      if (st === 'draf' && !t.selesai && !t.arsip) return false
      return true
    })
    const awal: Record<string, number | null> = {}
    for (const t of target) {
      const c = terkumpulDiCache(t.id)
      if (c !== undefined) awal[t.id] = c
    }
    if (Object.keys(awal).length) setTerkumpul((p) => ({ ...p, ...awal }))
    let batal = false
    let i = 0
    const pekerja = async () => {
      while (!batal) {
        const t = target[i++]
        if (!t) return
        try {
          const n = await hitungTerkumpulTugasCache(t)
          if (!batal) setTerkumpul((p) => ({ ...p, [t.id]: n }))
        } catch (e) {
          console.warn('Dashboard: hitung terkumpul gagal', t.id, e)
          if (!batal) setTerkumpul((p) => ({ ...p, [t.id]: null }))
        }
      }
    }
    void Promise.all([pekerja(), pekerja(), pekerja()])
    return () => {
      batal = true
    }
  }, [list])

  /** Angka «Terkumpul» sebuah tugas: number | undefined (menghitung) | null (gagal).
   * Dihitung untuk aktif_siswa, aktif_guru, selesai, dan arsip.
   * Hanya draf murni yang fallback ke jumlahPengumpulan (selalu 0). */
  const jumlahTerkumpul = (t: TugasLms): number | null | undefined => {
    const st = normalisasiStatusTugas(t.statusTugas, t.aktif)
    if (st === 'draf' && !t.selesai && !t.arsip) return t.jumlahPengumpulan ?? 0
    return terkumpul[t.id]
  }

  function tampilInfo(pesan: string) {
    setInfo(pesan)
    window.clearTimeout(infoTimer.current)
    infoTimer.current = window.setTimeout(() => setInfo(''), 4500)
  }

  /** Acuan «sekarang» dihitung ulang tiap daftar dimuat (cukup untuk label relatif). */
  const sekarang = useMemo(() => new Date(), [list])

  const kelasTersedia = useMemo(() => {
    if (!list) return []
    return [...new Set(list.map((t) => t.kelas).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true }),
    )
  }, [list])

  /** Tugas aktif dengan tenggat hari ini sampai {BATAS_HARI_SEGERA} hari lagi. */
  const adaTenggatSegera = useCallback(
    (t: TugasLms) => {
      if (!t.aktif) return false
      const n = infoTenggat(t.tenggat, sekarang).nada
      return n === 'hariini' || n === 'segera'
    },
    [sekarang],
  )

  const hitung = useMemo(() => {
    const l = list ?? []
    const statusOf = (x: TugasLms) => normalisasiStatusTugas(x.statusTugas, x.aktif)
    return {
      semua: l.filter((t) => !t.arsip).length,
      mapel: l.filter((t) => !t.arsip && t.jenis === 'mapel').length,
      proyek: l.filter((t) => !t.arsip && t.jenis === 'proyek').length,
      draf: l.filter((t) => !t.arsip && statusOf(t) === 'draf').length,
      aktif_guru: l.filter((t) => !t.arsip && statusOf(t) === 'aktif_guru').length,
      aktif_siswa: l.filter((t) => !t.arsip && statusOf(t) === 'aktif_siswa').length,
      segera: l.filter((t) => !t.arsip && adaTenggatSegera(t)).length,
      selesai: l.filter((t) => !t.arsip && t.selesai).length,
      arsip: l.filter((t) => t.arsip).length,
    }
  }, [list, adaTenggatSegera])

  const ringkas = useMemo(() => {
    let kumpul = 0
    let menghitung = false
    for (const t of list ?? []) {
      if (t.arsip) continue
      const j = jumlahTerkumpul(t)
      if (j === undefined) menghitung = true
      else kumpul += j ?? 0
    }
    return { kumpul, menghitung }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, terkumpul])

  const filtered = useMemo(() => {
    if (!list) return []
    let rows = list
    if (filterJenis !== 'semua') rows = rows.filter((t) => t.jenis === filterJenis)
    // Status: default «semua» = non-arsip. Filter khusus untuk arsip / selesai / aktif / draf.
    if (filterStatus === 'semua') rows = rows.filter((t) => !t.arsip)
    else if (filterStatus === 'draf')
      rows = rows.filter((t) => !t.arsip && normalisasiStatusTugas(t.statusTugas, t.aktif) === 'draf')
    else if (filterStatus === 'aktif_guru')
      rows = rows.filter(
        (t) => !t.arsip && normalisasiStatusTugas(t.statusTugas, t.aktif) === 'aktif_guru',
      )
    else if (filterStatus === 'aktif_siswa')
      rows = rows.filter(
        (t) => !t.arsip && normalisasiStatusTugas(t.statusTugas, t.aktif) === 'aktif_siswa',
      )
    else if (filterStatus === 'segera') rows = rows.filter((t) => !t.arsip && adaTenggatSegera(t))
    else if (filterStatus === 'selesai') rows = rows.filter((t) => t.selesai && !t.arsip)
    else if (filterStatus === 'arsip') rows = rows.filter((t) => t.arsip)
    if (filterKelas !== 'semua') rows = rows.filter((t) => t.kelas === filterKelas)
    const s = q.trim().toLowerCase()
    if (s) {
      rows = rows.filter(
        (t) =>
          t.judul.toLowerCase().includes(s) ||
          t.mapel.toLowerCase().includes(s) ||
          t.kelas.toLowerCase().includes(s) ||
          (t.deskripsi && t.deskripsi.toLowerCase().includes(s)),
      )
    }
    if (urut === 'terbaru') return rows // urutan asal = terbaru diperbarui (daftarTugasGuru)
    const sorted = [...rows]
    if (urut === 'judul') sorted.sort((a, b) => a.judul.localeCompare(b.judul, 'id'))
    else if (urut === 'kumpul') {
      sorted.sort((a, b) => (jumlahTerkumpul(b) ?? 0) - (jumlahTerkumpul(a) ?? 0))
    } else {
      // Tenggat: yang akan datang (terdekat dulu) → tanpa tenggat → yang sudah lewat (terbaru dulu)
      const now = sekarang.getTime()
      const ms = (t: TugasLms) => tenggatKeDate(t.tenggat)?.getTime() ?? null
      const grup = (v: number | null) => (v === null ? 1 : v >= now ? 0 : 2)
      sorted.sort((a, b) => {
        const ma = ms(a)
        const mb = ms(b)
        const ga = grup(ma)
        const gb = grup(mb)
        if (ga !== gb) return ga - gb
        if (ma === null || mb === null) return 0
        return ga === 2 ? mb - ma : ma - mb
      })
    }
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, filterJenis, filterStatus, filterKelas, q, urut, sekarang, adaTenggatSegera, terkumpul])

  const adaFilter =
    filterJenis !== 'semua' || filterStatus !== 'semua' || filterKelas !== 'semua' || q.trim() !== ''

  function resetFilter() {
    setFilterJenis('semua')
    setFilterStatus('semua')
    setFilterKelas('semua')
    setQ('')
  }

  async function onSetStatus(t: TugasLms, status: StatusTugas) {
    setBusyId(t.id)
    setError('')
    try {
      await updateTugas(t.id, { statusTugas: status })
      await muat()
      tampilInfo(`«${t.judul}» sekarang berstatus ${LABEL_STATUS_TUGAS[status]}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  async function onHapus(t: TugasLms) {
    setBusyId(t.id)
    setError('')
    try {
      await hapusTugas(t.id)
      setHapusTarget(null)
      setLainId(null)
      await muat()
      tampilInfo(`Tugas «${t.judul}» dihapus.`)
    } catch (e) {
      setHapusTarget(null)
      setError(e instanceof Error ? e.message : 'Gagal menghapus.')
    } finally {
      setBusyId(null)
    }
  }

  async function onToggleSelesai(t: TugasLms) {
    if (
      !t.selesai &&
      !confirm(
        `Tandai «${t.judul}» selesai? Penugasan akan DITUTUP untuk siswa: mereka tidak bisa lagi membuka atau mengirim tugas ini. Tugas tetap tampil di daftar siswa (dengan keterangan ditutup) sampai kamu mengarsipkannya.`,
      )
    )
      return
    setBusyId(t.id)
    setError('')
    try {
      await updateTugas(t.id, { selesai: !t.selesai })
      await muat()
      tampilInfo(
        t.selesai
          ? `Tanda selesai «${t.judul}» dibatalkan. Tugas dibuka kembali untuk siswa.`
          : `«${t.judul}» ditandai selesai dan ditutup untuk siswa.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah tanda selesai.')
    } finally {
      setBusyId(null)
    }
  }

  /** Arsipkan: sembunyikan dari daftar utama + nonaktifkan untuk siswa. */
  async function onArsipkan(t: TugasLms) {
    if (
      !confirm(
        `Arsipkan «${t.judul}»? Tugas disembunyikan dari daftar utama dan dinonaktifkan untuk siswa. Data nilai tetap aman.`,
      )
    )
      return
    setBusyId(t.id)
    setError('')
    try {
      // Arsip: sembunyikan dari siswa; status penilaian tetap (bisa aktif_guru) agar jelas jenisnya.
      const st = normalisasiStatusTugas(t.statusTugas, t.aktif)
      await updateTugas(t.id, {
        arsip: true,
        statusTugas: st === 'aktif_siswa' ? 'aktif_guru' : st,
      })
      setLainId(null)
      await muat()
      tampilInfo(`«${t.judul}» diarsipkan. Keluarkan lagi lewat saringan Arsip.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengarsipkan.')
    } finally {
      setBusyId(null)
    }
  }

  async function onKeluarkanArsip(t: TugasLms) {
    setBusyId(t.id)
    setError('')
    try {
      // Tidak otomatis aktifkan — guru memilih sendiri kapan dibuka ke siswa.
      await updateTugas(t.id, { arsip: false })
      setLainId(null)
      await muat()
      tampilInfo(`«${t.judul}» dikeluarkan dari arsip (status tidak berubah).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengeluarkan dari arsip.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="tg-halaman">
      <header className="tg-kepala">
        <div className="tg-kepala-teks">
          <h2 className="tg-judul-halaman">Tugas</h2>
          <p className="tg-sub">
            Katalog tugas mapel dan proyek. Tandai selesai untuk menutup penugasan (siswa masih melihat keterangan ditutup), arsipkan agar hilang dari menu siswa.
          </p>
        </div>
        <Link to="/tugas/baru" className="tg-btn tg-btn--utama tg-btn--besar">
          <IkonPlus />
          Tugas baru
        </Link>
      </header>

      {list !== null && list.length > 0 && (
        <section className="tg-ringkas" aria-label="Ringkasan tugas (klik untuk menyaring)">
          <Ubin
            angka={hitung.semua}
            label="Total tugas"
            aktif={filterStatus === 'semua'}
            onKlik={() => setFilterStatus('semua')}
          />
          <Ubin
            kelas="tg-ringkas-item--hijau"
            angka={hitung.aktif_guru}
            label="Aktif guru"
            title="Siap dinilai guru; siswa tidak melihat (tugas offline / input langsung)"
            aktif={filterStatus === 'aktif_guru'}
            onKlik={() => setFilterStatus(filterStatus === 'aktif_guru' ? 'semua' : 'aktif_guru')}
          />
          <Ubin
            kelas="tg-ringkas-item--biru"
            angka={hitung.aktif_siswa}
            label="Aktif siswa"
            title="Tampil ke siswa dan bisa dikumpulkan di LMS"
            aktif={filterStatus === 'aktif_siswa'}
            onKlik={() => setFilterStatus(filterStatus === 'aktif_siswa' ? 'semua' : 'aktif_siswa')}
          />
          <Ubin
            kelas="tg-ringkas-item--kuning"
            angka={hitung.segera}
            label="Segera berakhir"
            title={`Tugas aktif dengan tenggat hari ini sampai ${BATAS_HARI_SEGERA} hari lagi`}
            aktif={filterStatus === 'segera'}
            onKlik={() => setFilterStatus(filterStatus === 'segera' ? 'semua' : 'segera')}
          />
          <div
            className="tg-ringkas-item tg-ringkas-item--teal"
            title="Jumlah siswa yang sudah mengumpulkan (anggota kelompok ikut dihitung)"
          >
            <b>{ringkas.menghitung ? '…' : ringkas.kumpul}</b>
            <span>Siswa mengumpulkan</span>
          </div>
          <Ubin
            kelas="tg-ringkas-item--ungu"
            angka={hitung.selesai}
            label="Selesai"
            title="Tugas yang sudah ditandai selesai penilaian"
            aktif={filterStatus === 'selesai'}
            onKlik={() => setFilterStatus(filterStatus === 'selesai' ? 'semua' : 'selesai')}
          />
          <Ubin
            kelas="tg-ringkas-item--abu"
            angka={hitung.arsip}
            label="Arsip"
            title="Tugas diarsipkan (disembunyikan dari daftar utama)"
            aktif={filterStatus === 'arsip'}
            onKlik={() => setFilterStatus(filterStatus === 'arsip' ? 'semua' : 'arsip')}
          />
        </section>
      )}

      {list !== null && list.length > 0 && (
        <section className="tg-alat" aria-label="Cari dan saring tugas">
          <div className="tg-alat-baris">
            <div className="tg-cari">
              <IkonCari />
              <input
                type="search"
                placeholder="Cari judul, mapel, kelas, atau deskripsi…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Cari tugas"
              />
            </div>
            <label className="tg-sr" htmlFor="tg-urut">
              Urutkan
            </label>
            <select
              id="tg-urut"
              className="tg-urut"
              value={urut}
              onChange={(e) => setUrut(e.target.value as Urut)}
            >
              <option value="terbaru">Terbaru diperbarui</option>
              <option value="tenggat">Tenggat terdekat</option>
              <option value="kumpul">Pengumpulan terbanyak</option>
              <option value="judul">Judul A–Z</option>
            </select>
            <span className="tg-jumlah" aria-live="polite">
              {filtered.length} tugas
            </span>
          </div>
          <div className="tg-filter">
            <Segmen<FilterStatus>
              label="Status"
              nilai={filterStatus}
              onPilih={setFilterStatus}
              opsi={[
                { v: 'semua', teks: 'Semua', n: hitung.semua },
                { v: 'draf', teks: 'Draf', n: hitung.draf },
                { v: 'aktif_guru', teks: 'Aktif guru', n: hitung.aktif_guru },
                { v: 'aktif_siswa', teks: 'Aktif siswa', n: hitung.aktif_siswa },
                { v: 'segera', teks: 'Segera berakhir', n: hitung.segera },
                { v: 'selesai', teks: 'Selesai', n: hitung.selesai },
                { v: 'arsip', teks: 'Arsip', n: hitung.arsip },
              ]}
            />
            <Segmen<FilterJenis>
              label="Jenis"
              nilai={filterJenis}
              onPilih={setFilterJenis}
              opsi={[
                { v: 'semua', teks: 'Semua', n: hitung.semua },
                { v: 'mapel', teks: 'Mapel', n: hitung.mapel },
                { v: 'proyek', teks: 'Proyek', n: hitung.proyek },
              ]}
            />
            {kelasTersedia.length > 1 && (
              <Segmen<string>
                label="Kelas"
                nilai={filterKelas}
                onPilih={setFilterKelas}
                opsi={[
                  { v: 'semua', teks: 'Semua' },
                  ...kelasTersedia.map((k) => ({ v: k, teks: k })),
                ]}
              />
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="tg-galat" role="alert">
          {error}
        </div>
      )}
      {info && (
        <div className="td-sukses tg-info" role="status">
          {info}
        </div>
      )}

      {list === null && (
        <div className="tg-grid" aria-busy="true" aria-label="Memuat katalog tugas">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="tg-skel" />
          ))}
        </div>
      )}

      {list && list.length === 0 && (
        <div className="tg-kosong">
          <span className="tg-kosong-ikon">
            <IkonTugas />
          </span>
          <b>Belum ada tugas</b>
          <p>Buat tugas pertama untuk mulai memberikan pekerjaan kepada siswa.</p>
          <Link to="/tugas/baru" className="tg-btn tg-btn--utama tg-btn--besar">
            <IkonPlus />
            Tugas baru
          </Link>
        </div>
      )}

      {list && list.length > 0 && filtered.length === 0 && (
        <div className="tg-kosong">
          <b>Tidak ada tugas yang cocok</b>
          <p>Ubah kata kunci atau saringan yang sedang dipakai.</p>
          {adaFilter && (
            <button type="button" className="tg-btn" onClick={resetFilter}>
              Reset saringan
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="tg-grid">
          {filtered.map((t) => {
            const mapels = semuaMapelTugas(t)
            const aksen = aksenMapel(t.mapel)
            const info = infoTenggat(t.tenggat, sekarang)
            // Tugas draf tidak diberi nada alarm — belum terlihat siswa.
            const nada = t.aktif ? info.nada : info.nada === 'tanpa' ? 'tanpa' : 'netral'
            const jp = penilaianTugas(t)
            const tp = t.tpList ?? []
            const jmlKumpul = jumlahTerkumpul(t)
            const kumpul = typeof jmlKumpul === 'number' ? jmlKumpul : 0
            const sibuk = busyId === t.id
            const gaya = { '--tg-a': aksen.bar } as CSSProperties
            return (
              <li key={t.id}>
                <article
                  className={`tg-kartu${(() => { const st = normalisasiStatusTugas(t.statusTugas, t.aktif); if (t.arsip) return ' tg-kartu--arsip'; if (st === 'draf') return ' tg-kartu--draf'; if (st === 'aktif_guru') return ' tg-kartu--aktif-guru'; return '' })()}${(t.selesai || alasanTugasDitutup(t, sekarang.getTime()) === 'tenggat') && !t.arsip ? ' tg-kartu--selesai' : ''}${sibuk ? ' tg-kartu--sibuk' : ''}`}
                  style={gaya}
                  aria-busy={sibuk}
                >
                  <div className="tg-utama">
                    <div className="tg-atas">
                      <span className="tg-mono" aria-hidden="true">
                        {inisialMapel(t.mapel)}
                      </span>
                      <div className="tg-tag">
                        <span className="tg-mapel" title={mapels.join(', ')}>
                          {mapels[0] ?? t.mapel}
                          {mapels.length > 1 ? ` +${mapels.length - 1}` : ''}
                        </span>
                        <span className="tg-kelas">Kelas {t.kelas}</span>
                      </div>
                      {(() => {
                        const st = normalisasiStatusTugas(t.statusTugas, t.aktif)
                        const key = t.arsip ? 'arsip' : st
                        const label = t.arsip
                          ? 'Arsip'
                          : LABEL_STATUS_TUGAS[st]
                        const title = t.arsip
                          ? 'Tugas diarsipkan'
                          : st === 'aktif_siswa'
                            ? 'Tampil ke siswa + pengumpulan LMS'
                            : st === 'aktif_guru'
                              ? 'Siap dinilai guru; siswa tidak melihat'
                              : 'Masih draf — belum bisa diisi nilai'
                        return (
                          <span className={`tg-status tg-status--${key}`} title={title}>
                            {label}
                          </span>
                        )
                      })()}
                      {t.selesai && !t.arsip && (
                        <span className="tg-status tg-status--selesai" title="Penilaian ditandai selesai">
                          Selesai
                        </span>
                      )}
                    </div>

                    <h3 className="tg-judul">
                      <Link to={`/tugas/${t.id}`}>{t.judul}</Link>
                    </h3>
                    {t.deskripsi && <p className="tg-desk">{t.deskripsi}</p>}

                    <div className="tg-chips">
                      {t.jenis === 'proyek' && <span className="tg-chip tg-chip--proyek">Proyek</span>}
                      <span
                        className={`tg-chip tg-chip--${jp}`}
                        title={NAMA_JENIS_PENILAIAN_TUGAS[jp]}
                      >
                        {LABEL_PENILAIAN_SINGKAT[jp]}
                      </span>
                      {tp.length > 0 && (
                        <span
                          className="tg-chip tg-chip--tp"
                          title={tp.map((x) => `TP ${x.nomor}: ${x.nama}`).join('\n')}
                        >
                          {tp.length === 1 ? `TP ${tp[0].nomor}` : `${tp.length} TP`}
                        </span>
                      )}
                    </div>

                    <div className="tg-panel">
                      <div className={`tg-tenggat tg-tenggat--${nada}`}>
                        <span className="tg-tenggat-label">
                          <IkonJam />
                          Tenggat
                        </span>
                        <b>{info.label}</b>
                        {info.tanggal && <small>{info.tanggal}</small>}
                        {!t.selesai && alasanTugasDitutup(t, sekarang.getTime()) === 'tenggat' && (
                          <small>Ditutup otomatis untuk siswa</small>
                        )}
                      </div>
                      <Link
                        to={`/tugas/${t.id}?tab=kumpul`}
                        className={`tg-kumpul${kumpul === 0 ? ' tg-kumpul--nol' : ''}`}
                        title="Siswa yang sudah mengumpulkan (anggota kelompok ikut dihitung) — klik untuk melihat"
                      >
                        <b>{jmlKumpul === undefined ? '…' : jmlKumpul === null ? '—' : jmlKumpul}</b>
                        <span>Terkumpul</span>
                      </Link>
                    </div>
                  </div>

                  <div className="tg-kaki">
                    <Link to={`/tugas/${t.id}`} className="tg-btn tg-btn--utama">
                      Buka
                    </Link>
                    {!t.arsip && normalisasiStatusTugas(t.statusTugas, t.aktif) !== 'draf' && (
                      <Link to={`/tugas/${t.id}?tab=nilai`} className="tg-btn" title="Langsung ke input nilai">
                        Nilai
                      </Link>
                    )}
                    {!t.arsip && (
                      <label className="tg-status-pilih" title="Ubah status publikasi tugas">
                        <span className="tg-sr">Status</span>
                        <select
                          className="tg-select-status"
                          disabled={busyId !== null}
                          value={normalisasiStatusTugas(t.statusTugas, t.aktif)}
                          onChange={(e) => void onSetStatus(t, e.target.value as StatusTugas)}
                        >
                          <option value="draf">{LABEL_STATUS_TUGAS.draf}</option>
                          <option value="aktif_guru">{LABEL_STATUS_TUGAS.aktif_guru}</option>
                          <option value="aktif_siswa">{LABEL_STATUS_TUGAS.aktif_siswa}</option>
                        </select>
                      </label>
                    )}
                    <span className="tg-kaki-spasi" />
                    <button
                      type="button"
                      className={`tg-btn tg-btn--ikon${lainId === t.id ? ' tg-btn--on' : ''}`}
                      aria-expanded={lainId === t.id}
                      aria-controls={`tg-lain-${t.id}`}
                      onClick={() => setLainId(lainId === t.id ? null : t.id)}
                    >
                      <IkonTitik />
                      Lainnya
                    </button>
                  </div>
                  {lainId === t.id && (
                    <div className="tg-lain" id={`tg-lain-${t.id}`}>
                      {!t.arsip && (
                        <button
                          type="button"
                          className={`tg-btn${t.selesai ? ' tg-btn--selesai' : ''}`}
                          disabled={busyId !== null}
                          onClick={() => void onToggleSelesai(t)}
                          title={t.selesai ? 'Batalkan tanda selesai (buka kembali untuk siswa)' : 'Tandai selesai dan tutup penugasan untuk siswa'}
                        >
                          {t.selesai ? 'Batal selesai' : 'Tandai selesai'}
                        </button>
                      )}
                      {t.arsip ? (
                        <button
                          type="button"
                          className="tg-btn"
                          disabled={busyId !== null}
                          onClick={() => void onKeluarkanArsip(t)}
                          title="Kembalikan ke daftar utama (status tidak berubah)"
                        >
                          Keluarkan arsip
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tg-btn"
                          disabled={busyId !== null}
                          onClick={() => void onArsipkan(t)}
                          title="Sembunyikan tugas yang sudah tidak dipakai"
                        >
                          Arsipkan
                        </button>
                      )}
                      <span className="tg-kaki-spasi" />
                      <button
                        type="button"
                        className="tg-btn tg-btn--bahaya"
                        disabled={busyId !== null}
                        onClick={() => setHapusTarget(t)}
                      >
                        Hapus…
                      </button>
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {hapusTarget && (
        <KonfirmasiHapusDialog
          judul="Hapus tugas?"
          nama={hapusTarget.judul}
          rincian={[
            'Tugas hilang dari daftar guru dan dari tampilan siswa.',
            'Data pengumpulan dan nilai yang sudah tersimpan tidak ikut terhapus, tetapi tidak bisa dibuka lagi dari tugas ini.',
          ]}
          saran="Hanya ingin merapikan daftar? Pakai «Arsipkan» — tugas disembunyikan dan data nilai tetap aman."
          busy={busyId === hapusTarget.id}
          onBatal={() => setHapusTarget(null)}
          onKonfirmasi={() => void onHapus(hapusTarget)}
        />
      )}
    </div>
  )
}

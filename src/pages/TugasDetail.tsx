import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cakupanTugas } from '../lib/cakupanTugas'
import {
  ambilTugas,
  aturBerbagiTugas,
  buatTugas,
  hapusBerkasLampiranTugas,
  unggahLampiranTugas,
  updateTugas,
} from '../lib/tugas'
import BerbagiKelasDialog from '../components/BerbagiKelasDialog'
import PengumpulanPanel from '../components/PengumpulanPanel'
import UsulanNilaiAiDialog from '../components/UsulanNilaiAiDialog'
import { usulkanNilaiTugasAi, type UsulanNilaiAi } from '../lib/nilaiTugasAi'
import { daftarPengumpulanTugas, type PengumpulanDok } from '../lib/pengumpulan'
import { daftarKelompokTugas, type TugasKelompokDok } from '../lib/tugasKelompok'
import BuktiTugasEditor from '../components/BuktiTugasEditor'
import { rapikanBuktiList } from '../lib/buktiTugas'
import { htmlInstruksiSiswa } from '../lib/instruksiTugas'
import { labelKelasDibagikan } from '../lib/kelasLms'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import {
  infoTenggat,
  LABEL_PENILAIAN_SINGKAT,
  penilaianTugas,
} from '../lib/tugasUi'
import {
  hitungRataRata,
  muatBarisNilaiTugas,
  predikatOtomatis,
  simpanNilaiTugas,
  type BarisNilaiTugas,
} from '../lib/nilaiTugas'
import '../styles/tugas.css'
import {
  bolehAiTugas,
  generateSkorPerKategoriDariPredikat,
  normalisasiPengaturan,
  pengaturanPenilaianDefault,
  predikatDariNilai,
  RENTANG_PREDIKAT_DEFAULT,
  validasiRentang,
} from '../lib/penilaianTugas'
import { getDaftarMapel } from '../lib/mapelData'
import { getTpMultiMapelKelas } from '../lib/tpData'
import { generateIsiTugasAi, generateKategoriTugasAi } from '../lib/tugasAi'
import { sinkronNilaiTugasKePenilaian } from '../lib/sinkronNilaiTugas'
import type {
  BuktiTugas,
  JenisPenilaianTugas,
  JenisTugas,
  PengaturanPenilaianTugas,
  RentangPredikat,
  TpTugas,
  TugasLms,
} from '../types/tugas'
import {
  DAFTAR_TAHAP,
  KETERANGAN_STATUS_TUGAS,
  LABEL_STATUS_TUGAS,
  labelJenisTugas,
  LABEL_TAHAP,
  NAMA_JENIS_PENILAIAN_TUGAS,
  normalisasiStatusTugas,
  bolehInputNilaiTugas,
  semuaMapelTugas,
  tahapValid,
  type StatusTugas,
  type LampiranTugas,
  BATAS_JUMLAH_LAMPIRAN_TUGAS,
  BATAS_UKURAN_LAMPIRAN_TUGAS,
} from '../types/tugas'
import type { TpRingkas } from '../types/materi'

type TabId = 'pengaturan' | 'isi' | 'kumpul' | 'nilai'

const DAFTAR_TAB: TabId[] = ['pengaturan', 'isi', 'kumpul', 'nilai']

function tabValid(v: string | null): v is TabId {
  return v !== null && (DAFTAR_TAB as string[]).includes(v)
}

/**
 * Tab awal tugas yang sudah ada: ke pekerjaan guru berikutnya, bukan selalu «Pengaturan».
 * Aktif siswa → Pengumpulan (cek kiriman); Aktif guru → Input nilai; Draf → Pengaturan.
 */
function tabAwalUntuk(t: TugasLms): TabId {
  const st = normalisasiStatusTugas(t.statusTugas, t.aktif)
  if (st === 'aktif_siswa') return 'kumpul'
  if (st === 'aktif_guru') return 'nilai'
  return 'pengaturan'
}
type SubNilai = 'pengaturan-nilai' | 'daftar-nilai'

type DraftBaris = {
  perKategori: Record<string, string>
  nilaiAkhir: string
  predikat: string
  komentar: string
}

function tenggatKeInput(tenggat: unknown): string {
  if (!tenggat) return ''
  let d: Date | null = null
  if (typeof tenggat === 'object' && tenggat !== null && 'seconds' in tenggat) {
    d = new Date((tenggat as { seconds: number }).seconds * 1000)
  } else if (typeof tenggat === 'string') {
    const p = new Date(tenggat)
    if (!Number.isNaN(p.getTime())) d = p
  }
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function idBaru(): string {
  return `kat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

type FormPengaturanSig = {
  judul: string
  jenis: string
  kelas: string
  mapel: string[]
  deskripsi: string
  tenggat: string
  status: string
  kelompok: boolean
  kelompokMax: number
  jp: string
  tp: string[]
}

function sigPengaturan(f: FormPengaturanSig): string {
  return JSON.stringify([
    f.judul,
    f.jenis,
    f.kelas,
    f.mapel,
    f.deskripsi,
    f.tenggat,
    f.status,
    f.kelompok,
    f.kelompok ? f.kelompokMax : 0,
    f.jp,
    [...f.tp].sort(),
  ])
}

/** Tanda sudah/belum tersimpan di bilah aksi bawah. */
function PenandaUbah({ ubah }: { ubah: boolean }) {
  return (
    <span className={`td-ubah${ubah ? ' td-ubah--ada' : ''}`} role="status" aria-live="polite">
      {ubah ? 'Ada perubahan yang belum disimpan' : 'Semua perubahan tersimpan'}
    </span>
  )
}

function IconSparkle({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconLock({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-1.5" />
    </svg>
  )
}

export default function TugasDetail() {
  const { tugasId = '' } = useParams()
  const isBaru = tugasId === 'baru' || !tugasId
  const navigate = useNavigate()
  const { user, profil } = useAuth()
  const bisaAi = bolehAiTugas(user?.uid)

  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTabState] = useState<TabId>(() => {
    const q = searchParams.get('tab')
    return tabValid(q) ? q : 'pengaturan'
  })
  /** true bila tab sudah ditentukan (lewat URL atau klik) → jangan ditimpa tab awal otomatis. */
  const tabDitentukan = useRef(tabValid(searchParams.get('tab')))
  /** Pindah tab + simpan di URL (?tab=) agar muat ulang / tombol kembali tetap di tab yang sama. */
  function setTab(t: TabId) {
    tabDitentukan.current = true
    setSukses('')
    setTabState(t)
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('tab', t)
        return n
      },
      { replace: true },
    )
  }
  const [subNilai, setSubNilai] = useState<SubNilai>('pengaturan-nilai')
  const [loading, setLoading] = useState(!isBaru)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState('')
  const [tugas, setTugas] = useState<TugasLms | null>(null)

  const [judul, setJudul] = useState('')
  const [jenis, setJenis] = useState<JenisTugas>('mapel')
  const [kelas, setKelas] = useState('')
  /** Satu atau lebih blok mapel; indeks 0 = mapel utama. */
  const [blokMapel, setBlokMapel] = useState<{ key: string; mapel: string }[]>([
    { key: 'utama', mapel: '' },
  ])
  const [deskripsi, setDeskripsi] = useState('')
  const [lampiranList, setLampiranList] = useState<LampiranTugas[]>([])
  const [unggahLampiranBusy, setUnggahLampiranBusy] = useState(false)
  const [progresLampiran, setProgresLampiran] = useState<number | null>(null)
  const [instruksi, setInstruksi] = useState('')
  const [buktiList, setBuktiList] = useState<BuktiTugas[]>([])
  const [tenggatStr, setTenggatStr] = useState('')
  const [statusTugas, setStatusTugas] = useState<StatusTugas>('draf')
  const [modeKelompok, setModeKelompok] = useState(false)
  const [kelompokMaxAnggota, setKelompokMaxAnggota] = useState(4)
  const [berbagiOpen, setBerbagiOpen] = useState(false)
  const [jenisPenilaian, setJenisPenilaian] = useState<JenisPenilaianTugas>('slm')
  const [tpDipilih, setTpDipilih] = useState<TpTugas[]>([])
  /** Opsi TP per nama mapel. */
  const [tpByMapel, setTpByMapel] = useState<Record<string, TpRingkas[]>>({})
  const [pengaturan, setPengaturan] = useState<PengaturanPenilaianTugas>(pengaturanPenilaianDefault())
  const [masterMapel, setMasterMapel] = useState<string[]>([])
  const [mapelLoading, setMapelLoading] = useState(true)

  const [barisNilai, setBarisNilai] = useState<BarisNilaiTugas[] | null>(null)
  const [loadingNilai, setLoadingNilai] = useState(false)
  const [draft, setDraft] = useState<Record<string, DraftBaris>>({})
  const [menyimpanSiswaId, setMenyimpanSiswaId] = useState<string | null>(null)
  const [genAiBusy, setGenAiBusy] = useState(false)
  /** Penilaian bukti foto/video dengan AI (hanya akun AI) — ANTIREGRESI §Tugas.NilaiAi. */
  const [pengumpulanMap, setPengumpulanMap] = useState<Record<string, PengumpulanDok> | null>(null)
  const [usulanAi, setUsulanAi] = useState<Record<string, UsulanNilaiAi>>({})
  const [aiTerapkan, setAiTerapkan] = useState<Record<string, boolean>>({})
  const [aiBusyId, setAiBusyId] = useState<string | null>(null)
  const [aiMassal, setAiMassal] = useState<{ selesai: number; total: number } | null>(null)
  const aiBatalRef = useRef(false)
  /** Kelompok tugas (hanya tugas modeKelompok) — bukti ketua dipakai untuk seluruh anggota. */
  const [kelompokList, setKelompokList] = useState<TugasKelompokDok[]>([])
  /** `pemilikId` = siswa yang mengumpulkan (ketua / pengirim mandiri); `siswaId` = baris yang membuka dialog. */
  const [dialogAi, setDialogAi] = useState<{ pemilikId: string; siswaId: string } | null>(null)
  /** Saringan & pencarian pada Daftar nilai siswa. */
  const [filterNilai, setFilterNilai] = useState<'semua' | 'kosong' | 'ubah'>('semua')
  const [cariNilai, setCariNilai] = useState('')

  useEffect(() => {
    let batal = false
    setMapelLoading(true)
    void getDaftarMapel()
      .then((list) => {
        if (!batal) setMasterMapel(list)
      })
      .catch(() => {
        if (!batal) setMasterMapel([])
      })
      .finally(() => {
        if (!batal) setMapelLoading(false)
      })
    return () => {
      batal = true
    }
  }, [])

  /** Kelas & mapel yang boleh dipilih: guru kelas = kelas walinya; guru bidang studi = penugasannya saja. */
  const cakupan = useMemo(() => cakupanTugas(profil, masterMapel), [profil, masterMapel])
  const opsiKelas = useMemo(() => {
    const l = [...cakupan.kelas]
    // Tugas yang sedang diedit tetap menampilkan kelasnya sendiri meski penugasan berubah.
    if (tugas?.kelas && !l.includes(tugas.kelas)) l.push(tugas.kelas)
    return l
  }, [cakupan, tugas])
  const opsiMapel = useMemo(() => {
    if (!kelas) return []
    const l = [...cakupan.mapelUntuk(kelas)]
    if (tugas && tugas.kelas === kelas) {
      for (const m of [tugas.mapel, ...(Array.isArray(tugas.mapelLain) ? tugas.mapelLain : [])]) {
        if (m && !l.includes(m)) l.push(m)
      }
    }
    return l.sort((a, b) => a.localeCompare(b, 'id'))
  }, [cakupan, kelas, tugas])

  // Hanya satu pilihan → pilih otomatis pada tugas baru (mis. guru bidang studi satu kelas).
  useEffect(() => {
    if (!isBaru || kelas || opsiKelas.length !== 1) return
    setKelas(opsiKelas[0])
  }, [isBaru, kelas, opsiKelas])
  useEffect(() => {
    if (!isBaru || !kelas || opsiMapel.length !== 1) return
    setBlokMapel((prev) =>
      prev[0] && !prev[0].mapel ? [{ ...prev[0], mapel: opsiMapel[0] }, ...prev.slice(1)] : prev,
    )
  }, [isBaru, kelas, opsiMapel])

  const mapel = blokMapel[0]?.mapel?.trim() || ''
  const mapelLain = blokMapel
    .slice(1)
    .map((b) => b.mapel.trim())
    .filter(Boolean)
  const mapelUntukTp = useMemo(() => {
    const list =
      jenis === 'proyek'
        ? blokMapel.map((b) => b.mapel.trim()).filter(Boolean)
        : mapel
          ? [mapel]
          : []
    return [...new Set(list)]
  }, [jenis, blokMapel, mapel])

  const kategoriAktif = useMemo(
    () => pengaturan.kategori.filter((k) => k.nama.trim()),
    [pengaturan.kategori],
  )

  const isiFormDariTugas = useCallback((t: TugasLms) => {
    setJudul(t.judul)
    setJenis(t.jenis || 'mapel')
    setKelas(t.kelas)
    const lain = Array.isArray(t.mapelLain) ? t.mapelLain.filter(Boolean) : []
    setBlokMapel([
      { key: 'utama', mapel: t.mapel || '' },
      ...lain.map((m, i) => ({ key: `lain-${i}-${m}`, mapel: m })),
    ])
    setDeskripsi(t.deskripsi || '')
    setInstruksi(t.instruksi || '')
    setBuktiList(t.buktiList || [])
    setLampiranList(t.lampiranList ?? [])
    setTenggatStr(tenggatKeInput(t.tenggat))
    setStatusTugas(normalisasiStatusTugas(t.statusTugas, t.aktif))
    setModeKelompok(t.modeKelompok === true)
    setKelompokMaxAnggota(
      typeof t.kelompokMaxAnggota === 'number' && t.kelompokMaxAnggota >= 2
        ? Math.min(12, t.kelompokMaxAnggota)
        : 4,
    )
    setJenisPenilaian(
      t.jenisPenilaian === 'latihan' ||
        t.jenisPenilaian === 'sts' ||
        t.jenisPenilaian === 'sas' ||
        t.jenisPenilaian === 'slm'
        ? t.jenisPenilaian
        : 'slm',
    )
    setTpDipilih(t.tpList || [])
    setPengaturan(normalisasiPengaturan(t.pengaturanPenilaian))
  }, [])

  useEffect(() => {
    if (isBaru) {
      setLoading(false)
      return
    }
    let batal = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const t = await ambilTugas(tugasId)
        if (batal) return
        if (!t) {
          setError('Tugas tidak ditemukan.')
          setTugas(null)
        } else {
          setTugas(t)
          isiFormDariTugas(t)
          if (!tabDitentukan.current) setTabState(tabAwalUntuk(t))
        }
      } catch (e) {
        if (!batal) setError(e instanceof Error ? e.message : 'Gagal memuat tugas.')
      } finally {
        if (!batal) setLoading(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [tugasId, isBaru, isiFormDariTugas])

  useEffect(() => {
    if (!kelas || mapelUntukTp.length === 0) {
      setTpByMapel({})
      return
    }
    let batal = false
    void getTpMultiMapelKelas(mapelUntukTp, kelas).then((list) => {
      if (batal) return
      const by: Record<string, TpRingkas[]> = {}
      for (const tp of list) {
        const m = tp.mapel || ''
        if (!by[m]) by[m] = []
        by[m].push(tp)
      }
      setTpByMapel(by)
    })
    return () => {
      batal = true
    }
  }, [kelas, mapelUntukTp])

  function toggleTp(tp: TpRingkas) {
    setTpDipilih((prev) => {
      const ada = prev.some((p) => p.id === tp.id)
      if (ada) return prev.filter((p) => p.id !== tp.id)
      return [...prev, { id: tp.id, nomor: tp.nomorTp, nama: tp.namaTp, mapel: tp.mapel }]
    })
  }

  function setMapelBlok(key: string, namaMapel: string) {
    setBlokMapel((prev) => {
      const lama = prev.find((b) => b.key === key)?.mapel || ''
      const next = prev.map((b) => (b.key === key ? { ...b, mapel: namaMapel } : b))
      if (lama && lama !== namaMapel) {
        setTpDipilih((tp) => tp.filter((x) => x.mapel !== lama))
      }
      return next
    })
  }

  function tambahBlokMapel() {
    setBlokMapel((prev) => [
      ...prev,
      { key: `lain-${Date.now().toString(36)}`, mapel: '' },
    ])
  }

  function hapusBlokMapel(key: string) {
    if (key === 'utama') return
    setBlokMapel((prev) => {
      const target = prev.find((b) => b.key === key)
      if (target?.mapel) {
        setTpDipilih((tp) => tp.filter((x) => x.mapel !== target.mapel))
      }
      return prev.filter((b) => b.key !== key)
    })
  }

  function onGantiJenis(j: JenisTugas) {
    setJenis(j)
    if (j === 'mapel') {
      setBlokMapel((prev) => {
        const utama = prev[0] || { key: 'utama', mapel: '' }
        return [{ key: 'utama', mapel: utama.mapel }]
      })
      setTpDipilih((tp) => {
        const m = blokMapel[0]?.mapel
        if (!m) return tp
        return tp.filter((x) => !x.mapel || x.mapel === m)
      })
    }
  }


  async function tambahLampiran(file: File) {
    if (isBaru || !tugasId) {
      setError('Simpan pengaturan tugas dulu, lalu unggah lampiran.')
      return
    }
    if (lampiranList.length >= BATAS_JUMLAH_LAMPIRAN_TUGAS) {
      setError(`Maksimal ${BATAS_JUMLAH_LAMPIRAN_TUGAS} lampiran.`)
      return
    }
    setUnggahLampiranBusy(true)
    setProgresLampiran(0)
    setError('')
    try {
      const L = await unggahLampiranTugas(tugasId, file, setProgresLampiran)
      const next = [...lampiranList, L]
      setLampiranList(next)
      await updateTugas(tugasId, { lampiranList: next })
      setSukses(`Lampiran «${L.nama}» terunggah.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah lampiran.')
    } finally {
      setUnggahLampiranBusy(false)
      setProgresLampiran(null)
    }
  }

  async function hapusLampiran(L: LampiranTugas) {
    if (!tugasId) return
    if (!window.confirm(`Hapus lampiran «${L.nama}»?`)) return
    setBusy(true)
    setError('')
    try {
      await hapusBerkasLampiranTugas(L.storagePath)
      const next = lampiranList.filter((x) => x.id !== L.id)
      setLampiranList(next)
      await updateTugas(tugasId, { lampiranList: next })
      setSukses('Lampiran dihapus.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus lampiran.')
    } finally {
      setBusy(false)
    }
  }

  async function simpanPengaturan(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    setSukses('')
    try {
      const tenggat = tenggatStr ? new Date(tenggatStr) : null
      if (!opsiKelas.includes(kelas)) {
        throw new Error(`Anda tidak memiliki penugasan di kelas ${kelas || '—'}. Pilih kelas yang Anda ampu.`)
      }
      const luarCakupan = [mapel, ...mapelLain].filter((m) => m && !opsiMapel.includes(m))
      if (luarCakupan.length > 0) {
        throw new Error(`Mapel di luar penugasan Anda untuk kelas ${kelas}: ${luarCakupan.join(', ')}.`)
      }
      if (isBaru) {
        const id = await buatTugas({
          judul,
          jenis,
          jenisPenilaian,
          kelas,
          mapel,
          mapelLain: jenis === 'proyek' ? mapelLain : undefined,
          deskripsi,
          instruksi,
          tpList: tpDipilih,
          tenggat,
          statusTugas,
          aktif: statusTugas === 'aktif_siswa',
          pengaturanPenilaian: pengaturan,
          modeKelompok,
          kelompokMaxAnggota: modeKelompok ? kelompokMaxAnggota : undefined,
          namaGuru: profil?.nama,
        })
        setSukses('Tugas berhasil dibuat. Lanjutkan dengan menulis instruksi untuk siswa.')
        tabDitentukan.current = true
        navigate(`/tugas/${id}?tab=isi`, { replace: true })
      } else {
        await updateTugas(tugasId, {
          judul,
          jenis,
          jenisPenilaian,
          kelas,
          mapel,
          mapelLain: jenis === 'proyek' ? mapelLain : [],
          deskripsi,
          instruksi,
          tpList: tpDipilih,
          tenggat,
          statusTugas,
          aktif: statusTugas === 'aktif_siswa',
          pengaturanPenilaian: pengaturan,
          lampiranList,
          modeKelompok,
          kelompokMaxAnggota: modeKelompok ? kelompokMaxAnggota : undefined,
        })
        setSukses('Perubahan disimpan.')
        const t = await ambilTugas(tugasId)
        if (t) {
          setTugas(t)
          isiFormDariTugas(t)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function simpanIsi() {
    if (isBaru) {
      setError('Simpan pengaturan dulu sebelum mengisi instruksi lengkap.')
      setTab('pengaturan')
      return
    }
    setBusy(true)
    setError('')
    setSukses('')
    try {
      if (buktiList.some((b) => !b.label.trim())) {
        throw new Error('Beri nama untuk setiap bukti pengumpulan, atau hapus bukti yang kosong.')
      }
      await updateTugas(tugasId, { instruksi, deskripsi, buktiList })
      const t = await ambilTugas(tugasId)
      if (t) setTugas(t)
      setSukses('Isi tugas disimpan.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan isi.')
    } finally {
      setBusy(false)
    }
  }

  async function simpanPengaturanNilai() {
    if (isBaru) {
      setError('Simpan pengaturan tugas dulu.')
      setTab('pengaturan')
      return
    }
    if (!pengaturan.rentangTerkunci) {
      const errRentang = validasiRentang(pengaturan.rentangPredikat)
      if (errRentang) {
        setError(errRentang)
        return
      }
    }
    setBusy(true)
    setError('')
    setSukses('')
    try {
      const bersih: PengaturanPenilaianTugas = {
        ...pengaturan,
        kategori: pengaturan.kategori.filter((k) => k.nama.trim()),
      }
      await updateTugas(tugasId, { pengaturanPenilaian: bersih })
      setPengaturan(bersih)
      setSukses('Pengaturan penilaian disimpan. Kategori akan muncul sebagai kolom di Daftar nilai.')
      const t = await ambilTugas(tugasId)
      if (t) setTugas(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  /** Apakah draf lokal berisi data yang perlu dipertahankan (belum disimpan). */
  function draftBerisiData(d: DraftBaris | undefined): boolean {
    if (!d) return false
    if (String(d.nilaiAkhir || '').trim() !== '') return true
    if (String(d.komentar || '').trim() !== '') return true
    if (String(d.predikat || '').trim() !== '') return true
    return Object.values(d.perKategori || {}).some((v) => String(v || '').trim() !== '')
  }

  /** Bandingkan draf dengan snapshot server (string skor). */
  function draftSamaDenganServer(d: DraftBaris, server: DraftBaris): boolean {
    if (String(d.nilaiAkhir || '').trim() !== String(server.nilaiAkhir || '').trim()) return false
    if (String(d.predikat || '').trim() !== String(server.predikat || '').trim()) return false
    if (String(d.komentar || '').trim() !== String(server.komentar || '').trim()) return false
    const ids = new Set([
      ...Object.keys(d.perKategori || {}),
      ...Object.keys(server.perKategori || {}),
    ])
    for (const id of ids) {
      if (
        String(d.perKategori?.[id] || '').trim() !==
        String(server.perKategori?.[id] || '').trim()
      ) {
        return false
      }
    }
    return true
  }

  /**
   * Status baris: `ok` = sama dengan yang tersimpan; `ubah` = ada isian/perubahan yang belum
   * disimpan; `kosong` = belum pernah dinilai dan belum diisi.
   */
  function statusBarisNilai(r: BarisNilaiTugas): 'kosong' | 'ubah' | 'ok' {
    const d = draft[r.siswaId]
    if (!draftBerisiData(d)) return r.sudahAda ? 'ubah' : 'kosong'
    const per: Record<string, string> = {}
    for (const k of kategoriAktif) {
      const v = r.perKategori[k.id]
      per[k.id] = v === null || v === undefined ? '' : String(v)
    }
    let pred = r.predikat
    if (!pred && r.nilaiAkhir !== null) pred = predikatOtomatis(r.nilaiAkhir, pengaturan.rentangPredikat)
    const srv: DraftBaris = {
      perKategori: per,
      nilaiAkhir: r.nilaiAkhir === null ? '' : String(r.nilaiAkhir),
      predikat: pred,
      komentar: r.komentar || '',
    }
    if (draftSamaDenganServer(d as DraftBaris, srv)) return r.sudahAda ? 'ok' : 'ubah'
    return 'ubah'
  }

  /**
   * Muat daftar nilai dari server.
   * `force: true` menimpa seluruh draf (tombol Muat ulang).
   * Default: pertahankan draf lokal yang berbeda dari server (hasil generate AI / edit belum disimpan).
   */
  const muatNilai = useCallback(
    async (opsi?: { force?: boolean }) => {
      if (isBaru || !tugas) {
        setBarisNilai(null)
        return
      }
      setLoadingNilai(true)
      setError('')
      try {
        const kat = normalisasiPengaturan(tugas.pengaturanPenilaian).kategori.filter((k) =>
          k.nama.trim(),
        )
        const rentang = normalisasiPengaturan(tugas.pengaturanPenilaian).rentangPredikat
        const rows = await muatBarisNilaiTugas(tugas.id, tugas.kelas, tugas.mapel, kat)
        setBarisNilai(rows)
        const dariServer: Record<string, DraftBaris> = {}
        for (const r of rows) {
          const per: Record<string, string> = {}
          for (const k of kat) {
            const v = r.perKategori[k.id]
            per[k.id] = v === null || v === undefined ? '' : String(v)
          }
          let pred = r.predikat
          if (!pred && r.nilaiAkhir !== null) {
            pred = predikatOtomatis(r.nilaiAkhir, rentang)
          }
          dariServer[r.siswaId] = {
            perKategori: per,
            nilaiAkhir: r.nilaiAkhir === null ? '' : String(r.nilaiAkhir),
            predikat: pred,
            komentar: r.komentar || '',
          }
        }
        setDraft((prev) => {
          if (opsi?.force) return dariServer
          const next: Record<string, DraftBaris> = { ...dariServer }
          for (const [sid, local] of Object.entries(prev)) {
            if (!draftBerisiData(local)) continue
            const srv = dariServer[sid]
            if (!srv || !draftSamaDenganServer(local, srv)) {
              next[sid] = local
            }
          }
          return next
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat daftar nilai.')
        setBarisNilai([])
      } finally {
        setLoadingNilai(false)
      }
    },
    [isBaru, tugas],
  )

  useEffect(() => {
    if (tab === 'nilai' && subNilai === 'daftar-nilai' && !isBaru && tugas) {
      // Jangan force: pertahankan draf AI/edit bila user pindah tab lalu kembali.
      void muatNilai()
    }
  }, [tab, subNilai, isBaru, tugas, muatNilai])

  function patchDraft(siswaId: string, patch: Partial<DraftBaris>) {
    setDraft((prev) => {
      const cur = prev[siswaId] || {
        perKategori: {},
        nilaiAkhir: '',
        predikat: '',
        komentar: '',
      }
      return { ...prev, [siswaId]: { ...cur, ...patch } }
    })
  }

  function onSkorKategori(siswaId: string, katId: string, val: string) {
    setDraft((prev) => {
      const cur = prev[siswaId] || {
        perKategori: {},
        nilaiAkhir: '',
        predikat: '',
        komentar: '',
      }
      const per = { ...cur.perKategori, [katId]: val }
      const angka: Record<string, number | null> = {}
      for (const [id, s] of Object.entries(per)) {
        const n = Number(String(s).replace(',', '.'))
        angka[id] = s.trim() === '' || Number.isNaN(n) ? null : n
      }
      const rata = hitungRataRata(angka, kategoriAktif)
      const rentang = pengaturan.rentangPredikat
      let pred = cur.predikat
      let akhir = cur.nilaiAkhir
      if (rata !== null) {
        akhir = String(Math.round(rata))
        if (!bisaAi) {
          pred = predikatDariNilai(Math.round(rata), rentang)?.predikat || pred
        }
      }
      return {
        ...prev,
        [siswaId]: { ...cur, perKategori: per, nilaiAkhir: akhir, predikat: pred },
      }
    })
  }

  function onNilaiAkhirChange(siswaId: string, val: string) {
    const num = Number(val.replace(',', '.'))
    const patch: Partial<DraftBaris> = { nilaiAkhir: val }
    if (!Number.isNaN(num) && val.trim() !== '' && !bisaAi) {
      const p = predikatDariNilai(num, pengaturan.rentangPredikat)
      if (p) patch.predikat = p.predikat
    }
    patchDraft(siswaId, patch)
  }

  /** Muat pengumpulan (+ kelompok bila tugas kelompok) saat Daftar nilai dibuka oleh akun AI. */
  useEffect(() => {
    if (!bisaAi || tab !== 'nilai' || subNilai !== 'daftar-nilai' || isBaru || !tugas) return
    if (pengumpulanMap !== null) return
    let batal = false
    void (async () => {
      let l: PengumpulanDok[] = []
      try {
        l = await daftarPengumpulanTugas(tugas)
      } catch {
        /* peta kosong → «Belum mengumpulkan» */
      }
      const kel: TugasKelompokDok[] = []
      if (tugas.modeKelompok === true) {
        const kelasSemua = [...new Set([tugas.kelas, ...(tugas.kelasList ?? [])].filter(Boolean))]
        for (const kls of kelasSemua) {
          try {
            kel.push(...(await daftarKelompokTugas(tugas.id, kls)))
          } catch (e) {
            // Rombel paralel yang tidak diampu ditolak rules — lewati (sama seperti KelompokGuruRingkas).
            console.warn('NilaiAi: kelompok', kls, e)
          }
        }
      }
      if (batal) return
      setKelompokList(kel)
      setPengumpulanMap(Object.fromEntries(l.map((d) => [d.siswaId, d])))
    })()
    return () => {
      batal = true
    }
  }, [bisaAi, tab, subNilai, isBaru, tugas, pengumpulanMap])

  /**
   * Dari mana bukti seorang siswa berasal? Pengumpulan sendiri lebih diutamakan (anggota yang
   * diizinkan kirim mandiri); bila tidak ada dan ia anggota kelompok yang ketuanya sudah
   * mengumpulkan → bukti ketua. `kelompok` terisi bila pemilik bukti adalah ketua sebuah kelompok.
   */
  function sumberBuktiSiswa(siswaId: string): {
    pemilikId: string
    dok: PengumpulanDok
    via: 'sendiri' | 'kelompok'
    kelompok?: TugasKelompokDok
  } | null {
    if (!pengumpulanMap) return null
    const sendiri = pengumpulanMap[siswaId]
    if (sendiri) {
      return { pemilikId: siswaId, dok: sendiri, via: 'sendiri', kelompok: kelompokList.find((k) => k.ketuaId === siswaId) }
    }
    const k = kelompokList.find((x) => x.anggotaIds.includes(siswaId))
    if (k && pengumpulanMap[k.ketuaId]) {
      return { pemilikId: k.ketuaId, dok: pengumpulanMap[k.ketuaId], via: 'kelompok', kelompok: k }
    }
    return null
  }

  /** Terapkan usulan AI ke DRAF baris (belum tersimpan; guru memeriksa lalu menyimpan). */
  function terapkanUsulan(siswaId: string, u: UsulanNilaiAi | undefined) {
    if (!u) return
    setDraft((prev) => {
      const cur = prev[siswaId] || { perKategori: {}, nilaiAkhir: '', predikat: '', komentar: '' }
      const per = { ...cur.perKategori }
      for (const k of u.kategori) {
        if (k.skor !== null && kategoriAktif.some((c) => c.id === k.id)) per[k.id] = String(k.skor)
      }
      const angka: Record<string, number | null> = {}
      for (const c of kategoriAktif) {
        const t = (per[c.id] ?? '').trim()
        const n = Number(t.replace(',', '.'))
        angka[c.id] = t === '' || Number.isNaN(n) ? null : n
      }
      const rata = hitungRataRata(angka, kategoriAktif)
      let akhir = cur.nilaiAkhir
      let pred = cur.predikat
      if (rata !== null) {
        akhir = String(Math.round(rata))
        pred = predikatDariNilai(Math.round(rata), pengaturan.rentangPredikat)?.predikat || pred
      }
      const komentar = cur.komentar.trim() ? cur.komentar : u.komentarSiswa
      return { ...prev, [siswaId]: { ...cur, perKategori: per, nilaiAkhir: akhir, predikat: pred, komentar } }
    })
    setAiTerapkan((p) => ({ ...p, [siswaId]: true }))
  }

  /**
   * Anggota kelompok yang layak ikut diberi usulan ketua: ada di daftar nilai, belum tersimpan nilainya,
   * dan tidak punya pengumpulan sendiri (yang mengirim mandiri dinilai dari buktinya sendiri).
   */
  function anggotaPenerimaUsulan(pemilikId: string, k: TugasKelompokDok): string[] {
    const ada = new Set((barisNilai ?? []).map((r) => r.siswaId))
    return k.anggotaIds.filter(
      (id) =>
        ada.has(id) &&
        (id === pemilikId || !pengumpulanMap?.[id]) &&
        statusNilai[id] !== 'ok',
    )
  }

  /**
   * Minta AI menilai bukti satu pengumpulan. `pemilikId` = pemilik pengumpulan (ketua bila lewat kelompok).
   * `terapkanKe` terisi (mode massal) = langsung ke draf baris-baris itu tanpa dialog.
   */
  async function usulkanAi(pemilikId: string, targetId: string, namaTampil: string, terapkanKe?: string[]): Promise<boolean> {
    if (!bisaAi || !tugas) return false
    setAiBusyId(pemilikId)
    setError('')
    try {
      const u = await usulkanNilaiTugasAi(tugas.id, pemilikId)
      setUsulanAi((p) => ({ ...p, [pemilikId]: u }))
      if (terapkanKe) for (const id of terapkanKe) terapkanUsulan(id, u)
      else setDialogAi({ pemilikId, siswaId: targetId })
      return true
    } catch (e) {
      setError(`${namaTampil}: ${e instanceof Error ? e.message : 'Gagal menilai dengan AI.'}`)
      return false
    } finally {
      setAiBusyId(null)
    }
  }

  /**
   * Nilai semua yang sudah punya bukti tetapi belum dinilai. Satu panggilan AI per PEMILIK bukti:
   * satu kelompok = satu panggilan, hasilnya masuk ke draf seluruh anggota yang layak.
   */
  async function usulkanAiMassal() {
    if (!bisaAi || !barisNilai || !pengumpulanMap) return
    const peta = new Map<string, { nama: string; baris: string[] }>()
    for (const r of barisNilai) {
      if (statusBarisNilai(r) !== 'kosong') continue
      const sb = sumberBuktiSiswa(r.siswaId)
      if (!sb) continue
      const nama = sb.via === 'kelompok' ? `Kelompok ${sb.kelompok?.ketuaNama ?? ''}`.trim() : r.siswaNama
      const g = peta.get(sb.pemilikId) ?? { nama, baris: [] }
      g.baris.push(r.siswaId)
      peta.set(sb.pemilikId, g)
    }
    const target = [...peta.entries()]
    if (!target.length) {
      setError('Tidak ada siswa yang sudah punya bukti dan belum dinilai.')
      return
    }
    const jumlahSiswa = target.reduce((n, [, g]) => n + g.baris.length, 0)
    if (
      !confirm(
        `AI akan menganalisis ${target.length} pengumpulan (untuk ${jumlahSiswa} siswa) satu per satu — bisa beberapa menit.\n` +
          'Tugas kelompok dihitung sekali per kelompok. Hasilnya masuk ke DRAF nilai dan belum tersimpan.\nLanjutkan?',
      )
    )
      return
    aiBatalRef.current = false
    let gagal = 0
    for (let i = 0; i < target.length; i++) {
      if (aiBatalRef.current) break
      const [pemilikId, g] = target[i]
      setAiMassal({ selesai: i, total: target.length })
      const ok = await usulkanAi(pemilikId, g.baris[0], g.nama, g.baris)
      if (!ok) gagal++
      if (gagal >= 3) {
        setError('Dihentikan: 3 pengumpulan gagal diproses. Periksa pesan galat lalu coba lagi.')
        break
      }
    }
    setAiMassal(null)
  }

  /**
   * Simpan satu baris tanpa memuat ulang seluruh daftar (agar draf siswa lain tetap utuh).
   * Mengembalikan true bila berhasil.
   */
  async function simpanSatuNilai(
    siswaId: string,
    siswaNama: string,
    opsi?: { diam?: boolean; draftOverride?: DraftBaris },
  ): Promise<boolean> {
    if (!tugas) return false
    const d = opsi?.draftOverride ?? draft[siswaId]
    if (!d) return false
    const perAngka: Record<string, number> = {}
    for (const k of kategoriAktif) {
      const raw = (d.perKategori[k.id] || '').trim()
      if (raw === '') continue
      const n = Number(raw.replace(',', '.'))
      if (Number.isNaN(n) || n < 0 || n > 100) {
        setError(`Skor «${k.nama}» untuk ${siswaNama} harus 0–100.`)
        return false
      }
      perAngka[k.id] = n
    }
    const rata = hitungRataRata(perAngka, kategoriAktif)
    let akhir = Number(String(d.nilaiAkhir).replace(',', '.'))
    if (d.nilaiAkhir.trim() === '' || Number.isNaN(akhir)) {
      if (rata !== null) akhir = Math.round(rata)
      else {
        setError(`Isi skor kategori atau nilai akhir untuk ${siswaNama}.`)
        return false
      }
    }
    if (akhir < 0 || akhir > 100) {
      setError(`Nilai akhir ${siswaNama} harus 0–100.`)
      return false
    }
    const pred =
      d.predikat ||
      predikatDariNilai(akhir, pengaturan.rentangPredikat)?.predikat ||
      ''

    if (!opsi?.diam) {
      setMenyimpanSiswaId(siswaId)
      setError('')
      setSukses('')
    }
    try {
      await simpanNilaiTugas({
        tugasId: tugas.id,
        siswaId,
        siswaNama,
        kelas: tugas.kelas,
        mapel: tugas.mapel,
        nilaiPerKategori: Object.keys(perAngka).length ? perAngka : undefined,
        nilaiRataRata: rata,
        nilai: akhir,
        predikat: pred,
        komentar: d.komentar,
        namaGuru: profil?.nama,
      })
      // Soft-update baris lokal — jangan muat ulang seluruh daftar (draf AI siswa lain tetap utuh).
      const perLokal: Record<string, number | null> = {}
      for (const k of kategoriAktif) {
        perLokal[k.id] = perAngka[k.id] !== undefined ? perAngka[k.id] : null
      }
      setBarisNilai((prev) =>
        (prev || []).map((r) =>
          r.siswaId === siswaId
            ? {
                ...r,
                sudahAda: true,
                perKategori: perLokal,
                rataRata: rata,
                nilaiAkhir: akhir,
                predikat: pred,
                komentar: d.komentar || '',
              }
            : r,
        ),
      )
      setDraft((prev) => {
        const perStr: Record<string, string> = {}
        for (const k of kategoriAktif) {
          perStr[k.id] = perAngka[k.id] !== undefined ? String(perAngka[k.id]) : ''
        }
        return {
          ...prev,
          [siswaId]: {
            perKategori: perStr,
            nilaiAkhir: String(akhir),
            predikat: pred,
            komentar: d.komentar || '',
          },
        }
      })
      if (!opsi?.diam) setSukses(`Nilai ${siswaNama} disimpan.`)
      return true
    } catch (e) {
      if (!opsi?.diam) setError(e instanceof Error ? e.message : 'Gagal menyimpan nilai.')
      return false
    } finally {
      if (!opsi?.diam) setMenyimpanSiswaId(null)
    }
  }

  /** Generate skor kategori dari predikat lalu langsung simpan (live). */
  async function generateDariPredikat(siswaId: string) {
    if (!bisaAi || !tugas) return
    const d = draft[siswaId]
    if (!d?.predikat) {
      setError('Pilih predikat dulu, lalu tekan generate.')
      return
    }
    const siswaNama =
      barisNilai?.find((r) => r.siswaId === siswaId)?.siswaNama || siswaId
    const hasil = generateSkorPerKategoriDariPredikat(
      d.predikat,
      kategoriAktif,
      pengaturan.rentangPredikat,
    )
    const per: Record<string, string> = {}
    for (const [id, n] of Object.entries(hasil.perKategori)) {
      per[id] = String(n)
    }
    const nextDraft: DraftBaris = {
      perKategori: per,
      nilaiAkhir: String(hasil.nilaiAkhir),
      predikat: d.predikat,
      komentar: d.komentar || '',
    }
    patchDraft(siswaId, nextDraft)
    setMenyimpanSiswaId(siswaId)
    setError('')
    setSukses('')
    try {
      const ok = await simpanSatuNilai(siswaId, siswaNama, {
        diam: true,
        draftOverride: nextDraft,
      })
      if (ok) {
        setSukses(
          kategoriAktif.length
            ? `Skor ${kategoriAktif.length} kategori diisi & disimpan (predikat ${d.predikat}).`
            : `Nilai akhir ${hasil.nilaiAkhir} disimpan (predikat ${d.predikat}).`,
        )
      }
    } finally {
      setMenyimpanSiswaId(null)
    }
  }

  /** Simpan semua baris yang punya data di draf. */
  async function simpanSemuaDraft() {
    if (!tugas || !barisNilai?.length) return
    const kandidat = barisNilai.filter((r) => statusBarisNilai(r) === 'ubah')
    if (!kandidat.length) {
      setError('Tidak ada perubahan nilai yang perlu disimpan.')
      return
    }
    setMenyimpanSiswaId('__semua__')
    setError('')
    setSukses('')
    let ok = 0
    let gagal = 0
    try {
      for (const r of kandidat) {
        const berhasil = await simpanSatuNilai(r.siswaId, r.siswaNama, {
          diam: true,
          draftOverride: draft[r.siswaId],
        })
        if (berhasil) ok++
        else gagal++
      }
      if (gagal === 0) {
        setSukses(`${ok} nilai siswa disimpan.`)
      } else {
        setError(
          `${ok} berhasil, ${gagal} gagal. Periksa skor 0–100 lalu simpan ulang yang gagal.`,
        )
      }
    } finally {
      setMenyimpanSiswaId(null)
    }
  }

  async function generateKategoriAi() {
    if (!bisaAi) return
    const isi = `${instruksi || ''} ${deskripsi || ''}`.trim()
    // Utamakan isi tersimpan di dokumen tugas
    const isiTersimpan = `${tugas?.instruksi || ''} ${tugas?.deskripsi || ''}`.trim()
    const sumber = isiTersimpan.length >= 40 ? isiTersimpan : isi
    if (sumber.length < 40) {
      setError(
        'Isi tugas belum disimpan atau terlalu pendek. Buka tab Isi Tugas, tulis instruksi, simpan, lalu generate kategori.',
      )
      return
    }
    setGenAiBusy(true)
    setError('')
    setSukses('')
    try {
      const hasil = await generateKategoriTugasAi({
        judul: tugas?.judul || judul,
        mapel: tugas?.mapel || mapel,
        kelas: tugas?.kelas || kelas,
        deskripsi: tugas?.deskripsi || deskripsi,
        instruksi: tugas?.instruksi || instruksi,
        tpList: tugas?.tpList || tpDipilih,
      })
      const list = hasil.kategori
      // Kategori yang namanya sudah ada tidak digandakan; id AI dipetakan ke id yang sudah ada.
      const petaId = new Map<string, string>()
      const baru = list.filter((k) => {
        const lama = pengaturan.kategori.find((x) => x.nama === k.nama)
        if (lama) petaId.set(k.id, lama.id)
        return !lama
      })
      setPengaturan((p) => ({ ...p, kategori: [...p.kategori, ...baru] }))
      // Saran bukti hanya dipasang bila daftar bukti masih kosong (tidak menimpa pilihan guru).
      let infoBukti = ''
      if (hasil.bukti.length > 0 && buktiList.length === 0) {
        const diterapkan = rapikanBuktiList(
          hasil.bukti.map((b, i) => ({
            id: `bk-ai-${Date.now().toString(36)}-${i}`,
            slot: i + 1,
            label: b.label,
            petunjuk: b.petunjuk,
            wajib: b.wajib,
            tahap: b.tahap,
            kategoriIds: b.kategoriIds.map((id) => petaId.get(id) ?? id),
          })),
        )
        setBuktiList(diterapkan)
        infoBukti = ` + ${diterapkan.length} saran bukti foto (lihat tab Isi Tugas, periksa lalu simpan di sana)`
      } else if (hasil.bukti.length > 0) {
        infoBukti = '. Bukti foto yang sudah Anda atur tidak diubah'
      }
      setSukses(
        `${list.length} kategori rubrik dari AI${infoBukti}. Periksa lalu simpan pengaturan.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal generate kategori AI.')
    } finally {
      setGenAiBusy(false)
    }
  }

  async function generateIsiDenganAi() {
    if (!bisaAi) return
    if (isBaru || !tugas) {
      setError('Simpan pengaturan tugas (judul, kelas, mapel) terlebih dahulu, lalu generate isi.')
      return
    }
    if (!tugas.judul?.trim()) {
      setError('Judul tugas belum tersimpan.')
      return
    }
    setGenAiBusy(true)
    setError('')
    setSukses('')
    try {
      const hasil = await generateIsiTugasAi({
        judul: tugas.judul,
        mapel: tugas.mapel,
        mapelLain: tugas.mapelLain,
        kelas: tugas.kelas,
        jenis: tugas.jenis,
        deskripsi: tugas.deskripsi || deskripsi,
        tpList: tugas.tpList || tpDipilih,
      })
      setInstruksi(hasil.instruksi)
      if (hasil.deskripsi) setDeskripsi(hasil.deskripsi)
      setSukses('Draf isi tugas dari AI siap. Periksa, sesuaikan, lalu simpan.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal generate isi tugas.')
    } finally {
      setGenAiBusy(false)
    }
  }

  function updateRentang(i: number, patch: Partial<RentangPredikat>) {
    if (pengaturan.rentangTerkunci) return
    setPengaturan((p) => ({
      ...p,
      rentangPredikat: p.rentangPredikat.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }))
  }

  function resetRentangDefault() {
    if (pengaturan.rentangTerkunci) return
    setPengaturan((p) => ({
      ...p,
      rentangPredikat: RENTANG_PREDIKAT_DEFAULT.map((r) => ({ ...r })),
    }))
  }

  function toggleKunciRentang() {
    setPengaturan((p) => ({ ...p, rentangTerkunci: !p.rentangTerkunci }))
  }

  async function sinkronKePenilaian() {
    if (!tugas?.id) {
      setError('Simpan tugas dulu sebelum sinkron ke Penilaian.')
      return
    }
    const jenis = tugas.jenisPenilaian || jenisPenilaian
    if (jenis === 'latihan') {
      setError('Tugas latihan tidak masuk nilai rapor. Ubah jenis penilaian ke SLM/STS/SAS dulu.')
      return
    }
    if (!['slm', 'sts', 'sas'].includes(jenis)) {
      setError(`Jenis penilaian tidak dikenal: ${jenis}`)
      return
    }
    const punyaTp =
      (Array.isArray(tugas.tpList) && tugas.tpList.length > 0) ||
      !!(tugas.tpId || tugas.tpNama) ||
      tpDipilih.length > 0
    if (!punyaTp) {
      setError('Lampirkan minimal satu TP di pengaturan tugas sebelum sinkron.')
      return
    }
    const adaNilai =
      barisNilai?.some((r) => r.sudahAda || (typeof r.nilaiAkhir === 'number' && r.nilaiAkhir !== null)) ||
      Object.values(draft).some(
        (d) => String(d.nilaiAkhir || '').trim() !== '' || Object.values(d.perKategori || {}).some((v) => String(v || '').trim() !== ''),
      )
    if (!adaNilai) {
      setError('Belum ada nilai yang tersimpan. Isi & simpan nilai siswa dulu, lalu sinkron.')
      return
    }
    setBusy(true)
    setError('')
    setSukses('')
    try {
      const h = await sinkronNilaiTugasKePenilaian({ tugasId: tugas.id, overwrite: true })
      setSukses(
        `Sinkron OK → ${h.koleksi}: ${h.ditulis} nilai ditulis` +
          (h.dilewati ? `, ${h.dilewati} dilewati` : '') +
          ` · ${h.nSiswa} siswa · ${h.nTp} TP · sem ${h.semester} · ${h.tahunAjaran}`,
      )
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Gagal sinkron ke Penilaian.'
      setError(msg.replace(/^Firebase: |\s*\(.*\)\.?$/g, '').trim() || msg)
    } finally {
      setBusy(false)
    }
  }

  /** Ringkasan & hasil saringan Daftar nilai siswa. */
  const statusNilai: Record<string, 'kosong' | 'ubah' | 'ok'> = {}
  let nilaiOk = 0
  let nilaiUbah = 0
  let nilaiKosong = 0
  for (const r of barisNilai ?? []) {
    const st = statusBarisNilai(r)
    statusNilai[r.siswaId] = st
    if (st === 'ok') nilaiOk++
    else if (st === 'ubah') nilaiUbah++
    else nilaiKosong++
  }
  const kataCari = cariNilai.trim().toLowerCase()
  const barisTampil = (barisNilai ?? [])
    .map((r, i) => ({ r, no: i + 1 }))
    .filter(({ r }) => {
      if (kataCari && !r.siswaNama.toLowerCase().includes(kataCari)) return false
      if (filterNilai === 'kosong') return statusNilai[r.siswaId] === 'kosong'
      if (filterNilai === 'ubah') return statusNilai[r.siswaId] === 'ubah'
      return true
    })

  /** Tanda perubahan belum tersimpan (hanya untuk tugas yang sudah ada). */
  const sigForm = sigPengaturan({
    judul,
    jenis,
    kelas,
    mapel: blokMapel.map((b) => b.mapel),
    deskripsi,
    tenggat: tenggatStr,
    status: statusTugas,
    kelompok: modeKelompok,
    kelompokMax: kelompokMaxAnggota,
    jp: jenisPenilaian,
    tp: tpDipilih.map((x) => x.id),
  })
  const sigTersimpan =
    !isBaru && tugas
      ? sigPengaturan({
          judul: tugas.judul,
          jenis: tugas.jenis || 'mapel',
          kelas: tugas.kelas,
          mapel: [
            tugas.mapel || '',
            ...(Array.isArray(tugas.mapelLain) ? tugas.mapelLain.filter(Boolean) : []),
          ],
          deskripsi: tugas.deskripsi || '',
          tenggat: tenggatKeInput(tugas.tenggat),
          status: normalisasiStatusTugas(tugas.statusTugas, tugas.aktif),
          kelompok: tugas.modeKelompok === true,
          kelompokMax:
            typeof tugas.kelompokMaxAnggota === 'number' && tugas.kelompokMaxAnggota >= 2
              ? Math.min(12, tugas.kelompokMaxAnggota)
              : 4,
          jp:
            tugas.jenisPenilaian === 'latihan' ||
            tugas.jenisPenilaian === 'sts' ||
            tugas.jenisPenilaian === 'sas' ||
            tugas.jenisPenilaian === 'slm'
              ? tugas.jenisPenilaian
              : 'slm',
          tp: (tugas.tpList || []).map((x) => x.id),
        })
      : null
  const ubahPengaturan = sigTersimpan !== null && sigTersimpan !== sigForm
  const ubahIsi =
    !isBaru && !!tugas && (instruksi !== (tugas.instruksi || '') || deskripsi !== (tugas.deskripsi || ''))

  if (loading) {
    return (
      <div className="tg-halaman">
        <div className="td-skel-hero" aria-busy="true" aria-label="Memuat tugas" />
        <div className="td-skel-tabs" />
        <div className="td-skel-card" />
        <div className="td-skel-card td-skel-card--pendek" />
      </div>
    )
  }

  if (!isBaru && !tugas && error) {
    return (
      <div className="tg-halaman">
        <Link to="/tugas" className="td-back">
          ← Daftar tugas
        </Link>
        <div className="tg-galat" role="alert">
          {error}
        </div>
      </div>
    )
  }

  const judulHalaman = isBaru ? 'Tugas baru' : tugas?.judul || 'Detail tugas'
  const daftarPredikat = pengaturan.rentangPredikat.map((r) => r.predikat)
  const terkunci = pengaturan.rentangTerkunci === true
  const mapelAksen = (isBaru ? mapel : tugas?.mapel) || mapel || ''
  const aksen = aksenMapel(mapelAksen || 'Umum')
  const infoTg = infoTenggat(isBaru ? null : tugas?.tenggat)
  const jp = isBaru ? jenisPenilaian : penilaianTugas(tugas || { jenisPenilaian })
  const statusNow = isBaru ? statusTugas : normalisasiStatusTugas(tugas?.statusTugas, tugas?.aktif)
  const mapelsLabel = !isBaru && tugas ? semuaMapelTugas(tugas).join(', ') : mapelAksen

  return (
    <div className="tg-halaman td-halaman" style={{ ['--tg-a' as string]: aksen.bar }}>
      <header className="td-hero">
        <div className="td-hero-bar" aria-hidden />
        <div className="td-hero-isi">
          <Link to="/tugas" className="td-back">
            ← Daftar tugas
          </Link>
          <div className="td-hero-atas">
            <span className="td-mono" aria-hidden>
              {inisialMapel(mapelAksen || 'TG')}
            </span>
            <div className="td-hero-judul">
              <h1 className="td-judul">{judulHalaman}</h1>
              <div className="td-meta">
                {!isBaru && tugas ? (
                  <>
                    <span className="td-chip">{labelJenisTugas(tugas.jenis)}</span>
                    <span className="td-chip">Kelas {tugas.kelas}</span>
                    {mapelsLabel && <span className="td-chip td-chip--mapel">{mapelsLabel}</span>}
                    <span className={`td-chip td-chip--status td-chip--${statusNow}`}>
                      {LABEL_STATUS_TUGAS[statusNow]}
                    </span>
                    <span className={`td-chip td-chip--jp td-chip--${jp}`} title={NAMA_JENIS_PENILAIAN_TUGAS[jp]}>
                      {LABEL_PENILAIAN_SINGKAT[jp]}
                    </span>
                    {infoTg.nada !== 'tanpa' && (
                      <span className={`td-chip td-chip--tenggat td-chip--tg-${infoTg.nada}`}>
                        {infoTg.label}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="td-chip td-chip--muted">Lengkapi pengaturan, isi, lalu atur penilaian</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="td-tabs" role="tablist" aria-label="Bagian tugas">
        {(
          [
            { id: 'pengaturan' as const, label: 'Pengaturan', hint: 'Identitas & TP', badge: 0 },
            { id: 'isi' as const, label: 'Isi tugas', hint: 'Instruksi siswa', badge: 0 },
            {
              id: 'kumpul' as const,
              label: 'Pengumpulan',
              hint: 'Foto dari siswa',
              badge: isBaru ? 0 : (tugas?.jumlahPengumpulan ?? 0),
            },
            { id: 'nilai' as const, label: 'Input nilai', hint: 'Rubrik & daftar', badge: 0 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`td-tab${tab === t.id ? ' td-tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="td-tab-label">
              {t.label}
              {t.badge > 0 && (
                <i className="td-tab-badge" title={`${t.badge} pengumpulan`}>
                  {t.badge}
                </i>
              )}
            </span>
            <span className="td-tab-hint">{t.hint}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div className="tg-galat" role="alert">
          {error}
        </div>
      )}
      {sukses && (
        <div className="td-sukses" role="status">
          {sukses}
        </div>
      )}

      <BerbagiKelasDialog
        open={berbagiOpen && !!tugas}
        judulItem={tugas?.judul || judul}
        jenis="tugas"
        kelasUtama={tugas?.kelas || kelas}
        mapel={tugas?.mapel || (blokMapel[0]?.mapel || '')}
        kelasListSaatIni={tugas?.kelasList}
        profil={profil}
        busy={busy}
        onBatal={() => setBerbagiOpen(false)}
        onSimpan={async (list) => {
          if (!tugas) return
          setBusy(true)
          setError('')
          try {
            await aturBerbagiTugas(tugas.id, tugas.kelas, list)
            setBerbagiOpen(false)
            const t2 = await ambilTugas(tugas.id)
            if (t2) setTugas(t2)
            setSukses('Pengaturan berbagi disimpan.')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengatur berbagi.')
          } finally {
            setBusy(false)
          }
        }}
      />

      {tab === 'pengaturan' && (
        <form onSubmit={(e) => void simpanPengaturan(e)} className="td-form">
          <section className="td-kartu">
            <div className="td-kartu-kepala">
              <h2>Identitas tugas</h2>
              <p>Judul, jenis, kelas, dan tenggat yang dilihat siswa.</p>
            </div>
            <div className="td-kartu-badan td-grid-2">
              <label className="td-field td-field--full">
                <span>Judul tugas</span>
                <input required value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Menggambar tekstur daun" />
              </label>
              <label className="td-field">
                <span>Jenis tugas</span>
                <select value={jenis} onChange={(e) => onGantiJenis(e.target.value as JenisTugas)}>
                  <option value="mapel">Mapel (satu mata pelajaran)</option>
                  <option value="proyek">Proyek (lintas mata pelajaran)</option>
                </select>
              </label>
              <label className="td-field">
                <span>Kelas</span>
                <select
                  required
                  value={kelas}
                  onChange={(e) => {
                    setKelas(e.target.value)
                    setBlokMapel((prev) => prev.map((b) => ({ ...b, mapel: '' })))
                    setTpDipilih([])
                    setTpByMapel({})
                  }}
                >
                  <option value="">Pilih kelas…</option>
                  {opsiKelas.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </label>
              {cakupan.kosong && (
                <p className="td-hint td-hint--warn td-field--full">
                  Akun Anda belum memiliki penugasan kelas atau perwalian, sehingga belum dapat menyusun tugas.
                  Hubungi admin untuk mengisi penugasan di aplikasi Penilaian.
                </p>
              )}
              <label className="td-field">
                <span>Jenis penilaian</span>
                <select value={jenisPenilaian} onChange={(e) => setJenisPenilaian(e.target.value as JenisPenilaianTugas)}>
                  {(Object.keys(NAMA_JENIS_PENILAIAN_TUGAS) as JenisPenilaianTugas[]).map((j) => (
                    <option key={j} value={j}>{NAMA_JENIS_PENILAIAN_TUGAS[j]}</option>
                  ))}
                </select>
              </label>
              <label className="td-field">
                <span>Tenggat</span>
                <input type="datetime-local" value={tenggatStr} onChange={(e) => setTenggatStr(e.target.value)} />
              </label>
              <label className="td-field td-field--full">
                <span>Deskripsi singkat</span>
                <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={2} placeholder="Ringkasan singkat untuk kartu katalog…" />
              </label>

              {!isBaru && tugas && (
                <div className="td-field td-field--full">
                  <span>Lampiran untuk siswa</span>
                  <p className="td-hint" style={{ marginTop: 0 }}>
                    Template / worksheet / media (dokumen, spreadsheet, presentasi, gambar, audio, video).
                    Maks. {BATAS_JUMLAH_LAMPIRAN_TUGAS} berkas, {Math.round(BATAS_UKURAN_LAMPIRAN_TUGAS / (1024 * 1024))} MB
                    per berkas. Siswa mengunduh dari detail tugas.
                  </p>
                  {lampiranList.length > 0 && (
                    <ul className="td-lampiran-list">
                      {lampiranList.map((L) => (
                        <li key={L.id} className="td-lampiran-item">
                          <a href={L.url} target="_blank" rel="noreferrer" className="td-lampiran-nama">
                            {L.nama}
                          </a>
                          <span className="td-lampiran-meta">
                            {L.jenis}
                            {L.ukuran ? ` · ${(L.ukuran / 1024).toFixed(0)} KB` : ''}
                          </span>
                          <button
                            type="button"
                            className="tg-btn"
                            disabled={busy || unggahLampiranBusy}
                            onClick={() => void hapusLampiran(L)}
                          >
                            Hapus
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lampiranList.length < BATAS_JUMLAH_LAMPIRAN_TUGAS && (
                    <label className="td-lampiran-unggah">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.odt,.txt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp,image/*,audio/*,video/*,.mp3,.mp4,.webm,.wav"
                        disabled={busy || unggahLampiranBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          if (f) void tambahLampiran(f)
                        }}
                      />
                      <span className="tg-btn">
                        {unggahLampiranBusy
                          ? progresLampiran != null
                            ? `Mengunggah… ${Math.round(progresLampiran * 100)}%`
                            : 'Mengunggah…'
                          : '+ Unggah lampiran'}
                      </span>
                    </label>
                  )}
                </div>
              )}
              <fieldset className="td-status-set td-field--full">
                <legend>Status tugas</legend>
                <div className="td-status-kartu">
                  {(['draf', 'aktif_guru', 'aktif_siswa'] as StatusTugas[]).map((st) => (
                    <label
                      key={st}
                      className={`td-status-opsi td-status-opsi--${st}${statusTugas === st ? ' td-status-opsi--on' : ''}`}
                    >
                      <input
                        type="radio"
                        name="status-tugas"
                        value={st}
                        checked={statusTugas === st}
                        onChange={() => setStatusTugas(st)}
                      />
                      <b>{LABEL_STATUS_TUGAS[st]}</b>
                      <small>{KETERANGAN_STATUS_TUGAS[st]}</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="td-opsi-kelompok td-field--full">
                <label className="td-cek td-cek--blok">
                  <input
                    type="checkbox"
                    checked={modeKelompok}
                    onChange={(e) => setModeKelompok(e.target.checked)}
                  />
                  <span className="td-cek-teks">
                    <strong>Tugas kelompok</strong>
                    <small>
                      Siswa membentuk kelompok dan memilih ketua. Hanya ketua yang mengunggah
                      pengumpulan; anggota otomatis tercatat terkumpul setelah ketua mengirim
                      (tanpa konfirmasi per siswa).
                    </small>
                  </span>
                </label>
                {modeKelompok && (
                  <div className="td-opsi-kelompok-detail">
                    <label className="td-field td-field--sempit">
                      <span>Maks. anggota</span>
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={kelompokMaxAnggota}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10)
                          if (!Number.isNaN(n)) setKelompokMaxAnggota(Math.max(2, Math.min(12, n)))
                        }}
                      />
                    </label>
                    <p className="td-hint" style={{ margin: 0 }}>
                      Termasuk ketua (2–12). Default 4 orang per kelompok.
                    </p>
                  </div>
                )}
              </div>

              {tugas && (
                <div className="td-berbagi td-field--full">
                  <span className="td-berbagi-label">Berbagi ke kelas paralel</span>
                  <p className="td-hint">
                    {labelKelasDibagikan(tugas.kelas, tugas.kelasList)
                      ? `Saat ini dibagikan ke: ${labelKelasDibagikan(tugas.kelas, tugas.kelasList)}`
                      : 'Belum dibagikan ke kelas lain. Hanya kelas yang Anda ampu untuk mapel ini.'}
                  </p>
                  <button
                    type="button"
                    className="tg-btn"
                    disabled={busy}
                    onClick={() => setBerbagiOpen(true)}
                  >
                    Atur berbagi…
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="td-kartu">
            <div className="td-kartu-kepala">
              <h2>Mata pelajaran & Tujuan Pembelajaran</h2>
              <p>
                {jenis === 'proyek'
                  ? 'Proyek dapat melibatkan lebih dari satu mapel. Centang TP yang relevan per mapel.'
                  : 'Pilih mapel utama dan TP yang dilatih tugas ini.'}
              </p>
            </div>
            <div className="td-kartu-badan space-y-4">
              {blokMapel.map((blok, idx) => {
                const daftarTp = blok.mapel ? tpByMapel[blok.mapel] || [] : []
                return (
                  <div key={blok.key} className="td-blok-mapel">
                    <div className="td-blok-mapel-kepala">
                      <h3>{idx === 0 ? 'Mapel utama' : `Mapel tambahan ${idx}`}</h3>
                      {idx > 0 && (
                        <button type="button" className="tg-btn tg-btn--bahaya" onClick={() => hapusBlokMapel(blok.key)}>
                          Hapus
                        </button>
                      )}
                    </div>
                    <label className="td-field">
                      <span className="sr-only">Pilih mapel</span>
                      <select
                        required={idx === 0}
                        value={blok.mapel}
                        disabled={!kelas || mapelLoading}
                        onChange={(e) => setMapelBlok(blok.key, e.target.value)}
                      >
                        <option value="">{mapelLoading ? 'Memuat mapel…' : 'Pilih mapel…'}</option>
                        {opsiMapel.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    {blok.mapel && kelas && (
                      <div className="td-tp-box">
                        <div className="td-tp-label">
                          Tujuan Pembelajaran · {blok.mapel}
                          {tpDipilih.filter((p) => p.mapel === blok.mapel).length > 0 && (
                            <i>{tpDipilih.filter((p) => p.mapel === blok.mapel).length} dipilih</i>
                          )}
                        </div>
                        {daftarTp.length === 0 ? (
                          <p className="td-hint">Belum ada TP di tp_kktp untuk {blok.mapel} · kelas {kelas}.</p>
                        ) : (
                          <ul className="td-tp-list">
                            {daftarTp.map((tp) => (
                              <li key={tp.id}>
                                <label className="td-tp-item">
                                  <input
                                    type="checkbox"
                                    checked={tpDipilih.some((p) => p.id === tp.id)}
                                    onChange={() => toggleTp(tp)}
                                  />
                                  <span>
                                    <b>TP {tp.nomorTp}</b> {tp.namaTp}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {kelas && !mapelLoading && opsiMapel.length === 0 && (
                <p className="td-hint td-hint--warn">
                  Belum ada mapel yang dapat Anda pilih untuk kelas {kelas}. Hubungi admin untuk mengisi penugasan
                  mapel Anda.
                </p>
              )}

              {jenis === 'proyek' && (
                <button type="button" className="td-btn-dashed" onClick={tambahBlokMapel}>
                  + Tambah mata pelajaran
                </button>
              )}
            </div>
          </section>

          <div className="td-aksi td-aksi--lekat">
            {!isBaru && <PenandaUbah ubah={ubahPengaturan} />}
            <div className="td-aksi-tombol">
              <Link to="/tugas" className="tg-btn">{isBaru || ubahPengaturan ? 'Batal' : 'Kembali'}</Link>
              <button type="submit" className="tg-btn tg-btn--utama tg-btn--besar" disabled={busy || (isBaru && cakupan.kosong)}>
                {busy ? 'Menyimpan…' : isBaru ? 'Buat tugas' : 'Simpan pengaturan'}
              </button>
            </div>
          </div>
        </form>
      )}

      {tab === 'isi' && (
        <div className="td-form">
          <section className="td-kartu">
            <div className="td-kartu-kepala td-kartu-kepala--row">
              <div>
                <h2>Instruksi untuk siswa</h2>
                <p>
                  {isBaru
                    ? 'Simpan pengaturan (judul, kelas, mapel) dulu sebelum generate AI atau menyimpan isi.'
                    : 'Tulis manual atau generate AI dari pengaturan yang sudah disimpan.'}
                </p>
              </div>
              {bisaAi && (
                <button
                  type="button"
                  className="td-btn-ai"
                  disabled={genAiBusy || isBaru || !tugas?.judul}
                  onClick={() => void generateIsiDenganAi()}
                >
                  <IconSparkle />
                  {genAiBusy ? 'AI menulis…' : 'Generate isi (AI)'}
                </button>
              )}
            </div>
            <div className="td-kartu-badan space-y-4">
              <label className="td-field">
                <span>Deskripsi singkat</span>
                <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={2} />
              </label>
              <label className="td-field">
                <span>Instruksi lengkap</span>
                <textarea
                  value={instruksi}
                  onChange={(e) => setInstruksi(e.target.value)}
                  rows={12}
                  placeholder={'Tulis per bagian, mis.:\nAlat dan Bahan:\n1. Stop watch\n2. Buku tulis\n\nLangkah Kegiatan:\n1. Duduk tenang 2 menit\n   - Hitung nadi 1 menit'}
                />
                <small className="td-field-hint">
                  Format: baris berakhiran «:» menjadi judul bagian · «1.» «2.» menjadi langkah bernomor · «-»
                  menjadi poin · baris kosong memisahkan paragraf · **tebal**.
                </small>
              </label>
              {instruksi.trim() && (
                <details className="td-bukti-pratinjau">
                  <summary>Pratinjau tampilan siswa</summary>
                  <div className="sw-ins" dangerouslySetInnerHTML={{ __html: htmlInstruksiSiswa(instruksi) }} />
                </details>
              )}
            </div>
          </section>

          <BuktiTugasEditor bukti={buktiList} kategori={pengaturan.kategori} onChange={setBuktiList} />
          <div className="td-aksi td-aksi--lekat">
            {!isBaru && <PenandaUbah ubah={ubahIsi} />}
            <div className="td-aksi-tombol">
              <button
                type="button"
                className="tg-btn tg-btn--utama tg-btn--besar"
                disabled={busy || isBaru}
                onClick={() => void simpanIsi()}
              >
                {busy ? 'Menyimpan…' : 'Simpan isi tugas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'kumpul' &&
        (isBaru || !tugas ? (
          <div className="td-form">
            <p className="td-kumpul-kosong">Simpan tugas dulu, lalu pengumpulan siswa akan tampil di sini.</p>
          </div>
        ) : (
          <PengumpulanPanel tugas={tugas} />
        ))}

      {tab === 'nilai' && (
        <div className="td-form">
          <nav className="td-subtabs" role="tablist" aria-label="Sub tab nilai">
            <button
              type="button"
              role="tab"
              aria-selected={subNilai === 'pengaturan-nilai'}
              className={`td-subtab${subNilai === 'pengaturan-nilai' ? ' td-subtab--on' : ''}`}
              onClick={() => setSubNilai('pengaturan-nilai')}
            >
              <span className="td-subtab-label">Pengaturan penilaian</span>
              <span className="td-subtab-hint">Kategori rubrik & predikat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subNilai === 'daftar-nilai'}
              className={`td-subtab${subNilai === 'daftar-nilai' ? ' td-subtab--on' : ''}`}
              onClick={() => setSubNilai('daftar-nilai')}
            >
              <span className="td-subtab-label">Daftar nilai</span>
              <span className="td-subtab-hint">Isi skor per siswa</span>
            </button>
          </nav>

          {subNilai === 'pengaturan-nilai' && (
            <div className="space-y-4">
              <div className="td-intro">
                <h3>Asesmen kinerja (rubrik)</h3>
                <p>
                  Setiap <strong>kategori</strong> menjadi kolom skor di Daftar nilai. Rata-rata dihitung
                  otomatis; nilai akhir mengikuti rata-rata (bisa disesuaikan). Predikat mengikuti tabel
                  rentang di bawah.
                </p>
              </div>

              <section className="td-kartu">
                <div className="td-kartu-kepala td-kartu-kepala--row">
                  <div>
                    <h2>Kategori penilaian</h2>
                    <p>Aspek rubrik · contoh: tebal-tipis garis, tekstur, komposisi</p>
                  </div>
                  <div className="td-kepala-aksi">
                    {bisaAi && (
                      <button
                        type="button"
                        className="td-btn-ai"
                        disabled={genAiBusy || isBaru}
                        onClick={() => void generateKategoriAi()}
                      >
                        <IconSparkle />
                        {genAiBusy ? 'AI…' : 'Usulkan kategori (AI)'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="tg-btn tg-btn--utama"
                      onClick={() =>
                        setPengaturan((p) => ({
                          ...p,
                          kategori: [
                            ...p.kategori,
                            { id: idBaru(), nama: '', bobot: 1, deskripsi: '' },
                          ],
                        }))
                      }
                    >
                      + Kategori
                    </button>
                  </div>
                </div>
                <div className="td-kartu-badan space-y-3">
                  {pengaturan.kategori.length === 0 ? (
                    <div className="td-kosong-kecil">
                      <b>Belum ada kategori</b>
                      <p>Tambah kategori manual atau usulkan lewat AI setelah isi tugas tersimpan.</p>
                    </div>
                  ) : (
                    pengaturan.kategori.map((k, i) => (
                      <div key={k.id} className="td-kat-item">
                        <div className="td-kat-kepala">
                          <span className="td-kat-no">{i + 1}</span>
                          <b>{k.nama.trim() || 'Kategori baru'}</b>
                          <button
                            type="button"
                            className="tg-btn tg-btn--bahaya"
                            title="Hapus kategori"
                            onClick={() =>
                              setPengaturan((p) => ({
                                ...p,
                                kategori: p.kategori.filter((_, j) => j !== i),
                              }))
                            }
                          >
                            Hapus
                          </button>
                        </div>
                        <div className="td-kat-baris">
                          <label className="td-field td-field--grow">
                            <span>Nama kategori</span>
                            <input
                              value={k.nama}
                              onChange={(e) => {
                                const v = e.target.value
                                setPengaturan((p) => ({
                                  ...p,
                                  kategori: p.kategori.map((x, j) => (j === i ? { ...x, nama: v } : x)),
                                }))
                              }}
                              placeholder="Contoh: Komposisi"
                            />
                          </label>
                          {jenis === 'proyek' && mapelUntukTp.length > 1 && (
                            <label className="td-field">
                              <span>Mapel</span>
                              <select
                                value={k.mapel ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPengaturan((p) => ({
                                    ...p,
                                    kategori: p.kategori.map((x, j) =>
                                      j === i ? { ...x, mapel: v || undefined } : x,
                                    ),
                                  }))
                                }}
                              >
                                <option value="">Umum</option>
                                {mapelUntukTp.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <label className="td-field">
                            <span>Tahap</span>
                            <select
                              value={k.tahap ?? ''}
                              onChange={(e) => {
                                const v = tahapValid(e.target.value)
                                setPengaturan((p) => ({
                                  ...p,
                                  kategori: p.kategori.map((x, j) => (j === i ? { ...x, tahap: v } : x)),
                                }))
                              }}
                            >
                              <option value="">—</option>
                              {DAFTAR_TAHAP.map((t) => (
                                <option key={t} value={t}>
                                  {LABEL_TAHAP[t]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="td-field">
                            <span>Dinilai dari</span>
                            <select
                              value={k.sumber === 'observasi' ? 'observasi' : 'bukti'}
                              onChange={(e) => {
                                const v = e.target.value === 'observasi' ? ('observasi' as const) : undefined
                                setPengaturan((p) => ({
                                  ...p,
                                  kategori: p.kategori.map((x, j) => (j === i ? { ...x, sumber: v } : x)),
                                }))
                              }}
                            >
                              <option value="bukti">Bukti foto siswa</option>
                              <option value="observasi">Pengamatan guru</option>
                            </select>
                          </label>
                          <label className="td-field td-field--sempit">
                            <span>Bobot</span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={k.bobot}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                setPengaturan((p) => ({
                                  ...p,
                                  kategori: p.kategori.map((x, j) =>
                                    j === i ? { ...x, bobot: Number.isNaN(v) ? 0 : v } : x,
                                  ),
                                }))
                              }}
                            />
                          </label>
                        </div>
                        <label className="td-field">
                          <span>Deskripsi (opsional)</span>
                          <input
                            value={k.deskripsi || ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setPengaturan((p) => ({
                                ...p,
                                kategori: p.kategori.map((x, j) =>
                                  j === i ? { ...x, deskripsi: v } : x,
                                ),
                              }))
                            }}
                            placeholder="Petunjuk singkat untuk penilai"
                          />
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="td-kartu">
                <div className="td-kartu-kepala td-kartu-kepala--row">
                  <div>
                    <h2>Rentang predikat</h2>
                    <p>Digunakan saat nilai akhir diisi atau dihitung otomatis.</p>
                  </div>
                  <div className="td-kepala-aksi">
                    <button type="button" className="tg-btn" onClick={toggleKunciRentang} title={terkunci ? 'Buka kunci' : 'Kunci rentang'}>
                      <IconLock locked={terkunci} />
                      {terkunci ? 'Terkunci' : 'Buka kunci'}
                    </button>
                    <button type="button" className="tg-btn" disabled={terkunci} onClick={resetRentangDefault}>
                      Reset default
                    </button>
                  </div>
                </div>
                <div className="td-kartu-badan td-scroll">
                  <table className="td-tabel">
                    <thead>
                      <tr>
                        <th>Predikat</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pengaturan.rentangPredikat.map((r, i) => (
                        <tr key={`${r.predikat}-${i}`} className={r.predikat === 'C-' ? 'td-baris-warn' : ''}>
                          <td>
                            <input
                              className="td-input-sm"
                              value={r.predikat}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { predikat: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="td-input-sm"
                              value={r.min}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { min: Number(e.target.value) })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="td-input-sm"
                              value={r.max}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { max: Number(e.target.value) })}
                            />
                          </td>
                          <td>
                            <input
                              className="td-input-md"
                              value={r.keterangan || ''}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { keterangan: e.target.value })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="td-aksi td-aksi--lekat">
                <div className="td-aksi-tombol">
                  <button
                    type="button"
                    className="tg-btn tg-btn--utama tg-btn--besar"
                    disabled={busy || isBaru}
                    onClick={() => void simpanPengaturanNilai()}
                  >
                    {busy ? 'Menyimpan…' : 'Simpan pengaturan penilaian'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {subNilai === 'daftar-nilai' && (
            <div className="space-y-4">
              {isBaru ? (
                <div className="td-kosong-kecil">
                  <b>Simpan tugas dulu</b>
                  <p>Buat dan simpan pengaturan tugas sebelum mengisi nilai siswa.</p>
                </div>
              ) : !bolehInputNilaiTugas(statusNow) ? (
                <div className="td-kosong-kecil">
                  <b>Masih draf</b>
                  <p>
                    Ubah status tugas menjadi <strong>Aktif guru</strong> (nilai tanpa pengumpulan
                    siswa) atau <strong>Aktif siswa</strong> di tab Pengaturan, lalu simpan — baru
                    nilai dapat diisi dan disinkronkan ke Penilaian.
                  </p>
                </div>
              ) : (
                <>
                  <div className="td-nilai-toolbar">
                    <div className="td-nilai-judul">
                      <h2 className="td-subjudul">Daftar nilai siswa</h2>
                      <p className="td-hint">
                        Isi skor per kategori; nilai akhir &amp; predikat menyesuaikan. Generate AI menyimpan
                        otomatis. Draf siswa lain tidak hilang saat menyimpan satu baris.
                      </p>
                    </div>
                    <div className="td-kepala-aksi">
                      <button
                        type="button"
                        className="tg-btn tg-btn--utama"
                        disabled={loadingNilai || menyimpanSiswaId === '__semua__' || nilaiUbah === 0}
                        onClick={() => void simpanSemuaDraft()}
                        title="Simpan semua baris yang berubah / baru diisi"
                      >
                        {menyimpanSiswaId === '__semua__'
                          ? 'Menyimpan…'
                          : nilaiUbah > 0
                            ? `Simpan semua (${nilaiUbah})`
                            : 'Simpan semua'}
                      </button>
                      <button
                        type="button"
                        className="tg-btn"
                        disabled={loadingNilai}
                        onClick={() => {
                          setPengumpulanMap(null)
                          void muatNilai({ force: true })
                        }}
                        title="Muat ulang dari server (menghapus draf yang belum disimpan)"
                      >
                        {loadingNilai ? 'Memuat…' : 'Muat ulang'}
                      </button>
                      <button
                        type="button"
                        className="tg-btn"
                        disabled={busy || loadingNilai}
                        onClick={() => void sinkronKePenilaian()}
                        title="Kirim nilai tugas ke koleksi rapor Penilaian (SLM/STS/SAS)"
                      >
                        {busy ? 'Sinkron…' : 'Sinkron ke Penilaian'}
                      </button>
                      {bisaAi &&
                        (aiMassal ? (
                          <button type="button" className="tg-btn" onClick={() => (aiBatalRef.current = true)}>
                            Menilai {aiMassal.selesai + 1}/{aiMassal.total}… Batalkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="tg-btn td-btn-ai-massal"
                            disabled={loadingNilai || aiBusyId !== null || pengumpulanMap === null}
                            onClick={() => void usulkanAiMassal()}
                            title="AI menganalisis bukti foto/video siswa yang sudah mengumpulkan lalu mengisi DRAF nilai"
                          >
                            ✦ Nilai bukti dengan AI
                          </button>
                        ))}
                    </div>
                  </div>

                  {loadingNilai && <div className="td-skel-card" aria-busy="true" />}

                  {!loadingNilai && barisNilai && barisNilai.length === 0 && (
                    <div className="td-kosong-kecil">
                      <b>Belum ada siswa</b>
                      <p>Roster kelas kosong atau belum tersinkron dari Penilaian.</p>
                    </div>
                  )}

                  {!loadingNilai && barisNilai && barisNilai.length > 0 && (
                    <>
                      <div className="td-progres">
                        <div className="td-progres-teks">
                          <span>
                            <b>{nilaiOk}</b> dari {barisNilai.length} siswa sudah dinilai
                          </span>
                          {nilaiUbah > 0 && (
                            <span className="td-chip td-chip--warn">{nilaiUbah} belum disimpan</span>
                          )}
                        </div>
                        <div
                          className="td-progres-bar"
                          role="progressbar"
                          aria-label="Kemajuan penilaian"
                          aria-valuemin={0}
                          aria-valuemax={barisNilai.length}
                          aria-valuenow={nilaiOk}
                        >
                          <i style={{ width: `${Math.round((nilaiOk / barisNilai.length) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="td-nilai-saring">
                        <input
                          type="search"
                          className="td-input-md td-cari"
                          placeholder="Cari nama siswa…"
                          value={cariNilai}
                          onChange={(e) => setCariNilai(e.target.value)}
                          aria-label="Cari nama siswa"
                        />
                        <div className="td-nilai-segmen" role="group" aria-label="Saring daftar nilai">
                          {(
                            [
                              { v: 'semua' as const, teks: 'Semua', n: barisNilai.length },
                              { v: 'kosong' as const, teks: 'Belum dinilai', n: nilaiKosong },
                              { v: 'ubah' as const, teks: 'Belum disimpan', n: nilaiUbah },
                            ] as const
                          ).map((o) => (
                            <button
                              key={o.v}
                              type="button"
                              className={`tg-seg${filterNilai === o.v ? ' tg-seg--on' : ''}`}
                              aria-pressed={filterNilai === o.v}
                              onClick={() => setFilterNilai(o.v)}
                            >
                              {o.teks}
                              <i>{o.n}</i>
                            </button>
                          ))}
                        </div>
                      </div>

                      {barisTampil.length === 0 ? (
                        <div className="td-kosong-kecil">
                          <b>Tidak ada siswa yang cocok</b>
                          <p>Ubah kata pencarian atau pilih saringan «Semua».</p>
                        </div>
                      ) : (
                        <div className="td-scroll td-tabel-wrap">
                          <table className="td-tabel td-tabel--nilai">
                            <thead>
                              <tr>
                                <th className="td-th-nama">Siswa</th>
                                {kategoriAktif.map((k) => (
                                  <th
                                    key={k.id}
                                    className="td-th-kat"
                                    title={k.deskripsi ? `${k.nama} — ${k.deskripsi}` : k.nama}
                                  >
                                    {k.nama || '—'}
                                  </th>
                                ))}
                                <th className="td-th-akhir">Nilai akhir</th>
                                <th className="td-th-pred">Predikat</th>
                                {bisaAi && (
                                  <th className="td-th-ai" title="Generate dari predikat">
                                    AI
                                  </th>
                                )}
                                {bisaAi && <th className="td-th-bukti">Bukti siswa</th>}
                                <th className="td-th-komen">Komentar</th>
                                <th className="td-th-aksi" aria-label="Aksi" />
                              </tr>
                            </thead>
                            <tbody>
                              {barisTampil.map(({ r, no }) => {
                                const d = draft[r.siswaId] || {
                                  perKategori: {},
                                  nilaiAkhir: '',
                                  predikat: '',
                                  komentar: '',
                                }
                                const st = statusNilai[r.siswaId] ?? 'kosong'
                                const sibuk =
                                  menyimpanSiswaId === r.siswaId || menyimpanSiswaId === '__semua__'
                                return (
                                  <tr key={r.siswaId} className={`td-baris-nilai td-baris-nilai--${st}`}>
                                    <td className="td-td-nama">
                                      <span className="td-nama-wrap">
                                        <span className="td-no">{no}</span>
                                        <span className="td-nama-teks">
                                          <b>{r.siswaNama}</b>
                                          <small className={`td-status-baris td-status-baris--${st}`}>
                                            {st === 'ok'
                                              ? 'Tersimpan'
                                              : st === 'ubah'
                                                ? aiTerapkan[r.siswaId]
                                                  ? 'Usulan AI — periksa lalu simpan'
                                                  : 'Belum disimpan'
                                                : 'Belum dinilai'}
                                          </small>
                                        </span>
                                      </span>
                                    </td>
                                    {kategoriAktif.map((k) => (
                                      <td key={k.id} className="td-td-skor">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="td-input-sm"
                                          placeholder="0–100"
                                          value={d.perKategori[k.id] ?? ''}
                                          onChange={(e) => onSkorKategori(r.siswaId, k.id, e.target.value)}
                                          aria-label={`${k.nama} — ${r.siswaNama}`}
                                        />
                                      </td>
                                    ))}
                                    <td className="td-td-akhir">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        className="td-input-sm td-input--tebal"
                                        placeholder="—"
                                        value={d.nilaiAkhir}
                                        onChange={(e) => onNilaiAkhirChange(r.siswaId, e.target.value)}
                                        aria-label={`Nilai akhir — ${r.siswaNama}`}
                                      />
                                    </td>
                                    <td className="td-td-pred">
                                      <select
                                        className="td-select-sm"
                                        value={d.predikat}
                                        onChange={(e) => patchDraft(r.siswaId, { predikat: e.target.value })}
                                        aria-label={`Predikat — ${r.siswaNama}`}
                                      >
                                        <option value="">—</option>
                                        {daftarPredikat.map((p) => (
                                          <option key={p} value={p}>{p}</option>
                                        ))}
                                      </select>
                                    </td>
                                    {bisaAi && (
                                      <td className="td-td-ai">
                                        <button
                                          type="button"
                                          className="td-btn-ai td-btn-ai--ikon"
                                          title="Generate skor dari predikat lalu simpan otomatis"
                                          aria-label={`Generate dari predikat — ${r.siswaNama}`}
                                          disabled={!d.predikat || sibuk}
                                          onClick={() => void generateDariPredikat(r.siswaId)}
                                        >
                                          <IconSparkle />
                                        </button>
                                      </td>
                                    )}
                                    {bisaAi && (
                                      <td className="td-td-bukti">
                                        {pengumpulanMap === null ? (
                                          <span className="td-bukti-kosong">Memuat…</span>
                                        ) : (() => {
                                            const sb = sumberBuktiSiswa(r.siswaId)
                                            if (!sb) {
                                              const kel = kelompokList.find((x) => x.anggotaIds.includes(r.siswaId))
                                              return (
                                                <span className="td-bukti-kosong">
                                                  {kel ? `Menunggu ketua (${kel.ketuaNama})` : 'Belum mengumpulkan'}
                                                </span>
                                              )
                                            }
                                            const sibukIni = aiBusyId === sb.pemilikId
                                            const ada = usulanAi[sb.pemilikId]
                                            const jmlVideo = Object.keys(sb.dok.videos ?? {}).length
                                            return (
                                              <div className="td-bukti-sel">
                                                <span className="td-bukti-info">
                                                  {sb.dok.fotoIds.length} foto{jmlVideo > 0 ? ` · ${jmlVideo} video` : ''}
                                                </span>
                                                {sb.via === 'kelompok' && (
                                                  <span className="td-chip td-bukti-via" title="Bukti dikumpulkan ketua kelompok">
                                                    Lewat ketua: {sb.kelompok?.ketuaNama}
                                                  </span>
                                                )}
                                                <div className="td-bukti-aksi">
                                                  <button
                                                    type="button"
                                                    className="td-btn-ai-teks"
                                                    disabled={aiBusyId !== null || aiMassal !== null}
                                                    onClick={() =>
                                                      ada
                                                        ? setDialogAi({ pemilikId: sb.pemilikId, siswaId: r.siswaId })
                                                        : void usulkanAi(sb.pemilikId, r.siswaId, r.siswaNama)
                                                    }
                                                  >
                                                    {sibukIni ? 'Menganalisis…' : ada ? 'Lihat usulan' : '✦ Nilai bukti'}
                                                  </button>
                                                  {ada && !sibukIni && (
                                                    <button
                                                      type="button"
                                                      className="td-btn-ai-ulang"
                                                      title="Minta AI menilai ulang"
                                                      aria-label={`Nilai ulang ${r.siswaNama} dengan AI`}
                                                      disabled={aiBusyId !== null || aiMassal !== null}
                                                      onClick={() => void usulkanAi(sb.pemilikId, r.siswaId, r.siswaNama)}
                                                    >
                                                      ↻
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          })()}
                                      </td>
                                    )}
                                    <td className="td-td-komen">
                                      <input
                                        type="text"
                                        className="td-input-md"
                                        placeholder="Komentar (opsional)"
                                        value={d.komentar}
                                        onChange={(e) => patchDraft(r.siswaId, { komentar: e.target.value })}
                                        aria-label={`Komentar — ${r.siswaNama}`}
                                      />
                                    </td>
                                    <td className="td-td-aksi">
                                      <button
                                        type="button"
                                        className={`td-btn-baris${st === 'ubah' ? ' td-btn-baris--utama' : ''}`}
                                        disabled={sibuk || st !== 'ubah'}
                                        onClick={() => void simpanSatuNilai(r.siswaId, r.siswaNama)}
                                      >
                                        {menyimpanSiswaId === r.siswaId
                                          ? '…'
                                          : st === 'ok'
                                            ? '✓ Tersimpan'
                                            : 'Simpan'}
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {bisaAi && dialogAi && usulanAi[dialogAi.pemilikId] && (() => {
        const sb = sumberBuktiSiswa(dialogAi.siswaId)
        const u = usulanAi[dialogAi.pemilikId]
        const baris = (barisNilai ?? []).find((r) => r.siswaId === dialogAi.siswaId)
        const kel = sb?.kelompok
        const penerima = kel ? anggotaPenerimaUsulan(dialogAi.pemilikId, kel) : []
        return (
          <UsulanNilaiAiDialog
            usulan={u}
            pengumpulan={pengumpulanMap?.[dialogAi.pemilikId]}
            namaTarget={baris?.siswaNama ?? u.siswaNama}
            kelompok={
              kel
                ? { ketuaNama: kel.ketuaNama, jumlahAnggota: kel.anggotaIds.length, jumlahPenerima: penerima.length }
                : undefined
            }
            sudahDiterapkan={!!aiTerapkan[dialogAi.siswaId]}
            onTerapkan={() => {
              terapkanUsulan(dialogAi.siswaId, u)
              setDialogAi(null)
            }}
            onTerapkanKelompok={
              kel && penerima.length > 1
                ? () => {
                    for (const id of penerima) terapkanUsulan(id, u)
                    setDialogAi(null)
                  }
                : undefined
            }
            onTutup={() => setDialogAi(null)}
          />
        )
      })()}
    </div>
  )
}

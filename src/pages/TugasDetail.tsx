import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas, DAFTAR_KELAS_SD } from '../lib/kelasLms'
import { ambilTugas, buatTugas, formatTenggat, updateTugas } from '../lib/tugas'
import {
  hitungRataRata,
  muatBarisNilaiTugas,
  predikatOtomatis,
  simpanNilaiTugas,
  type BarisNilaiTugas,
} from '../lib/nilaiTugas'
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
import type {
  JenisTugas,
  KategoriPenilaian,
  PengaturanPenilaianTugas,
  RentangPredikat,
  TpTugas,
  TugasLms,
} from '../types/tugas'
import { labelJenisTugas } from '../types/tugas'
import type { TpRingkas } from '../types/materi'

type TabId = 'pengaturan' | 'isi' | 'nilai'
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

  const [tab, setTab] = useState<TabId>('pengaturan')
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
  const [instruksi, setInstruksi] = useState('')
  const [tenggatStr, setTenggatStr] = useState('')
  const [aktif, setAktif] = useState(false)
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

  const ruang = useMemo(() => daftarRuangKelas(profil), [profil])

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

  const opsiKelas = useMemo(() => {
    const dariRuang = [...new Set(ruang.map((r) => r.kelas))]
    return dariRuang.length ? dariRuang : [...DAFTAR_KELAS_SD]
  }, [ruang])
  const opsiMapel = useMemo(() => {
    const dariRuang = kelas
      ? ruang.filter((r) => r.kelas === kelas).map((r) => r.mapel)
      : ruang.map((r) => r.mapel)
    const gabung = [...dariRuang, ...masterMapel].filter(Boolean)
    return [...new Set(gabung)].sort((a, b) => a.localeCompare(b, 'id'))
  }, [ruang, kelas, masterMapel])

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
    setTenggatStr(tenggatKeInput(t.tenggat))
    setAktif(t.aktif)
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

  async function simpanPengaturan(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    setSukses('')
    try {
      const tenggat = tenggatStr ? new Date(tenggatStr) : null
      if (isBaru) {
        const id = await buatTugas({
          judul,
          jenis,
          kelas,
          mapel,
          mapelLain: jenis === 'proyek' ? mapelLain : undefined,
          deskripsi,
          instruksi,
          tpList: tpDipilih,
          tenggat,
          aktif,
          pengaturanPenilaian: pengaturan,
          namaGuru: profil?.nama,
        })
        setSukses('Tugas berhasil dibuat.')
        navigate(`/tugas/${id}`, { replace: true })
      } else {
        await updateTugas(tugasId, {
          judul,
          jenis,
          kelas,
          mapel,
          mapelLain: jenis === 'proyek' ? mapelLain : [],
          deskripsi,
          instruksi,
          tpList: tpDipilih,
          tenggat,
          aktif,
          pengaturanPenilaian: pengaturan,
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
      await updateTugas(tugasId, { instruksi, deskripsi })
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

  const muatNilai = useCallback(async () => {
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
      const next: Record<string, DraftBaris> = {}
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
        next[r.siswaId] = {
          perKategori: per,
          nilaiAkhir: r.nilaiAkhir === null ? '' : String(r.nilaiAkhir),
          predikat: pred,
          komentar: r.komentar || '',
        }
      }
      setDraft(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar nilai.')
      setBarisNilai([])
    } finally {
      setLoadingNilai(false)
    }
  }, [isBaru, tugas])

  useEffect(() => {
    if (tab === 'nilai' && subNilai === 'daftar-nilai' && !isBaru && tugas) {
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

  function generateDariPredikat(siswaId: string) {
    if (!bisaAi) return
    const d = draft[siswaId]
    if (!d?.predikat) {
      setError('Pilih predikat dulu, lalu tekan generate.')
      return
    }
    const hasil = generateSkorPerKategoriDariPredikat(
      d.predikat,
      kategoriAktif,
      pengaturan.rentangPredikat,
    )
    const per: Record<string, string> = {}
    for (const [id, n] of Object.entries(hasil.perKategori)) {
      per[id] = String(n)
    }
    patchDraft(siswaId, {
      perKategori: per,
      nilaiAkhir: String(hasil.nilaiAkhir),
      predikat: d.predikat,
    })
    setSukses(
      kategoriAktif.length
        ? `Skor ${kategoriAktif.length} kategori diisi otomatis (predikat ${d.predikat}). Simpan baris siswa.`
        : `Nilai akhir diusulkan: ${hasil.nilaiAkhir}. Simpan baris siswa.`,
    )
  }

  async function simpanSatuNilai(siswaId: string, siswaNama: string) {
    if (!tugas) return
    const d = draft[siswaId]
    if (!d) return
    const perAngka: Record<string, number> = {}
    for (const k of kategoriAktif) {
      const raw = (d.perKategori[k.id] || '').trim()
      if (raw === '') continue
      const n = Number(raw.replace(',', '.'))
      if (Number.isNaN(n) || n < 0 || n > 100) {
        setError(`Skor «${k.nama}» untuk ${siswaNama} harus 0–100.`)
        return
      }
      perAngka[k.id] = n
    }
    const rata = hitungRataRata(perAngka, kategoriAktif)
    let akhir = Number(String(d.nilaiAkhir).replace(',', '.'))
    if (d.nilaiAkhir.trim() === '' || Number.isNaN(akhir)) {
      if (rata !== null) akhir = Math.round(rata)
      else {
        setError(`Isi skor kategori atau nilai akhir untuk ${siswaNama}.`)
        return
      }
    }
    if (akhir < 0 || akhir > 100) {
      setError(`Nilai akhir ${siswaNama} harus 0–100.`)
      return
    }
    const pred =
      d.predikat ||
      predikatDariNilai(akhir, pengaturan.rentangPredikat)?.predikat ||
      ''

    setMenyimpanSiswaId(siswaId)
    setError('')
    setSukses('')
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
      setSukses(`Nilai ${siswaNama} disimpan.`)
      await muatNilai()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan nilai.')
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
      const list = await generateKategoriTugasAi({
        judul: tugas?.judul || judul,
        mapel: tugas?.mapel || mapel,
        kelas: tugas?.kelas || kelas,
        deskripsi: tugas?.deskripsi || deskripsi,
        instruksi: tugas?.instruksi || instruksi,
        tpList: tugas?.tpList || tpDipilih,
      })
      setPengaturan((p) => ({
        ...p,
        kategori: [
          ...p.kategori,
          ...list.filter((k) => !p.kategori.some((x) => x.nama === k.nama)),
        ],
      }))
      setSukses(`${list.length} kategori rubrik dari AI (berdasarkan isi tugas). Periksa lalu simpan pengaturan.`)
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

  function tambahKategori() {
    setPengaturan((p) => ({
      ...p,
      kategori: [...p.kategori, { id: idBaru(), nama: '', deskripsi: '' }],
    }))
  }

  function updateKategori(id: string, patch: Partial<KategoriPenilaian>) {
    setPengaturan((p) => ({
      ...p,
      kategori: p.kategori.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    }))
  }

  function hapusKategori(id: string) {
    setPengaturan((p) => ({
      ...p,
      kategori: p.kategori.filter((k) => k.id !== id),
    }))
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
    setError('')
    setSukses(
      'Sinkron ke database Penilaian belum diaktifkan di server. Simpan semua nilai dulu; CF akan menyusul.',
    )
  }

  if (loading) return <div className="lms-empty">Memuat tugas…</div>

  if (!isBaru && !tugas && error) {
    return (
      <div className="space-y-3">
        <Link to="/tugas" className="text-sm font-semibold text-muh-600 hover:underline">
          ← Kembali ke daftar tugas
        </Link>
        <div className="lms-empty text-red-700">{error}</div>
      </div>
    )
  }

  const judulHalaman = isBaru ? 'Tugas baru' : tugas?.judul || 'Detail tugas'
  const daftarPredikat = pengaturan.rentangPredikat.map((r) => r.predikat)
  const terkunci = pengaturan.rentangTerkunci === true

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/tugas" className="text-sm font-semibold text-muh-600 hover:underline">
            ← Daftar tugas
          </Link>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{judulHalaman}</h2>
          {!isBaru && tugas && (
            <p className="mt-0.5 text-xs text-muted">
              {labelJenisTugas(tugas.jenis)} · Kelas {tugas.kelas} · {tugas.mapel}
              {tugas.aktif ? ' · Aktif' : ' · Draf'}
              {tugas.tenggat ? ` · Tenggat ${formatTenggat(tugas.tenggat)}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="lms-tabs" role="tablist" aria-label="Bag tugas">
        {(
          [
            { id: 'pengaturan' as const, label: 'Pengaturan' },
            { id: 'isi' as const, label: 'Isi Tugas' },
            { id: 'nilai' as const, label: 'Input Nilai' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`lms-tab ${tab === t.id ? 'lms-tab--active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      {sukses && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {sukses}
        </div>
      )}

      {/* —— Pengaturan tugas —— */}
      {tab === 'pengaturan' && (
        <form onSubmit={(e) => void simpanPengaturan(e)} className="materi-form max-w-3xl space-y-4">
          <label className="materi-field">
            <span>Judul tugas</span>
            <input required value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Menggambar tekstur daun" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="materi-field">
              <span>Jenis tugas</span>
              <select value={jenis} onChange={(e) => onGantiJenis(e.target.value as JenisTugas)}>
                <option value="mapel">Mapel (satu mata pelajaran)</option>
                <option value="proyek">Proyek (lintas mata pelajaran)</option>
              </select>
            </label>
            <label className="materi-field">
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
                <option value="">— Pilih kelas —</option>
                {opsiKelas.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          </div>
          {/* Blok mapel + TP (utama, lalu tambahan untuk proyek) */}
          <div className="space-y-4">
            {blokMapel.map((blok, idx) => {
              const dipakaiLain = blokMapel
                .filter((b) => b.key !== blok.key)
                .map((b) => b.mapel)
                .filter(Boolean)
              const opsiBlok = opsiMapel.filter(
                (m) => m === blok.mapel || !dipakaiLain.includes(m),
              )
              const daftarTp = blok.mapel ? tpByMapel[blok.mapel] || [] : []
              const nTpPilih = tpDipilih.filter(
                (p) => p.mapel === blok.mapel || (!p.mapel && idx === 0),
              ).length
              return (
                <section
                  key={blok.key}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {idx === 0
                        ? jenis === 'proyek'
                          ? 'Mapel utama'
                          : 'Mata pelajaran'
                        : `Mapel tambahan ${idx}`}
                    </h3>
                    {idx > 0 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 hover:underline"
                        onClick={() => hapusBlokMapel(blok.key)}
                      >
                        Hapus mapel
                      </button>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <label className="materi-field">
                      <span className="sr-only">Pilih mapel</span>
                      <select
                        required={idx === 0}
                        value={blok.mapel}
                        onChange={(e) => setMapelBlok(blok.key, e.target.value)}
                      >
                        <option value="">
                          {mapelLoading ? 'Memuat mapel…' : '— Pilih mapel —'}
                        </option>
                        {opsiBlok.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Tujuan Pembelajaran
                        </p>
                        {nTpPilih > 0 && (
                          <span className="text-[11px] font-medium text-muh-700">
                            {nTpPilih} dipilih
                          </span>
                        )}
                      </div>
                      {!kelas ? (
                        <p className="text-xs text-muted">Pilih kelas dulu.</p>
                      ) : !blok.mapel ? (
                        <p className="text-xs text-muted">Pilih mapel di atas untuk memuat TP.</p>
                      ) : daftarTp.length === 0 ? (
                        <p className="text-xs text-muted">
                          Belum ada TP di tp_kktp untuk {blok.mapel} · kelas {kelas}.
                        </p>
                      ) : (
                        <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                          {daftarTp.map((tp) => (
                            <li key={tp.id}>
                              <label className="flex cursor-pointer items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={tpDipilih.some((p) => p.id === tp.id)}
                                  onChange={() => toggleTp(tp)}
                                />
                                <span>
                                  <span className="font-medium">TP {tp.nomorTp}</span>{' '}
                                  <span className="text-slate-700">{tp.namaTp}</span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[11px] text-muted">
                        Boleh memilih lebih dari satu TP untuk mapel ini.
                      </p>
                    </div>
                  </div>
                </section>
              )
            })}

            {!mapelLoading && opsiMapel.length === 0 && (
              <p className="text-xs text-amber-700">
                Daftar mapel kosong. Pastikan koleksi mapel di Penilaian terisi, atau isi penugasan guru.
              </p>
            )}

            {jenis === 'proyek' && (
              <button
                type="button"
                className="w-full rounded-xl border border-dashed border-muh-300 bg-muh-50/50 px-4 py-3 text-sm font-semibold text-muh-800 hover:bg-muh-50"
                onClick={tambahBlokMapel}
              >
                + Tambah mata pelajaran
              </button>
            )}
          </div>

          <label className="materi-field">
            <span>Deskripsi singkat</span>
            <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={2} />
          </label>
          <label className="materi-field">
            <span>Tenggat</span>
            <input type="datetime-local" value={tenggatStr} onChange={(e) => setTenggatStr(e.target.value)} />
          </label>
          
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktifkan tugas (tampil untuk siswa)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Link to="/tugas" className="lms-btn-secondary">Batal</Link>
            <button type="submit" className="lms-btn-primary" disabled={busy}>
              {busy ? 'Menyimpan…' : isBaru ? 'Buat tugas' : 'Simpan pengaturan'}
            </button>
          </div>
        </form>
      )}

      {tab === 'isi' && (
        <div className="materi-form max-w-3xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Instruksi untuk siswa</h3>
              <p className="mt-0.5 text-xs text-muted">
                {isBaru
                  ? 'Simpan pengaturan (judul, kelas, mapel) dulu sebelum generate AI atau menyimpan isi.'
                  : 'Tulis manual atau generate AI dari pengaturan yang sudah disimpan.'}
              </p>
            </div>
            {bisaAi && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                disabled={genAiBusy || isBaru || !tugas?.judul}
                onClick={() => void generateIsiDenganAi()}
              >
                <IconSparkle />
                {genAiBusy ? 'AI menulis…' : 'Generate isi (AI)'}
              </button>
            )}
          </div>
          <label className="materi-field">
            <span>Deskripsi singkat</span>
            <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={2} />
          </label>
          <label className="materi-field">
            <span>Instruksi lengkap</span>
            <textarea value={instruksi} onChange={(e) => setInstruksi(e.target.value)} rows={12} placeholder="Langkah, kriteria, format pengumpulan…" />
          </label>
          <div className="flex justify-end">
            <button type="button" className="lms-btn-primary" disabled={busy || isBaru} onClick={() => void simpanIsi()}>
              {busy ? 'Menyimpan…' : 'Simpan isi tugas'}
            </button>
          </div>
        </div>
      )}

      {/* —— Input nilai —— */}
      {tab === 'nilai' && (
        <div className="space-y-4">
          <div className="lms-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={subNilai === 'pengaturan-nilai'}
              className={`lms-tab ${subNilai === 'pengaturan-nilai' ? 'lms-tab--active' : ''}`}
              onClick={() => setSubNilai('pengaturan-nilai')}
            >
              Pengaturan penilaian
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subNilai === 'daftar-nilai'}
              className={`lms-tab ${subNilai === 'daftar-nilai' ? 'lms-tab--active' : ''}`}
              onClick={() => setSubNilai('daftar-nilai')}
            >
              Daftar nilai
            </button>
          </div>

          {subNilai === 'pengaturan-nilai' && (
            <div className="space-y-6">
              {/* Intro card */}
              <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4 sm:p-5">
                <h3 className="text-sm font-bold text-amber-950">Asesmen kinerja (rubrik)</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80">
                  Setiap <strong>kategori</strong> yang Anda buat di sini menjadi kolom skor di
                  Daftar nilai. Nilai rata-rata dihitung otomatis; nilai akhir mengikuti rata-rata
                  (bisa disesuaikan). Predikat mengikuti tabel rentang di bawah.
                </p>
              </div>

              {/* Kategori */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Kategori penilaian</h3>
                    <p className="text-xs text-muted">Aspek rubrik · contoh: tebal-tipis garis, tekstur, komposisi</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bisaAi && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                        disabled={genAiBusy}
                        onClick={() => void generateKategoriAi()}
                      >
                        <IconSparkle />
                        {genAiBusy ? 'Menghasilkan…' : 'Generate AI'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg bg-muh-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-muh-700"
                      onClick={tambahKategori}
                    >
                      + Tambah kategori
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {pengaturan.kategori.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                      <p className="text-sm font-medium text-slate-700">Belum ada kategori</p>
                      <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                        Tambah minimal satu aspek agar Daftar nilai menampilkan kolom skor per siswa.
                      </p>
                    </div>
                  )}
                  {pengaturan.kategori.map((k, idx) => (
                    <div
                      key={k.id}
                      className="group relative rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 transition hover:border-muh-200 hover:bg-white hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muh-100 text-[11px] font-bold text-muh-800">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Aspek rubrik</span>
                        <button
                          type="button"
                          className="ml-auto text-xs font-medium text-red-600 opacity-70 hover:opacity-100"
                          onClick={() => hapusKategori(k.id)}
                        >
                          Hapus
                        </button>
                      </div>
                      <input
                        className="lms-input w-full font-medium"
                        placeholder="Nama aspek (wajib)"
                        value={k.nama}
                        onChange={(e) => updateKategori(k.id, { nama: e.target.value })}
                      />
                      <input
                        className="lms-input mt-2 w-full text-sm"
                        placeholder="Indikator / deskripsi singkat (opsional)"
                        value={k.deskripsi || ''}
                        onChange={(e) => updateKategori(k.id, { deskripsi: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Rentang predikat */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Rentang nilai & predikat</h3>
                    <p className="text-xs text-muted">
                      Default KKM/KKTP 70 (C- = 70). {terkunci ? 'Terkunci — tidak bisa diubah.' : 'Buka kunci untuk mengedit.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        terkunci
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={toggleKunciRentang}
                      title={terkunci ? 'Buka kunci agar bisa diedit' : 'Kunci agar tidak berubah'}
                    >
                      <IconLock locked={terkunci} />
                      {terkunci ? 'Terkunci' : 'Kunci rentang'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      disabled={terkunci}
                      onClick={resetRentangDefault}
                    >
                      Reset default
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2.5 font-semibold">Predikat</th>
                        <th className="px-3 py-2.5 font-semibold">Min</th>
                        <th className="px-3 py-2.5 font-semibold">Max</th>
                        <th className="px-3 py-2.5 font-semibold">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pengaturan.rentangPredikat.map((r, i) => (
                        <tr
                          key={`${r.predikat}-${i}`}
                          className={`border-b border-slate-50 ${r.predikat === 'C-' ? 'bg-amber-50/50' : ''}`}
                        >
                          <td className="px-4 py-1.5">
                            <input
                              className="lms-input w-16 font-semibold disabled:bg-slate-50 disabled:text-slate-500"
                              value={r.predikat}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { predikat: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="lms-input w-[4.5rem] disabled:bg-slate-50"
                              value={r.min}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { min: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="lms-input w-[4.5rem] disabled:bg-slate-50"
                              value={r.max}
                              disabled={terkunci}
                              onChange={(e) => updateRentang(i, { max: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              className="lms-input w-full min-w-[160px] text-xs disabled:bg-slate-50"
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

              <label className="materi-field max-w-xl">
                <span>Catatan untuk guru (opsional)</span>
                <textarea
                  rows={2}
                  className="lms-input"
                  value={pengaturan.catatan || ''}
                  onChange={(e) => setPengaturan((p) => ({ ...p, catatan: e.target.value }))}
                  placeholder="Mis. fokus pada ketebalan garis dan tekstur…"
                />
              </label>

              <div className="flex justify-end sticky bottom-3">
                <button
                  type="button"
                  className="lms-btn-primary shadow-md"
                  disabled={busy || isBaru}
                  onClick={() => void simpanPengaturanNilai()}
                >
                  {busy ? 'Menyimpan…' : 'Simpan pengaturan penilaian'}
                </button>
              </div>
            </div>
          )}

          {subNilai === 'daftar-nilai' && (
            <div className="space-y-4">
              {isBaru && (
                <div className="lms-empty">
                  <p className="font-medium text-slate-700">Simpan pengaturan tugas dulu</p>
                </div>
              )}
              {!isBaru && (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Lembar nilai · Kelas {tugas?.kelas}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {kategoriAktif.length
                          ? `${kategoriAktif.length} kategori rubrik · rata-rata otomatis · nilai akhir 0–100`
                          : 'Belum ada kategori — isi nilai akhir saja, atau buat kategori di Pengaturan penilaian'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="lms-btn-secondary text-xs"
                        disabled={loadingNilai}
                        onClick={() => void muatNilai()}
                      >
                        {loadingNilai ? 'Memuat…' : 'Muat ulang'}
                      </button>
                      <button
                        type="button"
                        className="lms-btn-primary text-xs"
                        onClick={() => void sinkronKePenilaian()}
                      >
                        Sinkronkan ke Penilaian
                      </button>
                    </div>
                  </div>

                  {kategoriAktif.length === 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Belum ada kategori penilaian tersimpan. Anda tetap bisa mengisi nilai akhir.
                      Untuk kolom per aspek, buat kategori di tab <strong>Pengaturan penilaian</strong> lalu simpan.
                    </div>
                  )}

                  {loadingNilai && barisNilai === null && (
                    <div className="lms-empty">Memuat roster siswa…</div>
                  )}

                  {barisNilai && barisNilai.length === 0 && (
                    <div className="lms-empty">
                      <p className="font-medium text-slate-700">Tidak ada siswa aktif di kelas ini</p>
                    </div>
                  )}

                  {barisNilai && barisNilai.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 font-semibold">No</th>
                            <th className="sticky left-8 z-10 min-w-[140px] bg-slate-50 px-3 py-3 font-semibold">Nama siswa</th>
                            {kategoriAktif.map((k) => (
                              <th
                                key={k.id}
                                className="min-w-[88px] px-2 py-3 font-semibold text-muh-800"
                                title={k.deskripsi || k.nama}
                              >
                                <span className="line-clamp-2 normal-case tracking-normal">{k.nama}</span>
                              </th>
                            ))}
                            <th className="min-w-[72px] px-2 py-3 font-semibold">Rata-rata</th>
                            <th className="min-w-[72px] px-2 py-3 font-semibold">Nilai akhir</th>
                            <th className="min-w-[88px] px-2 py-3 font-semibold">Predikat</th>
                            {bisaAi && <th className="px-2 py-3 font-semibold">AI</th>}
                            <th className="min-w-[120px] px-2 py-3 font-semibold">Komentar</th>
                            <th className="px-3 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {barisNilai.map((r, i) => {
                            const d = draft[r.siswaId] || {
                              perKategori: {},
                              nilaiAkhir: '',
                              predikat: '',
                              komentar: '',
                            }
                            const angka: Record<string, number | null> = {}
                            for (const k of kategoriAktif) {
                              const s = d.perKategori[k.id] || ''
                              const n = Number(s.replace(',', '.'))
                              angka[k.id] = s.trim() === '' || Number.isNaN(n) ? null : n
                            }
                            const rataLive = hitungRataRata(angka, kategoriAktif)
                            return (
                              <tr
                                key={r.siswaId}
                                className="border-b border-slate-100 hover:bg-slate-50/80"
                              >
                                <td className="sticky left-0 bg-white px-3 py-2 text-muted tabular-nums">
                                  {i + 1}
                                </td>
                                <td className="sticky left-8 bg-white px-3 py-2 font-medium text-slate-800">
                                  {r.siswaNama}
                                  {r.sudahAda && (
                                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" title="Tersimpan" />
                                  )}
                                </td>
                                {kategoriAktif.map((k) => (
                                  <td key={k.id} className="px-2 py-1.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      className="lms-input w-[4.25rem] tabular-nums"
                                      value={d.perKategori[k.id] || ''}
                                      onChange={(e) => onSkorKategori(r.siswaId, k.id, e.target.value)}
                                      aria-label={`${k.nama} · ${r.siswaNama}`}
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-2 tabular-nums text-slate-600">
                                  {rataLive !== null ? rataLive : '—'}
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="lms-input w-[4.25rem] font-semibold tabular-nums"
                                    value={d.nilaiAkhir}
                                    onChange={(e) => onNilaiAkhirChange(r.siswaId, e.target.value)}
                                    aria-label={`Nilai akhir ${r.siswaNama}`}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  {bisaAi ? (
                                    <select
                                      className="lms-input w-[4.5rem] font-semibold"
                                      value={d.predikat}
                                      onChange={(e) =>
                                        patchDraft(r.siswaId, { predikat: e.target.value })
                                      }
                                      aria-label={`Predikat ${r.siswaNama}`}
                                    >
                                      <option value="">—</option>
                                      {daftarPredikat.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="inline-flex min-w-[2.5rem] justify-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                                      {d.predikat || '—'}
                                    </span>
                                  )}
                                </td>
                                {bisaAi && (
                                  <td className="px-2 py-1.5">
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center rounded-lg border border-violet-200 bg-violet-50 p-1.5 text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                                      title="Generate skor kategori dari predikat"
                                      disabled={!d.predikat}
                                      onClick={() => generateDariPredikat(r.siswaId)}
                                    >
                                      <IconSparkle />
                                    </button>
                                  </td>
                                )}
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    className="lms-input w-full min-w-[100px] text-xs"
                                    placeholder="…"
                                    value={d.komentar}
                                    onChange={(e) =>
                                      patchDraft(r.siswaId, { komentar: e.target.value })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <button
                                    type="button"
                                    className="rounded-lg bg-muh-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-muh-700 disabled:opacity-50"
                                    disabled={menyimpanSiswaId === r.siswaId}
                                    onClick={() => void simpanSatuNilai(r.siswaId, r.siswaNama)}
                                  >
                                    {menyimpanSiswaId === r.siswaId ? '…' : 'Simpan'}
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}

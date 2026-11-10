import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas, DAFTAR_KELAS_SD } from '../lib/kelasLms'
import { getTpMapelKelas } from '../lib/tpData'
import {
  ambilTugas,
  buatTugas,
  formatTenggat,
  updateTugas,
} from '../lib/tugas'
import { muatBarisNilaiTugas, simpanNilaiTugas, type BarisNilaiTugas } from '../lib/nilaiTugas'
import {
  bolehAiTugas,
  generateKategoriRubrikAi,
  nilaiDariPredikat,
  normalisasiPengaturan,
  pengaturanPenilaianDefault,
  predikatDariNilai,
  RENTANG_PREDIKAT_DEFAULT,
  validasiRentang,
} from '../lib/penilaianTugas'
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
  const [mapel, setMapel] = useState('')
  const [mapelLain, setMapelLain] = useState<string[]>([])
  const [deskripsi, setDeskripsi] = useState('')
  const [instruksi, setInstruksi] = useState('')
  const [tenggatStr, setTenggatStr] = useState('')
  const [aktif, setAktif] = useState(false)
  const [tpDipilih, setTpDipilih] = useState<TpTugas[]>([])
  const [tpOpsi, setTpOpsi] = useState<TpRingkas[]>([])
  const [pengaturan, setPengaturan] = useState<PengaturanPenilaianTugas>(pengaturanPenilaianDefault())

  const [barisNilai, setBarisNilai] = useState<BarisNilaiTugas[] | null>(null)
  const [loadingNilai, setLoadingNilai] = useState(false)
  const [draftNilai, setDraftNilai] = useState<
    Record<string, { nilai: string; predikat: string; komentar: string }>
  >({})
  const [menyimpanSiswaId, setMenyimpanSiswaId] = useState<string | null>(null)
  const [genAiBusy, setGenAiBusy] = useState(false)

  const ruang = useMemo(() => daftarRuangKelas(profil), [profil])
  const opsiKelas = useMemo(() => {
    const dariRuang = [...new Set(ruang.map((r) => r.kelas))]
    if (dariRuang.length) return dariRuang
    return [...DAFTAR_KELAS_SD]
  }, [ruang])
  const opsiMapel = useMemo(() => {
    if (!kelas) return [...new Set(ruang.map((r) => r.mapel))].sort()
    const m = ruang.filter((r) => r.kelas === kelas).map((r) => r.mapel)
    return [...new Set(m)].sort()
  }, [ruang, kelas])

  const isiFormDariTugas = useCallback((t: TugasLms) => {
    setJudul(t.judul)
    setJenis(t.jenis || 'mapel')
    setKelas(t.kelas)
    setMapel(t.mapel)
    setMapelLain(t.mapelLain || [])
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
    async function muat() {
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
    }
    void muat()
    return () => {
      batal = true
    }
  }, [tugasId, isBaru, isiFormDariTugas])

  useEffect(() => {
    if (!mapel || !kelas) {
      setTpOpsi([])
      return
    }
    let batal = false
    void getTpMapelKelas(mapel, kelas).then((list) => {
      if (!batal) setTpOpsi(list)
    })
    return () => {
      batal = true
    }
  }, [mapel, kelas])

  function toggleTp(tp: TpRingkas) {
    setTpDipilih((prev) => {
      const ada = prev.some((p) => p.id === tp.id)
      if (ada) return prev.filter((p) => p.id !== tp.id)
      return [
        ...prev,
        { id: tp.id, nomor: tp.nomorTp, nama: tp.namaTp, mapel: tp.mapel },
      ]
    })
  }

  function toggleMapelLain(m: string) {
    setMapelLain((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    )
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
    const errRentang = validasiRentang(pengaturan.rentangPredikat)
    if (errRentang) {
      setError(errRentang)
      return
    }
    setBusy(true)
    setError('')
    setSukses('')
    try {
      await updateTugas(tugasId, { pengaturanPenilaian: pengaturan })
      setSukses('Pengaturan penilaian disimpan.')
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
      const rows = await muatBarisNilaiTugas(tugas.id, tugas.kelas, tugas.mapel)
      const rentang = normalisasiPengaturan(tugas.pengaturanPenilaian).rentangPredikat
      setBarisNilai(rows)
      const draft: Record<string, { nilai: string; predikat: string; komentar: string }> = {}
      for (const r of rows) {
        let pred = r.predikat
        if (!pred && r.nilai !== null) {
          pred = predikatDariNilai(r.nilai, rentang)?.predikat || ''
        }
        draft[r.siswaId] = {
          nilai: r.nilai === null || r.nilai === undefined ? '' : String(r.nilai),
          predikat: pred,
          komentar: r.komentar || '',
        }
      }
      setDraftNilai(draft)
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

  function setDraftSiswa(
    siswaId: string,
    patch: Partial<{ nilai: string; predikat: string; komentar: string }>,
  ) {
    setDraftNilai((prev) => {
      const cur = prev[siswaId] || { nilai: '', predikat: '', komentar: '' }
      return { ...prev, [siswaId]: { ...cur, ...patch } }
    })
  }

  async function simpanSatuNilai(siswaId: string, siswaNama: string) {
    if (!tugas) return
    const d = draftNilai[siswaId]
    if (!d) return
    const raw = d.nilai.trim()
    if (raw === '') {
      setError(`Isi nilai untuk ${siswaNama} terlebih dahulu.`)
      return
    }
    const num = Number(raw.replace(',', '.'))
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setError(`Nilai untuk ${siswaNama} harus antara 0 dan 100.`)
      return
    }
    const rentang = pengaturan.rentangPredikat
    const pred =
      d.predikat || predikatDariNilai(num, rentang)?.predikat || ''
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
        nilai: num,
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

  /** Generate nilai angka dari predikat (AI-assist, hanya akun berwenang). */
  function generateNilaiDariPredikat(siswaId: string) {
    if (!bisaAi) return
    const d = draftNilai[siswaId]
    if (!d?.predikat) {
      setError('Pilih predikat dulu, lalu generate nilai.')
      return
    }
    const n = nilaiDariPredikat(d.predikat, pengaturan.rentangPredikat, 'acak')
    setDraftSiswa(siswaId, { nilai: String(n) })
    setSukses(`Nilai diusulkan: ${n} (predikat ${d.predikat}). Simpan untuk menyimpan.`)
  }

  function onNilaiChange(siswaId: string, nilaiStr: string) {
    const patch: { nilai: string; predikat?: string } = { nilai: nilaiStr }
    const num = Number(nilaiStr.replace(',', '.'))
    if (!Number.isNaN(num) && nilaiStr.trim() !== '') {
      const p = predikatDariNilai(num, pengaturan.rentangPredikat)
      if (p) patch.predikat = p.predikat
    }
    setDraftSiswa(siswaId, patch)
  }

  function onPredikatChange(siswaId: string, predikat: string) {
    setDraftSiswa(siswaId, { predikat })
  }

  function generateKategoriAi() {
    if (!bisaAi) return
    setGenAiBusy(true)
    setError('')
    try {
      const list = generateKategoriRubrikAi({
        judul,
        mapel,
        deskripsi,
        instruksi,
      })
      setPengaturan((p) => ({
        ...p,
        kategori: [...p.kategori, ...list.filter((k) => !p.kategori.some((x) => x.nama === k.nama))],
      }))
      setSukses(`${list.length} kategori rubrik diusulkan. Sesuaikan lalu simpan.`)
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
    setPengaturan((p) => ({
      ...p,
      rentangPredikat: p.rentangPredikat.map((r, idx) =>
        idx === i ? { ...r, ...patch } : r,
      ),
    }))
  }

  function resetRentangDefault() {
    setPengaturan((p) => ({
      ...p,
      rentangPredikat: RENTANG_PREDIKAT_DEFAULT.map((r) => ({ ...r })),
    }))
  }

  async function sinkronKePenilaian() {
    setError('')
    setSukses('')
    // Tombol siap di UI; CF sinkron akan dihubungkan kemudian (mirip sinkronNilaiKuisLms).
    setSukses(
      'Sinkron ke database Penilaian belum diaktifkan di server. Pastikan daftar nilai sudah tersimpan; fitur CF akan menyusul.',
    )
  }

  if (loading) {
    return <div className="lms-empty">Memuat tugas…</div>
  }

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

      {tab === 'pengaturan' && (
        <form onSubmit={(e) => void simpanPengaturan(e)} className="materi-form max-w-3xl space-y-4">
          <label className="materi-field">
            <span>Judul tugas</span>
            <input
              required
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Poster Hemat Energi"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="materi-field">
              <span>Jenis tugas</span>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value as JenisTugas)}
              >
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
                  setMapel('')
                  setTpDipilih([])
                }}
              >
                <option value="">— Pilih kelas —</option>
                {opsiKelas.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="materi-field">
            <span>{jenis === 'proyek' ? 'Mapel utama / penanggung jawab' : 'Mata pelajaran'}</span>
            <select
              required
              value={mapel}
              onChange={(e) => {
                setMapel(e.target.value)
                setTpDipilih([])
              }}
            >
              <option value="">— Pilih mapel —</option>
              {opsiMapel.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {jenis === 'proyek' && (
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-600">
                Mapel lain yang terlibat
              </legend>
              <div className="flex flex-wrap gap-2">
                {opsiMapel
                  .filter((m) => m !== mapel)
                  .map((m) => (
                    <label key={m} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={mapelLain.includes(m)}
                        onChange={() => toggleMapelLain(m)}
                      />
                      {m}
                    </label>
                  ))}
                {opsiMapel.filter((m) => m !== mapel).length === 0 && (
                  <span className="text-xs text-muted">Tidak ada mapel lain di penugasan kelas ini.</span>
                )}
              </div>
            </fieldset>
          )}

          <label className="materi-field">
            <span>Deskripsi singkat (opsional)</span>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={2}
              placeholder="Ringkasan untuk katalog dan siswa…"
            />
          </label>

          <label className="materi-field">
            <span>Tenggat (opsional)</span>
            <input
              type="datetime-local"
              value={tenggatStr}
              onChange={(e) => setTenggatStr(e.target.value)}
            />
          </label>

          <fieldset className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">
              Tujuan Pembelajaran (boleh lebih dari satu)
            </legend>
            {!mapel || !kelas ? (
              <p className="text-xs text-muted">Pilih kelas dan mapel dulu.</p>
            ) : tpOpsi.length === 0 ? (
              <p className="text-xs text-muted">Belum ada TP untuk mapel × kelas ini di data Penilaian.</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {tpOpsi.map((tp) => {
                  const checked = tpDipilih.some((p) => p.id === tp.id)
                  return (
                    <li key={tp.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleTp(tp)}
                        />
                        <span>
                          <span className="font-medium">TP {tp.nomorTp}</span>{' '}
                          <span className="text-slate-700">{tp.namaTp}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {tpDipilih.length > 0 && (
              <p className="mt-2 text-xs text-muted">{tpDipilih.length} TP dipilih</p>
            )}
          </fieldset>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
            />
            Aktifkan tugas (tampil untuk siswa)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Link to="/tugas" className="lms-btn-secondary">
              Batal
            </Link>
            <button type="submit" className="lms-btn-primary" disabled={busy}>
              {busy ? 'Menyimpan…' : isBaru ? 'Buat tugas' : 'Simpan pengaturan'}
            </button>
          </div>
        </form>
      )}

      {tab === 'isi' && (
        <div className="materi-form max-w-3xl space-y-4">
          <label className="materi-field">
            <span>Deskripsi singkat</span>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={2}
              placeholder="Ringkasan…"
            />
          </label>
          <label className="materi-field">
            <span>Instruksi lengkap untuk siswa</span>
            <textarea
              value={instruksi}
              onChange={(e) => setInstruksi(e.target.value)}
              rows={10}
              placeholder="Tuliskan langkah pengerjaan, kriteria, bahan yang dibutuhkan, format pengumpulan…"
            />
          </label>
          <p className="text-xs text-muted">
            Editor teks kaya akan ditambahkan kemudian. Untuk sekarang teks biasa / HTML sederhana.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="lms-btn-primary"
              disabled={busy || isBaru}
              onClick={() => void simpanIsi()}
            >
              {busy ? 'Menyimpan…' : 'Simpan isi tugas'}
            </button>
          </div>
        </div>
      )}

      {tab === 'nilai' && (
        <div className="space-y-4">
          <div className="lms-tabs" role="tablist" aria-label="Sub tab nilai">
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
            <div className="space-y-6 max-w-3xl">
              <p className="text-sm text-muted">
                Tugas biasanya asesmen <strong>kinerja</strong>. Atur kategori rubrik dan tabel
                predikat (default KKM/KKTP 70). Skala nilai selalu 0–100.
              </p>

              {/* Kategori rubrik */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Kategori penilaian (rubrik)</h3>
                  <div className="flex flex-wrap gap-2">
                    {bisaAi && (
                      <button
                        type="button"
                        className="lms-btn-secondary text-xs"
                        disabled={genAiBusy}
                        onClick={generateKategoriAi}
                      >
                        {genAiBusy ? 'Menghasilkan…' : 'Generate kategori (AI)'}
                      </button>
                    )}
                    <button type="button" className="lms-btn-primary text-xs" onClick={tambahKategori}>
                      + Kategori
                    </button>
                  </div>
                </div>
                {pengaturan.kategori.length === 0 && (
                  <p className="text-xs text-muted">
                    Belum ada kategori. Contoh: «Tebal-tipis garis», «Tekstur», «Komposisi».
                  </p>
                )}
                <ul className="space-y-2">
                  {pengaturan.kategori.map((k) => (
                    <li
                      key={k.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
                    >
                      <div className="flex gap-2">
                        <input
                          className="lms-input flex-1"
                          placeholder="Nama kategori / aspek"
                          value={k.nama}
                          onChange={(e) => updateKategori(k.id, { nama: e.target.value })}
                        />
                        <button
                          type="button"
                          className="materi-btn-danger text-xs shrink-0"
                          onClick={() => hapusKategori(k.id)}
                        >
                          Hapus
                        </button>
                      </div>
                      <input
                        className="lms-input w-full text-sm"
                        placeholder="Deskripsi / indikator (opsional)"
                        value={k.deskripsi || ''}
                        onChange={(e) => updateKategori(k.id, { deskripsi: e.target.value })}
                      />
                    </li>
                  ))}
                </ul>
              </section>

              {/* Rentang predikat */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Rentang nilai & predikat (skala 0–100)
                  </h3>
                  <button type="button" className="lms-btn-ghost text-xs" onClick={resetRentangDefault}>
                    Kembalikan default KKM 70
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Predikat</th>
                        <th className="px-3 py-2">Min</th>
                        <th className="px-3 py-2">Max</th>
                        <th className="px-3 py-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pengaturan.rentangPredikat.map((r, i) => (
                        <tr key={`${r.predikat}-${i}`} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">
                            <input
                              className="lms-input w-16"
                              value={r.predikat}
                              onChange={(e) => updateRentang(i, { predikat: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="lms-input w-20"
                              value={r.min}
                              onChange={(e) =>
                                updateRentang(i, { min: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="lms-input w-20"
                              value={r.max}
                              onChange={(e) =>
                                updateRentang(i, { max: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              className="lms-input w-full min-w-[140px]"
                              value={r.keterangan || ''}
                              onChange={(e) =>
                                updateRentang(i, { keterangan: e.target.value })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted">
                  Default: C- mulai 70 (batas KKM/KKTP). Sesuaikan bila perlu analisis ketuntasan kelas.
                </p>
              </section>

              <label className="materi-field max-w-xl">
                <span>Catatan penilaian (opsional)</span>
                <textarea
                  rows={2}
                  value={pengaturan.catatan || ''}
                  onChange={(e) =>
                    setPengaturan((p) => ({ ...p, catatan: e.target.value }))
                  }
                  placeholder="Catatan rubrik untuk guru…"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="lms-btn-primary"
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
                  <p className="mt-1">Setelah tugas tersimpan, daftar siswa dapat diisi nilainya.</p>
                </div>
              )}
              {!isBaru && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      Kelas {tugas?.kelas} · skala 0–100 · predikat mengikuti tabel di Pengaturan penilaian
                    </p>
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

                  {loadingNilai && barisNilai === null && (
                    <div className="lms-empty">Memuat daftar siswa…</div>
                  )}

                  {barisNilai && barisNilai.length === 0 && (
                    <div className="lms-empty">
                      <p className="font-medium text-slate-700">Tidak ada siswa di kelas ini</p>
                    </div>
                  )}

                  {barisNilai && barisNilai.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                          <tr>
                            <th className="px-3 py-2">No</th>
                            <th className="px-3 py-2">Nama</th>
                            <th className="px-3 py-2">Predikat</th>
                            <th className="px-3 py-2">Nilai</th>
                            {bisaAi && <th className="px-3 py-2">AI</th>}
                            <th className="px-3 py-2">Komentar</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {barisNilai.map((r, i) => {
                            const d = draftNilai[r.siswaId] || {
                              nilai: '',
                              predikat: '',
                              komentar: '',
                            }
                            return (
                              <tr key={r.siswaId} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-muted">{i + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {r.siswaNama}
                                  {r.sudahAda && (
                                    <span className="ml-1 text-[10px] font-normal text-emerald-700">
                                      tersimpan
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    className="lms-input w-24"
                                    value={d.predikat}
                                    onChange={(e) =>
                                      onPredikatChange(r.siswaId, e.target.value)
                                    }
                                    aria-label={`Predikat ${r.siswaNama}`}
                                  >
                                    <option value="">—</option>
                                    {daftarPredikat.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="1"
                                    className="lms-input w-20"
                                    value={d.nilai}
                                    onChange={(e) => onNilaiChange(r.siswaId, e.target.value)}
                                    aria-label={`Nilai ${r.siswaNama}`}
                                  />
                                </td>
                                {bisaAi && (
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      className="lms-btn-ghost text-xs"
                                      title="Generate nilai dari predikat"
                                      disabled={!d.predikat}
                                      onClick={() => generateNilaiDariPredikat(r.siswaId)}
                                    >
                                      Gen
                                    </button>
                                  </td>
                                )}
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    className="lms-input w-full min-w-[100px]"
                                    placeholder="Opsional"
                                    value={d.komentar}
                                    onChange={(e) =>
                                      setDraftSiswa(r.siswaId, { komentar: e.target.value })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    className="lms-btn-primary text-xs"
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

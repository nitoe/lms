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
import type { JenisTugas, PengaturanPenilaianTugas, TpTugas, TugasLms } from '../types/tugas'
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

export default function TugasDetail() {
  const { tugasId = '' } = useParams()
  const isBaru = tugasId === 'baru' || !tugasId
  const navigate = useNavigate()
  const { profil } = useAuth()

  const [tab, setTab] = useState<TabId>('pengaturan')
  const [subNilai, setSubNilai] = useState<SubNilai>('pengaturan-nilai')
  const [loading, setLoading] = useState(!isBaru)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState('')
  const [tugas, setTugas] = useState<TugasLms | null>(null)

  // Form state
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
  const [pengaturan, setPengaturan] = useState<PengaturanPenilaianTugas>({
    skalaMaks: 100,
    sinkronKePenilaian: false,
  })

  // Input nilai manual
  const [barisNilai, setBarisNilai] = useState<BarisNilaiTugas[] | null>(null)
  const [loadingNilai, setLoadingNilai] = useState(false)
  const [draftNilai, setDraftNilai] = useState<Record<string, { nilai: string; komentar: string }>>({})
  const [menyimpanSiswaId, setMenyimpanSiswaId] = useState<string | null>(null)

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
    setPengaturan(
      t.pengaturanPenilaian || { skalaMaks: 100, sinkronKePenilaian: false },
    )
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

  // Muat opsi TP saat mapel + kelas berubah
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
    setBusy(true)
    setError('')
    setSukses('')
    try {
      await updateTugas(tugasId, { pengaturanPenilaian: pengaturan })
      setSukses('Pengaturan penilaian disimpan.')
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
      setBarisNilai(rows)
      const draft: Record<string, { nilai: string; komentar: string }> = {}
      for (const r of rows) {
        draft[r.siswaId] = {
          nilai: r.nilai === null || r.nilai === undefined ? '' : String(r.nilai),
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
    if (Number.isNaN(num)) {
      setError(`Nilai untuk ${siswaNama} tidak valid.`)
      return
    }
    const maks = pengaturan.skalaMaks ?? 100
    if (num < 0 || num > maks) {
      setError(`Nilai untuk ${siswaNama} harus antara 0 dan ${maks}.`)
      return
    }
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

      {/* ===== TAB PENGATURAN ===== */}
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

      {/* ===== TAB ISI TUGAS ===== */}
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
            Editor teks kaya (format tebal, daftar, gambar) akan ditambahkan pada iterasi berikutnya.
            Untuk sekarang gunakan teks biasa atau HTML sederhana.
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

      {/* ===== TAB INPUT NILAI ===== */}
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
            <div className="materi-form max-w-xl space-y-4">
              <label className="materi-field">
                <span>Skala maksimal</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={pengaturan.skalaMaks ?? 100}
                  onChange={(e) =>
                    setPengaturan((p) => ({
                      ...p,
                      skalaMaks: Number(e.target.value) || 100,
                    }))
                  }
                />
              </label>
              <label className="materi-field">
                <span>Bobot terhadap mapel (opsional, 0–100)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pengaturan.bobot ?? ''}
                  onChange={(e) =>
                    setPengaturan((p) => ({
                      ...p,
                      bobot: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  placeholder="Contoh: 20"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pengaturan.sinkronKePenilaian === true}
                  onChange={(e) =>
                    setPengaturan((p) => ({
                      ...p,
                      sinkronKePenilaian: e.target.checked,
                    }))
                  }
                />
                Sinkronkan nilai ke database Penilaian (SDM01Penilaian)
              </label>
              <label className="materi-field">
                <span>Catatan penilaian (opsional)</span>
                <textarea
                  rows={2}
                  value={pengaturan.catatan || ''}
                  onChange={(e) =>
                    setPengaturan((p) => ({ ...p, catatan: e.target.value }))
                  }
                  placeholder="Rubrik singkat, kriteria ketuntasan…"
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
                  <p className="mt-1">Setelah tugas tersimpan, daftar siswa kelas dapat diisi nilainya di sini.</p>
                </div>
              )}
              {!isBaru && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      Input nilai manual untuk kelas {tugas?.kelas}. Skala 0–{pengaturan.skalaMaks ?? 100}.
                      {pengaturan.sinkronKePenilaian
                        ? ' Sinkron ke Penilaian: aktif (akan dihubungkan kemudian).'
                        : ''}
                    </p>
                    <button
                      type="button"
                      className="lms-btn-secondary text-xs"
                      disabled={loadingNilai}
                      onClick={() => void muatNilai()}
                    >
                      {loadingNilai ? 'Memuat…' : 'Muat ulang'}
                    </button>
                  </div>

                  {loadingNilai && barisNilai === null && (
                    <div className="lms-empty">Memuat daftar siswa…</div>
                  )}

                  {barisNilai && barisNilai.length === 0 && (
                    <div className="lms-empty">
                      <p className="font-medium text-slate-700">Tidak ada siswa di kelas ini</p>
                      <p className="mt-1">Pastikan data siswa aktif sudah ada di koleksi siswa untuk kelas {tugas?.kelas}.</p>
                    </div>
                  )}

                  {barisNilai && barisNilai.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold">No</th>
                            <th className="px-3 py-2 font-semibold">Nama</th>
                            <th className="px-3 py-2 font-semibold w-28">Nilai</th>
                            <th className="px-3 py-2 font-semibold">Komentar</th>
                            <th className="px-3 py-2 font-semibold w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {barisNilai.map((r, i) => {
                            const d = draftNilai[r.siswaId] || { nilai: '', komentar: '' }
                            return (
                              <tr key={r.siswaId} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-muted">{i + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {r.siswaNama}
                                  {r.sudahAda && (
                                    <span className="ml-1 text-[10px] font-normal text-emerald-700">tersimpan</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={pengaturan.skalaMaks ?? 100}
                                    step="0.1"
                                    className="lms-input w-24"
                                    value={d.nilai}
                                    onChange={(e) =>
                                      setDraftNilai((prev) => ({
                                        ...prev,
                                        [r.siswaId]: { ...d, nilai: e.target.value },
                                      }))
                                    }
                                    aria-label={`Nilai ${r.siswaNama}`}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    className="lms-input w-full min-w-[120px]"
                                    placeholder="Opsional"
                                    value={d.komentar}
                                    onChange={(e) =>
                                      setDraftNilai((prev) => ({
                                        ...prev,
                                        [r.siswaId]: { ...d, komentar: e.target.value },
                                      }))
                                    }
                                    aria-label={`Komentar ${r.siswaNama}`}
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

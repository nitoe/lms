import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { aturBerbagiMateri, daftarMateri, hapusMateri, tambahMateri } from '../lib/materi'
import BerbagiKelasDialog from './BerbagiKelasDialog'
import { labelKelasDibagikan } from '../lib/kelasLms'
import { getTpMapelKelas } from '../lib/tpData'
import type { MateriLms } from '../types/materi'
import type { TpRingkas } from '../types/materi'
import MateriHalamanEditor from './materi/MateriHalamanEditor'
import MateriHalamanViewer from './materi/MateriHalamanViewer'
import { jumlahHalaman } from '../lib/materiUi'

type Props = {
  kelas: string
  mapel: string
}

type ModeForm = 'tutup' | 'file' | 'youtube' | 'tautan' | 'halaman'

function labelJenis(jenis: string): string {
  switch (jenis) {
    case 'pdf':
      return 'PDF'
    case 'gambar':
      return 'Gambar'
    case 'video':
      return 'Video'
    case 'youtube':
      return 'YouTube'
    case 'halaman':
      return 'Halaman'
    default:
      return 'Tautan'
  }
}

function formatUkuran(n?: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function JenisIcon({ jenis }: { jenis: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (jenis) {
    case 'pdf':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      )
    case 'gambar':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'video':
    case 'youtube':
      return (
        <svg {...common}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )
    case 'halaman':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )
  }
}

function toneJenis(jenis: string): string {
  switch (jenis) {
    case 'pdf':
      return 'materi-tone--pdf'
    case 'gambar':
      return 'materi-tone--img'
    case 'video':
      return 'materi-tone--vid'
    case 'youtube':
      return 'materi-tone--yt'
    case 'halaman':
      return 'materi-tone--hal'
    default:
      return 'materi-tone--url'
  }
}

export default function MateriPanel({ kelas, mapel }: Props) {
  const { profil } = useAuth()
  const [list, setList] = useState<MateriLms[] | null>(null)
  const [tpList, setTpList] = useState<TpRingkas[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<ModeForm>('tutup')
  const [q, setQ] = useState('')

  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [bab, setBab] = useState('')
  const [tpId, setTpId] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  /** Materi halaman yang sedang diedit (null = buat baru). */
  const [editHalaman, setEditHalaman] = useState<MateriLms | null | undefined>(undefined)
  /** Materi halaman yang dibuka pratinjau/baca di panel guru. */
  const [bacaHalaman, setBacaHalaman] = useState<MateriLms | null>(null)
  const [berbagiTarget, setBerbagiTarget] = useState<MateriLms | null>(null)

  const muat = useCallback(async () => {
    setError('')
    try {
      const [m, tp] = await Promise.all([
        daftarMateri(kelas, mapel),
        getTpMapelKelas(mapel, kelas),
      ])
      setList(m)
      setTpList(tp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat materi.')
      setList([])
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  const filtered = useMemo(() => {
    if (!list) return []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(
      (m) =>
        m.judul.toLowerCase().includes(s) ||
        (m.deskripsi && m.deskripsi.toLowerCase().includes(s)) ||
        (m.tpNama && m.tpNama.toLowerCase().includes(s)) ||
        (m.bab && m.bab.toLowerCase().includes(s)) ||
        (m.fileName && m.fileName.toLowerCase().includes(s)),
    )
  }, [list, q])

  const kelompok = useMemo(() => {
    const map = new Map<string, MateriLms[]>()
    for (const m of filtered) {
      const key =
        m.tpId && m.tpNama
          ? `tp:${m.tpId}`
          : m.bab
            ? `bab:${m.bab}`
            : 'lain'
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    const out: { key: string; label: string; items: MateriLms[] }[] = []
    for (const [key, items] of map) {
      let label = 'Lainnya'
      if (key.startsWith('tp:')) {
        const first = items[0]
        label = first.tpNomor
          ? `TP ${first.tpNomor}. ${first.tpNama || ''}`.trim()
          : first.tpNama || 'Tujuan Pembelajaran'
      } else if (key.startsWith('bab:')) {
        label = key.slice(4)
      }
      out.push({ key, label, items })
    }
    out.sort((a, b) => {
      if (a.key === 'lain') return 1
      if (b.key === 'lain') return -1
      return a.label.localeCompare(b.label, 'id')
    })
    return out
  }, [filtered])

  function resetForm() {
    setJudul('')
    setDeskripsi('')
    setBab('')
    setTpId('')
    setUrl('')
    setFile(null)
    setMode('tutup')
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!mapel || mapel === 'Wali kelas') {
        throw new Error('Pilih ruang kelas dengan mata pelajaran yang valid, bukan «Wali kelas».')
      }
      const tp = tpList.find((t) => t.id === tpId)
      if (!tp) {
        throw new Error(
          'Tujuan Pembelajaran wajib dipilih. Buat TP di aplikasi Penilaian jika daftar kosong.',
        )
      }
      await tambahMateri({
        kelas,
        mapel,
        judul,
        deskripsi: deskripsi || undefined,
        bab: bab || undefined,
        tpId: tp?.id,
        tpNomor: tp?.nomorTp,
        tpNama: tp?.namaTp,
        file: mode === 'file' ? file || undefined : undefined,
        url: mode === 'youtube' || mode === 'tautan' ? url : undefined,
        jenisTautan: mode === 'youtube' ? 'youtube' : mode === 'tautan' ? 'tautan' : undefined,
        namaGuru: profil?.nama,
      })
      resetForm()
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan materi.')
    } finally {
      setBusy(false)
    }
  }

  async function onHapus(m: MateriLms) {
    if (!confirm(`Hapus materi «${m.judul}»?`)) return
    setBusy(true)
    setError('')
    try {
      await hapusMateri(m)
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  const jumlah = list?.length ?? 0

  if (editHalaman !== undefined) {
    return (
      <MateriHalamanEditor
        kelas={kelas}
        mapel={mapel}
        tpList={tpList}
        namaGuru={profil?.nama}
        materiAwal={editHalaman}
        onBatal={() => setEditHalaman(undefined)}
        onSelesai={() => {
          setEditHalaman(undefined)
          void muat()
        }}
      />
    )
  }

  if (bacaHalaman) {
    return (
      <MateriHalamanViewer
        materi={bacaHalaman}
        mode="guru"
        onTutup={() => setBacaHalaman(null)}
      />
    )
  }

  return (
    <div className="materi-panel space-y-4">
      {/* Toolbar ala referensi LMS */}
      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="lms-count-pill">
            {list === null ? '…' : `${filtered.length}${q ? ` / ${jumlah}` : ''} materi`}
          </span>
          <div className="lms-search" style={{ maxWidth: '16rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
            <input
              type="search"
              placeholder="Cari materi atau TP…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari materi"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={tpList.length === 0}
            title={tpList.length === 0 ? 'Buat TP di Penilaian terlebih dahulu' : undefined}
            className={`lms-btn-primary ${mode === 'file' ? 'ring-2 ring-muh-300' : ''}`}
            onClick={() => setMode(mode === 'file' ? 'tutup' : 'file')}
          >
            + File
          </button>
          <button
            type="button"
            disabled={tpList.length === 0}
            className={`lms-btn-secondary ${mode === 'youtube' ? 'ring-2 ring-muh-300' : ''}`}
            onClick={() => setMode(mode === 'youtube' ? 'tutup' : 'youtube')}
          >
            YouTube
          </button>
          <button
            type="button"
            disabled={tpList.length === 0}
            className={`lms-btn-secondary ${mode === 'tautan' ? 'ring-2 ring-muh-300' : ''}`}
            onClick={() => setMode(mode === 'tautan' ? 'tutup' : 'tautan')}
          >
            Tautan
          </button>
          <button
            type="button"
            disabled={tpList.length === 0}
            title={tpList.length === 0 ? 'Buat TP di Penilaian terlebih dahulu' : 'Buat materi multi-halaman (teks + gambar)'}
            className="lms-btn-primary"
            onClick={() => {
              setMode('tutup')
              setEditHalaman(null)
            }}
          >
            + Halaman
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Form tambah */}
      {mode !== 'tutup' && (
        <form onSubmit={(e) => void simpan(e)} className="materi-form">
          <div className="materi-form-head">
            <h3 className="text-sm font-semibold text-slate-900">
              {mode === 'file' && 'Unggah file materi'}
              {mode === 'youtube' && 'Tambah video YouTube'}
              {mode === 'tautan' && 'Tambah tautan'}
            </h3>
            <button type="button" className="lms-btn-ghost" onClick={resetForm}>
              Batal
            </button>
          </div>

          <div className="materi-form-grid">
            <label className="materi-field">
              <span>Judul</span>
              <input
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Latihan perkalian"
              />
            </label>
            <label className="materi-field">
              <span>Bab / unit (opsional)</span>
              <input
                value={bab}
                onChange={(e) => setBab(e.target.value)}
                placeholder="Otomatis dari TP bila kosong"
              />
            </label>
            <label className="materi-field materi-field--full">
              <span>Deskripsi (opsional)</span>
              <textarea
                rows={2}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Petunjuk singkat untuk siswa"
              />
            </label>

            {mode === 'file' && (
              <label className="materi-field materi-field--full">
                <span>File (PDF / gambar / video)</span>
                <input
                  type="file"
                  required
                  accept=".pdf,image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <span className="materi-hint">PDF & gambar max 10 MB · video max 50 MB</span>
              </label>
            )}
            {(mode === 'youtube' || mode === 'tautan') && (
              <label className="materi-field materi-field--full">
                <span>{mode === 'youtube' ? 'URL YouTube' : 'URL tautan'}</span>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    mode === 'youtube'
                      ? 'https://www.youtube.com/watch?v=…'
                      : 'https://…'
                  }
                />
              </label>
            )}
          </div>

          <div className="materi-tp-block">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Tujuan Pembelajaran <span className="text-red-600">*</span>
              </span>
              {tpId && (
                <span className="text-[11px] font-medium text-muh-700">
                  Terpilih: TP {tpList.find((x) => x.id === tpId)?.nomorTp ?? '—'}
                </span>
              )}
            </div>
            {tpList.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                Belum ada TP di Penilaian untuk <strong>{mapel}</strong> · {kelas}. Buat TP di
                aplikasi Penilaian (Setup TP) sebelum menambah materi.
              </div>
            ) : (
              <div
                role="listbox"
                aria-label="Pilih Tujuan Pembelajaran"
                className="materi-tp-list"
              >
                {tpList.map((t) => {
                  const aktif = tpId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={aktif}
                      onClick={() => {
                        setTpId(t.id)
                        if (!bab) setBab(`TP ${t.nomorTp}`)
                      }}
                      className={`materi-tp-item ${aktif ? 'materi-tp-item--on' : ''}`}
                    >
                      <span className={`materi-tp-num ${aktif ? 'materi-tp-num--on' : ''}`}>
                        {t.nomorTp}
                      </span>
                      <span className="text-[13px] leading-snug">{t.namaTp}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <input type="hidden" value={tpId} required readOnly />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="lms-btn-secondary" onClick={resetForm} disabled={busy}>
              Batal
            </button>
            <button type="submit" className="lms-btn-primary" disabled={busy || !tpId}>
              {busy ? 'Menyimpan…' : 'Simpan materi'}
            </button>
          </div>
        </form>
      )}

      {list === null && (
        <div className="lms-empty">Memuat materi…</div>
      )}

      {list && list.length === 0 && mode === 'tutup' && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada materi</p>
          <p className="mt-1">
            Buat materi halaman (teks + gambar), unggah file, YouTube, atau tautan — lalu hubungkan ke Tujuan Pembelajaran.
          </p>
        </div>
      )}

      {list && list.length > 0 && filtered.length === 0 && (
        <div className="lms-empty">Tidak ada materi yang cocok dengan &ldquo;{q}&rdquo;.</div>
      )}

      {kelompok.map((g) => (
        <section key={g.key} className="materi-group">
          <h3 className="materi-group-title">{g.label}</h3>
          <ul className="materi-list">
            {g.items.map((m) => (
              <li key={m.id} className="materi-item">
                <div className={`materi-item-icon ${toneJenis(m.jenis)}`} aria-hidden>
                  <JenisIcon jenis={m.jenis} />
                </div>
                <div className="materi-item-body">
                  <div className="materi-item-title">{m.judul}</div>
                  {m.deskripsi && (
                    <p className="materi-item-desc">{m.deskripsi}</p>
                  )}
                  <div className="materi-item-meta">
                    <span className="materi-jenis-chip">{labelJenis(m.jenis)}</span>
                    {m.jenis === 'halaman' && (
                      <span>{jumlahHalaman(m)} halaman</span>
                    )}
                    {m.fileName && <span>{m.fileName}</span>}
                    {m.ukuran ? <span>{formatUkuran(m.ukuran)}</span> : null}
                    {m.dibuatOlehNama && <span>{m.dibuatOlehNama}</span>}
                    {String(m.kelas || '').toUpperCase() !== String(kelas).toUpperCase() && (
                      <span className="materi-jenis-chip" title="Materi dari kelas lain">Dari {m.kelas}</span>
                    )}
                    {labelKelasDibagikan(m.kelas, m.kelasList) && String(m.kelas || '').toUpperCase() === String(kelas).toUpperCase() && (
                      <span className="materi-jenis-chip" title="Dibagikan ke kelas paralel">
                        Dibagikan · {labelKelasDibagikan(m.kelas, m.kelasList)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="materi-item-actions">
                  {m.jenis === 'halaman' ? (
                    <>
                      <button
                        type="button"
                        className="lms-btn-secondary"
                        onClick={() => setBacaHalaman(m)}
                      >
                        Baca
                      </button>
                      <button
                        type="button"
                        className="lms-btn-secondary"
                        onClick={() => setEditHalaman(m)}
                      >
                        Edit
                      </button>
                    </>
                  ) : m.url ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="lms-btn-secondary"
                    >
                      Buka
                    </a>
                  ) : null}
                  {String(m.kelas || '').toUpperCase() === String(kelas).toUpperCase() && (
                    <button
                      type="button"
                      className="lms-btn-secondary"
                      disabled={busy}
                      onClick={() => setBerbagiTarget(m)}
                    >
                      Bagikan
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onHapus(m)}
                    className="materi-btn-danger"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <BerbagiKelasDialog
        open={!!berbagiTarget}
        judulItem={berbagiTarget?.judul || ''}
        jenis="materi"
        kelasUtama={berbagiTarget?.kelas || kelas}
        mapel={mapel}
        kelasListSaatIni={berbagiTarget?.kelasList}
        profil={profil}
        busy={busy}
        onBatal={() => setBerbagiTarget(null)}
        onSimpan={async (list) => {
          if (!berbagiTarget) return
          setBusy(true)
          setError('')
          try {
            await aturBerbagiMateri(berbagiTarget.id, berbagiTarget.kelas, list)
            setBerbagiTarget(null)
            await muat()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengatur berbagi.')
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

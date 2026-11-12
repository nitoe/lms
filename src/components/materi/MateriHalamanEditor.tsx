import { useCallback, useMemo, useRef, useState } from 'react'
import {
  bersihkanGambarYatim,
  halamanKosong,
  idBaru,
  simpanMateriHalaman,
  tambahMateriHalaman,
  unggahGambarHalaman,
} from '../../lib/materi'
import type { MateriBlok, MateriHalaman, MateriLms, TpRingkas } from '../../types/materi'
import {
  BATAS_BLOK_PER_HALAMAN,
  BATAS_HALAMAN_PER_MATERI,
  BATAS_UKURAN,
} from '../../types/materi'
import MateriRichEditor from './MateriRichEditor'
import MateriHalamanViewer from './MateriHalamanViewer'

type Props = {
  kelas: string
  mapel: string
  tpList: TpRingkas[]
  namaGuru?: string
  /** null = buat baru */
  materiAwal: MateriLms | null
  onSelesai: () => void
  onBatal: () => void
}

type Meta = {
  judul: string
  deskripsi: string
  bab: string
  tpId: string
}

function salinHalaman(list: MateriHalaman[]): MateriHalaman[] {
  return list.map((h, i) => ({
    id: h.id || idBaru('h'),
    judul: h.judul || '',
    urutan: typeof h.urutan === 'number' ? h.urutan : i,
    blok: (h.blok || []).map((b) => {
      if (b.tipe === 'teks') {
        return { id: b.id || idBaru('b'), tipe: 'teks' as const, html: b.html || '' }
      }
      return {
        id: b.id || idBaru('b'),
        tipe: 'gambar' as const,
        url: b.url,
        storagePath: b.storagePath,
        alt: b.alt,
        caption: b.caption,
      }
    }),
  }))
}

/**
 * Editor materi multi-halaman (V1: blok teks + gambar).
 * Sidebar halaman + editor blok berurutan + pratinjau.
 */
export default function MateriHalamanEditor({
  kelas,
  mapel,
  tpList,
  namaGuru,
  materiAwal,
  onSelesai,
  onBatal,
}: Props) {
  const [meta, setMeta] = useState<Meta>(() => ({
    judul: materiAwal?.judul || '',
    deskripsi: materiAwal?.deskripsi || '',
    bab: materiAwal?.bab || '',
    tpId: materiAwal?.tpId || '',
  }))
  const [halaman, setHalaman] = useState<MateriHalaman[]>(() => {
    if (materiAwal?.halaman?.length) return salinHalaman(materiAwal.halaman)
    return [halamanKosong(0)]
  })
  const [aktifIdx, setAktifIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'edit' | 'pratinjau'>('edit')
  const fileRef = useRef<HTMLInputElement>(null)
  const [unggahUntukBlok, setUnggahUntukBlok] = useState<string | null>(null)

  const aktif = halaman[aktifIdx] ?? halaman[0]

  const updateAktif = useCallback(
    (fn: (h: MateriHalaman) => MateriHalaman) => {
      setHalaman((prev) => {
        const i = Math.max(0, Math.min(aktifIdx, prev.length - 1))
        return prev.map((h, idx) => (idx === i ? fn(h) : h))
      })
    },
    [aktifIdx],
  )

  function tambahHalaman() {
    if (halaman.length >= BATAS_HALAMAN_PER_MATERI) {
      setError(`Maksimal ${BATAS_HALAMAN_PER_MATERI} halaman.`)
      return
    }
    setError('')
    const baru = halamanKosong(halaman.length)
    setHalaman((prev) => [...prev, baru])
    setAktifIdx(halaman.length)
  }

  function hapusHalaman(idx: number) {
    if (halaman.length <= 1) {
      setError('Minimal satu halaman.')
      return
    }
    if (!confirm(`Hapus halaman ${idx + 1}?`)) return
    setHalaman((prev) => {
      const next = prev.filter((_, i) => i !== idx).map((h, i) => ({ ...h, urutan: i }))
      return next
    })
    setAktifIdx((i) => Math.max(0, Math.min(i, halaman.length - 2)))
  }

  function pindahHalaman(idx: number, arah: -1 | 1) {
    const target = idx + arah
    if (target < 0 || target >= halaman.length) return
    setHalaman((prev) => {
      const next = [...prev]
      const tmp = next[idx]
      next[idx] = next[target]
      next[target] = tmp
      return next.map((h, i) => ({ ...h, urutan: i }))
    })
    setAktifIdx(target)
  }

  function setJudulHalaman(judul: string) {
    updateAktif((h) => ({ ...h, judul }))
  }

  function updateBlok(blokId: string, patch: Partial<MateriBlok>) {
    updateAktif((h) => ({
      ...h,
      blok: h.blok.map((b) => {
        if (b.id !== blokId) return b
        if (b.tipe === 'teks' && (patch as { html?: string }).html !== undefined) {
          return { ...b, html: (patch as { html: string }).html }
        }
        if (b.tipe === 'gambar') {
          return { ...b, ...patch } as MateriBlok
        }
        return b
      }),
    }))
  }

  function tambahBlokTeks() {
    if (!aktif) return
    if (aktif.blok.length >= BATAS_BLOK_PER_HALAMAN) {
      setError(`Maksimal ${BATAS_BLOK_PER_HALAMAN} blok per halaman.`)
      return
    }
    setError('')
    updateAktif((h) => ({
      ...h,
      blok: [...h.blok, { id: idBaru('b'), tipe: 'teks', html: '' }],
    }))
  }

  function mulaiUnggahGambar() {
    if (!aktif) return
    if (aktif.blok.length >= BATAS_BLOK_PER_HALAMAN) {
      setError(`Maksimal ${BATAS_BLOK_PER_HALAMAN} blok per halaman.`)
      return
    }
    setUnggahUntukBlok(null)
    fileRef.current?.click()
  }

  async function onFileGambar(file: File | null) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const { url, storagePath } = await unggahGambarHalaman(kelas, file)
      const blokBaru: MateriBlok = {
        id: idBaru('b'),
        tipe: 'gambar',
        url,
        storagePath,
        alt: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
      }
      if (unggahUntukBlok) {
        updateAktif((h) => ({
          ...h,
          blok: h.blok.map((b) =>
            b.id === unggahUntukBlok && b.tipe === 'gambar'
              ? { ...b, url, storagePath, alt: b.alt || blokBaru.alt }
              : b,
          ),
        }))
      } else {
        updateAktif((h) => ({ ...h, blok: [...h.blok, blokBaru] }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah gambar.')
    } finally {
      setBusy(false)
      setUnggahUntukBlok(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function hapusBlok(blokId: string) {
    updateAktif((h) => {
      const next = h.blok.filter((b) => b.id !== blokId)
      if (next.length === 0) {
        return { ...h, blok: [{ id: idBaru('b'), tipe: 'teks', html: '' }] }
      }
      return { ...h, blok: next }
    })
  }

  function pindahBlok(blokId: string, arah: -1 | 1) {
    updateAktif((h) => {
      const i = h.blok.findIndex((b) => b.id === blokId)
      if (i < 0) return h
      const j = i + arah
      if (j < 0 || j >= h.blok.length) return h
      const next = [...h.blok]
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return { ...h, blok: next }
    })
  }

  async function simpan() {
    setBusy(true)
    setError('')
    try {
      if (!mapel || mapel === 'Wali kelas') {
        throw new Error('Pilih ruang kelas dengan mata pelajaran yang valid.')
      }
      const tp = tpList.find((t) => t.id === meta.tpId)
      if (!tp) {
        throw new Error('Tujuan Pembelajaran wajib dipilih.')
      }
      if (!meta.judul.trim()) throw new Error('Judul wajib diisi.')

      const payload = {
        kelas,
        mapel,
        judul: meta.judul,
        deskripsi: meta.deskripsi || undefined,
        bab: meta.bab || undefined,
        tpId: tp.id,
        tpNomor: tp.nomorTp,
        tpNama: tp.namaTp,
        namaGuru,
        halaman,
      }

      if (materiAwal?.id) {
        await simpanMateriHalaman(materiAwal.id, payload)
        await bersihkanGambarYatim(materiAwal.halaman, halaman)
      } else {
        await tambahMateriHalaman(payload)
      }
      onSelesai()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  const pratinjauMateri: MateriLms = useMemo(
    () => ({
      id: materiAwal?.id || 'preview',
      kelas,
      mapel,
      judul: meta.judul || 'Pratinjau',
      deskripsi: meta.deskripsi,
      jenis: 'halaman',
      halaman,
      urutan: 0,
      dibuatOleh: '',
      tpId: meta.tpId,
    }),
    [materiAwal?.id, kelas, mapel, meta, halaman],
  )

  const maxMb = Math.round(BATAS_UKURAN.gambarHalaman / (1024 * 1024))

  if (mode === 'pratinjau') {
    return (
      <div className="mh-editor">
        <div className="mh-editor-toolbar">
          <button type="button" className="lms-btn-ghost" onClick={() => setMode('edit')}>
            ← Kembali edit
          </button>
          <span className="text-xs font-medium text-slate-600">Pratinjau siswa</span>
        </div>
        <MateriHalamanViewer materi={pratinjauMateri} mode="guru" />
      </div>
    )
  }

  return (
    <div className="mh-editor">
      <div className="mh-editor-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="lms-btn-ghost" onClick={onBatal} disabled={busy}>
            Batal
          </button>
          <h2 className="text-sm font-semibold text-slate-900">
            {materiAwal ? 'Edit materi halaman' : 'Buat materi halaman'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="lms-btn-secondary"
            onClick={() => setMode('pratinjau')}
            disabled={busy}
          >
            Pratinjau
          </button>
          <button type="button" className="lms-btn-primary" onClick={() => void simpan()} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mh-error" role="alert">
          {error}
        </div>
      )}

      {/* Metadata */}
      <section className="mh-meta">
        <label className="materi-field">
          <span>Judul materi</span>
          <input
            required
            value={meta.judul}
            onChange={(e) => setMeta((m) => ({ ...m, judul: e.target.value }))}
            placeholder="Contoh: Perkalian 2 angka"
          />
        </label>
        <label className="materi-field">
          <span>Bab / unit (opsional)</span>
          <input
            value={meta.bab}
            onChange={(e) => setMeta((m) => ({ ...m, bab: e.target.value }))}
            placeholder="Otomatis dari TP bila kosong"
          />
        </label>
        <label className="materi-field materi-field--full">
          <span>Deskripsi singkat (opsional)</span>
          <textarea
            rows={2}
            value={meta.deskripsi}
            onChange={(e) => setMeta((m) => ({ ...m, deskripsi: e.target.value }))}
            placeholder="Petunjuk untuk siswa"
          />
        </label>
        <div className="materi-tp-block materi-field--full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">
              Tujuan Pembelajaran <span className="text-red-600">*</span>
            </span>
          </div>
          {tpList.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Belum ada TP di Penilaian untuk <strong>{mapel}</strong> · {kelas}.
            </div>
          ) : (
            <div role="listbox" aria-label="Pilih Tujuan Pembelajaran" className="materi-tp-list">
              {tpList.map((t) => {
                const on = meta.tpId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`materi-tp-item ${on ? 'materi-tp-item--on' : ''}`}
                    onClick={() => setMeta((m) => ({ ...m, tpId: t.id }))}
                  >
                    <span className={`materi-tp-num ${on ? 'materi-tp-num--on' : ''}`}>{t.nomorTp}</span>
                    <span className="text-left text-[12px] leading-snug">{t.namaTp}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="mh-body">
        {/* Daftar halaman */}
        <aside className="mh-sidebar">
          <div className="mh-sidebar-head">
            <span className="text-xs font-semibold text-slate-800">Halaman</span>
            <button type="button" className="mh-side-add" onClick={tambahHalaman} disabled={busy}>
              + Tambah
            </button>
          </div>
          <ul className="mh-page-list">
            {halaman.map((h, i) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={`mh-page-item ${i === aktifIdx ? 'mh-page-item--on' : ''}`}
                  onClick={() => setAktifIdx(i)}
                >
                  <span className="mh-page-num">{i + 1}</span>
                  <span className="mh-page-label">{h.judul?.trim() || `Halaman ${i + 1}`}</span>
                </button>
                <div className="mh-page-actions">
                  <button type="button" title="Naik" disabled={i === 0} onClick={() => pindahHalaman(i, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Turun"
                    disabled={i >= halaman.length - 1}
                    onClick={() => pindahHalaman(i, 1)}
                  >
                    ↓
                  </button>
                  <button type="button" title="Hapus" onClick={() => hapusHalaman(i)}>
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mh-hint">
            {halaman.length}/{BATAS_HALAMAN_PER_MATERI} halaman
          </p>
        </aside>

        {/* Editor halaman aktif */}
        <section className="mh-canvas">
          {aktif && (
            <>
              <label className="materi-field">
                <span>Judul halaman (opsional)</span>
                <input
                  value={aktif.judul || ''}
                  onChange={(e) => setJudulHalaman(e.target.value)}
                  placeholder={`Halaman ${aktifIdx + 1}`}
                />
              </label>

              <div className="mh-blok-list">
                {aktif.blok.map((b, bi) => (
                  <div key={b.id} className="mh-blok-card">
                    <div className="mh-blok-card-head">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {b.tipe === 'teks' ? 'Teks' : 'Gambar'} · {bi + 1}
                      </span>
                      <div className="mh-blok-card-actions">
                        <button type="button" disabled={bi === 0} onClick={() => pindahBlok(b.id, -1)} title="Naik">
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={bi >= aktif.blok.length - 1}
                          onClick={() => pindahBlok(b.id, 1)}
                          title="Turun"
                        >
                          ↓
                        </button>
                        <button type="button" onClick={() => hapusBlok(b.id)} title="Hapus blok">
                          Hapus
                        </button>
                      </div>
                    </div>
                    {b.tipe === 'teks' ? (
                      <MateriRichEditor
                        value={b.html}
                        onChange={(html) => updateBlok(b.id, { html } as Partial<MateriBlok>)}
                        placeholder="Tulis materi di sini…"
                        minRem={4}
                      />
                    ) : (
                      <div className="mh-img-edit">
                        {b.url ? (
                          <img src={b.url} alt={b.alt || ''} className="mh-img-preview" />
                        ) : (
                          <div className="mh-img-empty">Belum ada gambar</div>
                        )}
                        <label className="materi-field">
                          <span>Keterangan (opsional)</span>
                          <input
                            value={b.caption || ''}
                            onChange={(e) => updateBlok(b.id, { caption: e.target.value })}
                            placeholder="Caption gambar"
                          />
                        </label>
                        <button
                          type="button"
                          className="lms-btn-secondary"
                          disabled={busy}
                          onClick={() => {
                            setUnggahUntukBlok(b.id)
                            fileRef.current?.click()
                          }}
                        >
                          Ganti gambar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mh-add-blok">
                <button type="button" className="lms-btn-secondary" onClick={tambahBlokTeks} disabled={busy}>
                  + Teks
                </button>
                <button type="button" className="lms-btn-secondary" onClick={mulaiUnggahGambar} disabled={busy}>
                  + Gambar
                </button>
                <span className="mh-hint">Gambar max {maxMb} MB · JPG/PNG/WebP</span>
              </div>
            </>
          )}
        </section>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFileGambar(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

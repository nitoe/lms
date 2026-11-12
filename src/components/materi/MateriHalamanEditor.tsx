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
 * Layout: bilah atas tetap + panel meta bisa dilipat + sidepanel halaman bisa disembunyikan.
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

  /** Panel daftar halaman (kiri) — default terbuka di desktop. */
  const [panelHalaman, setPanelHalaman] = useState(true)
  /**
   * Panel pengaturan (judul, TP, …).
   * Buka otomatis jika materi baru atau metadata belum lengkap.
   */
  const metaAwalLengkap = Boolean(materiAwal?.judul && materiAwal?.tpId)
  const [panelMeta, setPanelMeta] = useState(!metaAwalLengkap)

  const aktif = halaman[aktifIdx] ?? halaman[0]
  const tpTerpilih = tpList.find((t) => t.id === meta.tpId)
  const metaLengkap = Boolean(meta.judul.trim() && meta.tpId)

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
    setPanelHalaman(true)
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
        setPanelMeta(true)
        throw new Error('Tujuan Pembelajaran wajib dipilih.')
      }
      if (!meta.judul.trim()) {
        setPanelMeta(true)
        throw new Error('Judul wajib diisi.')
      }

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
      <div className="mh-shell">
        <div className="mh-topbar">
          <button type="button" className="lms-btn-ghost" onClick={() => setMode('edit')}>
            ← Kembali edit
          </button>
          <span className="mh-topbar-label">Pratinjau siswa</span>
        </div>
        <MateriHalamanViewer materi={pratinjauMateri} mode="guru" />
      </div>
    )
  }

  return (
    <div className={`mh-shell ${panelHalaman ? 'mh-shell--side-on' : 'mh-shell--side-off'}`}>
      {/* ── Bilah atas tetap ── */}
      <header className="mh-topbar">
        <div className="mh-topbar-left">
          <button type="button" className="lms-btn-ghost" onClick={onBatal} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className={`mh-icon-btn ${panelHalaman ? 'mh-icon-btn--on' : ''}`}
            aria-pressed={panelHalaman}
            aria-label={panelHalaman ? 'Sembunyikan daftar halaman' : 'Tampilkan daftar halaman'}
            title={panelHalaman ? 'Sembunyikan daftar halaman' : 'Daftar halaman'}
            onClick={() => setPanelHalaman((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="4" width="7" height="16" rx="1.5" />
              <path d="M14 7h7M14 12h7M14 17h5" />
            </svg>
          </button>
          <button
            type="button"
            className={`mh-icon-btn ${panelMeta ? 'mh-icon-btn--on' : ''} ${!metaLengkap ? 'mh-icon-btn--warn' : ''}`}
            aria-pressed={panelMeta}
            aria-label={panelMeta ? 'Sembunyikan pengaturan materi' : 'Pengaturan materi'}
            title={
              !metaLengkap
                ? 'Pengaturan materi (judul & TP belum lengkap)'
                : panelMeta
                  ? 'Sembunyikan pengaturan'
                  : 'Pengaturan materi'
            }
            onClick={() => setPanelMeta((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            {!metaLengkap && <span className="mh-dot-warn" aria-hidden />}
          </button>
          <div className="mh-topbar-title-wrap">
            <span className="mh-topbar-kicker">{materiAwal ? 'Edit materi' : 'Materi baru'}</span>
            <span className="mh-topbar-title" title={meta.judul || undefined}>
              {meta.judul.trim() || 'Tanpa judul'}
            </span>
          </div>
        </div>
        <div className="mh-topbar-right">
          <span className="mh-page-pill" title="Halaman aktif">
            {aktifIdx + 1}/{halaman.length}
          </span>
          {tpTerpilih && (
            <span className="mh-tp-chip" title={tpTerpilih.namaTp}>
              TP {tpTerpilih.nomorTp}
            </span>
          )}
          <button
            type="button"
            className="lms-btn-secondary"
            onClick={() => setMode('pratinjau')}
            disabled={busy}
          >
            Pratinjau
          </button>
          <button
            type="button"
            className="lms-btn-primary"
            onClick={() => void simpan()}
            disabled={busy}
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mh-error" role="alert">
          {error}
        </div>
      )}

      {/* ── Panel meta (bisa dilipat) ── */}
      {panelMeta && (
        <section className="mh-meta-panel" aria-label="Pengaturan materi">
          <div className="mh-meta-panel-head">
            <h3 className="mh-meta-panel-title">Pengaturan materi</h3>
            <button
              type="button"
              className="mh-link-btn"
              onClick={() => setPanelMeta(false)}
            >
              Sembunyikan
            </button>
          </div>
          <div className="mh-meta">
            <label className="materi-field">
              <span>
                Judul materi <span className="text-red-600">*</span>
              </span>
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
                {tpTerpilih && (
                  <span className="text-[11px] font-medium text-emerald-700">
                    Terpilih: TP {tpTerpilih.nomorTp}
                  </span>
                )}
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
                        <span className={`materi-tp-num ${on ? 'materi-tp-num--on' : ''}`}>
                          {t.nomorTp}
                        </span>
                        <span className="text-left text-[12px] leading-snug">{t.namaTp}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          {metaLengkap && (
            <div className="mh-meta-panel-foot">
              <button type="button" className="lms-btn-secondary" onClick={() => setPanelMeta(false)}>
                Selesai — lanjut tulis isi
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Badan: sidepanel + kanvas ── */}
      <div className="mh-body">
        {panelHalaman && (
          <aside className="mh-sidebar" aria-label="Daftar halaman">
            <div className="mh-sidebar-head">
              <span className="text-xs font-semibold text-slate-800">Halaman</span>
              <div className="flex items-center gap-1">
                <button type="button" className="mh-side-add" onClick={tambahHalaman} disabled={busy}>
                  + Tambah
                </button>
                <button
                  type="button"
                  className="mh-side-hide"
                  title="Sembunyikan panel"
                  aria-label="Sembunyikan daftar halaman"
                  onClick={() => setPanelHalaman(false)}
                >
                  «
                </button>
              </div>
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
        )}

        <section className="mh-canvas">
          {!panelHalaman && (
            <button
              type="button"
              className="mh-reopen-side"
              onClick={() => setPanelHalaman(true)}
            >
              » Halaman ({aktifIdx + 1}/{halaman.length})
            </button>
          )}

          {aktif && (
            <>
              <div className="mh-canvas-head">
                <label className="materi-field mh-judul-halaman">
                  <span>Judul halaman (opsional)</span>
                  <input
                    value={aktif.judul || ''}
                    onChange={(e) => setJudulHalaman(e.target.value)}
                    placeholder={`Halaman ${aktifIdx + 1}`}
                  />
                </label>
              </div>

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
                        minRem={5}
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { daftarMateri, hapusMateri, tambahMateri } from '../lib/materi'
import { getTpMapelKelas } from '../lib/tpData'
import type { MateriLms } from '../types/materi'
import type { TpRingkas } from '../types/materi'

type Props = {
  kelas: string
  mapel: string
}

type ModeForm = 'tutup' | 'file' | 'youtube' | 'tautan'

function ikonJenis(jenis: string): string {
  switch (jenis) {
    case 'pdf':
      return 'PDF'
    case 'gambar':
      return 'IMG'
    case 'video':
      return 'VID'
    case 'youtube':
      return 'YT'
    default:
      return 'URL'
  }
}

function formatUkuran(n?: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function MateriPanel({ kelas, mapel }: Props) {
  const { profil } = useAuth()
  const [list, setList] = useState<MateriLms[] | null>(null)
  const [tpList, setTpList] = useState<TpRingkas[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<ModeForm>('tutup')

  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [bab, setBab] = useState('')
  const [tpId, setTpId] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

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

  const kelompok = useMemo(() => {
    if (!list) return []
    const map = new Map<string, MateriLms[]>()
    for (const m of list) {
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
  }, [list])

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
      const tp = tpList.find((t) => t.id === tpId)
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Materi dikelompokkan menurut Tujuan Pembelajaran (TP) dari aplikasi Penilaian.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="rounded-md bg-muh-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-muh-700"
            onClick={() => setMode(mode === 'file' ? 'tutup' : 'file')}
          >
            + File
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-2"
            onClick={() => setMode(mode === 'youtube' ? 'tutup' : 'youtube')}
          >
            + YouTube
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-2"
            onClick={() => setMode(mode === 'tautan' ? 'tutup' : 'tautan')}
          >
            + Tautan
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {mode !== 'tutup' && (
        <form onSubmit={(e) => void simpan(e)} className="card-soft space-y-3 p-4">
          <div className="text-sm font-semibold text-muh-800">
            {mode === 'file' && 'Unggah file (PDF, gambar, video)'}
            {mode === 'youtube' && 'Tambah tautan YouTube'}
            {mode === 'tautan' && 'Tambah tautan'}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted">Judul</span>
              <input
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                maxLength={200}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Tujuan Pembelajaran</span>
              <select
                value={tpId}
                onChange={(e) => {
                  setTpId(e.target.value)
                  const t = tpList.find((x) => x.id === e.target.value)
                  if (t && !bab) setBab(`TP ${t.nomorTp}`)
                }}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">— Pilih TP (opsional) —</option>
                {tpList.map((t) => (
                  <option key={t.id} value={t.id}>
                    TP {t.nomorTp}. {t.namaTp}
                  </option>
                ))}
              </select>
              {tpList.length === 0 && (
                <span className="mt-1 block text-[11px] text-muted">
                  Belum ada TP di Penilaian untuk {mapel} · {kelas}.
                </span>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Bab / unit (opsional)</span>
              <input
                value={bab}
                onChange={(e) => setBab(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                maxLength={120}
                placeholder="Mis. Bab 1"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted">Deskripsi singkat</span>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                rows={2}
                maxLength={2000}
              />
            </label>
            {mode === 'file' && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted">
                  File (PDF/gambar max 10 MB, video max 50 MB)
                </span>
                <input
                  type="file"
                  required
                  accept="application/pdf,image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </label>
            )}
            {(mode === 'youtube' || mode === 'tautan') && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted">
                  {mode === 'youtube' ? 'URL YouTube' : 'URL'}
                </span>
                <input
                  required
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  placeholder={
                    mode === 'youtube'
                      ? 'https://www.youtube.com/watch?v=…'
                      : 'https://…'
                  }
                />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-muh-600 px-4 py-2 text-sm font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
            >
              {busy ? 'Menyimpan…' : 'Simpan materi'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface-2"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {list === null && (
        <div className="text-sm text-muted">Memuat materi…</div>
      )}

      {list && list.length === 0 && mode === 'tutup' && (
        <div className="card-soft p-5 text-sm text-muted">
          Belum ada materi. Unggah file, tautkan YouTube, atau tambah tautan, lalu hubungkan ke TP.
        </div>
      )}

      {kelompok.map((g) => (
        <section key={g.key} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muh-700">{g.label}</h3>
          <ul className="space-y-2">
            {g.items.map((m) => (
              <li
                key={m.id}
                className="card-soft flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap"
              >
                <span className="inline-flex h-8 w-10 shrink-0 items-center justify-center rounded bg-muh-50 text-[10px] font-bold text-muh-700">
                  {ikonJenis(m.jenis)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{m.judul}</div>
                  {m.deskripsi && (
                    <p className="mt-0.5 text-xs text-muted line-clamp-2">{m.deskripsi}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    {m.fileName && <span>{m.fileName}</span>}
                    {m.ukuran ? <span>{formatUkuran(m.ukuran)}</span> : null}
                    {m.dibuatOlehNama && <span>{m.dibuatOlehNama}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muh-700 hover:bg-muh-50"
                    >
                      Buka
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onHapus(m)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

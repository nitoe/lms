import { useCallback, useEffect, useState } from 'react'
import {
  daftarSoal,
  tambahSoal,
  updateSoal,
  hapusSoal,
  unggahGambarSoal,
} from '../lib/kuis'
import type { JenisSoal, KuisLms, SoalLms, OpsiJawaban } from '../types/kuis'
import { LABEL_JENIS_SOAL } from '../types/kuis'

type Props = {
  kuis: KuisLms
  onUpdated?: () => void
}

export default function KuisBuilder({ kuis, onUpdated }: Props) {
  const [soalList, setSoalList] = useState<SoalLms[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Partial<SoalLms>>({})

  const muat = useCallback(async () => {
    try {
      const data = await daftarSoal(kuis.id)
      setSoalList(data)
      if (!selectedId && data.length > 0) setSelectedId(data[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat soal.')
    }
  }, [kuis.id, selectedId])

  useEffect(() => {
    void muat()
  }, [muat])

  const selected = soalList.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    if (selected) {
      setDraft({
        pertanyaan: selected.pertanyaan,
        jenis: selected.jenis,
        skor: selected.skor,
        opsi: selected.opsi ? [...selected.opsi] : undefined,
        pasangan: selected.pasangan ? [...selected.pasangan] : undefined,
        jawabanIsian: selected.jawabanIsian ? [...selected.jawabanIsian] : undefined,
        kunciUraian: selected.kunciUraian,
        penjelasan: selected.penjelasan,
        pertanyaanGambar: selected.pertanyaanGambar,
      })
    }
  }, [selected])

  async function onTambah(jenis: JenisSoal) {
    setBusy(true)
    setError('')
    try {
      const id = await tambahSoal({
        kuisId: kuis.id,
        jenis,
        pertanyaan: 'Pertanyaan baru',
      })
      await muat()
      setSelectedId(id)
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah soal.')
    } finally {
      setBusy(false)
    }
  }

  async function onSimpan() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await updateSoal(selected.id, draft)
      await muat()
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function onHapus(s: SoalLms) {
    if (!confirm('Hapus soal ini?')) return
    setBusy(true)
    try {
      await hapusSoal(s)
      if (selectedId === s.id) setSelectedId(null)
      await muat()
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  async function onUploadGambar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    setBusy(true)
    try {
      const { url, path } = await unggahGambarSoal(file, kuis.id)
      setDraft((d) => ({ ...d, pertanyaanGambar: url, pertanyaanGambarPath: path }))
      await updateSoal(selected.id, { pertanyaanGambar: url, pertanyaanGambarPath: path })
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah gambar.')
    } finally {
      setBusy(false)
    }
  }

  function updateOpsi(idx: number, patch: Partial<OpsiJawaban>) {
    setDraft((d) => {
      const opsi = [...(d.opsi ?? [])]
      opsi[idx] = { ...opsi[idx], ...patch }
      return { ...d, opsi }
    })
  }

  function setBenar(idx: number, multi: boolean) {
    setDraft((d) => {
      const opsi = [...(d.opsi ?? [])]
      if (multi) {
        opsi[idx] = { ...opsi[idx], benar: !opsi[idx].benar }
      } else {
        opsi.forEach((o, i) => {
          o.benar = i === idx
        })
      }
      return { ...d, opsi }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">SOAL ({soalList.length})</span>
          <div className="relative">
            <button type="button" className="lms-btn-secondary text-xs" disabled={busy}>
              +
            </button>
            {/* Simple dropdown via buttons below for now */}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(['pg', 'pg_kompleks', 'benar_salah', 'isian', 'uraian', 'menjodohkan'] as JenisSoal[]).map((j) => (
            <button
              key={j}
              type="button"
              disabled={busy}
              onClick={() => void onTambah(j)}
              className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium hover:bg-slate-200"
            >
              {LABEL_JENIS_SOAL[j].split(' ')[0]}
            </button>
          ))}
        </div>
        <ul className="max-h-[60vh] space-y-1 overflow-auto">
          {soalList.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-lg px-2 py-2 text-left text-xs ${
                  selectedId === s.id ? 'bg-muh-50 ring-1 ring-muh-200' : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-medium text-slate-800">
                  {i + 1}. {s.pertanyaan.slice(0, 40) || '…'}
                </div>
                <div className="text-[10px] text-slate-500">{LABEL_JENIS_SOAL[s.jenis]}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}

        {!selected && (
          <div className="lms-empty">Pilih atau tambah soal di sidebar.</div>
        )}

        {selected && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <select
                value={draft.jenis ?? selected.jenis}
                onChange={(e) => setDraft((d) => ({ ...d, jenis: e.target.value as JenisSoal }))}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {(Object.keys(LABEL_JENIS_SOAL) as JenisSoal[]).map((j) => (
                  <option key={j} value={j}>
                    {LABEL_JENIS_SOAL[j]}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-sm">
                <label>
                  Skor
                  <input
                    type="number"
                    min={1}
                    value={draft.skor ?? 1}
                    onChange={(e) => setDraft((d) => ({ ...d, skor: Number(e.target.value) }))}
                    className="ml-1 w-14 rounded border px-2 py-1"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onHapus(selected)}
                  className="materi-btn-danger"
                >
                  Hapus
                </button>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Pertanyaan</span>
              <textarea
                rows={3}
                value={draft.pertanyaan ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, pertanyaan: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-center gap-2">
              <label className="lms-btn-secondary cursor-pointer text-xs">
                + Gambar pertanyaan
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void onUploadGambar(e)} />
              </label>
              {draft.pertanyaanGambar && (
                <img src={draft.pertanyaanGambar} alt="" className="h-16 rounded border object-cover" />
              )}
            </div>

            {(draft.jenis === 'pg' || draft.jenis === 'pg_kompleks' || draft.jenis === 'benar_salah') && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">Opsi</span>
                {(draft.opsi ?? []).map((o, idx) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input
                      type={draft.jenis === 'pg_kompleks' ? 'checkbox' : 'radio'}
                      checked={!!o.benar}
                      onChange={() => setBenar(idx, draft.jenis === 'pg_kompleks')}
                    />
                    <input
                      value={o.teks}
                      onChange={(e) => updateOpsi(idx, { teks: e.target.value })}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder={`Opsi ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {draft.jenis === 'isian' && (
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">Jawaban benar (pisahkan dengan koma)</span>
                <input
                  value={(draft.jawabanIsian ?? []).join(', ')}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      jawabanIsian: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            )}

            {draft.jenis === 'uraian' && (
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">Kunci / petunjuk penilaian (opsional)</span>
                <textarea
                  rows={2}
                  value={draft.kunciUraian ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, kunciUraian: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Penjelasan (opsional)</span>
              <textarea
                rows={2}
                value={draft.penjelasan ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, penjelasan: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>

            <div className="flex justify-end">
              <button type="button" className="lms-btn-primary" disabled={busy} onClick={() => void onSimpan()}>
                {busy ? 'Menyimpan…' : 'Simpan soal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { updateKuis } from '../lib/kuis'
import { hitungRingkasanKuis } from '../lib/susunKuis'
import { teksPolos } from '../lib/html'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_TIPE, URUTAN_TIPE, type TipeSoal } from '../types/soal'

/** Instruksi lengkap per bentuk soal (untuk siswa dan nantinya cetak). */
export const INSTRUKSI_TIPE: Record<TipeSoal, string> = {
  pg: 'Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf a, b, c, atau d!',
  pgk: 'Pilihlah dua jawaban yang benar! Beri tanda silang (X) pada dua huruf yang sesuai.',
  bs: 'Tentukan apakah pernyataan berikut Benar atau Salah! Beri tanda (B) atau (S).',
  isian: 'Isilah titik-titik berikut dengan jawaban yang tepat!',
  jodoh: 'Jodohkan pernyataan di kolom kiri dengan jawaban yang sesuai di kolom kanan!',
  uraian: 'Jawablah pertanyaan berikut dengan jelas dan lengkap!',
}

type Props = {
  kuis: KuisLms
  onUpdated?: () => void
}

export default function KuisDetail({ kuis, onUpdated }: Props) {
  const [soal, setSoal] = useState<SoalKuis[]>(() => [...(kuis.soal ?? [])])
  const [judul, setJudul] = useState(kuis.judul)
  const [deskripsi, setDeskripsi] = useState(kuis.deskripsi ?? '')
  const [durasi, setDurasi] = useState(kuis.durasiMenit ?? 0)
  const [acakSoal, setAcakSoal] = useState(!!kuis.acakSoal)
  const [acakOpsi, setAcakOpsi] = useState(kuis.acakOpsi !== false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    setSoal([...(kuis.soal ?? [])])
    setJudul(kuis.judul)
    setDeskripsi(kuis.deskripsi ?? '')
    setDurasi(kuis.durasiMenit ?? 0)
    setAcakSoal(!!kuis.acakSoal)
    setAcakOpsi(kuis.acakOpsi !== false)
  }, [kuis])

  const ringkas = hitungRingkasanKuis(soal)

  // Kelompokkan untuk tampilan (selalu menurut bentuk)
  const kelompok = useMemo(() => {
    const map = new Map<TipeSoal, { soal: SoalKuis; idxAsli: number }[]>()
    for (const t of URUTAN_TIPE) map.set(t, [])
    soal.forEach((s, idx) => {
      const arr = map.get(s.tipe)
      if (arr) arr.push({ soal: s, idxAsli: idx })
    })
    return map
  }, [soal])

  function setPoin(idx: number, poin: number) {
    setSoal((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], poin: Math.max(0, poin) }
      return next
    })
  }

  function naik(idx: number) {
    if (idx <= 0) return
    setSoal((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function turun(idx: number) {
    setSoal((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  function hapusSoal(idx: number) {
    if (!confirm('Hapus soal ini dari kuis? (Bank soal tidak berubah.)')) return
    setSoal((prev) => prev.filter((_, i) => i !== idx))
  }

  /** Susun ulang array soal menurut bentuk (PG → PGK → Jodoh → BS → Isian → Uraian). */
  function urutkanMenurutBentuk() {
    if (soal.length === 0) return
    if (!confirm('Kelompokkan soal menurut bentuknya?\nUrutan: Pilihan ganda → PG kompleks → Menjodohkan → Benar/Salah → Isian → Uraian.\nUrutan relatif di dalam tiap kelompok tetap dipertahankan.')) return
    const sorted: SoalKuis[] = []
    for (const tipe of URUTAN_TIPE) {
      const items = kelompok.get(tipe) ?? []
      for (const it of items) sorted.push(it.soal)
    }
    setSoal(sorted)
    setInfo('Soal dikelompokkan menurut bentuk. Jangan lupa Simpan perubahan.')
  }

  async function simpan() {
    if (!judul.trim()) {
      setError('Judul wajib diisi.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await updateKuis(kuis.id, {
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || undefined,
        soal,
        durasiMenit: durasi > 0 ? durasi : undefined,
        acakSoal,
        acakOpsi,
      })
      setInfo('Tersimpan.')
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  let nomorGlobal = 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[200px] space-y-1">
          <span className="text-xs font-semibold text-slate-700">Judul kuis</span>
          <input
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="w-28 space-y-1">
          <span className="text-xs font-semibold text-slate-700">Durasi (menit)</span>
          <input
            type="number"
            min={0}
            value={durasi}
            onChange={(e) => setDurasi(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={acakSoal} onChange={(e) => setAcakSoal(e.target.checked)} />
            Acak soal
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={acakOpsi} onChange={(e) => setAcakOpsi(e.target.checked)} />
            Acak opsi
          </label>
        </div>
        <button
          type="button"
          className="lms-btn-secondary text-xs"
          disabled={busy || soal.length === 0}
          onClick={urutkanMenurutBentuk}
        >
          Kelompokkan menurut bentuk
        </button>
        <button type="button" className="lms-btn-primary" disabled={busy} onClick={() => void simpan()}>
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <div className="text-xs text-slate-500">
        {ringkas.jumlahSoal} soal · total {ringkas.totalPoin} poin
      </div>

      <div className="space-y-5">
        {URUTAN_TIPE.map((tipe) => {
          const items = kelompok.get(tipe) ?? []
          if (items.length === 0) return null
          return (
            <section key={tipe} className="space-y-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
                <div className="text-sm font-bold text-slate-800">
                  {NAMA_TIPE[tipe]} <span className="font-normal text-slate-500">({items.length} soal)</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600 leading-snug">{INSTRUKSI_TIPE[tipe]}</p>
              </div>
              <ul className="space-y-2">
                {items.map(({ soal: s, idxAsli }) => {
                  nomorGlobal += 1
                  const no = nomorGlobal
                  return (
                    <li
                      key={`${s.sumberPaketId}-${s.id}-${idxAsli}`}
                      className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap gap-2 items-start"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-800">
                          <span className="font-semibold text-slate-500 mr-1">{no}.</span>
                          {teksPolos(s.teks).slice(0, 160) || '(tanpa teks)'}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-2">
                          <span>{s.kompleksitas || 'L1'}</span>
                          {s.sumberPaketJudul && <span title="Sumber paket">← {s.sumberPaketJudul}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-xs text-slate-600 flex items-center gap-1">
                          Poin
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={s.poin}
                            onChange={(e) => setPoin(idxAsli, Number(e.target.value) || 0)}
                            className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                          />
                        </label>
                        <button type="button" className="lms-btn-ghost text-xs" onClick={() => naik(idxAsli)} title="Naikkan">
                          ↑
                        </button>
                        <button type="button" className="lms-btn-ghost text-xs" onClick={() => turun(idxAsli)} title="Turunkan">
                          ↓
                        </button>
                        <button
                          type="button"
                          className="materi-btn-danger text-xs"
                          onClick={() => hapusSoal(idxAsli)}
                        >
                          Hapus
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      {soal.length === 0 && (
        <div className="lms-empty">Tidak ada soal. Buat ulang kuis dari bank soal.</div>
      )}
    </div>
  )
}

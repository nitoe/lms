import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import type { KuisLms, SoalKuis } from '../../types/kuis'
import { NAMA_JENIS_PENILAIAN } from '../../types/kuis'

/**
 * Daftar kuis aktif untuk kelas siswa + pengerjaan.
 * Layout full-width (ANTIREGRESI §54) — tanpa max-w-2xl / container sempit.
 */
export default function SiswaKuis() {
  const { sesi } = useSiswa()
  const [list, setList] = useState<KuisLms[] | null>(null)
  const [aktif, setAktif] = useState<KuisLms | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sesi) return
    const q = query(
      collection(db, 'lms_kuis'),
      where('kelas', '==', sesi.kelas),
      where('aktif', '==', true),
    )
    getDocs(q)
      .then((snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KuisLms)))
      .catch((e) => setError(e.message || 'Gagal memuat kuis'))
  }, [sesi])

  if (aktif) return <KerjakanKuis kuis={aktif} onSelesai={() => setAktif(null)} />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-lg font-bold text-slate-900">Kuis</h1>
        {list && list.length > 0 ? (
          <span className="lms-count-pill">{list.length} kuis</span>
        ) : null}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {list === null && <div className="lms-empty">Memuat kuis…</div>}

      {list?.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada kuis aktif</p>
          <p className="mt-1">Kuis dari gurumu akan muncul di sini.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="sw-kuis-list">
          {list.map((k) => (
            <li key={k.id} className="sw-kuis-card">
              <div className="sw-kuis-card-title">{k.judul}</div>
              <div className="sw-kuis-card-meta">
                {k.mapel} · {NAMA_JENIS_PENILAIAN[k.jenisPenilaian ?? 'latihan']} ·{' '}
                {k.jumlahSoal} soal
                {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ''}
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  className="sw-btn-primary"
                  onClick={() => setAktif(k)}
                >
                  Mulai Kerjakan
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormJawaban({
  soal,
  value,
  onChange,
}: {
  soal: SoalKuis
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (soal.tipe === 'pg') {
    return (
      <div className="mt-4 space-y-2">
        {soal.opsi?.map((o, i) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
              value === o.id
                ? 'border-violet-400 bg-violet-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              className="mt-0.5"
              name={soal.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            />
            <span className="text-sm">
              <span className="mr-1 font-medium text-slate-500">
                {String.fromCharCode(65 + i)}.
              </span>
              {o.teks}
            </span>
          </label>
        ))}
      </div>
    )
  }
  if (soal.tipe === 'pgk') {
    const arr: string[] = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="mt-4 space-y-2">
        {soal.opsi?.map((o, i) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
              arr.includes(o.id)
                ? 'border-violet-400 bg-violet-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={arr.includes(o.id)}
              onChange={() =>
                onChange(
                  arr.includes(o.id) ? arr.filter((x) => x !== o.id) : [...arr, o.id],
                )
              }
            />
            <span className="text-sm">
              <span className="mr-1 font-medium text-slate-500">
                {String.fromCharCode(65 + i)}.
              </span>
              {o.teks}
            </span>
          </label>
        ))}
      </div>
    )
  }
  if (soal.tipe === 'isian') {
    return (
      <input
        className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ketik jawaban singkat…"
      />
    )
  }
  if (soal.tipe === 'uraian') {
    return (
      <textarea
        rows={6}
        className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tulis jawaban lengkap…"
      />
    )
  }
  return (
    <p className="mt-4 text-xs text-slate-400">
      Tipe soal ini belum didukung di pengerjaan online.
    </p>
  )
}

function KerjakanKuis({ kuis, onSelesai }: { kuis: KuisLms; onSelesai: () => void }) {
  const [idx, setIdx] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [sisaDetik, setSisaDetik] = useState((kuis.durasiMenit ?? 0) * 60)
  const soalList = kuis.soal ?? []
  const soal = soalList[idx]
  const sudahJawab = (id: string) => {
    const v = jawaban[id]
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
  }

  useEffect(() => {
    if (!kuis.durasiMenit || kuis.durasiMenit <= 0) return
    const t = setInterval(() => setSisaDetik((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [kuis.durasiMenit])

  const menit = Math.floor(sisaDetik / 60)
  const detik = sisaDetik % 60
  const waktuHabis = Boolean(kuis.durasiMenit && sisaDetik <= 0)

  async function kirim() {
    if (waktuHabis) return
    setBusy(true)
    try {
      const fn = httpsCallable(functions, 'nilaiKuisLms')
      const res = await fn({ kuisId: kuis.id, jawaban })
      const data = res.data as { skor?: number; totalPoin?: number }
      alert(`Selesai!\nSkor: ${data?.skor ?? '-'} / ${data?.totalPoin ?? '-'}`)
      onSelesai()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mengirim jawaban.'
      alert(msg)
    } finally {
      setBusy(false)
    }
  }

  if (!soal) {
    return <div className="lms-empty">Tidak ada soal.</div>
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{kuis.judul}</div>
          <div className="text-xs text-slate-500">
            Soal {idx + 1} dari {soalList.length}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {kuis.durasiMenit ? (
            <div
              className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${
                sisaDetik < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onSelesai}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 md:sticky md:top-24">
          <div className="mb-2 text-xs font-semibold text-slate-500">Navigasi</div>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-5">
            {soalList.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-9 rounded text-xs font-medium transition ${
                  i === idx
                    ? 'bg-violet-600 text-white'
                    : sudahJawab(s.id)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-0.5 text-[10px] text-slate-400">
            <div>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-600" /> Sedang
              dikerjakan
            </div>
            <div>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-200" /> Sudah
              dijawab
            </div>
          </div>
        </aside>

        <main className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-1 text-xs font-medium text-slate-400">Soal {idx + 1}</div>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: soal.teks || '<p>(tanpa teks)</p>' }}
          />
          <FormJawaban
            soal={soal}
            value={jawaban[soal.id]}
            onChange={(v) => setJawaban((prev) => ({ ...prev, [soal.id]: v }))}
          />

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => setIdx((i) => i - 1)}
              className="lms-btn-secondary text-sm"
            >
              ← Sebelumnya
            </button>
            {idx < soalList.length - 1 ? (
              <button
                type="button"
                onClick={() => setIdx((i) => i + 1)}
                className="sw-btn-primary"
              >
                Berikutnya →
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || waktuHabis}
                onClick={() => void kirim()}
                className="sw-btn-primary"
              >
                {busy ? 'Mengirim…' : waktuHabis ? 'Waktu habis' : 'Selesai & Kirim'}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

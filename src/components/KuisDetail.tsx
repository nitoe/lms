import { useEffect, useMemo, useState } from 'react'
import { updateKuis } from '../lib/kuis'
import { daftarPaket } from '../lib/soal'
import { hitungRingkasanKuis } from '../lib/susunKuis'
import { teksPolos } from '../lib/html'
import type { JenisPenilaianKuis, KuisLms, ModePelaksanaanKuis, SoalKuis } from '../types/kuis'
import { NAMA_JENIS_PENILAIAN, NAMA_MODE_PELAKSANAAN } from '../types/kuis'
import { NAMA_TIPE, URUTAN_TIPE, type TipeSoal, normalisasiDomainTka, NAMA_DOMAIN_TKA } from '../types/soal'
import { adalahMapelTka } from '../lib/tkaAkses'
import { bolehAnalisisKuisAi } from '../lib/analisisKuisAi'
import { klasifikasiDomainTkaDenganAi } from '../lib/domainTkaAi'
import { useAuth } from '../context/AuthContext'

/** Instruksi lengkap per bentuk soal (untuk siswa dan nantinya cetak). */
export const INSTRUKSI_TIPE: Record<TipeSoal, string> = {
  pg: 'Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf a, b, c, atau d!',
  pgk: 'Pilihlah dua jawaban yang benar! Beri tanda silang (X) pada dua huruf yang sesuai.',
  bs: 'Tentukan apakah pernyataan berikut Benar atau Salah! Beri tanda (B) atau (S).',
  isian: 'Isilah titik-titik berikut dengan jawaban yang tepat!',
  jodoh: 'Jodohkan pernyataan di kolom kiri dengan jawaban yang sesuai di kolom kanan!',
  uraian: 'Jawablah pertanyaan berikut dengan jelas dan lengkap!',
}


function bersihNamaTp(s: string): string {
  return String(s ?? '')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const [waktuMulai, setWaktuMulai] = useState(kuis.waktuMulai ?? '')
  const [waktuSelesai, setWaktuSelesai] = useState(kuis.waktuSelesai ?? '')
  const [token, setToken] = useState(kuis.token ?? '')
  const [jenisPenilaian, setJenisPenilaian] = useState<JenisPenilaianKuis>(kuis.jenisPenilaian ?? 'latihan')
  const [modePelaksanaan, setModePelaksanaan] = useState<ModePelaksanaanKuis>(kuis.modePelaksanaan === 'offline' ? 'offline' : 'online')
  const [tpList, setTpList] = useState<string[]>((kuis.tpNamaList ?? kuis.tpIds ?? []).map(bersihNamaTp).filter(Boolean))
  const [nilaiPerTp, setNilaiPerTp] = useState<Record<string, number>>(kuis.nilaiPerTp ?? {})
  /** TKA: nilai tidak masuk rapor/Penilaian — sembunyikan blok Penilaian & TP (ANTIREGRESI §91). */
  const { user } = useAuth()
  const isTka = adalahMapelTka(kuis.mapel)
  const bolehDomainAi = bolehAnalisisKuisAi(user?.uid)
  const [busyDomainAi, setBusyDomainAi] = useState(false)

  const nSoalTanpaDomain = useMemo(() => {
    if (!isTka) return 0
    return soal.filter((s) => !normalisasiDomainTka(s.domainTka)).length
  }, [isTka, soal])

  const nSoalDomain = useMemo(() => {
    if (!isTka) return { pengetahuan: 0, keterampilan_proses: 0 }
    let p = 0
    let k = 0
    for (const s of soal) {
      const d = normalisasiDomainTka(s.domainTka)
      if (d === 'pengetahuan') p += 1
      else if (d === 'keterampilan_proses') k += 1
    }
    return { pengetahuan: p, keterampilan_proses: k }
  }, [isTka, soal])

  useEffect(() => {
    setSoal([...(kuis.soal ?? [])])
    setJudul(kuis.judul)
    setDeskripsi(kuis.deskripsi ?? '')
    setDurasi(kuis.durasiMenit ?? 0)
    setAcakSoal(!!kuis.acakSoal)
    setAcakOpsi(kuis.acakOpsi !== false)
    setWaktuMulai(kuis.waktuMulai ?? '')
    setWaktuSelesai(kuis.waktuSelesai ?? '')
    setToken(kuis.token ?? '')
    setJenisPenilaian(kuis.jenisPenilaian ?? 'latihan')
    setModePelaksanaan(kuis.modePelaksanaan === 'offline' ? 'offline' : 'online')
    setTpList((kuis.tpNamaList ?? kuis.tpIds ?? []).map(bersihNamaTp).filter(Boolean))
    setNilaiPerTp(kuis.nilaiPerTp ?? {})
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

  async function perbaruiTpDariPaket() {
    if (!kuis.sumberPaketIds?.length) {
      setInfo('Kuis ini tidak memiliki paket sumber.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const semua = await daftarPaket(kuis.kelas, kuis.mapel)
      const tpMap = new Map<string, string>()
      for (const pid of kuis.sumberPaketIds) {
        const pk = semua.find((x) => x.id === pid)
        if (pk?.tpId && pk.tpNama) {
          const namaBersih = bersihNamaTp(String(pk.tpNama ?? ''))
          const label = pk.tpNomor ? `TP ${pk.tpNomor}. ${namaBersih}` : namaBersih
          tpMap.set(pk.tpId, label)
        }
      }
      const ids = [...tpMap.keys()]
      const names = [...tpMap.values()]
      setTpList(names)
      await updateKuis(kuis.id, {
        tpIds: ids.length ? ids : undefined,
        tpNamaList: names.length ? names : undefined,
      })
      setInfo(ids.length ? `TP diperbarui (${ids.length} TP).` : 'Tidak ada TP ditemukan pada paket sumber.')
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memperbarui TP.')
    } finally {
      setBusy(false)
    }
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
      const daftarTp = isTka ? [] : tpList
      await updateKuis(kuis.id, {
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || undefined,
        soal,
        durasiMenit: durasi > 0 ? durasi : undefined,
        acakSoal,
        acakOpsi,
        waktuMulai: waktuMulai || undefined,
        waktuSelesai: waktuSelesai || undefined,
        token: token.trim() || undefined,
        // TKA: selalu latihan (bukan SLM/STS/SAS rapor)
        jenisPenilaian: isTka ? 'latihan' : jenisPenilaian,
        modePelaksanaan,
        tpIds: daftarTp.length ? daftarTp : undefined,
        tpNamaList: daftarTp.length ? daftarTp : undefined,
        nilaiPerTp: !isTka && Object.keys(nilaiPerTp).length ? nilaiPerTp : undefined,
        sumberNilai: !isTka && Object.keys(nilaiPerTp).length ? 'manual' : undefined,
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

  async function deteksiDomainAi(overwrite = false) {
    if (!isTka) return
    if (nSoalTanpaDomain === 0 && !overwrite) {
      const ok = confirm(
        'Semua soal sudah punya domain. Klasifikasi ulang dan timpa label yang ada?',
      )
      if (!ok) return
      overwrite = true
    } else if (nSoalTanpaDomain > 0) {
      const ok = confirm(
        `Deteksi domain AI untuk ${nSoalTanpaDomain} soal yang belum berlabel?\n\nHasil akan disimpan ke snapshot soal kuis ini (pengetahuan / keterampilan_proses).`,
      )
      if (!ok) return
    }
    setBusyDomainAi(true)
    setError('')
    setInfo('')
    try {
      const h = await klasifikasiDomainTkaDenganAi(kuis.id, { overwrite })
      if (!h.hasil.length) {
        setInfo('Tidak ada soal yang diklasifikasi.')
        return
      }
      const peta = new Map(h.hasil.map((x) => [x.soalId, x.domainTka]))
      const soalBaru = soal.map((s) => {
        const d = peta.get(s.id)
        return d ? { ...s, domainTka: d } : s
      })
      setSoal(soalBaru)
      await updateKuis(kuis.id, { soal: soalBaru })
      setInfo(
        `Domain disimpan: ${h.diklasifikasi} soal diklasifikasi` +
          (h.dilewati ? `, ${h.dilewati} dilewati (sudah berlabel)` : '') +
          '.',
      )
      onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal deteksi domain AI.')
    } finally {
      setBusyDomainAi(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-muh-500 focus:outline-none focus:ring-2 focus:ring-muh-200'

  return (
    <div className="space-y-4">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muh-600">Atur kuis</p>
          <p className="text-sm font-bold text-slate-900 line-clamp-1">{judul.trim() || 'Tanpa judul'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline">
            {ringkas.jumlahSoal} soal · {ringkas.totalPoin} poin
          </span>
          <button
            type="button"
            className="lms-btn-secondary text-xs"
            disabled={busy || soal.length === 0}
            onClick={urutkanMenurutBentuk}
          >
            Kelompokkan bentuk
          </button>
          <button type="button" className="lms-btn-primary text-xs" disabled={busy} onClick={() => void simpan()}>
            {busy ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{info}</div>
      )}

      {/* Identitas */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <h4 className="text-sm font-bold text-slate-800">Identitas kuis</h4>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Judul</span>
            <input value={judul} onChange={(e) => setJudul(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Deskripsi (opsional)</span>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={2}
              className={inputCls}
              placeholder="Petunjuk singkat untuk siswa…"
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Mode pelaksanaan</span>
            <select
              value={modePelaksanaan}
              onChange={(e) => setModePelaksanaan(e.target.value as ModePelaksanaanKuis)}
              className={inputCls}
            >
              {(Object.keys(NAMA_MODE_PELAKSANAAN) as ModePelaksanaanKuis[]).map((k) => (
                <option key={k} value={k}>
                  {NAMA_MODE_PELAKSANAAN[k]}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">
              Offline: siswa tidak mengerjakan di LMS; guru menginput jawaban di tab «Input offline».
            </span>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Durasi (menit)</span>
            <input
              type="number"
              min={0}
              value={durasi}
              onChange={(e) => setDurasi(Number(e.target.value) || 0)}
              className={inputCls}
            />
            <span className="text-[11px] text-slate-400">0 = tanpa batas waktu</span>
          </label>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600">Opsi pengerjaan</span>
            <div className="flex flex-wrap gap-4 pt-1 text-sm text-slate-700">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-muh-600 focus:ring-muh-500"
                  checked={acakSoal}
                  onChange={(e) => setAcakSoal(e.target.checked)}
                />
                Acak urutan soal
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-muh-600 focus:ring-muh-500"
                  checked={acakOpsi}
                  onChange={(e) => setAcakOpsi(e.target.checked)}
                />
                Acak opsi PG
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Jadwal & akses */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <h4 className="text-sm font-bold text-slate-800">Jadwal & akses</h4>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Waktu mulai</span>
            <input
              type="datetime-local"
              value={waktuMulai}
              onChange={(e) => setWaktuMulai(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Waktu selesai</span>
            <input
              type="datetime-local"
              value={waktuSelesai}
              onChange={(e) => setWaktuSelesai(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Token (opsional)</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="contoh: SD01-2026"
              className={inputCls}
            />
          </label>
        </div>
      </section>

      {/* Penilaian & TP — hanya mapel biasa (bukan TKA); ANTIREGRESI §91 */}
      {!isTka && (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <h4 className="text-sm font-bold text-slate-800">Penilaian & TP</h4>
        </div>
        <div className="space-y-4 p-4">
          <label className="block max-w-md space-y-1">
            <span className="text-xs font-semibold text-slate-600">Jenis penilaian</span>
            <select
              value={jenisPenilaian}
              onChange={(e) => setJenisPenilaian(e.target.value as JenisPenilaianKuis)}
              className={inputCls}
            >
              {(Object.keys(NAMA_JENIS_PENILAIAN) as JenisPenilaianKuis[]).map((k) => (
                <option key={k} value={k}>
                  {NAMA_JENIS_PENILAIAN[k]}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">TP yang diukur</span>
              <button
                type="button"
                className="lms-btn-secondary text-xs"
                disabled={busy}
                onClick={() => void perbaruiTpDariPaket()}
              >
                Perbarui dari paket
              </button>
            </div>
            <div className="min-h-[64px] rounded-xl border border-slate-200 bg-slate-50/50 p-2">
              {tpList.length > 0 ? (
                <ul className="space-y-1.5">
                  {tpList.map((tp, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <span className="flex-1 whitespace-pre-wrap break-words text-slate-800">{tp}</span>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                        onClick={() => setTpList((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        Hapus
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-3 text-xs italic text-slate-400">
                  Belum ada TP. Susun kuis dari paket yang sudah punya TP, atau perbarui dari paket sumber.
                </p>
              )}
            </div>
          </div>

          {(jenisPenilaian === 'slm' || jenisPenilaian === 'sts' || jenisPenilaian === 'sas') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-sm font-bold text-amber-900">Nilai akhir per TP (mode cepat)</h5>
                <span className="text-[11px] font-medium text-amber-700">
                  Jika diisi, ini menjadi sumber nilai (bukan dari analisis)
                </span>
              </div>
              <div className="space-y-2">
                {tpList.map((tp) => (
                  <div key={tp} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 truncate text-sm text-slate-700">{tp}</div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={nilaiPerTp[tp] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setNilaiPerTp((prev) => {
                          const next = { ...prev }
                          if (v === '') delete next[tp]
                          else next[tp] = Number(v)
                          return next
                        })
                      }}
                      className="w-24 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm shadow-sm"
                      placeholder="0–100"
                    />
                  </div>
                ))}
                {tpList.length === 0 && (
                  <p className="text-xs text-slate-500">Isi daftar TP di atas terlebih dahulu.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* Domain TKA — deteksi di Atur kuis (bukan tab Hasil siswa) */}
      {isTka && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Domain penilaian TKA</h4>
              <p className="text-[11px] text-slate-500">
                Setiap soal wajib satu domain: Pengetahuan IPA atau Keterampilan Proses Sains (tidak
                ada campuran). Dipakai untuk kolom nilai di tab Hasil siswa.
              </p>
            </div>
            {bolehDomainAi && (
              <button
                type="button"
                className={nSoalTanpaDomain > 0 ? 'lms-btn-primary text-xs' : 'lms-btn-secondary text-xs'}
                disabled={busyDomainAi || soal.length === 0}
                onClick={() => void deteksiDomainAi(nSoalTanpaDomain === 0)}
              >
                {busyDomainAi
                  ? 'Mendeteksi…'
                  : nSoalTanpaDomain > 0
                    ? `Deteksi domain AI (${nSoalTanpaDomain})`
                    : 'Klasifikasi ulang domain AI'}
              </button>
            )}
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Pengetahuan IPA
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">
                {nSoalDomain.pengetahuan}
                <span className="text-xs font-medium text-slate-400"> soal</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Keterampilan Proses
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">
                {nSoalDomain.keterampilan_proses}
                <span className="text-xs font-medium text-slate-400"> soal</span>
              </p>
            </div>
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                nSoalTanpaDomain > 0
                  ? 'border-amber-200 bg-amber-50/80'
                  : 'border-emerald-100 bg-emerald-50/60'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Belum berlabel
              </p>
              <p
                className={`mt-0.5 text-lg font-bold tabular-nums ${
                  nSoalTanpaDomain > 0 ? 'text-amber-800' : 'text-emerald-800'
                }`}
              >
                {nSoalTanpaDomain}
                <span className="text-xs font-medium opacity-70"> soal</span>
              </p>
            </div>
          </div>
          {nSoalTanpaDomain > 0 && !bolehDomainAi && (
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-amber-800">
              Ada soal tanpa domain. Minta akun AI menjalankan deteksi, atau isi domain manual di
              editor bank soal (field domain TKA).
            </p>
          )}
        </section>
      )}

      {/* Daftar soal */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Daftar soal</h4>
            <p className="text-xs text-slate-500">
              {ringkas.jumlahSoal} soal · total {ringkas.totalPoin} poin · urutan dapat diubah
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {URUTAN_TIPE.map((tipe) => {
            const items = kelompok.get(tipe) ?? []
            if (items.length === 0) return null
            return (
              <div key={tipe} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-md bg-muh-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muh-800">
                      {NAMA_TIPE[tipe]}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{items.length} soal</span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-slate-500">{INSTRUKSI_TIPE[tipe]}</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {items.map(({ soal: s, idxAsli }) => {
                    nomorGlobal += 1
                    const no = nomorGlobal
                    return (
                      <li
                        key={`${s.sumberPaketId}-${s.id}-${idxAsli}`}
                        className="flex flex-wrap items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {no}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800">
                            {teksPolos(s.teks).slice(0, 180) || '(tanpa teks)'}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                              {s.kompleksitas || 'L1'}
                            </span>
                            {isTka && (() => {
                              const d = normalisasiDomainTka(s.domainTka)
                              if (!d) {
                                return (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                                    Domain belum
                                  </span>
                                )
                              }
                              return (
                                <span
                                  className={`rounded px-1.5 py-0.5 font-medium ${
                                    d === 'pengetahuan'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-violet-100 text-violet-800'
                                  }`}
                                  title={NAMA_DOMAIN_TKA[d]}
                                >
                                  {d === 'pengetahuan' ? 'Pengetahuan' : 'Keterampilan proses'}
                                </span>
                              )
                            })()}
                            {s.sumberPaketJudul && (
                              <span className="truncate" title="Sumber paket">
                                ← {s.sumberPaketJudul}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <label className="flex items-center gap-1 text-xs text-slate-600">
                            Poin
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={s.poin}
                              onChange={(e) => setPoin(idxAsli, Number(e.target.value) || 0)}
                              className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-sm shadow-sm"
                            />
                          </label>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            onClick={() => naik(idxAsli)}
                            title="Naikkan"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            onClick={() => turun(idxAsli)}
                            title="Turunkan"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            onClick={() => hapusSoal(idxAsli)}
                          >
                            Hapus
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {soal.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Tidak ada soal</p>
            <p className="mt-1 text-xs text-slate-500">Susun ulang kuis dari bank soal.</p>
          </div>
        )}
      </section>
    </div>
  )
}

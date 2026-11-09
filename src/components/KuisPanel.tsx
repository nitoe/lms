import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { bolehGenerateSoalAi } from '../lib/generateSoalAi'
import {
  buatKuisDariPaket,
  daftarKuis,
  daftarPaketSiap,
  hapusKuis,
  updateKuis,
} from '../lib/kuis'
import {
  deteksiDuplikatKasar,
  hitungRingkasanKuis,
  kumpulkanKandidat,
  susunManual,
  susunOtomatis,
} from '../lib/susunKuis'
import { teksPolos } from '../lib/html'
import type { FilterSusunKuis, KuisLms, ModeSusunKuis, SoalKuis } from '../types/kuis'
import type { KompleksitasSoal, PaketSoal, TipeSoal } from '../types/soal'
import {
  NAMA_KOMPLEKSITAS,
  NAMA_TIPE,
  URUTAN_KOMPLEKSITAS,
  URUTAN_TIPE,
} from '../types/soal'
import KuisDetail, { INSTRUKSI_TIPE } from './KuisDetail'
import HasilKuisPanel from './HasilKuisPanel'

type Props = {
  kelas: string
  mapel: string
}

type Langkah = 'daftar' | 'wizard' | 'detail'

function urutkanMenurutBentuk(list: SoalKuis[]): SoalKuis[] {
  const map = new Map<string, SoalKuis[]>()
  for (const t of URUTAN_TIPE) map.set(t, [])
  for (const s of list) {
    const arr = map.get(s.tipe)
    if (arr) arr.push(s)
  }
  const out: SoalKuis[] = []
  for (const t of URUTAN_TIPE) {
    out.push(...(map.get(t) ?? []))
  }
  return out
}



export default function KuisPanel({ kelas, mapel }: Props) {
  const { profil, user } = useAuth()
  const bolehAi = bolehGenerateSoalAi(user?.uid)

  const [list, setList] = useState<KuisLms[] | null>(null)
  const [paketSiap, setPaketSiap] = useState<PaketSoal[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [langkah, setLangkah] = useState<Langkah>('daftar')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'atur' | 'hasil'>('atur')

  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [paketIds, setPaketIds] = useState<string[]>([])
  const [mode, setMode] = useState<ModeSusunKuis>('otomatis')
  const [jumlahSoal, setJumlahSoal] = useState(10)
  const [tipeAktif, setTipeAktif] = useState<TipeSoal[]>([])
  const [kompleksitasAktif, setKompleksitasAktif] = useState<KompleksitasSoal[]>([])
  const [pilihanManual, setPilihanManual] = useState<{ paketId: string; soalId: string }[]>([])
  const [pratinjau, setPratinjau] = useState<SoalKuis[] | null>(null)
  const [peringatanDuplikat, setPeringatanDuplikat] = useState<string[]>([])

  const muat = useCallback(async () => {
    setError('')
    try {
      const [k, p] = await Promise.all([
        daftarKuis(kelas, mapel),
        daftarPaketSiap(kelas, mapel).catch(() => []),
      ])
      setList(k)
      setPaketSiap(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kuis.')
      setList([])
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  const filterSusun: FilterSusunKuis = useMemo(
    () => ({
      jumlahSoal: jumlahSoal > 0 ? jumlahSoal : undefined,
      tipe: tipeAktif.length ? tipeAktif : undefined,
      kompleksitas: kompleksitasAktif.length ? kompleksitasAktif : undefined,
    }),
    [jumlahSoal, tipeAktif, kompleksitasAktif],
  )

  const kandidat = useMemo(() => {
    const dipilih = paketSiap.filter((p) => paketIds.includes(p.id))
    return kumpulkanKandidat(dipilih)
  }, [paketSiap, paketIds])

  function togglePaket(id: string) {
    setPaketIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPratinjau(null)
    setPeringatanDuplikat([])
  }

  function toggleTipe(t: TipeSoal) {
    setTipeAktif((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
    setPratinjau(null)
  }

  function toggleKompleksitas(k: KompleksitasSoal) {
    setKompleksitasAktif((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    )
    setPratinjau(null)
  }

  function togglePilihanManual(paketId: string, soalId: string) {
    setPilihanManual((prev) => {
      const ada = prev.some((p) => p.paketId === paketId && p.soalId === soalId)
      if (ada) return prev.filter((p) => !(p.paketId === paketId && p.soalId === soalId))
      return [...prev, { paketId, soalId }]
    })
    setPratinjau(null)
  }

  function buatPratinjau() {
    setError('')
    setPeringatanDuplikat([])
    if (!paketIds.length) {
      setError('Pilih minimal satu paket yang siap.')
      return
    }
    try {
      let soal: SoalKuis[]
      if (mode === 'manual') {
        if (!pilihanManual.length) {
          setError('Pilih minimal satu soal secara manual.')
          return
        }
        soal = susunManual(kandidat, pilihanManual)
      } else {
        soal = susunOtomatis(kandidat, filterSusun, { seedAcak: true })
      }
      if (!soal.length) {
        setError('Tidak ada soal yang memenuhi filter. Perlonggar filter atau pilih paket lain.')
        setPratinjau([])
        return
      }
      // Otomatis kelompokkan menurut bentuk soal
      soal = urutkanMenurutBentuk(soal)
      setPratinjau(soal)

      if (mode === 'otomatis_ai' || mode === 'otomatis') {
        const dup = deteksiDuplikatKasar(soal)
        if (dup.length) {
          setPeringatanDuplikat(
            dup.slice(0, 8).map((d) => {
              const a = teksPolos(soal[d.a].teks).slice(0, 60)
              const b = teksPolos(soal[d.b].teks).slice(0, 60)
              return `Soal #${d.a + 1} ≈ #${d.b + 1} (${Math.round(d.skor * 100)}%): «${a}…» ↔ «${b}…»`
            }),
          )
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyusun pratinjau.')
    }
  }

  function buangDuplikatKasar() {
    if (!pratinjau?.length) return
    const dup = deteksiDuplikatKasar(pratinjau)
    if (!dup.length) return
    const buang = new Set<number>()
    for (const d of dup) {
      buang.add(d.b)
    }
    const sisa = urutkanMenurutBentuk(pratinjau.filter((_, i) => !buang.has(i)))
    setPratinjau(sisa)
    setPeringatanDuplikat([])
  }

  async function onSimpanKuis() {
    if (!judul.trim()) {
      setError('Judul kuis wajib diisi.')
      return
    }
    if (!pratinjau?.length) {
      setError('Susun pratinjau soal terlebih dahulu.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Kumpulkan TP unik dari paket yang dipilih
      const tpMap = new Map<string, string>()
      for (const pid of paketIds) {
        const pk = paketSiap.find((x) => x.id === pid)
        if (pk?.tpId && pk.tpNama) {
          const namaBersih = String(pk.tpNama).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
          const label = pk.tpNomor ? `TP ${pk.tpNomor}. ${namaBersih}` : namaBersih
          tpMap.set(pk.tpId, label)
        }
      }
      const tpIds = [...tpMap.keys()]
      const tpNamaList = [...tpMap.values()]

      const id = await buatKuisDariPaket({
        kelas,
        mapel,
        judul,
        deskripsi,
        namaGuru: profil?.nama,
        sumberPaketIds: paketIds,
        modeSusun: mode,
        filterSusun: mode === 'manual' ? undefined : filterSusun,
        soalSiap: pratinjau,
        tpIds: tpIds.length ? tpIds : undefined,
        tpNamaList: tpNamaList.length ? tpNamaList : undefined,
      })
      resetWizard()
      await muat()
      setSelectedId(id)
      setLangkah('detail')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat kuis.')
    } finally {
      setBusy(false)
    }
  }

  function resetWizard() {
    setJudul('')
    setDeskripsi('')
    setPaketIds([])
    setMode(bolehAi ? 'otomatis_ai' : 'otomatis')
    setJumlahSoal(10)
    setTipeAktif([])
    setKompleksitasAktif([])
    setPilihanManual([])
    setPratinjau(null)
    setPeringatanDuplikat([])
  }

  async function onHapus(k: KuisLms) {
    if (!confirm(`Hapus kuis «${k.judul}» beserta ${k.jumlahSoal} soalnya?`)) return
    setBusy(true)
    setError('')
    try {
      await hapusKuis(k.id)
      if (selectedId === k.id) {
        setSelectedId(null)
        setLangkah('daftar')
      }
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  async function onToggleAktif(k: KuisLms) {
    setBusy(true)
    setError('')
    try {
      await updateKuis(k.id, { aktif: !k.aktif })
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusy(false)
    }
  }

  if (langkah === 'detail' && selectedId) {
    const kuis = list?.find((k) => k.id === selectedId)
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="text-sm font-semibold text-muh-600 hover:underline"
          onClick={() => {
            setSelectedId(null)
            setDetailTab('atur')
            setLangkah('daftar')
          }}
        >
          ← Kembali ke daftar kuis
        </button>
        {kuis ? (
          <>
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  detailTab === 'atur' ? 'bg-white text-muh-700 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => setDetailTab('atur')}
              >
                Atur kuis
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  detailTab === 'hasil' ? 'bg-white text-muh-700 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => setDetailTab('hasil')}
              >
                Hasil siswa
              </button>
            </div>
            {detailTab === 'atur' ? (
              <KuisDetail
                kuis={kuis}
                onUpdated={async () => {
                  await muat()
                }}
              />
            ) : (
              <HasilKuisPanel kuis={kuis} />
            )}
          </>
        ) : (
          <div className="lms-empty">Kuis tidak ditemukan.</div>
        )}
      </div>
    )
  }

  if (langkah === 'wizard') {
    const ringkas = pratinjau ? hitungRingkasanKuis(pratinjau) : null
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-sm font-semibold text-muh-600 hover:underline"
            onClick={() => {
              resetWizard()
              setLangkah('daftar')
            }}
          >
            ← Batal
          </button>
          <h3 className="text-sm font-semibold text-slate-900">Susun kuis dari bank soal</h3>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <div className="materi-form space-y-3">
          <label className="materi-field">
            <span>Judul kuis</span>
            <input
              required
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Kuis IPAS — Organ Pernapasan"
            />
          </label>
          <label className="materi-field">
            <span>Deskripsi (opsional)</span>
            <textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Petunjuk singkat untuk siswa"
            />
          </label>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">1. Pilih paket soal (status Siap)</h4>
          {paketSiap.length === 0 ? (
            <p className="text-sm text-slate-600">
              Belum ada paket berstatus <strong>Siap</strong>. Buka tab Bank Soal, lengkapi paket, lalu
              ubah status menjadi Siap.
            </p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-auto">
              {paketSiap.map((p) => (
                <li key={p.id}>
                  <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={paketIds.includes(p.id)}
                      onChange={() => togglePaket(p.id)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">{p.judul}</div>
                      <div className="text-xs text-slate-500">
                        {p.jumlahSoal} soal · {p.totalPoin} poin
                        {p.tpNama ? ` · TP ${p.tpNomor ? `${p.tpNomor}. ` : ''}${p.tpNama}` : ''}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">2. Cara menyusun</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`lms-btn-secondary ${mode === 'manual' ? 'ring-2 ring-muh-400' : ''}`}
              onClick={() => {
                setMode('manual')
                setPratinjau(null)
              }}
            >
              Pilih manual
            </button>
            <button
              type="button"
              className={`lms-btn-secondary ${mode === 'otomatis' ? 'ring-2 ring-muh-400' : ''}`}
              onClick={() => {
                setMode('otomatis')
                setPratinjau(null)
              }}
            >
              Susun otomatis
            </button>
            {bolehAi && (
              <button
                type="button"
                className={`lms-btn-secondary ${mode === 'otomatis_ai' ? 'ring-2 ring-muh-400' : ''}`}
                onClick={() => {
                  setMode('otomatis_ai')
                  setPratinjau(null)
                }}
              >
                Susun + bantuan AI
              </button>
            )}
          </div>
          {mode === 'otomatis_ai' && (
            <p className="text-xs text-slate-600">
              Sistem menyusun dari filter, lalu menandai soal yang sama atau hampir sama (teks/esensi)
              agar bisa dibuang sebelum disimpan.
            </p>
          )}
        </section>

        {(mode === 'otomatis' || mode === 'otomatis_ai') && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">3. Filter penyusunan</h4>
            <label className="materi-field" style={{ maxWidth: '10rem' }}>
              <span>Jumlah soal</span>
              <input
                type="number"
                min={1}
                max={100}
                value={jumlahSoal}
                onChange={(e) => {
                  setJumlahSoal(Number(e.target.value) || 1)
                  setPratinjau(null)
                }}
              />
            </label>
            <div>
              <span className="text-xs font-semibold text-slate-600">Bentuk soal (kosong = semua)</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {URUTAN_TIPE.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTipe(t)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      tipeAktif.includes(t)
                        ? 'bg-muh-100 text-muh-800 ring-1 ring-muh-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {NAMA_TIPE[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600">
                Kompleksitas (kosong = semua)
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {URUTAN_KOMPLEKSITAS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKompleksitas(k)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      kompleksitasAktif.includes(k)
                        ? 'bg-violet-100 text-violet-800 ring-1 ring-violet-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {NAMA_KOMPLEKSITAS[k]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Bobot awal setiap soal = <strong>1 poin</strong>. Anda bisa mengubahnya setelah kuis
              dibuat.
            </p>
          </section>
        )}

        {mode === 'manual' && paketIds.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">
              3. Pilih soal ({pilihanManual.length} dipilih)
            </h4>
            <div className="max-h-72 space-y-4 overflow-auto">
              {paketSiap
                .filter((p) => paketIds.includes(p.id))
                .map((p) => (
                  <div key={p.id}>
                    <div className="text-xs font-semibold text-slate-500 mb-1">{p.judul}</div>
                    <ul className="space-y-1">
                      {(p.soal ?? []).map((s, i) => {
                        const checked = pilihanManual.some(
                          (x) => x.paketId === p.id && x.soalId === s.id,
                        )
                        return (
                          <li key={s.id}>
                            <label className="flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={() => togglePilihanManual(p.id, s.id)}
                              />
                              <span className="min-w-0">
                                <span className="text-slate-500 mr-1">{i + 1}.</span>
                                {teksPolos(s.teks).slice(0, 100) || '(tanpa teks)'}
                                <span className="ml-1 text-[10px] uppercase text-slate-400">
                                  {s.tipe} · {s.kompleksitas || 'L1'}
                                </span>
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="lms-btn-secondary" onClick={buatPratinjau} disabled={busy}>
            Susun pratinjau
          </button>
          {pratinjau && peringatanDuplikat.length > 0 && (
            <button type="button" className="lms-btn-secondary" onClick={buangDuplikatKasar}>
              Buang yang mirip ({peringatanDuplikat.length} pasangan)
            </button>
          )}
        </div>

        {peringatanDuplikat.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 space-y-1">
            <p className="font-semibold">Kemungkinan soal mirip / sama:</p>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              {peringatanDuplikat.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {mode === 'otomatis_ai' && (
              <p className="text-xs mt-1">
                Deteksi teks kasar (Jaccard). Untuk analisis esensi lebih dalam, fitur AI server akan
                ditambahkan pada iterasi berikutnya.
              </p>
            )}
          </div>
        )}

        {pratinjau && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">
                Pratinjau · {ringkas?.jumlahSoal ?? 0} soal · {ringkas?.totalPoin ?? 0} poin
              </h4>
              <button
                type="button"
                className="lms-btn-primary"
                disabled={busy || !judul.trim()}
                onClick={() => void onSimpanKuis()}
              >
                {busy ? 'Menyimpan…' : 'Simpan kuis'}
              </button>
            </div>
            <div className="max-h-80 overflow-auto space-y-4 text-sm">
              {(() => {
                const kelompok = new Map<string, SoalKuis[]>()
                for (const t of URUTAN_TIPE) kelompok.set(t, [])
                for (const s of pratinjau) {
                  const arr = kelompok.get(s.tipe)
                  if (arr) arr.push(s)
                }
                let no = 0
                return URUTAN_TIPE.map((tipe) => {
                  const items = kelompok.get(tipe) ?? []
                  if (items.length === 0) return null
                  return (
                    <div key={tipe}>
                      <div className="rounded bg-slate-50 px-2 py-1.5 border border-slate-100 mb-1">
                        <div className="text-xs font-bold text-slate-700">
                          {NAMA_TIPE[tipe]} ({items.length})
                        </div>
                        <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                          {INSTRUKSI_TIPE[tipe]}
                        </div>
                      </div>
                      <ol className="space-y-1 pl-1">
                        {items.map((s, j) => {
                          no += 1
                          return (
                            <li key={`${s.sumberPaketId}-${s.id}-${j}`} className="border-b border-slate-50 py-1">
                              <span className="text-slate-400 mr-1">{no}.</span>
                              {teksPolos(s.teks).slice(0, 110) || '(tanpa teks)'}
                              <span className="ml-1 text-[10px] text-slate-400">
                                {s.kompleksitas || 'L1'} · {s.poin}p
                                {s.sumberPaketJudul ? ` · ${s.sumberPaketJudul}` : ''}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  )
                })
              })()}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="lms-count-pill">{list === null ? '…' : `${list.length} kuis`}</span>
        </div>
        <button
          type="button"
          className="lms-btn-primary"
          onClick={() => {
            resetWizard()
            setMode(bolehAi ? 'otomatis_ai' : 'otomatis')
            setLangkah('wizard')
          }}
        >
          + Kuis baru
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {list === null && <div className="lms-empty">Memuat kuis…</div>}

      {list && list.length === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada kuis</p>
          <p className="mt-1">
            Buat kuis dari paket bank soal yang sudah berstatus <strong>Siap</strong>.
          </p>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="materi-list">
          {list.map((k) => (
            <li key={k.id} className="materi-item">
              <div className="materi-item-body">
                <div className="materi-item-title">{k.judul}</div>
                <div className="materi-item-meta">
                  <span>
                    {k.jumlahSoal ?? k.soal?.length ?? 0} soal
                    {typeof k.totalPoin === 'number' ? ` · ${k.totalPoin} poin` : ''}
                  </span>
                  <span className={k.aktif ? 'text-emerald-700' : 'text-slate-500'}>
                    {k.aktif ? 'Aktif' : 'Draf'}
                  </span>
                  {k.modeSusun && (
                    <span className="text-slate-400">
                      {k.modeSusun === 'manual'
                        ? 'manual'
                        : k.modeSusun === 'otomatis_ai'
                          ? 'otomatis+AI'
                          : 'otomatis'}
                    </span>
                  )}
                </div>
              </div>
              <div className="materi-item-actions">
                <button
                  type="button"
                  className="lms-btn-primary"
                  onClick={() => {
                    setSelectedId(k.id)
                    setLangkah('detail')
                  }}
                >
                  Buka
                </button>
                <button
                  type="button"
                  className="lms-btn-secondary"
                  disabled={busy}
                  onClick={() => void onToggleAktif(k)}
                >
                  {k.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onHapus(k)}
                  className="materi-btn-danger"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

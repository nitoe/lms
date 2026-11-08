import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import SoalEditorKartu from '../components/soal/SoalEditorKartu'
import PratinjauSoal from '../components/soal/PratinjauSoal'
import { useAuth } from '../context/AuthContext'
import {
  ambilPaket,
  BATAS_UKURAN_PAKET,
  masalahSoal,
  ringkasSoal,
  salinSoal,
  simpanPaket,
  soalBaru,
  ukuranPerkiraan,
  type PerubahanPaket,
} from '../lib/soal'
import { daftarSoalButuhStimulus } from '../lib/analisisSoal'
import { parseRuangId } from '../lib/kelasLms'
import { getTpMapelKelas } from '../lib/tpData'
import type { TpRingkas } from '../types/materi'
import type { PaketSoal, Soal, TipeSoal } from '../types/soal'
import { BATAS_SOAL_PER_PAKET, NAMA_TIPE, URUTAN_TIPE, normalisasiKompleksitas } from '../types/soal'
import '../styles/soal.css'

type StatusSimpan = 'tersimpan' | 'menunggu' | 'menyimpan' | 'gagal'

const LABEL_SIMPAN: Record<StatusSimpan, string> = {
  tersimpan: 'Tersimpan',
  menunggu: 'Perubahan belum tersimpan…',
  menyimpan: 'Menyimpan…',
  gagal: 'Gagal menyimpan — periksa koneksi',
}

const SINGKAT_TIPE: Record<TipeSoal, string> = {
  pg: 'PG', pgk: 'PG kompleks', jodoh: 'Jodoh', bs: 'B/S', isian: 'Isian', uraian: 'Uraian',
}

export default function SoalEditor() {
  const { ruangId = '', paketId = '' } = useParams()
  const { user } = useAuth()
  const ruang = useMemo(() => parseRuangId(decodeURIComponent(ruangId)), [ruangId])
  const kembaliKe = `/kelas/${ruangId}?tab=soal`

  const [paket, setPaket] = useState<PaketSoal | null>(null)
  const [galatMuat, setGalatMuat] = useState('')
  const [aktifId, setAktifId] = useState<string>('')
  const [status, setStatus] = useState<StatusSimpan>('tersimpan')
  const [galatSimpan, setGalatSimpan] = useState('')
  const [cari, setCari] = useState('')
  const [menuTambah, setMenuTambah] = useState(false)
  const [menuAksi, setMenuAksi] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [pengaturan, setPengaturan] = useState(false)
  const [pratinjau, setPratinjau] = useState(false)
  const [panelAnalisis, setPanelAnalisis] = useState(false)
  const [tpList, setTpList] = useState<TpRingkas[]>([])
  const [seretDari, setSeretDari] = useState<number | null>(null)

  /* ── Muat ── */
  useEffect(() => {
    let batal = false
    ambilPaket(paketId)
      .then((p) => {
        if (batal) return
        if (!p) return setGalatMuat('Paket soal tidak ditemukan.')
        setPaket(p)
        setAktifId(p.soal[0]?.id ?? '')
        void getTpMapelKelas(p.mapel, p.kelas).then((t) => !batal && setTpList(t)).catch(() => undefined)
      })
      .catch((e: unknown) => !batal && setGalatMuat(e instanceof Error ? e.message : 'Gagal memuat paket.'))
    return () => {
      batal = true
    }
  }, [paketId])

  /* ── Simpan otomatis (debounce, antrean serial) ── */
  const tertunda = useRef<PerubahanPaket>({})
  const sedangSimpan = useRef(false)
  const pewaktu = useRef<number | null>(null)

  const siram = useCallback(async () => {
    if (sedangSimpan.current) return
    if (Object.keys(tertunda.current).length === 0) return
    const paketan = tertunda.current
    tertunda.current = {}
    sedangSimpan.current = true
    setStatus('menyimpan')
    setGalatSimpan('')
    try {
      if (paketan.soal && ukuranPerkiraan({ soal: paketan.soal, judul: paketan.judul ?? '', deskripsi: paketan.deskripsi }) > BATAS_UKURAN_PAKET) {
        throw new Error('Paket terlalu besar untuk satu dokumen. Pecah menjadi dua paket.')
      }
      await simpanPaket(paketId, paketan)
      setStatus(Object.keys(tertunda.current).length ? 'menunggu' : 'tersimpan')
    } catch (e) {
      tertunda.current = { ...paketan, ...tertunda.current }
      setStatus('gagal')
      setGalatSimpan(e instanceof Error ? e.message : 'Gagal menyimpan.')
      sedangSimpan.current = false
      return
    }
    sedangSimpan.current = false
    if (Object.keys(tertunda.current).length) void siram()
  }, [paketId])

  const ubah = useCallback(
    (p: PerubahanPaket) => {
      // Jika terkunci, hanya izinkan kembalikan ke draf
      if (paket?.status === 'siap' && !(Object.keys(p).length === 1 && p.status === 'draf')) {
        return
      }
      setPaket((prev) => (prev ? { ...prev, ...p } : prev))
      tertunda.current = { ...tertunda.current, ...p }
      setStatus('menunggu')
      if (pewaktu.current) window.clearTimeout(pewaktu.current)
      pewaktu.current = window.setTimeout(() => void siram(), 1200)
    },
    [siram, paket?.status],
  )

  // Simpan sisa perubahan saat meninggalkan halaman; peringatkan bila tab ditutup sebelum tersimpan.
  useEffect(() => {
    const sebelumTutup = (e: BeforeUnloadEvent) => {
      if (Object.keys(tertunda.current).length) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', sebelumTutup)
    return () => {
      window.removeEventListener('beforeunload', sebelumTutup)
      if (pewaktu.current) window.clearTimeout(pewaktu.current)
      void siram()
    }
  }, [siram])

  // Tutup menu aksi saat klik di luar atau scroll (menu di-portal ke body)
  useEffect(() => {
    if (!menuAksi) return
    const tutup = () => {
      setMenuAksi(null)
      setMenuPos(null)
    }
    const onPointer = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('[data-menu-aksi]')) return
      tutup()
    }
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('scroll', tutup, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('scroll', tutup, true)
    }
  }, [menuAksi])

  /* ── Operasi soal ── */
  const soalList = paket?.soal ?? []
  const aktifIdx = Math.max(0, soalList.findIndex((s) => s.id === aktifId))
  const aktif = soalList[aktifIdx]

  const setSoal = (soal: Soal[]) => ubah({ soal })

  function tambahSoal(tipe: TipeSoal) {
    if (soalList.length >= BATAS_SOAL_PER_PAKET) return
    const s = soalBaru(tipe)
    const idx = soalList.length ? aktifIdx + 1 : 0
    const baru = [...soalList.slice(0, idx), s, ...soalList.slice(idx)]
    setSoal(baru)
    setAktifId(s.id)
    setMenuTambah(false)
  }

  function ubahSoal(s: Soal) {
    setSoal(soalList.map((x) => (x.id === s.id ? s : x)))
  }

  function duplikat(i: number) {
    if (soalList.length >= BATAS_SOAL_PER_PAKET) return
    const s = salinSoal(soalList[i])
    setSoal([...soalList.slice(0, i + 1), s, ...soalList.slice(i + 1)])
    setAktifId(s.id)
    setMenuAksi(null)
  }

  function hapus(i: number) {
    if (!confirm(`Hapus soal nomor ${i + 1}?`)) return
    const sisa = soalList.filter((_, k) => k !== i)
    setSoal(sisa)
    setAktifId(sisa[Math.min(i, sisa.length - 1)]?.id ?? '')
    setMenuAksi(null)
  }

  function pindah(dari: number, ke: number) {
    if (ke < 0 || ke >= soalList.length || dari === ke) return
    const salin = [...soalList]
    const [x] = salin.splice(dari, 1)
    salin.splice(ke, 0, x)
    setSoal(salin)
    setMenuAksi(null)
  }

  const terlihat = useMemo(() => {
    const s = cari.trim().toLowerCase()
    return soalList
      .map((x, i) => ({ x, i }))
      .filter(({ x }) => !s || ringkasSoal(x).toLowerCase().includes(s))
  }, [soalList, cari])

  const totalMenit = soalList.reduce((t, s) => t + (Number(s.waktuMenit) || 0), 0)
  const totalPoin = soalList.reduce((t, s) => t + (Number(s.poin) || 0), 0)
  const jumlahBermasalah = soalList.filter((s) => masalahSoal(s).length > 0).length
  const butuhStimulus = daftarSoalButuhStimulus(soalList)
  const uidAnalisis = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
  const bolehAnalisis = user?.uid === uidAnalisis
  const bisaSiap = soalList.length > 0 && jumlahBermasalah === 0

  if (!ruang) {
    return <div className="lms-empty">Tautan ruang kelas tidak valid.</div>
  }
  if (galatMuat) {
    return (
      <div className="space-y-3">
        <Link to={kembaliKe} className="text-sm font-semibold text-muh-600 hover:underline">← Kembali ke bank soal</Link>
        <div className="lms-empty">{galatMuat}</div>
      </div>
    )
  }
  if (!paket) return <div className="lms-empty">Memuat editor soal…</div>

  const milikSendiri = paket.dibuatOleh === user?.uid
  const terkunci = paket.status === 'siap'

  return (
    <div className="soal-halaman">
      {/* Bilah atas */}
      <div className="soal-bar">
        <Link to={kembaliKe} className="soal-bar-kembali" aria-label="Kembali ke bank soal" title="Kembali">←</Link>
        <span className={`soal-simpan soal-simpan--${status}`} role="status" title={galatSimpan || undefined}>
          {LABEL_SIMPAN[status]}
        </span>
        <input
          className="soal-judul-input"
          value={paket.judul}
          maxLength={200}
          aria-label="Judul paket soal"
          disabled={terkunci}
          onChange={(e) => ubah({ judul: e.target.value })}
          onBlur={() => !paket.judul.trim() && ubah({ judul: 'Paket soal tanpa judul' })}
        />
        <div className="soal-bar-aksi">
          <button type="button" className={`lms-btn-secondary ${pengaturan ? 'ring-2 ring-muh-300' : ''}`}
            onClick={() => setPengaturan((v) => !v)} aria-expanded={pengaturan}>
            ⚙ Pengaturan
          </button>
          <button type="button" className="lms-btn-secondary" onClick={() => setPratinjau(true)}>▶ Pratinjau</button>
          {bolehAnalisis && (
            <button type="button" className={`lms-btn-secondary ${panelAnalisis ? 'ring-2 ring-amber-400' : ''}`}
              onClick={() => setPanelAnalisis((v) => !v)} title="Analisis soal yang butuh stimulus/ilustrasi">
              🔍 Analisis
            </button>
          )}
          {paket.status === 'siap' ? (
            <button type="button" className="lms-btn-secondary" onClick={() => ubah({ status: 'draf' })}>
              Kembalikan ke draf
            </button>
          ) : (
            <button type="button" className="lms-btn-primary" disabled={!bisaSiap}
              title={bisaSiap ? 'Tandai paket siap dipakai' : 'Lengkapi semua soal terlebih dahulu'}
              onClick={() => ubah({ status: 'siap' })}>
              Tandai siap
            </button>
          )}
        </div>
      </div>

      {galatSimpan && <div className="soal-galat-bar" role="alert">{galatSimpan}</div>}
      {terkunci && (
        <div className="soal-info-bar" style={{background:'#fff7ed', borderColor:'#fed7aa', color:'#9a3412'}}>
          Paket ini sudah ditandai <strong>Siap</strong>. Untuk mengedit, klik <strong>Kembalikan ke draf</strong> terlebih dahulu.
        </div>
      )}

      {!milikSendiri && (
        <div className="soal-info-bar">
          Paket ini dibuat oleh {paket.dibuatOlehNama || 'guru lain'}. Perubahan Anda akan tersimpan di paket yang sama.
        </div>
      )}

      {pengaturan && (
        <section className="materi-form" aria-label="Pengaturan paket">
          <div className="materi-form-grid">
            <label className="materi-field materi-field--full">
              <span>Deskripsi / petunjuk untuk siswa</span>
              <textarea rows={2} maxLength={1000} value={paket.deskripsi ?? ''}
                disabled={terkunci} onChange={(e) => ubah({ deskripsi: e.target.value })} placeholder="Contoh: Kerjakan dengan teliti ya." />
            </label>
            <label className="materi-field">
              <span>Tujuan Pembelajaran</span>
              <select value={paket.tpId ?? ''} disabled={terkunci} onChange={(e) => {
                const tp = tpList.find((t) => t.id === e.target.value)
                ubah({ tpId: tp?.id ?? '', tpNomor: tp?.nomorTp ?? 0, tpNama: tp?.namaTp ?? '' })
              }}>
                <option value="">— tanpa TP —</option>
                {tpList.map((t) => <option key={t.id} value={t.id}>TP {t.nomorTp}. {t.namaTp}</option>)}
              </select>
            </label>
            <label className="soal-cek">
              <input type="checkbox" checked={paket.acakSoal} disabled={terkunci} onChange={(e) => ubah({ acakSoal: e.target.checked })} />
              <span>Acak urutan soal untuk tiap siswa</span>
            </label>
          </div>
        </section>
      )}

      <div className="soal-grid">
        {/* Samping: daftar soal */}
        <aside className="soal-samping" aria-label="Daftar soal">
          <div className="soal-samping-kepala">
            <h2 className="soal-samping-judul">SOAL ({soalList.length})</h2>
            <div className="soal-tambah-wrap">
              <button type="button" className="soal-ikon-btn" aria-label="Tambah soal" aria-expanded={menuTambah}
                disabled={terkunci || soalList.length >= BATAS_SOAL_PER_PAKET} onClick={() => setMenuTambah((v) => !v)}>+</button>
              {menuTambah && (
                <ul className="soal-menu soal-menu--tambah" role="menu">
                  {URUTAN_TIPE.map((t) => (
                    <li key={t}><button type="button" role="menuitem" onClick={() => tambahSoal(t)}>{NAMA_TIPE[t]}</button></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="lms-search soal-cari">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
            </svg>
            <input type="search" placeholder="Cari soal…" value={cari} onChange={(e) => setCari(e.target.value)}
              aria-label="Cari soal" />
          </div>

          <ol className="soal-daftar">
            {terlihat.map(({ x, i }) => {
              const bermasalah = masalahSoal(x).length > 0
              return (
                <li
                  key={x.id}
                  className={`soal-item ${x.id === aktif?.id ? 'soal-item--aktif' : ''} ${seretDari === i ? 'soal-item--seret' : ''}`}
                  draggable={!cari && !terkunci}
                  onDragStart={() => setSeretDari(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (seretDari !== null) pindah(seretDari, i)
                    setSeretDari(null)
                  }}
                  onDragEnd={() => setSeretDari(null)}
                >
                  <button type="button" className="soal-item-utama" onClick={() => setAktifId(x.id)}>
                    <span className="soal-item-no">{i + 1}</span>
                    <span className="soal-item-teks">{ringkasSoal(x)}</span>
                    {bermasalah && <span className="soal-item-titik" title="Perlu dilengkapi" aria-label="Perlu dilengkapi" />}
                  </button>
                  <div className="soal-item-baris">
                    <div className="soal-item-chips">
                      <span className="soal-chip">{SINGKAT_TIPE[x.tipe]}</span>
                      <span className={`soal-chip soal-chip--${normalisasiKompleksitas(x.kompleksitas).toLowerCase()}`}>
                        {normalisasiKompleksitas(x.kompleksitas)}
                      </span>
                    </div>
                    <div className="soal-tambah-wrap">
                      <button type="button" className="soal-ikon-btn soal-ikon-btn--tipis" aria-label={`Aksi soal ${i + 1}`}
                        aria-expanded={menuAksi === x.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (menuAksi === x.id) {
                            setMenuAksi(null)
                            setMenuPos(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                            setMenuAksi(x.id)
                          }
                        }}>⋯</button>
                    </div>
                  </div>
                </li>
              )
            })}
            {terlihat.length === 0 && <li className="soal-kosong-kecil">{soalList.length ? 'Tidak ada yang cocok.' : 'Belum ada soal.'}</li>}
          </ol>

          <dl className="soal-ringkas">
            <div><dt>Total poin</dt><dd>{Math.round(totalPoin * 100) / 100}</dd></div>
            <div><dt>Estimasi</dt><dd>{Math.round(totalMenit * 10) / 10} menit</dd></div>
            <div><dt>Perlu dilengkapi</dt><dd className={jumlahBermasalah ? 'soal-ringkas--warn' : ''}>{jumlahBermasalah}</dd></div>
          </dl>
        </aside>

        {/* Utama: kartu soal aktif */}
        <main className="soal-utama">
          {aktif ? (
            <>
              <SoalEditorKartu
                key={aktif.id}
                soal={aktif}
                nomor={aktifIdx + 1}
                onChange={ubahSoal}
                kelas={paket.kelas}
                mapel={paket.mapel}
                tpNama={paket.tpNama}
                tpNomor={paket.tpNomor}
                uid={user?.uid}
                soalLain={soalList.filter((s) => s.id !== aktif.id).map((s) => ringkasSoal(s))}
              />
              <nav className="soal-nav" aria-label="Pindah soal">
                <button type="button" className="lms-btn-secondary" disabled={aktifIdx === 0}
                  onClick={() => setAktifId(soalList[aktifIdx - 1].id)}>← Soal sebelumnya</button>
                <button type="button" className="lms-btn-secondary" onClick={() => tambahSoal(aktif.tipe)}
                  disabled={terkunci || soalList.length >= BATAS_SOAL_PER_PAKET}>+ Soal {NAMA_TIPE[aktif.tipe].toLowerCase()}</button>
                <button type="button" className="lms-btn-secondary" disabled={aktifIdx === soalList.length - 1}
                  onClick={() => setAktifId(soalList[aktifIdx + 1].id)}>Soal berikutnya →</button>
              </nav>
            </>
          ) : (
            <div className="lms-empty">
              <p className="font-medium text-slate-700">Paket ini belum punya soal</p>
              <p className="mt-1">Pilih tipe soal pertama:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {URUTAN_TIPE.map((t) => (
                  <button key={t} type="button" className="lms-btn-secondary" onClick={() => tambahSoal(t)}>{NAMA_TIPE[t]}</button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Panel Analisis Stimulus (khusus user tertentu) */}
      {bolehAnalisis && panelAnalisis && (
        <aside className="soal-panel-analisis" aria-label="Analisis stimulus">
          <div className="soal-panel-analisis-header">
            <strong>Soal butuh stimulus/ilustrasi</strong>
            <button type="button" className="lms-btn-secondary" onClick={() => setPanelAnalisis(false)}>Tutup</button>
          </div>
          {butuhStimulus.length === 0 ? (
            <p className="soal-kosong-kecil">Tidak ada soal yang terdeteksi butuh stimulus.</p>
          ) : (
            <ol className="soal-analisis-list">
              {butuhStimulus.map(({ soal, nomor }: { soal: Soal; nomor: number }) => (
                <li key={soal.id}>
                  <button type="button" className="soal-analisis-item" onClick={() => setAktifId(soal.id)}>
                    <span className="soal-analisis-nomor">{nomor}</span>
                    <span className="soal-analisis-teks">{ringkasSoal(soal).slice(0, 80)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="soal-analisis-catatan">
            Deteksi berdasarkan kata kunci (gambar, tabel, perhatikan, dll.) dan belum ada gambar.
          </p>
        </aside>
      )}


      {pratinjau && <PratinjauSoal paket={paket} onTutup={() => setPratinjau(false)} />}

      {menuAksi && menuPos && createPortal(
        <ul
          className="soal-menu soal-menu--kanan"
          role="menu"
          data-menu-aksi
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 1000,
            margin: 0,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {(() => {
            const idx = soalList.findIndex((s) => s.id === menuAksi)
            if (idx < 0) return null
            return (
              <>
                <li><button type="button" role="menuitem" disabled={terkunci} onClick={() => duplikat(idx)}>Duplikat</button></li>
                <li><button type="button" role="menuitem" disabled={terkunci || idx === 0} onClick={() => pindah(idx, idx - 1)}>Naikkan</button></li>
                <li><button type="button" role="menuitem" disabled={terkunci || idx === soalList.length - 1} onClick={() => pindah(idx, idx + 1)}>Turunkan</button></li>
                <li><button type="button" role="menuitem" className="soal-menu-bahaya" disabled={terkunci} onClick={() => hapus(idx)}>Hapus</button></li>
              </>
            )
          })()}
        </ul>,
        document.body,
      )}
    </div>
  )
}

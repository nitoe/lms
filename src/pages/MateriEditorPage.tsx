import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MateriBaca from '../components/materi/MateriBaca'
import MateriEditor from '../components/materi/MateriEditor'
import {
  ambilMateri,
  halamanBaru,
  halamanKosong,
  idHalamanBaru,
  muatIsi,
  simpanIsi,
  ukuranIsi,
} from '../lib/materiHalaman'
import { aksenMapel } from '../lib/uiAksen'
import type { HalamanMateri, MateriLms, StatusMateri } from '../types/materi'
import { BATAS_HALAMAN } from '../types/materi'
import '../styles/materi.css'

type StatusSimpan = 'tersimpan' | 'menunggu' | 'menyimpan' | 'gagal'

const LABEL_SIMPAN: Record<StatusSimpan, string> = {
  tersimpan: 'Tersimpan',
  menunggu: 'Perubahan belum tersimpan…',
  menyimpan: 'Menyimpan…',
  gagal: 'Gagal menyimpan — periksa koneksi',
}

export default function MateriEditorPage() {
  const { ruangId = '', materiId = '' } = useParams()
  const navigate = useNavigate()
  const kembaliKe = `/kelas/${ruangId}?tab=materi`

  const [materi, setMateri] = useState<MateriLms | null>(null)
  const [halaman, setHalaman] = useState<HalamanMateri[]>([])
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [aktifId, setAktifId] = useState('')
  const [status, setStatus] = useState<StatusSimpan>('tersimpan')
  const [galat, setGalat] = useState('')
  const [galatMuat, setGalatMuat] = useState('')
  const [pratinjau, setPratinjau] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  // Nilai terbaru untuk simpan otomatis (hindari closure usang).
  const ref = useRef({ materi: null as MateriLms | null, halaman: [] as HalamanMateri[], judul: '', deskripsi: '' })
  const versi = useRef(0)
  /** true selama ada perubahan yang belum tersimpan. */
  const kotor = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const sedang = useRef(false)
  const ulang = useRef(false)

  useEffect(() => {
    ref.current = { materi, halaman, judul, deskripsi }
  }, [materi, halaman, judul, deskripsi])

  /* ── Muat ── */
  useEffect(() => {
    let batal = false
    Promise.all([ambilMateri(materiId), muatIsi(materiId)])
      .then(([m, isi]) => {
        if (batal) return
        if (!m || !isi || m.jenis !== 'halaman') return setGalatMuat('Materi tidak ditemukan atau bukan materi tulis-sendiri.')
        const h = isi.halaman.length ? isi.halaman : [halamanBaru('Halaman 1')]
        ref.current = { materi: m, halaman: h, judul: m.judul, deskripsi: m.deskripsi ?? '' }
        setMateri(m)
        setHalaman(h)
        setJudul(m.judul)
        setDeskripsi(m.deskripsi ?? '')
        setAktifId(h[0].id)
      })
      .catch((e: unknown) => !batal && setGalatMuat(e instanceof Error ? e.message : 'Gagal memuat materi.'))
    return () => {
      batal = true
    }
  }, [materiId])

  /* ── Simpan ── */
  const simpan = useCallback(async (statusBaru?: StatusMateri): Promise<boolean> => {
    const r = ref.current
    if (!r.materi) return false
    if (sedang.current) {
      ulang.current = true
      return false
    }
    sedang.current = true
    window.clearTimeout(timer.current)
    setStatus('menyimpan')
    setGalat('')
    const v = versi.current
    try {
      await simpanIsi({ materi: r.materi, halaman: r.halaman, judul: r.judul, deskripsi: r.deskripsi, status: statusBaru })
      if (statusBaru) {
        const baru = { ...r.materi, status: statusBaru, judul: r.judul.trim() }
        ref.current.materi = baru
        setMateri(baru)
      }
      if (versi.current === v) kotor.current = false
      setStatus(versi.current === v ? 'tersimpan' : 'menunggu')
      return true
    } catch (e) {
      setStatus('gagal')
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.')
      return false
    } finally {
      sedang.current = false
      if (ulang.current) {
        ulang.current = false
        timer.current = window.setTimeout(() => void simpan(), 400)
      }
    }
  }, [])

  const tandaiKotor = useCallback(() => {
    versi.current += 1
    kotor.current = true
    setStatus('menunggu')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void simpan(), 2500)
  }, [simpan])

  // Simpan sisa perubahan saat keluar halaman; peringatan saat menutup tab.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (kotor.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      if (kotor.current) void simpan()
    }
  }, [simpan])

  /* ── Operasi halaman ── */
  const aktif = halaman.find((h) => h.id === aktifId) ?? halaman[0]
  const idxAktif = aktif ? halaman.findIndex((h) => h.id === aktif.id) : 0

  function ubahHalaman(id: string, patch: Partial<HalamanMateri>) {
    setHalaman((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))
    tandaiKotor()
  }

  function tambahHalaman() {
    if (halaman.length >= BATAS_HALAMAN.maksHalaman) return setGalat(`Maksimal ${BATAS_HALAMAN.maksHalaman} halaman.`)
    const b = halamanBaru(`Halaman ${halaman.length + 1}`)
    setHalaman((prev) => [...prev.slice(0, idxAktif + 1), b, ...prev.slice(idxAktif + 1)])
    setAktifId(b.id)
    tandaiKotor()
  }

  function duplikat() {
    if (!aktif) return
    if (halaman.length >= BATAS_HALAMAN.maksHalaman) return setGalat(`Maksimal ${BATAS_HALAMAN.maksHalaman} halaman.`)
    const b: HalamanMateri = { id: idHalamanBaru(), judul: `${aktif.judul} (salinan)`.trim(), html: aktif.html }
    setHalaman((prev) => [...prev.slice(0, idxAktif + 1), b, ...prev.slice(idxAktif + 1)])
    setAktifId(b.id)
    tandaiKotor()
  }

  function hapus() {
    if (!aktif || halaman.length <= 1) return
    if (!confirm(`Hapus halaman ${idxAktif + 1}${aktif.judul ? ` «${aktif.judul}»` : ''}?`)) return
    const sisa = halaman.filter((h) => h.id !== aktif.id)
    setHalaman(sisa)
    setAktifId(sisa[Math.min(idxAktif, sisa.length - 1)].id)
    tandaiKotor()
  }

  function geser(arah: -1 | 1) {
    const ke = idxAktif + arah
    if (ke < 0 || ke >= halaman.length) return
    setHalaman((prev) => {
      const s = [...prev]
      ;[s[idxAktif], s[ke]] = [s[ke], s[idxAktif]]
      return s
    })
    tandaiKotor()
  }

  async function ubahStatus(baru: StatusMateri) {
    if (baru === 'terbit' && halaman.every(halamanKosong)) {
      return setGalat('Isi minimal satu halaman sebelum diterbitkan.')
    }
    setSibuk(true)
    await simpan(baru)
    setSibuk(false)
  }

  async function kembali() {
    if (kotor.current) await simpan()
    navigate(kembaliKe)
  }

  if (galatMuat) {
    return (
      <div className="space-y-3">
        <Link to={kembaliKe} className="text-sm font-semibold text-muh-600 hover:underline">← Kembali ke materi</Link>
        <div className="lms-empty">{galatMuat}</div>
      </div>
    )
  }
  if (!materi || !aktif) return <div className="lms-empty">Memuat editor materi…</div>

  const terbit = materi.status === 'terbit'
  const ukuran = ukuranIsi(halaman)
  const persenUkuran = Math.round((ukuran / BATAS_HALAMAN.maksKarakter) * 100)

  return (
    <div className="me-halaman">
      <div className="me-kepala">
        <button type="button" className="me-kembali" onClick={() => void kembali()}>← Materi</button>
        <input
          className="me-judul"
          value={judul}
          maxLength={200}
          onChange={(e) => { setJudul(e.target.value); tandaiKotor() }}
          aria-label="Judul materi"
          placeholder="Judul materi"
        />
        <span className={`me-badge ${terbit ? 'me-badge--terbit' : ''}`}>{terbit ? 'Terbit' : 'Draf'}</span>
        <span className={`me-simpan me-simpan--${status}`} role="status">{LABEL_SIMPAN[status]}</span>
        <div className="me-aksi">
          <button type="button" className="lms-btn-secondary" onClick={() => setPratinjau(true)}>Pratinjau</button>
          {terbit ? (
            <button type="button" className="lms-btn-secondary" disabled={sibuk} onClick={() => void ubahStatus('draf')}>
              Jadikan draf
            </button>
          ) : (
            <button type="button" className="lms-btn-primary" disabled={sibuk} onClick={() => void ubahStatus('terbit')}>
              Terbitkan ke siswa
            </button>
          )}
        </div>
      </div>

      {galat && <div className="me-galat me-galat--halaman" role="alert">{galat}</div>}

      <details className="me-pengaturan">
        <summary>Deskripsi materi</summary>
        <textarea
          rows={2}
          value={deskripsi}
          maxLength={2000}
          onChange={(e) => { setDeskripsi(e.target.value); tandaiKotor() }}
          placeholder="Petunjuk singkat untuk siswa (opsional)"
          aria-label="Deskripsi materi"
        />
      </details>

      <div className="me-grid">
        <aside className="me-sisi" aria-label="Daftar halaman">
          <ol className="me-daftar">
            {halaman.map((h, i) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={`me-item ${h.id === aktif.id ? 'me-item--on' : ''}`}
                  onClick={() => setAktifId(h.id)}
                  aria-current={h.id === aktif.id ? 'true' : undefined}
                  title={h.judul || `Halaman ${i + 1}`}
                >
                  <span className="me-item-no">{i + 1}</span>
                  <span className="me-item-teks">{h.judul || `Halaman ${i + 1}`}</span>
                  {halamanKosong(h) && <span className="me-item-kosong" title="Halaman masih kosong">•</span>}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="me-item me-item--tambah" onClick={tambahHalaman}>
                <span className="me-item-no">+</span>
                <span className="me-item-teks">Halaman baru</span>
              </button>
            </li>
          </ol>
          <p className="me-ukuran" title="Batas isi satu materi">Isi {persenUkuran}% dari batas</p>
        </aside>

        <section className="me-utama">
          <div className="me-hal-bar">
            <input
              className="me-hal-judul"
              value={aktif.judul}
              maxLength={120}
              onChange={(e) => ubahHalaman(aktif.id, { judul: e.target.value })}
              placeholder={`Judul halaman ${idxAktif + 1} (opsional)`}
              aria-label="Judul halaman"
            />
            <div className="me-hal-aksi">
              <button type="button" className="me-btn-kecil" onClick={() => geser(-1)} disabled={idxAktif === 0} title="Geser halaman ke depan">↑</button>
              <button type="button" className="me-btn-kecil" onClick={() => geser(1)} disabled={idxAktif === halaman.length - 1} title="Geser halaman ke belakang">↓</button>
              <button type="button" className="me-btn-kecil" onClick={duplikat}>Duplikat</button>
              <button type="button" className="me-btn-kecil me-btn-kecil--bahaya" onClick={hapus} disabled={halaman.length <= 1}>Hapus</button>
            </div>
          </div>

          <MateriEditor
            key={aktif.id}
            awal={aktif.html}
            kelas={materi.kelas}
            onChange={(html) => ubahHalaman(aktif.id, { html })}
          />

          <div className="me-pindah">
            <button type="button" className="lms-btn-secondary" disabled={idxAktif === 0} onClick={() => setAktifId(halaman[idxAktif - 1].id)}>
              ‹ Halaman {idxAktif}
            </button>
            <span>Halaman {idxAktif + 1} dari {halaman.length}</span>
            {idxAktif < halaman.length - 1 ? (
              <button type="button" className="lms-btn-secondary" onClick={() => setAktifId(halaman[idxAktif + 1].id)}>
                Halaman {idxAktif + 2} ›
              </button>
            ) : (
              <button type="button" className="lms-btn-primary" onClick={tambahHalaman}>+ Halaman baru</button>
            )}
          </div>
        </section>
      </div>

      {pratinjau && (
        <MateriBaca
          materiId={materi.id}
          judul={judul || 'Tanpa judul'}
          mapel={materi.mapel}
          halaman={halaman}
          aksen={aksenMapel(materi.mapel).bar}
          mode="pratinjau"
          onTutup={() => setPratinjau(false)}
        />
      )}
    </div>
  )
}

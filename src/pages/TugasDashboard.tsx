import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas } from '../lib/kelasLms'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import { daftarTugasGuru, hapusTugas, updateTugas } from '../lib/tugas'
import {
  BATAS_HARI_SEGERA,
  infoTenggat,
  LABEL_PENILAIAN_SINGKAT,
  penilaianTugas,
  tenggatKeDate,
} from '../lib/tugasUi'
import type { TugasLms } from '../types/tugas'
import { NAMA_JENIS_PENILAIAN_TUGAS, semuaMapelTugas } from '../types/tugas'
import '../styles/tugas.css'

type FilterJenis = 'semua' | 'mapel' | 'proyek'
type FilterStatus = 'semua' | 'aktif' | 'draf'
type Urut = 'terbaru' | 'tenggat' | 'judul' | 'kumpul'

function IkonCari() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IkonPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IkonJam() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IkonTugas() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H16" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

/** Kelompok tombol pilihan (filter) dengan hitungan. */
function Segmen<T extends string>({
  label,
  nilai,
  opsi,
  onPilih,
}: {
  label: string
  nilai: T
  opsi: { v: T; teks: string; n?: number }[]
  onPilih: (v: T) => void
}) {
  return (
    <div className="tg-grup" role="group" aria-label={label}>
      <span className="tg-grup-label">{label}</span>
      {opsi.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`tg-seg${nilai === o.v ? ' tg-seg--on' : ''}${o.n === undefined ? ' tg-seg--sepi' : ''}`}
          aria-pressed={nilai === o.v}
          onClick={() => onPilih(o.v)}
        >
          {o.teks}
          {o.n !== undefined && <i>{o.n}</i>}
        </button>
      ))}
    </div>
  )
}

export default function TugasDashboard() {
  const { profil } = useAuth()
  const [list, setList] = useState<TugasLms[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filterJenis, setFilterJenis] = useState<FilterJenis>('semua')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('semua')
  const [filterKelas, setFilterKelas] = useState('semua')
  const [urut, setUrut] = useState<Urut>('terbaru')
  const [q, setQ] = useState('')

  const ruang = useMemo(() => daftarRuangKelas(profil), [profil])

  const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'

  const muat = useCallback(async () => {
    setError('')
    try {
      const data = await daftarTugasGuru(ruang, { sebagaiAdmin })
      setList(data)
      if (data.length === 0 && ruang.length === 0 && !sebagaiAdmin) {
        setError(
          'Profil Anda belum punya penugasan kelas×mapel. Atur penugasan di aplikasi Penilaian, atau pastikan tugas lama masih tercatat dengan dibuatOleh akun ini.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar tugas.')
      setList([])
    }
  }, [ruang, sebagaiAdmin])

  useEffect(() => {
    void muat()
  }, [muat])

  /** Acuan «sekarang» dihitung ulang tiap daftar dimuat (cukup untuk label relatif). */
  const sekarang = useMemo(() => new Date(), [list])

  const kelasTersedia = useMemo(() => {
    if (!list) return []
    return [...new Set(list.map((t) => t.kelas).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true }),
    )
  }, [list])

  const hitung = useMemo(() => {
    const l = list ?? []
    return {
      semua: l.length,
      mapel: l.filter((t) => t.jenis === 'mapel').length,
      proyek: l.filter((t) => t.jenis === 'proyek').length,
      aktif: l.filter((t) => t.aktif).length,
      draf: l.filter((t) => !t.aktif).length,
    }
  }, [list])

  const ringkas = useMemo(() => {
    const l = list ?? []
    let segera = 0
    let kumpul = 0
    for (const t of l) {
      kumpul += t.jumlahPengumpulan ?? 0
      if (!t.aktif) continue
      const info = infoTenggat(t.tenggat, sekarang)
      if (info.nada === 'hariini' || info.nada === 'segera') segera += 1
    }
    return { total: l.length, aktif: hitung.aktif, segera, kumpul }
  }, [list, sekarang, hitung.aktif])

  const filtered = useMemo(() => {
    if (!list) return []
    let rows = list
    if (filterJenis !== 'semua') rows = rows.filter((t) => t.jenis === filterJenis)
    if (filterStatus === 'aktif') rows = rows.filter((t) => t.aktif)
    if (filterStatus === 'draf') rows = rows.filter((t) => !t.aktif)
    if (filterKelas !== 'semua') rows = rows.filter((t) => t.kelas === filterKelas)
    const s = q.trim().toLowerCase()
    if (s) {
      rows = rows.filter(
        (t) =>
          t.judul.toLowerCase().includes(s) ||
          t.mapel.toLowerCase().includes(s) ||
          t.kelas.toLowerCase().includes(s) ||
          (t.deskripsi && t.deskripsi.toLowerCase().includes(s)),
      )
    }
    if (urut === 'terbaru') return rows // urutan asal = terbaru diperbarui (daftarTugasGuru)
    const sorted = [...rows]
    if (urut === 'judul') sorted.sort((a, b) => a.judul.localeCompare(b.judul, 'id'))
    else if (urut === 'kumpul') {
      sorted.sort((a, b) => (b.jumlahPengumpulan ?? 0) - (a.jumlahPengumpulan ?? 0))
    } else {
      // Tenggat: yang akan datang (terdekat dulu) → tanpa tenggat → yang sudah lewat (terbaru dulu)
      const now = sekarang.getTime()
      const ms = (t: TugasLms) => tenggatKeDate(t.tenggat)?.getTime() ?? null
      const grup = (v: number | null) => (v === null ? 1 : v >= now ? 0 : 2)
      sorted.sort((a, b) => {
        const ma = ms(a)
        const mb = ms(b)
        const ga = grup(ma)
        const gb = grup(mb)
        if (ga !== gb) return ga - gb
        if (ma === null || mb === null) return 0
        return ga === 2 ? mb - ma : ma - mb
      })
    }
    return sorted
  }, [list, filterJenis, filterStatus, filterKelas, q, urut, sekarang])

  const adaFilter =
    filterJenis !== 'semua' || filterStatus !== 'semua' || filterKelas !== 'semua' || q.trim() !== ''

  function resetFilter() {
    setFilterJenis('semua')
    setFilterStatus('semua')
    setFilterKelas('semua')
    setQ('')
  }

  async function onToggleAktif(t: TugasLms) {
    setBusyId(t.id)
    setError('')
    try {
      await updateTugas(t.id, { aktif: !t.aktif })
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  async function onHapus(t: TugasLms) {
    if (!confirm(`Hapus tugas «${t.judul}»? Tindakan ini tidak dapat dibatalkan.`)) return
    setBusyId(t.id)
    setError('')
    try {
      await hapusTugas(t.id)
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="tg-halaman">
      <header className="tg-kepala">
        <div className="tg-kepala-teks">
          <h2 className="tg-judul-halaman">Tugas</h2>
          <p className="tg-sub">
            Katalog tugas mapel dan proyek. Atur tenggat, lampirkan Tujuan Pembelajaran, lalu input
            nilai dari halaman tiap tugas.
          </p>
        </div>
        <Link to="/tugas/baru" className="tg-btn tg-btn--utama tg-btn--besar">
          <IkonPlus />
          Tugas baru
        </Link>
      </header>

      {list !== null && list.length > 0 && (
        <section className="tg-ringkas" aria-label="Ringkasan tugas">
          <div className="tg-ringkas-item">
            <b>{ringkas.total}</b>
            <span>Total tugas</span>
          </div>
          <div className="tg-ringkas-item tg-ringkas-item--hijau">
            <b>{ringkas.aktif}</b>
            <span>Aktif</span>
          </div>
          <div
            className="tg-ringkas-item tg-ringkas-item--kuning"
            title={`Tugas aktif dengan tenggat hari ini sampai ${BATAS_HARI_SEGERA} hari lagi`}
          >
            <b>{ringkas.segera}</b>
            <span>Segera berakhir</span>
          </div>
          <div className="tg-ringkas-item tg-ringkas-item--teal">
            <b>{ringkas.kumpul}</b>
            <span>Pengumpulan</span>
          </div>
        </section>
      )}

      {list !== null && list.length > 0 && (
        <section className="tg-alat" aria-label="Cari dan saring tugas">
          <div className="tg-alat-baris">
            <div className="tg-cari">
              <IkonCari />
              <input
                type="search"
                placeholder="Cari judul, mapel, kelas, atau deskripsi…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Cari tugas"
              />
            </div>
            <label className="tg-sr" htmlFor="tg-urut">
              Urutkan
            </label>
            <select
              id="tg-urut"
              className="tg-urut"
              value={urut}
              onChange={(e) => setUrut(e.target.value as Urut)}
            >
              <option value="terbaru">Terbaru diperbarui</option>
              <option value="tenggat">Tenggat terdekat</option>
              <option value="kumpul">Pengumpulan terbanyak</option>
              <option value="judul">Judul A–Z</option>
            </select>
            <span className="tg-jumlah" aria-live="polite">
              {filtered.length} tugas
            </span>
          </div>
          <div className="tg-filter">
            <Segmen<FilterStatus>
              label="Status"
              nilai={filterStatus}
              onPilih={setFilterStatus}
              opsi={[
                { v: 'semua', teks: 'Semua', n: hitung.semua },
                { v: 'aktif', teks: 'Aktif', n: hitung.aktif },
                { v: 'draf', teks: 'Draf', n: hitung.draf },
              ]}
            />
            <Segmen<FilterJenis>
              label="Jenis"
              nilai={filterJenis}
              onPilih={setFilterJenis}
              opsi={[
                { v: 'semua', teks: 'Semua', n: hitung.semua },
                { v: 'mapel', teks: 'Mapel', n: hitung.mapel },
                { v: 'proyek', teks: 'Proyek', n: hitung.proyek },
              ]}
            />
            {kelasTersedia.length > 1 && (
              <Segmen<string>
                label="Kelas"
                nilai={filterKelas}
                onPilih={setFilterKelas}
                opsi={[
                  { v: 'semua', teks: 'Semua' },
                  ...kelasTersedia.map((k) => ({ v: k, teks: k })),
                ]}
              />
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="tg-galat" role="alert">
          {error}
        </div>
      )}

      {list === null && (
        <div className="tg-grid" aria-busy="true" aria-label="Memuat katalog tugas">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="tg-skel" />
          ))}
        </div>
      )}

      {list && list.length === 0 && (
        <div className="tg-kosong">
          <span className="tg-kosong-ikon">
            <IkonTugas />
          </span>
          <b>Belum ada tugas</b>
          <p>Buat tugas pertama untuk mulai memberikan pekerjaan kepada siswa.</p>
          <Link to="/tugas/baru" className="tg-btn tg-btn--utama tg-btn--besar">
            <IkonPlus />
            Tugas baru
          </Link>
        </div>
      )}

      {list && list.length > 0 && filtered.length === 0 && (
        <div className="tg-kosong">
          <b>Tidak ada tugas yang cocok</b>
          <p>Ubah kata kunci atau saringan yang sedang dipakai.</p>
          {adaFilter && (
            <button type="button" className="tg-btn" onClick={resetFilter}>
              Reset saringan
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="tg-grid">
          {filtered.map((t) => {
            const mapels = semuaMapelTugas(t)
            const aksen = aksenMapel(t.mapel)
            const info = infoTenggat(t.tenggat, sekarang)
            // Tugas draf tidak diberi nada alarm — belum terlihat siswa.
            const nada = t.aktif ? info.nada : info.nada === 'tanpa' ? 'tanpa' : 'netral'
            const jp = penilaianTugas(t)
            const tp = t.tpList ?? []
            const kumpul = t.jumlahPengumpulan ?? 0
            const sibuk = busyId === t.id
            const gaya = { '--tg-a': aksen.bar } as CSSProperties
            return (
              <li key={t.id}>
                <article
                  className={`tg-kartu${t.aktif ? '' : ' tg-kartu--draf'}${sibuk ? ' tg-kartu--sibuk' : ''}`}
                  style={gaya}
                  aria-busy={sibuk}
                >
                  <div className="tg-utama">
                    <div className="tg-atas">
                      <span className="tg-mono" aria-hidden="true">
                        {inisialMapel(t.mapel)}
                      </span>
                      <div className="tg-tag">
                        <span className="tg-mapel" title={mapels.join(', ')}>
                          {mapels[0] ?? t.mapel}
                          {mapels.length > 1 ? ` +${mapels.length - 1}` : ''}
                        </span>
                        <span className="tg-kelas">Kelas {t.kelas}</span>
                      </div>
                      <span
                        className={`tg-status ${t.aktif ? 'tg-status--aktif' : 'tg-status--draf'}`}
                        title={t.aktif ? 'Terlihat oleh siswa' : 'Belum terlihat oleh siswa'}
                      >
                        {t.aktif ? 'Aktif' : 'Draf'}
                      </span>
                    </div>

                    <h3 className="tg-judul">
                      <Link to={`/tugas/${t.id}`}>{t.judul}</Link>
                    </h3>
                    {t.deskripsi && <p className="tg-desk">{t.deskripsi}</p>}

                    <div className="tg-chips">
                      {t.jenis === 'proyek' && <span className="tg-chip tg-chip--proyek">Proyek</span>}
                      <span
                        className={`tg-chip tg-chip--${jp}`}
                        title={NAMA_JENIS_PENILAIAN_TUGAS[jp]}
                      >
                        {LABEL_PENILAIAN_SINGKAT[jp]}
                      </span>
                      {tp.length > 0 && (
                        <span
                          className="tg-chip tg-chip--tp"
                          title={tp.map((x) => `TP ${x.nomor}: ${x.nama}`).join('\n')}
                        >
                          {tp.length === 1 ? `TP ${tp[0].nomor}` : `${tp.length} TP`}
                        </span>
                      )}
                    </div>

                    <div className="tg-panel">
                      <div className={`tg-tenggat tg-tenggat--${nada}`}>
                        <span className="tg-tenggat-label">
                          <IkonJam />
                          Tenggat
                        </span>
                        <b>{info.label}</b>
                        {info.tanggal && <small>{info.tanggal}</small>}
                      </div>
                      <div
                        className={`tg-kumpul${kumpul === 0 ? ' tg-kumpul--nol' : ''}`}
                        title="Jumlah pengumpulan siswa"
                      >
                        <b>{kumpul}</b>
                        <span>Terkumpul</span>
                      </div>
                    </div>
                  </div>

                  <div className="tg-kaki">
                    <Link to={`/tugas/${t.id}`} className="tg-btn tg-btn--utama">
                      Buka
                    </Link>
                    <button
                      type="button"
                      className="tg-btn"
                      disabled={busyId !== null}
                      onClick={() => void onToggleAktif(t)}
                    >
                      {t.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <span className="tg-kaki-spasi" />
                    <button
                      type="button"
                      className="tg-btn tg-btn--bahaya"
                      disabled={busyId !== null}
                      onClick={() => void onHapus(t)}
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

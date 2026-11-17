import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getLomba } from '../../lib/lomba'
import {
  adalahAdminLms,
  bolehKelolaKontenLomba,
  KELAS_LOMBA_BANK,
  labelStatusLomba,
} from '../../lib/lombaAkses'
import { buatRuangId } from '../../lib/kelasLms'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import MateriPanel from '../../components/MateriPanel'
import BankSoalPanel from '../../components/BankSoalPanel'
import KuisPanel from '../../components/KuisPanel'
import { KnChips } from '../../components/KuisNav'
import { IkonBankSoal, IkonDaftar, IkonKuis, IkonMateri } from '../../components/ikonRuang'
import { aksenMapel } from '../../lib/uiAksen'
import '../../styles/ruang.css'
import '../../styles/lomba.css'

type Tab = 'ringkas' | 'materi' | 'soal' | 'kuis'

/** Urutan & ikon tab sama dengan ruang kelas: Materi · Kuis · Bank Soal. */
const TABS: { id: Tab; label: string; ikon: ReactNode }[] = [
  { id: 'ringkas', label: 'Ringkasan', ikon: <IkonDaftar size={16} /> },
  { id: 'materi', label: 'Materi', ikon: <IkonMateri size={16} /> },
  { id: 'kuis', label: 'Kuis', ikon: <IkonKuis size={16} /> },
  { id: 'soal', label: 'Bank Soal', ikon: <IkonBankSoal size={16} /> },
]

const KELAS_TP = ['1A','1B','1C','2A','2B','2C','3A','3B','3C','4A','4B','4C','5A','5B','5C','6A','6B']

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
}

function badgeClass(status: string): string {
  if (status === 'aktif') return 'lomba-badge lomba-badge--aktif'
  if (status === 'draf') return 'lomba-badge lomba-badge--draf'
  return 'lomba-badge lomba-badge--selesai'
}

export default function LombaDetail() {
  const { lombaId } = useParams<{ lombaId: string }>()
  const { user, profil } = useAuth()
  const admin = adalahAdminLms(user, profil)
  const [lomba, setLomba] = useState<Lomba | null>(null)
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  const [tab, setTab] = useState<Tab>('ringkas')
  const [mapelAktif, setMapelAktif] = useState('')
  /** Kelas untuk memuat TP (admin boleh ganti). Default: kelas peserta pertama atau 6A. */
  const [tpKelas, setTpKelas] = useState('6A')

  const muat = useCallback(async () => {
    if (!lombaId) return
    setLoading(true)
    setGalat('')
    try {
      const l = await getLomba(lombaId)
      setLomba(l)
      if (!l) setGalat('Lomba tidak ditemukan.')
      else {
        if (l.mapelTerkait.length) setMapelAktif((m) => m || l.mapelTerkait[0])
        if (l.siswaList.length) {
          const k = l.siswaList[0].kelas
          if (k) setTpKelas(k)
        }
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat.')
      setLomba(null)
    } finally {
      setLoading(false)
    }
  }, [lombaId])

  useEffect(() => {
    void muat()
  }, [muat])

  const kelasBank = KELAS_LOMBA_BANK
  const ruangId = useMemo(
    () => (mapelAktif ? buatRuangId(kelasBank, mapelAktif) : ''),
    [kelasBank, mapelAktif],
  )

  if (loading) {
    return <div className="lms-empty p-8 text-sm text-muted">Memuat lomba…</div>
  }

  if (!lomba) {
    return (
      <div className="lomba-dash space-y-3">
        <Link to="/lomba" className="lomba-back">
          ← Daftar lomba
        </Link>
        <div className="lomba-kosong">
          <h3>{galat || 'Lomba tidak ditemukan'}</h3>
        </div>
      </div>
    )
  }

  const bolehKonten = bolehKelolaKontenLomba(user, profil, lomba)

  if (!bolehKonten && !admin) {
    return (
      <div className="lms-empty p-8 text-sm text-slate-600">
        Anda tidak memiliki akses ke lomba ini.
      </div>
    )
  }

  /** Aksen mengikuti mapel aktif (selaras ruang kelas); oranye Lomba bila belum ada mapel. */
  const aksen = mapelAktif ? aksenMapel(mapelAktif).bar : '#c2410c'

  function onKeyTab(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let ke = -1
    if (e.key === 'ArrowRight') ke = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') ke = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') ke = 0
    else if (e.key === 'End') ke = TABS.length - 1
    if (ke < 0) return
    e.preventDefault()
    setTab(TABS[ke].id)
    document.getElementById(`lomba-tab-${TABS[ke].id}`)?.focus()
  }

  return (
    <div className="lomba-dash space-y-5" style={{ '--rg-a': aksen } as CSSProperties}>
      <section className="lomba-hero">
        <div className="lomba-hero-inner">
          <p className="lomba-eyebrow">{labelTingkat(lomba.tingkat)}</p>
          <h1 className="lomba-judul">{lomba.nama}</h1>
          {lomba.identitas ? <p className="lomba-lead">{lomba.identitas}</p> : null}
          <div className="lomba-hero-aksi">
            <span className={badgeClass(lomba.status)} style={{ alignSelf: 'center' }}>
              {labelStatusLomba(lomba.status)}
            </span>
            {admin && (
              <Link to={`/lomba/${lomba.id}/edit`} className="lomba-btn-ghost">
                Ubah meta
              </Link>
            )}
            <Link to="/lomba" className="lomba-btn-ghost">
              ← Daftar
            </Link>
          </div>
        </div>
      </section>

      <div
        className="rg-tabs"
        role="tablist"
        aria-label="Bagian lomba"
        style={{ '--rg-a': aksen } as CSSProperties}
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`lomba-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="lomba-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onKeyTab(e, i)}
            className={`rg-tab${tab === t.id ? ' rg-tab--on' : ''}`}
          >
            {t.ikon}
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'ringkas' && lomba.mapelTerkait.length > 0 && (
        <div className="kn-bar lomba-ruangbar">
          <KnChips
            label="Mapel"
            nilai={mapelAktif}
            opsi={lomba.mapelTerkait.map((m) => ({ v: m, teks: m }))}
            onPilih={setMapelAktif}
          />
          {admin && (
            <label className="lomba-tp">
              <span>TP dari kelas</span>
              <select value={tpKelas} onChange={(e) => setTpKelas(e.target.value)}>
                {KELAS_TP.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div
        role="tabpanel"
        id="lomba-panel"
        aria-labelledby={`lomba-tab-${tab}`}
        className="min-w-0 space-y-5"
      >
      {tab === 'ringkas' && (
        <>
          <div className="lomba-detail-grid">
            <section className="lomba-panel">
              <h3>Informasi</h3>
              <dl className="lomba-dl">
                <div>
                  <dt>Mapel terkait</dt>
                  <dd>
                    {lomba.mapelTerkait.length ? (
                      <div className="lomba-pill-row mt-1">
                        {lomba.mapelTerkait.map((m) => (
                          <span key={m} className="lomba-pill">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Masa berlaku</dt>
                  <dd>
                    {formatTanggal(lomba.mulai)} – {formatTanggal(lomba.selesai)}
                  </dd>
                </div>
                <div>
                  <dt>Guru pengampu</dt>
                  <dd>
                    {lomba.guruPengampuNama || '—'}
                    {lomba.guruPengampuEmail ? (
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        ({lomba.guruPengampuEmail})
                      </span>
                    ) : null}
                  </dd>
                </div>
                {lomba.deskripsi ? (
                  <div>
                    <dt>Deskripsi</dt>
                    <dd className="font-medium leading-relaxed text-slate-700">{lomba.deskripsi}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="lomba-panel">
              <h3>Peserta ({lomba.siswaIds.length}/20)</h3>
              {lomba.siswaList.length > 0 ? (
                <ul className="lomba-peserta-list">
                  {lomba.siswaList.map((p) => (
                    <li key={p.id}>
                      <span>{p.nama}</span>
                      <span className="kelas">Kelas {p.kelas}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Belum ada peserta.</p>
              )}
            </section>
          </div>
          <p className="text-sm text-slate-500">
            Kelola <strong>Materi</strong>, <strong>Bank soal</strong>, dan <strong>Kuis</strong> lewat
            tab di atas. Pilih mapel terkait untuk membatasi TP dan konten.
          </p>
        </>
      )}

      {tab === 'materi' && mapelAktif && (
        <MateriPanel
          kelas={kelasBank}
          mapel={mapelAktif}
          lombaId={lomba.id}
          tpKelas={tpKelas}
        />
      )}
      {tab === 'soal' && mapelAktif && ruangId && (
        <BankSoalPanel
          kelas={kelasBank}
          mapel={mapelAktif}
          ruangId={ruangId}
          lombaId={lomba.id}
          tpKelas={tpKelas}
        />
      )}
      {tab === 'kuis' && mapelAktif && (
        <KuisPanel
          kelas={kelasBank}
          mapel={mapelAktif}
          lombaId={lomba.id}
          tpKelas={tpKelas}
        />
      )}
      {(tab === 'materi' || tab === 'soal' || tab === 'kuis') && !mapelAktif && (
        <div className="lomba-kosong">
          <h3>Pilih mapel terkait</h3>
          <p>Lomba ini belum punya mapel terkait. Ubah meta lomba terlebih dahulu.</p>
        </div>
      )}
      </div>
    </div>
  )
}

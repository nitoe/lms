import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getLomba } from '../../lib/lomba'
import {
  adalahAdminLms,
  bolehKelolaKontenLomba,
  KELAS_LOMBA_BANK,
  labelStatusLomba,
  MAPEL_GABUNGAN_LOMBA,
} from '../../lib/lombaAkses'
import { buatRuangId } from '../../lib/kelasLms'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import MateriPanel from '../../components/MateriPanel'
import BankSoalPanel from '../../components/BankSoalPanel'
import KuisPanel from '../../components/KuisPanel'
import KartuPesertaDialog from '../../components/KartuPesertaDialog'
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
  const [searchParams] = useSearchParams()
  const tabUrl = searchParams.get('tab')
  const mapelUrl = searchParams.get('mapel') ?? ''
  const [lomba, setLomba] = useState<Lomba | null>(null)
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  /** `?tab=` & `?mapel=` dipakai tombol «kembali» dari editor soal agar mendarat di Bank Soal mapel yang sama. */
  const [tab, setTab] = useState<Tab>(
    tabUrl === 'materi' || tabUrl === 'soal' || tabUrl === 'kuis' || tabUrl === 'ringkas' ? tabUrl : 'ringkas',
  )
  const [mapelAktif, setMapelAktif] = useState('')
  /** Kelas untuk memuat TP (admin boleh ganti). Default: kelas peserta pertama atau 6A. */
  const [tpKelas, setTpKelas] = useState('6A')
  /** Dialog cetak kartu peserta (hook di atas early return — ANTIREGRESI §108.4). */
  const [kartuBuka, setKartuBuka] = useState(false)

  const muat = useCallback(async () => {
    if (!lombaId) return
    setLoading(true)
    setGalat('')
    try {
      const l = await getLomba(lombaId)
      setLomba(l)
      if (!l) setGalat('Lomba tidak ditemukan.')
      else {
        if (l.mapelTerkait.length) {
          const dariUrl = l.mapelTerkait.includes(mapelUrl) ? mapelUrl : ''
          setMapelAktif((m) => m || dariUrl || l.mapelTerkait[0])
        }
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
  }, [lombaId, mapelUrl])

  useEffect(() => {
    void muat()
  }, [muat])

  const kelasBank = KELAS_LOMBA_BANK
  /**
   * «Gabungan» (kuis lintas mapel) hanya ada di tab Kuis. Di tab Materi/Bank Soal pilihan itu
   * diperlakukan sebagai mapel pertama lomba (ANTIREGRESI §Lomba.13).
   */
  const gabunganTersedia = (lomba?.mapelTerkait.length ?? 0) >= 2
  const mapelPanel =
    mapelAktif === MAPEL_GABUNGAN_LOMBA && (tab !== 'kuis' || !gabunganTersedia)
      ? (lomba?.mapelTerkait[0] ?? '')
      : mapelAktif
  const ruangId = useMemo(
    () => (mapelPanel && mapelPanel !== MAPEL_GABUNGAN_LOMBA ? buatRuangId(kelasBank, mapelPanel) : ''),
    [kelasBank, mapelPanel],
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
  const aksen = mapelPanel ? aksenMapel(mapelPanel).bar : '#c2410c'

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
            nilai={mapelPanel}
            opsi={[
              ...lomba.mapelTerkait.map((m) => ({ v: m, teks: m })),
              ...(tab === 'kuis' && gabunganTersedia
                ? [{ v: MAPEL_GABUNGAN_LOMBA, teks: 'Gabungan (semua mapel)' }]
                : []),
            ]}
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
                    {(lomba.guruPengampuList?.length
                      ? lomba.guruPengampuList
                      : lomba.guruPengampuUid
                        ? [
                            {
                              uid: lomba.guruPengampuUid,
                              nama: lomba.guruPengampuNama,
                              email: lomba.guruPengampuEmail,
                            },
                          ]
                        : []
                    ).map((p, i) => (
                      <span key={p.uid}>
                        {i > 0 ? ' · ' : ''}
                        {p.nama || '—'}
                        {p.email ? (
                          <span className="ml-1 text-xs font-normal text-slate-500">({p.email})</span>
                        ) : null}
                      </span>
                    )) || '—'}
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
              {lomba.siswaList.length > 0 && (
                <div className="kp-aksi">
                  <button type="button" className="kp-btn" onClick={() => setKartuBuka(true)}>
                    Cetak kartu peserta
                  </button>
                </div>
              )}
            </section>
          </div>
          <p className="text-sm text-slate-500">
            Kelola <strong>Materi</strong>, <strong>Bank soal</strong>, dan <strong>Kuis</strong> lewat
            tab di atas. Pilih mapel terkait untuk membatasi TP dan konten.
          </p>
        </>
      )}

      {tab === 'materi' && mapelPanel && (
        <MateriPanel
          kelas={kelasBank}
          mapel={mapelPanel}
          lombaId={lomba.id}
          tpKelas={tpKelas}
        />
      )}
      {tab === 'soal' && mapelPanel && ruangId && (
        <BankSoalPanel
          kelas={kelasBank}
          mapel={mapelPanel}
          ruangId={ruangId}
          lombaId={lomba.id}
          tpKelas={tpKelas}
        />
      )}
      {tab === 'kuis' && mapelPanel && (
        <KuisPanel
          kelas={kelasBank}
          mapel={mapelPanel}
          mapelGabungan={lomba.mapelTerkait}
          lombaId={lomba.id}
          tpKelas={tpKelas}
        />
      )}
      {(tab === 'materi' || tab === 'soal' || tab === 'kuis') && !mapelPanel && (
        <div className="lomba-kosong">
          <h3>Pilih mapel terkait</h3>
          <p>Lomba ini belum punya mapel terkait. Ubah meta lomba terlebih dahulu.</p>
        </div>
      )}
      </div>
      {kartuBuka && <KartuPesertaDialog lomba={lomba} onTutup={() => setKartuBuka(false)} />}
    </div>
  )
}

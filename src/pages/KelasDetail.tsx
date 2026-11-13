import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas, parseRuangId } from '../lib/kelasLms'
import { kunciRuang, useRingkasanRuang } from '../lib/ringkasanRuang'
import { adalahMapelTka, materiTkaUntuk } from '../lib/tkaAkses'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import MateriPanel from '../components/MateriPanel'
import KuisPanel from '../components/KuisPanel'
import BankSoalPanel from '../components/BankSoalPanel'
import { IkonBankSoal, IkonKuis, IkonMateri, IkonPengumuman, IkonTugas } from '../components/ikonRuang'
import '../styles/tka.css'
import '../styles/ruang.css'

type TabId = 'pengumuman' | 'materi' | 'kuis' | 'soal'

const TABS: { id: TabId; label: string; ikon: ReactNode }[] = [
  { id: 'pengumuman', label: 'Pengumuman', ikon: <IkonPengumuman size={16} /> },
  { id: 'materi', label: 'Materi', ikon: <IkonMateri size={16} /> },
  { id: 'kuis', label: 'Kuis', ikon: <IkonKuis size={16} /> },
  { id: 'soal', label: 'Bank Soal', ikon: <IkonBankSoal size={16} /> },
]

/** Ringkas deskripsi hero per mapel TKA. */
function leadTka(mapel: string): string {
  if (mapel === 'TKA IPA') {
    return 'Bank soal & kuis TKA IPA untuk 6A dan 6B — Fase B & C, pengetahuan dan keterampilan proses sains.'
  }
  if (mapel === 'TKA Matematika') {
    return 'Bank soal & kuis TKA Matematika untuk 6A dan 6B — bilangan, geometri & pengukuran, data.'
  }
  if (mapel === 'TKA Bahasa Indonesia') {
    return 'Bank soal & kuis TKA Bahasa Indonesia untuk 6A dan 6B — tekstual, inferensial, evaluasi & apresiasi.'
  }
  return 'Bank soal dan kuis TKA (berlaku untuk 6A & 6B)'
}

export default function KelasDetail() {
  const { ruangId = '' } = useParams()
  const { profil } = useAuth()
  const [searchParams] = useSearchParams()
  const tabAwal = searchParams.get('tab')
  const decoded = decodeURIComponent(ruangId)
  const parsed = useMemo(() => parseRuangId(decoded), [decoded])
  /** Ruang TKA (kelas 6): hanya Bank Soal dan Kuis (ANTIREGRESI §77). */
  const ruangTka = adalahMapelTka(parsed?.mapel)
  const tabsTampil = ruangTka ? TABS.filter((t) => t.id === 'soal' || t.id === 'kuis') : TABS
  const [tab, setTab] = useState<TabId>(
    ruangTka
      ? tabAwal === 'kuis'
        ? 'kuis'
        : 'soal'
      : tabAwal === 'soal' || tabAwal === 'kuis' || tabAwal === 'pengumuman'
        ? tabAwal
        : 'materi',
  )
  const ruangList = useMemo(() => daftarRuangKelas(profil), [profil])
  const ruang = ruangList.find((r) => r.id === decoded)

  // Ringkasan tugas/kuis aktif ruang ini. Semua hook wajib berada di atas early return `!parsed`.
  const kelasRuang = ruang?.kelas ?? parsed?.kelas ?? ''
  const mapelRuang = ruang?.mapel ?? parsed?.mapel ?? ''
  const ruangSatu = useMemo(
    () => (kelasRuang && mapelRuang && !ruangTka ? [{ kelas: kelasRuang, mapel: mapelRuang }] : []),
    [kelasRuang, mapelRuang, ruangTka],
  )
  const sebagaiAdmin = profil?.role === 'admin' || profil?.peranLms === 'admin'
  const { ringkas, aktif } = useRingkasanRuang(ruangSatu, sebagaiAdmin)

  if (!parsed) {
    return (
      <div className="rg-halaman">
        <Link to="/kelas" className="rg-link">
          ← Kembali ke daftar kelas
        </Link>
        <div className="rg-kosong">
          <b>Tautan tidak valid</b>
          <p>Tautan ruang kelas tidak valid. Kembali ke daftar kelas dan pilih ruang yang tersedia.</p>
        </div>
      </div>
    )
  }

  const judulMapel = ruang?.mapel ?? parsed.mapel
  const judulKelas = ruang?.kelas ?? parsed.kelas
  const a = aksenMapel(judulMapel)
  const materiList = ruangTka ? materiTkaUntuk(judulMapel) : []
  /** IPA punya daftar materi panjang — tampilkan lebih banyak di hero. */
  const materiTampil =
    judulMapel === 'TKA IPA' ? materiList.slice(0, 8) : materiList.slice(0, 4)
  const sisaMateri = materiList.length - materiTampil.length

  const hitungRuang = aktif ? ringkas[kunciRuang(judulKelas, judulMapel)] : undefined
  const nTugas = aktif ? (hitungRuang?.tugasAktif ?? 0) : null
  const nKuis = aktif ? (hitungRuang?.kuisAktif ?? 0) : null

  function onKeyTab(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let ke = -1
    if (e.key === 'ArrowRight') ke = (i + 1) % tabsTampil.length
    else if (e.key === 'ArrowLeft') ke = (i - 1 + tabsTampil.length) % tabsTampil.length
    else if (e.key === 'Home') ke = 0
    else if (e.key === 'End') ke = tabsTampil.length - 1
    if (ke < 0) return
    e.preventDefault()
    setTab(tabsTampil[ke].id)
    document.getElementById(`tab-${tabsTampil[ke].id}`)?.focus()
  }

  return (
    <div className="rg-halaman" style={{ '--rg-a': a.bar } as CSSProperties}>
      {/* Header cover ruang kelas */}
      <section
        className={`kelas-hero${ruangTka ? ' tka-ruang-hero' : ''}${
          judulMapel === 'TKA IPA' ? ' tka-ruang-hero--ipa' : ''
        }`}
        style={{ background: a.cover }}
      >
        <div className="kelas-hero-deco" aria-hidden />
        <div className="kelas-hero-inner">
          {ruangTka ? (
            <Link to="/tka" className="kelas-hero-back tka-ruang-back">
              ← Kembali ke dashboard TKA
            </Link>
          ) : (
            <Link to="/kelas" className="kelas-hero-back">
              ← Semua ruang kelas
            </Link>
          )}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="kelas-hero-badge">
                  {ruangTka ? 'TKA · Kelas 6' : `Kelas ${judulKelas}`}
                </span>
                {ruangTka && (
                  <span className="kelas-hero-badge kelas-hero-badge--tka-bank">
                    Bank bersama 6A &amp; 6B
                  </span>
                )}
                {!ruangTka && ruang?.sebagaiWali && (
                  <span className="kelas-hero-badge kelas-hero-badge--wali">Wali kelas</span>
                )}
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                {ruangTka ? judulMapel.replace(/^TKA\s+/, '') : judulMapel}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/85">
                {ruangTka ? leadTka(judulMapel) : 'Materi, kuis, dan pengumuman untuk rombel ini'}
              </p>
              {ruangTka && materiTampil.length > 0 && (
                <ul className="tka-ruang-materi" aria-label="Materi TKA">
                  {materiTampil.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                  {sisaMateri > 0 && <li className="tka-ruang-materi-more">+{sisaMateri} materi</li>}
                </ul>
              )}
            </div>
            <div className="kelas-hero-mark tka-ruang-mark" style={{ color: a.coverFg }} aria-hidden>
              {inisialMapel(judulMapel)}
            </div>
          </div>
          {!ruangTka && (
            <div className="rg-hero-pills">
              <Link to="/tugas" className="rg-hero-pill">
                <IkonTugas size={14} />
                <b>{nTugas ?? '…'}</b> tugas aktif
              </Link>
              <button type="button" className="rg-hero-pill" onClick={() => setTab('kuis')}>
                <IkonKuis size={14} />
                <b>{nKuis ?? '…'}</b> kuis aktif
              </button>
            </div>
          )}
        </div>
      </section>

      <div
        className="rg-tabs"
        role="tablist"
        aria-label="Bagian ruang kelas"
        style={{ '--rg-a': a.bar } as CSSProperties}
      >
        {tabsTampil.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
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

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab === 'pengumuman' && (
          <div className="rg-kosong">
            <span className="rg-kosong-ikon">
              <IkonPengumuman size={22} />
            </span>
            <b>Belum ada pengumuman</b>
            <p>Fitur pengumuman kelas akan ditambahkan kemudian.</p>
          </div>
        )}
        {tab === 'materi' && <MateriPanel kelas={judulKelas} mapel={judulMapel} />}
        {tab === 'kuis' && <KuisPanel kelas={judulKelas} mapel={judulMapel} />}
        {tab === 'soal' && <BankSoalPanel kelas={judulKelas} mapel={judulMapel} ruangId={decoded} />}
      </div>
    </div>
  )
}

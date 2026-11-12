import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas, parseRuangId } from '../lib/kelasLms'
import { adalahMapelTka, materiTkaUntuk } from '../lib/tkaAkses'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import MateriPanel from '../components/MateriPanel'
import KuisPanel from '../components/KuisPanel'
import BankSoalPanel from '../components/BankSoalPanel'
import '../styles/tka.css'

type TabId = 'pengumuman' | 'materi' | 'kuis' | 'soal'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pengumuman', label: 'Pengumuman' },
  { id: 'materi', label: 'Materi' },
  { id: 'kuis', label: 'Kuis' },
  { id: 'soal', label: 'Bank Soal' },
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

  if (!parsed) {
    return (
      <div className="space-y-3">
        <Link to="/kelas" className="text-sm font-semibold text-muh-600 hover:underline">
          ← Kembali ke daftar kelas
        </Link>
        <div className="lms-empty">Tautan ruang kelas tidak valid.</div>
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

  return (
    <div className="space-y-5">
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
        </div>
      </section>

      <div className="lms-tabs" role="tablist" aria-label="Bag ruang kelas">
        {tabsTampil.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`lms-tab ${tab === t.id ? 'lms-tab--active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pengumuman' && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada pengumuman</p>
          <p className="mt-1">Fitur pengumuman kelas akan ditambahkan kemudian.</p>
        </div>
      )}
      {tab === 'materi' && <MateriPanel kelas={judulKelas} mapel={judulMapel} />}
      {tab === 'kuis' && <KuisPanel kelas={judulKelas} mapel={judulMapel} />}
      {tab === 'soal' && <BankSoalPanel kelas={judulKelas} mapel={judulMapel} ruangId={decoded} />}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas, parseRuangId } from '../lib/kelasLms'
import { aksenMapel, inisialMapel } from '../lib/uiAksen'
import MateriPanel from '../components/MateriPanel'
import KuisPanel from '../components/KuisPanel'

type TabId = 'pengumuman' | 'materi' | 'kuis' | 'tugas'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pengumuman', label: 'Pengumuman' },
  { id: 'materi', label: 'Materi' },
  { id: 'kuis', label: 'Kuis' },
  { id: 'tugas', label: 'Tugas' },
]

export default function KelasDetail() {
  const { ruangId = '' } = useParams()
  const { profil } = useAuth()
  const [tab, setTab] = useState<TabId>('materi')

  const decoded = decodeURIComponent(ruangId)
  const parsed = useMemo(() => parseRuangId(decoded), [decoded])
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

  return (
    <div className="space-y-5">
      {/* Header cover ruang kelas */}
      <section className="kelas-hero" style={{ background: a.cover }}>
        <div className="kelas-hero-deco" aria-hidden />
        <div className="kelas-hero-inner">
          <Link to="/kelas" className="kelas-hero-back">
            ← Semua ruang kelas
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="kelas-hero-badge">Kelas {judulKelas}</span>
                {ruang?.sebagaiWali && (
                  <span className="kelas-hero-badge kelas-hero-badge--wali">Wali kelas</span>
                )}
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                {judulMapel}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Materi, tugas, dan pengumuman untuk rombel ini
              </p>
            </div>
            <div className="kelas-hero-mark" style={{ color: a.coverFg }} aria-hidden>
              {inisialMapel(judulMapel)}
            </div>
          </div>
        </div>
      </section>

      <div className="lms-tabs" role="tablist" aria-label="Bag ruang kelas">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`lms-tab ${tab === t.id ? 'lms-tab--active' : ''}`}
          >
            {t.label}
            {t.id === 'tugas' && (
              <span className="lms-tab-soon">Segera</span>
            )}
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
      {tab === 'tugas' && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Tugas segera hadir</p>
          <p className="mt-1">
            Buat tugas, pantau pengumpulan siswa, beri nilai dan komentar (Fase 1c).
          </p>
        </div>
      )}
    </div>
  )
}

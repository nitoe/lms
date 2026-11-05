import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarRuangKelas, parseRuangId } from '../lib/kelasLms'
import MateriPanel from '../components/MateriPanel'

type TabId = 'pengumuman' | 'materi' | 'tugas'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pengumuman', label: 'Pengumuman' },
  { id: 'materi', label: 'Materi' },
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
        <Link to="/kelas" className="text-sm font-medium text-muh-600 hover:underline">
          ← Kembali ke daftar kelas
        </Link>
        <div className="lms-empty">Tautan ruang kelas tidak valid.</div>
      </div>
    )
  }

  const judulMapel = ruang?.mapel ?? parsed.mapel
  const judulKelas = ruang?.kelas ?? parsed.kelas

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/kelas" className="text-xs font-semibold text-muh-600 hover:underline">
            ← Semua ruang kelas
          </Link>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">
            {judulMapel}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Kelas {judulKelas}
            {ruang?.sebagaiWali ? ' · Anda wali kelas di rombel ini' : ''}
          </p>
        </div>
      </div>

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
          </button>
        ))}
      </div>

      {tab === 'pengumuman' && (
        <div className="lms-empty">
          Belum ada pengumuman. Fitur pengumuman kelas akan ditambahkan kemudian.
        </div>
      )}
      {tab === 'materi' && <MateriPanel kelas={judulKelas} mapel={judulMapel} />}
      {tab === 'tugas' && (
        <div className="lms-empty">
          Daftar tugas, pengumpulan siswa, dan penilaian akan muncul di sini (Fase 1c).
        </div>
      )}
    </div>
  )
}

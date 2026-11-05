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
        <div className="card-soft p-5 text-sm text-muted">Tautan ruang kelas tidak valid.</div>
      </div>
    )
  }

  const judulMapel = ruang?.mapel ?? parsed.mapel
  const judulKelas = ruang?.kelas ?? parsed.kelas

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/kelas" className="text-xs font-medium text-muh-600 hover:underline">
            ← Semua ruang kelas
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-muh-900 tracking-tight">
            {judulMapel}
            <span className="text-muted font-normal"> · Kelas {judulKelas}</span>
          </h1>
          {ruang?.sebagaiWali && (
            <p className="mt-0.5 text-xs text-amber-700">Anda wali kelas di rombel ini</p>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-muh-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-muh-600'
                : 'text-muted hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pengumuman' && (
        <div className="card-soft p-5 text-sm text-muted">
          Belum ada pengumuman. Fitur pengumuman kelas akan ditambahkan kemudian.
        </div>
      )}
      {tab === 'materi' && <MateriPanel kelas={judulKelas} mapel={judulMapel} />}
      {tab === 'tugas' && (
        <div className="card-soft p-5 text-sm text-muted">
          Daftar tugas, pengumpulan siswa, dan penilaian akan muncul di sini (Fase 1c).
        </div>
      )}
    </div>
  )
}

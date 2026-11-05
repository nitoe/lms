import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import JenisIcon from '../../components/JenisIcon'
import { daftarMateriKelas, pesanGagalMuatMateri } from '../../lib/materiSiswa'
import { formatUkuran, kelompokkanMateri, labelJenis, toneJenis } from '../../lib/materiUi'
import { aksenMapel, inisialMapel } from '../../lib/uiAksen'
import type { MateriLms } from '../../types/materi'

type Muat =
  | { status: 'loading' }
  | { status: 'error'; pesan: string }
  | { status: 'ok'; list: MateriLms[] }

type PerMapel = { mapel: string; items: MateriLms[] }

/**
 * Materi untuk siswa: pilih pelajaran (kartu bercover) → lihat materi per TP.
 * Pelajaran yang tampil = mapel yang sudah punya materi di kelas siswa.
 * Pilihan pelajaran disimpan di URL (`?mapel=`) agar tombol «kembali» HP berfungsi.
 */
export default function SiswaMateri() {
  const { sesi } = useSiswa()
  const kelas = sesi?.kelas ?? ''
  const [params, setParams] = useSearchParams()
  const [muat, setMuat] = useState<Muat>({ status: 'loading' })
  const [percobaan, setPercobaan] = useState(0)

  useEffect(() => {
    if (!kelas) return
    let batal = false
    daftarMateriKelas(kelas)
      .then((list) => {
        if (!batal) setMuat({ status: 'ok', list })
      })
      .catch((e: unknown) => {
        if (!batal) setMuat({ status: 'error', pesan: pesanGagalMuatMateri(e) })
      })
    return () => {
      batal = true
    }
  }, [kelas, percobaan])

  const perMapel = useMemo<PerMapel[]>(() => {
    if (muat.status !== 'ok') return []
    const map = new Map<string, MateriLms[]>()
    for (const m of muat.list) {
      const arr = map.get(m.mapel) ?? []
      arr.push(m)
      map.set(m.mapel, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'id'))
      .map(([mapel, items]) => ({ mapel, items }))
  }, [muat])

  function cobaLagi() {
    setMuat({ status: 'loading' })
    setPercobaan((n) => n + 1)
  }

  if (muat.status === 'loading') {
    return <div className="lms-empty">Memuat materi…</div>
  }

  if (muat.status === 'error') {
    return (
      <div className="lms-empty space-y-3">
        <p className="font-medium text-slate-700">{muat.pesan}</p>
        <button type="button" className="sw-btn-primary" onClick={cobaLagi}>
          Coba lagi
        </button>
      </div>
    )
  }

  if (perMapel.length === 0) {
    return (
      <div className="lms-empty">
        <p className="font-medium text-slate-700">Belum ada materi untuk Kelas {kelas}</p>
        <p className="mt-1">Materi dari gurumu akan muncul di sini.</p>
      </div>
    )
  }

  const mapelAktif = params.get('mapel')
  const terpilih = mapelAktif ? perMapel.find((p) => p.mapel === mapelAktif) : undefined

  /* —— Detail satu pelajaran —— */
  if (terpilih) {
    const a = aksenMapel(terpilih.mapel)
    const kelompok = kelompokkanMateri(terpilih.items)
    return (
      <div className="space-y-5">
        <section className="kelas-hero" style={{ background: a.cover }}>
          <div className="kelas-hero-deco" aria-hidden />
          <div className="kelas-hero-inner">
            <button
              type="button"
              className="kelas-hero-back min-h-10 cursor-pointer items-center border-0 bg-transparent p-0"
              onClick={() => setParams({})}
            >
              ← Semua pelajaran
            </button>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <span className="kelas-hero-badge">Kelas {kelas}</span>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {terpilih.mapel}
                </h1>
                <p className="mt-1 text-xs text-white/85">{terpilih.items.length} materi</p>
              </div>
              <div className="kelas-hero-mark" style={{ color: a.coverFg }} aria-hidden>
                {inisialMapel(terpilih.mapel)}
              </div>
            </div>
          </div>
        </section>

        {kelompok.map((g) => (
          <section key={g.key} className="materi-group">
            <h2 className="materi-group-title">{g.label}</h2>
            <ul className="sw-materi-list">
              {g.items.map((m) => (
                <li key={m.id} className="sw-materi-item">
                  <div className={`sw-materi-icon ${toneJenis(m.jenis)}`} aria-hidden>
                    <JenisIcon jenis={m.jenis} size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="sw-materi-title">{m.judul}</div>
                    {m.deskripsi && <p className="sw-materi-desc">{m.deskripsi}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                      <span className="materi-jenis-chip">{labelJenis(m.jenis)}</span>
                      {m.ukuran ? <span>{formatUkuran(m.ukuran)}</span> : null}
                    </div>
                  </div>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer" className="sw-btn-buka">
                      Buka
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  /* —— Daftar pelajaran —— */
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-lg font-bold text-slate-900">Materi Pelajaran</h1>
        <span className="lms-count-pill">{perMapel.length} pelajaran</span>
      </div>
      <div className="sw-mapel-grid">
        {perMapel.map((p) => {
          const a = aksenMapel(p.mapel)
          return (
            <button
              key={p.mapel}
              type="button"
              className="lms-card sw-mapel-card"
              onClick={() => setParams({ mapel: p.mapel })}
            >
              <div className="lms-card-cover" style={{ background: a.cover }}>
                <div className="lms-card-cover-deco" aria-hidden />
                <div className="lms-card-cover-mark" style={{ color: a.coverFg }} aria-hidden>
                  {inisialMapel(p.mapel)}
                </div>
              </div>
              <div className="lms-card-body">
                <h2 className="lms-card-title">{p.mapel}</h2>
                <div className="lms-card-footer">
                  <span className={`lms-chip ${a.chip}`}>{p.items.length} materi</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

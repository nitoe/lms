import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  daftarPengumpulanTugas,
  muatFoto,
  type PengumpulanDok,
} from '../lib/pengumpulan'
import { tenggatMs } from '../lib/tugasSiswa'
import type { TugasLms } from '../types/tugas'

type Props = { tugas: TugasLms }

function waktuTeks(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Tab «Pengumpulan» guru: daftar siswa yang sudah mengumpulkan foto.
 * Daftar memuat meta saja (ringan); foto dimuat HANYA saat baris dibuka (ANTIREGRESI §132.3).
 */
export default function PengumpulanPanel({ tugas }: Props) {
  const [list, setList] = useState<PengumpulanDok[] | null>(null)
  const [galat, setGalat] = useState('')
  const [buka, setBuka] = useState<string | null>(null)
  const [foto, setFoto] = useState<Record<string, string[] | 'memuat'>>({})

  const muat = useCallback(async () => {
    setGalat('')
    setList(null)
    try {
      setList(await daftarPengumpulanTugas(tugas))
    } catch (e) {
      console.warn('Pengumpulan gagal dimuat', e)
      setList([])
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
      setGalat(
        code === 'permission-denied'
          ? 'Pengumpulan belum bisa dibuka (aturan Firestore belum diperbarui atau Anda tidak mengampu kelas ini).'
          : 'Pengumpulan gagal dimuat. Coba lagi.',
      )
    }
  }, [tugas])

  useEffect(() => {
    void muat()
  }, [muat])

  const batas = useMemo(() => tenggatMs(tugas.tenggat), [tugas.tenggat])

  async function toggle(d: PengumpulanDok) {
    if (buka === d.id) {
      setBuka(null)
      return
    }
    setBuka(d.id)
    if (foto[d.id]) return
    setFoto((p) => ({ ...p, [d.id]: 'memuat' }))
    const hasil = await muatFoto(d.fotoIds)
    setFoto((p) => ({ ...p, [d.id]: hasil }))
  }

  return (
    <div className="td-form td-kumpul">
      <div className="td-kumpul-head">
        <div>
          <h2 className="td-kumpul-judul">Pengumpulan siswa</h2>
          <p className="td-kumpul-sub">
            Foto yang dikirim siswa lewat akun mereka. Penilaian tetap di tab «Input nilai».
          </p>
        </div>
        <button type="button" className="tg-btn" onClick={() => void muat()}>
          Muat ulang
        </button>
      </div>

      {galat && (
        <div className="tg-galat" role="alert">
          {galat}
        </div>
      )}
      {list === null && <p className="td-kumpul-kosong">Memuat…</p>}
      {list && list.length === 0 && !galat && (
        <p className="td-kumpul-kosong">Belum ada siswa yang mengumpulkan tugas ini.</p>
      )}

      {list && list.length > 0 && (
        <>
          <p className="td-kumpul-ringkas">{list.length} siswa sudah mengumpulkan.</p>
          <ul className="td-kumpul-list">
            {list.map((d) => {
              const terlambat = batas > 0 && d.diubahMs > batas
              const f = foto[d.id]
              return (
                <li key={d.id} className="td-kumpul-item">
                  <button
                    type="button"
                    className="td-kumpul-baris"
                    onClick={() => void toggle(d)}
                    aria-expanded={buka === d.id}
                  >
                    <span className="td-kumpul-nama">{d.siswaNama || d.siswaId}</span>
                    <span className="td-kumpul-meta">
                      {d.kelas} · {d.jumlahFoto} foto · {waktuTeks(d.diubahMs)}
                    </span>
                    {terlambat && <span className="td-kumpul-late">Terlambat</span>}
                    <span className="td-kumpul-chev" aria-hidden>
                      {buka === d.id ? '▲' : '▼'}
                    </span>
                  </button>
                  {buka === d.id && (
                    <div className="td-kumpul-detail">
                      {d.catatan && (
                        <p className="td-kumpul-catatan">
                          <strong>Catatan siswa:</strong> {d.catatan}
                        </p>
                      )}
                      {f === 'memuat' || f === undefined ? (
                        <p className="td-kumpul-kosong">Memuat foto…</p>
                      ) : f.length === 0 ? (
                        <p className="td-kumpul-kosong">Foto tidak bisa dimuat.</p>
                      ) : (
                        <div className="td-kumpul-foto">
                          {f.map((src, i) => (
                            <img key={i} src={src} alt={`Foto ${i + 1} dari ${d.siswaNama}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

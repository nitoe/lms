import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  daftarPengumpulanTugas,
  DAFTAR_SLOT,
  hapusPengumpulanSiswa,
  muatFotoBerslot,
  slotDariFotoId,
  type PengumpulanDok,
} from '../lib/pengumpulan'
import { adaBukti, namaKategoriBukti } from '../lib/buktiTugas'
import { LABEL_TAHAP } from '../types/tugas'
import { formatDurasi, formatUkuran, urlVideoTugas } from '../lib/videoTugas'
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
 * Tugas dengan bukti berlabel: tiap foto diberi nama bukti, bukti yang belum dikirim ditandai,
 * dan status «Bukti kurang» muncul di baris (ANTIREGRESI §Tugas.Bukti).
 */
export default function PengumpulanPanel({ tugas }: Props) {
  const [list, setList] = useState<PengumpulanDok[] | null>(null)
  const [galat, setGalat] = useState('')
  const [buka, setBuka] = useState<string | null>(null)
  const [foto, setFoto] = useState<Record<string, Record<number, string> | 'memuat'>>({})
  /** URL putar video per pengumpulan (dimuat saat baris dibuka; berisi token akses, jangan disimpan). */
  const [videoUrl, setVideoUrl] = useState<Record<string, Record<number, string>>>({})
  const [busyResetId, setBusyResetId] = useState<string | null>(null)

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

  async function resetKumpul(d: PengumpulanDok, hapusNilai: boolean) {
    const extra = hapusNilai
      ? ' Nilai yang sudah diisi juga dihapus agar siswa bisa mengumpulkan ulang.'
      : ' Nilai (jika ada) tetap — siswa hanya bisa kumpul ulang jika belum dinilai.'
    if (
      !window.confirm(
        `Reset pengumpulan ${d.siswaNama}? Foto/video kiriman dihapus.${extra}`,
      )
    ) {
      return
    }
    setBusyResetId(d.id)
    setGalat('')
    try {
      await hapusPengumpulanSiswa(tugas, d, { hapusNilai })
      setList((prev) => (prev ? prev.filter((x) => x.id !== d.id) : prev))
      setBuka((b) => (b === d.id ? null : b))
      setFoto((p) => {
        const n = { ...p }
        delete n[d.id]
        return n
      })
    } catch (e) {
      console.warn('reset pengumpulan', e)
      setGalat(e instanceof Error ? e.message : 'Gagal mereset pengumpulan.')
    } finally {
      setBusyResetId(null)
    }
  }

  async function toggle(d: PengumpulanDok) {
    if (buka === d.id) {
      setBuka(null)
      return
    }
    setBuka(d.id)
    if (foto[d.id]) return
    setFoto((p) => ({ ...p, [d.id]: 'memuat' }))
    const hasil = await muatFotoBerslot(d.fotoIds)
    setFoto((p) => ({ ...p, [d.id]: hasil }))
    const urls: Record<number, string> = {}
    for (const [k, v] of Object.entries(d.videos)) {
      try {
        urls[Number(k)] = await urlVideoTugas(v.path)
      } catch (e) {
        console.warn('Video pengumpulan gagal dimuat', v.path, e)
      }
    }
    if (Object.keys(urls).length > 0) setVideoUrl((p) => ({ ...p, [d.id]: urls }))
  }

  const bukti = tugas.buktiList ?? []
  const modeBukti = adaBukti(tugas)
  const kategori = tugas.pengaturanPenilaian?.kategori

  /** Label bukti wajib yang belum ada di pengumpulan siswa ini. */
  function buktiKurang(d: PengumpulanDok): string[] {
    if (!modeBukti) return []
    const terisi = new Set([...d.fotoIds.map(slotDariFotoId), ...Object.keys(d.videos).map(Number)])
    return bukti.filter((b) => b.wajib && !terisi.has(b.slot)).map((b) => b.label)
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
              const kurang = buktiKurang(d)
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
                    {kurang.length > 0 && (
                      <span className="td-kumpul-late" title={`Belum ada: ${kurang.join(', ')}`}>
                        Bukti kurang
                      </span>
                    )}
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
                      ) : Object.keys(f).length === 0 && Object.keys(d.videos).length === 0 ? (
                        <p className="td-kumpul-kosong">Foto tidak bisa dimuat.</p>
                      ) : modeBukti ? (
                        <div className="td-kumpul-foto">
                          {bukti.map((b) => {
                            const src = f[b.slot]
                            const video = b.jenis === 'video'
                            const vInfo = d.videos[b.slot]
                            const vUrl = videoUrl[d.id]?.[b.slot]
                            const dinilai = namaKategoriBukti(b, kategori)
                            return (
                              <figure key={b.id} className="td-kumpul-fig">
                                {video && vInfo ? (
                                  vUrl ? (
                                    <video className="td-kumpul-video" src={vUrl} controls playsInline preload="metadata" />
                                  ) : (
                                    <div className="td-kumpul-fig-kosong">Memuat video…</div>
                                  )
                                ) : src ? (
                                  <img src={src} alt={`${b.label} — ${d.siswaNama}`} />
                                ) : (
                                  <div className="td-kumpul-fig-kosong">
                                    {b.wajib ? 'Belum dikirim' : 'Tidak dikirim (opsional)'}
                                  </div>
                                )}
                                <figcaption>
                                  <strong>{b.label}</strong>
                                  {video && vInfo ? ` · ${formatDurasi(vInfo.durasi)}, ${formatUkuran(vInfo.ukuran)}` : ''}
                                  {b.tahap ? ` · ${LABEL_TAHAP[b.tahap]}` : ''}
                                  {b.wajib ? '' : ' · opsional'}
                                  {dinilai.length > 0 && (
                                    <span className="td-kumpul-fig-nilai">Dinilai pada: {dinilai.join(', ')}</span>
                                  )}
                                </figcaption>
                              </figure>
                            )
                          })}
                          {[...DAFTAR_SLOT]
                            .filter((n) => f[n] && !bukti.some((b) => b.slot === n))
                            .map((n) => (
                              <figure key={`lain-${n}`} className="td-kumpul-fig">
                                <img src={f[n]} alt={`Foto lain dari ${d.siswaNama}`} />
                                <figcaption>
                                  <strong>Foto lain</strong>
                                </figcaption>
                              </figure>
                            ))}
                        </div>
                      ) : (
                        <div className="td-kumpul-foto">
                          {[...DAFTAR_SLOT]
                            .filter((n) => f[n])
                            .map((n, i) => (
                              <img key={n} src={f[n]} alt={`Foto ${i + 1} dari ${d.siswaNama}`} />
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

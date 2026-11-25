import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  daftarPengumpulanTugas,
  DAFTAR_SLOT,
  hapusPengumpulanSiswa,
  muatFotoBerslot,
  slotDariFotoId,
  type PengumpulanDok,
} from '../lib/pengumpulan'
import { adaBukti, namaKategoriBukti } from '../lib/buktiTugas'
import KelompokGuruRingkas from './KelompokGuruRingkas'
import { LABEL_TAHAP } from '../types/tugas'
import { formatDurasi, formatUkuran, urlVideoTugas } from '../lib/videoTugas'
import { tenggatMs } from '../lib/tugasSiswa'
import { usulkanPredikatTugasAi, type UsulanPredikatAi } from '../lib/nilaiTugasAi'
import type { TugasLms } from '../types/tugas'

/** Ringkasan nilai di draf Input nilai untuk satu siswa (dari TugasDetail). */
export type NilaiRingkasPanel = { predikat: string; status: 'kosong' | 'ubah' | 'ok' }

type Props = {
  tugas: TugasLms
  /** Fitur AI (hanya akun AI). Tanpa prop ini panel berperilaku seperti biasa. */
  bisaAi?: boolean
  /** Daftar nilai sudah dimuat di TugasDetail (draf dapat ditulis)? */
  nilaiSiap?: boolean
  nilaiRingkas?: Record<string, NilaiRingkasPanel>
  /** Terapkan predikat (+ skor turunan) ke DRAF nilai siswa. Mengembalikan pesan galat bila gagal. */
  onTerapkanPredikat?: (siswaId: string, predikat: string, komentar?: string) => string | null
  /** Buka siswa itu di Input nilai → Menilai per siswa. */
  onBukaNilai?: (siswaId: string) => void
}

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
export default function PengumpulanPanel({
  tugas,
  bisaAi = false,
  nilaiSiap = false,
  nilaiRingkas,
  onTerapkanPredikat,
  onBukaNilai,
}: Props) {
  const [list, setList] = useState<PengumpulanDok[] | null>(null)
  const [galat, setGalat] = useState('')
  const [buka, setBuka] = useState<string | null>(null)
  const [foto, setFoto] = useState<Record<string, Record<number, string> | 'memuat'>>({})
  /** URL putar video per pengumpulan (dimuat saat baris dibuka; berisi token akses, jangan disimpan). */
  const [videoUrl, setVideoUrl] = useState<Record<string, Record<number, string>>>({})
  const [busyResetId, setBusyResetId] = useState<string | null>(null)
  /** Usulan predikat AI per pemilik pengumpulan (`siswaId`), bertahan selama panel terbuka. */
  const [predikatAi, setPredikatAi] = useState<Record<string, UsulanPredikatAi>>({})
  const [diterapkan, setDiterapkan] = useState<Record<string, string>>({})
  const [aiBusyId, setAiBusyId] = useState<string | null>(null)
  const [aiMassal, setAiMassal] = useState<{ selesai: number; total: number } | null>(null)
  const aiBatalRef = useRef(false)
  const [aiGalat, setAiGalat] = useState('')

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

  /** Minta AI memberi predikat untuk satu pengumpulan; `langsung` = terapkan ke draf tanpa menunggu klik. */
  async function mintaPredikat(d: PengumpulanDok, langsung = false): Promise<boolean> {
    setAiBusyId(d.siswaId)
    setAiGalat('')
    try {
      const u = await usulkanPredikatTugasAi(tugas.id, d.siswaId)
      setPredikatAi((p) => ({ ...p, [d.siswaId]: u }))
      if (langsung) terapkan(d.siswaId, u.predikat, u.komentarSiswa)
      return true
    } catch (e) {
      setAiGalat(`${d.siswaNama || d.siswaId}: ${e instanceof Error ? e.message : 'Gagal menilai dengan AI.'}`)
      return false
    } finally {
      setAiBusyId(null)
    }
  }

  function terapkan(siswaId: string, predikat: string, komentar?: string) {
    if (!onTerapkanPredikat) {
      setAiGalat('Daftar nilai belum siap.')
      return
    }
    // `null` = berhasil; teks = pesan galat. Jangan dipersingkat dengan `??` (null ikut dianggap kosong).
    const galatTerapkan = onTerapkanPredikat(siswaId, predikat, komentar)
    if (galatTerapkan) {
      setAiGalat(galatTerapkan)
      return
    }
    setDiterapkan((p) => ({ ...p, [siswaId]: predikat }))
  }

  /** Predikat AI untuk semua pengumpulan yang nilainya masih kosong; satu per satu, hasil ke draf. */
  async function mintaPredikatMassal() {
    if (!list) return
    const target = list.filter((d) => nilaiRingkas?.[d.siswaId]?.status === 'kosong')
    if (!target.length) {
      setAiGalat('Tidak ada pengumpulan yang belum dinilai.')
      return
    }
    if (
      !window.confirm(
        `AI akan memberi predikat untuk ${target.length} pengumpulan satu per satu (bisa beberapa menit).\n` +
          'Hasilnya masuk ke DRAF nilai dan belum tersimpan — Anda tetap memeriksa dan menyimpan di Input nilai.\nLanjutkan?',
      )
    )
      return
    aiBatalRef.current = false
    let gagal = 0
    for (let i = 0; i < target.length; i++) {
      if (aiBatalRef.current) break
      setAiMassal({ selesai: i, total: target.length })
      if (!(await mintaPredikat(target[i], true))) gagal++
      if (gagal >= 3) {
        setAiGalat('Dihentikan: 3 pengumpulan gagal diproses. Periksa pesan galat lalu coba lagi.')
        break
      }
    }
    setAiMassal(null)
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

  const jumlahTerlambat = list ? list.filter((d) => batas > 0 && d.diubahMs > batas).length : 0
  const jumlahKurang = list ? list.filter((d) => buktiKurang(d).length > 0).length : 0

  return (
    <div className="td-form td-kumpul">
      <div className="td-kumpul-head">
        <div>
          <h2 className="td-kumpul-judul">Pengumpulan siswa</h2>
          <p className="td-kumpul-sub">
            Foto yang dikirim siswa lewat akun mereka. Penilaian tetap di tab «Input nilai».
          </p>
        </div>
        <div className="td-kumpul-head-aksi">
          {bisaAi &&
            list !== null &&
            list.length > 0 &&
            (aiMassal ? (
              <button type="button" className="tg-btn" onClick={() => (aiBatalRef.current = true)}>
                Menilai {aiMassal.selesai + 1}/{aiMassal.total}… Batalkan
              </button>
            ) : (
              <button
                type="button"
                className="tg-btn td-btn-ai-massal"
                disabled={!nilaiSiap || aiBusyId !== null}
                onClick={() => void mintaPredikatMassal()}
                title={nilaiSiap ? 'AI memberi predikat untuk semua pengumpulan yang belum dinilai' : 'Memuat daftar nilai…'}
              >
                ✦ Predikat AI untuk semua
              </button>
            ))}
          <button type="button" className="tg-btn" onClick={() => void muat()}>
            Muat ulang
          </button>
        </div>
      </div>
      {aiGalat && (
        <div className="tg-galat" role="alert">
          {aiGalat}
        </div>
      )}

      {tugas.modeKelompok === true && list !== null && (
        <KelompokGuruRingkas tugas={tugas} pengumpulan={list} />
      )}

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
          <div className="td-kumpul-ringkas">
            <span className="td-kumpul-chip td-kumpul-chip--ok">
              <b>{list.length}</b> siswa sudah mengumpulkan
            </span>
            {jumlahTerlambat > 0 && (
              <span className="td-kumpul-chip td-kumpul-chip--warn">
                <b>{jumlahTerlambat}</b> terlambat
              </span>
            )}
            {jumlahKurang > 0 && (
              <span className="td-kumpul-chip td-kumpul-chip--warn">
                <b>{jumlahKurang}</b> bukti kurang
              </span>
            )}
          </div>
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
                  {bisaAi && (
                    <PredikatAiBaris
                      d={d}
                      usulan={predikatAi[d.siswaId]}
                      nilai={nilaiRingkas?.[d.siswaId]}
                      diterapkan={diterapkan[d.siswaId]}
                      siap={nilaiSiap}
                      sibuk={aiBusyId === d.siswaId}
                      terkunci={aiBusyId !== null || aiMassal !== null}
                      onMinta={() => void mintaPredikat(d)}
                      onTerapkan={(pred) => terapkan(d.siswaId, pred, predikatAi[d.siswaId]?.komentarSiswa)}
                      onBuka={onBukaNilai ? () => onBukaNilai(d.siswaId) : undefined}
                    />
                  )}
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
                      <div className="td-kumpul-reset">
                        <button
                          type="button"
                          className="tg-btn"
                          disabled={busyResetId === d.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            void resetKumpul(d, false)
                          }}
                        >
                          {busyResetId === d.id ? 'Mereset…' : 'Reset pengumpulan'}
                        </button>
                        <button
                          type="button"
                          className="tg-btn"
                          disabled={busyResetId === d.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            void resetKumpul(d, true)
                          }}
                          title="Hapus juga nilai agar siswa bisa kumpul ulang setelah dinilai"
                        >
                          Reset + hapus nilai
                        </button>
                      </div>
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

const TEKS_STATUS_NILAI = { kosong: 'Belum dinilai', ubah: 'Belum disimpan', ok: 'Tersimpan' } as const

/** Baris AI di bawah tiap pengumpulan: usulan predikat + alasan + terapkan ke draf nilai. */
function PredikatAiBaris(props: {
  d: PengumpulanDok
  usulan?: UsulanPredikatAi
  nilai?: NilaiRingkasPanel
  diterapkan?: string
  siap: boolean
  sibuk: boolean
  terkunci: boolean
  onMinta: () => void
  onTerapkan: (predikat: string) => void
  onBuka?: () => void
}) {
  const { usulan: u, nilai, diterapkan } = props
  const sudahDiterapkan = !!u && diterapkan === u.predikat
  return (
    <div className="td-pai">
      <div className="td-pai-baris">
        {!u ? (
          <button type="button" className="td-btn-ai-teks" disabled={props.terkunci || !props.siap} onClick={props.onMinta}>
            {props.sibuk ? 'Menganalisis…' : '✦ Predikat AI'}
          </button>
        ) : (
          <>
            <span className={`td-pai-predikat td-pai-predikat--${u.keyakinan}`} title="Usulan predikat AI">
              {u.predikat}
            </span>
            <span className={`td-chip td-ai-yakin td-ai-yakin--${u.keyakinan}`}>Yakin {u.keyakinan}</span>
            <button
              type="button"
              className="td-btn-ai-teks"
              disabled={props.terkunci || !props.siap}
              onClick={() => props.onTerapkan(u.predikat)}
              title="Isi predikat + skor per kategori ke draf nilai (belum tersimpan)"
            >
              {sudahDiterapkan ? 'Terapkan ulang' : 'Terapkan ke nilai'}
            </button>
            <button
              type="button"
              className="td-btn-ai-ulang"
              title="Minta AI menilai ulang"
              aria-label={`Nilai ulang ${props.d.siswaNama} dengan AI`}
              disabled={props.terkunci}
              onClick={props.onMinta}
            >
              {props.sibuk ? '…' : '↻'}
            </button>
          </>
        )}
        {nilai && (
          <span className={`td-pai-nilai td-pai-nilai--${nilai.status}`}>
            Nilai: {nilai.predikat || '—'} · {TEKS_STATUS_NILAI[nilai.status]}
          </span>
        )}
        {props.onBuka && (
          <button type="button" className="td-link-kecil" onClick={props.onBuka}>
            Buka di Input nilai ▸
          </button>
        )}
      </div>
      {u && (
        <p className={`td-pai-alasan${u.perluDicek ? ' td-pai-alasan--cek' : ''}`}>
          {u.perluDicek ? 'Periksa bukti sendiri. ' : ''}
          {u.alasan}
          {u.catatanKualitas.length > 0 ? ` (${u.catatanKualitas.join('; ')})` : ''}
        </p>
      )}
    </div>
  )
}

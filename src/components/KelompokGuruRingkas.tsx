/**
 * Ringkasan kelompok untuk guru di tab «Pengumpulan» (hanya tugas modeKelompok).
 * Menampilkan tiap kelompok: ketua, anggota, konfirmasi (informatif), pengajuan kirim mandiri,
 * dan apakah anggota sudah terkumpul lewat ketua atau mengirim sendiri.
 * Query guru WAJIB tugasId + kelas per rombel (ANTIREGRESI §Tugas.Kelompok). Gagal-sendiri.
 */
import { useEffect, useMemo, useState } from 'react'
import type { PengumpulanDok } from '../lib/pengumpulan'
import { useSekarang } from '../lib/useSekarang'
import {
  daftarKelompokTugas,
  daftarStatusAnggota,
  siswaTercakupPengumpulan,
  statusKonfirmasi,
  statusKumpulKelompok,
  teksSisaKonfirmasi,
  WAKTU_AUTO_KONFIRMASI_MS,
  type StatusAnggotaDok,
  type TugasKelompokDok,
} from '../lib/tugasKelompok'
import type { TugasLms } from '../types/tugas'
import '../styles/kelompok-status.css'

type Props = {
  tugas: TugasLms
  pengumpulan: PengumpulanDok[]
  /** Dipanggil setiap daftar kelompok selesai dimuat (untuk ringkasan di panel induk). */
  onKelompokDimuat?: (kelompok: TugasKelompokDok[]) => void
}

export default function KelompokGuruRingkas({ tugas, pengumpulan, onKelompokDimuat }: Props) {
  const [kelompok, setKelompok] = useState<TugasKelompokDok[] | null>(null)
  const [status, setStatus] = useState<StatusAnggotaDok[]>([])
  const [galat, setGalat] = useState('')
  const sekarang = useSekarang()
  const [saring, setSaring] = useState<'semua' | 'belum' | 'pengajuan'>('semua')

  useEffect(() => {
    let batal = false
    const kelasSemua = [...new Set([tugas.kelas, ...(tugas.kelasList ?? [])].filter(Boolean))]
    void (async () => {
      const k: TugasKelompokDok[] = []
      const st: StatusAnggotaDok[] = []
      let gagal = false
      for (const kls of kelasSemua) {
        try {
          k.push(...(await daftarKelompokTugas(tugas.id, kls)))
          st.push(...(await daftarStatusAnggota(tugas.id, kls).catch(() => [] as StatusAnggotaDok[])))
        } catch (e) {
          // Rombel paralel yang tidak diampu ditolak rules — lewati.
          console.warn('KelompokGuruRingkas', kls, e)
          if (kls === tugas.kelas) gagal = true
        }
      }
      if (batal) return
      setKelompok(k)
      setStatus(st)
      onKelompokDimuat?.(k)
      setGalat(gagal ? 'Data kelompok belum bisa dimuat (periksa aturan Firestore).' : '')
    })()
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tugas.id, tugas.kelas, tugas.kelasList])

  /** siswaId → ada dokumen pengumpulan (dasar semua aturan «sudah mengumpulkan»). */
  const kumpulPerSiswa = useMemo(() => Object.fromEntries(pengumpulan.map((p) => [p.siswaId, true as const])), [pengumpulan])

  // Ringkasan + saringan (dihitung sebelum return awal agar urutan hook tetap)
  const ringkas = useMemo(() => {
    const daftar = kelompok ?? []
    const punyaPengajuan = (kid: string) => status.some((x) => x.kelompokId === kid && x.pengajuan === 'menunggu')
    // Kelompok «sudah» = ketua ATAU anggota yang mewakili ketua mengumpulkan (bukan hanya ketua).
    const sudahKel = (k: TugasKelompokDok) => {
      const j = statusKumpulKelompok(k, kumpulPerSiswa).jenis
      return j === 'ketua' || j === 'wakil'
    }
    const semuaSiswa = new Set(daftar.flatMap((k) => [k.ketuaId, ...k.anggotaIds]))
    const tercakup = siswaTercakupPengumpulan(Object.keys(kumpulPerSiswa), daftar)
    return {
      total: daftar.length,
      sudah: daftar.filter(sudahKel).length,
      belum: daftar.filter((k) => !sudahKel(k)).length,
      sebagian: daftar.filter((k) => statusKumpulKelompok(k, kumpulPerSiswa).jenis === 'anggota').length,
      pengajuan: daftar.filter((k) => punyaPengajuan(k.id)).length,
      siswaTotal: semuaSiswa.size,
      siswaTercakup: [...semuaSiswa].filter((id) => tercakup.has(id)).length,
      punyaPengajuan,
      sudahKel,
    }
  }, [kelompok, status, kumpulPerSiswa])

  if (kelompok === null) return <p className="td-kumpul-kosong">Memuat kelompok…</p>

  const tampil = kelompok.filter((k) => {
    if (saring === 'belum') return !ringkas.sudahKel(k)
    if (saring === 'pengajuan') return ringkas.punyaPengajuan(k.id)
    return true
  })

  return (
    <section className="kg" aria-label="Kelompok">
      <header className="kg-kepala">
        <h4>Kelompok</h4>
        {kelompok.length > 0 && (
          <div className="kg-ringkas" aria-label="Ringkasan kelompok">
            <span className="kg-pil">
              <b>{ringkas.total}</b> kelompok
            </span>
            <span className="kg-pil kg-pil--ok">
              <b>{ringkas.sudah}</b> sudah mengumpulkan
            </span>
            <span className="kg-pil kg-pil--warn">
              <b>{ringkas.belum}</b> belum
            </span>
            <span className="kg-pil kg-pil--ok" title="Seluruh anggota kelompok yang buktinya dikirim ketua atau wakilnya ikut dihitung">
              <b>{ringkas.siswaTercakup}</b>/<b>{ringkas.siswaTotal}</b> siswa tercakup
            </span>
            {ringkas.pengajuan > 0 && (
              <span className="kg-pil kg-pil--info">
                <b>{ringkas.pengajuan}</b> ada pengajuan kirim sendiri
              </span>
            )}
          </div>
        )}
      </header>

      {kelompok.length > 1 && (
        <div className="kg-saring" role="group" aria-label="Saring kelompok">
          {(
            [
              { v: 'semua' as const, teks: 'Semua', n: ringkas.total },
              { v: 'belum' as const, teks: 'Belum mengumpulkan', n: ringkas.belum },
              { v: 'pengajuan' as const, teks: 'Ada pengajuan', n: ringkas.pengajuan },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              className={`tg-seg${saring === o.v ? ' tg-seg--on' : ''}`}
              aria-pressed={saring === o.v}
              onClick={() => setSaring(o.v)}
            >
              {o.teks}
              <i>{o.n}</i>
            </button>
          ))}
        </div>
      )}

      {galat && <p className="tg-galat">{galat}</p>}
      {kelompok.length === 0 && !galat && <p className="kg-kosong">Belum ada kelompok yang dibentuk siswa.</p>}
      {kelompok.length > 0 && tampil.length === 0 && <p className="kg-kosong">Tidak ada kelompok pada saringan ini.</p>}

      <div className="kg-grid">
        {tampil.map((k) => {
          const sk = statusKumpulKelompok(k, kumpulPerSiswa)
          const ketuaKumpul = sk.jenis === 'ketua' || sk.jenis === 'wakil'
          const namaPemilik = sk.pemilikId ? (k.anggotaList.find((x) => x.id === sk.pemilikId)?.nama ?? '') : ''
          const anggota = k.anggotaList.filter((a) => a.id !== k.ketuaId)
          return (
            <article key={k.id} className={`kg-kartu ${ketuaKumpul ? 'kg-kartu--sudah' : 'kg-kartu--belum'}`}>
              <header className="kg-kartu-kepala">
                <div className="kg-ketua">
                  <span className="kg-label">Ketua · {k.kelas}</span>
                  <b>{k.ketuaNama}</b>
                </div>
                <span className={`kg-status ${ketuaKumpul ? 'kg-status--sudah' : 'kg-status--belum'}`}>
                  {ketuaKumpul ? 'Sudah mengumpulkan' : sk.jenis === 'anggota' ? 'Sebagian mengumpulkan' : 'Belum mengumpulkan'}
                </span>
              </header>
              {sk.jenis === 'wakil' && (
                <p className="kg-wakil">
                  Dikirim <b>{namaPemilik}</b> mewakili ketua.
                </p>
              )}
              {sk.jenis === 'anggota' && (
                <p className="kg-wakil kg-wakil--cek">
                  Ketua belum mengumpulkan; {sk.pengirimIds.length} anggota mengirim sendiri (masing-masing dinilai sendiri).
                </p>
              )}

              {anggota.length === 0 ? (
                <p className="kg-kosong kg-kosong--kecil">Belum ada anggota lain.</p>
              ) : (
                <ul className="kg-anggota">
                  {anggota.map((a) => {
                    const st = status.find((x) => x.kelompokId === k.id && x.siswaId === a.id)
                    const sendiri = !!kumpulPerSiswa[a.id]
                    const kf = statusKonfirmasi(k, st, sekarang)
                    return (
                      <li key={a.id} className="kg-baris">
                        <span className="kg-nama">{a.nama}</span>
                        <span className="kg-tanda">
                          {kf.jenis === 'manual' && (
                            <span className="kg-konf kg-konf--manual" title="Anggota sudah menekan konfirmasi">
                              ✓ konfirmasi
                            </span>
                          )}
                          {kf.jenis === 'otomatis' && (
                            <span
                              className="kg-konf kg-konf--auto"
                              title="Tidak ada respons selama 1 jam sejak kelompok dibentuk/diubah — dianggap terkonfirmasi"
                            >
                              ✓ otomatis
                            </span>
                          )}
                          {kf.jenis === 'belum' && (
                            <span className="kg-konf kg-konf--belum" title="Menunggu konfirmasi anggota">
                              ◷ menunggu{kf.sisaMs > 0 ? ` ${teksSisaKonfirmasi(kf.sisaMs)}` : ''}
                            </span>
                          )}
                          {sendiri ? (
                            sk.jenis === 'wakil' && a.id === sk.pemilikId ? (
                              <span className="kg-sumber kg-sumber--wakil">mewakili ketua</span>
                            ) : (
                              <span className="kg-sumber kg-sumber--sendiri">mengirim sendiri</span>
                            )
                          ) : ketuaKumpul ? (
                            <span className="kg-sumber">
                              {sk.jenis === 'wakil' ? `lewat ${namaPemilik.split(' ')[0]}` : 'lewat ketua'}
                            </span>
                          ) : null}
                        </span>
                        {st?.pengajuan === 'menunggu' && (
                          <span className="kg-pengajuan kg-pengajuan--menunggu">Mengajukan kirim sendiri — menunggu keputusan ketua</span>
                        )}
                        {st?.pengajuan === 'diterima' && (
                          <span className="kg-pengajuan kg-pengajuan--diterima">Diizinkan kirim sendiri</span>
                        )}
                        {st?.pengajuan === 'ditolak' && (
                          <span className="kg-pengajuan kg-pengajuan--ditolak">Pengajuan kirim sendiri ditolak ketua</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          )
        })}
      </div>

      <p className="kg-catatan">
        Konfirmasi hanya informasi. Anggota tanpa respons dalam {Math.round(WAKTU_AUTO_KONFIRMASI_MS / 60000)} menit
        otomatis dianggap terkonfirmasi (siswa tanpa HP). Nilai tetap diinput per siswa di tab «Input nilai».
      </p>
    </section>
  )
}

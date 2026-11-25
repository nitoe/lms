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
  statusKonfirmasi,
  teksSisaKonfirmasi,
  WAKTU_AUTO_KONFIRMASI_MS,
  type StatusAnggotaDok,
  type TugasKelompokDok,
} from '../lib/tugasKelompok'
import type { TugasLms } from '../types/tugas'
import '../styles/kelompok-status.css'

type Props = { tugas: TugasLms; pengumpulan: PengumpulanDok[] }

export default function KelompokGuruRingkas({ tugas, pengumpulan }: Props) {
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
      setGalat(gagal ? 'Data kelompok belum bisa dimuat (periksa aturan Firestore).' : '')
    })()
    return () => {
      batal = true
    }
  }, [tugas.id, tugas.kelas, tugas.kelasList])

  const kumpulPerSiswa = useMemo(() => new Map(pengumpulan.map((p) => [p.siswaId, p])), [pengumpulan])

  // Ringkasan + saringan (dihitung sebelum return awal agar urutan hook tetap)
  const ringkas = useMemo(() => {
    const daftar = kelompok ?? []
    const punyaPengajuan = (kid: string) => status.some((x) => x.kelompokId === kid && x.pengajuan === 'menunggu')
    return {
      total: daftar.length,
      sudah: daftar.filter((k) => kumpulPerSiswa.has(k.ketuaId)).length,
      belum: daftar.filter((k) => !kumpulPerSiswa.has(k.ketuaId)).length,
      pengajuan: daftar.filter((k) => punyaPengajuan(k.id)).length,
      punyaPengajuan,
    }
  }, [kelompok, status, kumpulPerSiswa])

  if (kelompok === null) return <p className="td-kumpul-kosong">Memuat kelompok…</p>

  const tampil = kelompok.filter((k) => {
    if (saring === 'belum') return !kumpulPerSiswa.has(k.ketuaId)
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
          const ketuaKumpul = kumpulPerSiswa.has(k.ketuaId)
          const anggota = k.anggotaList.filter((a) => a.id !== k.ketuaId)
          return (
            <article key={k.id} className={`kg-kartu ${ketuaKumpul ? 'kg-kartu--sudah' : 'kg-kartu--belum'}`}>
              <header className="kg-kartu-kepala">
                <div className="kg-ketua">
                  <span className="kg-label">Ketua · {k.kelas}</span>
                  <b>{k.ketuaNama}</b>
                </div>
                <span className={`kg-status ${ketuaKumpul ? 'kg-status--sudah' : 'kg-status--belum'}`}>
                  {ketuaKumpul ? 'Sudah mengumpulkan' : 'Belum mengumpulkan'}
                </span>
              </header>

              {anggota.length === 0 ? (
                <p className="kg-kosong kg-kosong--kecil">Belum ada anggota lain.</p>
              ) : (
                <ul className="kg-anggota">
                  {anggota.map((a) => {
                    const st = status.find((x) => x.kelompokId === k.id && x.siswaId === a.id)
                    const sendiri = kumpulPerSiswa.has(a.id)
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
                            <span className="kg-sumber kg-sumber--sendiri">mengirim sendiri</span>
                          ) : ketuaKumpul ? (
                            <span className="kg-sumber">lewat ketua</span>
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

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

  if (kelompok === null) return <p className="td-kumpul-kosong">Memuat kelompok…</p>

  return (
    <section className="sw-kelompok-kotak" aria-label="Kelompok">
      <h4>Kelompok ({kelompok.length})</h4>
      {galat && <p className="tg-galat">{galat}</p>}
      {kelompok.length === 0 && !galat && <p>Belum ada kelompok yang dibentuk siswa.</p>}
      <ul className="sw-kelompok-pengajuan-list">
        {kelompok.map((k) => {
          const ketuaKumpul = kumpulPerSiswa.has(k.ketuaId)
          return (
            <li key={k.id}>
              <div className="sw-kelompok-pengajuan-nama">
                Ketua: {k.ketuaNama} · {k.kelas}
                <span className={`sw-kelompok-chip ${ketuaKumpul ? 'sw-kelompok-chip--ok' : 'sw-kelompok-chip--warn'}`}>
                  {ketuaKumpul ? 'sudah mengumpulkan' : 'belum mengumpulkan'}
                </span>
              </div>
              <ul className="sw-kelompok-anggota">
                {k.anggotaList
                  .filter((a) => a.id !== k.ketuaId)
                  .map((a) => {
                    const st = status.find((x) => x.kelompokId === k.id && x.siswaId === a.id)
                    const sendiri = kumpulPerSiswa.has(a.id)
                    return (
                      <li key={a.id}>
                        {a.nama}
                        {(() => {
                          const kf = statusKonfirmasi(k, st, sekarang)
                          if (kf.jenis === 'manual') {
                            return <span className="sw-kelompok-chip sw-kelompok-chip--ok">sudah konfirmasi</span>
                          }
                          if (kf.jenis === 'otomatis') {
                            return (
                              <span
                                className="sw-kelompok-chip sw-kelompok-chip--auto"
                                title="Tidak ada respons selama 1 jam sejak kelompok dibentuk/diubah"
                              >
                                terkonfirmasi otomatis
                              </span>
                            )
                          }
                          return (
                            <span className="sw-kelompok-chip">
                              belum konfirmasi{kf.sisaMs > 0 ? ` · otomatis ${teksSisaKonfirmasi(kf.sisaMs)}` : ''}
                            </span>
                          )
                        })()}
                        {sendiri ? (
                          <span className="sw-kelompok-chip sw-kelompok-chip--info">mengirim sendiri</span>
                        ) : ketuaKumpul ? (
                          <span className="sw-kelompok-chip sw-kelompok-chip--info">lewat ketua</span>
                        ) : null}
                        {st?.pengajuan === 'menunggu' && (
                          <span className="sw-kelompok-chip sw-kelompok-chip--warn">mengajukan kirim sendiri</span>
                        )}
                        {st?.pengajuan === 'diterima' && (
                          <span className="sw-kelompok-chip sw-kelompok-chip--ok">diizinkan kirim sendiri</span>
                        )}
                        {st?.pengajuan === 'ditolak' && (
                          <span className="sw-kelompok-chip sw-kelompok-chip--danger">pengajuan ditolak</span>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </li>
          )
        })}
      </ul>
      <p className="sw-hint">
        Konfirmasi anggota hanya informasi. Anggota yang tidak merespons dalam{' '}
        {Math.round(WAKTU_AUTO_KONFIRMASI_MS / 60000)} menit sejak kelompok dibentuk/diubah otomatis dianggap
        terkonfirmasi (untuk siswa tanpa HP). Nilai tetap diinput per siswa di tab «Input nilai».
      </p>
    </section>
  )
}

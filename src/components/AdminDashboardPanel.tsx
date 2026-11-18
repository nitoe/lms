import { useCallback, useEffect, useState } from 'react'
import {
  muatAdminDashboard,
  type AdminDashboardData,
  type GuruStat,
  type KelasCakupan,
} from '../lib/adminDashboard'
import { IkonRefresh } from './ikonRuang'

type Props = {
  /** Dipanggil hanya bila user admin. */
  aktif: boolean
}

function persen(n: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((n / total) * 100)}%`
}

function formatWaktu(d: Date): string {
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminDashboardPanel({ aktif }: Props) {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const muat = useCallback(async () => {
    if (!aktif) return
    setMemuat(true)
    setError(null)
    try {
      const d = await muatAdminDashboard()
      setData(d)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      console.warn('AdminDashboardPanel', e)
    } finally {
      setMemuat(false)
    }
  }, [aktif])

  useEffect(() => {
    if (!aktif) {
      setData(null)
      return
    }
    void muat()
  }, [aktif, muat])

  if (!aktif) return null

  return (
    <section className="ad-panel" aria-label="Dashboard administrator">
      <div className="ad-kepala">
        <div>
          <h2 className="ad-judul">Dashboard Kurikulum</h2>
          <p className="ad-sub">
            Ringkasan performa guru, cakupan materi, dan aktivitas siswa di LMS.
            {data ? (
              <>
                {' '}
                Diperbarui {formatWaktu(data.dimuatPada)}.
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="rg-btn"
          onClick={() => void muat()}
          disabled={memuat}
          title="Muat ulang data"
        >
          <IkonRefresh size={14} />
          {memuat ? 'Memuat…' : 'Muat ulang'}
        </button>
      </div>

      {error && (
        <p className="ad-galat" role="alert">
          Gagal memuat dashboard: {error}
        </p>
      )}

      {memuat && !data && (
        <div className="ad-skel" aria-busy="true" aria-label="Memuat dashboard">
          <div className="rg-baris-skel" />
          <div className="rg-baris-skel" />
          <div className="rg-baris-skel" />
        </div>
      )}

      {data && (
        <>
          {/* Kartu ringkas */}
          <div className="ad-stats">
            <div className="ad-stat">
              <b>{data.ringkas.totalMateri}</b>
              <span>Materi</span>
            </div>
            <div className="ad-stat">
              <b>
                {data.ringkas.totalKuisAktif}
                <small>/{data.ringkas.totalKuis}</small>
              </b>
              <span>Kuis aktif</span>
            </div>
            <div className="ad-stat">
              <b>
                {data.ringkas.totalTugasAktif}
                <small>/{data.ringkas.totalTugas}</small>
              </b>
              <span>Tugas aktif</span>
            </div>
            <div className="ad-stat">
              <b>{data.ringkas.totalSiswa}</b>
              <span>Siswa aktif</span>
            </div>
            <div className="ad-stat">
              <b>
                {data.ringkas.guruDenganKonten}
                <small>/{data.ringkas.totalGuru || '—'}</small>
              </b>
              <span>Guru berkonten</span>
            </div>
            <div className="ad-stat ad-stat--aksi">
              <b>{data.aktivitasHariIni.siswaUnik}</b>
              <span>Siswa aktif hari ini</span>
            </div>
          </div>

          {/* Aktivitas hari ini */}
          <div className="ad-grid2">
            <div className="ad-kartu">
              <h3 className="ad-kartu-judul">Aktivitas siswa hari ini</h3>
              <ul className="ad-list-angka">
                <li>
                  <span>Jawaban kuis</span>
                  <b>{data.aktivitasHariIni.jawabanKuis}</b>
                </li>
                <li>
                  <span>Pengumpulan tugas</span>
                  <b>{data.aktivitasHariIni.pengumpulanTugas}</b>
                </li>
                <li>
                  <span>Siswa unik terlibat</span>
                  <b>
                    {data.aktivitasHariIni.siswaUnik}
                    {data.ringkas.totalSiswa > 0 && (
                      <small className="ad-muted">
                        {' '}
                        ({persen(data.aktivitasHariIni.siswaUnik, data.ringkas.totalSiswa)})
                      </small>
                    )}
                  </b>
                </li>
              </ul>
              {data.aktivitasHariIni.kelasTeratas.length > 0 ? (
                <>
                  <p className="ad-label">Kelas terbanyak memanfaatkan LMS hari ini</p>
                  <ol className="ad-ranking">
                    {data.aktivitasHariIni.kelasTeratas.map((k, i) => (
                      <li key={k.kelas}>
                        <span className="ad-rank">{i + 1}</span>
                        <span className="ad-rank-nama">{k.kelas}</span>
                        <span className="ad-rank-nilai">{k.aktivitas} aksi</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="ad-kosong-kecil">Belum ada aktivitas tercatat hari ini.</p>
              )}
            </div>

            <div className="ad-kartu">
              <h3 className="ad-kartu-judul">Temuan untuk ditindaklanjuti</h3>
              {data.alert.length === 0 ? (
                <p className="ad-kosong-kecil">Tidak ada temuan kritis saat ini.</p>
              ) : (
                <ul className="ad-alert">
                  {data.alert.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Performa guru */}
          <div className="ad-kartu">
            <h3 className="ad-kartu-judul">Performa guru (konten yang dibuat)</h3>
            <p className="ad-bantuan">
              Dihitung dari field pembuat materi, kuis, dan tugas. Konten Lomba tidak dihitung.
            </p>
            {data.guru.length === 0 ? (
              <p className="ad-kosong-kecil">Belum ada konten yang tercatat.</p>
            ) : (
              <div className="ad-tabel-wrap">
                <table className="ad-tabel">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Guru</th>
                      <th className="ad-num">Materi</th>
                      <th className="ad-num">Kuis</th>
                      <th className="ad-num">Tugas</th>
                      <th className="ad-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.guru.map((g: GuruStat, i: number) => (
                      <tr key={g.key}>
                        <td>{i + 1}</td>
                        <td className="ad-nama">{g.nama}</td>
                        <td className="ad-num">{g.materi}</td>
                        <td className="ad-num">{g.kuis}</td>
                        <td className="ad-num">{g.tugas}</td>
                        <td className="ad-num ad-num--kuat">{g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cakupan per kelas */}
          <div className="ad-kartu">
            <h3 className="ad-kartu-judul">Cakupan materi per kelas</h3>
            <p className="ad-bantuan">
              Mapel tanpa materi = mapel master yang belum punya dokumen materi (termasuk yang
              dibagikan lewat kelasList). Kuis/tugas dihitung dari kelas utama dokumen.
            </p>
            <div className="ad-tabel-wrap">
              <table className="ad-tabel">
                <thead>
                  <tr>
                    <th>Kelas</th>
                    <th className="ad-num">Materi</th>
                    <th className="ad-num">Kuis</th>
                    <th className="ad-num">Tugas</th>
                    <th>Mapel punya materi</th>
                    <th>Mapel belum ada materi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kelasCakupan.map((k: KelasCakupan) => (
                    <tr
                      key={k.kelas}
                      className={
                        k.mapelTanpaMateri.length > 0 && k.mapelDenganMateri.length === 0
                          ? 'ad-row--bahaya'
                          : k.mapelTanpaMateri.length > 0
                            ? 'ad-row--peringatan'
                            : undefined
                      }
                    >
                      <td className="ad-nama">{k.kelas}</td>
                      <td className="ad-num">{k.jumlahMateri}</td>
                      <td className="ad-num">{k.jumlahKuis}</td>
                      <td className="ad-num">{k.jumlahTugas}</td>
                      <td>
                        {k.mapelDenganMateri.length === 0 ? (
                          <span className="ad-muted">—</span>
                        ) : (
                          <span title={k.mapelDenganMateri.join(', ')}>
                            {k.mapelDenganMateri.length}
                            <span className="ad-muted"> mapel</span>
                          </span>
                        )}
                      </td>
                      <td>
                        {k.mapelTanpaMateri.length === 0 ? (
                          <span className="ad-ok">Lengkap</span>
                        ) : k.mapelTanpaMateri.length <= 4 ? (
                          <span className="ad-warn" title={k.mapelTanpaMateri.join(', ')}>
                            {k.mapelTanpaMateri.join(', ')}
                          </span>
                        ) : (
                          <span className="ad-warn" title={k.mapelTanpaMateri.join(', ')}>
                            {k.mapelTanpaMateri.length} mapel
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

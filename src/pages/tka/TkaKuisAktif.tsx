/**
 * Daftar kuis TKA yang masih aktif (semua mata pelajaran) untuk dashboard utama TKA.
 * Aktif = `aktif === true` dan jendela waktu belum berakhir (waktuSelesai kosong / di masa depan).
 * Tiap mapel diquery sendiri (where kelas + mapel) — sesuai rules lms_kuis. ANTIREGRESI §115.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { daftarKuis } from '../../lib/kuis'
import { LABEL_MAPEL_TKA, MAPEL_TKA, ruangTka, type MapelTkaNama } from '../../lib/tkaAkses'
import { NAMA_TAHAP_TRYOUT_TKA, type KuisLms } from '../../types/kuis'

type Meta = { inisial: string; gradien: string; aksen: string }

type Props = {
  meta: Record<MapelTkaNama, Meta>
}

type Status = 'berlangsung' | 'terjadwal'

type ItemAktif = { kuis: KuisLms; status: Status; mulai: Date | null; selesai: Date | null }

function keTanggal(v: unknown): Date | null {
  if (!v) return null
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'object') {
    const o = v as { toDate?: () => Date; seconds?: number }
    if (typeof o.toDate === 'function') return o.toDate()
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000)
  }
  return null
}

function fmtWaktu(d: Date): string {
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function saring(list: KuisLms[], sekarang: Date): ItemAktif[] {
  const out: ItemAktif[] = []
  for (const k of list) {
    if (k.aktif !== true) continue
    const mulai = keTanggal(k.waktuMulai)
    const selesai = keTanggal(k.waktuSelesai)
    if (selesai && selesai.getTime() < sekarang.getTime()) continue // sudah berakhir
    const status: Status = mulai && mulai.getTime() > sekarang.getTime() ? 'terjadwal' : 'berlangsung'
    out.push({ kuis: k, status, mulai, selesai })
  }
  return out
}

export default function TkaKuisAktif({ meta }: Props) {
  const [data, setData] = useState<Record<MapelTkaNama, ItemAktif[]> | null>(null)
  const [gagal, setGagal] = useState<MapelTkaNama[]>([])

  useEffect(() => {
    let batal = false
    void (async () => {
      const sekarang = new Date()
      const gagalBaru: MapelTkaNama[] = []
      const hasil = await Promise.all(
        MAPEL_TKA.map(async (m) => {
          try {
            return saring(await daftarKuis(ruangTka(m).kelas, m), sekarang)
          } catch {
            gagalBaru.push(m)
            return [] as ItemAktif[]
          }
        }),
      )
      if (batal) return
      const peta = {} as Record<MapelTkaNama, ItemAktif[]>
      MAPEL_TKA.forEach((m, i) => {
        peta[m] = hasil[i]
      })
      setData(peta)
      setGagal(gagalBaru)
    })()
    return () => {
      batal = true
    }
  }, [])

  const total = data ? MAPEL_TKA.reduce((a, m) => a + data[m].length, 0) : 0

  return (
    <div>
      <p className="tka-dash-section-label">
        Kuis TKA aktif{data ? ` · ${total}` : ''}
      </p>
      <section className="tka-ka mt-2" aria-label="Kuis TKA yang masih aktif">
        {!data && <p className="tka-ka-kosong">Memuat kuis aktif…</p>}
        {data && total === 0 && gagal.length === 0 && (
          <p className="tka-ka-kosong">
            Belum ada kuis TKA yang aktif. Susun kuis dari tab Kuis pada ruang mata pelajaran, lalu
            aktifkan agar siswa dapat mengerjakannya.
          </p>
        )}
        {gagal.length > 0 && (
          <p className="tka-ka-gagal" role="alert">
            Gagal memuat kuis: {gagal.map((m) => LABEL_MAPEL_TKA[m]).join(', ')}.
          </p>
        )}
        {data &&
          MAPEL_TKA.filter((m) => data[m].length > 0).map((m) => {
            const mt = meta[m]
            const ruang = ruangTka(m)
            return (
              <div key={m} className="tka-ka-grup">
                <div className="tka-ka-grup-head">
                  <span className="tka-ka-chip" style={{ background: mt.gradien, color: mt.aksen }}>
                    {mt.inisial}
                  </span>
                  <span className="tka-ka-grup-nama">{LABEL_MAPEL_TKA[m]}</span>
                  <span className="tka-ka-grup-jumlah">{data[m].length} kuis</span>
                </div>
                <ul className="tka-ka-daftar">
                  {data[m].map(({ kuis, status, mulai, selesai }) => (
                    <li key={kuis.id} className="tka-ka-item">
                      <div className="tka-ka-info">
                        <p className="tka-ka-judul">{kuis.judul}</p>
                        <p className="tka-ka-meta">
                          {kuis.tahapTryOutTka
                            ? NAMA_TAHAP_TRYOUT_TKA[kuis.tahapTryOutTka]
                            : 'Tanpa tahap'}
                          {' · '}
                          {kuis.jumlahSoal} soal
                          {kuis.durasiMenit ? ` · ${kuis.durasiMenit} menit` : ''}
                          {status === 'terjadwal' && mulai ? ` · mulai ${fmtWaktu(mulai)}` : ''}
                          {selesai ? ` · sampai ${fmtWaktu(selesai)}` : ''}
                        </p>
                      </div>
                      <span
                        className={
                          status === 'berlangsung'
                            ? 'tka-ka-status tka-ka-status--on'
                            : 'tka-ka-status tka-ka-status--jadwal'
                        }
                      >
                        {status === 'berlangsung' ? 'Berlangsung' : 'Terjadwal'}
                      </span>
                      <Link
                        to={`/kelas/${encodeURIComponent(ruang.id)}?tab=kuis`}
                        className="tka-ka-buka"
                        aria-label={`Buka kuis ${kuis.judul}`}
                      >
                        Buka →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
      </section>
    </div>
  )
}

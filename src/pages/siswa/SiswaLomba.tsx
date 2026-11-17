import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiswa } from '../../context/SiswaContext'
import { daftarLombaSiswa } from '../../lib/lomba'
import { labelStatusLomba, lombaSedangBerlangsung } from '../../lib/lombaAkses'
import { daftarKuisLombaAktif } from '../../lib/kuis'
import type { Lomba } from '../../types/lomba'
import { TINGKAT_LOMBA } from '../../types/lomba'
import type { KuisLms } from '../../types/kuis'
import '../../styles/lomba.css'

function formatTanggal(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelTingkat(t: string): string {
  return TINGKAT_LOMBA.find((x) => x.value === t)?.label ?? t
}

function badgeClass(status: string, berlangsung: boolean): string {
  if (berlangsung) return 'lomba-badge lomba-badge--aktif'
  if (status === 'draf') return 'lomba-badge lomba-badge--draf'
  return 'lomba-badge lomba-badge--selesai'
}

function waktuMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isNaN(t) ? 0 : t
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  return 0
}

/** Kuis aktif yang jendela waktunya sedang terbuka (boleh dikerjakan sekarang). */
function kuisSedangBuka(k: KuisLms, sekarang = Date.now()): boolean {
  if (!k.aktif) return false
  const mulai = waktuMs(k.waktuMulai)
  const selesai = waktuMs(k.waktuSelesai)
  if (mulai && sekarang < mulai) return false
  if (selesai && sekarang > selesai) return false
  return true
}

type InfoKuisLomba = {
  adaKuisAktif: boolean
  adaKuisBuka: boolean
  jumlahBuka: number
}

/** Dashboard Lomba siswa — daftar lomba yang diikuti. */
export default function SiswaLomba() {
  const { sesi } = useSiswa()
  const [list, setList] = useState<Lomba[]>([])
  const [infoKuis, setInfoKuis] = useState<Record<string, InfoKuisLomba>>({})
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')

  const muat = useCallback(async () => {
    if (!sesi?.id) return
    setLoading(true)
    setGalat('')
    try {
      const lombas = await daftarLombaSiswa(sesi.id)
      setList(lombas)

      const map: Record<string, InfoKuisLomba> = {}
      await Promise.all(
        lombas.map(async (l) => {
          try {
            const kuis = await daftarKuisLombaAktif(l.id)
            const buka = kuis.filter((k) => kuisSedangBuka(k))
            map[l.id] = {
              adaKuisAktif: kuis.length > 0,
              adaKuisBuka: buka.length > 0,
              jumlahBuka: buka.length,
            }
          } catch (e) {
            console.warn('daftarKuisLombaAktif (daftar siswa)', l.id, e)
            map[l.id] = { adaKuisAktif: false, adaKuisBuka: false, jumlahBuka: 0 }
          }
        }),
      )
      setInfoKuis(map)
    } catch (e) {
      console.error(e)
      setGalat(e instanceof Error ? e.message : 'Gagal memuat lomba.')
      setList([])
      setInfoKuis({})
    } finally {
      setLoading(false)
    }
  }, [sesi?.id])

  useEffect(() => {
    void muat()
  }, [muat])

  if (loading) {
    return <div className="p-6 text-sm text-muted">Memuat lomba…</div>
  }

  if (galat) {
    return (
      <div className="p-6">
        <div className="lomba-alert">{galat}</div>
      </div>
    )
  }

  return (
    <div className="lomba-dash space-y-4 p-4 sm:p-6">
      <section className="lomba-hero">
        <div className="lomba-hero-inner">
          <p className="lomba-eyebrow">Untukmu</p>
          <h1 className="lomba-judul">Lomba</h1>
          <p className="lomba-lead">
            Materi, kuis latihan, dan riwayat untuk lomba yang kamu ikuti.
          </p>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="lomba-kosong">
          <h3>Belum ada lomba</h3>
          <p>
            Kamu belum terdaftar sebagai peserta. Tanya guru atau admin jika seharusnya ikut.
          </p>
        </div>
      ) : (
        <ul className="lomba-grid">
          {list.map((l) => {
            const berlangsung = lombaSedangBerlangsung(l)
            const info = infoKuis[l.id]
            const bisaMulai = !!info?.adaKuisBuka
            return (
              <li key={l.id} className="lomba-kartu">
                <div className="lomba-kartu-head">
                  <div className="min-w-0">
                    <h2 className="lomba-kartu-nama">
                      <Link to={`/siswa/lomba/${l.id}`}>{l.nama}</Link>
                    </h2>
                    {l.identitas ? (
                      <p className="lomba-kartu-identitas">{l.identitas}</p>
                    ) : null}
                  </div>
                  <span className={badgeClass(l.status, berlangsung)}>
                    {berlangsung ? 'Berlangsung' : labelStatusLomba(l.status)}
                  </span>
                </div>
                <dl className="lomba-kartu-meta">
                  <div>
                    <dd>
                      <span className="label">Tingkat</span>
                      <span className="nilai">{labelTingkat(l.tingkat)}</span>
                    </dd>
                  </div>
                  <div>
                    <dd>
                      <span className="label">Masa</span>
                      <span className="nilai">
                        {formatTanggal(l.mulai)} – {formatTanggal(l.selesai)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dd>
                      <span className="label">Pengampu</span>
                      <span className="nilai">{l.guruPengampuNama || '—'}</span>
                    </dd>
                  </div>
                </dl>
                {l.mapelTerkait.length > 0 && (
                  <div className="px-[1.1rem] pb-2">
                    <div className="lomba-pill-row">
                      {l.mapelTerkait.map((m) => (
                        <span key={m} className="lomba-pill">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {bisaMulai && (
                  <div className="px-[1.1rem] pb-1">
                    <span className="lomba-kuis-hint">
                      {info!.jumlahBuka} kuis siap dikerjakan
                    </span>
                  </div>
                )}
                <div className="lomba-kartu-foot">
                  {bisaMulai ? (
                    <Link to={`/siswa/lomba/${l.id}`} className="lomba-cta-mulai">
                      Mulai kerjakan
                    </Link>
                  ) : (
                    <Link to={`/siswa/lomba/${l.id}`}>Lihat detail</Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

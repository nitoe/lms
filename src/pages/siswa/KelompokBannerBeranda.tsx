/**
 * Pemberitahuan tugas kelompok di Beranda siswa (ANTIREGRESI §Tugas.Kelompok):
 * - anggota: «Kamu masuk kelompok X» sampai ia menekan «Saya sudah tahu» di detail tugas;
 * - ketua: ada anggota yang mengajukan kirim bukti sendiri dan menunggu keputusan.
 * Gagal-sendiri: galat query hanya dicatat ke console dan banner disembunyikan (Beranda tidak boleh
 * rusak karena satu query ditolak). Tidak ada query yang menyentuh data siswa lain di luar kelasnya.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  kelompokKelasSaya,
  statusAnggotaSaya,
  statusUntukKetua,
  type StatusAnggotaDok,
  type TugasKelompokDok,
} from '../../lib/tugasKelompok'
import type { TugasSiswaRingkas } from '../../lib/tugasSiswa'
import '../../styles/kelompok-status.css'

type Props = {
  kelas: string
  siswaId: string
  /** Daftar tugas aktif beranda (null = masih memuat). */
  tugas: TugasSiswaRingkas[] | null
}

export default function KelompokBannerBeranda({ kelas, siswaId, tugas }: Props) {
  const [kelompok, setKelompok] = useState<TugasKelompokDok[]>([])
  const [statusSaya, setStatusSaya] = useState<StatusAnggotaDok[]>([])
  const [statusKetua, setStatusKetua] = useState<StatusAnggotaDok[]>([])

  useEffect(() => {
    if (!kelas || !siswaId) return
    let batal = false
    void (async () => {
      try {
        const k = await kelompokKelasSaya(kelas, siswaId)
        if (batal) return
        setKelompok(k)
        if (k.length === 0) return
        const [a, b] = await Promise.all([
          statusAnggotaSaya(kelas, siswaId).catch(() => [] as StatusAnggotaDok[]),
          statusUntukKetua(kelas, siswaId).catch(() => [] as StatusAnggotaDok[]),
        ])
        if (batal) return
        setStatusSaya(a)
        setStatusKetua(b)
      } catch (e) {
        console.warn('Beranda siswa: kelompok gagal dimuat', e)
      }
    })()
    return () => {
      batal = true
    }
  }, [kelas, siswaId])

  const baris = useMemo(() => {
    if (!tugas || kelompok.length === 0) return []
    const aktif = new Map(tugas.filter((r) => r.status !== 'dinilai' && r.status !== 'ditutup').map((r) => [r.tugas.id, r.tugas]))
    const out: { kunci: string; tugasId: string; teks: string }[] = []
    for (const k of kelompok) {
      const t = aktif.get(k.tugasId)
      if (!t) continue
      if (k.ketuaId === siswaId) {
        const n = statusKetua.filter(
          (s) => s.kelompokId === k.id && s.pengajuan === 'menunggu' && k.anggotaIds.includes(s.siswaId),
        ).length
        if (n > 0) {
          out.push({
            kunci: `ketua-${k.id}`,
            tugasId: t.id,
            teks: `${n} anggota kelompokmu mengajukan kirim bukti sendiri dan menunggu keputusanmu — ${t.judul}`,
          })
        }
      } else {
        const sudah = statusSaya.some((s) => s.kelompokId === k.id && s.konfirmasiMs > 0)
        if (!sudah) {
          const anggota = k.anggotaList.map((a) => a.nama).join(', ')
          out.push({
            kunci: `anggota-${k.id}`,
            tugasId: t.id,
            teks: `Kamu masuk kelompok ${k.ketuaNama} untuk tugas «${t.judul}». Anggota: ${anggota}.`,
          })
        }
      }
    }
    return out
  }, [tugas, kelompok, statusSaya, statusKetua, siswaId])

  if (baris.length === 0) return null

  return (
    <section className="sw-kelompok-banner" aria-label="Pemberitahuan tugas kelompok">
      <h2>Tugas kelompok</h2>
      <ul>
        {baris.map((b) => (
          <li key={b.kunci}>
            {b.teks}{' '}
            <Link to={`/siswa/tugas?id=${encodeURIComponent(b.tugasId)}`}>Buka tugas</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

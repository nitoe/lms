import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useSiswa } from '../../context/SiswaContext'
import {
  daftarTugasAktifKelas,
  statusTugasSiswa,
  type TugasSiswaRingkas,
} from '../../lib/tugasSiswa'
import { daftarMateriKelas } from '../../lib/materiSiswa'
import type { NilaiTugasDok } from '../../lib/nilaiTugas'

export type MapelRingkas = { mapel: string; jumlah: number }

/**
 * Data ringkas untuk Beranda siswa.
 * - Memakai query yang SAMA dengan halaman Tugas/Materi (rules sudah mengizinkan);
 *   tidak ada koleksi/query baru (ANTIREGRESI §0, §124.3).
 * - Tiap bagian gagal-sendiri: galat hanya dicatat ke console dan bagiannya disembunyikan,
 *   Beranda tidak boleh rusak karena satu query ditolak.
 * - `null` = sedang memuat; `[]` = kosong/gagal.
 * - Daftar materi di-cache di memori 5 menit per kelas (dokumen materi halaman bisa besar).
 */
const TTL_MATERI_MS = 5 * 60 * 1000
const cacheMateri = new Map<string, { at: number; data: MapelRingkas[] }>()

export function useBerandaSiswa(): {
  tugas: TugasSiswaRingkas[] | null
  mapel: MapelRingkas[] | null
} {
  const { sesi } = useSiswa()
  const kelas = sesi?.kelas ?? ''
  const siswaId = sesi?.id ?? ''
  const [tugas, setTugas] = useState<TugasSiswaRingkas[] | null>(null)
  const [mapel, setMapel] = useState<MapelRingkas[] | null>(null)

  useEffect(() => {
    if (!kelas || !siswaId) return
    let batal = false

    async function muatTugas() {
      try {
        const list = await daftarTugasAktifKelas(kelas)
        const qn = query(
          collection(db, 'lms_nilai_tugas'),
          where('siswaId', '==', siswaId),
          where('kelas', '==', String(kelas).toUpperCase()),
        )
        const snap = await getDocs(qn)
        const nilaiMap: Record<string, NilaiTugasDok> = {}
        for (const d of snap.docs) {
          const data = d.data() as NilaiTugasDok
          if (data.tugasId) nilaiMap[data.tugasId] = { ...data, id: d.id }
        }
        if (batal) return
        setTugas(
          list.map((t) => {
            const nilai = nilaiMap[t.id]
            return { tugas: t, nilai, status: statusTugasSiswa(t, nilai) }
          }),
        )
      } catch (e) {
        console.warn('Beranda siswa: tugas gagal dimuat', e)
        if (!batal) setTugas([])
      }
    }

    async function muatMapel() {
      const key = String(kelas).toUpperCase()
      const hit = cacheMateri.get(key)
      if (hit && Date.now() - hit.at < TTL_MATERI_MS) {
        setMapel(hit.data)
        return
      }
      try {
        const list = await daftarMateriKelas(kelas)
        const map = new Map<string, number>()
        for (const m of list) map.set(m.mapel, (map.get(m.mapel) ?? 0) + 1)
        const data = [...map.entries()]
          .sort(([a], [b]) => a.localeCompare(b, 'id'))
          .map(([nama, jumlah]) => ({ mapel: nama, jumlah }))
        cacheMateri.set(key, { at: Date.now(), data })
        if (!batal) setMapel(data)
      } catch (e) {
        console.warn('Beranda siswa: materi gagal dimuat', e)
        if (!batal) setMapel([])
      }
    }

    void muatTugas()
    // Materi menyusul setelah tugas (tidak berebut jaringan di HP).
    const t = window.setTimeout(() => {
      if (!batal) void muatMapel()
    }, 300)
    return () => {
      batal = true
      window.clearTimeout(t)
    }
  }, [kelas, siswaId])

  return { tugas, mapel }
}

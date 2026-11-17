import { useEffect, useState } from 'react'
import { useSiswa } from '../../context/SiswaContext'
import { daftarLombaSiswa } from '../../lib/lomba'
import type { Lomba } from '../../types/lomba'

/**
 * Lomba yang diikuti siswa yang sedang masuk (siswaIds memuat sesi.id).
 * Dipakai bersama oleh nav (SiswaLayout) dan kartu menu Beranda (SiswaBeranda) agar keduanya selalu selaras.
 * Galat TIDAK lagi ditelan diam-diam: dicatat ke console supaya penyebab (mis. permission-denied
 * karena rules belum dideploy) terlihat. ANTIREGRESI §Lomba.20.
 */
export function useLombaSiswa(): { list: Lomba[]; memuat: boolean; galat: string } {
  const { sesi } = useSiswa()
  const id = sesi?.id
  const [list, setList] = useState<Lomba[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!id) {
      setList([])
      setMemuat(false)
      return
    }
    let batal = false
    setMemuat(true)
    setGalat('')
    daftarLombaSiswa(id)
      .then((l) => {
        if (!batal) setList(l)
      })
      .catch((e) => {
        console.warn('daftarLombaSiswa gagal — menu Lomba disembunyikan:', e)
        if (!batal) {
          setList([])
          setGalat(e instanceof Error ? e.message : 'Gagal memuat lomba.')
        }
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [id])

  return { list, memuat, galat }
}

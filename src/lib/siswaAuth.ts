import { collection, getDocs, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

export const DAFTAR_KELAS = [
  '1A', '1B', '1C',
  '2A', '2B', '2C',
  '3A', '3B', '3C',
  '4A', '4B', '4C',
  '5A', '5B', '5C',
  '6A', '6B',
]

export interface SiswaDasar {
  id: string
  nama: string
  kelas: string
  aktif?: boolean
}

export async function muatSiswaKelas(kelas: string): Promise<SiswaDasar[]> {
  if (!isFirebaseConfigured) return []
  const q = query(collection(db, 'siswa'), where('kelas', '==', kelas))
  const snap = await getDocs(q)
  const list: SiswaDasar[] = []
  snap.forEach((doc) => {
    const d = doc.data()
    // Hanya siswa aktif (field aktif tidak ada atau true)
    if (d.aktif === false) return
    list.push({
      id: doc.id,
      nama: (d.nama as string) || '',
      kelas: (d.kelas as string) || kelas,
      aktif: d.aktif,
    })
  })
  list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  return list
}

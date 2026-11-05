import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

/** Nama mapel dari koleksi `mapel` (Penilaian). */
export async function getDaftarMapel(): Promise<string[]> {
  const snap = await getDocs(collection(db, 'mapel'))
  const names = snap.docs.map((d) => {
    const data = d.data()
    const nama = typeof data.nama === 'string' && data.nama ? data.nama : d.id
    return nama
  })
  names.sort((a, b) => a.localeCompare(b, 'id'))
  return names
}

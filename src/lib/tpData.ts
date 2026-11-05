import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { TpRingkas } from '../types/materi'

/**
 * Ambil daftar TP dari koleksi `tp_kktp` (aplikasi Penilaian)
 * untuk pasangan mapel × kelas paralel (mis. Matematika × 5A).
 */
export async function getTpMapelKelas(mapel: string, kelas: string): Promise<TpRingkas[]> {
  const kelasU = String(kelas).toUpperCase()
  const q = query(
    collection(db, 'tp_kktp'),
    where('mapel', '==', mapel),
    where('kelas', '==', kelasU),
  )
  const snap = await getDocs(q)
  const list: TpRingkas[] = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      nomorTp: typeof data.nomorTp === 'number' ? data.nomorTp : 0,
      namaTp: typeof data.namaTp === 'string' ? data.namaTp : '',
      mapel: typeof data.mapel === 'string' ? data.mapel : mapel,
      kelas: typeof data.kelas === 'string' ? data.kelas : kelasU,
    }
  })
  list.sort((a, b) => (a.nomorTp || 0) - (b.nomorTp || 0))
  return list
}

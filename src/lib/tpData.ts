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

/**
 * Gabungan TP untuk beberapa mapel di kelas yang sama (tugas proyek / multi-mapel).
 * Query per mapel, digabung, diurutkan mapel lalu nomor TP.
 */
export async function getTpMultiMapelKelas(
  mapelList: string[],
  kelas: string,
): Promise<TpRingkas[]> {
  const unik = [...new Set(mapelList.map((m) => m.trim()).filter(Boolean))]
  if (!unik.length) return []
  const hasil = await Promise.all(unik.map((m) => getTpMapelKelas(m, kelas).catch(() => [])))
  const semua = hasil.flat()
  const byId = new Map<string, TpRingkas>()
  for (const t of semua) {
    if (!byId.has(t.id)) byId.set(t.id, t)
  }
  return [...byId.values()].sort((a, b) => {
    const cm = (a.mapel || '').localeCompare(b.mapel || '', 'id')
    if (cm !== 0) return cm
    return (a.nomorTp || 0) - (b.nomorTp || 0)
  })
}

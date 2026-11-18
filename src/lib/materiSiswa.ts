import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { MateriLms } from '../types/materi'

/**
 * Semua materi untuk satu kelas (dibaca siswa).
 * Dual query agar dokumen lama (hanya field `kelas`) dan yang di-share (`kelasList`)
 * sama-sama tampil. Pengelompokan per mapel & pengurutan di klien (ANTIREGRESI §10, §126).
 *
 * Materi Lomba (`lombaId` terisi / kelas bank LB) **sengaja dikecualikan** di klien
 * agar hanya tampil di halaman lomba bagi peserta (ANTIREGRESI §Lomba.Materi).
 */
export async function daftarMateriKelas(kelas: string): Promise<MateriLms[]> {
  const k = String(kelas).toUpperCase()
  const map = new Map<string, MateriLms>()

  const q1 = query(collection(db, 'lms_materi'), where('kelas', '==', k))
  const snap1 = await getDocs(q1)
  for (const d of snap1.docs) {
    const m = { id: d.id, ...d.data() } as MateriLms
    if (m.lombaId) continue
    map.set(d.id, m)
  }

  try {
    const q2 = query(collection(db, 'lms_materi'), where('kelasList', 'array-contains', k))
    const snap2 = await getDocs(q2)
    for (const d of snap2.docs) {
      if (map.has(d.id)) continue
      const m = { id: d.id, ...d.data() } as MateriLms
      if (m.lombaId) continue
      map.set(d.id, m)
    }
  } catch (e) {
    console.warn('daftarMateriKelas kelasList', e)
  }

  const list = [...map.values()]
  list.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  return list
}

/**
 * Materi milik satu lomba (dibaca siswa peserta).
 * Rules: hanya jika token.siswaId ∈ lomba.siswaIds. Jangan panggil tanpa cek peserta di klien.
 */
export async function daftarMateriLombaSiswa(lombaId: string): Promise<MateriLms[]> {
  if (!lombaId) return []
  const snap = await getDocs(
    query(collection(db, 'lms_materi'), where('lombaId', '==', lombaId)),
  )
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MateriLms)
  list.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  return list
}

/** Pesan ramah untuk siswa; `permission-denied` = rules belum mengizinkan baca tanpa login. */
export function pesanGagalMuatMateri(e: unknown): string {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Materi belum bisa dibuka. Beri tahu gurumu ya.'
  }
  return 'Materi gagal dimuat. Periksa internet lalu coba lagi.'
}

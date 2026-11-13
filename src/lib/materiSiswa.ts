import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { MateriLms } from '../types/materi'

/**
 * Semua materi untuk satu kelas (dibaca siswa).
 * Sengaja hanya satu filter `where kelas ==` agar TIDAK butuh composite index;
 * pengelompokan per mapel & pengurutan dilakukan di klien (lihat ANTIREGRESI §10).
 */
export async function daftarMateriKelas(kelas: string): Promise<MateriLms[]> {
  const q = query(
    collection(db, 'lms_materi'),
    where('kelas', '==', String(kelas).toUpperCase()),
  )
  const snap = await getDocs(q)
  // Materi tulis-sendiri berstatus draf TIDAK tampil untuk siswa (ANTIREGRESI §116).
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MateriLms)
    .filter((m) => !(m.jenis === 'halaman' && m.status !== 'terbit'))
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

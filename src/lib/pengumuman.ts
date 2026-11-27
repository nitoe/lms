/**
 * CRUD pengumuman ruang kelas (lms_pengumuman). ANTIREGRESI §Pengumuman.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { bersihHtmlMateri, htmlKosong, teksPolos } from './html'
import type { PengumumanLms } from '../types/pengumuman'
import { BATAS_JUDUL_PENGUMUMAN, BATAS_KONTEN_PENGUMUMAN } from '../types/pengumuman'

function koleksi() {
  return collection(db, 'lms_pengumuman')
}

function dariDok(id: string, d: Record<string, unknown>): PengumumanLms {
  return {
    id,
    kelas: String(d.kelas ?? ''),
    mapel: String(d.mapel ?? ''),
    judul: String(d.judul ?? ''),
    kontenHtml: typeof d.kontenHtml === 'string' ? d.kontenHtml : '',
    pin: d.pin === true,
    aktif: d.aktif === true,
    dibuatOleh: String(d.dibuatOleh ?? ''),
    dibuatOlehNama: typeof d.dibuatOlehNama === 'string' ? d.dibuatOlehNama : undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

/** Daftar untuk guru (semua status) — ruang kelas × mapel. */
export async function daftarPengumumanGuru(kelas: string, mapel: string): Promise<PengumumanLms[]> {
  const k = String(kelas || '').trim()
  const m = String(mapel || '').trim()
  if (!k || !m) return []
  const snap = await getDocs(
    query(koleksi(), where('kelas', '==', k), where('mapel', '==', m), orderBy('createdAt', 'desc')),
  )
  const list = snap.docs.map((x) => dariDok(x.id, x.data() as Record<string, unknown>))
  // Pin di atas, lalu terbaru
  list.sort((a, b) => {
    const pa = a.pin ? 1 : 0
    const pb = b.pin ? 1 : 0
    if (pa !== pb) return pb - pa
    return 0
  })
  return list
}

/** Daftar untuk siswa: aktif saja, satu kelas (semua mapel). */
export async function daftarPengumumanSiswa(kelas: string): Promise<PengumumanLms[]> {
  const k = String(kelas || '').trim()
  if (!k) return []
  const snap = await getDocs(
    query(koleksi(), where('kelas', '==', k), where('aktif', '==', true), orderBy('createdAt', 'desc')),
  )
  const list = snap.docs.map((x) => dariDok(x.id, x.data() as Record<string, unknown>))
  list.sort((a, b) => {
    const pa = a.pin ? 1 : 0
    const pb = b.pin ? 1 : 0
    if (pa !== pb) return pb - pa
    return 0
  })
  return list
}

export async function tambahPengumuman(input: {
  kelas: string
  mapel: string
  judul: string
  kontenHtml: string
  aktif?: boolean
  pin?: boolean
  namaGuru?: string
}): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const judul = String(input.judul || '').trim().slice(0, BATAS_JUDUL_PENGUMUMAN)
  if (!judul) throw new Error('Judul pengumuman wajib diisi.')
  const html = bersihHtmlMateri(input.kontenHtml).slice(0, BATAS_KONTEN_PENGUMUMAN)
  if (htmlKosong(html)) throw new Error('Isi pengumuman masih kosong.')
  const ref = await addDoc(koleksi(), {
    kelas: String(input.kelas).trim(),
    mapel: String(input.mapel).trim(),
    judul,
    kontenHtml: html,
    aktif: input.aktif === true,
    pin: input.pin === true,
    dibuatOleh: uid,
    dibuatOlehNama: (input.namaGuru || '').trim().slice(0, 120),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function ubahPengumuman(
  id: string,
  patch: Partial<Pick<PengumumanLms, 'judul' | 'kontenHtml' | 'aktif' | 'pin'>>,
): Promise<void> {
  if (!id) throw new Error('ID pengumuman tidak valid.')
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (patch.judul !== undefined) {
    const judul = String(patch.judul || '').trim().slice(0, BATAS_JUDUL_PENGUMUMAN)
    if (!judul) throw new Error('Judul tidak boleh kosong.')
    data.judul = judul
  }
  if (patch.kontenHtml !== undefined) {
    const html = bersihHtmlMateri(patch.kontenHtml).slice(0, BATAS_KONTEN_PENGUMUMAN)
    if (htmlKosong(html)) throw new Error('Isi pengumuman masih kosong.')
    data.kontenHtml = html
  }
  if (patch.aktif !== undefined) data.aktif = patch.aktif === true
  if (patch.pin !== undefined) data.pin = patch.pin === true
  await updateDoc(doc(db, 'lms_pengumuman', id), data)
}

export async function hapusPengumuman(id: string): Promise<void> {
  if (!id) throw new Error('ID pengumuman tidak valid.')
  await deleteDoc(doc(db, 'lms_pengumuman', id))
}

/** Cuplikan teks polos untuk kartu daftar. */
export function cuplikanPengumuman(html: string, maks = 160): string {
  const t = teksPolos(html)
  if (t.length <= maks) return t
  return `${t.slice(0, maks - 1)}…`
}

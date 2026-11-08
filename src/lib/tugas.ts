import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { TugasLms } from '../types/tugas'

function koleksi() {
  return collection(db, 'lms_tugas')
}

export async function daftarTugas(kelas: string, mapel: string): Promise<TugasLms[]> {
  const q = query(
    koleksi(),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TugasLms)
  list.sort((a, b) => {
    const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
    const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
    return tb - ta
  })
  return list
}

export async function buatTugas(input: {
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  namaGuru?: string
}): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul tugas wajib diisi.')

  const payload: Record<string, unknown> = {
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel.trim(),
    judul,
    aktif: false,
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    jumlahPengumpulan: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  if (input.tpId) {
    payload.tpId = input.tpId
    if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
    if (input.tpNama) payload.tpNama = input.tpNama
  }

  const refDoc = await addDoc(koleksi(), payload)
  return refDoc.id
}

export async function updateTugas(id: string, data: Partial<Omit<TugasLms, 'id'>>): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() }
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k]
  }
  await updateDoc(doc(db, 'lms_tugas', id), payload)
}

export async function hapusTugas(id: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_tugas', id))
}

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
  writeBatch,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { auth, db, storage } from './firebase'
import type { JenisSoal, KuisLms, SoalLms } from '../types/kuis'
import { BATAS_UKURAN_GAMBAR_SOAL } from '../types/kuis'

function koleksiKuis() {
  return collection(db, 'lms_kuis')
}

function koleksiSoal() {
  return collection(db, 'lms_soal')
}

export async function daftarKuis(kelas: string, mapel: string): Promise<KuisLms[]> {
  const q = query(
    koleksiKuis(),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
    orderBy('updatedAt', 'desc'),
  )
  try {
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KuisLms)
  } catch {
    const q2 = query(
      koleksiKuis(),
      where('kelas', '==', String(kelas).toUpperCase()),
      where('mapel', '==', mapel),
    )
    const snap = await getDocs(q2)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KuisLms)
    list.sort((a, b) => {
      const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
      const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
      return tb - ta
    })
    return list
  }
}

export async function buatKuis(input: {
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
  if (!judul) throw new Error('Judul kuis wajib diisi.')

  const payload: Record<string, unknown> = {
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel.trim(),
    judul,
    aktif: false,
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    jumlahSoal: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  if (input.tpId) {
    payload.tpId = input.tpId
    if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
    if (input.tpNama) payload.tpNama = input.tpNama
  }

  const refDoc = await addDoc(koleksiKuis(), payload)
  return refDoc.id
}

export async function hapusKuis(kuisId: string): Promise<void> {
  const soalSnap = await getDocs(query(koleksiSoal(), where('kuisId', '==', kuisId)))
  const batch = writeBatch(db)
  for (const d of soalSnap.docs) {
    batch.delete(d.ref)
  }
  batch.delete(doc(db, 'lms_kuis', kuisId))
  await batch.commit()
}

export async function daftarSoal(kuisId: string): Promise<SoalLms[]> {
  const q = query(koleksiSoal(), where('kuisId', '==', kuisId), orderBy('urutan', 'asc'))
  try {
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SoalLms)
  } catch {
    const q2 = query(koleksiSoal(), where('kuisId', '==', kuisId))
    const snap = await getDocs(q2)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SoalLms)
    list.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
    return list
  }
}

function buatIdOpsi(): string {
  return Math.random().toString(36).slice(2, 10)
}

export async function tambahSoal(input: {
  kuisId: string
  jenis: JenisSoal
  pertanyaan: string
  skor?: number
}): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const pertanyaan = input.pertanyaan.trim()
  if (!pertanyaan) throw new Error('Pertanyaan wajib diisi.')

  const urutan = Date.now()

  const payload: Record<string, unknown> = {
    kuisId: input.kuisId,
    urutan,
    jenis: input.jenis,
    pertanyaan,
    skor: typeof input.skor === 'number' ? input.skor : 1,
    wajib: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (input.jenis === 'pg' || input.jenis === 'pg_kompleks') {
    payload.opsi = [
      { id: buatIdOpsi(), teks: '', benar: false },
      { id: buatIdOpsi(), teks: '', benar: false },
      { id: buatIdOpsi(), teks: '', benar: false },
      { id: buatIdOpsi(), teks: '', benar: false },
    ]
  } else if (input.jenis === 'benar_salah') {
    payload.opsi = [
      { id: 'benar', teks: 'Benar', benar: false },
      { id: 'salah', teks: 'Salah', benar: false },
    ]
  } else if (input.jenis === 'menjodohkan') {
    payload.pasangan = [
      { id: buatIdOpsi(), kiri: '', kanan: '' },
      { id: buatIdOpsi(), kiri: '', kanan: '' },
    ]
  }

  const refDoc = await addDoc(koleksiSoal(), payload)

  // Update jumlah soal di kuis
  const soalSnap = await getDocs(query(koleksiSoal(), where('kuisId', '==', input.kuisId)))
  await updateDoc(doc(db, 'lms_kuis', input.kuisId), {
    jumlahSoal: soalSnap.size,
    updatedAt: serverTimestamp(),
  })

  return refDoc.id
}

export async function updateSoal(id: string, data: Partial<Omit<SoalLms, 'id' | 'kuisId'>>): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() }
  // Hapus field undefined
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k]
  }
  await updateDoc(doc(db, 'lms_soal', id), payload)
}

export async function hapusSoal(soal: SoalLms): Promise<void> {
  if (soal.pertanyaanGambarPath) {
    try {
      await deleteObject(ref(storage, soal.pertanyaanGambarPath))
    } catch {
      /* ignore */
    }
  }
  await deleteDoc(doc(db, 'lms_soal', soal.id))

  const soalSnap = await getDocs(query(koleksiSoal(), where('kuisId', '==', soal.kuisId)))
  await updateDoc(doc(db, 'lms_kuis', soal.kuisId), {
    jumlahSoal: soalSnap.size,
    updatedAt: serverTimestamp(),
  })
}

export async function unggahGambarSoal(file: File, kuisId: string): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Hanya file gambar yang didukung.')
  }
  if (file.size > BATAS_UKURAN_GAMBAR_SOAL) {
    throw new Error('Ukuran gambar melebihi 5 MB.')
  }
  const aman = file.name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 60)
  const stamp = Date.now()
  const path = `lms/kuis/${kuisId}/${stamp}_${aman}`
  const r = ref(storage, path)
  await uploadBytes(r, file, { contentType: file.type })
  const url = await getDownloadURL(r)
  return { url, path }
}

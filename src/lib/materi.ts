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
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { auth, db, storage } from './firebase'
import type { JenisMateri, MateriLms } from '../types/materi'
import { BATAS_UKURAN } from '../types/materi'
import { hapusIsiMateri } from './materiHalaman'

function koleksi() {
  return collection(db, 'lms_materi')
}

export async function daftarMateri(kelas: string, mapel: string): Promise<MateriLms[]> {
  const q = query(
    koleksi(),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
    orderBy('urutan', 'asc'),
  )
  try {
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MateriLms)
  } catch {
    // Fallback tanpa orderBy jika index belum ada
    const q2 = query(
      koleksi(),
      where('kelas', '==', String(kelas).toUpperCase()),
      where('mapel', '==', mapel),
    )
    const snap = await getDocs(q2)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MateriLms)
    list.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
    return list
  }
}

export function ekstrakYoutubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1).split('/')[0] || null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const parts = u.pathname.split('/')
      const embed = parts.indexOf('embed')
      if (embed >= 0 && parts[embed + 1]) return parts[embed + 1]
      const shorts = parts.indexOf('shorts')
      if (shorts >= 0 && parts[shorts + 1]) return parts[shorts + 1]
    }
  } catch {
    /* ignore */
  }
  return null
}

function jenisDariFile(file: File): JenisMateri {
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.startsWith('image/')) return 'gambar'
  if (file.type.startsWith('video/')) return 'video'
  throw new Error('Jenis file tidak didukung. Gunakan PDF, gambar, atau video.')
}

function cekUkuran(file: File, jenis: JenisMateri) {
  const batas =
    jenis === 'video' ? BATAS_UKURAN.video : jenis === 'pdf' ? BATAS_UKURAN.pdf : BATAS_UKURAN.gambar
  if (file.size > batas) {
    const mb = Math.round(batas / (1024 * 1024))
    throw new Error(`Ukuran file melebihi batas ${mb} MB.`)
  }
}

export type MateriBaruInput = {
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  bab?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  urutan?: number
  /** Untuk youtube / tautan */
  url?: string
  jenisTautan?: 'youtube' | 'tautan'
  /** Untuk unggah file */
  file?: File
  namaGuru?: string
}

export async function tambahMateri(input: MateriBaruInput): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const kelas = String(input.kelas).toUpperCase()
  const mapel = input.mapel.trim()
  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul wajib diisi.')

  let jenis: JenisMateri
  let url: string | undefined
  let storagePath: string | undefined
  let fileName: string | undefined
  let contentType: string | undefined
  let ukuran: number | undefined

  if (input.file) {
    jenis = jenisDariFile(input.file)
    cekUkuran(input.file, jenis)
    const aman = input.file.name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 80)
    const stamp = Date.now()
    storagePath = `lms/materi/${kelas}/${stamp}_${aman}`
    const r = ref(storage, storagePath)
    await uploadBytes(r, input.file, { contentType: input.file.type })
    url = await getDownloadURL(r)
    fileName = input.file.name
    contentType = input.file.type
    ukuran = input.file.size
  } else if (input.url && input.jenisTautan === 'youtube') {
    const yt = ekstrakYoutubeId(input.url)
    if (!yt) throw new Error('Tautan YouTube tidak dikenali.')
    jenis = 'youtube'
    url = `https://www.youtube.com/watch?v=${yt}`
  } else if (input.url) {
    jenis = 'tautan'
    url = input.url.trim()
    try {
      // validasi kasar
      new URL(url)
    } catch {
      throw new Error('URL tidak valid.')
    }
  } else {
    throw new Error('Unggah file atau isi tautan.')
  }

  const payload: Record<string, unknown> = {
    kelas,
    mapel,
    judul,
    jenis,
    urutan: typeof input.urutan === 'number' ? input.urutan : Date.now(),
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  if (input.bab?.trim()) payload.bab = input.bab.trim()
  if (input.tpId) {
    payload.tpId = input.tpId
    if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
    if (input.tpNama) payload.tpNama = input.tpNama
  }
  if (url) payload.url = url
  if (storagePath) payload.storagePath = storagePath
  if (fileName) payload.fileName = fileName
  if (contentType) payload.contentType = contentType
  if (typeof ukuran === 'number') payload.ukuran = ukuran

  const refDoc = await addDoc(koleksi(), payload)
  return refDoc.id
}

export async function hapusMateri(m: MateriLms): Promise<void> {
  if (m.jenis === 'halaman') await hapusIsiMateri(m.id)
  if (m.storagePath) {
    try {
      await deleteObject(ref(storage, m.storagePath))
    } catch {
      /* file mungkin sudah hilang */
    }
  }
  await deleteDoc(doc(db, 'lms_materi', m.id))
}

export async function ubahUrutan(id: string, urutan: number): Promise<void> {
  await updateDoc(doc(db, 'lms_materi', id), { urutan, updatedAt: serverTimestamp() })
}

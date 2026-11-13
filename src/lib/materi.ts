import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import type {
  JenisMateri,
  MateriBlok,
  MateriHalaman,
  MateriLms,
} from '../types/materi'
import {
  BATAS_BLOK_PER_HALAMAN,
  BATAS_HALAMAN_PER_MATERI,
  BATAS_UKURAN,
} from '../types/materi'
import { bersihHtmlMateri, htmlKosong } from './html'
import { normalisasiKelasList } from './kelasLms'

function koleksi() {
  return collection(db, 'lms_materi')
}

export async function daftarMateri(kelas: string, mapel: string): Promise<MateriLms[]> {
  const k = String(kelas).toUpperCase()
  const map = new Map<string, MateriLms>()

  async function tarik(qRef: ReturnType<typeof query>) {
    const snap = await getDocs(qRef)
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>
      if (!map.has(d.id)) map.set(d.id, { ...data, id: d.id } as MateriLms)
    }
  }

  // 1) milik kelas ini (legacy + utama)
  try {
    await tarik(
      query(koleksi(), where('kelas', '==', k), where('mapel', '==', mapel), orderBy('urutan', 'asc')),
    )
  } catch {
    await tarik(query(koleksi(), where('kelas', '==', k), where('mapel', '==', mapel)))
  }

  // 2) dibagikan ke kelas ini (kelasList)
  try {
    const snap = await getDocs(
      query(koleksi(), where('kelasList', 'array-contains', k)),
    )
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>
      if (String(data.mapel || '') !== mapel) continue
      if (!map.has(d.id)) map.set(d.id, { ...data, id: d.id } as MateriLms)
    }
  } catch (e) {
    console.warn('daftarMateri kelasList', e)
  }

  const list = [...map.values()]
  list.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  return list
}

export async function ambilMateri(id: string): Promise<MateriLms | null> {
  const snap = await getDoc(doc(db, 'lms_materi', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as MateriLms
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

function cekUkuran(file: File, jenis: JenisMateri | 'gambarHalaman') {
  const batas =
    jenis === 'video'
      ? BATAS_UKURAN.video
      : jenis === 'pdf'
        ? BATAS_UKURAN.pdf
        : jenis === 'gambarHalaman'
          ? BATAS_UKURAN.gambarHalaman
          : BATAS_UKURAN.gambar
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
      new URL(url)
    } catch {
      throw new Error('URL tidak valid.')
    }
  } else {
    throw new Error('Unggah file atau isi tautan.')
  }

  const payload: Record<string, unknown> = {
    kelas,
    kelasList: normalisasiKelasList(kelas),
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

/** Buat id stabil untuk halaman / blok (cukup unik di klien). */
export function idBaru(prefix = 'h'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function halamanKosong(urutan = 0): MateriHalaman {
  return {
    id: idBaru('h'),
    judul: '',
    urutan,
    blok: [{ id: idBaru('b'), tipe: 'teks', html: '' }],
  }
}

function normalisasiHalaman(list: MateriHalaman[] | undefined): MateriHalaman[] {
  if (!Array.isArray(list) || list.length === 0) {
    return [halamanKosong(0)]
  }
  if (list.length > BATAS_HALAMAN_PER_MATERI) {
    throw new Error(`Maksimal ${BATAS_HALAMAN_PER_MATERI} halaman per materi.`)
  }
  return list.map((h, i) => {
    const blok = Array.isArray(h.blok) ? h.blok : []
    if (blok.length > BATAS_BLOK_PER_HALAMAN) {
      throw new Error(`Maksimal ${BATAS_BLOK_PER_HALAMAN} blok per halaman.`)
    }
    const bersih: MateriBlok[] = []
    for (const b of blok) {
      if (!b || typeof b !== 'object') continue
      if (b.tipe === 'teks') {
        const html = bersihHtmlMateri(b.html)
        if (htmlKosong(html) && blok.length > 1) continue
        bersih.push({ id: b.id || idBaru('b'), tipe: 'teks', html })
      } else if (b.tipe === 'gambar') {
        const url = typeof b.url === 'string' ? b.url.trim() : ''
        const petunjuk =
          typeof b.petunjukGambar === 'string' ? b.petunjukGambar.trim().slice(0, 2000) : ''
        if (!url && !petunjuk) continue
        // Jangan kirim field undefined ke Firestore (addDoc/updateDoc menolak).
        const item: Extract<MateriBlok, { tipe: 'gambar' }> = {
          id: b.id || idBaru('b'),
          tipe: 'gambar',
          url: url || '',
        }
        if (typeof b.storagePath === 'string' && b.storagePath.trim()) {
          item.storagePath = b.storagePath.trim()
        }
        const alt = typeof b.alt === 'string' ? b.alt.trim() : ''
        if (alt) item.alt = alt
        const caption = typeof b.caption === 'string' ? b.caption.trim() : ''
        if (caption) item.caption = caption
        if (petunjuk) item.petunjukGambar = petunjuk
        bersih.push(item)
      }
    }
    if (bersih.length === 0) {
      bersih.push({ id: idBaru('b'), tipe: 'teks', html: '' })
    }
    const judulH = (h.judul || '').trim().slice(0, 80)
    const halamanOut: MateriHalaman = {
      id: h.id || idBaru('h'),
      urutan: typeof h.urutan === 'number' ? h.urutan : i,
      blok: bersih,
    }
    if (judulH) halamanOut.judul = judulH
    return halamanOut
  })
}

function kumpulkanStoragePath(halaman: MateriHalaman[]): string[] {
  const out: string[] = []
  for (const h of halaman) {
    for (const b of h.blok) {
      if (b.tipe === 'gambar' && b.storagePath) out.push(b.storagePath)
    }
  }
  return out
}

export type MateriHalamanInput = {
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  bab?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  urutan?: number
  namaGuru?: string
  halaman: MateriHalaman[]
}

/** Buat materi jenis halaman (konten multi-halaman). */
export async function tambahMateriHalaman(input: MateriHalamanInput): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const kelas = String(input.kelas).toUpperCase()
  const mapel = input.mapel.trim()
  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul wajib diisi.')
  if (!input.tpId) throw new Error('Tujuan Pembelajaran wajib dipilih.')

  const halaman = normalisasiHalaman(input.halaman)

  const payload: Record<string, unknown> = {
    kelas,
    kelasList: normalisasiKelasList(kelas),
    mapel,
    judul,
    jenis: 'halaman' as JenisMateri,
    halaman,
    urutan: typeof input.urutan === 'number' ? input.urutan : Date.now(),
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    tpId: input.tpId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  if (input.bab?.trim()) payload.bab = input.bab.trim()
  if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
  if (input.tpNama) payload.tpNama = input.tpNama

  const refDoc = await addDoc(koleksi(), payload)
  return refDoc.id
}

/** Perbarui metadata + halaman materi jenis halaman. */
export async function simpanMateriHalaman(
  id: string,
  input: Omit<MateriHalamanInput, 'kelas' | 'mapel' | 'namaGuru'> & {
    kelas?: string
    mapel?: string
  },
): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul wajib diisi.')
  if (!input.tpId) throw new Error('Tujuan Pembelajaran wajib dipilih.')

  const halaman = normalisasiHalaman(input.halaman)

  const payload: Record<string, unknown> = {
    judul,
    jenis: 'halaman',
    halaman,
    tpId: input.tpId,
    updatedAt: serverTimestamp(),
  }
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  else payload.deskripsi = null
  if (input.bab?.trim()) payload.bab = input.bab.trim()
  else payload.bab = null
  if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
  if (input.tpNama) payload.tpNama = input.tpNama

  await updateDoc(doc(db, 'lms_materi', id), payload)
}

/** Unggah gambar untuk blok halaman. Mengembalikan url + storagePath. */
export async function unggahGambarHalaman(
  kelas: string,
  file: File,
): Promise<{ url: string; storagePath: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Hanya file gambar yang diizinkan.')
  }
  cekUkuran(file, 'gambarHalaman')
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const k = String(kelas).toUpperCase()
  const aman = file.name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 80)
  const stamp = Date.now()
  const storagePath = `lms/materi/${k}/halaman_${stamp}_${aman}`
  const r = ref(storage, storagePath)
  await uploadBytes(r, file, { contentType: file.type })
  const url = await getDownloadURL(r)
  return { url, storagePath }
}

/** Unggah data URL (hasil generate AI) ke Storage materi halaman. */
export async function unggahDataUrlHalaman(
  kelas: string,
  dataUrl: string,
  namaFile = 'ilustrasi-ai.webp',
): Promise<{ url: string; storagePath: string }> {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Data gambar AI tidak valid.')
  }
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const res = await fetch(dataUrl)
  const blob = await res.blob()
  if (blob.size > BATAS_UKURAN.gambarHalaman) {
    throw new Error('Gambar AI terlalu besar setelah generate.')
  }
  const k = String(kelas).toUpperCase()
  const aman = namaFile.replace(/[^\w.\-()+ ]/g, '_').slice(0, 80)
  const stamp = Date.now()
  const storagePath = `lms/materi/${k}/halaman_${stamp}_${aman}`
  const r = ref(storage, storagePath)
  const contentType = blob.type || 'image/webp'
  await uploadBytes(r, blob, { contentType })
  const url = await getDownloadURL(r)
  return { url, storagePath }
}

async function hapusStoragePaths(paths: string[]) {
  await Promise.all(
    paths.map(async (p) => {
      try {
        await deleteObject(ref(storage, p))
      } catch {
        /* file mungkin sudah hilang */
      }
    }),
  )
}

export async function hapusMateri(m: MateriLms): Promise<void> {
  const paths: string[] = []
  if (m.storagePath) paths.push(m.storagePath)
  if (m.jenis === 'halaman' && Array.isArray(m.halaman)) {
    paths.push(...kumpulkanStoragePath(m.halaman))
  }
  if (paths.length) await hapusStoragePaths(paths)
  await deleteDoc(doc(db, 'lms_materi', m.id))
}

export async function ubahUrutan(id: string, urutan: number): Promise<void> {
  await updateDoc(doc(db, 'lms_materi', id), { urutan, updatedAt: serverTimestamp() })
}

/** Hapus file Storage yang tidak lagi dipakai setelah edit (best-effort). */
export async function bersihkanGambarYatim(
  sebelumnya: MateriHalaman[] | undefined,
  sesudah: MateriHalaman[],
): Promise<void> {
  const sebelum = new Set(kumpulkanStoragePath(sebelumnya || []))
  const tetap = new Set(kumpulkanStoragePath(sesudah))
  const yatim = [...sebelum].filter((p) => !tetap.has(p))
  if (yatim.length) await hapusStoragePaths(yatim)
}


/**
 * Atur daftar kelas yang boleh membaca materi (selain kelas utama).
 * `kelasListBaru` harus sudah difilter UI ke paralel se-tingkat yang diampu;
 * rules juga menegakkan lmsTulisMapelKelas per kelas.
 */
export async function aturBerbagiMateri(
  id: string,
  kelasUtama: string,
  kelasListBaru: string[],
): Promise<void> {
  const list = normalisasiKelasList(kelasUtama, kelasListBaru)
  await updateDoc(doc(db, 'lms_materi', id), {
    kelasList: list,
    updatedAt: serverTimestamp(),
  })
}

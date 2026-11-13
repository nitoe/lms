import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import DOMPurify from 'dompurify'
import { auth, db, storage } from './firebase'
import type { HalamanMateri, IsiMateri, MateriLms, StatusMateri } from '../types/materi'
import { BATAS_HALAMAN, BATAS_MEDIA } from '../types/materi'

/* ───────────── Sanitasi HTML materi ─────────────
 * Isi materi = HTML terbatas dari editor. DIBERSIHKAN saat disimpan DAN saat ditampilkan
 * (ANTIREGRESI §115). Instance DOMPurify sendiri agar hook tidak memengaruhi bersihHtml() soal.
 * Media hanya boleh dari Firebase Storage; YouTube hanya lewat atribut data-yt (ID 11 karakter)
 * yang diubah menjadi iframe oleh pembaca — iframe TIDAK pernah lolos sanitasi.
 */
const purify = DOMPurify(window)

const HOST_MEDIA = 'https://firebasestorage.googleapis.com/'

purify.addHook('afterSanitizeAttributes', (node) => {
  const tag = node.nodeName.toLowerCase()
  if (tag === 'img' || tag === 'audio' || tag === 'video' || tag === 'source') {
    const src = node.getAttribute('src') ?? ''
    if (!src.startsWith(HOST_MEDIA)) node.parentNode?.removeChild(node)
    return
  }
  if (tag === 'a') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
  if (node.hasAttribute('data-yt') && !/^[\w-]{11}$/.test(node.getAttribute('data-yt') ?? '')) {
    node.parentNode?.removeChild(node)
  }
})

const TAG_MATERI = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li',
  'h2', 'h3', 'blockquote', 'hr', 'a', 'span', 'mark', 'div',
  'figure', 'figcaption', 'img', 'audio', 'video',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
]
const ATTR_MATERI = [
  'href', 'src', 'alt', 'controls', 'preload', 'playsinline', 'colspan', 'rowspan',
  'data-w', 'data-rata', 'data-ukuran', 'data-kotak',
  'data-gambar', 'data-audio', 'data-video', 'data-yt',
]

export function bersihHtmlMateri(html: string | undefined): string {
  if (!html) return ''
  return purify.sanitize(html, {
    ALLOWED_TAGS: TAG_MATERI,
    ALLOWED_ATTR: ATTR_MATERI,
    ALLOW_DATA_ATTR: false,
  })
}

/** Teks polos untuk cek halaman kosong / ringkasan. */
export function teksHalaman(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = bersihHtmlMateri(html)
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function halamanKosong(h: HalamanMateri): boolean {
  if (teksHalaman(h.html)) return false
  return !/<(img|audio|video|table)\b|data-yt=/i.test(bersihHtmlMateri(h.html))
}

/** Path Storage yang dirujuk HTML (dari download URL). */
export function ambilPathMedia(htmlList: string[]): string[] {
  const set = new Set<string>()
  const re = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/"'\s]+\/o\/([^?"'&\s]+)/g
  for (const html of htmlList) {
    for (const m of html.matchAll(re)) {
      try {
        set.add(decodeURIComponent(m[1]))
      } catch {
        /* abaikan */
      }
    }
  }
  return [...set].filter((p) => p.startsWith('lms/materi/'))
}

export function idHalamanBaru(): string {
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function halamanBaru(judul = ''): HalamanMateri {
  return { id: idHalamanBaru(), judul, html: '' }
}

/** Perkiraan ukuran total isi (karakter). */
export function ukuranIsi(halaman: HalamanMateri[]): number {
  return halaman.reduce((n, h) => n + h.html.length + h.judul.length + 40, 0)
}

/* ───────────── Firestore ───────────── */

export async function ambilMateri(id: string): Promise<MateriLms | null> {
  const s = await getDoc(doc(db, 'lms_materi', id))
  return s.exists() ? ({ id: s.id, ...s.data() } as MateriLms) : null
}

export async function muatIsi(materiId: string): Promise<IsiMateri | null> {
  const s = await getDoc(doc(db, 'lms_materi_isi', materiId))
  if (!s.exists()) return null
  const d = s.data()
  return {
    materiId: s.id,
    kelas: String(d.kelas ?? ''),
    mapel: String(d.mapel ?? ''),
    halaman: Array.isArray(d.halaman) ? (d.halaman as HalamanMateri[]) : [],
    mediaPaths: Array.isArray(d.mediaPaths) ? (d.mediaPaths as string[]) : [],
    terbit: d.terbit === true,
  }
}

export type MateriHalamanBaruInput = {
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  bab?: string
  tpId: string
  tpNomor?: number
  tpNama?: string
  namaGuru?: string
}

/** Buat materi tulis-sendiri (draf, 1 halaman kosong). Mengembalikan id materi. */
export async function buatMateriHalaman(input: MateriHalamanBaruInput): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul wajib diisi.')
  const kelas = String(input.kelas).toUpperCase()
  const mapel = input.mapel.trim()

  const refMateri = doc(collection(db, 'lms_materi'))
  const payload: Record<string, unknown> = {
    kelas,
    mapel,
    judul,
    jenis: 'halaman',
    status: 'draf',
    jumlahHalaman: 1,
    urutan: Date.now(),
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    tpId: input.tpId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (typeof input.tpNomor === 'number') payload.tpNomor = input.tpNomor
  if (input.tpNama) payload.tpNama = input.tpNama
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  if (input.bab?.trim()) payload.bab = input.bab.trim()

  const batch = writeBatch(db)
  batch.set(refMateri, payload)
  batch.set(doc(db, 'lms_materi_isi', refMateri.id), {
    kelas,
    mapel,
    halaman: [halamanBaru('Halaman 1')],
    mediaPaths: [],
    terbit: false,
    dibuatOleh: uid,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return refMateri.id
}

export type SimpanIsiInput = {
  materi: MateriLms
  halaman: HalamanMateri[]
  judul: string
  deskripsi?: string
  /** Bila diisi, status terbit ikut diubah (atomik dengan isi). */
  status?: StatusMateri
}

/** Simpan isi + metadata dalam SATU batch (atomik). Isi dibersihkan di sini. */
export async function simpanIsi(input: SimpanIsiInput): Promise<HalamanMateri[]> {
  const { materi } = input
  if (input.halaman.length < 1) throw new Error('Materi minimal punya satu halaman.')
  if (input.halaman.length > BATAS_HALAMAN.maksHalaman) {
    throw new Error(`Maksimal ${BATAS_HALAMAN.maksHalaman} halaman per materi.`)
  }
  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul materi wajib diisi.')

  const bersih = input.halaman.map((h) => ({
    id: h.id,
    judul: h.judul.trim().slice(0, 120),
    html: bersihHtmlMateri(h.html),
  }))
  if (ukuranIsi(bersih) > BATAS_HALAMAN.maksKarakter) {
    throw new Error('Isi materi terlalu besar. Pecah menjadi dua materi atau kurangi tabel/teks panjang.')
  }

  const status = input.status ?? materi.status ?? 'draf'
  const metaUpdate: Record<string, unknown> = {
    judul: judul.slice(0, 200),
    jumlahHalaman: bersih.length,
    status,
    updatedAt: serverTimestamp(),
  }
  const desk = (input.deskripsi ?? materi.deskripsi ?? '').trim()
  if (desk) metaUpdate.deskripsi = desk.slice(0, 2000)

  const batch = writeBatch(db)
  batch.update(doc(db, 'lms_materi', materi.id), metaUpdate)
  batch.update(doc(db, 'lms_materi_isi', materi.id), {
    halaman: bersih,
    mediaPaths: ambilPathMedia(bersih.map((h) => h.html)),
    terbit: status === 'terbit',
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return bersih
}

/** Hapus isi + file media materi tulis-sendiri (dipanggil hapusMateri). */
export async function hapusIsiMateri(materiId: string): Promise<void> {
  let paths: string[] = []
  try {
    const isi = await muatIsi(materiId)
    paths = isi?.mediaPaths ?? []
  } catch {
    /* lanjut hapus dokumen */
  }
  for (const p of paths) {
    try {
      await deleteObject(ref(storage, p))
    } catch {
      /* file mungkin sudah hilang */
    }
  }
  await deleteDoc(doc(db, 'lms_materi_isi', materiId))
}

/* ───────────── Unggah media ───────────── */

export type JenisMedia = 'gambar' | 'audio' | 'video'

function namaAman(nama: string): string {
  return nama.replace(/[^\w.\-()+ ]/g, '_').slice(0, 60)
}

/**
 * Perkecil gambar (sisi terpanjang ≤ 1600 px) → WebP/JPEG, supaya ringan di data seluler siswa.
 * Latar putih agar PNG transparan tidak menjadi hitam.
 */
export async function perkecilGambar(file: Blob): Promise<Blob> {
  if (file.size > BATAS_MEDIA.gambarAsal) throw new Error('Gambar terlalu besar (maks 15 MB).')
  const bmp = await createImageBitmap(file)
  try {
    const skala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * skala))
    const h = Math.max(1, Math.round(bmp.height * skala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Peramban tidak mendukung pengolahan gambar.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    const keBlob = (tipe: string, mutu: number) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, tipe, mutu))
    for (const mutu of [0.85, 0.75, 0.62]) {
      const b = (await keBlob('image/webp', mutu)) ?? (await keBlob('image/jpeg', mutu))
      if (b && b.size <= 1.5 * 1024 * 1024) return b
    }
    const akhir = (await keBlob('image/jpeg', 0.55)) ?? file
    return akhir
  } finally {
    bmp.close()
  }
}

export function jenisMediaDariFile(file: File): JenisMedia {
  if (file.type.startsWith('image/')) return 'gambar'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  throw new Error('Jenis file tidak didukung. Gunakan gambar, audio, atau video.')
}

/** Unggah media ke `lms/materi/{kelas}/…` dan kembalikan download URL. */
export async function unggahMedia(
  file: File,
  kelas: string,
  onProgres?: (persen: number) => void,
): Promise<{ jenis: JenisMedia; url: string; path: string }> {
  if (!auth.currentUser) throw new Error('Sesi berakhir. Silakan masuk lagi.')
  const jenis = jenisMediaDariFile(file)
  let isi: Blob = file
  let tipe = file.type
  let nama = namaAman(file.name)
  if (jenis === 'gambar') {
    isi = await perkecilGambar(file)
    tipe = isi.type || 'image/jpeg'
    nama = nama.replace(/\.[^.]*$/, '') + (tipe === 'image/webp' ? '.webp' : '.jpg')
  } else {
    const batas = jenis === 'audio' ? BATAS_MEDIA.audio : BATAS_MEDIA.video
    if (file.size > batas) {
      throw new Error(`Ukuran ${jenis} melebihi ${Math.round(batas / (1024 * 1024))} MB. Perkecil file atau pakai YouTube.`)
    }
  }
  const path = `lms/materi/${String(kelas).toUpperCase()}/${Date.now()}_${nama}`
  const r = ref(storage, path)
  await new Promise<void>((resolve, reject) => {
    const tugas = uploadBytesResumable(r, isi, { contentType: tipe })
    tugas.on(
      'state_changed',
      (s) => onProgres?.(Math.round((s.bytesTransferred / Math.max(1, s.totalBytes)) * 100)),
      reject,
      () => resolve(),
    )
  })
  return { jenis, url: await getDownloadURL(r), path }
}

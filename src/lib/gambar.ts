import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import { ringkasPerangkat } from './diagnostik'

/**
 * Gambar soal disimpan terkompres (data URL WebP/JPEG) di koleksi `lms_gambar`,
 * pola yang sama dengan perpus_foto / sarpras_foto — tanpa bergantung pada aturan Storage.
 * Batas rules: 300.000 karakter (ANTIREGRESI §10).
 */
export const BATAS_KARAKTER_GAMBAR = 300_000
const SASARAN_KARAKTER = 240_000
const SISI_MAKS = 1024
const BATAS_FILE_ASAL = 15 * 1024 * 1024

export interface HasilKompres {
  dataUrl: string
  lebar: number
  tinggi: number
}

/**
 * Pembacaan gambar BERLAPIS (ANTIREGRESI §Gambar.Dekode).
 * Satu HP Android siswa melaporkan «The source image cannot be decoded» (galat `createImageBitmap`,
 * konsol tak bisa dilihat). Penyebab yang lazim: foto HEIC/HEIF (kamera Samsung/Xiaomi «efisiensi tinggi»),
 * file dari galeri/cloud yang belum terunduh penuh (content-URI tak terbaca), atau peramban lama tanpa
 * `createImageBitmap`. Karena itu: (1) createImageBitmap, (2) <img> dari object URL, (3) salin byte ke memori
 * lalu ulangi 1–2 dengan Blob baru. Bila semua gagal, siswa mendapat pesan yang menyebut penyebab + rincian
 * singkat yang bisa difoto layarnya untuk guru.
 */
interface GambarTerbaca {
  sumber: CanvasImageSource
  lebar: number
  tinggi: number
  tutup: () => void
}

type FormatGambar = 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'heic' | 'avif' | 'lain'

const MIME_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
}

/** Kenali format dari byte awal (tipe MIME dari galeri Android sering kosong atau keliru). */
function kenaliFormat(b: Uint8Array): FormatGambar {
  const teks = (a: number, z: number) => String.fromCharCode(...Array.from(b.slice(a, z)))
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && teks(1, 4) === 'PNG') return 'png'
  if (b.length >= 12 && teks(0, 4) === 'RIFF' && teks(8, 12) === 'WEBP') return 'webp'
  if (b.length >= 4 && teks(0, 3) === 'GIF') return 'gif'
  if (b.length >= 2 && teks(0, 2) === 'BM') return 'bmp'
  if (b.length >= 12 && teks(4, 8) === 'ftyp') {
    const merek = teks(8, 12).toLowerCase()
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(merek)) return 'heic'
    if (merek === 'avif' || merek === 'avis') return 'avif'
  }
  return 'lain'
}

function namaGalat(e: unknown): string {
  if (e instanceof Error) return e.name && e.name !== 'Error' ? e.name : 'Error'
  return typeof e === 'string' ? 'Error' : 'Tak dikenal'
}

function ukuranTeks(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

function muatViaImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const batas = window.setTimeout(() => reject(new Error('Waktu membaca gambar habis.')), 25_000)
    img.onload = () => {
      window.clearTimeout(batas)
      if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve(img)
      else reject(new Error('Gambar kosong.'))
    }
    img.onerror = () => {
      window.clearTimeout(batas)
      reject(new Error('Peramban tidak bisa membuka gambar.'))
    }
    img.src = url
  })
}

async function bacaViaBitmap(blob: Blob): Promise<GambarTerbaca> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap tidak tersedia.')
  const bmp = await createImageBitmap(blob)
  if (bmp.width < 1 || bmp.height < 1) {
    bmp.close()
    throw new Error('Gambar kosong.')
  }
  return { sumber: bmp, lebar: bmp.width, tinggi: bmp.height, tutup: () => bmp.close() }
}

async function bacaViaImg(blob: Blob): Promise<GambarTerbaca> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await muatViaImg(url)
    return {
      sumber: img,
      lebar: img.naturalWidth,
      tinggi: img.naturalHeight,
      tutup: () => URL.revokeObjectURL(url),
    }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

async function bacaByte(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return await blob.arrayBuffer()
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error ?? new Error('FileReader gagal.'))
    r.readAsArrayBuffer(blob)
  })
}

async function bacaGambar(file: Blob): Promise<GambarTerbaca> {
  const galat: unknown[] = []
  const coba = async (blob: Blob): Promise<GambarTerbaca | null> => {
    for (const metode of [bacaViaBitmap, bacaViaImg]) {
      try {
        return await metode(blob)
      } catch (e) {
        galat.push(e)
      }
    }
    return null
  }

  const langsung = await coba(file)
  if (langsung) return langsung

  // Lapis 3: salin byte ke memori (melepas dari content-URI galeri Android) dan kenali formatnya.
  let byte: ArrayBuffer
  try {
    byte = await bacaByte(file)
  } catch (e) {
    galat.push(e)
    throw new Error(
      `Foto tidak bisa dibuka dari galeri (mungkin belum terunduh penuh atau izin akses dicabut). Unduh fotonya dulu atau ambil ulang dengan kamera, lalu coba lagi. (rincian: ${namaGalat(e)}, ${ukuranTeks(file.size)}; ${ringkasPerangkat()})`,
    )
  }
  const format = kenaliFormat(new Uint8Array(byte.slice(0, 16)))
  const rincian = `rincian: ${format}, ${ukuranTeks(byte.byteLength)}, ${namaGalat(galat[0])}; ${ringkasPerangkat()}`
  if (format === 'heic') {
    throw new Error(
      `Foto berformat HEIC/HEIF belum bisa dibaca di HP ini. Ubah pengaturan kamera ke JPEG (pilih «Paling kompatibel»), atau pilih foto lain / foto hasil tangkapan layar, lalu coba lagi. (${rincian})`,
    )
  }
  if (format === 'avif') {
    throw new Error(
      `Foto berformat AVIF belum bisa dibaca di HP ini. Gunakan foto JPG atau PNG. (${rincian})`,
    )
  }
  if (format !== 'lain') {
    const salinan = await coba(new Blob([byte], { type: MIME_FORMAT[format] }))
    if (salinan) return salinan
  }
  throw new Error(
    `Foto tidak bisa dibaca (file rusak, terlalu besar untuk HP ini, atau bukan gambar). Coba ambil ulang foto atau pilih foto lain. (${rincian})`,
  )
}

function gambarKeDataUrl(
  g: GambarTerbaca,
  skala: number,
  mutu: number,
): { url: string; w: number; h: number } | null {
  const w = Math.max(1, Math.round(g.lebar * skala))
  const h = Math.max(1, Math.round(g.tinggi * skala))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Peramban tidak mendukung pengolahan gambar.')
    // Latar putih supaya PNG transparan tidak jadi hitam saat dikonversi.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(g.sumber, 0, 0, w, h)
    let url = canvas.toDataURL('image/webp', mutu)
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', mutu)
    // HP RAM kecil: canvas gagal diam-diam dan toDataURL mengembalikan «data:,» (panjang kecil, lolos
    // pemeriksaan ukuran). Tolak supaya dicoba lagi pada skala lebih kecil. ANTIREGRESI §Gambar.Dekode.
    if (!url.startsWith('data:image/') || url.length < 200) return null
    return { url, w, h }
  } catch {
    return null
  }
}

function pastikanFileGambar(blob: Blob, namaHint = 'gambar-tempel.png'): File {
  const tipe = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png'
  if (blob instanceof File && blob.type.startsWith('image/')) return blob
  const ext = tipe.includes('jpeg') || tipe.includes('jpg') ? 'jpg' : tipe.includes('webp') ? 'webp' : 'png'
  const nama = namaHint.includes('.') ? namaHint : `gambar-tempel.${ext}`
  return new File([blob], nama, { type: tipe, lastModified: Date.now() })
}

/** Perkecil (sisi terpanjang ≤ 1024 px) dan kompres sampai muat batas dokumen. */
export async function kompresGambar(file: Blob): Promise<HasilKompres> {
  const tipe = file.type || ''
  if (tipe && !tipe.startsWith('image/')) throw new Error('File harus berupa gambar (JPG, PNG, WebP).')
  if (file.size > BATAS_FILE_ASAL) throw new Error('Gambar terlalu besar (maks 15 MB).')
  const g = await bacaGambar(file)
  try {
    let skala = Math.min(1, SISI_MAKS / Math.max(g.lebar, g.tinggi))
    for (let putaran = 0; putaran < 6; putaran++) {
      for (const mutu of [0.85, 0.72, 0.6, 0.48]) {
        const r = gambarKeDataUrl(g, skala, mutu)
        if (r && r.url.length <= SASARAN_KARAKTER) {
          return { dataUrl: r.url, lebar: r.w, tinggi: r.h }
        }
      }
      skala *= 0.78
    }
    throw new Error('Gambar tidak bisa dikecilkan cukup. Coba gambar yang lebih sederhana.')
  } finally {
    g.tutup()
  }
}

/** Unggah ke Firestore, kembalikan ID dokumen. Menerima File atau Blob (mis. dari clipboard). */
export async function unggahGambar(file: Blob): Promise<string> {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sesi berakhir. Silakan masuk lagi.')
  const sumber = pastikanFileGambar(file)
  const k = await kompresGambar(sumber)
  const ref = await addDoc(collection(db, 'lms_gambar'), {
    data: k.dataUrl,
    lebar: k.lebar,
    tinggi: k.tinggi,
    dibuatOleh: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Ambil file gambar pertama dari event paste/drop.
 * Mengembalikan null jika clipboard tidak berisi gambar.
 */
export function ambilGambarDariDataTransfer(dt: DataTransfer | null | undefined): File | null {
  if (!dt) return null
  const items = dt.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile()
        if (f) return f
      }
    }
  }
  const files = dt.files
  if (files) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.type.startsWith('image/')) return f
    }
  }
  return null
}

/**
 * Baca gambar dari Clipboard API (tombol Tempel).
 * Peramban mungkin meminta izin clipboard-read.
 */
export async function ambilGambarDariClipboardApi(): Promise<File | null> {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    throw new Error('Peramban tidak mendukung baca clipboard. Fokuskan area gambar lalu tekan Ctrl+V / ⌘V.')
  }
  let items: ClipboardItems
  try {
    items = await navigator.clipboard.read()
  } catch {
    throw new Error('Tidak bisa membaca clipboard. Izinkan akses clipboard, atau tekan Ctrl+V di area gambar.')
  }
  for (const item of items) {
    const tipe = item.types.find((t) => t.startsWith('image/'))
    if (!tipe) continue
    const blob = await item.getType(tipe)
    return pastikanFileGambar(blob, `gambar-clipboard.${tipe.split('/')[1] || 'png'}`)
  }
  return null
}

/**
 * Salin data URL gambar ke clipboard sistem (untuk ditempel ke soal lain).
 */
export async function salinDataUrlKeClipboard(dataUrl: string): Promise<void> {
  if (!dataUrl.startsWith('data:image/')) throw new Error('Data gambar tidak valid.')
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Peramban tidak mendukung salin gambar ke clipboard.')
  }
  const tipe = blob.type || 'image/png'
  await navigator.clipboard.write([new ClipboardItem({ [tipe]: blob })])
}

const cache = new Map<string, Promise<string | null>>()

/** Ambil data URL gambar (di-cache selama sesi halaman). */
export function ambilGambar(id: string): Promise<string | null> {
  let p = cache.get(id)
  if (!p) {
    p = getDoc(doc(db, 'lms_gambar', id))
      .then((s) => (s.exists() ? ((s.data().data as string) ?? null) : null))
      .catch(() => {
        cache.delete(id)
        return null
      })
    cache.set(id, p)
  }
  return p
}

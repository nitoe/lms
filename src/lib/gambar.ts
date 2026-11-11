import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

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

async function bacaBitmap(file: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(file)
}

function gambarKeDataUrl(bmp: ImageBitmap, skala: number, mutu: number): { url: string; w: number; h: number } {
  const w = Math.max(1, Math.round(bmp.width * skala))
  const h = Math.max(1, Math.round(bmp.height * skala))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Peramban tidak mendukung pengolahan gambar.')
  // Latar putih supaya PNG transparan tidak jadi hitam saat dikonversi.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  let url = canvas.toDataURL('image/webp', mutu)
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', mutu)
  return { url, w, h }
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
  const bmp = await bacaBitmap(file)
  try {
    let skala = Math.min(1, SISI_MAKS / Math.max(bmp.width, bmp.height))
    for (let putaran = 0; putaran < 6; putaran++) {
      for (const mutu of [0.85, 0.72, 0.6, 0.48]) {
        const r = gambarKeDataUrl(bmp, skala, mutu)
        if (r.url.length <= SASARAN_KARAKTER) {
          return { dataUrl: r.url, lebar: r.w, tinggi: r.h }
        }
      }
      skala *= 0.78
    }
    throw new Error('Gambar tidak bisa dikecilkan cukup. Coba gambar yang lebih sederhana.')
  } finally {
    bmp.close()
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

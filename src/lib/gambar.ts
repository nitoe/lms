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

async function bacaBitmap(file: File): Promise<ImageBitmap> {
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

/** Perkecil (sisi terpanjang ≤ 1024 px) dan kompres sampai muat batas dokumen. */
export async function kompresGambar(file: File): Promise<HasilKompres> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar (JPG, PNG, WebP).')
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

/** Unggah ke Firestore, kembalikan ID dokumen. */
export async function unggahGambar(file: File): Promise<string> {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sesi berakhir. Silakan masuk lagi.')
  const k = await kompresGambar(file)
  const ref = await addDoc(collection(db, 'lms_gambar'), {
    data: k.dataUrl,
    lebar: k.lebar,
    tinggi: k.tinggi,
    dibuatOleh: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
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

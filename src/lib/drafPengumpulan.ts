/**
 * Draf pengumpulan tugas siswa (foto + catatan) di IndexedDB perangkat (ANTIREGRESI §Tugas.Draf).
 * Alasan: di HP RAM kecil Android sering mematikan tab saat kamera terbuka; halaman dimuat ulang dan
 * semua foto yang sudah dipilih (state React) hilang. Draf hanya untuk pengumpulan PERTAMA (belum ada
 * dokumen di server). Video TIDAK disimpan (besar; dipilih ulang). Draf per `tugasId_siswaId`, kedaluwarsa
 * 7 hari, dihapus saat berhasil dikirim. Semua operasi gagal-diam: tanpa IndexedDB (mode privat) fitur
 * ini sekadar tidak aktif.
 */
import { BATAS_KARAKTER_GAMBAR } from './gambar'

const NAMA_DB = 'lms-draf-pengumpulan'
const STORE = 'draf'
const UMUR_MAKS_MS = 7 * 24 * 60 * 60 * 1000
const MAKS_FOTO = 10

export type DrafPengumpulan = {
  /** Foto mode bebas (data URL terkompres), urut tampil. */
  items: string[]
  /** Foto mode bukti berlabel per slot. */
  fotoSlot: Record<number, string>
  /** Sisa foto multi-pilih yang belum dipasang ke kartu bukti. */
  antrian: string[]
  catatan: string
  ts: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function bukaDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(NAMA_DB, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function jalankan<T>(
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await bukaDb()
  if (!db) return null
  return await new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const req = op(tx.objectStore(STORE))
      // Tulis dianggap selesai saat transaksi tuntas (bukan saat request), agar urutan hapus/simpan terjaga.
      if (mode === 'readwrite') {
        tx.oncomplete = () => resolve(req.result ?? null)
      } else {
        req.onsuccess = () => resolve(req.result ?? null)
      }
      tx.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

const fotoSah = (x: unknown): x is string =>
  typeof x === 'string' && x.startsWith('data:image/') && x.length <= BATAS_KARAKTER_GAMBAR

export async function simpanDraf(kunci: string, d: Omit<DrafPengumpulan, 'ts'>): Promise<void> {
  await jalankan('readwrite', (s) => s.put({ ...d, ts: Date.now() }, kunci))
}

export async function hapusDraf(kunci: string): Promise<void> {
  await jalankan('readwrite', (s) => s.delete(kunci))
}

/** Muat draf; null bila tak ada, kedaluwarsa, atau rusak (draf kedaluwarsa/rusak sekalian dihapus). */
export async function muatDraf(kunci: string): Promise<DrafPengumpulan | null> {
  const mentah = await jalankan('readonly', (s) => s.get(kunci))
  if (!mentah || typeof mentah !== 'object') return null
  const m = mentah as Partial<DrafPengumpulan>
  if (typeof m.ts !== 'number' || Date.now() - m.ts > UMUR_MAKS_MS) {
    await hapusDraf(kunci)
    return null
  }
  const items = Array.isArray(m.items) ? m.items.filter(fotoSah).slice(0, MAKS_FOTO) : []
  const antrian = Array.isArray(m.antrian) ? m.antrian.filter(fotoSah).slice(0, MAKS_FOTO) : []
  const fotoSlot: Record<number, string> = {}
  if (m.fotoSlot && typeof m.fotoSlot === 'object') {
    for (const [k, v] of Object.entries(m.fotoSlot)) {
      const n = Number(k)
      if (Number.isInteger(n) && n >= 1 && n <= MAKS_FOTO && fotoSah(v)) fotoSlot[n] = v
    }
  }
  const catatan = typeof m.catatan === 'string' ? m.catatan : ''
  if (items.length === 0 && antrian.length === 0 && Object.keys(fotoSlot).length === 0 && !catatan.trim()) {
    return null
  }
  return { items, fotoSlot, antrian, catatan, ts: m.ts }
}

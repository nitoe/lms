import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { kompresGambar, BATAS_KARAKTER_GAMBAR } from './gambar'
import type { TugasLms } from '../types/tugas'

/**
 * Pengumpulan tugas siswa (foto) — ANTIREGRESI §132.
 *
 * Dua koleksi:
 *  - lms_pengumpulan/{tugasId_siswaId}            → meta kecil (catatan, fotoIds, waktu)
 *  - lms_pengumpulan_foto/{tugasId_siswaId_slot}  → satu foto terkompres (data URL, ≤300.000 karakter)
 * Foto SENGAJA dipisah dari meta: guru memuat daftar (meta saja, ringan) lalu foto hanya saat dibuka.
 * Foto disimpan di Firestore (pola sama dengan lms_gambar §10), BUKAN Storage: token siswa tidak
 * boleh menulis ke Storage (storage.rules sengaja tidak mengenal siswa).
 */

export const BATAS_FOTO_PENGUMPULAN = 3
export const BATAS_CATATAN = 500
const SLOT = ['1', '2', '3'] as const

export type PengumpulanDok = {
  id: string
  tugasId: string
  siswaId: string
  siswaNama: string
  kelas: string
  mapel: string
  catatan: string
  fotoIds: string[]
  jumlahFoto: number
  dibuatMs: number
  diubahMs: number
}

export function idPengumpulan(tugasId: string, siswaId: string): string {
  return `${tugasId}_${siswaId}`
}

export function idFoto(tugasId: string, siswaId: string, slot: number): string {
  return `${tugasId}_${siswaId}_${SLOT[slot]}`
}

/** Hanya data URL gambar yang boleh dipasang di <img src>. */
export function dataUrlGambarAman(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:image/') && s.length <= BATAS_KARAKTER_GAMBAR
}

function tsMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    return (v as { toMillis: () => number }).toMillis()
  }
  return 0
}

function keDok(id: string, x: Record<string, unknown>): PengumpulanDok {
  return {
    id,
    tugasId: String(x.tugasId || ''),
    siswaId: String(x.siswaId || ''),
    siswaNama: String(x.siswaNama || ''),
    kelas: String(x.kelas || ''),
    mapel: String(x.mapel || ''),
    catatan: typeof x.catatan === 'string' ? x.catatan : '',
    fotoIds: Array.isArray(x.fotoIds) ? (x.fotoIds as unknown[]).map(String) : [],
    jumlahFoto: Number(x.jumlahFoto) || 0,
    dibuatMs: tsMs(x.createdAt),
    diubahMs: tsMs(x.updatedAt),
  }
}

/* ───────────────────────── Siswa ───────────────────────── */

/** Semua pengumpulan milik siswa (rules: baca milik sendiri; query WAJIB where siswaId). */
export async function muatPengumpulanSaya(siswaId: string): Promise<Record<string, PengumpulanDok>> {
  const snap = await getDocs(query(collection(db, 'lms_pengumpulan'), where('siswaId', '==', siswaId)))
  const map: Record<string, PengumpulanDok> = {}
  for (const d of snap.docs) {
    const dok = keDok(d.id, d.data())
    if (dok.tugasId) map[dok.tugasId] = dok
  }
  return map
}

/** Muat data URL foto (urut sesuai fotoIds); id yang gagal/tak valid dilewati. */
export async function muatFoto(fotoIds: string[]): Promise<string[]> {
  const hasil: string[] = []
  for (const id of fotoIds.slice(0, BATAS_FOTO_PENGUMPULAN)) {
    try {
      const s = await getDoc(doc(db, 'lms_pengumpulan_foto', id))
      const data = s.exists() ? s.data().data : null
      if (dataUrlGambarAman(data)) hasil.push(data)
    } catch (e) {
      console.warn('Foto pengumpulan gagal dimuat', id, e)
    }
  }
  return hasil
}

export async function siapkanFoto(file: File): Promise<string> {
  const r = await kompresGambar(file)
  return r.dataUrl
}

export type KirimInput = {
  tugas: TugasLms
  siswaId: string
  siswaNama: string
  kelas: string
  /** Foto final (data URL) sesuai urutan tampil; 1–3. */
  foto: string[]
  catatan: string
  /** Dokumen meta yang sudah ada (kirim ulang) atau null (pertama kali). */
  ada: PengumpulanDok | null
}

/**
 * Simpan pengumpulan. Urutan: foto dulu, meta TERAKHIR (guru tidak melihat meta yang menunjuk
 * foto yang belum ada). Kirim ulang memakai updateDoc tanpa menyentuh createdAt (rules melarang).
 */
export async function kirimPengumpulan(input: KirimInput): Promise<PengumpulanDok> {
  const { tugas, siswaId, siswaNama, kelas, ada } = input
  const foto = input.foto.filter(dataUrlGambarAman).slice(0, BATAS_FOTO_PENGUMPULAN)
  if (foto.length === 0) throw new Error('Tambahkan minimal satu foto.')
  const catatan = input.catatan.trim().slice(0, BATAS_CATATAN)
  const mapel = tugas.mapel

  const fotoIds: string[] = []
  for (let i = 0; i < foto.length; i++) {
    const id = idFoto(tugas.id, siswaId, i)
    const ref = doc(db, 'lms_pengumpulan_foto', id)
    const sudah = !!ada && ada.fotoIds.includes(id)
    if (sudah) {
      await updateDoc(ref, { data: foto[i], updatedAt: serverTimestamp() })
    } else {
      await setDoc(ref, {
        tugasId: tugas.id,
        siswaId,
        kelas,
        mapel,
        slot: SLOT[i],
        data: foto[i],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    fotoIds.push(id)
  }

  // Hapus slot lama yang tidak dipakai lagi (mis. 3 foto → 2 foto).
  for (const lama of ada?.fotoIds ?? []) {
    if (!fotoIds.includes(lama)) {
      try {
        await deleteDoc(doc(db, 'lms_pengumpulan_foto', lama))
      } catch (e) {
        console.warn('Hapus foto lama gagal', lama, e)
      }
    }
  }

  const id = idPengumpulan(tugas.id, siswaId)
  const ref = doc(db, 'lms_pengumpulan', id)
  if (ada) {
    await updateDoc(ref, {
      catatan,
      fotoIds,
      jumlahFoto: fotoIds.length,
      updatedAt: serverTimestamp(),
    })
  } else {
    await setDoc(ref, {
      tugasId: tugas.id,
      siswaId,
      siswaNama,
      kelas,
      mapel,
      catatan,
      fotoIds,
      jumlahFoto: fotoIds.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  const s = await getDoc(ref)
  return keDok(id, s.data() ?? {})
}

export function pesanGagalKumpul(e: unknown): string {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Tugas belum bisa dikumpulkan. Mungkin tugas sudah dinilai atau ditutup. Beri tahu gurumu ya.'
  }
  if (e instanceof Error && e.message) return e.message
  return 'Gagal mengumpulkan. Periksa internet lalu coba lagi.'
}

/* ───────────────────────── Guru ───────────────────────── */

/**
 * Pengumpulan satu tugas untuk guru. Rules mengevaluasi `mapel` + `kelas` tiap dokumen, jadi
 * query WAJIB menyertakan tugasId + mapel + kelas (satu query per rombel; ANTIREGRESI §132.4).
 */
export async function daftarPengumpulanTugas(tugas: TugasLms): Promise<PengumpulanDok[]> {
  const kelasSemua = [...new Set([tugas.kelas, ...(tugas.kelasList ?? [])].filter(Boolean))]
  const hasil: PengumpulanDok[] = []
  for (const k of kelasSemua) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'lms_pengumpulan'),
          where('tugasId', '==', tugas.id),
          where('mapel', '==', tugas.mapel),
          where('kelas', '==', k),
        ),
      )
      for (const d of snap.docs) hasil.push(keDok(d.id, d.data()))
    } catch (e) {
      // Rombel paralel yang tidak diampu ditolak rules — lewati, jangan gagalkan semuanya.
      console.warn('daftarPengumpulanTugas', k, e)
      if (k === tugas.kelas) throw e
    }
  }
  hasil.sort((a, b) => a.siswaNama.localeCompare(b.siswaNama, 'id'))
  return hasil
}

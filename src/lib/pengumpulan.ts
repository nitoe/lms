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
import { adaBukti } from './buktiTugas'

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

/** Mode lama (tanpa bukti berlabel): maksimal foto bebas. */
export const BATAS_FOTO_PENGUMPULAN = 3
/** Slot foto maksimum (bukti berlabel) — selaras rules `fotoIds.size() <= 6` & slot '1'..'6'. */
export const BATAS_SLOT_FOTO = 6
export const DAFTAR_SLOT = [1, 2, 3, 4, 5, 6] as const
export const BATAS_CATATAN = 500
const SLOT = ['1', '2', '3', '4', '5', '6'] as const

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

/**
 * Nomor slot foto (1..6) dari ID dokumen foto (akhiran `_1`..`_6`); 0 bila tak dikenali.
 * Bukti berlabel memakai slot TETAP (ANTIREGRESI §Tugas.Bukti), jadi slot dibaca dari ID,
 * bukan dari urutan di `fotoIds`.
 */
export function slotDariFotoId(id: string): number {
  const m = /_([1-6])$/.exec(id)
  return m ? Number(m[1]) : 0
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

/** Muat foto per slot (1..3 → data URL). Slot yang gagal/tak valid dilewati. */
export async function muatFotoBerslot(fotoIds: string[]): Promise<Record<number, string>> {
  const hasil: Record<number, string> = {}
  for (const id of fotoIds.slice(0, BATAS_SLOT_FOTO)) {
    const slot = slotDariFotoId(id)
    if (!slot) continue
    try {
      const s = await getDoc(doc(db, 'lms_pengumpulan_foto', id))
      const data = s.exists() ? s.data().data : null
      if (dataUrlGambarAman(data)) hasil[slot] = data
    } catch (e) {
      console.warn('Foto pengumpulan gagal dimuat', id, e)
    }
  }
  return hasil
}

/** Label bukti wajib yang belum terisi (kosong = lengkap atau tugas tanpa bukti berlabel). */
export function buktiWajibKurang(
  tugas: Pick<TugasLms, 'buktiList'>,
  fotoSlot: Record<number, string>,
): string[] {
  if (!adaBukti(tugas)) return []
  return (tugas.buktiList ?? [])
    .filter((b) => b.wajib && !dataUrlGambarAman(fotoSlot[b.slot]))
    .map((b) => b.label)
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
  /** Foto final (data URL) sesuai urutan tampil; 1–3. Dipakai tugas TANPA bukti berlabel. */
  foto?: string[]
  /**
   * Foto per slot (1..6 → data URL). Dipakai tugas dengan bukti berlabel: slot tetap,
   * bukti opsional boleh kosong (ANTIREGRESI §Tugas.Bukti).
   */
  fotoSlot?: Record<number, string>
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
  let entri: { slot: number; src: string }[]
  if (adaBukti(tugas)) {
    const slotMap = input.fotoSlot ?? {}
    const kurang = buktiWajibKurang(tugas, slotMap)
    if (kurang.length > 0) {
      throw new Error(`Bukti wajib belum lengkap: ${kurang.join(', ')}.`)
    }
    entri = [...DAFTAR_SLOT]
      .filter((n) => dataUrlGambarAman(slotMap[n]))
      .map((n) => ({ slot: n, src: slotMap[n] }))
  } else {
    entri = (input.foto ?? [])
      .filter(dataUrlGambarAman)
      .slice(0, BATAS_FOTO_PENGUMPULAN)
      .map((src, i) => ({ slot: i + 1, src }))
  }
  if (entri.length === 0) throw new Error('Tambahkan minimal satu foto.')
  const catatan = input.catatan.trim().slice(0, BATAS_CATATAN)
  const mapel = tugas.mapel

  const fotoIds: string[] = []
  for (const { slot, src } of entri) {
    const id = idFoto(tugas.id, siswaId, slot - 1)
    const ref = doc(db, 'lms_pengumpulan_foto', id)
    const sudah = !!ada && ada.fotoIds.includes(id)
    if (sudah) {
      await updateDoc(ref, { data: src, updatedAt: serverTimestamp() })
    } else {
      await setDoc(ref, {
        tugasId: tugas.id,
        siswaId,
        kelas,
        mapel,
        slot: SLOT[slot - 1],
        data: src,
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

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
import { adaBukti, adaBuktiVideo } from './buktiTugas'
import {
  hapusVideoTugas,
  pathVideoAman,
  unggahVideoTugas,
  type VideoMeta,
  type VideoSiap,
} from './videoTugas'

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

/**
 * Mode tanpa bukti berlabel: maksimal foto bebas.
 * Diselaraskan dengan rules `fotoIds.size() <= 6` dan slot '1'..'6' (ANTIREGRESI §132 / §Tugas.MultiFile).
 */
export const BATAS_FOTO_PENGUMPULAN = 6
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
  /** Video bukti per slot (1..6) → berkas di Storage (ANTIREGRESI §Tugas.Video). */
  videos: Record<number, VideoMeta>
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

function videosDariDok(raw: unknown): Record<number, VideoMeta> {
  const hasil: Record<number, VideoMeta> = {}
  if (!raw || typeof raw !== 'object') return hasil
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const slot = Number(k)
    const x = v as Record<string, unknown> | null
    if (!Number.isInteger(slot) || slot < 1 || slot > BATAS_SLOT_FOTO || !x) continue
    if (!pathVideoAman(x.path)) continue
    hasil[slot] = {
      path: x.path,
      tipe: x.tipe === 'video/mp4' ? 'video/mp4' : 'video/webm',
      ukuran: Number(x.ukuran) || 0,
      durasi: Number(x.durasi) || 0,
    }
  }
  return hasil
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
    videos: videosDariDok(x.videos),
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

/**
 * Label bukti wajib yang belum terisi (kosong = lengkap atau tugas tanpa bukti berlabel).
 * Bukti berjenis video dicek pada `videoSlot`, bukti foto pada `fotoSlot`.
 */
export function buktiWajibKurang(
  tugas: Pick<TugasLms, 'buktiList'>,
  fotoSlot: Record<number, string>,
  videoSlot: Record<number, unknown> = {},
): string[] {
  if (!adaBukti(tugas)) return []
  return (tugas.buktiList ?? [])
    .filter((b) =>
      b.wajib && (b.jenis === 'video' ? !videoSlot[b.slot] : !dataUrlGambarAman(fotoSlot[b.slot])),
    )
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
  /** Video baru per slot (sudah lolos periksa & konversi) yang akan diunggah ke Storage. */
  videoBaru?: Record<number, VideoSiap>
  /** Slot video lama yang DIPERTAHANKAN (tidak diganti/dihapus siswa). */
  videoPertahankan?: number[]
  /** Kemajuan unggah video 0..1 (rata-rata semua video baru). */
  onProgressVideo?: (bagian: number) => void
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
  const videoBaru = input.videoBaru ?? {}
  const videoLama = ada?.videos ?? {}
  const videoAkhir: Record<number, VideoMeta> = {}
  for (const n of input.videoPertahankan ?? []) {
    if (videoLama[n] && !videoBaru[n]) videoAkhir[n] = videoLama[n]
  }
  if (adaBukti(tugas)) {
    const slotMap = input.fotoSlot ?? {}
    const adaVideo: Record<number, boolean> = {}
    for (const n of Object.keys(videoAkhir)) adaVideo[Number(n)] = true
    for (const n of Object.keys(videoBaru)) adaVideo[Number(n)] = true
    const kurang = buktiWajibKurang(tugas, slotMap, adaVideo)
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
  if (entri.length === 0 && Object.keys(videoAkhir).length === 0 && Object.keys(videoBaru).length === 0) {
    throw new Error('Tambahkan minimal satu foto.')
  }
  const catatan = input.catatan.trim().slice(0, BATAS_CATATAN)
  const mapel = tugas.mapel

  // 1) Video ke Storage dulu (paling berat & paling mungkin gagal), lalu foto, meta TERAKHIR.
  const slotVideoBaru = Object.keys(videoBaru).map(Number)
  const bagian: Record<number, number> = {}
  for (const n of slotVideoBaru) {
    videoAkhir[n] = await unggahVideoTugas(tugas.id, siswaId, n, videoBaru[n], (b) => {
      bagian[n] = b
      input.onProgressVideo?.(
        slotVideoBaru.reduce((acc, k) => acc + (bagian[k] ?? 0), 0) / slotVideoBaru.length,
      )
    })
  }

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
  const videosDok: Record<string, VideoMeta> = {}
  for (const [k, v] of Object.entries(videoAkhir)) videosDok[k] = v
  if (ada) {
    await updateDoc(ref, {
      catatan,
      fotoIds,
      jumlahFoto: fotoIds.length,
      // Foto saja (tanpa video sebelum/sekarang): jangan sentuh `videos` agar tetap jalan di rules lama.
      ...(adaBuktiVideo(tugas) || Object.keys(videoLama).length > 0 || Object.keys(videosDok).length > 0
        ? { videos: videosDok }
        : {}),
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
      ...(Object.keys(videosDok).length > 0 ? { videos: videosDok } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  // Berkas video lama yang tak dipakai lagi (dihapus/diganti, atau ekstensi berubah) — best-effort.
  const pathDipakai = new Set(Object.values(videoAkhir).map((v) => v.path))
  for (const lama of Object.values(videoLama)) {
    if (!pathDipakai.has(lama.path)) await hapusVideoTugas(lama.path)
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

/**
 * Reset pengumpulan satu siswa (guru/admin): hapus meta + foto Firestore + video Storage.
 * Opsional hapus nilai agar siswa boleh kumpul lagi setelah dinilai (ANTIREGRESI §Tugas.Reset).
 */
export async function hapusPengumpulanSiswa(
  tugas: TugasLms,
  dok: PengumpulanDok,
  opsi?: { hapusNilai?: boolean },
): Promise<void> {
  // 1) Video Storage (best-effort)
  for (const v of Object.values(dok.videos ?? {})) {
    if (v?.path) await hapusVideoTugas(v.path)
  }
  // 2) Foto dokumen
  for (const id of dok.fotoIds ?? []) {
    try {
      await deleteDoc(doc(db, 'lms_pengumpulan_foto', id))
    } catch (e) {
      console.warn('hapus foto pengumpulan', id, e)
    }
  }
  // Slot 1..6 cadangan bila fotoIds kosong/tidak lengkap
  for (const n of DAFTAR_SLOT) {
    const id = idFoto(tugas.id, dok.siswaId, n - 1)
    if (dok.fotoIds?.includes(id)) continue
    try {
      await deleteDoc(doc(db, 'lms_pengumpulan_foto', id))
    } catch {
      /* tidak ada */
    }
  }
  // 3) Meta
  await deleteDoc(doc(db, 'lms_pengumpulan', dok.id))
  // 4) Nilai (opsional) — buka kembali kunci pengumpulan
  if (opsi?.hapusNilai) {
    try {
      await deleteDoc(doc(db, 'lms_nilai_tugas', `${tugas.id}_${dok.siswaId}`))
    } catch (e) {
      console.warn('hapus nilai tugas saat reset', e)
    }
  }
}

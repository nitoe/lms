/**
 * CRUD kuis LMS — model baru: soal di-snapshot di dokumen `lms_kuis`.
 * Sumber: paket bank `lms_paket_soal` berstatus `siap`.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { PaketSoal } from '../types/soal'
import type {
  FilterSusunKuis,
  KuisLms,
  ModeSusunKuis,
  SoalKuis,
} from '../types/kuis'
import { BATAS_PAKET_SUMBER, BATAS_SOAL_PER_KUIS } from '../types/kuis'
import {
  hitungRingkasanKuis,
  kumpulkanKandidat,
  susunManual,
  susunOtomatis,
} from './susunKuis'
import { daftarPaket } from './soal'

function koleksi() {
  return collection(db, 'lms_kuis')
}

/** Firestore menolak `undefined`. */
function bersihkan<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

export async function daftarKuis(kelas: string, mapel: string): Promise<KuisLms[]> {
  const q = query(
    koleksi(),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      sumberPaketIds: Array.isArray(data.sumberPaketIds) ? data.sumberPaketIds : [],
      soal: Array.isArray(data.soal) ? data.soal : [],
      modeSusun: (data.modeSusun as ModeSusunKuis) || 'manual',
      jumlahSoal: typeof data.jumlahSoal === 'number' ? data.jumlahSoal : (data.soal?.length ?? 0),
      totalPoin: typeof data.totalPoin === 'number' ? data.totalPoin : 0,
    } as KuisLms
  })
  list.sort((a, b) => {
    const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
    const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
    return tb - ta
  })
  return list
}

export async function ambilKuis(id: string): Promise<KuisLms | null> {
  const s = await getDoc(doc(db, 'lms_kuis', id))
  if (!s.exists()) return null
  const data = s.data()
  return {
    id: s.id,
    ...data,
    sumberPaketIds: Array.isArray(data.sumberPaketIds) ? data.sumberPaketIds : [],
    soal: Array.isArray(data.soal) ? data.soal : [],
    modeSusun: (data.modeSusun as ModeSusunKuis) || 'manual',
    jumlahSoal: typeof data.jumlahSoal === 'number' ? data.jumlahSoal : (data.soal?.length ?? 0),
    totalPoin: typeof data.totalPoin === 'number' ? data.totalPoin : 0,
  } as KuisLms
}

export type InputBuatKuis = {
  kelas: string
  mapel: string
  judul: string
  deskripsi?: string
  namaGuru?: string
  sumberPaketIds: string[]
  modeSusun: ModeSusunKuis
  filterSusun?: FilterSusunKuis
  /** Mode manual: daftar pilihan. Mode otomatis diisi lib. */
  pilihanManual?: { paketId: string; soalId: string }[]
  /** Jika sudah dihitung di UI (mis. setelah AI filter). */
  soalSiap?: SoalKuis[]
  durasiMenit?: number
  acakSoal?: boolean
  acakOpsi?: boolean
}

/**
 * Buat kuis baru dari paket siap.
 * - Manual: pakai `pilihanManual` atau `soalSiap`.
 * - Otomatis / otomatis_ai: susun dari filter; pemanggil AI boleh kirim `soalSiap` hasil penyesuaian.
 */
export async function buatKuisDariPaket(input: InputBuatKuis): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul kuis wajib diisi.')
  if (!input.sumberPaketIds?.length) {
    throw new Error('Pilih minimal satu paket soal yang siap.')
  }
  if (input.sumberPaketIds.length > BATAS_PAKET_SUMBER) {
    throw new Error(`Maksimal ${BATAS_PAKET_SUMBER} paket sumber.`)
  }

  let soal: SoalKuis[] = input.soalSiap ?? []

  if (soal.length === 0) {
    const semuaPaket = await daftarPaket(input.kelas, input.mapel)
    const peta = new Map(semuaPaket.map((p) => [p.id, p]))
    const paketDipilih: PaketSoal[] = []
    for (const id of input.sumberPaketIds) {
      const p = peta.get(id)
      if (!p) throw new Error(`Paket ${id} tidak ditemukan.`)
      if (p.status !== 'siap') throw new Error(`Paket «${p.judul}» belum berstatus Siap.`)
      paketDipilih.push(p)
    }
    const kandidat = kumpulkanKandidat(paketDipilih)

    if (input.modeSusun === 'manual') {
      if (!input.pilihanManual?.length) {
        throw new Error('Pilih minimal satu soal secara manual.')
      }
      soal = susunManual(kandidat, input.pilihanManual)
    } else {
      soal = susunOtomatis(kandidat, input.filterSusun, { seedAcak: true })
    }
  }

  if (soal.length === 0) {
    throw new Error('Tidak ada soal yang memenuhi filter / pilihan.')
  }
  if (soal.length > BATAS_SOAL_PER_KUIS) {
    throw new Error(`Maksimal ${BATAS_SOAL_PER_KUIS} soal per kuis.`)
  }

  const ringkas = hitungRingkasanKuis(soal)
  const payload = bersihkan({
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel.trim(),
    judul,
    deskripsi: input.deskripsi?.trim() || undefined,
    sumberPaketIds: input.sumberPaketIds,
    modeSusun: input.modeSusun,
    filterSusun: input.filterSusun,
    soal,
    durasiMenit: typeof input.durasiMenit === 'number' ? input.durasiMenit : undefined,
    acakSoal: !!input.acakSoal,
    acakOpsi: input.acakOpsi !== false,
    aktif: false,
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    ...ringkas,
  })

  const refDoc = await addDoc(koleksi(), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return refDoc.id
}

export async function updateKuis(
  id: string,
  data: Partial<
    Pick<
      KuisLms,
      | 'judul'
      | 'deskripsi'
      | 'soal'
      | 'durasiMenit'
      | 'acakSoal'
      | 'acakOpsi'
      | 'aktif'
      | 'filterSusun'
      | 'modeSusun'
      | 'sumberPaketIds'
    >
  >,
): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  if (data.soal) {
    if (data.soal.length > BATAS_SOAL_PER_KUIS) {
      throw new Error(`Maksimal ${BATAS_SOAL_PER_KUIS} soal per kuis.`)
    }
    Object.assign(payload, hitungRingkasanKuis(data.soal))
  }
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k]
  }
  await updateDoc(doc(db, 'lms_kuis', id), {
    ...bersihkan(payload),
    updatedAt: serverTimestamp(),
  })
}

export async function hapusKuis(kuisId: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_kuis', kuisId))
}

/** Paket siap saja untuk kelas×mapel (untuk wizard). */
export async function daftarPaketSiap(kelas: string, mapel: string): Promise<PaketSoal[]> {
  const semua = await daftarPaket(kelas, mapel)
  return semua.filter((p) => p.status === 'siap' && (p.soal?.length ?? 0) > 0)
}

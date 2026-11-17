/**
 * CRUD koleksi `lms_lomba`.
 * Peserta maks 20 (MAKS_PESERTA_LOMBA). Hanya admin yang boleh create/update meta.
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
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import type {
  Lomba,
  PesertaLomba,
  StatusLomba,
  TingkatLomba,
} from '../types/lomba'
import { MAKS_PESERTA_LOMBA } from '../types/lomba'
import type { AppUser } from '../types/user'

function koleksi() {
  return collection(db, 'lms_lomba')
}

function tsKeDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Timestamp) return v.toDate()
  if (v instanceof Date) return v
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }
  return null
}

function dariDoc(id: string, data: DocumentData): Lomba {
  const siswaListRaw = Array.isArray(data.siswaList) ? data.siswaList : []
  const siswaList: PesertaLomba[] = siswaListRaw
    .map((p: DocumentData) => ({
      id: String(p?.id || ''),
      nama: String(p?.nama || ''),
      kelas: String(p?.kelas || ''),
      nisn: typeof p?.nisn === 'string' ? p.nisn : undefined,
    }))
    .filter((p: PesertaLomba) => p.id)

  const siswaIds = Array.isArray(data.siswaIds)
    ? (data.siswaIds as string[]).map(String).filter(Boolean)
    : siswaList.map((p) => p.id)

  return {
    id,
    nama: String(data.nama || ''),
    deskripsi: typeof data.deskripsi === 'string' ? data.deskripsi : undefined,
    identitas: typeof data.identitas === 'string' ? data.identitas : undefined,
    tingkat: (data.tingkat as TingkatLomba) || 'sekolah',
    mapelTerkait: Array.isArray(data.mapelTerkait)
      ? (data.mapelTerkait as string[]).map(String).filter(Boolean)
      : [],
    mulai: tsKeDate(data.mulai),
    selesai: tsKeDate(data.selesai),
    status: (data.status as StatusLomba) || 'draf',
    guruPengampuUid: String(data.guruPengampuUid || ''),
    guruPengampuNama: String(data.guruPengampuNama || ''),
    guruPengampuEmail:
      typeof data.guruPengampuEmail === 'string' ? data.guruPengampuEmail : undefined,
    siswaIds,
    siswaList,
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatOlehNama: String(data.dibuatOlehNama || ''),
    createdAt: tsKeDate(data.createdAt),
    updatedAt: tsKeDate(data.updatedAt),
  }
}

/** Semua lomba (admin). Query tanpa filter — rules hanya izinkan admin list bebas. */
export async function daftarSemuaLomba(): Promise<Lomba[]> {
  if (!isFirebaseConfigured) return []
  const snap = await getDocs(koleksi())
  const list = snap.docs.map((d) => dariDoc(d.id, d.data()))
  list.sort((a, b) => {
    const ta = a.createdAt?.getTime() ?? 0
    const tb = b.createdAt?.getTime() ?? 0
    return tb - ta
  })
  return list
}

/** Lomba di mana uid adalah guru pengampu. */
export async function daftarLombaPengampu(uid: string): Promise<Lomba[]> {
  if (!isFirebaseConfigured || !uid) return []
  const q = query(koleksi(), where('guruPengampuUid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => dariDoc(d.id, d.data()))
}

/**
 * Lomba yang diikuti siswa (array-contains siswaIds).
 * Dipakai untuk menu siswa + dashboard.
 */
export async function daftarLombaSiswa(siswaId: string): Promise<Lomba[]> {
  if (!isFirebaseConfigured || !siswaId) return []
  const q = query(koleksi(), where('siswaIds', 'array-contains', siswaId))
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => dariDoc(d.id, d.data()))
  // Sembunyikan arsip dari siswa kecuali perlu
  return list.filter((l) => l.status !== 'arsip')
}

export async function getLomba(id: string): Promise<Lomba | null> {
  if (!isFirebaseConfigured || !id) return null
  const s = await getDoc(doc(db, 'lms_lomba', id))
  if (!s.exists()) return null
  return dariDoc(s.id, s.data())
}

export type InputLombaBaru = {
  nama: string
  deskripsi?: string
  identitas?: string
  tingkat: TingkatLomba
  mapelTerkait: string[]
  mulai: Date | null
  selesai: Date | null
  status: StatusLomba
  guruPengampuUid: string
  guruPengampuNama: string
  guruPengampuEmail?: string
  siswaIds: string[]
  siswaList: PesertaLomba[]
  dibuatOleh: string
  dibuatOlehNama: string
}

function validasiPeserta(siswaIds: string[], siswaList: PesertaLomba[]) {
  if (siswaIds.length > MAKS_PESERTA_LOMBA) {
    throw new Error(`Peserta maksimal ${MAKS_PESERTA_LOMBA} siswa per lomba.`)
  }
  if (siswaList.length > MAKS_PESERTA_LOMBA) {
    throw new Error(`Peserta maksimal ${MAKS_PESERTA_LOMBA} siswa per lomba.`)
  }
  if (siswaIds.length !== siswaList.length) {
    throw new Error('siswaIds dan siswaList harus selaras.')
  }
}

function payloadDasar(input: InputLombaBaru | (Partial<InputLombaBaru> & { nama?: string })) {
  const mapel = Array.isArray(input.mapelTerkait)
    ? [...new Set(input.mapelTerkait.map((m) => m.trim()).filter(Boolean))]
    : []
  return {
    nama: String(input.nama || '').trim(),
    deskripsi: input.deskripsi?.trim() || null,
    identitas: input.identitas?.trim() || null,
    tingkat: input.tingkat || 'sekolah',
    mapelTerkait: mapel,
    mulai: input.mulai ? Timestamp.fromDate(input.mulai) : null,
    selesai: input.selesai ? Timestamp.fromDate(input.selesai) : null,
    status: input.status || 'draf',
    guruPengampuUid: String(input.guruPengampuUid || ''),
    guruPengampuNama: String(input.guruPengampuNama || ''),
    guruPengampuEmail: input.guruPengampuEmail?.trim() || null,
    siswaIds: input.siswaIds || [],
    siswaList: input.siswaList || [],
  }
}

export async function buatLomba(input: InputLombaBaru): Promise<string> {
  if (!isFirebaseConfigured) throw new Error('Firebase belum dikonfigurasi.')
  const nama = input.nama.trim()
  if (!nama) throw new Error('Nama lomba wajib diisi.')
  if (!input.guruPengampuUid) throw new Error('Guru pengampu wajib dipilih.')
  if (!input.mapelTerkait?.length) throw new Error('Minimal satu mapel terkait.')
  validasiPeserta(input.siswaIds, input.siswaList)

  const ref = await addDoc(koleksi(), {
    ...payloadDasar(input),
    dibuatOleh: input.dibuatOleh,
    dibuatOlehNama: input.dibuatOlehNama,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function perbaruiLomba(
  id: string,
  input: Partial<InputLombaBaru>,
): Promise<void> {
  if (!isFirebaseConfigured || !id) throw new Error('ID lomba tidak valid.')
  if (input.siswaIds || input.siswaList) {
    validasiPeserta(input.siswaIds || [], input.siswaList || [])
  }
  const data: DocumentData = {
    updatedAt: serverTimestamp(),
  }
  if (input.nama !== undefined) data.nama = input.nama.trim()
  if (input.deskripsi !== undefined) data.deskripsi = input.deskripsi?.trim() || null
  if (input.identitas !== undefined) data.identitas = input.identitas?.trim() || null
  if (input.tingkat !== undefined) data.tingkat = input.tingkat
  if (input.mapelTerkait !== undefined) {
    data.mapelTerkait = [...new Set(input.mapelTerkait.map((m) => m.trim()).filter(Boolean))]
  }
  if (input.mulai !== undefined) data.mulai = input.mulai ? Timestamp.fromDate(input.mulai) : null
  if (input.selesai !== undefined)
    data.selesai = input.selesai ? Timestamp.fromDate(input.selesai) : null
  if (input.status !== undefined) data.status = input.status
  if (input.guruPengampuUid !== undefined) data.guruPengampuUid = input.guruPengampuUid
  if (input.guruPengampuNama !== undefined) data.guruPengampuNama = input.guruPengampuNama
  if (input.guruPengampuEmail !== undefined)
    data.guruPengampuEmail = input.guruPengampuEmail?.trim() || null
  if (input.siswaIds !== undefined) data.siswaIds = input.siswaIds
  if (input.siswaList !== undefined) data.siswaList = input.siswaList

  await updateDoc(doc(db, 'lms_lomba', id), data)
}

export async function hapusLomba(id: string): Promise<void> {
  if (!isFirebaseConfigured || !id) return
  await deleteDoc(doc(db, 'lms_lomba', id))
}

/** Daftar staf aktif untuk dropdown guru pengampu (hanya admin yang boleh list users). */
export async function daftarStafAktif(): Promise<
  { uid: string; nama: string; email: string; role: string }[]
> {
  if (!isFirebaseConfigured) return []
  const snap = await getDocs(collection(db, 'users'))
  const ROLE_OK = new Set(['admin', 'guru', 'guru_akademik', 'guru_tahsin_tahfizh'])
  const list: { uid: string; nama: string; email: string; role: string }[] = []
  snap.forEach((d) => {
    const data = d.data() as AppUser & { email?: string }
    if (data.aktif === false) return
    const role = String(data.role || '')
    if (!ROLE_OK.has(role)) return
    list.push({
      uid: d.id,
      nama: String(data.nama || data.email || d.id),
      email: String(data.email || ''),
      role,
    })
  })
  list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  return list
}

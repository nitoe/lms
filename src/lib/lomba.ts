/**
 * CRUD koleksi `lms_lomba`.
 * Peserta maks 20 (MAKS_PESERTA_LOMBA). Pengampu maks 10 (MAKS_PENGAMPU_LOMBA).
 * Hanya admin yang boleh create/update meta (termasuk daftar pengampu).
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
  PengampuLomba,
  PesertaLomba,
  StatusLomba,
  TingkatLomba,
} from '../types/lomba'
import { MAKS_PESERTA_LOMBA, MAKS_PENGAMPU_LOMBA } from '../types/lomba'
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

/** Normalisasi pengampu: array baru + fallback field tunggal lama. */
function bacaPengampu(data: DocumentData): {
  uids: string[]
  list: PengampuLomba[]
  primaryUid: string
  primaryNama: string
  primaryEmail?: string
} {
  const listRaw = Array.isArray(data.guruPengampuList) ? data.guruPengampuList : []
  let list: PengampuLomba[] = listRaw
    .map((p: DocumentData) => ({
      uid: String(p?.uid || ''),
      nama: String(p?.nama || ''),
      email: typeof p?.email === 'string' ? p.email : undefined,
    }))
    .filter((p: PengampuLomba) => p.uid)

  let uids = Array.isArray(data.guruPengampuUids)
    ? (data.guruPengampuUids as string[]).map(String).filter(Boolean)
    : list.map((p) => p.uid)

  // Legacy single field
  const legacyUid = String(data.guruPengampuUid || '')
  if (legacyUid && !uids.includes(legacyUid)) {
    uids = [legacyUid, ...uids]
  }
  if (legacyUid && !list.some((p) => p.uid === legacyUid)) {
    list = [
      {
        uid: legacyUid,
        nama: String(data.guruPengampuNama || ''),
        email: typeof data.guruPengampuEmail === 'string' ? data.guruPengampuEmail : undefined,
      },
      ...list,
    ]
  }

  // Selaraskan list ke urutan uids
  const byUid = new Map(list.map((p) => [p.uid, p]))
  list = uids.map(
    (uid) =>
      byUid.get(uid) || {
        uid,
        nama: uid === legacyUid ? String(data.guruPengampuNama || '') : uid,
        email:
          uid === legacyUid && typeof data.guruPengampuEmail === 'string'
            ? data.guruPengampuEmail
            : undefined,
      },
  )

  const primary = list[0]
  return {
    uids,
    list,
    primaryUid: primary?.uid || legacyUid,
    primaryNama: primary?.nama || String(data.guruPengampuNama || ''),
    primaryEmail: primary?.email,
  }
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

  const pengampu = bacaPengampu(data)

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
    guruPengampuUid: pengampu.primaryUid,
    guruPengampuNama: pengampu.primaryNama,
    guruPengampuEmail: pengampu.primaryEmail,
    guruPengampuUids: pengampu.uids,
    guruPengampuList: pengampu.list,
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

/**
 * Lomba di mana uid adalah guru pengampu.
 * Query: array-contains guruPengampuUids + legacy guruPengampuUid==uid, digabung unik.
 */
export async function daftarLombaPengampu(uid: string): Promise<Lomba[]> {
  if (!isFirebaseConfigured || !uid) return []
  const [snapArr, snapLegacy] = await Promise.all([
    getDocs(query(koleksi(), where('guruPengampuUids', 'array-contains', uid))),
    getDocs(query(koleksi(), where('guruPengampuUid', '==', uid))),
  ])
  const map = new Map<string, Lomba>()
  for (const d of [...snapArr.docs, ...snapLegacy.docs]) {
    map.set(d.id, dariDoc(d.id, d.data()))
  }
  const list = [...map.values()]
  list.sort((a, b) => {
    const ta = a.createdAt?.getTime() ?? 0
    const tb = b.createdAt?.getTime() ?? 0
    return tb - ta
  })
  return list
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
  /** Daftar pengampu (≥1). Field single diisi otomatis dari elemen pertama. */
  guruPengampuList: PengampuLomba[]
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

function validasiPengampu(list: PengampuLomba[]) {
  if (!list.length) throw new Error('Minimal satu guru pengampu.')
  if (list.length > MAKS_PENGAMPU_LOMBA) {
    throw new Error(`Pengampu maksimal ${MAKS_PENGAMPU_LOMBA} guru per lomba.`)
  }
  const uids = list.map((p) => p.uid).filter(Boolean)
  if (uids.length !== list.length) throw new Error('Setiap pengampu wajib punya uid.')
  if (new Set(uids).size !== uids.length) throw new Error('Pengampu duplikat.')
}

function normalisasiPengampu(list: PengampuLomba[]): {
  guruPengampuUids: string[]
  guruPengampuList: { uid: string; nama: string; email: string | null }[]
  guruPengampuUid: string
  guruPengampuNama: string
  guruPengampuEmail: string | null
} {
  const clean = list.map((p) => ({
    uid: p.uid,
    nama: (p.nama || '').trim() || p.uid,
    email: p.email?.trim() || null,
  }))
  const first = clean[0]
  return {
    guruPengampuUids: clean.map((p) => p.uid),
    guruPengampuList: clean,
    guruPengampuUid: first.uid,
    guruPengampuNama: first.nama,
    guruPengampuEmail: first.email,
  }
}

function payloadDasar(
  input: InputLombaBaru | (Partial<InputLombaBaru> & { nama?: string }),
  pengampuOverride?: ReturnType<typeof normalisasiPengampu>,
) {
  const mapel = Array.isArray(input.mapelTerkait)
    ? [...new Set(input.mapelTerkait.map((m) => m.trim()).filter(Boolean))]
    : []
  const pengampu =
    pengampuOverride ||
    (input.guruPengampuList ? normalisasiPengampu(input.guruPengampuList) : null)
  const base: DocumentData = {
    nama: String(input.nama || '').trim(),
    deskripsi: input.deskripsi?.trim() || null,
    identitas: input.identitas?.trim() || null,
    tingkat: input.tingkat || 'sekolah',
    mapelTerkait: mapel,
    mulai: input.mulai ? Timestamp.fromDate(input.mulai) : null,
    selesai: input.selesai ? Timestamp.fromDate(input.selesai) : null,
    status: input.status || 'draf',
    siswaIds: input.siswaIds || [],
    siswaList: input.siswaList || [],
  }
  if (pengampu) {
    Object.assign(base, pengampu)
  }
  return base
}

export async function buatLomba(input: InputLombaBaru): Promise<string> {
  if (!isFirebaseConfigured) throw new Error('Firebase belum dikonfigurasi.')
  const nama = input.nama.trim()
  if (!nama) throw new Error('Nama lomba wajib diisi.')
  validasiPengampu(input.guruPengampuList)
  if (!input.mapelTerkait?.length) throw new Error('Minimal satu mapel terkait.')
  validasiPeserta(input.siswaIds, input.siswaList)

  const pengampu = normalisasiPengampu(input.guruPengampuList)
  const ref = await addDoc(koleksi(), {
    ...payloadDasar(input, pengampu),
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
  if (input.guruPengampuList) {
    validasiPengampu(input.guruPengampuList)
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
  if (input.guruPengampuList !== undefined) {
    Object.assign(data, normalisasiPengampu(input.guruPengampuList))
  }
  if (input.siswaIds !== undefined) data.siswaIds = input.siswaIds
  if (input.siswaList !== undefined) data.siswaList = input.siswaList

  await updateDoc(doc(db, 'lms_lomba', id), data)
}

export async function hapusLomba(id: string): Promise<void> {
  if (!isFirebaseConfigured || !id) return
  await deleteDoc(doc(db, 'lms_lomba', id))
}

/** Daftar staf aktif untuk pemilihan guru pengampu (hanya admin yang boleh list users). */
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

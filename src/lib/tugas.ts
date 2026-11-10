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
  Timestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  JenisPenilaianTugas,
  PengaturanPenilaianTugas,
  TugasInput,
  TugasLms,
  TpTugas,
} from '../types/tugas'

/**
 * Firestore menolak `undefined`. Rapikan pengaturan penilaian:
 * field opsional kosong → dihilangkan atau `null`.
 */
function sanitasiPengaturanPenilaian(
  p: PengaturanPenilaianTugas | Record<string, unknown>,
): Record<string, unknown> {
  const raw = p as PengaturanPenilaianTugas
  const kategori = (Array.isArray(raw.kategori) ? raw.kategori : [])
    .filter((k) => k && String(k.nama || '').trim())
    .map((k) => {
      const item: Record<string, unknown> = {
        id: String(k.id || ''),
        nama: String(k.nama).trim(),
      }
      if (k.deskripsi?.trim()) item.deskripsi = k.deskripsi.trim()
      if (typeof k.bobot === 'number' && !Number.isNaN(k.bobot)) item.bobot = k.bobot
      return item
    })

  const rentangPredikat = (Array.isArray(raw.rentangPredikat) ? raw.rentangPredikat : []).map(
    (r) => {
      const item: Record<string, unknown> = {
        predikat: String(r.predikat || '').trim(),
        min: typeof r.min === 'number' ? r.min : 0,
        max: typeof r.max === 'number' ? r.max : 100,
      }
      if (r.keterangan?.trim()) item.keterangan = r.keterangan.trim()
      return item
    },
  )

  const out: Record<string, unknown> = {
    kategori,
    rentangPredikat,
    rentangTerkunci: raw.rentangTerkunci === true,
  }
  if (raw.catatan?.trim()) out.catatan = raw.catatan.trim()
  else out.catatan = null

  return out
}

function koleksi() {
  return collection(db, 'lms_tugas')
}

function normalisasiJenisPenilaian(v: unknown): JenisPenilaianTugas {
  if (v === 'latihan' || v === 'slm' || v === 'sts' || v === 'sas') return v
  // Dokumen lama tanpa field: anggap SLM (masuk rekap formatif)
  return 'slm'
}


function normalisasiTpList(list?: TpTugas[]): TpTugas[] | undefined {
  if (!list || list.length === 0) return undefined
  return list
    .filter((t) => t && t.id && t.nama)
    .map((t) => ({
      id: t.id,
      nomor: typeof t.nomor === 'number' ? t.nomor : 0,
      nama: String(t.nama).trim(),
      ...(t.mapel ? { mapel: String(t.mapel).trim() } : {}),
    }))
}

function docKeTugas(id: string, data: Record<string, unknown>): TugasLms {
  const jenis = data.jenis === 'proyek' ? 'proyek' : 'mapel'
  const jenisPenilaian = normalisasiJenisPenilaian(data.jenisPenilaian)
  let tpList = normalisasiTpList(data.tpList as TpTugas[] | undefined)
  // Kompatibilitas dokumen lama (satu TP)
  if ((!tpList || tpList.length === 0) && data.tpId) {
    tpList = [
      {
        id: String(data.tpId),
        nomor: typeof data.tpNomor === 'number' ? data.tpNomor : 0,
        nama: typeof data.tpNama === 'string' ? data.tpNama : '',
        mapel: typeof data.mapel === 'string' ? data.mapel : undefined,
      },
    ]
  }
  return {
    id,
    kelas: String(data.kelas || ''),
    mapel: String(data.mapel || ''),
    mapelLain: Array.isArray(data.mapelLain)
      ? (data.mapelLain as unknown[]).map(String).filter(Boolean)
      : undefined,
    judul: String(data.judul || ''),
    deskripsi: typeof data.deskripsi === 'string' ? data.deskripsi : undefined,
    instruksi: typeof data.instruksi === 'string' ? data.instruksi : undefined,
    jenis,
    jenisPenilaian,
    tpList,
    tpId: typeof data.tpId === 'string' ? data.tpId : undefined,
    tpNomor: typeof data.tpNomor === 'number' ? data.tpNomor : undefined,
    tpNama: typeof data.tpNama === 'string' ? data.tpNama : undefined,
    tenggat: data.tenggat,
    aktif: data.aktif === true,
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatOlehNama: typeof data.dibuatOlehNama === 'string' ? data.dibuatOlehNama : undefined,
    jumlahPengumpulan:
      typeof data.jumlahPengumpulan === 'number' ? data.jumlahPengumpulan : 0,
    pengaturanPenilaian:
      data.pengaturanPenilaian && typeof data.pengaturanPenilaian === 'object'
        ? (data.pengaturanPenilaian as TugasLms['pengaturanPenilaian'])
        : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function sortTerbaru(list: TugasLms[]): TugasLms[] {
  return [...list].sort((a, b) => {
    const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
    const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
    return tb - ta
  })
}

/** Daftar tugas per kelas × mapel (kompatibilitas panel lama & query sempit). */
export async function daftarTugas(kelas: string, mapel: string): Promise<TugasLms[]> {
  const q = query(
    koleksi(),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => docKeTugas(d.id, d.data() as Record<string, unknown>))
  return sortTerbaru(list)
}

/**
 * Semua tugas untuk katalog guru:
 * 1) query per penugasan kelas×mapel
 * 2) plus semua tugas yang dibuatOleh == uid saat ini (agar tugas lama tetap muncul
 *    meski string mapel / penugasan berubah)
 * 3) admin tanpa penugasan: seluruh koleksi (rules isAdmin)
 * Error permission tidak ditelan diam-diam.
 */
export async function daftarTugasGuru(
  ruang: { kelas: string; mapel: string }[],
  opsi?: { sebagaiAdmin?: boolean },
): Promise<TugasLms[]> {
  const kunci = new Set<string>()
  const semua: TugasLms[] = []
  const errors: string[] = []

  const pasangan = new Map<string, { kelas: string; mapel: string }>()
  for (const r of ruang) {
    const k = `${String(r.kelas).toUpperCase()}::${r.mapel}`
    if (!pasangan.has(k)) pasangan.set(k, { kelas: r.kelas, mapel: r.mapel })
  }

  await Promise.all(
    [...pasangan.values()].map(async ({ kelas, mapel }) => {
      try {
        const list = await daftarTugas(kelas, mapel)
        for (const t of list) {
          if (kunci.has(t.id)) continue
          kunci.add(t.id)
          semua.push(t)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${kelas}/${mapel}: ${msg}`)
        console.warn('daftarTugas gagal', kelas, mapel, e)
      }
    }),
  )

  // Tugas yang saya buat (tanpa bergantung penugasan)
  const uid = auth.currentUser?.uid
  if (uid) {
    try {
      const q = query(koleksi(), where('dibuatOleh', '==', uid))
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        if (kunci.has(d.id)) continue
        kunci.add(d.id)
        semua.push(docKeTugas(d.id, d.data() as Record<string, unknown>))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`milik-saya: ${msg}`)
      console.warn('daftarTugas dibuatOleh gagal', e)
    }
  }

  // Admin tanpa penugasan: muat semua (rules allow isAdmin list)
  if (opsi?.sebagaiAdmin && semua.length === 0) {
    try {
      const snap = await getDocs(koleksi())
      for (const d of snap.docs) {
        if (kunci.has(d.id)) continue
        kunci.add(d.id)
        semua.push(docKeTugas(d.id, d.data() as Record<string, unknown>))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`admin-semua: ${msg}`)
      console.warn('daftarTugas admin gagal', e)
    }
  }

  if (semua.length === 0 && errors.length > 0) {
    throw new Error(
      'Gagal memuat tugas (permission/rules?). ' + errors.slice(0, 3).join(' | '),
    )
  }

  return sortTerbaru(semua)
}

export async function ambilTugas(id: string): Promise<TugasLms | null> {
  const snap = await getDoc(doc(db, 'lms_tugas', id))
  if (!snap.exists()) return null
  return docKeTugas(snap.id, snap.data() as Record<string, unknown>)
}

export async function buatTugas(input: TugasInput): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul tugas wajib diisi.')
  if (!input.kelas?.trim()) throw new Error('Kelas wajib dipilih.')
  if (!input.mapel?.trim()) throw new Error('Mata pelajaran wajib dipilih.')

  const jenis = input.jenis === 'proyek' ? 'proyek' : 'mapel'
  const tpList = normalisasiTpList(input.tpList)

  const payload: Record<string, unknown> = {
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel.trim(),
    judul,
    jenis,
    jenisPenilaian: normalisasiJenisPenilaian(input.jenisPenilaian ?? 'slm'),
    aktif: input.aktif === true,
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru || '',
    jumlahPengumpulan: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (jenis === 'proyek' && input.mapelLain?.length) {
    payload.mapelLain = input.mapelLain.map((m) => m.trim()).filter(Boolean)
  }
  if (input.deskripsi?.trim()) payload.deskripsi = input.deskripsi.trim()
  if (input.instruksi?.trim()) payload.instruksi = input.instruksi.trim()
  if (tpList?.length) {
    payload.tpList = tpList
    // Mirror field lama untuk kompatibilitas query/tampilan lama
    payload.tpId = tpList[0].id
    payload.tpNomor = tpList[0].nomor
    payload.tpNama = tpList[0].nama
  }
  if (input.tenggat instanceof Date && !Number.isNaN(input.tenggat.getTime())) {
    payload.tenggat = Timestamp.fromDate(input.tenggat)
  }
  if (input.pengaturanPenilaian) {
    payload.pengaturanPenilaian = sanitasiPengaturanPenilaian(input.pengaturanPenilaian)
  }

  const refDoc = await addDoc(koleksi(), payload)
  return refDoc.id
}

export async function updateTugas(
  id: string,
  data: Partial<TugasInput> & { aktif?: boolean },
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() }

  if (data.judul !== undefined) {
    const j = data.judul.trim()
    if (!j) throw new Error('Judul tidak boleh kosong.')
    payload.judul = j
  }
  if (data.kelas !== undefined) payload.kelas = String(data.kelas).toUpperCase()
  if (data.mapel !== undefined) payload.mapel = data.mapel.trim()
  if (data.jenis !== undefined) payload.jenis = data.jenis === 'proyek' ? 'proyek' : 'mapel'
  if (data.mapelLain !== undefined) {
    payload.mapelLain = data.mapelLain.map((m) => m.trim()).filter(Boolean)
  }
  if (data.deskripsi !== undefined) {
    payload.deskripsi = data.deskripsi.trim() || null
  }
  if (data.instruksi !== undefined) {
    payload.instruksi = data.instruksi.trim() || null
  }
  if (data.tpList !== undefined) {
    const tpList = normalisasiTpList(data.tpList)
    payload.tpList = tpList ?? null
    if (tpList?.length) {
      payload.tpId = tpList[0].id
      payload.tpNomor = tpList[0].nomor
      payload.tpNama = tpList[0].nama
    } else {
      payload.tpId = null
      payload.tpNomor = null
      payload.tpNama = null
    }
  }
  if (data.tenggat !== undefined) {
    if (data.tenggat instanceof Date && !Number.isNaN(data.tenggat.getTime())) {
      payload.tenggat = Timestamp.fromDate(data.tenggat)
    } else {
      payload.tenggat = null
    }
  }
  if (data.aktif !== undefined) payload.aktif = data.aktif === true
  if (data.pengaturanPenilaian !== undefined) {
    payload.pengaturanPenilaian = sanitasiPengaturanPenilaian(data.pengaturanPenilaian)
  }

  // Hapus undefined di top-level (nested sudah dirapikan sanitasi)
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k]
  }

  await updateDoc(doc(db, 'lms_tugas', id), payload)
}

export async function hapusTugas(id: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_tugas', id))
}

/** Format tenggat untuk tampilan. */
export function formatTenggat(tenggat: unknown): string {
  if (!tenggat) return '—'
  let d: Date | null = null
  if (tenggat instanceof Date) d = tenggat
  else if (typeof tenggat === 'object' && tenggat !== null && 'seconds' in tenggat) {
    d = new Date((tenggat as { seconds: number }).seconds * 1000)
  } else if (typeof tenggat === 'string') {
    const parsed = new Date(tenggat)
    if (!Number.isNaN(parsed.getTime())) d = parsed
  }
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

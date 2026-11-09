/**
 * Baca hasil pengerjaan kuis (`lms_jawaban`) + panggil penilaian manual guru.
 * Tulis dokumen hanya lewat Cloud Function (Admin SDK).
 * Lihat ANTIREGRESI §55.
 */
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'

export type DetailJawabanSoal = {
  soalId: string
  tipe?: string
  benar?: boolean
  skor?: number
  butuhManual?: boolean
  dinilaiManual?: boolean
}

export type JawabanKuis = {
  id: string
  kuisId: string
  siswaUid?: string
  siswaId: string | null
  siswaNama: string
  kelas: string
  mapel: string
  judulKuis?: string
  jenisPenilaian?: string
  jawaban?: Record<string, unknown>
  skorOtomatis: number
  totalPoin: number
  detail?: DetailJawabanSoal[]
  percobaan: number
  status: string
  createdAt?: unknown
  dinilaiOleh?: string
  dinilaiOlehNama?: string
}

function tsMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'number') return v
  return 0
}

function dariDok(id: string, data: Record<string, unknown>): JawabanKuis {
  return {
    id,
    kuisId: String(data.kuisId ?? ''),
    siswaUid: typeof data.siswaUid === 'string' ? data.siswaUid : undefined,
    siswaId: typeof data.siswaId === 'string' ? data.siswaId : null,
    siswaNama: typeof data.siswaNama === 'string' ? data.siswaNama : '',
    kelas: String(data.kelas ?? ''),
    mapel: String(data.mapel ?? ''),
    judulKuis: typeof data.judulKuis === 'string' ? data.judulKuis : undefined,
    jenisPenilaian: typeof data.jenisPenilaian === 'string' ? data.jenisPenilaian : undefined,
    jawaban: (data.jawaban as Record<string, unknown>) ?? undefined,
    skorOtomatis: Number(data.skorOtomatis) || 0,
    totalPoin: Number(data.totalPoin) || 0,
    detail: Array.isArray(data.detail) ? (data.detail as DetailJawabanSoal[]) : undefined,
    percobaan: Number(data.percobaan) || 1,
    status: String(data.status ?? ''),
    createdAt: data.createdAt,
    dinilaiOleh: typeof data.dinilaiOleh === 'string' ? data.dinilaiOleh : undefined,
    dinilaiOlehNama: typeof data.dinilaiOlehNama === 'string' ? data.dinilaiOlehNama : undefined,
  }
}

/** Query guru: kuisId + kelas + mapel (wajib agar lolos rules). */
export async function daftarJawabanKuis(
  kuisId: string,
  kelas: string,
  mapel: string,
): Promise<JawabanKuis[]> {
  const kelasNorm = String(kelas).toUpperCase()
  const mapelNorm = String(mapel).trim()
  const q = query(
    collection(db, 'lms_jawaban'),
    where('kuisId', '==', kuisId),
    where('kelas', '==', kelasNorm),
    where('mapel', '==', mapelNorm),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => dariDok(d.id, d.data() as Record<string, unknown>))
  list.sort((a, b) => {
    const tb = tsMs(b.createdAt) - tsMs(a.createdAt)
    if (tb !== 0) return tb
    return (b.percobaan ?? 0) - (a.percobaan ?? 0)
  })
  return list
}

export function ringkasPerSiswa(list: JawabanKuis[]): JawabanKuis[] {
  const map = new Map<string, JawabanKuis>()
  for (const j of list) {
    const key = j.siswaId || j.siswaUid || j.id
    const prev = map.get(key)
    if (!prev || tsMs(j.createdAt) > tsMs(prev.createdAt) || j.percobaan > prev.percobaan) {
      map.set(key, j)
    }
  }
  return [...map.values()].sort((a, b) =>
    (a.siswaNama || '').localeCompare(b.siswaNama || '', 'id'),
  )
}

export function agregatPerSoal(
  list: JawabanKuis[],
  soalIds: string[],
): Record<
  string,
  { benar: number; salah: number; kosong: number; manual: number; total: number; rataSkor: number }
> {
  const out: Record<
    string,
    {
      benar: number
      salah: number
      kosong: number
      manual: number
      total: number
      jumlahSkor: number
      rataSkor: number
    }
  > = {}
  for (const id of soalIds) {
    out[id] = { benar: 0, salah: 0, kosong: 0, manual: 0, total: 0, jumlahSkor: 0, rataSkor: 0 }
  }
  for (const j of list) {
    const byId = new Map((j.detail ?? []).map((d) => [d.soalId, d]))
    for (const sid of soalIds) {
      const d = byId.get(sid)
      const cell = out[sid]
      if (!cell) continue
      cell.total += 1
      if (!d) {
        cell.kosong += 1
        continue
      }
      cell.jumlahSkor += Number(d.skor) || 0
      if (d.butuhManual) cell.manual += 1
      else if (d.benar) cell.benar += 1
      else cell.salah += 1
    }
  }
  for (const sid of Object.keys(out)) {
    const c = out[sid]
    c.rataSkor = c.total > 0 ? Math.round((c.jumlahSkor / c.total) * 100) / 100 : 0
  }
  return out
}

export function skorKe100(skor: number, totalPoin: number): number {
  if (!totalPoin || totalPoin <= 0) return 0
  return Math.round((Number(skor) / Number(totalPoin)) * 1000) / 10
}

export function formatSkor100(skor: number, totalPoin: number): string {
  const n = skorKe100(skor, totalPoin)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

/** Guru menyimpan skor manual satu soal (CF nilaiManualKuisLms). */
export async function simpanNilaiManual(input: {
  jawabanId: string
  soalId: string
  skor: number
}): Promise<{ skorSoal: number; skorTotal: number; totalPoin: number; status: string }> {
  const fn = httpsCallable(functions, 'nilaiManualKuisLms')
  const res = await fn(input)
  const data = res.data as {
    skorSoal?: number
    skorTotal?: number
    totalPoin?: number
    status?: string
  }
  return {
    skorSoal: data.skorSoal ?? input.skor,
    skorTotal: data.skorTotal ?? 0,
    totalPoin: data.totalPoin ?? 0,
    status: data.status ?? 'selesai',
  }
}

export { tsMs as jawabanTsMs }

/**
 * Jumlah SISWA yang sudah mengumpulkan suatu tugas (angka «Terkumpul»). ANTIREGRESI §Tugas.Terkumpul.
 *
 * - Field `tugas.jumlahPengumpulan` TIDAK dipakai: tidak ada kode yang menaikkannya (selalu 0).
 * - Tugas individual: hitung dokumen pengumpulan (agregat `count`, murah: ±1 baca per 1000 dokumen).
 * - Tugas kelompok: hitung SISWA yang tercakup — seluruh anggota kelompok yang buktinya dikirim
 *   ketua atau anggota yang mewakilinya (`siswaTercakupPengumpulan`), bukan jumlah pengirim.
 * Query guru WAJIB tugasId + mapel + kelas per rombel (§132.4); rombel yang ditolak rules dilewati.
 */
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { daftarPengumpulanTugas } from './pengumpulan'
import { daftarKelompokTugas, siswaTercakupPengumpulan, type TugasKelompokDok } from './tugasKelompok'
import type { TugasLms } from '../types/tugas'

const kelasSemua = (t: TugasLms) => [...new Set([t.kelas, ...(t.kelasList ?? [])].filter(Boolean))]

export async function hitungTerkumpulTugas(tugas: TugasLms): Promise<number> {
  if (tugas.modeKelompok === true) {
    const list = await daftarPengumpulanTugas(tugas)
    const kel: TugasKelompokDok[] = []
    for (const k of kelasSemua(tugas)) {
      try {
        kel.push(...(await daftarKelompokTugas(tugas.id, k)))
      } catch (e) {
        console.warn('hitungTerkumpulTugas: kelompok', k, e)
      }
    }
    return siswaTercakupPengumpulan(list.map((d) => d.siswaId), kel).size
  }
  try {
    let total = 0
    for (const k of kelasSemua(tugas)) {
      try {
        const snap = await getCountFromServer(
          query(
            collection(db, 'lms_pengumpulan'),
            where('tugasId', '==', tugas.id),
            where('mapel', '==', tugas.mapel),
            where('kelas', '==', k),
          ),
        )
        total += snap.data().count
      } catch (e) {
        console.warn('hitungTerkumpulTugas: count', k, e)
        if (k === tugas.kelas) throw e
      }
    }
    return total
  } catch {
    // Agregat tak tersedia/ditolak → hitung dari dokumen (lebih mahal, tetap benar).
    return (await daftarPengumpulanTugas(tugas)).length
  }
}

/** Cache sesi singkat agar membuka/memuat ulang dashboard tidak mengulang ratusan baca. */
const CACHE_MS = 90_000
const cache = new Map<string, { n: number; t: number }>()

export async function hitungTerkumpulTugasCache(tugas: TugasLms, paksa = false): Promise<number> {
  const c = cache.get(tugas.id)
  if (!paksa && c && Date.now() - c.t < CACHE_MS) return c.n
  const n = await hitungTerkumpulTugas(tugas)
  cache.set(tugas.id, { n, t: Date.now() })
  return n
}

export function terkumpulDiCache(tugasId: string): number | undefined {
  return cache.get(tugasId)?.n
}

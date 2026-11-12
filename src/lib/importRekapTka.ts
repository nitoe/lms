/**
 * Bulk import nilai Try Out TKA ke lms_rekap_tka (khusus admin LMS).
 * Mencocokkan nama + kelas ke roster siswa, lalu setDoc merge dengan sumber manual.
 */
import {
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { muatSiswaKelas, type SiswaDasar } from './siswaAuth'
import type { MapelTkaNama } from './tkaAkses'
import type { TahapTryOutTka } from '../types/kuis'
import { idRekapTka } from '../types/rekapTka'
import type { BarisTryOutImport } from '../data/tryoutTahap1'

const MAPEL_MTK: MapelTkaNama = 'TKA Matematika'
const MAPEL_BI: MapelTkaNama = 'TKA Bahasa Indonesia'

/** Normalisasi nama untuk pencocokan: huruf kecil, spasi tunggal, strip tanda baca ringan. */
export function normalisasiNama(nama: string): string {
  return String(nama || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type StatusCocok = 'cocok' | 'ganda' | 'tidak_ketemu'

export type BarisPratinjauImport = {
  sumber: BarisTryOutImport
  status: StatusCocok
  siswa?: SiswaDasar
  kandidat?: SiswaDasar[]
  pesan?: string
}

export function cocokkanBaris(
  baris: readonly BarisTryOutImport[],
  roster: SiswaDasar[],
): BarisPratinjauImport[] {
  const byKelas = new Map<string, SiswaDasar[]>()
  for (const s of roster) {
    const k = String(s.kelas).toUpperCase()
    const list = byKelas.get(k) || []
    list.push(s)
    byKelas.set(k, list)
  }

  return baris.map((sumber) => {
    const kelas = sumber.kelas.toUpperCase()
    const pool = byKelas.get(kelas) || []
    const key = normalisasiNama(sumber.nama)
    const hits = pool.filter((s) => normalisasiNama(s.nama) === key)
    if (hits.length === 1) {
      return { sumber, status: 'cocok' as const, siswa: hits[0] }
    }
    if (hits.length > 1) {
      return {
        sumber,
        status: 'ganda' as const,
        kandidat: hits,
        pesan: `${hits.length} siswa nama sama di ${kelas}`,
      }
    }
    // fallback: nama mengandung / dikandung (hati-hati, hanya jika unik)
    const soft = pool.filter((s) => {
      const n = normalisasiNama(s.nama)
      return n.includes(key) || key.includes(n)
    })
    if (soft.length === 1) {
      return {
        sumber,
        status: 'cocok' as const,
        siswa: soft[0],
        pesan: 'Cocok longgar (substring nama)',
      }
    }
    return {
      sumber,
      status: 'tidak_ketemu' as const,
      kandidat: soft.slice(0, 5),
      pesan: soft.length
        ? `Mirip: ${soft.map((s) => s.nama).join(', ')}`
        : 'Tidak ada di roster kelas',
    }
  })
}

export async function muatRosterTka6(): Promise<SiswaDasar[]> {
  const [a, b] = await Promise.all([muatSiswaKelas('6A'), muatSiswaKelas('6B')])
  return [...a, ...b]
}

export type HasilImportRekapTka = {
  ditulis: number
  dilewati: number
  error: string[]
}

/**
 * Tulis nilai manual MTK + BI untuk baris yang sudah cocok.
 * Batch per 400 (batas Firestore ~500).
 */
export async function imporRekapTkaManual(input: {
  tahap: TahapTryOutTka
  baris: BarisPratinjauImport[]
  namaGuru?: string
  /** Jika true, baris status ganda/tidak_ketemu dilewati (default). */
  hanyaCocok?: boolean
}): Promise<HasilImportRekapTka> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')

  const hanyaCocok = input.hanyaCocok !== false
  const siap = input.baris.filter((b) => b.status === 'cocok' && b.siswa)
  const dilewati = input.baris.length - siap.length
  if (hanyaCocok === false) {
    // mode ketat: hanya cocok yang ditulis; ganda/tidak tetap dilewati
  }

  const error: string[] = []
  let ditulis = 0
  const CHUNK = 400

  for (let i = 0; i < siap.length; i += CHUNK) {
    const chunk = siap.slice(i, i + CHUNK)
    const batch = writeBatch(db)
    for (const b of chunk) {
      const s = b.siswa!
      const kelas = String(s.kelas).toUpperCase()
      const id = idRekapTka(kelas, input.tahap, s.id)
      const ref = doc(db, 'lms_rekap_tka', id)
      const mtk = Math.round(Number(b.sumber.mtk) * 10) / 10
      const bi = Math.round(Number(b.sumber.bi) * 10) / 10
      if (mtk < 0 || mtk > 100 || bi < 0 || bi > 100) {
        error.push(`${b.sumber.nama}: nilai di luar 0–100`)
        continue
      }
      batch.set(
        ref,
        {
          kelas,
          tahap: input.tahap,
          siswaId: s.id,
          siswaNama: s.nama || b.sumber.nama,
          nilai: {
            [MAPEL_MTK]: mtk,
            [MAPEL_BI]: bi,
          },
          sumber: {
            [MAPEL_MTK]: 'manual',
            [MAPEL_BI]: 'manual',
          },
          diubahOleh: uid,
          diubahOlehNama: input.namaGuru || '',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )
      ditulis += 1
    }
    try {
      await batch.commit()
    } catch (e) {
      error.push(e instanceof Error ? e.message : String(e))
    }
  }

  return { ditulis, dilewati, error }
}

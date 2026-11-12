import type { JenisPenilaianTugas, TugasLms } from '../types/tugas'

/**
 * Helper murni untuk tampilan katalog Tugas (guru). Tidak menyentuh Firestore.
 * Logika data tetap di `lib/tugas.ts`.
 */

/** Ubah tenggat (Date | Timestamp | ISO string) menjadi Date, atau null bila tak valid. */
export function tenggatKeDate(v: unknown): Date | null {
  if (!v) return null
  let d: Date | null = null
  if (v instanceof Date) d = v
  else if (typeof v === 'object' && v !== null && 'seconds' in v) {
    const s = (v as { seconds: unknown }).seconds
    if (typeof s === 'number') d = new Date(s * 1000)
  } else if (typeof v === 'string') {
    const p = new Date(v)
    if (!Number.isNaN(p.getTime())) d = p
  }
  return d && !Number.isNaN(d.getTime()) ? d : null
}

export type NadaTenggat = 'tanpa' | 'lewat' | 'hariini' | 'segera' | 'aman'

export interface InfoTenggat {
  nada: NadaTenggat
  /** Kalimat relatif: «Besok», «3 hari lagi», «Lewat 2 hari», «Tanpa tenggat». */
  label: string
  /** Tanggal ringkas untuk baris kecil, kosong bila tanpa tenggat. */
  tanggal: string
  /** Selisih hari kalender (negatif = sudah lewat); null bila tanpa tenggat. */
  selisihHari: number | null
}

function awalHari(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Batas «segera berakhir» pada ringkasan & nada kartu (hari kalender). */
export const BATAS_HARI_SEGERA = 3

export function infoTenggat(tenggat: unknown, sekarang: Date = new Date()): InfoTenggat {
  const d = tenggatKeDate(tenggat)
  if (!d) return { nada: 'tanpa', label: 'Tanpa tenggat', tanggal: '', selisihHari: null }

  const selisihHari = Math.round((awalHari(d) - awalHari(sekarang)) / 86_400_000)
  const tanggal =
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  if (d.getTime() < sekarang.getTime()) {
    return {
      nada: 'lewat',
      label: selisihHari === 0 ? 'Berakhir hari ini' : `Lewat ${Math.abs(selisihHari)} hari`,
      tanggal,
      selisihHari,
    }
  }
  if (selisihHari === 0) return { nada: 'hariini', label: 'Hari ini', tanggal, selisihHari }
  if (selisihHari === 1) return { nada: 'segera', label: 'Besok', tanggal, selisihHari }
  return {
    nada: selisihHari <= BATAS_HARI_SEGERA ? 'segera' : 'aman',
    label: `${selisihHari} hari lagi`,
    tanggal,
    selisihHari,
  }
}

/** Label penilaian ringkas untuk UI guru (rinci tetap tersedia di title). */
export const LABEL_PENILAIAN_SINGKAT: Record<JenisPenilaianTugas, string> = {
  latihan: 'Latihan',
  slm: 'SLM',
  sts: 'STS',
  sas: 'SAS',
}

/** Dokumen lama tanpa field dianggap SLM (selaras `normalisasiJenisPenilaian`). */
export function penilaianTugas(t: Pick<TugasLms, 'jenisPenilaian'>): JenisPenilaianTugas {
  const j = t.jenisPenilaian
  return j === 'latihan' || j === 'slm' || j === 'sts' || j === 'sas' ? j : 'slm'
}

/**
 * Draf lokal wizard «Susun kuis».
 *
 * Tujuan: kemajuan penyusunan kuis (judul, paket dipilih, filter, pratinjau soal) TIDAK hilang bila
 * halaman di-reload / hard-reset atau simpan ke Firestore gagal (mis. permission-denied).
 * Disimpan di localStorage perangkat ini saja (bukan Firestore, jadi tidak lewat firestore.rules).
 * Kunci per pengguna + lomba/kelas + mapel. ANTIREGRESI §Lomba.18.
 */

import type { ModeSusunKuis, SoalKuis, TahapTryOutTka } from '../types/kuis'
import type { KompleksitasSoal, TipeSoal } from '../types/soal'

const VERSI = 1
const AWALAN = 'lms:kuis-draf:v1'

export type DrafKuisWizard = {
  v: number
  /** Epoch ms saat terakhir disimpan. */
  tersimpan: number
  judul: string
  deskripsi: string
  tahapTryOutTka: TahapTryOutTka | ''
  paketIds: string[]
  mode: ModeSusunKuis
  jumlahSoal: number
  tipeAktif: TipeSoal[]
  kompleksitasAktif: KompleksitasSoal[]
  pilihanManual: { paketId: string; soalId: string }[]
  pratinjau: SoalKuis[] | null
}

export type HasilSimpanDraf = 'ok' | 'tanpa-pratinjau' | 'gagal'

/** Kunci stabil: pengguna × (lomba | kelas) × mapel. */
export function kunciDrafKuis(
  uid: string | null | undefined,
  lombaId: string | undefined,
  kelas: string,
  mapel: string,
): string {
  if (!uid) return ''
  const ruang = lombaId ? `lomba:${lombaId}` : `kelas:${String(kelas).toUpperCase()}`
  return `${AWALAN}:${uid}:${ruang}:${mapel}`
}

/** Draf dianggap kosong bila belum ada isian berarti (jangan menimpa draf lama dengan wizard kosong). */
export function drafKuisKosong(d: Omit<DrafKuisWizard, 'v' | 'tersimpan'>): boolean {
  return (
    !d.judul.trim() &&
    !d.deskripsi.trim() &&
    d.paketIds.length === 0 &&
    d.pilihanManual.length === 0 &&
    !(d.pratinjau && d.pratinjau.length > 0)
  )
}

function adalahArray(x: unknown): x is unknown[] {
  return Array.isArray(x)
}

/** Baca + validasi bentuk. Mengembalikan null bila tidak ada / rusak / versi lain. */
export function bacaDrafKuis(kunci: string): DrafKuisWizard | null {
  if (!kunci) return null
  try {
    const mentah = window.localStorage.getItem(kunci)
    if (!mentah) return null
    const d = JSON.parse(mentah) as Partial<DrafKuisWizard> | null
    if (!d || typeof d !== 'object' || d.v !== VERSI) return null
    return {
      v: VERSI,
      tersimpan: typeof d.tersimpan === 'number' ? d.tersimpan : Date.now(),
      judul: typeof d.judul === 'string' ? d.judul : '',
      deskripsi: typeof d.deskripsi === 'string' ? d.deskripsi : '',
      tahapTryOutTka: (typeof d.tahapTryOutTka === 'string' ? d.tahapTryOutTka : '') as DrafKuisWizard['tahapTryOutTka'],
      paketIds: adalahArray(d.paketIds) ? (d.paketIds.filter((x) => typeof x === 'string') as string[]) : [],
      mode: (typeof d.mode === 'string' ? d.mode : 'otomatis') as ModeSusunKuis,
      jumlahSoal: typeof d.jumlahSoal === 'number' && d.jumlahSoal > 0 ? d.jumlahSoal : 10,
      tipeAktif: adalahArray(d.tipeAktif) ? (d.tipeAktif as TipeSoal[]) : [],
      kompleksitasAktif: adalahArray(d.kompleksitasAktif) ? (d.kompleksitasAktif as KompleksitasSoal[]) : [],
      pilihanManual: adalahArray(d.pilihanManual)
        ? (d.pilihanManual as { paketId: string; soalId: string }[]).filter(
            (x) => x && typeof x.paketId === 'string' && typeof x.soalId === 'string',
          )
        : [],
      pratinjau: adalahArray(d.pratinjau) ? (d.pratinjau as SoalKuis[]) : null,
    }
  } catch {
    return null
  }
}

/**
 * Simpan draf. Bila terlalu besar untuk kuota localStorage, coba ulang TANPA pratinjau
 * (pengaturan + paket + pilihan manual tetap aman; pratinjau bisa disusun ulang sekali klik).
 */
export function simpanDrafKuis(
  kunci: string,
  isi: Omit<DrafKuisWizard, 'v' | 'tersimpan'>,
): HasilSimpanDraf {
  if (!kunci) return 'gagal'
  const penuh: DrafKuisWizard = { ...isi, v: VERSI, tersimpan: Date.now() }
  try {
    window.localStorage.setItem(kunci, JSON.stringify(penuh))
    return 'ok'
  } catch {
    /* kuota penuh / diblokir — coba versi ringkas */
  }
  try {
    window.localStorage.setItem(kunci, JSON.stringify({ ...penuh, pratinjau: null }))
    return 'tanpa-pratinjau'
  } catch {
    return 'gagal'
  }
}

export function hapusDrafKuis(kunci: string): void {
  if (!kunci) return
  try {
    window.localStorage.removeItem(kunci)
  } catch {
    /* abaikan */
  }
}

export function labelWaktuDraf(ms: number): string {
  try {
    return new Date(ms).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

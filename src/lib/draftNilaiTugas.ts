/**
 * Draf nilai per baris di «Daftar nilai» / «Menilai per siswa» (TugasDetail) dan penentuan status
 * barisnya (Tersimpan / Belum disimpan / Belum dinilai). ANTIREGRESI §Tugas.StatusSimpan.
 *
 * Modul ini MURNI (tanpa Firebase/React) supaya mudah diuji, dan menjadi SATU-SATUNYA tempat yang
 * membangun draf dari baris server. Dulu ada dua pembangun draf (muatNilai & draftDariServer) yang
 * berbeda bidang `poin`-nya, sehingga status baris tak pernah kembali «Tersimpan».
 */
import type { BarisNilaiTugas } from './nilaiTugas'
import type { KategoriPenilaian } from '../types/tugas'

export type DraftBaris = {
  perKategori: Record<string, string>
  nilaiAkhir: string
  predikat: string
  komentar: string
  /**
   * Poin perbaikan untuk siswa, satu poin per baris.
   * `undefined` = guru belum menyentuh poin pada draf ini (draf salinan ketua / hasil generate predikat):
   * poin TIDAK ikut disimpan dan TIDAK ikut dibandingkan dengan server.
   */
  poin?: string
}

export type StatusBarisNilai = 'kosong' | 'ubah' | 'ok'

/** Apakah draf lokal berisi data yang perlu dipertahankan (belum disimpan). */
export function draftBerisiData(d: DraftBaris | undefined): boolean {
  if (!d) return false
  if (String(d.nilaiAkhir || '').trim() !== '') return true
  if (String(d.komentar || '').trim() !== '') return true
  if (String(d.poin || '').trim() !== '') return true
  if (String(d.predikat || '').trim() !== '') return true
  return Object.values(d.perKategori || {}).some((v) => String(v || '').trim() !== '')
}

/**
 * Bandingkan draf dengan snapshot server (string skor).
 * Poin hanya dibandingkan bila draf MEMANG membawa poin (`d.poin !== undefined`): draf tanpa poin
 * tidak mengubah poin di server, jadi tidak boleh dianggap «berbeda» dari poin yang sudah tersimpan.
 */
export function draftSamaDenganServer(d: DraftBaris, server: DraftBaris): boolean {
  if (String(d.nilaiAkhir || '').trim() !== String(server.nilaiAkhir || '').trim()) return false
  if (String(d.predikat || '').trim() !== String(server.predikat || '').trim()) return false
  if (String(d.komentar || '').trim() !== String(server.komentar || '').trim()) return false
  if (d.poin !== undefined && String(d.poin || '').trim() !== String(server.poin || '').trim()) return false
  const ids = new Set([...Object.keys(d.perKategori || {}), ...Object.keys(server.perKategori || {})])
  for (const id of ids) {
    if (String(d.perKategori?.[id] || '').trim() !== String(server.perKategori?.[id] || '').trim()) {
      return false
    }
  }
  return true
}

/** Draf yang setara dengan isi baris dari server (termasuk poin tersimpan). */
export function draftDariBaris(
  r: BarisNilaiTugas,
  kategori: KategoriPenilaian[],
  predikatDariNilai: (nilai: number) => string,
): DraftBaris {
  const per: Record<string, string> = {}
  for (const k of kategori) {
    const v = r.perKategori[k.id]
    per[k.id] = v === null || v === undefined ? '' : String(v)
  }
  let pred = r.predikat
  if (!pred && r.nilaiAkhir !== null) pred = predikatDariNilai(r.nilaiAkhir)
  return {
    perKategori: per,
    nilaiAkhir: r.nilaiAkhir === null ? '' : String(r.nilaiAkhir),
    predikat: pred,
    komentar: r.komentar || '',
    // Poin hanya dibawa bila sudah tersimpan: baris tanpa poin tetap `undefined` (= «jangan sentuh»),
    // sehingga menyimpan nilai biasa tidak menulis `poinPerbaikan: []` ke dokumen yang tak pernah punya.
    ...(r.poin && r.poin.trim() ? { poin: r.poin } : {}),
  }
}

/**
 * Status baris: `ok` = sama dengan yang tersimpan; `ubah` = ada isian/perubahan yang belum
 * disimpan; `kosong` = belum pernah dinilai dan belum diisi.
 */
export function statusDraftBaris(
  d: DraftBaris | undefined,
  r: BarisNilaiTugas,
  kategori: KategoriPenilaian[],
  predikatDariNilai: (nilai: number) => string,
): StatusBarisNilai {
  if (!draftBerisiData(d)) return r.sudahAda ? 'ubah' : 'kosong'
  if (draftSamaDenganServer(d as DraftBaris, draftDariBaris(r, kategori, predikatDariNilai))) {
    return r.sudahAda ? 'ok' : 'ubah'
  }
  return 'ubah'
}

/**
 * Salinan nilai penentu kelompok ke anggota (skor, nilai akhir, predikat, komentar). Poin perbaikan
 * milik anggota itu sendiri dibiarkan apa adanya (tidak ikut disalin, tidak ikut dihapus).
 */
export function salinDraftNilai(sumber: DraftBaris, tujuan?: DraftBaris): DraftBaris {
  return {
    perKategori: { ...sumber.perKategori },
    nilaiAkhir: sumber.nilaiAkhir,
    predikat: sumber.predikat,
    komentar: sumber.komentar,
    ...(tujuan?.poin !== undefined ? { poin: tujuan.poin } : {}),
  }
}

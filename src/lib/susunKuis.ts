/**
 * Logika murni penyusunan soal kuis dari paket bank yang siap.
 * Tidak menyentuh Firestore — mudah diuji.
 */
import type { KompleksitasSoal, PaketSoal, Soal, TipeSoal } from '../types/soal'
import { normalisasiKompleksitas, URUTAN_TIPE, URUTAN_KOMPLEKSITAS } from '../types/soal'
import type { FilterSusunKuis, SoalKuis } from '../types/kuis'
import { BATAS_SOAL_PER_KUIS } from '../types/kuis'
import { teksPolos } from './html'

function acakFisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Salin soal bank → SoalKuis dengan poin default 1 dan jejak sumber. */
export function snapshotSoal(
  s: Soal,
  paket: Pick<PaketSoal, 'id' | 'judul'>,
  poinDefault = 1,
): SoalKuis {
  const salin = JSON.parse(JSON.stringify(s)) as Soal
  return {
    ...salin,
    poin: typeof salin.poin === 'number' && salin.poin > 0 ? poinDefault : poinDefault,
    sumberPaketId: paket.id,
    sumberSoalId: s.id,
    sumberPaketJudul: paket.judul,
  }
}

export type KandidatSoal = {
  soal: Soal
  paket: Pick<PaketSoal, 'id' | 'judul'>
}

/** Kumpulkan semua soal dari paket yang statusnya `siap`. */
export function kumpulkanKandidat(paketList: PaketSoal[]): KandidatSoal[] {
  const out: KandidatSoal[] = []
  for (const p of paketList) {
    if (p.status !== 'siap') continue
    for (const s of p.soal ?? []) {
      out.push({ soal: s, paket: { id: p.id, judul: p.judul } })
    }
  }
  return out
}

function cocokFilter(s: Soal, f: FilterSusunKuis | undefined): boolean {
  if (!f) return true
  if (f.tipe && f.tipe.length > 0 && !f.tipe.includes(s.tipe)) return false
  if (f.kompleksitas && f.kompleksitas.length > 0) {
    const k = normalisasiKompleksitas(s.kompleksitas)
    if (!f.kompleksitas.includes(k)) return false
  }
  return true
}

/**
 * Susun otomatis sesuai filter.
 * - Poin semua = 1 (user ubah nanti).
 * - Hormati jumlahPerTipe / jumlahPerKompleksitas selama stok cukup.
 * - Sisa kuota diisi acak dari kandidat yang masih cocok filter.
 * - Dedup berdasarkan sumberSoalId dalam satu susunan (satu soal bank hanya sekali).
 */
export function susunOtomatis(
  kandidat: KandidatSoal[],
  filter: FilterSusunKuis | undefined,
  opsi?: { batas?: number; seedAcak?: boolean },
): SoalKuis[] {
  const batas = Math.min(
    opsi?.batas ?? filter?.jumlahSoal ?? BATAS_SOAL_PER_KUIS,
    BATAS_SOAL_PER_KUIS,
  )
  if (batas <= 0) return []

  const cocok = kandidat.filter((k) => cocokFilter(k.soal, filter))
  const pool = opsi?.seedAcak === false ? cocok : acakFisherYates(cocok)
  const terpakai = new Set<string>()
  const hasil: SoalKuis[] = []

  const ambil = (pred: (s: Soal) => boolean, n: number) => {
    let diambil = 0
    for (const k of pool) {
      if (diambil >= n || hasil.length >= batas) break
      const key = `${k.paket.id}::${k.soal.id}`
      if (terpakai.has(key)) continue
      if (!pred(k.soal)) continue
      terpakai.add(key)
      hasil.push(snapshotSoal(k.soal, k.paket, 1))
      diambil++
    }
  }

  const jpt = filter?.jumlahPerTipe
  if (jpt) {
    for (const t of URUTAN_TIPE) {
      const n = jpt[t]
      if (typeof n === 'number' && n > 0) {
        ambil((s) => s.tipe === t, n)
      }
    }
  }

  const jpk = filter?.jumlahPerKompleksitas
  if (jpk && hasil.length < batas) {
    for (const k of URUTAN_KOMPLEKSITAS) {
      const n = jpk[k]
      if (typeof n === 'number' && n > 0) {
        ambil((s) => normalisasiKompleksitas(s.kompleksitas) === k, n)
      }
    }
  }

  if (hasil.length < batas) {
    ambil(() => true, batas - hasil.length)
  }

  return hasil
}

/** Susun manual: user sudah memilih daftar {paketId, soalId}. */
export function susunManual(
  kandidat: KandidatSoal[],
  pilihan: { paketId: string; soalId: string }[],
): SoalKuis[] {
  const peta = new Map<string, KandidatSoal>()
  for (const k of kandidat) {
    peta.set(`${k.paket.id}::${k.soal.id}`, k)
  }
  const hasil: SoalKuis[] = []
  const seen = new Set<string>()
  for (const p of pilihan) {
    const key = `${p.paketId}::${p.soalId}`
    if (seen.has(key)) continue
    const k = peta.get(key)
    if (!k) continue
    seen.add(key)
    hasil.push(snapshotSoal(k.soal, k.paket, 1))
    if (hasil.length >= BATAS_SOAL_PER_KUIS) break
  }
  return hasil
}

/** Normalisasi teks untuk perbandingan kesamaan kasar (tanpa AI). */
export function normalisasiTeksSoal(s: Soal): string {
  return teksPolos(s.teks)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Deteksi pasangan yang teksnya hampir sama (Jaccard token sederhana).
 * Dipakai sebagai pre-filter sebelum AI; juga fallback bila AI tidak tersedia.
 */
export function deteksiDuplikatKasar(
  list: SoalKuis[],
  ambang = 0.72,
): { a: number; b: number; skor: number }[] {
  const tokens = list.map((s) => {
    const t = normalisasiTeksSoal(s)
    return new Set(t.split(' ').filter((w) => w.length > 2))
  })
  const pasangan: { a: number; b: number; skor: number }[] = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = tokens[i]
      const B = tokens[j]
      if (A.size === 0 || B.size === 0) continue
      let inter = 0
      for (const w of A) if (B.has(w)) inter++
      const union = A.size + B.size - inter
      const skor = union === 0 ? 0 : inter / union
      if (skor >= ambang) pasangan.push({ a: i, b: j, skor })
    }
  }
  return pasangan.sort((x, y) => y.skor - x.skor)
}

export function hitungRingkasanKuis(soal: SoalKuis[]) {
  return {
    jumlahSoal: soal.length,
    totalPoin: Math.round(soal.reduce((t, s) => t + (Number(s.poin) || 0), 0) * 100) / 100,
  }
}

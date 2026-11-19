import {
  BATAS_BUKTI_TUGAS,
  type BuktiTugas,
  type KategoriPenilaian,
  type TugasLms,
} from '../types/tugas'

/**
 * Bukti pengumpulan berlabel (ANTIREGRESI §Tugas.Bukti).
 * Setiap bukti = satu foto di slot tetap 1..3. Tanpa `buktiList` tugas memakai mode lama
 * (1–3 foto tanpa label).
 */

function idBukti(): string {
  return `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function slotBebas(dipakai: Set<number>): number {
  for (let s = 1; s <= BATAS_BUKTI_TUGAS; s++) if (!dipakai.has(s)) return s
  return 0
}

/**
 * Rapikan daftar bukti (baca maupun tulis): buang label kosong, batasi 3, pastikan slot 1..3 unik.
 * Bukti dengan slot rusak/ganda diberi slot kosong berikutnya; kelebihan dibuang.
 */
export function rapikanBuktiList(raw: unknown): BuktiTugas[] {
  if (!Array.isArray(raw)) return []
  const dipakai = new Set<number>()
  const hasil: BuktiTugas[] = []
  // Lulus pertama: bukti yang slotnya sah & belum dipakai.
  const kandidat = raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' && x.id ? x.id : '',
      slot: typeof x.slot === 'number' ? Math.trunc(x.slot) : 0,
      label: typeof x.label === 'string' ? x.label.trim().slice(0, 120) : '',
      petunjuk: typeof x.petunjuk === 'string' ? x.petunjuk.trim().slice(0, 300) : '',
      wajib: x.wajib !== false,
      kategoriIds: Array.isArray(x.kategoriIds)
        ? [...new Set((x.kategoriIds as unknown[]).map(String).filter(Boolean))]
        : [],
    }))
    .filter((x) => x.label)
  for (const k of kandidat) {
    if (k.slot >= 1 && k.slot <= BATAS_BUKTI_TUGAS && !dipakai.has(k.slot)) dipakai.add(k.slot)
    else k.slot = 0
  }
  for (const k of kandidat) {
    if (hasil.length >= BATAS_BUKTI_TUGAS) break
    if (!k.slot) {
      const s = slotBebas(dipakai)
      if (!s) continue
      k.slot = s
      dipakai.add(s)
    }
    const item: BuktiTugas = {
      id: k.id || idBukti(),
      slot: k.slot,
      label: k.label,
      wajib: k.wajib,
    }
    if (k.petunjuk) item.petunjuk = k.petunjuk
    if (k.kategoriIds.length) item.kategoriIds = k.kategoriIds
    hasil.push(item)
  }
  return hasil
}

/** Bukti baru kosong dengan slot bebas berikutnya; null bila sudah 3. */
export function buktiBaru(list: BuktiTugas[]): BuktiTugas | null {
  const s = slotBebas(new Set(list.map((b) => b.slot)))
  if (!s || list.length >= BATAS_BUKTI_TUGAS) return null
  return { id: idBukti(), slot: s, label: '', petunjuk: '', wajib: true, kategoriIds: [] }
}

/** Bentuk siap simpan ke Firestore (tanpa undefined / label kosong). */
export function sanitasiBuktiList(list: BuktiTugas[] | undefined): BuktiTugas[] {
  return rapikanBuktiList(list ?? [])
}

export function adaBukti(t: Pick<TugasLms, 'buktiList'> | null | undefined): boolean {
  return Array.isArray(t?.buktiList) && t!.buktiList!.length > 0
}

/** Urutan tampil = urutan di daftar guru (slot tidak dipakai sebagai urutan). */
export function namaKategoriBukti(
  bukti: BuktiTugas,
  kategori: KategoriPenilaian[] | undefined,
): string[] {
  if (!bukti.kategoriIds?.length || !kategori?.length) return []
  return bukti.kategoriIds
    .map((id) => kategori.find((k) => k.id === id)?.nama?.trim() ?? '')
    .filter(Boolean)
}

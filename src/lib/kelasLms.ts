import type { AppUser, PenugasanMapel } from '../types/user'

/** Urutan kelas SD (sama dengan SEMUA_KELAS di Penilaian). */
export const DAFTAR_KELAS_SD = [
  '1A', '1B', '1C',
  '2A', '2B', '2C',
  '3A', '3B', '3C',
  '4A', '4B', '4C',
  '5A', '5B', '5C',
  '6A', '6B',
] as const

export type RuangKelas = {
  /** Kunci stabil untuk route: "4A--Matematika" */
  id: string
  kelas: string
  mapel: string
  /** true jika guru juga wali kelas ini */
  sebagaiWali: boolean
}

function slug(kelas: string, mapel: string): string {
  return `${kelas}--${mapel.replace(/\s+/g, '_')}`
}

function parseSlug(id: string): { kelas: string; mapel: string } | null {
  const i = id.indexOf('--')
  if (i <= 0) return null
  const kelas = id.slice(0, i)
  const mapel = id.slice(i + 2).replace(/_/g, ' ')
  if (!kelas || !mapel) return null
  return { kelas, mapel }
}

export function parseRuangId(id: string) {
  return parseSlug(id)
}

export function buatRuangId(kelas: string, mapel: string): string {
  return slug(kelas, mapel)
}

function urutRuang(list: RuangKelas[]): RuangKelas[] {
  return [...list].sort((a, b) => {
    const ia = DAFTAR_KELAS_SD.indexOf(a.kelas as (typeof DAFTAR_KELAS_SD)[number])
    const ib = DAFTAR_KELAS_SD.indexOf(b.kelas as (typeof DAFTAR_KELAS_SD)[number])
    if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.mapel.localeCompare(b.mapel, 'id')
  })
}

function penugasanDariProfil(profil: AppUser): PenugasanMapel[] {
  const penugasan: PenugasanMapel[] = Array.isArray(profil.penugasan)
    ? profil.penugasan.filter((p) => p && typeof p.kelas === 'string' && typeof p.mapel === 'string')
    : []

  if (penugasan.length === 0 && Array.isArray(profil.penugasanKelasMapel)) {
    for (const key of profil.penugasanKelasMapel) {
      const sep = key.indexOf('::')
      if (sep > 0) {
        penugasan.push({ kelas: key.slice(0, sep), mapel: key.slice(sep + 2) })
      }
    }
  }
  return penugasan
}

/**
 * Daftar ruang kelas (kelas × mapel) dari penugasan saja.
 * Tidak lagi membuat kartu fiktif "Wali kelas" — materi/TP butuh nama mapel sungguhan.
 */
export function daftarRuangKelas(profil: AppUser | null): RuangKelas[] {
  if (!profil) return []

  const waliSet = new Set(profil.waliKelas ?? [])
  const penugasan = penugasanDariProfil(profil)
  const map = new Map<string, RuangKelas>()

  for (const p of penugasan) {
    if (!p.mapel || p.mapel === 'Wali kelas') continue
    const id = slug(p.kelas, p.mapel)
    if (map.has(id)) continue
    map.set(id, {
      id,
      kelas: p.kelas,
      mapel: p.mapel,
      sebagaiWali: waliSet.has(p.kelas),
    })
  }

  return urutRuang([...map.values()])
}

/**
 * Kelas yang diwalikan tetapi belum punya satu pun kartu mapel dari penugasan.
 * Dipakai UI untuk menawarkan pilih mapel dari master `mapel`.
 */
export function kelasWaliTanpaMapel(profil: AppUser | null): string[] {
  if (!profil?.waliKelas?.length) return []
  const ruang = daftarRuangKelas(profil)
  const kelasDenganMapel = new Set(ruang.map((r) => r.kelas))
  return [...new Set(profil.waliKelas)].filter((k) => !kelasDenganMapel.has(k)).sort((a, b) => {
    const ia = DAFTAR_KELAS_SD.indexOf(a as (typeof DAFTAR_KELAS_SD)[number])
    const ib = DAFTAR_KELAS_SD.indexOf(b as (typeof DAFTAR_KELAS_SD)[number])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

/**
 * Perluas daftar: untuk setiap kelas wali tanpa penugasan mapel,
 * tambahkan satu kartu per mapel dari master (agar wali bisa kelola semua mapel di kelasnya).
 */
export function perluasDenganMapelMaster(
  profil: AppUser | null,
  daftarMapel: string[],
): RuangKelas[] {
  const dasar = daftarRuangKelas(profil)
  if (!profil) return dasar

  const waliKosong = kelasWaliTanpaMapel(profil)
  if (!waliKosong.length || !daftarMapel.length) return dasar

  const map = new Map(dasar.map((r) => [r.id, r]))
  for (const kelas of waliKosong) {
    for (const mapel of daftarMapel) {
      if (!mapel || mapel === 'Wali kelas') continue
      const id = slug(kelas, mapel)
      if (map.has(id)) continue
      map.set(id, { id, kelas, mapel, sebagaiWali: true })
    }
  }
  return urutRuang([...map.values()])
}

/** Digit tingkatan dari kode rombel, mis. "5A" → "5", "6B" → "6". */
export function tingkatanKelas(kelas: string): string {
  const m = String(kelas || '')
    .trim()
    .toUpperCase()
    .match(/^(\d+)/)
  return m ? m[1] : ''
}

/** Semua rombel se-tingkat di DAFTAR_KELAS_SD, tanpa kelas sendiri. */
export function kelasParalelSamaTingkat(kelas: string): string[] {
  const k = String(kelas || '').trim().toUpperCase()
  const t = tingkatanKelas(k)
  if (!t) return []
  return DAFTAR_KELAS_SD.filter((x) => x !== k && tingkatanKelas(x) === t)
}

/**
 * Pastikan kelas utama selalu ada di list, unik, huruf besar, max 12.
 * Dipakai saat create & atur berbagi.
 */
export function normalisasiKelasList(kelasUtama: string, list?: string[] | null): string[] {
  const utama = String(kelasUtama || '').trim().toUpperCase()
  const set = new Set<string>()
  if (utama) set.add(utama)
  for (const x of list || []) {
    const u = String(x || '').trim().toUpperCase()
    if (u) set.add(u)
  }
  return [...set].slice(0, 12)
}

/** Apakah tujuan boleh menjadi target share dari asal (se-tingkat, beda rombel). */
export function bolehShareKe(asal: string, tujuan: string): boolean {
  const a = String(asal || '').trim().toUpperCase()
  const t = String(tujuan || '').trim().toUpperCase()
  if (!a || !t || a === t) return false
  return tingkatanKelas(a) === tingkatanKelas(t) && tingkatanKelas(a) !== ''
}

/**
 * Kelas paralel se-tingkat yang guru ampu untuk mapel tertentu.
 * Sumber: penugasan / penugasanKelasMapel / waliKelas (wali = semua mapel di kelasnya).
 * Hanya kelas yang diampu — tidak menampilkan 5C jika guru hanya ampu 5A & 5B.
 */
export function kelasBolehShare(
  profil: AppUser | null,
  kelasUtama: string,
  mapel: string,
): string[] {
  if (!profil) return []
  const utama = String(kelasUtama || '').trim().toUpperCase()
  const mapelN = String(mapel || '').trim()
  if (!utama || !mapelN) return []

  const paralel = kelasParalelSamaTingkat(utama)
  if (paralel.length === 0) return []

  const wali = new Set((profil.waliKelas || []).map((k) => String(k).toUpperCase()))
  const ampu = new Set<string>()

  for (const p of penugasanDariProfil(profil)) {
    if (String(p.mapel || '').trim() === mapelN) {
      ampu.add(String(p.kelas).toUpperCase())
    }
  }
  // Wali boleh semua mapel di kelas yang diwalikan
  for (const k of wali) ampu.add(k)

  return paralel.filter((k) => ampu.has(k))
}

/** Label singkat untuk chip UI, mis. "5B, 5C". */
export function labelKelasDibagikan(kelasUtama: string, kelasList?: string[] | null): string {
  const utama = String(kelasUtama || '').toUpperCase()
  const lain = (kelasList || [])
    .map((k) => String(k).toUpperCase())
    .filter((k) => k && k !== utama)
  return lain.join(', ')
}

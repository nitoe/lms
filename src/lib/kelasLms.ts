import type { AppUser, PenugasanMapel } from '../types/user'

/** Urutan kelas SD (sama dengan SEMUA_KELAS di Penilaian). */
export const DAFTAR_KELAS_SD = [
  '1A', '1B', '1C',
  '2A', '2B', '2C',
  '3A', '3B', '3C',
  '4A', '4B', '4C',
  '5A', '5B', '5C',
  '6A', '6B', '6C',
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

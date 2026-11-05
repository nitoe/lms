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

/**
 * Daftar ruang kelas (kelas × mapel) yang diampu guru.
 * - Dari penugasan mapel
 * - Wali kelas tanpa penugasan mapel spesifik tetap muncul sebagai "Wali kelas" (mapel khusus)
 * Admin tanpa penugasan: daftar kosong (bisa diperluas nanti).
 */
export function daftarRuangKelas(profil: AppUser | null): RuangKelas[] {
  if (!profil) return []

  const waliSet = new Set(profil.waliKelas ?? [])
  const penugasan: PenugasanMapel[] = Array.isArray(profil.penugasan)
    ? profil.penugasan.filter((p) => p && typeof p.kelas === 'string' && typeof p.mapel === 'string')
    : []

  // Fallback: bangun dari penugasanKelasMapel jika penugasan array kosong
  if (penugasan.length === 0 && Array.isArray(profil.penugasanKelasMapel)) {
    for (const key of profil.penugasanKelasMapel) {
      const sep = key.indexOf('::')
      if (sep > 0) {
        penugasan.push({ kelas: key.slice(0, sep), mapel: key.slice(sep + 2) })
      }
    }
  }

  const map = new Map<string, RuangKelas>()

  for (const p of penugasan) {
    const id = slug(p.kelas, p.mapel)
    if (map.has(id)) continue
    map.set(id, {
      id,
      kelas: p.kelas,
      mapel: p.mapel,
      sebagaiWali: waliSet.has(p.kelas),
    })
  }

  // Wali kelas yang belum punya kartu mapel: tampilkan kartu "Wali kelas"
  for (const k of waliSet) {
    const sudahAda = [...map.values()].some((r) => r.kelas === k)
    if (!sudahAda) {
      const id = slug(k, 'Wali kelas')
      map.set(id, { id, kelas: k, mapel: 'Wali kelas', sebagaiWali: true })
    }
  }

  const list = [...map.values()]
  list.sort((a, b) => {
    const ia = DAFTAR_KELAS_SD.indexOf(a.kelas as (typeof DAFTAR_KELAS_SD)[number])
    const ib = DAFTAR_KELAS_SD.indexOf(b.kelas as (typeof DAFTAR_KELAS_SD)[number])
    if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.mapel.localeCompare(b.mapel, 'id')
  })
  return list
}

import type { AppUser } from '../types/user'
import { DAFTAR_KELAS_SD, daftarRuangKelas } from './kelasLms'

/**
 * Cakupan kelas & mapel yang boleh dipilih guru saat menyusun tugas.
 * Meniru `tulisMapelKelas` di firestore.rules:
 *  - Guru kelas (wali kelas): semua mapel di kelas yang diwalikan.
 *  - Guru bidang studi: hanya pasangan kelas×mapel dari penugasannya.
 *  - Satu guru bisa keduanya (wali di satu kelas, pengampu mapel di kelas lain): dihitung per kelas.
 *  - Admin: tanpa batas.
 */
export type CakupanTugas = {
  /** Kelas yang boleh dipilih, berurutan menurut kelas SD. */
  kelas: string[]
  /** Mapel yang boleh dipilih pada sebuah kelas, urut A–Z. */
  mapelUntuk: (kelas: string) => string[]
  /** true = tanpa batasan (admin). */
  bebas: boolean
  /** true = akun bukan admin dan tidak punya satu pun kelas/penugasan. */
  kosong: boolean
}

function urutKelas(list: Iterable<string>): string[] {
  const idx = (k: string) => {
    const i = DAFTAR_KELAS_SD.indexOf(k as (typeof DAFTAR_KELAS_SD)[number])
    return i === -1 ? 99 : i
  }
  return [...new Set(list)].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b, 'id', { numeric: true }))
}

function bersihMapel(list: Iterable<string>): string[] {
  return [...new Set([...list].filter((m) => m && m !== 'Wali kelas'))].sort((a, b) =>
    a.localeCompare(b, 'id'),
  )
}

export function cakupanTugas(profil: AppUser | null, masterMapel: string[]): CakupanTugas {
  const ruang = daftarRuangKelas(profil)
  const admin = profil?.role === 'admin' || profil?.peranLms === 'admin'

  if (admin) {
    const semua = bersihMapel([...masterMapel, ...ruang.map((r) => r.mapel)])
    return {
      kelas: [...DAFTAR_KELAS_SD],
      mapelUntuk: () => semua,
      bebas: true,
      kosong: false,
    }
  }

  const wali = new Set((profil?.waliKelas ?? []).filter(Boolean))
  const kelas = urutKelas([...wali, ...ruang.map((r) => r.kelas)])

  return {
    kelas,
    mapelUntuk: (k: string) => {
      const dariPenugasan = ruang.filter((r) => r.kelas === k).map((r) => r.mapel)
      return bersihMapel(wali.has(k) ? [...dariPenugasan, ...masterMapel] : dariPenugasan)
    },
    bebas: false,
    kosong: kelas.length === 0,
  }
}

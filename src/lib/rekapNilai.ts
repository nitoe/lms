/**
 * Lib Rekap Nilai — utilitas fondasi (Tahap 1).
 * Agregasi tugas/kuis + simpan bobot menyusul di tahap berikutnya.
 */
import type { AppUser } from '../types/user'
import { daftarRuangKelas } from './kelasLms'

/** Pasangan kelas×mapel yang diampu guru (dari penugasan). */
export function daftarMapelKelasGuru(profil: AppUser | null | undefined): {
  kelas: string
  mapel: string
}[] {
  const ruang = daftarRuangKelas(profil ?? null)
  const seen = new Set<string>()
  const out: { kelas: string; mapel: string }[] = []
  for (const r of ruang) {
    const k = `${r.kelas}::${r.mapel}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ kelas: r.kelas, mapel: r.mapel })
  }
  out.sort((a, b) => {
    const ck = a.kelas.localeCompare(b.kelas, 'id')
    if (ck !== 0) return ck
    return a.mapel.localeCompare(b.mapel, 'id')
  })
  return out
}

/** ID dokumen bobot SLM (stabil, aman untuk path Firestore). */
export function idBobotSlm(kelas: string, mapel: string, tpId: string): string {
  const mapelSlug = mapel.trim().replace(/\s+/g, '_').replace(/[\/\\#?[\]]/g, '-')
  return `${kelas.toUpperCase()}__${mapelSlug}__${tpId}`
}

/**
 * Hitung nilai akhir berbobot dari map skor + daftar bobot.
 * Skor null/undefined diabaikan; jika tidak ada skor valid → null.
 */
export function hitungNilaiBerbobot(
  perSumber: Record<string, number | null | undefined>,
  sumber: { id: string; bobot: number }[],
): number | null {
  let sum = 0
  let totalBobot = 0
  for (const s of sumber) {
    const v = perSumber[s.id]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    const b = typeof s.bobot === 'number' && s.bobot > 0 ? s.bobot : 1
    sum += v * b
    totalBobot += b
  }
  if (totalBobot <= 0) return null
  return Math.round((sum / totalBobot) * 10) / 10
}

import type { MateriLms } from '../types/materi'

/** Label jenis materi untuk chip. */
export function labelJenis(jenis: string): string {
  switch (jenis) {
    case 'pdf':
      return 'PDF'
    case 'gambar':
      return 'Gambar'
    case 'video':
      return 'Video'
    case 'youtube':
      return 'YouTube'
    case 'halaman':
      return 'Materi halaman'
    default:
      return 'Tautan'
  }
}

/** Kelas warna kotak ikon (didefinisikan `.materi-tone--*` di index.css). */
export function toneJenis(jenis: string): string {
  switch (jenis) {
    case 'pdf':
      return 'materi-tone--pdf'
    case 'gambar':
      return 'materi-tone--img'
    case 'video':
      return 'materi-tone--vid'
    case 'youtube':
      return 'materi-tone--yt'
    case 'halaman':
      return 'materi-tone--hal'
    default:
      return 'materi-tone--url'
  }
}

export function formatUkuran(n?: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export type KelompokMateri = { key: string; label: string; urut: number; items: MateriLms[] }

/**
 * Kelompokkan materi per TP (atau bab, atau «Lainnya»).
 * TP diurutkan menurut NOMOR secara numerik (bukan label teks) agar «TP 2» tampil sebelum «TP 10»
 * (lihat ANTIREGRESI §11).
 */
export function kelompokkanMateri(list: MateriLms[]): KelompokMateri[] {
  const map = new Map<string, KelompokMateri>()
  for (const m of list) {
    let key = 'lain'
    let label = 'Lainnya'
    let urut = Number.MAX_SAFE_INTEGER
    if (m.tpId && m.tpNama) {
      key = `tp:${m.tpId}`
      label = m.tpNomor ? `TP ${m.tpNomor}. ${m.tpNama}` : m.tpNama
      urut = typeof m.tpNomor === 'number' ? m.tpNomor : 100000
    } else if (m.bab) {
      key = `bab:${m.bab}`
      label = m.bab
      urut = 200000
    }
    const g = map.get(key) ?? { key, label, urut, items: [] }
    g.items.push(m)
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) =>
    a.urut !== b.urut ? a.urut - b.urut : a.label.localeCompare(b.label, 'id', { numeric: true }),
  )
}

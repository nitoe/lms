import { useCallback, useEffect, useRef, useState } from 'react'
import { daftarKuis } from './kuis'
import { daftarTugasGuru } from './tugas'
import { infoTenggat, tenggatKeDate } from './tugasUi'
import type { KuisLms } from '../types/kuis'
import type { TugasLms } from '../types/tugas'

/**
 * Ringkasan tugas & kuis AKTIF per ruang kelas (dipakai Beranda, Daftar Kelas, Detail Kelas).
 * Logika dipindah dari KelasList agar ketiga halaman memakai sumber yang sama.
 */

export type RingkasRuang = {
  tugasAktif: number
  kuisAktif: number
}

export type ItemAktif = {
  id: string
  jenis: 'tugas' | 'kuis'
  judul: string
  kelas: string
  mapel: string
  /** Tenggat mentah (hanya tugas); null bila tanpa tenggat / kuis. */
  tenggat: unknown
  /** Kuis: «Online» / «Offline». Tugas: kosong. */
  mode: string
  href: string
}

export function kunciRuang(kelas: string, mapel: string): string {
  return `${String(kelas).toUpperCase()}::${mapel}`
}

type RuangMin = { kelas: string; mapel: string }

export async function muatRingkasanRuang(
  ruang: RuangMin[],
  sebagaiAdmin: boolean,
): Promise<{ ringkas: Record<string, RingkasRuang>; aktif: ItemAktif[] }> {
  if (!ruang.length) return { ringkas: {}, aktif: [] }

  const tugasList = await daftarTugasGuru(ruang, { sebagaiAdmin }).catch((e) => {
    console.warn('monitor tugas', e)
    return [] as TugasLms[]
  })

  // Kuis per pasangan unik (paralel, toleran gagal)
  const pasangan = new Map<string, RuangMin>()
  for (const r of ruang) {
    const k = kunciRuang(r.kelas, r.mapel)
    if (!pasangan.has(k)) pasangan.set(k, { kelas: r.kelas, mapel: r.mapel })
  }
  const kuisPerPasangan = await Promise.all(
    [...pasangan.values()].map(async ({ kelas, mapel }) => {
      try {
        const list = await daftarKuis(kelas, mapel)
        return { kelas, mapel, list }
      } catch (e) {
        console.warn('monitor kuis', kelas, mapel, e)
        return { kelas, mapel, list: [] as KuisLms[] }
      }
    }),
  )

  const ringkas: Record<string, RingkasRuang> = {}
  for (const r of ruang) ringkas[kunciRuang(r.kelas, r.mapel)] = { tugasAktif: 0, kuisAktif: 0 }

  const aktif: ItemAktif[] = []

  for (const t of tugasList) {
    if (!t.aktif) continue
    const k = kunciRuang(t.kelas, t.mapel)
    if (!ringkas[k]) ringkas[k] = { tugasAktif: 0, kuisAktif: 0 }
    ringkas[k].tugasAktif += 1
    aktif.push({
      id: `tugas:${t.id}`,
      jenis: 'tugas',
      judul: t.judul,
      kelas: t.kelas,
      mapel: t.mapel,
      tenggat: t.tenggat ?? null,
      mode: '',
      href: `/tugas/${t.id}`,
    })
  }

  for (const { kelas, mapel, list } of kuisPerPasangan) {
    const k = kunciRuang(kelas, mapel)
    if (!ringkas[k]) ringkas[k] = { tugasAktif: 0, kuisAktif: 0 }
    for (const qz of list) {
      if (!qz.aktif) continue
      ringkas[k].kuisAktif += 1
      aktif.push({
        id: `kuis:${qz.id}`,
        jenis: 'kuis',
        judul: qz.judul,
        kelas: qz.kelas,
        mapel: qz.mapel,
        tenggat: null,
        mode: qz.modePelaksanaan === 'offline' ? 'Offline' : 'Online',
        href: `/kelas/${encodeURIComponent(`${String(kelas).toUpperCase()}--${mapel.replace(/\s+/g, '_')}`)}?tab=kuis`,
      })
    }
  }

  return { ringkas, aktif }
}

/**
 * Urutan agenda: tugas bertenggat yang akan datang (terdekat dulu) → tugas sudah lewat
 * (terbaru dulu) → tugas tanpa tenggat → kuis. Selaras urutan «Tenggat terdekat» di katalog Tugas.
 */
export function urutkanAgenda(items: ItemAktif[], sekarang: Date = new Date()): ItemAktif[] {
  const now = sekarang.getTime()
  const rank = (i: ItemAktif): number => {
    if (i.jenis === 'kuis') return 3
    const d = tenggatKeDate(i.tenggat)
    if (!d) return 2
    return d.getTime() >= now ? 0 : 1
  }
  return [...items].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    const da = tenggatKeDate(a.tenggat)?.getTime() ?? 0
    const db = tenggatKeDate(b.tenggat)?.getTime() ?? 0
    if (ra === 0 && da !== db) return da - db
    if (ra === 1 && da !== db) return db - da
    const c = a.kelas.localeCompare(b.kelas, 'id', { numeric: true })
    return c !== 0 ? c : a.mapel.localeCompare(b.mapel, 'id')
  })
}

/** Jumlah tugas aktif dengan tenggat hari ini / ≤ 3 hari lagi. */
export function hitungSegera(items: ItemAktif[], sekarang: Date = new Date()): number {
  let n = 0
  for (const i of items) {
    if (i.jenis !== 'tugas') continue
    const nada = infoTenggat(i.tenggat, sekarang).nada
    if (nada === 'hariini' || nada === 'segera') n += 1
  }
  return n
}

export type StateRingkasan = {
  ringkas: Record<string, RingkasRuang>
  /** null = belum pernah selesai dimuat. */
  aktif: ItemAktif[] | null
  memuat: boolean
  error: string
  muat: () => Promise<void>
}

/** Hook pemuat ringkasan; aman terhadap balapan (hanya hasil permintaan terbaru yang dipakai). */
export function useRingkasanRuang(ruang: RuangMin[], sebagaiAdmin: boolean): StateRingkasan {
  const [ringkas, setRingkas] = useState<Record<string, RingkasRuang>>({})
  const [aktif, setAktif] = useState<ItemAktif[] | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [error, setError] = useState('')
  const reqRef = useRef(0)

  const muat = useCallback(async () => {
    const id = ++reqRef.current
    if (!ruang.length) {
      setRingkas({})
      setAktif([])
      setMemuat(false)
      return
    }
    setMemuat(true)
    setError('')
    try {
      const hasil = await muatRingkasanRuang(ruang, sebagaiAdmin)
      if (id !== reqRef.current) return
      setRingkas(hasil.ringkas)
      setAktif(hasil.aktif)
    } catch (e) {
      if (id !== reqRef.current) return
      setError(e instanceof Error ? e.message : 'Gagal memuat ringkasan tugas/kuis.')
      setAktif([])
    } finally {
      if (id === reqRef.current) setMemuat(false)
    }
  }, [ruang, sebagaiAdmin])

  useEffect(() => {
    void muat()
  }, [muat])

  return { ringkas, aktif, memuat, error, muat }
}

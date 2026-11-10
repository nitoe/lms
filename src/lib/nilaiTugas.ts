import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { muatSiswaKelas, type SiswaDasar } from './siswaAuth'
import type { KategoriPenilaian } from '../types/tugas'
import { predikatDariNilai, RENTANG_PREDIKAT_DEFAULT } from './penilaianTugas'

/** Dokumen `lms_nilai_tugas/{tugasId_siswaId}`. */
export type NilaiTugasDok = {
  id: string
  tugasId: string
  siswaId: string
  siswaNama: string
  kelas: string
  mapel: string
  /** Skor per kategori rubrik: kategoriId → 0–100 */
  nilaiPerKategori?: Record<string, number>
  /** Rata-rata (atau berbobot) dari nilaiPerKategori */
  nilaiRataRata?: number
  /** Nilai akhir yang dipakai (biasanya = rata-rata, bisa disesuaikan) */
  nilai: number
  predikat?: string
  komentar?: string
  dinilaiOleh: string
  dinilaiOlehNama?: string
  updatedAt?: unknown
  createdAt?: unknown
}

export type BarisNilaiTugas = {
  siswaId: string
  siswaNama: string
  /** skor per kategoriId */
  perKategori: Record<string, number | null>
  rataRata: number | null
  nilaiAkhir: number | null
  predikat: string
  komentar: string
  sudahAda: boolean
}

function idNilai(tugasId: string, siswaId: string): string {
  return `${tugasId}_${siswaId}`
}

function koleksi() {
  return collection(db, 'lms_nilai_tugas')
}

/** Hitung rata-rata dari map skor; dukung bobot kategori. */
export function hitungRataRata(
  perKat: Record<string, number | null | undefined>,
  kategori: KategoriPenilaian[],
): number | null {
  const items: { skor: number; bobot: number }[] = []
  for (const k of kategori) {
    const v = perKat[k.id]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    const bobot = typeof k.bobot === 'number' && k.bobot > 0 ? k.bobot : 1
    items.push({ skor: v, bobot })
  }
  if (!items.length) return null
  const totalBobot = items.reduce((s, x) => s + x.bobot, 0)
  if (totalBobot <= 0) return null
  const sum = items.reduce((s, x) => s + x.skor * x.bobot, 0)
  return Math.round((sum / totalBobot) * 10) / 10
}

export async function daftarNilaiTugas(
  tugasId: string,
  kelas: string,
  mapel: string,
): Promise<NilaiTugasDok[]> {
  const q = query(
    koleksi(),
    where('tugasId', '==', tugasId),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    const rawKat = data.nilaiPerKategori
    const nilaiPerKategori: Record<string, number> | undefined =
      rawKat && typeof rawKat === 'object' && !Array.isArray(rawKat)
        ? Object.fromEntries(
            Object.entries(rawKat as Record<string, unknown>)
              .filter(([, v]) => typeof v === 'number')
              .map(([k, v]) => [k, v as number]),
          )
        : undefined
    return {
      id: d.id,
      tugasId: String(data.tugasId || ''),
      siswaId: String(data.siswaId || ''),
      siswaNama: String(data.siswaNama || ''),
      kelas: String(data.kelas || ''),
      mapel: String(data.mapel || ''),
      nilaiPerKategori,
      nilaiRataRata: typeof data.nilaiRataRata === 'number' ? data.nilaiRataRata : undefined,
      nilai: typeof data.nilai === 'number' ? data.nilai : 0,
      predikat: typeof data.predikat === 'string' ? data.predikat : undefined,
      komentar: typeof data.komentar === 'string' ? data.komentar : undefined,
      dinilaiOleh: String(data.dinilaiOleh || ''),
      dinilaiOlehNama:
        typeof data.dinilaiOlehNama === 'string' ? data.dinilaiOlehNama : undefined,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
    }
  })
}

export async function muatBarisNilaiTugas(
  tugasId: string,
  kelas: string,
  mapel: string,
  kategori: KategoriPenilaian[],
): Promise<BarisNilaiTugas[]> {
  const kelasU = String(kelas).toUpperCase()
  // Roster siswa dulu; nilai opsional agar permission error nilai tidak menutup seluruh tabel.
  const siswa = await muatSiswaKelas(kelasU)
  let nilaiList: NilaiTugasDok[] = []
  try {
    nilaiList = await daftarNilaiTugas(tugasId, kelasU, mapel)
  } catch (e) {
    console.warn('daftarNilaiTugas gagal (rules/jaringan):', e)
    nilaiList = []
  }
  const mapNilai = new Map(nilaiList.map((n) => [n.siswaId, n]))

  function keBaris(s: { id: string; nama: string }, n?: NilaiTugasDok): BarisNilaiTugas {
    const perKategori: Record<string, number | null> = {}
    for (const k of kategori) {
      const v = n?.nilaiPerKategori?.[k.id]
      perKategori[k.id] = typeof v === 'number' ? v : null
    }
    // Jika tidak ada kategori, pakai nilai akhir lama
    let rata = hitungRataRata(perKategori, kategori)
    if (rata === null && n && typeof n.nilai === 'number' && kategori.length === 0) {
      rata = n.nilai
    }
    const nilaiAkhir =
      n && typeof n.nilai === 'number'
        ? n.nilai
        : rata
    return {
      siswaId: s.id,
      siswaNama: s.nama,
      perKategori,
      rataRata: rata,
      nilaiAkhir: nilaiAkhir ?? null,
      predikat: n?.predikat || '',
      komentar: n?.komentar || '',
      sudahAda: !!n,
    }
  }

  const rows: BarisNilaiTugas[] = siswa.map((s: SiswaDasar) => keBaris(s, mapNilai.get(s.id)))
  for (const n of nilaiList) {
    if (rows.some((r) => r.siswaId === n.siswaId)) continue
    rows.push(keBaris({ id: n.siswaId, nama: n.siswaNama + ' (tidak di roster)' }, n))
  }
  rows.sort((a, b) => a.siswaNama.localeCompare(b.siswaNama, 'id'))
  return rows
}

export async function simpanNilaiTugas(input: {
  tugasId: string
  siswaId: string
  siswaNama: string
  kelas: string
  mapel: string
  nilaiPerKategori?: Record<string, number>
  nilaiRataRata?: number | null
  nilai: number
  predikat?: string
  komentar?: string
  namaGuru?: string
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  if (!input.tugasId || !input.siswaId) throw new Error('Data tugas/siswa tidak lengkap.')
  if (typeof input.nilai !== 'number' || Number.isNaN(input.nilai)) {
    throw new Error('Nilai harus berupa angka.')
  }
  if (input.nilai < 0 || input.nilai > 100) {
    throw new Error('Nilai di luar rentang yang diizinkan (0–100).')
  }

  const id = idNilai(input.tugasId, input.siswaId)
  const ref = doc(db, 'lms_nilai_tugas', id)
  const payload: Record<string, unknown> = {
    tugasId: input.tugasId,
    siswaId: input.siswaId,
    siswaNama: input.siswaNama.trim() || '—',
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel.trim(),
    nilai: input.nilai,
    dinilaiOleh: uid,
    dinilaiOlehNama: input.namaGuru || '',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }
  // Hanya kirim field opsional yang ada nilainya (hindari null di create yang ditolak rules lama)
  if (input.nilaiPerKategori && Object.keys(input.nilaiPerKategori).length) {
    payload.nilaiPerKategori = input.nilaiPerKategori
  }
  if (typeof input.nilaiRataRata === 'number') {
    payload.nilaiRataRata = input.nilaiRataRata
  }
  if (input.predikat?.trim()) {
    payload.predikat = input.predikat.trim()
  }
  if (input.komentar?.trim()) {
    payload.komentar = input.komentar.trim()
  }

  await setDoc(ref, payload, { merge: true })
}

/** Predikat dari nilai akhir (helper UI). */
export function predikatOtomatis(
  nilai: number | null,
  rentang = RENTANG_PREDIKAT_DEFAULT,
): string {
  if (nilai === null || nilai === undefined) return ''
  return predikatDariNilai(nilai, rentang)?.predikat || ''
}

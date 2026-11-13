import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { htmlKosong, teksPolos } from './html'
import type { KompleksitasSoal, OpsiSoal, PaketSoal, Soal, TipeSoal } from '../types/soal'
import { BATAS_SOAL_PER_PAKET, normalisasiKompleksitas } from '../types/soal'
import { adalahMapelTka, KELAS_TKA_BANK } from './tkaAkses'

export function idAcak(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function opsiKosong(n: number): OpsiSoal[] {
  return Array.from({ length: n }, () => ({ id: idAcak(), teks: '' }))
}

/** Soal baru dengan nilai awal yang masuk akal untuk tiap tipe. */
export function soalBaru(tipe: TipeSoal): Soal {
  const dasar = { id: idAcak(), teks: '', poin: 1, waktuMenit: 1, kompleksitas: 'L1' as const }
  switch (tipe) {
    case 'pg': {
      const opsi = opsiKosong(4)
      return { ...dasar, tipe, opsi, kunci: opsi[0].id, acakOpsi: true, opsiGambar: false }
    }
    case 'pgk': {
      const opsi = opsiKosong(4)
      return { ...dasar, tipe, opsi, kunci: [], acakOpsi: true, opsiGambar: false, nilaiParsial: false }
    }
    case 'jodoh':
      return {
        ...dasar,
        tipe,
        pasangan: [1, 2, 3].map(() => ({ id: idAcak(), kiri: '', kanan: '' })),
        nilaiParsial: true,
      }
    case 'bs':
      return {
        ...dasar,
        tipe,
        pernyataan: [1, 2, 3].map(() => ({ id: idAcak(), teks: '', benar: true })),
        nilaiParsial: true,
      }
    case 'isian':
      return { ...dasar, tipe, kunci: [''], abaikanKapital: true }
    case 'uraian':
      return { ...dasar, tipe, poin: 5, waktuMenit: 3 }
  }
}

/** Ganti tipe tanpa kehilangan teks, gambar, poin, waktu, pembahasan, dan (bila bisa) opsi. */
export function ubahTipe(s: Soal, tipe: TipeSoal): Soal {
  if (s.tipe === tipe) return s
  const baru = soalBaru(tipe)
  // WAJIB pertahankan id — kunci React di editor & aktifId mengandalkan id yang stabil.
  const dasar = {
    id: s.id,
    teks: s.teks,
    gambarId: s.gambarId,
    poin: s.poin,
    waktuMenit: s.waktuMenit,
    kompleksitas: normalisasiKompleksitas((s as { kompleksitas?: unknown }).kompleksitas),
    pembahasan: s.pembahasan,
    // Field soal TKA ikut terbawa saat tipe diganti (ANTIREGRESI §84). Hanya bila ada,
    // agar tidak menulis `undefined` ke Firestore.
    ...(s.stimulus ? { stimulus: s.stimulus } : {}),
    ...(s.tipeMateri ? { tipeMateri: s.tipeMateri } : {}),
    ...(s.rumus ? { rumus: true } : {}),
  }
  if ((s.tipe === 'pg' || s.tipe === 'pgk') && (tipe === 'pg' || tipe === 'pgk')) {
    const opsi = Array.isArray(s.opsi) && s.opsi.length >= 2 ? s.opsi : baru.tipe === 'pg' || baru.tipe === 'pgk' ? (baru as { opsi: typeof s.opsi }).opsi : s.opsi
    const kunciLama = s.tipe === 'pg'
      ? [typeof s.kunci === 'string' ? s.kunci : '']
      : (Array.isArray(s.kunci) ? s.kunci : [])
    if (tipe === 'pg') {
      return {
        ...baru, ...dasar, tipe: 'pg',
        opsi: opsi as Extract<Soal, { tipe: 'pg' }>['opsi'],
        kunci: kunciLama[0] || (Array.isArray(opsi) ? opsi[0]?.id : '') || '',
        acakOpsi: !!s.acakOpsi,
        opsiGambar: !!s.opsiGambar,
      }
    }
    return {
      ...baru, ...dasar, tipe: 'pgk',
      opsi: opsi as Extract<Soal, { tipe: 'pgk' }>['opsi'],
      kunci: kunciLama.filter(Boolean),
      acakOpsi: !!s.acakOpsi,
      opsiGambar: !!s.opsiGambar,
      nilaiParsial: false,
    }
  }
  return { ...baru, ...dasar } as Soal
}

export function salinSoal(s: Soal): Soal {
  const salin = JSON.parse(JSON.stringify(s)) as Soal
  salin.id = idAcak()
  // ID opsi/pasangan/pernyataan harus unik per soal; ganti dan petakan ulang kunci.
  if (salin.tipe === 'pg' || salin.tipe === 'pgk') {
    const peta = new Map<string, string>()
    salin.opsi = salin.opsi.map((o) => {
      const id = idAcak()
      peta.set(o.id, id)
      return { ...o, id }
    })
    if (salin.tipe === 'pg') salin.kunci = peta.get(salin.kunci) ?? salin.opsi[0]?.id ?? ''
    else salin.kunci = salin.kunci.map((k) => peta.get(k)).filter((k): k is string => !!k)
  } else if (salin.tipe === 'jodoh') {
    salin.pasangan = salin.pasangan.map((p) => ({ ...p, id: idAcak() }))
  } else if (salin.tipe === 'bs') {
    salin.pernyataan = salin.pernyataan.map((p) => ({ ...p, id: idAcak() }))
  }
  return salin
}

/** Daftar masalah yang menghalangi soal dipakai siswa. Kosong = siap. */
export function masalahSoal(s: Soal): string[] {
  const m: string[] = []
  if (htmlKosong(s.teks) && !s.gambarId) m.push('Teks soal masih kosong.')
  if (!(s.poin > 0)) m.push('Poin harus lebih dari 0.')
  switch (s.tipe) {
    case 'pg':
    case 'pgk': {
      const opsi = Array.isArray(s.opsi) ? s.opsi : []
      const isi = opsi.filter((o) => (o.teks ?? '').trim() || o.gambarId)
      if (isi.length < 2) m.push('Minimal 2 pilihan jawaban terisi.')
      if (opsi.length !== isi.length) m.push('Ada pilihan jawaban yang kosong.')
      if (s.tipe === 'pg' && !opsi.some((o) => o.id === s.kunci)) m.push('Pilih satu jawaban yang benar.')
      if (s.tipe === 'pgk') {
        const kunci = Array.isArray(s.kunci) ? s.kunci : []
        if (kunci.length < 1) m.push('Pilih minimal satu jawaban yang benar.')
        if (opsi.length > 0 && kunci.length === opsi.length) m.push('Semua pilihan ditandai benar — periksa lagi.')
      }
      break
    }
    case 'jodoh': {
      const pasangan = Array.isArray(s.pasangan) ? s.pasangan : []
      if (pasangan.length < 2) m.push('Minimal 2 pasangan.')
      if (pasangan.some((p) => (!(p.kiri ?? '').trim() && !p.kiriGambarId) || !(p.kanan ?? '').trim())) {
        m.push('Ada pasangan yang belum lengkap.')
      }
      break
    }
    case 'bs': {
      const pernyataan = Array.isArray(s.pernyataan) ? s.pernyataan : []
      if (pernyataan.length < 1) m.push('Minimal 1 pernyataan.')
      if (pernyataan.some((p) => !(p.teks ?? '').trim())) m.push('Ada pernyataan yang kosong.')
      break
    }
    case 'isian': {
      const kunci = Array.isArray(s.kunci) ? s.kunci : []
      if (!kunci.some((k) => (k ?? '').trim())) m.push('Isi minimal satu kunci jawaban.')
      break
    }
    case 'uraian':
      break
  }
  return m
}

export function ringkasSoal(s: Soal): string {
  const t = teksPolos(s.teks)
  return t || (s.gambarId ? '(soal bergambar)' : '(belum ada teks)')
}

/** Firestore menolak `undefined`; buang semuanya (ANTIREGRESI §11). */
function bersihkan<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function hitungRingkasan(soal: Soal[]) {
  const jumlahPerTipe: Partial<Record<TipeSoal, number>> = {}
  const jumlahPerKompleksitas: Partial<Record<KompleksitasSoal, number>> = {}
  for (const s of soal) {
    jumlahPerTipe[s.tipe] = (jumlahPerTipe[s.tipe] ?? 0) + 1
    const k = normalisasiKompleksitas(s.kompleksitas)
    jumlahPerKompleksitas[k] = (jumlahPerKompleksitas[k] ?? 0) + 1
  }
  return {
    jumlahSoal: soal.length,
    totalPoin: Math.round(soal.reduce((t, s) => t + (Number(s.poin) || 0), 0) * 100) / 100,
    jumlahPerTipe,
    jumlahPerKompleksitas,
  }
}

/** Perkiraan ukuran dokumen (byte); batas Firestore 1 MiB. */
export function ukuranPerkiraan(p: Pick<PaketSoal, 'soal' | 'judul' | 'deskripsi'>): number {
  return new Blob([JSON.stringify(p)]).size
}
export const BATAS_UKURAN_PAKET = 900_000

const koleksi = () => collection(db, 'lms_paket_soal')

/** Satu query kelas × mapel. Hanya equality — tanpa orderBy agar tidak perlu composite index (ANTIREGRESI §12). */
async function daftarPaketSatuKelas(kelas: string, mapel: string): Promise<PaketSoal[]> {
  const q = query(koleksi(), where('kelas', '==', String(kelas).toUpperCase()), where('mapel', '==', mapel))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaketSoal)
}

/**
 * Daftar paket soal kelas × mapel.
 *
 * Mapel TKA: bank bersama berkas di kelas kanonik «6», tetapi soal hasil migrasi dari tka2026 dapat
 * tersimpan di kelas 6A / 6B. Karena itu mapel TKA SELALU mencari ketiga kelas (6, 6A, 6B) lalu
 * menggabungkannya per id — sama seperti Bank Soal — agar paket yang terlihat di Bank Soal juga
 * terdeteksi di penyusunan kuis (ANTIREGRESI §116). Satu query yang ditolak tidak membatalkan yang lain.
 */
export async function daftarPaket(kelas: string, mapel: string): Promise<PaketSoal[]> {
  const kelasU = String(kelas).toUpperCase()
  const ms = (v: unknown) => (v && typeof (v as { toMillis?: () => number }).toMillis === 'function'
    ? (v as { toMillis: () => number }).toMillis() : 0)

  if (!adalahMapelTka(mapel)) {
    const list = await daftarPaketSatuKelas(kelasU, mapel)
    list.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))
    return list
  }

  const kelasCari = Array.from(new Set([kelasU, KELAS_TKA_BANK, '6A', '6B']))
  const hasil = await Promise.allSettled(kelasCari.map((k) => daftarPaketSatuKelas(k, mapel)))
  const berhasil = hasil.filter((h): h is PromiseFulfilledResult<PaketSoal[]> => h.status === 'fulfilled')
  if (berhasil.length === 0) {
    const gagal = hasil.find((h): h is PromiseRejectedResult => h.status === 'rejected')
    throw gagal?.reason instanceof Error ? gagal.reason : new Error('Gagal memuat paket soal.')
  }
  const peta = new Map<string, PaketSoal>()
  for (const h of berhasil) for (const p of h.value) peta.set(p.id, p)
  const list = [...peta.values()]
  list.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))
  return list
}

/** Ringkasan untuk diagnosis: mengapa tidak ada paket «Siap» yang terdeteksi. */
export type RingkasanPaket = {
  total: number
  siap: number
  draf: number
  /** Berstatus Siap tetapi tidak berisi soal. */
  siapKosong: number
  /** Jumlah paket per kelas penyimpanan (mis. {"6": 3, "6A": 12}). */
  perKelas: Record<string, number>
}

export async function ringkasanPaket(kelas: string, mapel: string): Promise<RingkasanPaket> {
  const semua = await daftarPaket(kelas, mapel)
  const perKelas: Record<string, number> = {}
  let siap = 0
  let draf = 0
  let siapKosong = 0
  for (const p of semua) {
    const k = String(p.kelas || '').toUpperCase() || '?'
    perKelas[k] = (perKelas[k] ?? 0) + 1
    if (p.status === 'siap') {
      if ((p.soal?.length ?? 0) > 0) siap += 1
      else siapKosong += 1
    } else {
      draf += 1
    }
  }
  return { total: semua.length, siap, draf, siapKosong, perKelas }
}

export async function ambilPaket(id: string): Promise<PaketSoal | null> {
  const s = await getDoc(doc(db, 'lms_paket_soal', id))
  return s.exists() ? ({ id: s.id, ...s.data() } as PaketSoal) : null
}

export async function buatPaket(input: {
  kelas: string
  mapel: string
  judul: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  /** Materi TKA tingkat paket — diwariskan ke setiap soal. */
  tipeMateri?: string
  namaGuru?: string
}): Promise<string> {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sesi berakhir. Silakan masuk lagi.')
  const judul = input.judul.trim()
  if (!judul) throw new Error('Judul paket wajib diisi.')
  const awal = soalBaru('pg')
  if (input.tipeMateri) {
    ;(awal as { tipeMateri?: string }).tipeMateri = input.tipeMateri
  }
  const data = bersihkan({
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel,
    judul,
    tpId: input.tpId,
    tpNomor: input.tpNomor,
    tpNama: input.tpNama,
    ...(input.tipeMateri ? { tipeMateri: input.tipeMateri } : {}),
    status: 'draf',
    acakSoal: false,
    soal: [awal],
    ...hitungRingkasan([awal]),
    dibuatOleh: uid,
    dibuatOlehNama: input.namaGuru,
  })
  const ref = await addDoc(koleksi(), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export type PerubahanPaket = Partial<Pick<PaketSoal, 'judul' | 'deskripsi' | 'status' | 'acakSoal' | 'soal' | 'tpId' | 'tpNomor' | 'tpNama' | 'tipeMateri'>>

export async function simpanPaket(id: string, p: PerubahanPaket): Promise<void> {
  const data: Record<string, unknown> = { ...p }
  if (p.soal) {
    if (p.soal.length > BATAS_SOAL_PER_PAKET) throw new Error(`Maksimal ${BATAS_SOAL_PER_PAKET} soal per paket.`)
    Object.assign(data, hitungRingkasan(p.soal))
  }
  await updateDoc(doc(db, 'lms_paket_soal', id), { ...bersihkan(data), updatedAt: serverTimestamp() })
}

export async function hapusPaket(id: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_paket_soal', id))
}

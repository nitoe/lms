import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { muatSiswaKelas, type SiswaDasar } from './siswaAuth'
import type { KategoriPenilaian, NilaiDipakaiTugas } from '../types/tugas'
import { idPengumpulan } from './pengumpulan'
import {
  dibukaMs,
  msDariTs,
  normNilaiDipakai,
  percobaanTerpakai,
  sisaKesempatan,
  type RiwayatPercobaan,
} from './kesempatanTugas'
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
  /**
   * Tugas berulang (ANTIREGRESI §Tugas.Kesempatan). Dokumen lama tanpa field ini = percobaan ke-1.
   * `nilai`/`predikat` = yang DIPAKAI (terbaik/terakhir); `nilaiPercobaan`/`predikatPercobaan`
   * = hasil percobaan terakhir (yang diedit guru di form).
   */
  percobaanDinilai?: number
  bukaPerbaikan?: boolean
  dibukaAt?: unknown
  nilaiPercobaan?: number
  predikatPercobaan?: string
  /** Poin perbaikan percobaan terakhir, bahasa ramah siswa SD. Terlihat siswa. */
  poinPerbaikan?: string[]
  riwayat?: RiwayatPercobaan[]
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
  /** Poin perbaikan (satu per baris) percobaan terakhir. */
  poin: string
  percobaanKe: number
  bukaPerbaikan: boolean
  /** Nilai yang dipakai (rapor) — bisa beda dari nilaiAkhir (percobaan terakhir) bila «terbaik». */
  nilaiDipakai: number | null
  riwayat: RiwayatPercobaan[]
  dibukaMs: number
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
      percobaanDinilai: typeof data.percobaanDinilai === 'number' ? data.percobaanDinilai : undefined,
      bukaPerbaikan: data.bukaPerbaikan === true,
      dibukaAt: data.dibukaAt,
      nilaiPercobaan: typeof data.nilaiPercobaan === 'number' ? data.nilaiPercobaan : undefined,
      predikatPercobaan: typeof data.predikatPercobaan === 'string' ? data.predikatPercobaan : undefined,
      poinPerbaikan: rapikanPoin(data.poinPerbaikan),
      riwayat: rapikanRiwayat(data.riwayat),
    }
  })
}

const BATAS_POIN = 10
const BATAS_TEKS_POIN = 400

/** Poin perbaikan dari Firestore → array string bersih (maks 10 poin). */
export function rapikanPoin(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, BATAS_POIN)
  return out
}

/** Teks area (satu poin per baris) → array poin yang aman disimpan. */
export function poinDariTeks(teks: string): string[] {
  return String(teks || '')
    .split(/\r?\n/)
    .map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, BATAS_POIN)
    .map((x) => x.slice(0, BATAS_TEKS_POIN))
}

export function rapikanRiwayat(v: unknown): RiwayatPercobaan[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: RiwayatPercobaan[] = []
  for (const x of v) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    if (typeof r.ke !== 'number' || typeof r.nilai !== 'number') continue
    out.push({
      ke: r.ke,
      nilai: r.nilai,
      predikat: typeof r.predikat === 'string' ? r.predikat : undefined,
      komentar: typeof r.komentar === 'string' ? r.komentar : undefined,
      poin: rapikanPoin(r.poin),
      ms: typeof r.ms === 'number' ? r.ms : undefined,
    })
  }
  return out.sort((a, b) => a.ke - b.ke)
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
    // Tugas berulang: form guru selalu mewakili percobaan TERAKHIR, bukan nilai yang dipakai.
    const nilaiAkhir =
      n && typeof n.nilaiPercobaan === 'number'
        ? n.nilaiPercobaan
        : n && typeof n.nilai === 'number'
          ? n.nilai
          : rata
    return {
      siswaId: s.id,
      siswaNama: s.nama,
      perKategori,
      rataRata: rata,
      nilaiAkhir: nilaiAkhir ?? null,
      predikat: (n?.predikatPercobaan ?? n?.predikat) || '',
      komentar: n?.komentar || '',
      sudahAda: !!n,
      poin: (n?.poinPerbaikan ?? []).join('\n'),
      percobaanKe: n ? percobaanTerpakai(n) : 0,
      bukaPerbaikan: n?.bukaPerbaikan === true,
      nilaiDipakai: n && typeof n.nilai === 'number' ? n.nilai : null,
      riwayat: n?.riwayat ?? [],
      dibukaMs: dibukaMs(n),
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

/** Ringkasan hasil simpan untuk soft-update baris lokal guru (tanpa muat ulang daftar). */
export type HasilSimpanNilai = {
  percobaanKe: number
  nilaiDipakai: number
  bukaPerbaikan: boolean
  riwayat: RiwayatPercobaan[]
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
  /**
   * Poin perbaikan untuk siswa (satu poin per elemen). `undefined` = jangan sentuh; `[]` = kosongkan.
   * Terlihat siswa — bahasa ramah anak SD + contoh (ANTIREGRESI §Tugas.Kesempatan).
   */
  poin?: string[]
  /**
   * Aturan kesempatan tugas ini. Tidak diisi / maks 1 = perilaku lama (tidak membaca dokumen lama,
   * tidak menulis riwayat). Diisi dengan maks ≠ 1 = tugas berulang: simpan riwayat percobaan.
   */
  kesempatan?: { maks: number; nilaiDipakai: NilaiDipakaiTugas }
}): Promise<HasilSimpanNilai> {
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
  if (input.poin !== undefined) {
    payload.poinPerbaikan = input.poin.map((x) => x.trim()).filter(Boolean).slice(0, BATAS_POIN)
  }

  let hasil: HasilSimpanNilai = { percobaanKe: 1, nilaiDipakai: input.nilai, bukaPerbaikan: false, riwayat: [] }
  if (input.kesempatan && input.kesempatan.maks !== 1) {
    // —— Tugas berulang: tentukan nomor percobaan dan bangun riwayat ——
    const snap = await getDoc(ref)
    const ada = snap.exists() ? (snap.data() as Record<string, unknown>) : null
    let riwayat = rapikanRiwayat(ada?.riwayat) ?? []
    let ke = ada ? (typeof ada.percobaanDinilai === 'number' && ada.percobaanDinilai >= 1 ? Math.floor(ada.percobaanDinilai) : 1) : 1
    // Dokumen lama (sebelum fitur ini) belum punya riwayat: jadikan percobaan ke-1.
    if (ada && riwayat.length === 0 && typeof ada.nilai === 'number') {
      riwayat = [{
        ke: 1,
        nilai: ada.nilai,
        predikat: typeof ada.predikat === 'string' ? ada.predikat : undefined,
        komentar: typeof ada.komentar === 'string' ? ada.komentar : undefined,
        poin: rapikanPoin(ada.poinPerbaikan),
      }]
    }
    const terbuka = ada?.bukaPerbaikan === true
    let kumpulBaru = false
    if (ada && terbuka) {
      // Pengumpulan yang dikirim SETELAH percobaan dibuka = percobaan baru yang sedang dinilai.
      try {
        const pg = await getDoc(doc(db, 'lms_pengumpulan', idPengumpulan(input.tugasId, input.siswaId)))
        const kirimMs = pg.exists() ? msDariTs((pg.data() as Record<string, unknown>).updatedAt) : 0
        kumpulBaru = kirimMs > 0 && kirimMs > msDariTs(ada.dibukaAt)
      } catch (e) {
        console.warn('baca pengumpulan untuk nomor percobaan gagal:', e)
      }
      if (kumpulBaru) ke += 1
    }
    const entri: RiwayatPercobaan = {
      ke,
      nilai: input.nilai,
      predikat: input.predikat?.trim() || undefined,
      komentar: input.komentar?.trim() || undefined,
      poin: input.poin !== undefined ? payload.poinPerbaikan as string[] : rapikanPoin(ada?.poinPerbaikan),
      ms: Date.now(),
    }
    // Buang undefined (Firestore menolak).
    const bersih = (e: RiwayatPercobaan): Record<string, unknown> =>
      Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined))
    riwayat = [...riwayat.filter((r) => r.ke !== ke), entri].sort((x, y) => x.ke - y.ke)
    const kebijakan = normNilaiDipakai(input.kesempatan.nilaiDipakai)
    const dipakai =
      kebijakan === 'terakhir'
        ? riwayat[riwayat.length - 1]
        : riwayat.reduce((best, r) => (r.nilai > best.nilai ? r : best), riwayat[0])
    payload.nilai = dipakai.nilai
    if (dipakai.predikat) payload.predikat = dipakai.predikat
    payload.nilaiPercobaan = input.nilai
    payload.predikatPercobaan = input.predikat?.trim() || ''
    payload.percobaanDinilai = ke
    payload.riwayat = riwayat.slice(-20).map(bersih)
    // Percobaan baru sudah dinilai → tutup lagi; menyunting nilai percobaan yang sama → tetap apa adanya.
    payload.bukaPerbaikan = kumpulBaru ? false : terbuka
    hasil = {
      percobaanKe: ke,
      nilaiDipakai: dipakai.nilai,
      bukaPerbaikan: payload.bukaPerbaikan as boolean,
      riwayat: riwayat.slice(-20),
    }
  }

  await setDoc(ref, payload, { merge: true })
  return hasil
}

/**
 * Guru membuka percobaan berikutnya («Minta perbaikan»). Batas dijaga di sini: rules tidak bisa
 * menghitung percobaan. Hanya untuk tugas berulang; nilai harus sudah tersimpan.
 */
export async function mintaPerbaikanTugas(input: {
  tugasId: string
  siswaId: string
  /** `kesempatanMaks` tugas (0 = tanpa batas). */
  maks: number
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const ref = doc(db, 'lms_nilai_tugas', idNilai(input.tugasId, input.siswaId))
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Simpan nilai dulu sebelum meminta perbaikan.')
  const data = snap.data() as Record<string, unknown>
  if (data.bukaPerbaikan === true) throw new Error('Perbaikan sudah dibuka. Tunggu siswa mengirim ulang.')
  const poin = rapikanPoin(data.poinPerbaikan) ?? []
  if (poin.length === 0) {
    throw new Error('Isi dulu minimal satu poin perbaikan agar siswa tahu apa yang perlu diperbaiki, lalu simpan.')
  }
  const terpakai = percobaanTerpakai({ percobaanDinilai: data.percobaanDinilai })
  if (sisaKesempatan(input.maks, terpakai) <= 0) {
    throw new Error('Kesempatan mengerjakan sudah habis.')
  }
  await updateDoc(ref, { bukaPerbaikan: true, dibukaAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

/** Predikat dari nilai akhir (helper UI). */
export function predikatOtomatis(
  nilai: number | null,
  rentang = RENTANG_PREDIKAT_DEFAULT,
): string {
  if (nilai === null || nilai === undefined) return ''
  return predikatDariNilai(nilai, rentang)?.predikat || ''
}

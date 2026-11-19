/**
 * Gabung beberapa paket bank soal menjadi satu paket baru + export paket ke JSON.
 * Lihat ANTIREGRESI §Bank.Gabung.
 *
 * Prinsip:
 *  - Paket sumber TIDAK diubah (hasil gabungan selalu paket baru berstatus draf).
 *  - Soal disalin utuh lewat `salinSoal` (klon JSON + ID baru) sehingga stimulus, rumus, label B/S,
 *    gambarId, kompleksitas, dan pembahasan ikut terbawa (ANTIREGRESI §84.1). Jangan menyusun ulang
 *    soal bidang demi bidang di sini.
 *  - Dokumen `lms_gambar` tidak ikut dihapus saat paket dihapus, jadi gambarId tetap valid.
 */
import type { PaketSoal, Soal } from '../types/soal'
import { BATAS_SOAL_PER_PAKET } from '../types/soal'
import { BATAS_UKURAN_PAKET, salinSoal, ukuranPerkiraan } from './soal'
import { teksPolos } from './html'
import { adalahMapelTka, materiTkaUntuk } from './tkaAkses'

export interface OpsiGabung {
  /** Lewati soal yang isinya sama persis dengan soal yang sudah masuk (bacaan + pertanyaan + pilihan). */
  lewatiDuplikat: boolean
}

export interface RingkasanSumber {
  id: string
  judul: string
  mapel: string
  masuk: number
  dilewati: number
}

export interface HasilGabung {
  soal: Soal[]
  dilewati: number
  perSumber: RingkasanSumber[]
  /** Materi TKA paket gabungan; hanya terisi bila semua soal bermateri sama. */
  tipeMateri?: string
  /** TP paket gabungan (mapel non-TKA); hanya terisi bila semua sumber memakai TP yang sama. */
  tp?: { tpId: string; tpNomor?: number; tpNama?: string }
  /** Menghalangi penyimpanan. */
  galat: string[]
  /** Perlu dibaca, tidak menghalangi. */
  peringatan: string[]
}

function norm(s: string | undefined): string {
  return teksPolos(s).toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Sidik jari isi soal untuk mendeteksi duplikat. */
export function sidikJariSoal(s: Soal): string {
  const bagian: string[] = [s.tipe, norm(s.stimulus), norm(s.teks), s.gambarId ?? '']
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    bagian.push(...(s.opsi ?? []).map((o) => `${(o.teks ?? '').trim().toLowerCase()}${o.gambarId ?? ''}`))
  } else if (s.tipe === 'bs') {
    bagian.push(...(s.pernyataan ?? []).map((p) => `${(p.teks ?? '').trim().toLowerCase()}:${p.benar ? 1 : 0}`))
  } else if (s.tipe === 'jodoh') {
    bagian.push(...(s.pasangan ?? []).map((p) => `${(p.kiri ?? '').trim().toLowerCase()}>${(p.kanan ?? '').trim().toLowerCase()}`))
  } else if (s.tipe === 'isian') {
    bagian.push(...(s.kunci ?? []).map((k) => (k ?? '').trim().toLowerCase()))
  }
  return bagian.join('\u241F')
}

/** Judul usulan: bila semua sumber berjudul sama pakai itu; selain itu gabungkan dengan « + ». */
export function judulUsulan(sumber: PaketSoal[]): string {
  const unik = Array.from(new Set(sumber.map((p) => (p.judul ?? '').trim()).filter(Boolean)))
  if (unik.length === 0) return ''
  const j = unik.length === 1 ? unik[0] : unik.join(' + ')
  return j.slice(0, 200)
}

/**
 * Gabungkan paket menurut urutan `sumber`. Murni (tanpa Firestore) agar bisa dipakai untuk pratinjau.
 * `mapelTujuan` = mapel ruang tempat paket gabungan akan disimpan.
 */
export function gabungkanPaket(sumber: PaketSoal[], mapelTujuan: string, opsi: OpsiGabung): HasilGabung {
  const tka = adalahMapelTka(mapelTujuan)
  const materiSah = new Set(materiTkaUntuk(mapelTujuan))
  const galat: string[] = []
  const peringatan: string[] = []
  const hasil: Soal[] = []
  const lihat = new Set<string>()
  const perSumber: RingkasanSumber[] = []
  const materiDipakai = new Set<string>()
  const materiAsing = new Set<string>()
  let dilewati = 0

  for (const p of sumber) {
    let masuk = 0
    let lewat = 0
    for (const s of p.soal ?? []) {
      if (opsi.lewatiDuplikat) {
        const k = sidikJariSoal(s)
        if (lihat.has(k)) {
          lewat += 1
          continue
        }
        lihat.add(k)
      }
      const salin = salinSoal(s)
      if (tka) {
        // Materi paket diwariskan ke soal bila soal belum bermateri, supaya asal materi tidak hilang
        // saat paket gabungan memuat lebih dari satu materi.
        const materi = (s.tipeMateri || p.tipeMateri || '').trim()
        if (materi) {
          salin.tipeMateri = materi
          materiDipakai.add(materi)
          if (!materiSah.has(materi)) materiAsing.add(materi)
        }
      }
      hasil.push(salin)
      masuk += 1
    }
    dilewati += lewat
    perSumber.push({ id: p.id, judul: p.judul, mapel: p.mapel, masuk, dilewati: lewat })
  }

  if (sumber.length < 2) galat.push('Pilih minimal 2 paket untuk digabungkan.')
  if (hasil.length === 0 && sumber.length > 0) galat.push('Tidak ada soal yang dapat digabungkan.')
  if (hasil.length > BATAS_SOAL_PER_PAKET) {
    galat.push(`Hasil gabungan ${hasil.length} soal; batas satu paket ${BATAS_SOAL_PER_PAKET} soal. Kurangi paket yang dipilih.`)
  }
  if (hasil.length > 0 && ukuranPerkiraan({ soal: hasil, judul: '', deskripsi: '' }) > BATAS_UKURAN_PAKET) {
    galat.push('Ukuran hasil gabungan mendekati batas dokumen (±1 MB). Kurangi paket yang dipilih.')
  }
  if (materiAsing.size > 0) {
    peringatan.push(
      `Ada soal bermateri dari mapel lain (${[...materiAsing].join(', ')}). Materi itu tidak ada dalam daftar materi «${mapelTujuan}»; analisis per materi akan menampilkannya apa adanya.`,
    )
  }
  if (tka && materiDipakai.size > 1) {
    peringatan.push('Paket gabungan memuat lebih dari satu materi: materi paket dikosongkan dan tiap soal memakai materinya sendiri.')
  }

  let tp: HasilGabung['tp']
  if (!tka && sumber.length > 0) {
    const idTp = new Set(sumber.map((p) => p.tpId || ''))
    if (idTp.size === 1 && sumber[0].tpId) {
      tp = { tpId: sumber[0].tpId, tpNomor: sumber[0].tpNomor, tpNama: sumber[0].tpNama }
    } else if (idTp.size > 1) {
      peringatan.push('Paket sumber berasal dari TP berbeda: paket gabungan dibuat tanpa TP (soal gabungan).')
    }
  }

  return {
    soal: hasil,
    dilewati,
    perSumber,
    tipeMateri: tka && materiDipakai.size === 1 ? [...materiDipakai][0] : undefined,
    tp,
    galat,
    peringatan,
  }
}

/* ------------------------------------------------------------------ */
/* Export JSON (format yang sama dengan import bank soal)              */
/* ------------------------------------------------------------------ */

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Ubah satu soal ke baris JSON yang dibaca `normalisasiSoalDariImport`. */
export function soalKeBarisImport(s: Soal): Record<string, unknown> {
  const dasar: Record<string, unknown> = {
    tipe: s.tipe,
    ...(s.stimulus ? { stimulus: s.stimulus } : {}),
    teks: s.teks,
    kompleksitas: s.kompleksitas,
    poin: s.poin,
    waktuMenit: s.waktuMenit,
    ...(s.pembahasan ? { pembahasan: s.pembahasan } : {}),
    ...(s.tipeMateri ? { tipeMateri: s.tipeMateri } : {}),
    ...(s.rumus ? { rumus: true } : {}),
    // Informasi saja: gambar tidak ikut file (lihat catatan di JSON); id dipertahankan untuk rujukan.
    ...(s.gambarId ? { gambarId: s.gambarId } : {}),
  }
  switch (s.tipe) {
    case 'pg': {
      const idx = s.opsi.findIndex((o) => o.id === s.kunci)
      return {
        ...dasar,
        opsi: s.opsi.map((o) => o.teks),
        kunci: HURUF[Math.max(idx, 0)],
        acakOpsi: s.acakOpsi,
      }
    }
    case 'pgk':
      return {
        ...dasar,
        opsi: s.opsi.map((o) => o.teks),
        kunci: s.opsi.map((o, i) => (s.kunci.includes(o.id) ? HURUF[i] : '')).filter(Boolean),
        acakOpsi: s.acakOpsi,
        nilaiParsial: s.nilaiParsial,
      }
    case 'bs':
      return {
        ...dasar,
        pernyataan: s.pernyataan.map((p) => ({ teks: p.teks, benar: p.benar })),
        ...(s.labelBenar ? { labelBenar: s.labelBenar } : {}),
        ...(s.labelSalah ? { labelSalah: s.labelSalah } : {}),
        nilaiParsial: s.nilaiParsial,
      }
    case 'jodoh':
      return { ...dasar, pasangan: s.pasangan.map((p) => ({ kiri: p.kiri, kanan: p.kanan })), nilaiParsial: s.nilaiParsial }
    case 'isian':
      return { ...dasar, kunci: s.kunci, abaikanKapital: s.abaikanKapital }
    case 'uraian':
      return { ...dasar, ...(s.kunciJawaban ? { kunciJawaban: s.kunciJawaban } : {}) }
  }
}

export interface HasilExport {
  isi: string
  jumlahSoal: number
  /** Soal (atau opsi) yang memakai gambar — gambarnya TIDAK ikut file JSON. */
  jumlahBergambar: number
}

/** JSON export untuk satu atau beberapa paket (digabung berurutan). */
export function buatExportJson(opts: {
  mapel: string
  judul: string
  soal: Soal[]
  tipeMateri?: string
  tpNama?: string
}): HasilExport {
  const bergambar = opts.soal.filter(
    (s) => !!s.gambarId || ((s.tipe === 'pg' || s.tipe === 'pgk') && s.opsi.some((o) => !!o.gambarId)) ||
      (s.tipe === 'jodoh' && s.pasangan.some((p) => !!p.kiriGambarId)),
  ).length
  const data = {
    mapel: opts.mapel,
    ...(opts.tipeMateri ? { tipeMateri: opts.tipeMateri } : {}),
    ...(opts.tpNama ? { tpNama: opts.tpNama } : {}),
    judul: opts.judul,
    catatan:
      'Hasil export bank soal LMS. Gambar tidak ikut file ini. File berisi lebih dari satu materi TKA tidak dapat diimpor lewat jalur import TKA (satu file = satu materi); gunakan fitur Gabungkan paket di aplikasi.',
    soal: opts.soal.map(soalKeBarisImport),
  }
  return { isi: JSON.stringify(data, null, 2), jumlahSoal: opts.soal.length, jumlahBergambar: bergambar }
}

/** Nama berkas aman: huruf/angka/strip. */
export function namaBerkasAman(teks: string, maks = 50): string {
  const t = teks
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maks)
  return t || 'paket'
}

/** Picu unduhan berkas teks di browser. */
export function unduhBerkasTeks(nama: string, isi: string, mime = 'application/json;charset=utf-8'): void {
  const blob = new Blob([isi], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}

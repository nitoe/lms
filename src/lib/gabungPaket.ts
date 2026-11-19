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
import { cariSoalGanda, hapusSoalGanda } from './soalGanda'
import { adalahMapelTka, materiTkaUntuk } from './tkaAkses'

/** Cara menangani soal ganda saat menggabungkan. */
export type ModeGanda =
  /** Semua soal dimasukkan apa adanya. */
  | 'tidak'
  /** Soal ganda dilewati; versi dari paket yang lebih dulu dipertahankan. */
  | 'lewati'
  /** Soal ganda ditimpa: versi dari paket terakhir menggantikan versi lama di posisi semula. */
  | 'timpa'

export interface OpsiGabung {
  mode: ModeGanda
  /** Ikut menganggap soal yang «mirip» (≥ 90%, angka identik) sebagai ganda. */
  mirip?: boolean
}

export interface RingkasanSumber {
  id: string
  judul: string
  mapel: string
  /** Soal paket ini yang ada di hasil gabungan. */
  masuk: number
  /** Soal paket ini yang tidak dipakai (dilewati atau tertimpa). */
  dilewati: number
}

export interface HasilGabung {
  soal: Soal[]
  /** Jumlah soal ganda yang dibuang (dilewati atau ditimpa). */
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
 * Deteksi soal ganda memakai `cariSoalGanda` (isi, bukan ID) — lihat ANTIREGRESI §Soal.Ganda.
 */
export function gabungkanPaket(sumber: PaketSoal[], mapelTujuan: string, opsi: OpsiGabung): HasilGabung {
  const tka = adalahMapelTka(mapelTujuan)
  const materiSah = new Set(materiTkaUntuk(mapelTujuan))
  const galat: string[] = []
  const peringatan: string[] = []

  // 1) Salin semua soal (ID baru), catat paket asalnya.
  const semua: { s: Soal; asal: number }[] = []
  sumber.forEach((p, asal) => {
    for (const s of p.soal ?? []) {
      const salin = salinSoal(s)
      if (tka) {
        // Materi paket diwariskan ke soal bila soal belum bermateri, supaya asal materi tidak hilang
        // saat paket gabungan memuat lebih dari satu materi.
        const materi = (s.tipeMateri || p.tipeMateri || '').trim()
        if (materi) salin.tipeMateri = materi
      }
      semua.push({ s: salin, asal })
    }
  })

  // 2) Deteksi & tangani soal ganda berdasarkan isi.
  let terpakai = semua
  if (opsi.mode !== 'tidak' && semua.length > 1) {
    const kelompok = cariSoalGanda(semua.map((x) => x.s), { mirip: !!opsi.mirip })
    if (kelompok.length > 0) {
      const { hasil } = hapusSoalGanda(semua, kelompok, {
        kebijakan: opsi.mode === 'timpa' ? 'terakhir' : 'pertama',
        posisi: opsi.mode === 'timpa' ? 'pertama' : 'asli',
      })
      terpakai = hasil
      const bedaKunci = kelompok.filter((g) => g.kunciBeda).length
      if (bedaKunci > 0) {
        peringatan.push(
          `${bedaKunci} kelompok soal ganda memiliki kunci jawaban berbeda antar paket. ` +
            (opsi.mode === 'timpa' ? 'Versi dari paket terakhir dipakai.' : 'Versi dari paket pertama dipakai.') +
            ' Periksa kuncinya setelah digabung.',
        )
      }
    }
  }

  const hasil = terpakai.map((x) => x.s)
  const dilewati = semua.length - hasil.length
  const perSumber: RingkasanSumber[] = sumber.map((p, asal) => {
    const total = (p.soal ?? []).length
    const masuk = terpakai.filter((x) => x.asal === asal).length
    return { id: p.id, judul: p.judul, mapel: p.mapel, masuk, dilewati: total - masuk }
  })

  const materiDipakai = new Set<string>()
  const materiAsing = new Set<string>()
  if (tka) {
    for (const s of hasil) {
      const m = (s.tipeMateri ?? '').trim()
      if (!m) continue
      materiDipakai.add(m)
      if (!materiSah.has(m)) materiAsing.add(m)
    }
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

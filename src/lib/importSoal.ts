import type { Soal, TipeSoal, OpsiSoal, PasanganJodoh, PernyataanBs } from '../types/soal'
import { normalisasiKompleksitas } from '../types/soal'
import { soalBaru, idAcak } from './soal'
import { teksPolos } from './html'
import type { TpRingkas } from '../types/materi'

/** Metadata wajib pada setiap import bank soal. */
export interface MetadataImport {
  mapel: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
  /** Materi TKA (pengganti TP). */
  tipeMateri?: string
}

/** Hasil parse file import. */
export interface HasilParseImport {
  metadata: MetadataImport
  soal: Partial<Soal>[]
  galat: string[]
  /**
   * true bila isi file tidak bisa dibaca sama sekali (JSON rusak / CSV kosong). Pemanggil WAJIB
   * hanya menampilkan `galat` dan melewati validasi metadata — kalau tidak, muncul galat susulan
   * menyesatkan «File import tidak memuat mata pelajaran» (ANTIREGRESI §130).
   */
  gagalParse?: boolean
  /** true bila JSON hanya terbaca setelah dirapikan otomatis (BOM, ```json, koma sisa, komentar, dst.). */
  diperbaiki?: boolean
  /**
   * true bila file adalah ekspor tka2026 yang memuat beberapa tipeMateri.
   * Pemanggil (BankSoalPanel) wajib memecah menjadi satu paket per materi;
   * validasi tipeMateri tunggal dilonggarkan (ANTIREGRESI §Import.Tka2026).
   */
  multiMateri?: boolean
  /** Sumber format: «tka2026» bila terdeteksi dari _meta.app atau field khas. */
  formatSumber?: 'tka2026' | 'lms'
}

/** Nilai pilihan «Tanpa TP» pada dropdown unduh template / import (bukan id TP sungguhan). */
export const VALUE_TANPA_TP = '__tanpa__'

/** File memuat identitas TP (id / nomor / nama)? */
export function metaMemuatTp(meta: MetadataImport): boolean {
  return Boolean(meta.tpId || meta.tpNomor || (meta.tpNama && meta.tpNama.trim()))
}

/**
 * Validasi import ke bank soal TANPA TP (soal gabungan beberapa TP, mis. latihan/lomba).
 * Mapel di file BOLEH kosong (otomatis mengikuti ruang/paket tujuan) — file tanpa TP sering berupa
 * daftar soal polos. Bila mapel diisi, harus cocok. File tidak boleh membawa TP tertentu supaya
 * soal ber-TP tidak tercampur diam-diam (ANTIREGRESI §129.3).
 */
export function validasiMetadataTanpaTp(meta: MetadataImport, mapelDiharapkan: string): string[] {
  const galat: string[] = []
  if (meta.mapel && meta.mapel.trim() && meta.mapel.trim().toLowerCase() !== mapelDiharapkan.trim().toLowerCase()) {
    galat.push(`Mata pelajaran di file («${meta.mapel}») tidak cocok dengan ruang kelas («${mapelDiharapkan}»).`)
  }
  if (metaMemuatTp(meta)) {
    galat.push(
      `File ini memuat TP (TP ${meta.tpNomor || '?'} · ${meta.tpNama || meta.tpId || 'tidak diketahui'}). ` +
        'Untuk bank soal tanpa TP gunakan template «Tanpa TP», atau pilih TP yang sesuai pada form import.',
    )
  }
  return galat
}

/** Validasi bahwa file hanya untuk satu TP dan mapel cocok. */
export function validasiMetadata(
  meta: MetadataImport,
  mapelDiharapkan: string,
  tpDipilih?: TpRingkas | null,
): string[] {
  const galat: string[] = []
  if (!meta.mapel || !meta.mapel.trim()) {
    galat.push('File import tidak memuat mata pelajaran. Import dibatalkan.')
  } else if (meta.mapel.trim().toLowerCase() !== mapelDiharapkan.trim().toLowerCase()) {
    galat.push(`Mata pelajaran di file («${meta.mapel}») tidak cocok dengan ruang kelas («${mapelDiharapkan}»).`)
  }
  if (!meta.tpId && !meta.tpNomor && !meta.tpNama) {
    galat.push(
      'File import tidak memuat Tujuan Pembelajaran (TP). Bila ini soal gabungan beberapa TP, pilih «Tanpa TP» pada form import. Import dibatalkan.',
    )
  }
  if (tpDipilih) {
    const cocokId = meta.tpId && meta.tpId === tpDipilih.id
    const cocokNomor = meta.tpNomor && meta.tpNomor === tpDipilih.nomorTp
    const cocokNama = meta.tpNama && meta.tpNama.trim().toLowerCase() === (tpDipilih.namaTp || '').trim().toLowerCase()
    if (!cocokId && !cocokNomor && !cocokNama) {
      galat.push(
        `TP di file (TP ${meta.tpNomor || '?'} · ${meta.tpNama || meta.tpId || 'tidak diketahui'}) tidak sesuai dengan TP yang dipilih (TP ${tpDipilih.nomorTp}. ${tpDipilih.namaTp}). Periksa kembali pilihan TP.`,
      )
    }
  }
  return galat
}

function normalisasiTeksUntukDuplikat(teks: string): string {
  return teksPolos(teks)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mapel kanonis TKA dari subjectId / scope ekspor tka2026. */
const MAP_SUBJECT_TKA: Record<string, string> = {
  'bahasa-indonesia': 'TKA Bahasa Indonesia',
  'bahasa indonesia': 'TKA Bahasa Indonesia',
  bi: 'TKA Bahasa Indonesia',
  matematika: 'TKA Matematika',
  mtk: 'TKA Matematika',
  ipa: 'TKA IPA',
}

/** Kompleksitas tka2026 «L1-Pemahaman» / «L2-Aplikasi» / «L3-Penalaran» → L1|L2|L3. */
export function normalisasiKompleksitasImport(v: unknown): 'L1' | 'L2' | 'L3' {
  const s = String(v ?? '').trim()
  if (/^L1/i.test(s)) return 'L1'
  if (/^L2/i.test(s)) return 'L2'
  if (/^L3/i.test(s)) return 'L3'
  return normalisasiKompleksitas(v)
}

/** Ubah baris data mentah menjadi soal yang valid. Tolak jika tidak lengkap. */
export function normalisasiSoalDariImport(raw: Record<string, unknown>, index: number): { soal?: Partial<Soal>; galat?: string } {
  const tipeRaw = String(raw.tipe || raw.bentuk || raw.jenis || '').toLowerCase().trim()
  // pgk-cat (tka2026) → bs (benar/salah kategori 2 kolom)
  const mapTipe: Record<string, TipeSoal> = {
    pg: 'pg', 'pilihan ganda': 'pg', 'pilihan-ganda': 'pg',
    pgk: 'pgk', 'pg kompleks': 'pgk', 'pilihan ganda kompleks': 'pgk',
    'pgk-cat': 'bs', 'pgk_cat': 'bs', kategori: 'bs',
    jodoh: 'jodoh', menjodohkan: 'jodoh',
    bs: 'bs', 'benar salah': 'bs', 'benar/salah': 'bs',
    isian: 'isian', 'isian singkat': 'isian',
    uraian: 'uraian',
  }
  const tipe = mapTipe[tipeRaw]
  if (!tipe) return { galat: `Baris ${index + 1}: tipe soal tidak dikenali («${tipeRaw || 'kosong'}»).` }

  const stimulusRaw = String(raw.stimulus || raw.bacaan || '').trim()
  const teks = String(raw.teks || raw.narasi || raw.pertanyaan || '').trim()
  // Kompatibilitas lama: jika hanya ada stimulus, anggap itu teks soal (mapel biasa).
  // tka2026: stimulus boleh kosong bila hanya ada stimulusImage (gambar bacaan).
  const adaGambarStimulus =
    typeof raw.stimulusImage === 'string' &&
    (raw.stimulusImage as string).startsWith('data:image/')
  const teksFinal = teks || (!stimulusRaw && !adaGambarStimulus ? '' : '')
  if (!teksFinal && !stimulusRaw && !adaGambarStimulus) {
    return { galat: `Baris ${index + 1}: narasi/teks soal kosong.` }
  }

  const dasar = soalBaru(tipe)
  const skor = Number(raw.poin ?? raw.skor)
  const soal: Partial<Soal> = {
    ...dasar,
    teks: teksFinal || (stimulusRaw || adaGambarStimulus ? 'Berdasarkan bacaan di atas, pilihlah jawaban yang tepat.' : ''),
    kompleksitas: normalisasiKompleksitasImport(raw.kompleksitas),
    poin: skor > 0 ? skor : dasar.poin,
    waktuMenit: Number(raw.waktuMenit) > 0 ? Number(raw.waktuMenit) : dasar.waktuMenit,
    pembahasan: String(raw.pembahasan || raw.penjelasan || '').trim() || undefined,
    ...(stimulusRaw ? { stimulus: stimulusRaw } : {}),
    ...(String(raw.tipeMateri || raw.materi || '').trim()
      ? { tipeMateri: String(raw.tipeMateri || raw.materi).trim() }
      : {}),
  }
  // Gambar bacaan base64 dari ekspor tka2026 — diunggah pemanggil (BankSoalPanel) → gambarId
  if (adaGambarStimulus) {
    ;(soal as any)._stimulusImage = String(raw.stimulusImage)
  }

  // --- PG / PGK ---
  if (tipe === 'pg' || tipe === 'pgk') {
    const opsi: OpsiSoal[] = []
    if (Array.isArray(raw.opsi)) {
      for (const o of raw.opsi) {
        if (typeof o === 'string' && o.trim()) {
          opsi.push({ id: idAcak(), teks: o.trim() })
        } else if (o && typeof o === 'object' && typeof (o as any).teks === 'string' && (o as any).teks.trim()) {
          opsi.push({ id: String((o as any).id || idAcak()), teks: (o as any).teks.trim() })
        }
      }
    }
    if (opsi.length === 0) {
      for (const key of ['opsiA', 'opsiB', 'opsiC', 'opsiD', 'opsiE', 'A', 'B', 'C', 'D', 'E']) {
        const v = raw[key]
        if (typeof v === 'string' && v.trim()) {
          opsi.push({ id: key.replace(/opsi/i, '').toLowerCase() || key.toLowerCase(), teks: v.trim() })
        }
      }
    }
    if (opsi.length < 2) return { galat: `Baris ${index + 1}: soal ${tipe.toUpperCase()} minimal harus punya 2 opsi.` }
    if (tipe === 'pgk' && opsi.length > 4) return { galat: `Baris ${index + 1}: PG kompleks untuk SD maksimal 4 opsi.` }

    ;(soal as any).opsi = opsi
    ;(soal as any).acakOpsi = raw.acakOpsi !== false
    ;(soal as any).opsiGambar = false

    // tka2026 memakai kunciJawaban (teks opsi atau array teks); template LMS memakai kunci / jawaban
    const kunciSumber = raw.kunciJawaban ?? raw.kunci ?? raw.jawaban
    const kunciRaw = Array.isArray(kunciSumber)
      ? ''
      : String(kunciSumber ?? '').trim()
    if (!kunciRaw && !Array.isArray(kunciSumber)) {
      return { galat: `Baris ${index + 1}: soal ${tipe.toUpperCase()} tidak memiliki kunci jawaban.` }
    }

    // Normalisasi ID opsi menjadi huruf A, B, C, D jika memungkinkan
    const huruf = 'abcdefghijklmnopqrstuvwxyz'
    opsi.forEach((o, i) => {
      if (!/^[a-z]$/i.test(o.id)) o.id = huruf[i] || `o${i}`
    })

    function cariOpsi(kunci: string): OpsiSoal | undefined {
      const k = kunci.trim().toLowerCase()
      // 1. Cocokkan ID persis (a, b, c)
      let m = opsi.find((o) => o.id.toLowerCase() === k)
      if (m) return m
      // 2. Cocokkan huruf di awal (A., A), B)
      m = opsi.find((o) => o.id.toLowerCase() === k.replace(/[^a-z]/g, ''))
      if (m) return m
      // 3. Cocokkan teks persis (penting untuk ekspor tka2026: kunci = teks opsi penuh)
      m = opsi.find((o) => o.teks.toLowerCase() === k)
      if (m) return m
      // 4. Cocokkan teks yang mengandung kunci (hati-hati)
      m = opsi.find((o) => o.teks.toLowerCase().includes(k) && k.length > 2)
      return m
    }

    if (tipe === 'pg') {
      const match = cariOpsi(kunciRaw)
      if (!match) return { galat: `Baris ${index + 1}: kunci «${kunciRaw.slice(0, 80)}» tidak cocok dengan opsi manapun.` }
      ;(soal as any).kunci = match.id
    } else {
      const daftarKunci = Array.isArray(kunciSumber)
        ? kunciSumber.map(String)
        : Array.isArray(raw.kunci)
          ? (raw.kunci as unknown[]).map(String)
          : kunciRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      const kunciIds: string[] = []
      for (const k of daftarKunci) {
        const match = cariOpsi(k)
        if (match) kunciIds.push(match.id)
      }
      if (kunciIds.length === 0) return { galat: `Baris ${index + 1}: tidak ada kunci yang cocok dengan opsi.` }
      if (kunciIds.length > 2) return { galat: `Baris ${index + 1}: PG kompleks untuk SD idealnya hanya 1–2 jawaban benar.` }
      ;(soal as any).kunci = kunciIds
      // tka2026 PGK: harus benar semua (nilaiParsial=false); template LMS default true
      ;(soal as any).nilaiParsial = raw.nilaiParsial === true
    }
  }

  // --- Isian ---
  if (tipe === 'isian') {
    let kunci: string[] = []
    if (Array.isArray(raw.kunci)) kunci = raw.kunci.map(String).map((s) => s.trim()).filter(Boolean)
    else if (typeof raw.kunci === 'string') kunci = raw.kunci.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
    else if (typeof raw.jawaban === 'string') kunci = [raw.jawaban.trim()]
    if (kunci.length === 0) return { galat: `Baris ${index + 1}: soal isian tidak memiliki kunci jawaban.` }
    ;(soal as any).kunci = kunci
    ;(soal as any).abaikanKapital = raw.abaikanKapital !== false
  }

  // --- Jodoh ---
  if (tipe === 'jodoh') {
    const pasangan: PasanganJodoh[] = []
    if (Array.isArray(raw.pasangan)) {
      for (const p of raw.pasangan) {
        if (p && typeof p === 'object' && typeof (p as any).kiri === 'string' && typeof (p as any).kanan === 'string') {
          pasangan.push({
            id: idAcak(),
            kiri: (p as any).kiri.trim(),
            kanan: (p as any).kanan.trim(),
          })
        }
      }
    }
    if (pasangan.length < 2) return { galat: `Baris ${index + 1}: soal menjodohkan minimal harus punya 2 pasangan.` }
    ;(soal as any).pasangan = pasangan
    ;(soal as any).nilaiParsial = raw.nilaiParsial !== false
  }

  // --- Benar/Salah (termasuk konversi pgk-cat tka2026: rows + cols + kunciJawaban) ---
  if (tipe === 'bs') {
    const pernyataan: PernyataanBs[] = []
    if (Array.isArray(raw.pernyataan)) {
      for (const p of raw.pernyataan) {
        if (p && typeof p === 'object' && typeof (p as any).teks === 'string') {
          pernyataan.push({
            id: idAcak(),
            teks: (p as any).teks.trim(),
            benar: Boolean((p as any).benar),
          })
        }
      }
    } else if (Array.isArray(raw.rows) && raw.rows.length > 0) {
      // Format tka2026 pgk-cat: rows = pernyataan, cols = [labelBenar, labelSalah], kunciJawaban = label per baris
      const cols = Array.isArray(raw.cols) ? (raw.cols as unknown[]).map(String) : ['Benar', 'Salah']
      if (cols.length !== 2) {
        return {
          galat: `Baris ${index + 1}: pgk-cat / BS kategori hanya mendukung 2 kolom (sekarang ${cols.length}). Soal dilewati.`,
        }
      }
      const labelBenar = cols[0].trim() || 'Benar'
      const labelSalah = cols[1].trim() || 'Salah'
      const kunciArr = Array.isArray(raw.kunciJawaban)
        ? (raw.kunciJawaban as unknown[]).map(String)
        : Array.isArray(raw.kunci)
          ? (raw.kunci as unknown[]).map(String)
          : []
      for (let ri = 0; ri < raw.rows.length; ri++) {
        const teksP = String((raw.rows as unknown[])[ri] ?? '').trim()
        if (!teksP) continue
        const kunciBaris = (kunciArr[ri] ?? '').trim()
        // Cocokkan ke labelBenar (case-insensitive); selain itu = salah
        const benar =
          kunciBaris.toLowerCase() === labelBenar.toLowerCase() ||
          kunciBaris.toLowerCase() === 'benar' ||
          kunciBaris.toLowerCase() === 'sesuai' ||
          kunciBaris === 'true' ||
          kunciBaris === '1'
        pernyataan.push({ id: idAcak(), teks: teksP, benar })
      }
      ;(soal as any).labelBenar = labelBenar
      ;(soal as any).labelSalah = labelSalah
    }
    if (pernyataan.length < 1) return { galat: `Baris ${index + 1}: soal benar/salah minimal harus punya 1 pernyataan.` }
    ;(soal as any).pernyataan = pernyataan
    ;(soal as any).nilaiParsial = raw.nilaiParsial !== false
    if (raw.labelBenar) (soal as any).labelBenar = String(raw.labelBenar).trim()
    if (raw.labelSalah) (soal as any).labelSalah = String(raw.labelSalah).trim()
  }

  // --- Uraian ---
  if (tipe === 'uraian') {
    const kunci = String(raw.kunciJawaban || raw.kunci || raw.jawaban || '').trim()
    if (kunci) (soal as any).kunciJawaban = kunci
  }

  return { soal }
}

/**
 * Rapikan JSON «hampir benar» yang lazim dari salinan AI / editor teks: BOM & spasi tak terlihat,
 * pagar kode ```json, teks pembuka/penutup di luar kurung terluar, komentar // dan /* *\/,
 * koma sisa sebelum } atau ], serta baris baru / tab mentah di dalam string.
 * Hanya dipakai bila JSON.parse pada teks asli gagal; isi string tidak diubah selain karakter kontrol.
 */
export function rapikanJson(teks: string): string {
  let t = teks.replace(/[\uFEFF\u200B-\u200D\u2060]/g, '').replace(/\u00A0/g, ' ')
  // pagar kode markdown
  t = t.replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n?\s*```\s*$/, '')
  // buang teks di luar kurung terluar
  const mulai = t.search(/[{[]/)
  const akhir = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (mulai > 0 || (akhir >= 0 && akhir < t.length - 1)) {
    if (mulai >= 0 && akhir > mulai) t = t.slice(mulai, akhir + 1)
  }

  // Lintasan 1: komentar + karakter kontrol dalam string
  let o1 = ''
  let dalam = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (dalam) {
      if (c === '\\') {
        o1 += c + (t[i + 1] ?? '')
        i++
      } else if (c === '"') {
        dalam = false
        o1 += c
      } else if (c === '\n') o1 += '\\n'
      else if (c === '\r') {
        if (t[i + 1] === '\n') i++
        o1 += '\\n'
      } else if (c === '\t') o1 += '\\t'
      else o1 += c
    } else if (c === '"') {
      dalam = true
      o1 += c
    } else if (c === '/' && t[i + 1] === '/') {
      while (i < t.length && t[i] !== '\n') i++
      o1 += '\n'
    } else if (c === '/' && t[i + 1] === '*') {
      i += 2
      while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) i++
      i++
    } else o1 += c
  }

  // Lintasan 2: koma sisa sebelum } atau ]
  let o2 = ''
  dalam = false
  for (let i = 0; i < o1.length; i++) {
    const c = o1[i]
    if (dalam) {
      o2 += c
      if (c === '\\') {
        o2 += o1[i + 1] ?? ''
        i++
      } else if (c === '"') dalam = false
    } else if (c === '"') {
      dalam = true
      o2 += c
    } else if (c === ',') {
      let j = i + 1
      while (j < o1.length && /\s/.test(o1[j])) j++
      if (o1[j] === '}' || o1[j] === ']') continue
      o2 += c
    } else o2 += c
  }
  return o2
}

/** Pesan galat JSON yang menunjuk lokasi (baris/kolom) + petunjuk penyebab yang lazim. */
function pesanGalatJson(teks: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  let pos = -1
  const mPos = msg.match(/position (\d+)/i)
  if (mPos) pos = Number(mPos[1])
  let lokasi = ''
  if (pos >= 0 && pos <= teks.length) {
    const sebelum = teks.slice(0, pos)
    const baris = sebelum.split(/\r?\n/).length
    const kolom = pos - (sebelum.lastIndexOf('\n') + 1) + 1
    const cuplikan = teks.slice(Math.max(0, pos - 25), pos + 25).replace(/\s+/g, ' ').trim()
    lokasi = ` Perkiraan lokasi: baris ${baris}, kolom ${kolom} — dekat «${cuplikan}».`
  } else {
    const mBaris = msg.match(/line (\d+) column (\d+)/i)
    if (mBaris) lokasi = ` Perkiraan lokasi: baris ${mBaris[1]}, kolom ${mBaris[2]}.`
  }
  const petunjuk: string[] = []
  if (/[\u201C\u201D\u201E\u2018\u2019]/.test(teks)) {
    petunjuk.push('File memuat tanda kutip miring (“ ” ‘ ’) — pakai tanda kutip lurus " pada nama field dan teks.')
  }
  petunjuk.push('Periksa tanda kutip ganda di dalam teks soal (tulis \\" ), koma antar-soal, dan kurung yang belum tertutup.')
  return `File JSON tidak valid.${lokasi} ${petunjuk.join(' ')}`
}

/** Parse JSON template. */
export function parseJsonImport(teks: string): HasilParseImport {
  const galat: string[] = []
  let data: any
  let diperbaiki = false
  try {
    data = JSON.parse(teks)
  } catch (eAsli) {
    try {
      data = JSON.parse(rapikanJson(teks))
      diperbaiki = true
    } catch {
      return { metadata: { mapel: '' }, soal: [], galat: [pesanGalatJson(teks, eAsli)], gagalParse: true }
    }
  }
  if (data === null || typeof data !== 'object') {
    return {
      metadata: { mapel: '' },
      soal: [],
      galat: ['Isi file JSON harus berupa objek { "soal": [...] } atau daftar soal [ ... ].'],
      gagalParse: true,
    }
  }
  // Deteksi ekspor tka2026 (_meta.app atau field khas subjectId / kunciJawaban + pertanyaan)
  const metaApp = data._meta && typeof data._meta === 'object' ? String((data._meta as any).app || '') : ''
  const daftarMentah = Array.isArray(data.soal) ? data.soal : Array.isArray(data) ? data : []
  const sample = daftarMentah.find((x: any) => x && typeof x === 'object') as Record<string, unknown> | undefined
  const formatTka2026 =
    metaApp === 'tka2026' ||
    Boolean(
      sample &&
        (sample.subjectId || sample.kunciJawaban !== undefined) &&
        (sample.pertanyaan !== undefined || sample.tipeMateri !== undefined),
    )

  // Mapel: field langsung, atau subjectId / _meta.scope dari tka2026
  let mapelMeta = String(data.mapel || data.mataPelajaran || '').trim()
  if (!mapelMeta && formatTka2026) {
    const scope = data._meta && typeof data._meta === 'object' ? String((data._meta as any).scope || '') : ''
    const subj = sample ? String(sample.subjectId || '') : ''
    mapelMeta =
      MAP_SUBJECT_TKA[scope.toLowerCase()] ||
      MAP_SUBJECT_TKA[subj.toLowerCase()] ||
      ''
  }

  // Materi: tunggal di root, atau kumpulkan dari soal (multi-materi tka2026)
  const materiRoot = data.tipeMateri || data.materi ? String(data.tipeMateri || data.materi).trim() : ''
  const materiDariSoal = new Set<string>()
  if (formatTka2026) {
    for (const item of daftarMentah) {
      if (item && typeof item === 'object' && (item as any).tipeMateri) {
        const m = String((item as any).tipeMateri).trim()
        if (m) materiDariSoal.add(m)
      }
    }
  }
  const multiMateri = formatTka2026 && materiDariSoal.size > 1
  const tipeMateriMeta = materiRoot || (materiDariSoal.size === 1 ? [...materiDariSoal][0] : undefined)

  const meta: MetadataImport = {
    mapel: mapelMeta,
    tpId: data.tpId || data.tujuanPembelajaranId || undefined,
    tpNomor: typeof data.tpNomor === 'number' ? data.tpNomor : undefined,
    tpNama: data.tpNama || data.tujuanPembelajaran || undefined,
    tipeMateri: tipeMateriMeta,
  }
  const daftar = daftarMentah
  const soal: Partial<Soal>[] = []
  const teksTerlihat = new Set<string>()

  daftar.forEach((item: any, i: number) => {
    if (!item || typeof item !== 'object') {
      galat.push(`Baris ${i + 1}: butir soal harus berupa objek.`)
      return
    }
    const r = normalisasiSoalDariImport(item, i)
    if (r.galat) {
      galat.push(r.galat)
      return
    }
    if (r.soal) {
      // Duplikat: abaikan untuk ekspor tka2026 besar (banyak soal mirip lintas materi);
      // tetap cegah salinan identik berurutan pada template LMS biasa.
      const normal = normalisasiTeksUntukDuplikat(r.soal.teks || '')
      if (!formatTka2026 && normal && teksTerlihat.has(normal)) {
        galat.push(`Baris ${i + 1}: soal duplikat (teks hampir sama dengan soal sebelumnya).`)
        return
      }
      if (normal) teksTerlihat.add(normal)
      // Rumus KaTeX otomatis aktif untuk soal TKA hasil migrasi/import tka2026
      if (formatTka2026) (r.soal as any).rumus = true
      soal.push(r.soal)
    }
  })
  if (soal.length === 0 && galat.length === 0) galat.push('Tidak ada soal yang berhasil diparse.')
  return {
    metadata: meta,
    soal,
    galat,
    ...(diperbaiki ? { diperbaiki } : {}),
    ...(multiMateri ? { multiMateri: true } : {}),
    ...(formatTka2026 ? { formatSumber: 'tka2026' as const } : { formatSumber: 'lms' as const }),
  }
}

/**
 * Pecah teks CSV menjadi baris × sel (RFC 4180 secukupnya): sel bertanda kutip boleh memuat
 * koma / titik koma / baris baru, `""` = tanda kutip. Pemisah otomatis `,` atau `;` (Excel
 * dengan pengaturan regional Indonesia menyimpan CSV memakai `;`). BOM dibuang.
 */
export function pecahCsv(teks: string): string[][] {
  const t = teks.replace(/^\uFEFF/, '')
  const baris1 = t.split(/\r?\n/, 1)[0] ?? ''
  const jmlKoma = (baris1.match(/,/g) ?? []).length
  const jmlTitikKoma = (baris1.match(/;/g) ?? []).length
  const pemisah = jmlTitikKoma > jmlKoma ? ';' : ','
  const hasil: string[][] = []
  let baris: string[] = []
  let sel = ''
  let dalamKutip = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (dalamKutip) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          sel += '"'
          i++
        } else dalamKutip = false
      } else sel += c
    } else if (c === '"') {
      dalamKutip = true
    } else if (c === pemisah) {
      baris.push(sel)
      sel = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      baris.push(sel)
      hasil.push(baris)
      baris = []
      sel = ''
    } else sel += c
  }
  if (sel !== '' || baris.length) {
    baris.push(sel)
    hasil.push(baris)
  }
  return hasil
}

/** Parse CSV (kompatibel Excel; lihat pecahCsv untuk pemisah & tanda kutip). */
export function parseCsvImport(teks: string): HasilParseImport {
  const rows = pecahCsv(teks).filter((r) => r.some((c) => c.trim()))
  if (rows.length < 2) {
    return { metadata: { mapel: '' }, soal: [], galat: ['File CSV kosong atau hanya header.'], gagalParse: true }
  }
  const headerAsli = rows[0].map((h) => h.trim())
  const header = headerAsli.map((h) => h.toLowerCase())
  const idx = (nama: string[]) => header.findIndex((h) => nama.some((n) => h.includes(n)))
  const iMapel = idx(['mapel', 'mata pelajaran'])
  const iTpId = idx(['tpid', 'tp id'])
  const iTpNomor = idx(['tpnomor', 'tp nomor', 'nomor tp'])
  const iTpNama = idx(['tpnama', 'tp nama', 'tujuan'])
  const iMateri = idx(['tipemateri', 'tipe materi', 'materi'])
  // Kolom mapel boleh tidak ada: mode «Tanpa TP» memakai mapel ruang; mode lain ditolak validator metadata
  // dengan pesan «File import tidak memuat mata pelajaran».

  const meta: MetadataImport = {
    mapel: '',
    tpId: undefined,
    tpNomor: undefined,
    tpNama: undefined,
    tipeMateri: undefined,
  }
  const soal: Partial<Soal>[] = []
  const galat: string[] = []
  const tpSet = new Set<string>()

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r].map((c) => c.trim())
    const raw: Record<string, unknown> = {}
    // Simpan di bawah nama asli (opsiA, tipeMateri, …) DAN huruf kecil: normalisasiSoalDariImport
    // membaca kunci camelCase; hanya huruf kecil membuat semua soal PG ditolak («minimal 2 opsi»).
    headerAsli.forEach((h, i) => {
      const v = cols[i] || ''
      raw[h] = v
      raw[header[i]] = v
    })
    if (iMapel >= 0 && cols[iMapel]) meta.mapel = cols[iMapel]
    if (iTpId >= 0 && cols[iTpId]) meta.tpId = cols[iTpId]
    if (iTpNomor >= 0 && cols[iTpNomor]) meta.tpNomor = Number(cols[iTpNomor]) || undefined
    if (iTpNama >= 0 && cols[iTpNama]) meta.tpNama = cols[iTpNama]
    if (iMateri >= 0 && cols[iMateri]) meta.tipeMateri = cols[iMateri]
    const tpKey = `${meta.tpId || ''}|${meta.tpNomor || ''}|${meta.tpNama || ''}`
    if (tpKey) tpSet.add(tpKey)

    const hasil = normalisasiSoalDariImport(raw, r - 1)
    if (hasil.galat) galat.push(hasil.galat)
    else if (hasil.soal) soal.push(hasil.soal)
  }
  if (tpSet.size > 1) galat.unshift('File memuat lebih dari satu TP. Import bank soal hanya mendukung satu TP agar mudah dievaluasi.')
  return { metadata: meta, soal, galat }
}


/** Generate template JSON untuk satu TP. */
/** Contoh soal untuk template bank soal mapel biasa (dipakai template per-TP dan «Tanpa TP»). */
function contohSoalMapel(): Record<string, unknown>[] {
  return [
    {
      tipe: 'pg',
      teks: 'Contoh soal pilihan ganda.',
      kompleksitas: 'L1',
      poin: 1,
      waktuMenit: 1,
      opsi: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
      kunci: 'A',
      pembahasan: 'Penjelasan jawaban.',
    },
    {
      tipe: 'pgk',
      teks: 'Contoh soal pilihan ganda kompleks (pilih dua jawaban benar).',
      kompleksitas: 'L2',
      poin: 1,
      waktuMenit: 2,
      opsi: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
      kunci: ['A', 'C'],
      pembahasan: 'Penjelasan.',
    },
    {
      tipe: 'isian',
      teks: 'Contoh soal isian singkat.',
      kompleksitas: 'L1',
      poin: 1,
      waktuMenit: 1,
      kunci: ['jawaban benar', 'variasi jawaban'],
      pembahasan: 'Penjelasan.',
    },
    {
      tipe: 'jodoh',
      teks: 'Contoh soal menjodohkan.',
      kompleksitas: 'L2',
      poin: 1,
      waktuMenit: 2,
      pasangan: [
        { kiri: 'Kiri 1', kanan: 'Kanan 1' },
        { kiri: 'Kiri 2', kanan: 'Kanan 2' },
      ],
      pembahasan: 'Penjelasan.',
    },
    {
      tipe: 'bs',
      teks: 'Contoh soal benar/salah.',
      kompleksitas: 'L1',
      poin: 1,
      waktuMenit: 1,
      pernyataan: [
        { teks: 'Pernyataan pertama benar.', benar: true },
        { teks: 'Pernyataan kedua salah.', benar: false },
      ],
      pembahasan: 'Penjelasan.',
    },
    {
      tipe: 'uraian',
      teks: 'Contoh soal uraian.',
      kompleksitas: 'L2',
      poin: 2,
      waktuMenit: 3,
      kunciJawaban: 'Pedoman jawaban singkat.',
      pembahasan: 'Penjelasan.',
    },
  ]
}

export function buatTemplateJson(mapel: string, tp: TpRingkas): string {
  const contoh = {
    mapel,
    tpId: tp.id,
    tpNomor: tp.nomorTp,
    tpNama: tp.namaTp,
    catatan: 'Isi array soal. Jangan ubah mapel/tpId. Satu file = satu TP. Setiap tipe memiliki field wajib yang berbeda.',
    soal: contohSoalMapel(),
  }
  return JSON.stringify(contoh, null, 2)
}

/** Generate template CSV untuk satu TP. */
export function buatTemplateCsv(mapel: string, tp: TpRingkas): string {
  const header = 'mapel,tpId,tpNomor,tpNama,tipe,teks,kompleksitas,poin,waktuMenit,opsiA,opsiB,opsiC,opsiD,kunci,pembahasan'
  const rows = [
    `${mapel},${tp.id},${tp.nomorTp},"${tp.namaTp}",pg,"Contoh soal pilihan ganda.",L1,1,1,"Pilihan A","Pilihan B","Pilihan C","Pilihan D",A,"Penjelasan."`,
    `${mapel},${tp.id},${tp.nomorTp},"${tp.namaTp}",isian,"Contoh soal isian.",L1,1,1,,,,,"jawaban benar","Penjelasan."`,
  ]
  return `${header}\n${rows.join('\n')}\n`
}

/** Template JSON bank soal TANPA TP — soal boleh berasal dari gabungan beberapa TP. */
export function buatTemplateJsonTanpaTp(mapel: string): string {
  const contoh = {
    mapel,
    tanpaTp: true,
    catatan:
      'Template TANPA TP: soal boleh gabungan beberapa TP. Jangan menambahkan tpId/tpNomor/tpNama dan jangan ubah mapel. Pilih «Tanpa TP» saat import. Setiap tipe memiliki field wajib yang berbeda.',
    soal: contohSoalMapel(),
  }
  return JSON.stringify(contoh, null, 2)
}

/** Template CSV bank soal TANPA TP (tanpa kolom TP). */
export function buatTemplateCsvTanpaTp(mapel: string): string {
  const header = 'mapel,tipe,teks,kompleksitas,poin,waktuMenit,opsiA,opsiB,opsiC,opsiD,kunci,pembahasan'
  const rows = [
    `${mapel},pg,"Contoh soal pilihan ganda.",L1,1,1,"Pilihan A","Pilihan B","Pilihan C","Pilihan D",A,"Penjelasan."`,
    `${mapel},isian,"Contoh soal isian.",L1,1,1,,,,,"jawaban benar","Penjelasan."`,
  ]
  return `${header}\n${rows.join('\n')}\n`
}

/** Validasi metadata import untuk bank TKA (materi, bukan TP). */
export function validasiMetadataTka(
  meta: MetadataImport,
  mapelDiharapkan: string,
  materiDiharapkan?: string | null,
  opts?: { multiMateri?: boolean; formatSumber?: string },
): string[] {
  const galat: string[] = []
  if (!meta.mapel || !meta.mapel.trim()) {
    galat.push('File import tidak memuat mata pelajaran. Import dibatalkan.')
  } else if (meta.mapel.trim().toLowerCase() !== mapelDiharapkan.trim().toLowerCase()) {
    galat.push(`Mata pelajaran di file («${meta.mapel}») tidak cocok dengan ruang TKA («${mapelDiharapkan}»).`)
  }
  // Ekspor tka2026 multi-materi: materi dipecah per paket di UI — tidak wajib tipeMateri tunggal di root
  if (opts?.multiMateri) {
    return galat
  }
  if (!meta.tipeMateri || !meta.tipeMateri.trim()) {
    // Format tka2026 kadang tanpa root tipeMateri tapi tiap soal punya — UI akan isi dari soal
    if (opts?.formatSumber !== 'tka2026') {
      galat.push('File import TKA wajib memuat materi (tipeMateri). Import dibatalkan.')
    }
  }
  if (materiDiharapkan && meta.tipeMateri && meta.tipeMateri.trim() !== materiDiharapkan.trim()) {
    galat.push(
      `Materi di file («${meta.tipeMateri}») tidak sesuai dengan materi yang dipilih («${materiDiharapkan}»).`,
    )
  }
  return galat
}

/** Template JSON bank soal TKA — satu materi, tipe pg/pgk/bs saja. */
export function buatTemplateJsonTka(mapel: string, materi: string): string {
  const contoh = {
    mapel,
    tipeMateri: materi,
    catatan:
      'Import TKA: satu file = satu materi. Tipe: pg, pgk, bs. Field stimulus = bahan bacaan (opsional); teks = pertanyaan.',
    soal: [
      {
        tipe: 'pg',
        stimulus: 'Bahan bacaan singkat (opsional). Boleh HTML sederhana atau tabel.',
        teks: 'Berdasarkan bacaan, manakah pernyataan yang benar?',
        kompleksitas: 'L2',
        poin: 1,
        waktuMenit: 2,
        opsi: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
        kunci: 'A',
        pembahasan: 'Penjelasan jawaban.',
      },
      {
        tipe: 'pgk',
        teks: 'Pilih dua pernyataan yang sesuai dengan materi.',
        kompleksitas: 'L2',
        poin: 1,
        waktuMenit: 2,
        opsi: ['Pernyataan 1', 'Pernyataan 2', 'Pernyataan 3', 'Pernyataan 4'],
        kunci: ['A', 'C'],
        pembahasan: 'Penjelasan.',
      },
      {
        tipe: 'bs',
        teks: 'Tentukan apakah setiap pernyataan sesuai.',
        kompleksitas: 'L1',
        poin: 1,
        waktuMenit: 2,
        pernyataan: [
          { teks: 'Pernyataan pertama sesuai.', benar: true },
          { teks: 'Pernyataan kedua tidak sesuai.', benar: false },
          { teks: 'Pernyataan ketiga sesuai.', benar: true },
          { teks: 'Pernyataan keempat tidak sesuai.', benar: false },
        ],
        labelBenar: 'Sesuai',
        labelSalah: 'Tidak sesuai',
        pembahasan: 'Penjelasan.',
      },
    ],
  }
  return JSON.stringify(contoh, null, 2)
}

/** Template CSV bank soal TKA. */
export function buatTemplateCsvTka(mapel: string, materi: string): string {
  const header =
    'mapel,tipeMateri,tipe,stimulus,teks,kompleksitas,poin,waktuMenit,opsiA,opsiB,opsiC,opsiD,kunci,pembahasan'
  const rows = [
    `${mapel},"${materi}",pg,"Bahan bacaan singkat.","Berdasarkan bacaan, manakah yang benar?",L2,1,2,"Pilihan A","Pilihan B","Pilihan C","Pilihan D",A,"Penjelasan."`,
    `${mapel},"${materi}",pgk,,"Pilih dua pernyataan yang sesuai.",L2,1,2,"P1","P2","P3","P4","A;C","Penjelasan."`,
  ]
  return `${header}\n${rows.join('\n')}\n`
}


import type { KompleksitasSoal, Soal, TipeSoal } from '../types/soal'
import { normalisasiKompleksitas } from '../types/soal'
import { soalBaru } from './soal'
import type { TpRingkas } from '../types/materi'

/** Metadata wajib pada setiap import bank soal. */
export interface MetadataImport {
  mapel: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
}

/** Hasil parse file import. */
export interface HasilParseImport {
  metadata: MetadataImport
  soal: Partial<Soal>[]
  galat: string[]
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
    galat.push('File import tidak memuat Tujuan Pembelajaran (TP). Import dibatalkan.')
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

/** Ubah baris data mentah menjadi soal yang valid (minimal). */
export function normalisasiSoalDariImport(raw: Record<string, unknown>, index: number): { soal?: Partial<Soal>; galat?: string } {
  const tipeRaw = String(raw.tipe || raw.bentuk || raw.jenis || '').toLowerCase().trim()
  const mapTipe: Record<string, TipeSoal> = {
    pg: 'pg', 'pilihan ganda': 'pg', 'pilihan-ganda': 'pg',
    pgk: 'pgk', 'pg kompleks': 'pgk', 'pilihan ganda kompleks': 'pgk',
    jodoh: 'jodoh', menjodohkan: 'jodoh',
    bs: 'bs', 'benar salah': 'bs', 'benar/salah': 'bs',
    isian: 'isian', 'isian singkat': 'isian',
    uraian: 'uraian',
  }
  const tipe = mapTipe[tipeRaw]
  if (!tipe) return { galat: `Baris ${index + 1}: tipe soal tidak dikenali («${tipeRaw || 'kosong'}»).` }

  const teks = String(raw.teks || raw.narasi || raw.pertanyaan || raw.stimulus || '').trim()
  if (!teks) return { galat: `Baris ${index + 1}: narasi/teks soal kosong.` }

  const dasar = soalBaru(tipe)
  const soal: Partial<Soal> = {
    ...dasar,
    teks,
    kompleksitas: normalisasiKompleksitas(raw.kompleksitas),
    poin: Number(raw.poin) > 0 ? Number(raw.poin) : dasar.poin,
    waktuMenit: Number(raw.waktuMenit) > 0 ? Number(raw.waktuMenit) : dasar.waktuMenit,
    pembahasan: String(raw.pembahasan || raw.penjelasan || '').trim() || undefined,
  }

  // Opsi / kunci sederhana untuk PG (bisa diperluas)
  if (tipe === 'pg' || tipe === 'pgk') {
    const opsi: { id: string; teks: string }[] = []
    for (const key of ['opsiA', 'opsiB', 'opsiC', 'opsiD', 'opsiE', 'A', 'B', 'C', 'D', 'E']) {
      const v = raw[key]
      if (typeof v === 'string' && v.trim()) opsi.push({ id: key.replace(/opsi/i, '').toLowerCase() || key.toLowerCase(), teks: v.trim() })
    }
    if (Array.isArray(raw.opsi)) {
      for (const o of raw.opsi) {
        if (typeof o === 'string' && o.trim()) opsi.push({ id: `o${opsi.length}`, teks: o.trim() })
      }
    }
    if (opsi.length >= 2) {
      ;(soal as any).opsi = opsi.map((o, i) => ({ id: o.id || `opt${i}`, teks: o.teks }))
      const kunciRaw = String(raw.kunci || raw.jawaban || '').trim().toLowerCase()
      if (tipe === 'pg') {
        const match = opsi.find((o) => o.id === kunciRaw || o.teks.toLowerCase() === kunciRaw)
        ;(soal as any).kunci = match?.id || opsi[0].id
      }
    }
  }

  return { soal }
}

/** Parse JSON template. */
export function parseJsonImport(teks: string): HasilParseImport {
  const galat: string[] = []
  let data: any
  try {
    data = JSON.parse(teks)
  } catch {
    return { metadata: { mapel: '' }, soal: [], galat: ['File JSON tidak valid.'] }
  }
  const meta: MetadataImport = {
    mapel: String(data.mapel || data.mataPelajaran || '').trim(),
    tpId: data.tpId || data.tujuanPembelajaranId || undefined,
    tpNomor: typeof data.tpNomor === 'number' ? data.tpNomor : undefined,
    tpNama: data.tpNama || data.tujuanPembelajaran || undefined,
  }
  const daftar = Array.isArray(data.soal) ? data.soal : Array.isArray(data) ? data : []
  const soal: Partial<Soal>[] = []
  daftar.forEach((item: any, i: number) => {
    const r = normalisasiSoalDariImport(item, i)
    if (r.galat) galat.push(r.galat)
    else if (r.soal) soal.push(r.soal)
  })
  if (soal.length === 0 && galat.length === 0) galat.push('Tidak ada soal yang berhasil diparse.')
  return { metadata: meta, soal, galat }
}

/** Parse CSV sederhana (kompatibel Excel). */
export function parseCsvImport(teks: string): HasilParseImport {
  const lines = teks.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { metadata: { mapel: '' }, soal: [], galat: ['File CSV kosong atau hanya header.'] }
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const idx = (nama: string[]) => header.findIndex((h) => nama.some((n) => h.includes(n)))
  const iMapel = idx(['mapel', 'mata pelajaran'])
  const iTpId = idx(['tpid', 'tp id'])
  const iTpNomor = idx(['tpnomor', 'tp nomor', 'nomor tp'])
  const iTpNama = idx(['tpnama', 'tp nama', 'tujuan'])
  if (iMapel < 0) return { metadata: { mapel: '' }, soal: [], galat: ['Kolom mata pelajaran tidak ditemukan.'] }

  const meta: MetadataImport = { mapel: '' }
  const soal: Partial<Soal>[] = []
  const galat: string[] = []
  const tpSet = new Set<string>()

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    if (cols.every((c) => !c)) continue
    if (!meta.mapel && iMapel >= 0) meta.mapel = cols[iMapel] || ''
    const tpKey = [cols[iTpId] || '', cols[iTpNomor] || '', cols[iTpNama] || ''].join('|')
    tpSet.add(tpKey)
    if (iTpId >= 0 && cols[iTpId]) meta.tpId = cols[iTpId]
    if (iTpNomor >= 0 && cols[iTpNomor]) meta.tpNomor = Number(cols[iTpNomor]) || undefined
    if (iTpNama >= 0 && cols[iTpNama]) meta.tpNama = cols[iTpNama]

    const raw: Record<string, unknown> = {}
    header.forEach((h, i) => { raw[h] = cols[i] || '' })
    const hasil = normalisasiSoalDariImport(raw, r - 1)
    if (hasil.galat) galat.push(hasil.galat)
    else if (hasil.soal) soal.push(hasil.soal)
  }
  if (tpSet.size > 1) galat.unshift('File memuat lebih dari satu TP. Import bank soal hanya mendukung satu TP agar mudah dievaluasi.')
  return { metadata: meta, soal, galat }
}

/** Generate template JSON untuk satu TP. */
export function buatTemplateJson(mapel: string, tp: TpRingkas): string {
  const contoh = {
    mapel,
    tpId: tp.id,
    tpNomor: tp.nomorTp,
    tpNama: tp.namaTp,
    catatan: 'Isi array soal. Jangan ubah mapel/tpId. Satu file = satu TP.',
    soal: [
      {
        tipe: 'pg',
        teks: 'Contoh narasi soal (boleh HTML sederhana).',
        kompleksitas: 'L1' as KompleksitasSoal,
        poin: 1,
        waktuMenit: 1,
        opsi: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
        kunci: 'A',
        pembahasan: 'Penjelasan jawaban.',
      },
    ],
  }
  return JSON.stringify(contoh, null, 2)
}

/** Generate template CSV untuk satu TP. */
export function buatTemplateCsv(mapel: string, tp: TpRingkas): string {
  const header = 'mapel,tpId,tpNomor,tpNama,tipe,teks,kompleksitas,poin,waktuMenit,opsiA,opsiB,opsiC,opsiD,kunci,pembahasan'
  const contoh = `${mapel},${tp.id},${tp.nomorTp},"${tp.namaTp}",pg,"Contoh narasi soal.",L1,1,1,"Pilihan A","Pilihan B","Pilihan C","Pilihan D",A,"Penjelasan."`
  return `${header}\n${contoh}\n`
}

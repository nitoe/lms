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

function normalisasiTeksUntukDuplikat(teks: string): string {
  return teksPolos(teks)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ubah baris data mentah menjadi soal yang valid. Tolak jika tidak lengkap. */
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

  const stimulusRaw = String(raw.stimulus || raw.bacaan || '').trim()
  const teks = String(raw.teks || raw.narasi || raw.pertanyaan || '').trim()
  // Kompatibilitas lama: jika hanya ada stimulus, anggap itu teks soal (mapel biasa).
  const teksFinal = teks || (!stimulusRaw ? '' : '')
  if (!teksFinal && !stimulusRaw) return { galat: `Baris ${index + 1}: narasi/teks soal kosong.` }

  const dasar = soalBaru(tipe)
  const soal: Partial<Soal> = {
    ...dasar,
    teks: teksFinal || (stimulusRaw ? 'Berdasarkan bacaan di atas, pilihlah jawaban yang tepat.' : ''),
    kompleksitas: normalisasiKompleksitas(raw.kompleksitas),
    poin: Number(raw.poin) > 0 ? Number(raw.poin) : dasar.poin,
    waktuMenit: Number(raw.waktuMenit) > 0 ? Number(raw.waktuMenit) : dasar.waktuMenit,
    pembahasan: String(raw.pembahasan || raw.penjelasan || '').trim() || undefined,
    ...(stimulusRaw ? { stimulus: stimulusRaw } : {}),
    ...(String(raw.tipeMateri || raw.materi || '').trim()
      ? { tipeMateri: String(raw.tipeMateri || raw.materi).trim() }
      : {}),
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

    const kunciRaw = String(raw.kunci || raw.jawaban || '').trim()
    if (!kunciRaw) return { galat: `Baris ${index + 1}: soal ${tipe.toUpperCase()} tidak memiliki kunci jawaban.` }

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
      // 3. Cocokkan teks persis
      m = opsi.find((o) => o.teks.toLowerCase() === k)
      if (m) return m
      // 4. Cocokkan teks yang mengandung kunci (hati-hati)
      m = opsi.find((o) => o.teks.toLowerCase().includes(k) && k.length > 2)
      return m
    }

    if (tipe === 'pg') {
      const match = cariOpsi(kunciRaw)
      if (!match) return { galat: `Baris ${index + 1}: kunci «${kunciRaw}» tidak cocok dengan opsi manapun.` }
      ;(soal as any).kunci = match.id
    } else {
      const daftarKunci = Array.isArray(raw.kunci) ? raw.kunci.map(String) : kunciRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      const kunciIds: string[] = []
      for (const k of daftarKunci) {
        const match = cariOpsi(k)
        if (match) kunciIds.push(match.id)
      }
      if (kunciIds.length === 0) return { galat: `Baris ${index + 1}: tidak ada kunci yang cocok dengan opsi.` }
      if (kunciIds.length > 2) return { galat: `Baris ${index + 1}: PG kompleks untuk SD idealnya hanya 1–2 jawaban benar.` }
      ;(soal as any).kunci = kunciIds
      ;(soal as any).nilaiParsial = raw.nilaiParsial !== false
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

  // --- Benar/Salah ---
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
    }
    if (pernyataan.length < 1) return { galat: `Baris ${index + 1}: soal benar/salah minimal harus punya 1 pernyataan.` }
    ;(soal as any).pernyataan = pernyataan
    ;(soal as any).nilaiParsial = raw.nilaiParsial !== false
  }

  // --- Uraian ---
  if (tipe === 'uraian') {
    const kunci = String(raw.kunciJawaban || raw.kunci || raw.jawaban || '').trim()
    if (kunci) (soal as any).kunciJawaban = kunci
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
    tipeMateri: data.tipeMateri || data.materi
      ? String(data.tipeMateri || data.materi).trim()
      : undefined,
  }
  const daftar = Array.isArray(data.soal) ? data.soal : Array.isArray(data) ? data : []
  const soal: Partial<Soal>[] = []
  const teksTerlihat = new Set<string>()

  daftar.forEach((item: any, i: number) => {
    const r = normalisasiSoalDariImport(item, i)
    if (r.galat) {
      galat.push(r.galat)
      return
    }
    if (r.soal) {
      const normal = normalisasiTeksUntukDuplikat(r.soal.teks || '')
      if (normal && teksTerlihat.has(normal)) {
        galat.push(`Baris ${i + 1}: soal duplikat (teks hampir sama dengan soal sebelumnya).`)
        return
      }
      if (normal) teksTerlihat.add(normal)
      soal.push(r.soal)
    }
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
  const iMateri = idx(['tipemateri', 'tipe materi', 'materi'])
  if (iMapel < 0) return { metadata: { mapel: '' }, soal: [], galat: ['Kolom mata pelajaran tidak ditemukan.'] }

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

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    if (cols.every((c) => !c)) continue
    const raw: Record<string, unknown> = {}
    header.forEach((h, i) => { raw[h] = cols[i] || '' })
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
export function buatTemplateJson(mapel: string, tp: TpRingkas): string {
  const contoh = {
    mapel,
    tpId: tp.id,
    tpNomor: tp.nomorTp,
    tpNama: tp.namaTp,
    catatan: 'Isi array soal. Jangan ubah mapel/tpId. Satu file = satu TP. Setiap tipe memiliki field wajib yang berbeda.',
    soal: [
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
    ],
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

/** Validasi metadata import untuk bank TKA (materi, bukan TP). */
export function validasiMetadataTka(
  meta: MetadataImport,
  mapelDiharapkan: string,
  materiDiharapkan?: string | null,
): string[] {
  const galat: string[] = []
  if (!meta.mapel || !meta.mapel.trim()) {
    galat.push('File import tidak memuat mata pelajaran. Import dibatalkan.')
  } else if (meta.mapel.trim().toLowerCase() !== mapelDiharapkan.trim().toLowerCase()) {
    galat.push(`Mata pelajaran di file («${meta.mapel}») tidak cocok dengan ruang TKA («${mapelDiharapkan}»).`)
  }
  if (!meta.tipeMateri || !meta.tipeMateri.trim()) {
    galat.push('File import TKA wajib memuat materi (tipeMateri). Import dibatalkan.')
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


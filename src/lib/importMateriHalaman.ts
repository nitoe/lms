/**
 * Template & impor materi multi-halaman (JSON).
 * Selaras pola importSoal: unduh template → isi → impor ke editor.
 *
 * Format (versi 1):
 * {
 *   versi: 1,
 *   jenis: "materi-halaman",
 *   mapel?, judul?, deskripsi?, bab?, tpNomor?, tpNama?,
 *   halaman: [{ judul?, blok: [{ tipe:"teks", html|teks }, { tipe:"gambar", url?, alt?, caption?, petunjukGambar? }] }]
 * }
 *
 * Gambar: url publik opsional; tanpa url isi petunjukGambar agar bisa digenerate AI / diunggah di editor.
 * Field `teks` (polos) otomatis diubah ke paragraf HTML.
 */
import { bersihHtmlMateri, htmlKosong } from './html'
import { idBaru } from './materi'
import type { MateriBlok, MateriHalaman, TpRingkas } from '../types/materi'
import { BATAS_BLOK_PER_HALAMAN, BATAS_HALAMAN_PER_MATERI } from '../types/materi'

export const VERSI_IMPORT_MATERI_HALAMAN = 1
export const JENIS_IMPORT_MATERI_HALAMAN = 'materi-halaman'

export type MetadataImportMateriHalaman = {
  mapel?: string
  judul?: string
  deskripsi?: string
  bab?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
}

export type HasilParseMateriHalaman = {
  metadata: MetadataImportMateriHalaman
  halaman: MateriHalaman[]
  galat: string[]
  peringatan: string[]
}

function teksPolosKeHtml(teks: string): string {
  const t = teks.replace(/\r\n/g, '\n').trim()
  if (!t) return ''
  // Sudah HTML kasar?
  if (/<[a-z][\s\S]*>/i.test(t)) return bersihHtmlMateri(t)
  const paragraf = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeMinimal(p).replace(/\n/g, '<br>')}</p>`)
  return paragraf.join('') || `<p>${escapeMinimal(t)}</p>`
}

function escapeMinimal(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalisasiBlok(raw: unknown, indexHalaman: number, indexBlok: number): { blok?: MateriBlok; galat?: string } {
  if (!raw || typeof raw !== 'object') {
    return { galat: `Halaman ${indexHalaman + 1}, blok ${indexBlok + 1}: format tidak valid.` }
  }
  const o = raw as Record<string, unknown>
  const tipe = String(o.tipe || o.jenis || '').toLowerCase().trim()

  if (tipe === 'teks' || tipe === 'text' || tipe === 'paragraph') {
    const htmlRaw =
      typeof o.html === 'string'
        ? o.html
        : typeof o.teks === 'string'
          ? teksPolosKeHtml(o.teks)
          : typeof o.text === 'string'
            ? teksPolosKeHtml(o.text)
            : ''
    const html = bersihHtmlMateri(htmlRaw)
    return {
      blok: {
        id: idBaru('b'),
        tipe: 'teks',
        html,
      },
    }
  }

  if (tipe === 'gambar' || tipe === 'image' || tipe === 'img') {
    const url = typeof o.url === 'string' ? o.url.trim() : ''
    const petunjuk =
      typeof o.petunjukGambar === 'string'
        ? o.petunjukGambar.trim().slice(0, 2000)
        : typeof o.petunjuk === 'string'
          ? o.petunjuk.trim().slice(0, 2000)
          : typeof o.prompt === 'string'
            ? o.prompt.trim().slice(0, 2000)
            : ''
    if (!url && !petunjuk) {
      return {
        galat: `Halaman ${indexHalaman + 1}, blok ${indexBlok + 1}: gambar wajib punya url atau petunjukGambar.`,
      }
    }
    if (url) {
      try {
        // Izinkan http(s) saja
        const u = new URL(url)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return { galat: `Halaman ${indexHalaman + 1}, blok ${indexBlok + 1}: url gambar harus http(s).` }
        }
      } catch {
        return { galat: `Halaman ${indexHalaman + 1}, blok ${indexBlok + 1}: url gambar tidak valid.` }
      }
    }
    const item: Extract<MateriBlok, { tipe: 'gambar' }> = {
      id: idBaru('b'),
      tipe: 'gambar',
      url: url || '',
    }
    const alt = typeof o.alt === 'string' ? o.alt.trim().slice(0, 200) : ''
    if (alt) item.alt = alt
    const caption = typeof o.caption === 'string' ? o.caption.trim().slice(0, 300) : ''
    if (caption) item.caption = caption
    if (petunjuk) item.petunjukGambar = petunjuk
    return { blok: item }
  }

  return {
    galat: `Halaman ${indexHalaman + 1}, blok ${indexBlok + 1}: tipe «${tipe || 'kosong'}» tidak dikenali (teks|gambar).`,
  }
}

function normalisasiSatuHalaman(raw: unknown, index: number): { halaman?: MateriHalaman; galat: string[] } {
  const galat: string[] = []
  if (!raw || typeof raw !== 'object') {
    return { galat: [`Halaman ${index + 1}: format tidak valid.`] }
  }
  const o = raw as Record<string, unknown>
  const judul =
    typeof o.judul === 'string'
      ? o.judul.trim().slice(0, 80)
      : typeof o.title === 'string'
        ? o.title.trim().slice(0, 80)
        : ''

  let daftarBlok: unknown[] = []
  if (Array.isArray(o.blok)) daftarBlok = o.blok
  else if (Array.isArray(o.blocks)) daftarBlok = o.blocks
  else if (typeof o.html === 'string' || typeof o.teks === 'string' || typeof o.text === 'string') {
    // Pintasan: satu halaman = satu blok teks
    daftarBlok = [{ tipe: 'teks', html: o.html, teks: o.teks ?? o.text }]
  }

  if (daftarBlok.length === 0) {
    galat.push(`Halaman ${index + 1}: tidak ada blok konten.`)
    return { galat }
  }
  if (daftarBlok.length > BATAS_BLOK_PER_HALAMAN) {
    galat.push(`Halaman ${index + 1}: maksimal ${BATAS_BLOK_PER_HALAMAN} blok (ada ${daftarBlok.length}).`)
    daftarBlok = daftarBlok.slice(0, BATAS_BLOK_PER_HALAMAN)
  }

  const blok: MateriBlok[] = []
  for (let i = 0; i < daftarBlok.length; i++) {
    const r = normalisasiBlok(daftarBlok[i], index, i)
    if (r.galat) galat.push(r.galat)
    if (r.blok) {
      if (r.blok.tipe === 'teks' && htmlKosong(r.blok.html) && daftarBlok.length > 1) continue
      blok.push(r.blok)
    }
  }
  if (blok.length === 0) {
    galat.push(`Halaman ${index + 1}: tidak ada blok valid.`)
    return { galat }
  }

  const h: MateriHalaman = {
    id: idBaru('h'),
    urutan: index,
    blok,
  }
  if (judul) h.judul = judul
  return { halaman: h, galat }
}

/** Parse teks file JSON menjadi halaman editor. */
export function parseJsonMateriHalaman(teks: string): HasilParseMateriHalaman {
  const galat: string[] = []
  const peringatan: string[] = []
  let data: unknown
  try {
    data = JSON.parse(teks)
  } catch {
    return {
      metadata: {},
      halaman: [],
      galat: ['File bukan JSON yang valid.'],
      peringatan: [],
    }
  }

  // Izinkan array halaman langsung
  let root: Record<string, unknown>
  if (Array.isArray(data)) {
    root = { halaman: data }
  } else if (data && typeof data === 'object') {
    root = data as Record<string, unknown>
  } else {
    return {
      metadata: {},
      halaman: [],
      galat: ['Struktur file tidak dikenali.'],
      peringatan: [],
    }
  }

  if (root.jenis && String(root.jenis) !== JENIS_IMPORT_MATERI_HALAMAN) {
    peringatan.push(
      `Field jenis «${String(root.jenis)}» — diharapkan «${JENIS_IMPORT_MATERI_HALAMAN}». Tetap diproses.`,
    )
  }

  const metadata: MetadataImportMateriHalaman = {}
  if (typeof root.mapel === 'string' && root.mapel.trim()) metadata.mapel = root.mapel.trim()
  if (typeof root.judul === 'string' && root.judul.trim()) metadata.judul = root.judul.trim().slice(0, 200)
  if (typeof root.deskripsi === 'string' && root.deskripsi.trim())
    metadata.deskripsi = root.deskripsi.trim().slice(0, 2000)
  if (typeof root.bab === 'string' && root.bab.trim()) metadata.bab = root.bab.trim().slice(0, 120)
  if (typeof root.tpId === 'string' && root.tpId.trim()) metadata.tpId = root.tpId.trim()
  if (typeof root.tpNomor === 'number' && Number.isFinite(root.tpNomor)) metadata.tpNomor = root.tpNomor
  if (typeof root.tpNama === 'string' && root.tpNama.trim()) metadata.tpNama = root.tpNama.trim()

  let daftar: unknown[] = []
  if (Array.isArray(root.halaman)) daftar = root.halaman
  else if (Array.isArray(root.pages)) daftar = root.pages
  else if (Array.isArray(root.isi)) daftar = root.isi

  if (daftar.length === 0) {
    return {
      metadata,
      halaman: [],
      galat: ['Tidak ada array «halaman» di file.'],
      peringatan,
    }
  }
  if (daftar.length > BATAS_HALAMAN_PER_MATERI) {
    galat.push(`Maksimal ${BATAS_HALAMAN_PER_MATERI} halaman; file memuat ${daftar.length} (sisanya diabaikan).`)
    daftar = daftar.slice(0, BATAS_HALAMAN_PER_MATERI)
  }

  const halaman: MateriHalaman[] = []
  for (let i = 0; i < daftar.length; i++) {
    const r = normalisasiSatuHalaman(daftar[i], i)
    galat.push(...r.galat)
    if (r.halaman) {
      r.halaman.urutan = halaman.length
      halaman.push(r.halaman)
    }
  }

  if (halaman.length === 0 && galat.length === 0) {
    galat.push('Tidak ada halaman yang berhasil diparse.')
  }

  return { metadata, halaman, galat, peringatan }
}

/** Validasi ringan mapel / TP (peringatan, tidak membatalkan impor di editor). */
export function peringatanMetadataMateri(
  meta: MetadataImportMateriHalaman,
  mapelDiharapkan: string,
  tpDipilih?: TpRingkas | null,
): string[] {
  const out: string[] = []
  if (meta.mapel && meta.mapel.trim().toLowerCase() !== mapelDiharapkan.trim().toLowerCase()) {
    out.push(`Mapel di file («${meta.mapel}») berbeda dari ruang («${mapelDiharapkan}»).`)
  }
  if (tpDipilih && (meta.tpId || meta.tpNomor || meta.tpNama)) {
    const cocokId = meta.tpId && meta.tpId === tpDipilih.id
    const cocokNomor = typeof meta.tpNomor === 'number' && meta.tpNomor === tpDipilih.nomorTp
    const cocokNama =
      meta.tpNama && meta.tpNama.trim().toLowerCase() === (tpDipilih.namaTp || '').trim().toLowerCase()
    if (!cocokId && !cocokNomor && !cocokNama) {
      out.push(
        `TP di file (TP ${meta.tpNomor ?? '?'} · ${meta.tpNama || meta.tpId || '—'}) tidak cocok dengan TP terpilih (TP ${tpDipilih.nomorTp}. ${tpDipilih.namaTp}). Judul/isi tetap diimpor.`,
      )
    }
  }
  return out
}

/** Template JSON contoh untuk guru. */
export function buatTemplateMateriHalamanJson(
  mapel: string,
  tp?: TpRingkas | null,
  opsi?: { judul?: string },
): string {
  const contoh = {
    versi: VERSI_IMPORT_MATERI_HALAMAN,
    jenis: JENIS_IMPORT_MATERI_HALAMAN,
    mapel,
    judul: opsi?.judul || 'Contoh materi multi-halaman',
    deskripsi: 'Impor ke editor materi halaman. Sesuaikan isi, lalu Simpan.',
    bab: '',
    tpId: tp?.id || '',
    tpNomor: tp?.nomorTp ?? 1,
    tpNama: tp?.namaTp || 'Nama Tujuan Pembelajaran',
    catatan:
      'Isi array halaman. Setiap halaman punya blok teks (html atau teks polos) dan/atau gambar (url http(s) dan/atau petunjukGambar untuk AI/unggah manual). Maks 20 halaman, 30 blok per halaman. Jangan ubah field jenis.',
    halaman: [
      {
        judul: 'Pendahuluan',
        blok: [
          {
            tipe: 'teks',
            html: '<p>Selamat belajar! Pada materi ini kita akan mempelajari konsep dasar.</p><p>Baca setiap halaman dengan saksama.</p>',
          },
          {
            tipe: 'gambar',
            alt: 'Ilustrasi pembuka',
            caption: 'Gambar pembuka materi',
            petunjukGambar: 'Ilustrasi ramah anak SD tentang topik materi, gaya flat, cerah, tanpa teks di gambar',
            url: '',
          },
        ],
      },
      {
        judul: 'Penjelasan',
        blok: [
          {
            tipe: 'teks',
            teks: 'Gunakan field «teks» (polos) bila tidak ingin menulis HTML.\n\nParagraf kedua setelah baris kosong.',
          },
          {
            tipe: 'teks',
            html: '<h3>Poin penting</h3><ul><li>Poin pertama</li><li>Poin kedua</li></ul><p>Rumus contoh: $a^2 + b^2 = c^2$</p>',
          },
        ],
      },
      {
        judul: 'Latihan singkat',
        blok: [
          {
            tipe: 'teks',
            html: '<p>Coba kerjakan soal berikut di buku latihanmu.</p><ol><li>Soal 1…</li><li>Soal 2…</li></ol>',
          },
        ],
      },
    ],
  }
  return JSON.stringify(contoh, null, 2)
}

/** Ekspor halaman editor saat ini ke JSON (bisa diedit & diimpor lagi). */
export function eksporMateriHalamanKeJson(
  meta: {
    mapel: string
    judul?: string
    deskripsi?: string
    bab?: string
    tpId?: string
    tpNomor?: number
    tpNama?: string
  },
  halaman: MateriHalaman[],
): string {
  const out = {
    versi: VERSI_IMPORT_MATERI_HALAMAN,
    jenis: JENIS_IMPORT_MATERI_HALAMAN,
    mapel: meta.mapel,
    judul: meta.judul || '',
    deskripsi: meta.deskripsi || '',
    bab: meta.bab || '',
    tpId: meta.tpId || '',
    tpNomor: meta.tpNomor ?? null,
    tpNama: meta.tpNama || '',
    halaman: halaman.map((h, i) => ({
      judul: h.judul || `Halaman ${i + 1}`,
      blok: h.blok.map((b) => {
        if (b.tipe === 'teks') {
          return { tipe: 'teks' as const, html: b.html || '' }
        }
        return {
          tipe: 'gambar' as const,
          url: b.url || '',
          alt: b.alt || '',
          caption: b.caption || '',
          petunjukGambar: b.petunjukGambar || '',
        }
      }),
    })),
  }
  return JSON.stringify(out, null, 2)
}

export function unduhTeksSebagaiFile(nama: string, isi: string, mime: string): void {
  const blob = new Blob([isi], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Template & impor **satu halaman** materi (JSON).
 *
 * Alur: unduh template satu halaman → isi banyak blok teks/gambar sesuai
 * kompleksitas → impor (ganti halaman aktif ATAU tambah halaman baru).
 * Satu file = satu halaman saja, agar kualitas konten terjaga.
 *
 * Format (versi 2):
 * {
 *   versi: 2,
 *   jenis: "materi-halaman",
 *   mapel?, judulMateri?, …
 *   halaman: { judul?, blok: [ … ] }   // objek satu halaman
 * }
 * Kompatibilitas: array «halaman» dengan tepat 1 elemen masih diterima.
 */
import { bersihHtmlMateri, htmlKosong } from './html'
import { idBaru } from './materi'
import type { MateriBlok, MateriHalaman, TpRingkas } from '../types/materi'
import { BATAS_BLOK_PER_HALAMAN } from '../types/materi'

export const VERSI_IMPORT_MATERI_HALAMAN = 2
export const JENIS_IMPORT_MATERI_HALAMAN = 'materi-halaman'

/** Panduan petunjuk gambar — disalin ke field catatan template. */
export const PANDUAN_PETUNJUK_GAMBAR = [
  'Tulis petunjukGambar panjang (3–6 kalimat), bahasa Indonesia, spesifik untuk satu ilustrasi.',
  'Wajib sebutkan: (1) subjek utama & usia/penampilan, (2) kegiatan/objek, (3) latar, (4) gaya gambar, (5) suasana warna.',
  'Gaya default SD: ilustrasi flat / semi-realistis cerah, proporsi ramah anak, tanpa kekerasan.',
  'LARANGAN: jangan minta teks, angka, rumus, label, watermark, atau logo di dalam gambar (teks di gambar sering salah eja).',
  'Konsistensi: sebutkan gaya yang sama di semua blok gambar satu materi (mis. «gaya ilustrasi buku pelajaran SD Indonesia, flat, outline halus»).',
  'Hindari: fotorealistik berlebih, karakter bermerek, konten dewasa, latar ramai yang mengalihkan fokus materi.',
].join(' ')

export type MetadataImportMateriHalaman = {
  mapel?: string
  /** Judul materi (bukan judul halaman). */
  judul?: string
  deskripsi?: string
  bab?: string
  tpId?: string
  tpNomor?: number
  tpNama?: string
}

export type HasilParseMateriHalaman = {
  metadata: MetadataImportMateriHalaman
  /** Selalu 0 atau 1 halaman setelah validasi. */
  halaman: MateriHalaman | null
  galat: string[]
  peringatan: string[]
}

function teksPolosKeHtml(teks: string): string {
  const t = teks.replace(/\r\n/g, '\n').trim()
  if (!t) return ''
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

function normalisasiBlok(
  raw: unknown,
  indexBlok: number,
): { blok?: MateriBlok; galat?: string } {
  if (!raw || typeof raw !== 'object') {
    return { galat: `Blok ${indexBlok + 1}: format tidak valid.` }
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
        galat: `Blok ${indexBlok + 1}: gambar wajib punya url atau petunjukGambar (disarankan petunjuk panjang 3–6 kalimat).`,
      }
    }
    if (url) {
      try {
        const u = new URL(url)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return { galat: `Blok ${indexBlok + 1}: url gambar harus http(s).` }
        }
      } catch {
        return { galat: `Blok ${indexBlok + 1}: url gambar tidak valid.` }
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
    galat: `Blok ${indexBlok + 1}: tipe «${tipe || 'kosong'}» tidak dikenali (teks|gambar).`,
  }
}

function normalisasiSatuHalaman(raw: unknown): {
  halaman?: MateriHalaman
  galat: string[]
  peringatan: string[]
} {
  const galat: string[] = []
  const peringatan: string[] = []
  if (!raw || typeof raw !== 'object') {
    return { galat: ['Objek halaman tidak valid.'], peringatan }
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
    daftarBlok = [{ tipe: 'teks', html: o.html, teks: o.teks ?? o.text }]
  }

  if (daftarBlok.length === 0) {
    galat.push('Halaman tidak memuat blok konten.')
    return { galat, peringatan }
  }
  if (daftarBlok.length > BATAS_BLOK_PER_HALAMAN) {
    galat.push(`Maksimal ${BATAS_BLOK_PER_HALAMAN} blok per halaman (ada ${daftarBlok.length}).`)
    daftarBlok = daftarBlok.slice(0, BATAS_BLOK_PER_HALAMAN)
  }

  const blok: MateriBlok[] = []
  for (let i = 0; i < daftarBlok.length; i++) {
    const r = normalisasiBlok(daftarBlok[i], i)
    if (r.galat) galat.push(r.galat)
    if (r.blok) {
      if (r.blok.tipe === 'teks' && htmlKosong(r.blok.html) && daftarBlok.length > 1) continue
      if (r.blok.tipe === 'gambar' && r.blok.petunjukGambar && r.blok.petunjukGambar.length < 40) {
        peringatan.push(
          `Blok gambar ${i + 1}: petunjukGambar terlalu singkat (${r.blok.petunjukGambar.length} karakter). Disarankan 3–6 kalimat agar AI konsisten.`,
        )
      }
      blok.push(r.blok)
    }
  }
  if (blok.length === 0) {
    galat.push('Tidak ada blok valid di halaman.')
    return { galat, peringatan }
  }

  const jumlahTeks = blok.filter((b) => b.tipe === 'teks').length
  if (jumlahTeks < 2) {
    peringatan.push(
      `Hanya ${jumlahTeks} blok teks. Untuk materi yang kompleks, pecah menjadi beberapa blok teks (pembuka, penjelasan, contoh, latihan) agar lebih rapi di editor.`,
    )
  }

  const h: MateriHalaman = {
    id: idBaru('h'),
    urutan: 0,
    blok,
  }
  if (judul) h.judul = judul
  return { halaman: h, galat, peringatan }
}

/**
 * Parse file JSON → tepat satu halaman.
 * Menolak file yang memuat lebih dari satu halaman.
 */
export function parseJsonMateriHalaman(teks: string): HasilParseMateriHalaman {
  const galat: string[] = []
  const peringatan: string[] = []
  let data: unknown
  try {
    data = JSON.parse(teks)
  } catch {
    return {
      metadata: {},
      halaman: null,
      galat: ['File bukan JSON yang valid.'],
      peringatan: [],
    }
  }

  let root: Record<string, unknown>
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    root = data as Record<string, unknown>
  } else if (Array.isArray(data)) {
    root = { halaman: data }
  } else {
    return {
      metadata: {},
      halaman: null,
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
  const judulMateri =
    (typeof root.judulMateri === 'string' && root.judulMateri.trim()) ||
    (typeof root.judul === 'string' && root.judul.trim()) ||
    ''
  if (judulMateri) metadata.judul = judulMateri.slice(0, 200)
  if (typeof root.deskripsi === 'string' && root.deskripsi.trim())
    metadata.deskripsi = root.deskripsi.trim().slice(0, 2000)
  if (typeof root.bab === 'string' && root.bab.trim()) metadata.bab = root.bab.trim().slice(0, 120)
  if (typeof root.tpId === 'string' && root.tpId.trim()) metadata.tpId = root.tpId.trim()
  if (typeof root.tpNomor === 'number' && Number.isFinite(root.tpNomor)) metadata.tpNomor = root.tpNomor
  if (typeof root.tpNama === 'string' && root.tpNama.trim()) metadata.tpNama = root.tpNama.trim()

  let rawHalaman: unknown = null
  if (root.halaman != null) {
    if (Array.isArray(root.halaman)) {
      if (root.halaman.length === 0) {
        return {
          metadata,
          halaman: null,
          galat: ['Array «halaman» kosong. Satu file harus berisi tepat satu halaman.'],
          peringatan,
        }
      }
      if (root.halaman.length > 1) {
        return {
          metadata,
          halaman: null,
          galat: [
            `File memuat ${root.halaman.length} halaman. Impor dibatasi satu halaman per file agar kualitas terjaga. Pisahkan menjadi beberapa file, lalu impor satu per satu.`,
          ],
          peringatan,
        }
      }
      rawHalaman = root.halaman[0]
    } else if (typeof root.halaman === 'object') {
      rawHalaman = root.halaman
    }
  } else if (Array.isArray(root.pages)) {
    if (root.pages.length > 1) {
      return {
        metadata,
        halaman: null,
        galat: [
          `File memuat ${root.pages.length} halaman. Impor dibatasi satu halaman per file. Pisahkan file, impor satu per satu.`,
        ],
        peringatan,
      }
    }
    rawHalaman = root.pages[0]
  } else if (Array.isArray(root.blok) || Array.isArray(root.blocks)) {
    rawHalaman = { judul: root.judulHalaman || root.judulPage, blok: root.blok || root.blocks }
  }

  if (rawHalaman == null) {
    return {
      metadata,
      halaman: null,
      galat: [
        'Tidak menemukan objek «halaman». Gunakan template (satu objek halaman dengan banyak blok), bukan multi-halaman.',
      ],
      peringatan,
    }
  }

  const hasil = normalisasiSatuHalaman(rawHalaman)
  galat.push(...hasil.galat)
  peringatan.push(...hasil.peringatan)

  return {
    metadata,
    halaman: hasil.halaman ?? null,
    galat,
    peringatan,
  }
}

/** Validasi ringan mapel / TP (peringatan saja). */
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
        `TP di file (TP ${meta.tpNomor ?? '?'} · ${meta.tpNama || meta.tpId || '—'}) tidak cocok dengan TP terpilih (TP ${tpDipilih.nomorTp}. ${tpDipilih.namaTp}). Isi halaman tetap diimpor.`,
      )
    }
  }
  return out
}

/**
 * Template JSON **satu halaman** dengan banyak blok teks + gambar
 * sesuai kompleksitas materi pelajaran SD.
 */
export function buatTemplateMateriHalamanJson(
  mapel: string,
  tp?: TpRingkas | null,
  opsi?: { judul?: string; judulHalaman?: string },
): string {
  const gayaGambar =
    'Gaya ilustrasi buku pelajaran SD Indonesia, flat design, outline halus, warna cerah ramah anak, proporsi tubuh sederhana, tanpa teks atau angka di dalam gambar, tanpa watermark.'

  const contoh = {
    versi: VERSI_IMPORT_MATERI_HALAMAN,
    jenis: JENIS_IMPORT_MATERI_HALAMAN,
    mapel,
    judulMateri: opsi?.judul || 'Judul materi (opsional, diisi ke meta bila masih kosong)',
    deskripsi:
      'Satu file = satu halaman. Untuk halaman berikutnya, unduh template lagi atau salin file ini, lalu impor satu per satu.',
    bab: '',
    tpId: tp?.id || '',
    tpNomor: tp?.nomorTp ?? 1,
    tpNama: tp?.namaTp || 'Nama Tujuan Pembelajaran',
    catatan:
      'PENTING: tepat SATU objek «halaman». Susun beberapa blok teks sesuai kompleksitas (pembuka → penjelasan → contoh → latihan → penutup), selang-seling gambar bila perlu. ' +
      PANDUAN_PETUNJUK_GAMBAR +
      ' Maks 30 blok. Field html untuk rich text; field teks untuk paragraf polos.',
    halaman: {
      judul: opsi?.judulHalaman || 'Judul halaman ini (contoh: Memahami konsep …)',
      blok: [
        {
          tipe: 'teks',
          peran: 'pembuka',
          html:
            '<p><strong>Selamat belajar!</strong> Pada halaman ini kita akan memahami gagasan utama materi.</p>' +
            '<p>Setelah membaca, kamu diharapkan dapat menjelaskan konsep dengan kata-katamu sendiri.</p>',
        },
        {
          tipe: 'teks',
          peran: 'penjelasan',
          html:
            '<h3>Penjelasan</h3>' +
            '<p>Tuliskan penjelasan konsep di sini. Pecah menjadi beberapa paragraf agar mudah dibaca di ponsel.</p>' +
            '<p>Gunakan daftar bila perlu:</p>' +
            '<ul><li>Poin penting pertama</li><li>Poin penting kedua</li><li>Poin penting ketiga</li></ul>' +
            '<p>Contoh rumus (opsional): $a \\times b = c$</p>',
        },
        {
          tipe: 'gambar',
          peran: 'ilustrasi-konsep',
          alt: 'Ilustrasi konsep utama',
          caption: 'Gambar membantu memahami penjelasan di atas',
          petunjukGambar:
            'Ilustrasi untuk anak kelas SD yang sedang belajar topik materi ini. Tunjukkan satu situasi konkret di kelas atau kehidupan sehari-hari yang mencerminkan konsep utama (ganti detail sesuai TP). ' +
            gayaGambar +
            ' Komposisi: subjek di tengah, latar sederhana (meja belajar atau halaman sekolah), ekspresi antusias. Hindari menaruh teks, angka, atau label di dalam gambar.',
          url: '',
        },
        {
          tipe: 'teks',
          peran: 'contoh',
          html:
            '<h3>Contoh</h3>' +
            '<p>Contoh 1: …</p>' +
            '<p>Langkah penyelesaian:</p>' +
            '<ol><li>Langkah pertama</li><li>Langkah kedua</li><li>Kesimpulan</li></ol>' +
            '<p>Contoh 2 (variasi): …</p>',
        },
        {
          tipe: 'gambar',
          peran: 'ilustrasi-contoh',
          alt: 'Ilustrasi contoh soal',
          caption: 'Visualisasi contoh di atas',
          petunjukGambar:
            'Ilustrasi langkah contoh soal untuk anak SD, menampilkan benda atau situasi yang sama dengan contoh teks (sesuaikan objeknya). ' +
            gayaGambar +
            ' Fokus pada urutan kegiatan yang jelas (misalnya tiga tahap dari kiri ke kanan) tanpa menuliskan angka atau kata di gambar. Latar bersih, kontras baik agar terbaca di layar ponsel.',
          url: '',
        },
        {
          tipe: 'teks',
          peran: 'latihan',
          html:
            '<h3>Latihan singkat</h3>' +
            '<p>Kerjakan di buku latihanmu.</p>' +
            '<ol><li>Soal 1 …</li><li>Soal 2 …</li><li>Soal 3 (tantangan) …</li></ol>',
        },
        {
          tipe: 'teks',
          peran: 'penutup',
          html:
            '<h3>Yang perlu diingat</h3>' +
            '<ul><li>Ringkasan poin 1</li><li>Ringkasan poin 2</li></ul>' +
            '<p>Siap lanjut ke halaman berikutnya bila sudah paham.</p>',
        },
      ],
    },
  }
  return JSON.stringify(contoh, null, 2)
}

/** Ekspor **satu** halaman (halaman aktif) ke JSON template-compatible. */
export function eksporSatuHalamanKeJson(
  meta: {
    mapel: string
    judul?: string
    deskripsi?: string
    bab?: string
    tpId?: string
    tpNomor?: number
    tpNama?: string
  },
  halaman: MateriHalaman,
  opsi?: { indeks?: number },
): string {
  const idx = opsi?.indeks ?? 0
  const out = {
    versi: VERSI_IMPORT_MATERI_HALAMAN,
    jenis: JENIS_IMPORT_MATERI_HALAMAN,
    mapel: meta.mapel,
    judulMateri: meta.judul || '',
    deskripsi: meta.deskripsi || '',
    bab: meta.bab || '',
    tpId: meta.tpId || '',
    tpNomor: meta.tpNomor ?? null,
    tpNama: meta.tpNama || '',
    catatan: 'Satu halaman. Impor dengan mode «Ganti halaman aktif» atau «Tambah sebagai halaman baru».',
    halaman: {
      judul: halaman.judul || `Halaman ${idx + 1}`,
      blok: halaman.blok.map((b) => {
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
    },
  }
  return JSON.stringify(out, null, 2)
}

/** Kompatibilitas: ekspor halaman pertama saja (alur satu-halaman). */
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
  halamanList: MateriHalaman[],
): string {
  const pertama = halamanList[0]
  if (!pertama) {
    return eksporSatuHalamanKeJson(meta, {
      id: idBaru('h'),
      urutan: 0,
      blok: [{ id: idBaru('b'), tipe: 'teks', html: '' }],
    })
  }
  return eksporSatuHalamanKeJson(meta, pertama, { indeks: 0 })
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

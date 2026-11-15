/**
 * Ekspor kuis ke dokumen siap cetak. Layout mengikuti template Asesmen Sumatif
 * SD Muhammadiyah 01 Kukusan: kop, identitas, soal dikelompokkan per bentuk.
 *
 * Dua jalur (ANTIREGRESI §127):
 *  • PDF  — `cetakKuisPdf`: paginasi DIHITUNG SENDIRI (ukur tinggi tiap blok lalu tempatkan
 *           di halaman A4 berukuran tetap). Tidak mengandalkan pemecah halaman browser
 *           (break-inside / column-count) yang terbukti memotong soal & mengosongkan hal. 1.
 *  • Word — `unduhKuisCetak`: HTML Word-compatible (.doc) mengalir 1 kolom, tanpa library baru.
 */
import type { KuisLms, SoalKuis, JenisPenilaianKuis } from '../types/kuis'
import type { Soal, TipeSoal } from '../types/soal'
import { NAMA_TIPE } from '../types/soal'
import { teksPolos } from './html'
import { ambilGambar } from './gambar'

export type OpsiCetakKuis = {
  /** Sertakan kunci jawaban di bagian akhir (versi guru). */
  sertakanKunci?: boolean
  /** Judul dokumen (override). Kosong = diturunkan dari jenis penilaian. */
  judulDokumen?: string
  /** Tahun pelajaran, mis. 2026/2027. */
  tahunPelajaran?: string
  /** Semester untuk judul STS/SAS: 'ganjil' | 'genap'. Default ganjil. */
  semester?: 'ganjil' | 'genap'
  /** Jumlah baris tabel paraf multi-siswa. Default 0 = identitas tunggal (Nama + No. Absen). Isi >0 untuk lembar kolektif. */
  barisParaf?: number
  /** Sembunyikan blok identitas nama/paraf. */
  sembunyikanParaf?: boolean
  /**
   * PDF dua kolom (hemat kertas): soal objektif & isian 2 kolom, soal uraian tetap 1 kolom
   * selebar halaman. Margin lebih kecil, font min 11pt. Word tetap satu kolom.
   */
  duaKolom?: boolean
}

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Logo kop (JPEG data-URI): SDM dan Kota Depok. */
const LOGO_SDM = 'data:image/jpeg;base64,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'
const LOGO_DEPOK = 'data:image/jpeg;base64,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'

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Word / cetak PDF andal hanya dengan JPEG/PNG.
 * Gambar LMS sering WebP — konversi lewat canvas sebelum disematkan.
 */
async function keJpegDataUrl(dataUrl: string, sisiMaks = 900): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null
  // Sudah JPEG kecil — pakai apa adanya
  if (dataUrl.startsWith('data:image/jpeg') && dataUrl.length < 180_000) return dataUrl
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('gagal muat gambar'))
      el.src = dataUrl
    })
    const skala = Math.min(1, sisiMaks / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * skala))
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * skala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl.startsWith('data:image/png') ? dataUrl : null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return null
  }
}

/** Judul formal tanpa mapel (mapel ada di baris identitas, seperti template sekolah). */
function judulUtama(jenis: JenisPenilaianKuis | undefined, semester: 'ganjil' | 'genap'): string {
  const sem = semester === 'genap' ? 'GENAP' : 'GANJIL'
  const j = jenis ?? 'latihan'
  if (j === 'sts') return `ASESMEN SUMATIF TENGAH SEMESTER ${sem}`
  if (j === 'sas') return `ASESMEN SUMATIF AKHIR SEMESTER ${sem}`
  if (j === 'slm') return 'ASESMEN SUMATIF LINGKUP MATERI'
  return 'LEMBAR SOAL'
}

function metaDokumen(kuis: KuisLms, opsi: OpsiCetakKuis): { judul: string; tahun: string } {
  const semester = opsi.semester ?? 'ganjil'
  return {
    judul: opsi.judulDokumen?.trim() || judulUtama(kuis.jenisPenilaian, semester),
    tahun: opsi.tahunPelajaran?.trim() || '2026/2027',
  }
}

function namaBerkas(kuis: KuisLms, opsi: OpsiCetakKuis): string {
  const suffix = opsi.sertakanKunci ? '_kunci' : ''
  const mentah = `${kuis.kelas || 'kelas'}_${kuis.mapel || 'mapel'}_${kuis.judul || 'kuis'}${suffix}`
  return mentah.replace(/[^\w.\-()\s\u00C0-\u024F]+/g, '_').slice(0, 80)
}

function teksSoal(s: Soal): string {
  return teksPolos(s.teks) || '(tanpa teks soal)'
}

function paragrafStimulus(s: Soal): string[] {
  const st = teksPolos(s.stimulus)
  if (!st) return []
  return st
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function stimulusHtml(s: Soal): string {
  const paragraf = paragrafStimulus(s)
  if (!paragraf.length) return ''
  return (
    `<div class="stimulus"><p class="stimulus-label">Perhatikan teks berikut!</p>` +
    paragraf.map((p) => `<p class="stimulus-p">${esc(p)}</p>`).join('') +
    `</div>`
  )
}

/** Pecah paragraf sangat panjang per kalimat (hanya untuk potongan cadangan soal super panjang). */
function pecahPanjang(p: string, maks = 600): string[] {
  if (p.length <= maks) return [p]
  const kalimat = p.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [p]
  const hasil: string[] = []
  let sekarang = ''
  for (const k of kalimat) {
    if (sekarang && (sekarang + k).length > maks) {
      hasil.push(sekarang.trim())
      sekarang = ''
    }
    sekarang += k
  }
  if (sekarang.trim()) hasil.push(sekarang.trim())
  return hasil
}

type ItemSoal = { no: number; s: SoalKuis }

/** Kelompokkan: objektif → isian → uraian; nomor global berurutan (seperti template sekolah). */
function kelompokkan(soal: SoalKuis[]): { objektif: ItemSoal[]; isian: ItemSoal[]; uraian: ItemSoal[] } {
  const objektif: ItemSoal[] = []
  const isian: ItemSoal[] = []
  const uraian: ItemSoal[] = []
  let no = 1
  for (const s of soal) {
    if (s.tipe === 'uraian') uraian.push({ no: no++, s })
    else if (s.tipe === 'isian') isian.push({ no: no++, s })
    else objektif.push({ no: no++, s })
  }
  return { objektif, isian, uraian }
}

type BagianCetak = { jenis: 'objektif' | 'isian' | 'uraian'; judul: string; items: ItemSoal[] }

/** Bagian soal beserta judul berangka romawi (dipakai jalur Word dan PDF). */
function susunBagian(soal: SoalKuis[]): BagianCetak[] {
  const { objektif, isian, uraian } = kelompokkan(soal)
  const hasil: BagianCetak[] = []
  if (objektif.length) {
    hasil.push({
      jenis: 'objektif',
      judul: 'I. Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!',
      items: objektif,
    })
  }
  if (isian.length) {
    const romawi = objektif.length ? 'II' : 'I'
    hasil.push({
      jenis: 'isian',
      judul: `${romawi}. Lengkapilah kalimat rumpang / soal berikut dengan jawaban yang singkat dan tepat!`,
      items: isian,
    })
  }
  if (uraian.length) {
    const n = (objektif.length ? 1 : 0) + (isian.length ? 1 : 0) + 1
    const romawi = n === 1 ? 'I' : n === 2 ? 'II' : 'III'
    hasil.push({
      jenis: 'uraian',
      judul: `${romawi}. Jawablah pertanyaan di bawah ini dengan jelas dan benar!`,
      items: uraian,
    })
  }
  return hasil
}

/* ───────────────────────── Potongan HTML per jenis soal ───────────────────────── */

function htmlBarisOpsi(o: { teks: string; gambarId?: string }, i: number, gambar: Map<string, string>): string {
  const huruf = HURUF[i] ?? String(i + 1)
  const img =
    o.gambarId && gambar.get(o.gambarId)
      ? `<img class="opsi-gambar" src="${gambar.get(o.gambarId)}" alt="" />`
      : ''
  return (
    `<tr>` +
    `<td class="opsi-huruf">${huruf}.</td>` +
    `<td class="opsi-teks">${esc(o.teks || '')}${img}</td>` +
    `</tr>`
  )
}

/** Opsi A–D sebagai tabel 2 kolom (huruf | teks) — stabil di Word. */
function htmlOpsiPg(s: SoalKuis, gambar: Map<string, string>): string {
  const opsi = 'opsi' in s && Array.isArray(s.opsi) ? s.opsi : []
  if (!opsi.length) return ''
  const rows = opsi.map((o, i) => htmlBarisOpsi(o, i, gambar)).join('')
  return `<table class="opsi-tbl" cellspacing="0" cellpadding="0">${rows}</table>`
}

function htmlBs(s: SoalKuis): string {
  if (s.tipe !== 'bs') return ''
  const labelB = s.labelBenar || 'Benar'
  const labelS = s.labelSalah || 'Salah'
  const rows = (s.pernyataan || [])
    .map(
      (p, i) =>
        `<tr>` +
        `<td class="no-per">${i + 1}.</td>` +
        `<td class="bs-teks">${esc(teksPolos(p.teks))}</td>` +
        `<td class="bs-col">☐ ${esc(labelB)}</td>` +
        `<td class="bs-col">☐ ${esc(labelS)}</td>` +
        `</tr>`,
    )
    .join('')
  return (
    `<table class="bs-tbl" cellspacing="0" cellpadding="0">` +
    `<thead><tr>` +
    `<th class="no-per"></th><th>Pernyataan</th>` +
    `<th class="bs-col">${esc(labelB)}</th><th class="bs-col">${esc(labelS)}</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  )
}

function htmlJodoh(s: SoalKuis, gambar: Map<string, string>): string {
  if (s.tipe !== 'jodoh') return ''
  const pasangan = s.pasangan || []
  const kiriRows = pasangan
    .map((p, i) => {
      const img =
        p.kiriGambarId && gambar.get(p.kiriGambarId)
          ? `<img class="opsi-gambar" src="${gambar.get(p.kiriGambarId)}" alt="" />`
          : ''
      return `<tr><td class="jodoh-no">${i + 1}.</td><td>${esc(teksPolos(p.kiri))}${img}</td></tr>`
    })
    .join('')
  const kananRows = pasangan
    .map(
      (p, i) =>
        `<tr><td class="jodoh-no">${HURUF[i] ?? i + 1}.</td><td>${esc(teksPolos(p.kanan))}</td></tr>`,
    )
    .join('')
  return (
    `<table class="jodoh-wrap" cellspacing="0" cellpadding="0"><tr>` +
    `<td class="jodoh-kol"><p class="jodoh-judul">Kolom A</p>` +
    `<table class="jodoh-inner">${kiriRows}</table></td>` +
    `<td class="jodoh-gap">&nbsp;</td>` +
    `<td class="jodoh-kol"><p class="jodoh-judul">Kolom B</p>` +
    `<table class="jodoh-inner">${kananRows}</table></td>` +
    `</tr></table>` +
    `<p class="petunjuk-kecil">Jodohkan nomor di kolom A dengan huruf di kolom B.</p>`
  )
}

function htmlGambarSoal(item: ItemSoal, gambar: Map<string, string>): string {
  const { no, s } = item
  return s.gambarId && gambar.get(s.gambarId)
    ? `<img class="soal-gambar" src="${gambar.get(s.gambarId)}" alt="Ilustrasi soal ${no}" />`
    : ''
}

function htmlIsiSoal(s: SoalKuis, gambar: Map<string, string>): string {
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    const petunjuk =
      s.tipe === 'pgk' ? `<p class="petunjuk-kecil">Pilih lebih dari satu jawaban yang benar.</p>` : ''
    return petunjuk + htmlOpsiPg(s, gambar)
  }
  if (s.tipe === 'bs') return htmlBs(s)
  if (s.tipe === 'jodoh') return htmlJodoh(s, gambar)
  if (s.tipe === 'isian') {
    return (
      `<p class="garis-jawab">` +
      `<span class="garis-label">Jawaban:</span> ` +
      `<span class="garis-isi">_______________________________________________</span>` +
      `</p>`
    )
  }
  if (s.tipe === 'uraian') {
    // 8 baris tulis tangan — ruang jawaban panjang (selalu 1 kolom)
    return (
      `<table class="ruang-uraian" cellspacing="0" cellpadding="0">` +
      Array.from({ length: 8 }, () => `<tr><td class="garis-uraian">&nbsp;</td></tr>`).join('') +
      `</table>`
    )
  }
  return ''
}

function bungkusSoal(nomor: string, isi: string): string {
  return (
    `<table class="soal-wrap" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="soal-no">${nomor}</td>` +
    `<td class="soal-body">${isi}</td>` +
    `</tr>` +
    `</table>`
  )
}

function htmlSatuSoal(item: ItemSoal, gambar: Map<string, string>): string {
  const { no, s } = item
  return bungkusSoal(
    `${no}.`,
    `<p class="soal-teks">${esc(teksSoal(s))}</p>` +
      htmlGambarSoal(item, gambar) +
      stimulusHtml(s) +
      htmlIsiSoal(s, gambar),
  )
}

/**
 * Potongan cadangan satu soal — HANYA dipakai bila satu soal lebih tinggi dari satu kolom/halaman
 * penuh (mis. bacaan sangat panjang). Soal normal selalu ditempatkan utuh.
 */
function potonganSoal(item: ItemSoal, gambar: Map<string, string>): string[] | undefined {
  const { no, s } = item
  const bagian: string[] = [
    bungkusSoal(`${no}.`, `<p class="soal-teks">${esc(teksSoal(s))}</p>` + htmlGambarSoal(item, gambar)),
  ]
  const paragraf = paragrafStimulus(s).flatMap((p) => pecahPanjang(p))
  paragraf.forEach((p, i) => {
    const label = i === 0 ? `<p class="stimulus-label">Perhatikan teks berikut!</p>` : ''
    bagian.push(bungkusSoal('', `<div class="stimulus">${label}<p class="stimulus-p">${esc(p)}</p></div>`))
  })
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    const opsi = Array.isArray(s.opsi) ? s.opsi : []
    opsi.forEach((o, i) => {
      const petunjuk =
        i === 0 && s.tipe === 'pgk'
          ? `<p class="petunjuk-kecil">Pilih lebih dari satu jawaban yang benar.</p>`
          : ''
      bagian.push(
        bungkusSoal('', `${petunjuk}<table class="opsi-tbl" cellspacing="0" cellpadding="0">${htmlBarisOpsi(o, i, gambar)}</table>`),
      )
    })
  } else if (s.tipe === 'bs' || s.tipe === 'jodoh') {
    bagian.push(bungkusSoal('', htmlIsiSoal(s, gambar)))
  }
  return bagian.length > 1 ? bagian : undefined
}

/* ───────────────────────── Kunci jawaban ───────────────────────── */

function dataKunci(soal: SoalKuis[]): { no: number; tipe: string; kunci: string }[] {
  return soal.map((s, i) => {
    let kunci = '—'
    if (s.tipe === 'pg') {
      const opsi = s.opsi || []
      const idx = opsi.findIndex((o) => o.id === s.kunci)
      kunci = idx >= 0 ? `${HURUF[idx]}. ${teksPolos(opsi[idx].teks)}` : String(s.kunci)
    } else if (s.tipe === 'pgk') {
      const opsi = s.opsi || []
      const ids = s.kunci || []
      kunci = ids
        .map((id) => {
          const idx = opsi.findIndex((o) => o.id === id)
          return idx >= 0 ? HURUF[idx] : id
        })
        .join(', ')
    } else if (s.tipe === 'bs') {
      kunci = (s.pernyataan || []).map((p, j) => `${j + 1}=${p.benar ? 'B' : 'S'}`).join('; ')
    } else if (s.tipe === 'jodoh') {
      kunci = (s.pasangan || []).map((_, j) => `${j + 1}→${HURUF[j]}`).join(', ')
    } else if (s.tipe === 'isian') {
      kunci = (s.kunci || []).join(' / ')
    } else if (s.tipe === 'uraian') {
      kunci = teksPolos(s.kunciJawaban) || '(pedoman di sistem)'
    }
    return { no: i + 1, tipe: NAMA_TIPE[s.tipe as TipeSoal] ?? s.tipe, kunci }
  })
}

/** Kunci untuk Word: satu tabel. */
function htmlKunci(soal: SoalKuis[]): string {
  if (!soal.length) return ''
  const baris = dataKunci(soal).map(
    (d) =>
      `<tr>` +
      `<td class="kunci-no">${d.no}</td>` +
      `<td class="kunci-tipe">${esc(d.tipe)}</td>` +
      `<td class="kunci-isi">${esc(d.kunci)}</td>` +
      `</tr>`,
  )
  return (
    `<br clear="all" style="page-break-before:always"/>` +
    `<h2 class="bagian kunci-judul">Kunci jawaban (untuk guru)</h2>` +
    `<table class="kunci" cellspacing="0" cellpadding="0">` +
    `<thead><tr><th class="kunci-no">No</th><th class="kunci-tipe">Tipe</th><th>Kunci / pedoman</th></tr></thead>` +
    `<tbody>${baris.join('')}</tbody></table>`
  )
}

/* ───────────────────────── Kop & identitas ───────────────────────── */

/** Kop: tabel 3 kolom (logo kiri | judul | logo kanan) — mirip template resmi. */
function htmlKop(judul: string, tahun: string): string {
  return (
    `<table class="kop" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="kop-logo"><img src="${LOGO_SDM}" alt="Logo SDM" width="56" height="49" /></td>` +
    `<td class="kop-tengah">` +
    `<p class="sekolah">SD MUHAMMADIYAH 01 KUKUSAN</p>` +
    `<p class="judul-utama">${esc(judul)}</p>` +
    `<p class="tahun">TAHUN PELAJARAN ${esc(tahun)}</p>` +
    `</td>` +
    `<td class="kop-logo"><img src="${LOGO_DEPOK}" alt="Logo Kota Depok" width="40" height="50" /></td>` +
    `</tr>` +
    `</table>` +
    `<div class="garis-ganda"></div>`
  )
}

/** Identitas mapel / hari-tanggal / kelas / TP. */
function htmlIdentitasMapel(kuis: KuisLms): string {
  const tpList = (kuis.tpNamaList ?? []).filter(Boolean)
  const tpHtml = tpList.length
    ? `<ol class="tp">${tpList.map((t, i) => `<li value="${i + 1}">${esc(t)}</li>`).join('')}</ol>`
    : `<span class="meta-kosong">—</span>`
  return (
    `<table class="identitas" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="id-label">Mata Pelajaran</td><td class="id-titik">:</td>` +
    `<td class="id-isi">${esc(kuis.mapel || '—')}</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label">Hari, Tanggal</td><td class="id-titik">:</td>` +
    `<td class="id-isi">................................................</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label">Kelas</td><td class="id-titik">:</td>` +
    `<td class="id-isi">${esc(kuis.kelas || '—')}</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label id-label-top">TP</td><td class="id-titik id-label-top">:</td>` +
    `<td class="id-isi">${tpHtml}</td>` +
    `</tr>` +
    `</table>`
  )
}

/** Identitas satu siswa (default cetak individual). */
function htmlIdentitasSiswa(): string {
  return (
    `<table class="identitas identitas-siswa" cellspacing="0" cellpadding="0">` +
    `<tr>` +
    `<td class="id-label">Nama</td><td class="id-titik">:</td>` +
    `<td class="id-isi">................................................................</td>` +
    `</tr>` +
    `<tr>` +
    `<td class="id-label">No. Absen</td><td class="id-titik">:</td>` +
    `<td class="id-isi">................</td>` +
    `</tr>` +
    `</table>`
  )
}

/** Tabel paraf multi-siswa (hanya jika barisParaf > 0). */
function htmlTabelParaf(n: number): string {
  const rows = Array.from({ length: Math.max(1, n) }, (_, i) => {
    return (
      `<tr>` +
      `<td class="paraf-no">${i + 1}</td>` +
      `<td class="paraf-nama">&nbsp;</td>` +
      `<td class="paraf-nilai">&nbsp;</td>` +
      `<td class="paraf-ttd">&nbsp;</td>` +
      `<td class="paraf-ttd">&nbsp;</td>` +
      `</tr>`
    )
  }).join('')
  return (
    `<table class="paraf" cellspacing="0" cellpadding="0">` +
    `<thead><tr>` +
    `<th class="paraf-no">No.</th>` +
    `<th class="paraf-nama">Nama</th>` +
    `<th class="paraf-nilai">Nilai</th>` +
    `<th class="paraf-ttd">Paraf Guru</th>` +
    `<th class="paraf-ttd">Paraf Orang Tua</th>` +
    `</tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  )
}

function htmlKepalaDokumen(kuis: KuisLms, opsi: OpsiCetakKuis): string {
  const { judul, tahun } = metaDokumen(kuis, opsi)
  let html = htmlKop(judul, tahun) + htmlIdentitasMapel(kuis)
  if (!opsi.sembunyikanParaf) {
    const nParaf = opsi.barisParaf ?? 0
    html += nParaf > 0 ? htmlTabelParaf(nParaf) : htmlIdentitasSiswa()
  }
  return html
}

function teksMeta(kuis: KuisLms): string {
  const n = kuis.soal?.length ?? 0
  return (
    `${kuis.judul || ''} · ${n} soal · ${kuis.totalPoin ?? 0} poin` +
    (kuis.durasiMenit ? ` · ${kuis.durasiMenit} menit` : '')
  )
}

/* ───────────────────────── Gambar ───────────────────────── */

/** Kumpulkan semua ID gambar yang dipakai di soal (soal, opsi, jodoh). */
function kumpulkanGambarIds(soal: SoalKuis[]): string[] {
  const ids = new Set<string>()
  for (const s of soal) {
    if (s.gambarId) ids.add(s.gambarId)
    if ((s.tipe === 'pg' || s.tipe === 'pgk') && Array.isArray(s.opsi)) {
      for (const o of s.opsi) {
        if (o.gambarId) ids.add(o.gambarId)
      }
    }
    if (s.tipe === 'jodoh' && Array.isArray(s.pasangan)) {
      for (const p of s.pasangan) {
        if (p.kiriGambarId) ids.add(p.kiriGambarId)
      }
    }
  }
  return [...ids]
}

/** Muat data-URL gambar dari Firestore (paralel, gagal diabaikan). */
async function muatGambarMap(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  await Promise.all(
    ids.map(async (id) => {
      try {
        const data = await ambilGambar(id)
        if (!data) return
        const jpeg = await keJpegDataUrl(data)
        if (jpeg) map.set(id, jpeg)
      } catch {
        /* abaikan gambar gagal */
      }
    }),
  )
  return map
}

/* ═════════════════════════════ JALUR WORD (.doc) ═════════════════════════════ */

/** Bangun HTML body dokumen Word (mengalir, 1 kolom). */
export async function htmlKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<string> {
  const soal = kuis.soal ?? []
  const gambar = await muatGambarMap(kumpulkanGambarIds(soal))
  let body = htmlKepalaDokumen(kuis, opsi)

  let isi = ''
  for (const b of susunBagian(soal)) {
    isi +=
      `<p class="bagian">${esc(b.judul)}</p>` + b.items.map((it) => htmlSatuSoal(it, gambar)).join('')
  }
  if (!soal.length) isi += `<p><em>Belum ada soal di kuis ini.</em></p>`
  body += `<div class="isi-soal">${isi}</div>`

  if (opsi.sertakanKunci) body += htmlKunci(soal)

  body += `<p class="footer-meta">${esc(teksMeta(kuis))}</p>`
  return body
}

/**
 * CSS untuk Microsoft Word / LibreOffice Writer:
 * - @page A4, tabel untuk layout (bukan flex/grid), Times New Roman 11pt.
 */
const STYLE_WORD = `
  @page {
    size: A4;
    margin: 1.2cm 1.4cm 1.8cm 1.4cm;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.45;
    margin: 0;
  }

  /* —— Kop surat —— */
  table.kop { width: 100%; border-collapse: collapse; margin: 0 0 2pt; }
  table.kop td { vertical-align: middle; }
  .kop-logo { width: 64px; text-align: center; vertical-align: middle; line-height: 1; }
  .kop-logo img { width: 56px; height: auto; max-height: 60px; display: block; margin: 0 auto; }
  .kop-tengah { text-align: center; padding: 0 6pt; }
  .sekolah { font-size: 13pt; font-weight: bold; margin: 0 0 3pt; letter-spacing: 0.5px; }
  .judul-utama { font-size: 14pt; font-weight: bold; margin: 0 0 3pt; text-transform: uppercase; line-height: 1.3; }
  .tahun { font-size: 11pt; font-weight: bold; margin: 0; }
  .garis-ganda { border-top: 2pt solid #000; border-bottom: 0.75pt solid #000; height: 4pt; margin: 4pt 0 8pt; }

  /* —— Identitas —— */
  table.identitas { width: 100%; border-collapse: collapse; margin: 0 0 6pt; }
  .identitas-siswa { margin: 0 0 6pt !important; }
  table.identitas td { padding: 1.5pt 2pt; vertical-align: top; }
  .id-label { width: 26%; font-weight: bold; white-space: nowrap; }
  .id-titik { width: 10px; font-weight: bold; }
  .id-label-top { vertical-align: top; padding-top: 2pt; }
  ol.tp { margin: 0; padding-left: 18px; }
  ol.tp li { margin: 0 0 2pt; text-align: justify; }
  .meta-kosong { color: #666; }

  /* —— Tabel paraf —— */
  table.paraf { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 10pt; }
  table.paraf th, table.paraf td { border: 1pt solid #000; padding: 3pt 5pt; }
  table.paraf th { background: #f0f0f0; text-align: center; font-weight: bold; }
  .paraf-no { width: 7%; text-align: center; }
  .paraf-nama { width: 38%; }
  .paraf-nilai { width: 12%; text-align: center; }
  .paraf-ttd { width: 21.5%; text-align: center; }
  table.paraf tbody td { height: 20pt; }

  /* —— Judul bagian —— */
  p.bagian { font-size: 11pt; font-weight: bold; margin: 6pt 0 4pt; page-break-after: avoid; }

  /* —— Satu soal (tabel no | isi) —— */
  .isi-soal { width: 100%; }
  table.soal-wrap { width: 100%; border-collapse: collapse; margin: 0 0 10pt; }
  td.soal-no { width: 22px; vertical-align: top; font-weight: bold; padding: 0 4pt 0 0; }
  td.soal-body { vertical-align: top; padding-bottom: 2pt; }
  p.soal-teks { margin: 0 0 3pt; text-align: justify; orphans: 2; widows: 2; }
  .soal-gambar { max-width: 85%; max-height: 130pt; width: auto; height: auto; display: block; margin: 3pt 0 6pt 0; }
  .opsi-gambar { max-width: 90pt; max-height: 64pt; width: auto; height: auto; display: block; margin: 2pt 0; }

  /* Stimulus / bacaan */
  .stimulus { margin: 3pt 0 5pt; padding: 5pt 7pt; border: 0.75pt solid #555; background: #fafafa; }
  .stimulus-label { font-style: italic; font-weight: bold; margin: 0 0 3pt; font-size: 10.5pt; }
  .stimulus-p { margin: 0 0 3pt; text-align: justify; }
  .stimulus-p:last-child { margin-bottom: 0; }

  /* Opsi PG */
  table.opsi-tbl { width: 100%; border-collapse: collapse; margin: 2pt 0 0 2pt; }
  td.opsi-huruf { width: 22px; vertical-align: top; font-weight: normal; padding: 1pt 4pt 1pt 0; }
  td.opsi-teks { vertical-align: top; padding: 1pt 0; text-align: justify; }

  .petunjuk-kecil { font-size: 9.5pt; font-style: italic; margin: 1pt 0 3pt; }

  /* Isian */
  .garis-jawab { margin: 5pt 0 0 0; }
  .garis-label { font-weight: bold; }

  /* Uraian — baris garis */
  table.ruang-uraian { width: 100%; border-collapse: collapse; margin: 4pt 0 0; }
  td.garis-uraian { border-bottom: 0.75pt solid #444; height: 16pt; font-size: 1pt; }

  /* Benar-salah */
  table.bs-tbl { width: 100%; border-collapse: collapse; margin: 3pt 0 0; font-size: 10pt; }
  table.bs-tbl th, table.bs-tbl td { border: 0.75pt solid #333; padding: 3pt 5pt; vertical-align: top; }
  table.bs-tbl th { background: #f0f0f0; text-align: center; }
  td.no-per, th.no-per { width: 22px; text-align: right; }
  td.bs-col, th.bs-col { width: 14%; text-align: center; white-space: nowrap; }

  /* Menjodohkan */
  table.jodoh-wrap { width: 100%; border-collapse: collapse; margin-top: 3pt; }
  td.jodoh-kol { width: 48%; vertical-align: top; }
  td.jodoh-gap { width: 4%; }
  .jodoh-judul { font-weight: bold; margin: 0 0 3pt; font-size: 10.5pt; }
  table.jodoh-inner { width: 100%; border-collapse: collapse; }
  table.jodoh-inner td { padding: 1pt 2pt; vertical-align: top; }
  td.jodoh-no { width: 22px; font-weight: bold; }

  /* Kunci */
  .kunci-judul { margin-top: 0; }
  table.kunci { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 4pt; }
  table.kunci th, table.kunci td { border: 0.75pt solid #333; padding: 3pt 5pt; vertical-align: top; }
  table.kunci th { background: #eee; text-align: left; }
  .kunci-no { width: 8%; text-align: center; }
  .kunci-tipe { width: 22%; }

  .footer-meta { margin-top: 14pt; font-size: 9pt; color: #444; border-top: 0.5pt solid #999; padding-top: 5pt; }
`

async function bangunHtmlWord(
  kuis: KuisLms,
  opsi: OpsiCetakKuis,
): Promise<{ html: string; namaFile: string }> {
  const body = await htmlKuisCetak(kuis, opsi)
  const { judul } = metaDokumen(kuis, opsi)
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="LMS SD Muhammadiyah 01 Kukusan">
<title>${esc(judul)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
${STYLE_WORD}
</style>
</head>
<body>
${body}
</body>
</html>`
  return { html, namaFile: namaBerkas(kuis, opsi) }
}

/** Unduh file .doc (HTML Word-compatible). Gambar dikonversi JPEG agar Word menampilkannya. */
export async function unduhKuisCetak(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<void> {
  const { html, namaFile } = await bangunHtmlWord(kuis, opsi)
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile.endsWith('.doc') ? namaFile : `${namaFile}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

/* ═════════════════════════════ JALUR PDF (paginasi sendiri) ═════════════════════════════ */

const PX_MM = 96 / 25.4
const PX_PT = 96 / 72
const mm = (v: number): number => v * PX_MM
const pt = (v: number): number => v * PX_PT

/**
 * Satuan penempatan. Satu soal = satu blok utuh yang TIDAK PERNAH dipecah antar kolom/halaman
 * (nomor, teks, gambar, opsi tetap bersama). `potongan` hanya cadangan bila blok lebih tinggi
 * dari satu halaman penuh.
 */
export type BlokCetak = {
  html: string
  /** 'penuh' = selebar isi halaman; 'kolom' = satu kolom (hanya bermakna pada mode 2 kolom). */
  mode: 'penuh' | 'kolom'
  /** Celah kosong di bawah blok (px) — ikut diukur sebagai bagian tinggi blok. */
  gap: number
  /** Tetap satu halaman/kolom dengan blok berikutnya (judul bagian, kepala tabel kunci). */
  jaga?: boolean
  /** Judul bagian: bila kolom masih kosong di awal wilayah, tampil selebar halaman. */
  penuhBilaAwal?: boolean
  /** Mulai di halaman baru (kunci jawaban). */
  halamanBaru?: boolean
  potongan?: BlokCetak[]
}

export type GeometriCetak = {
  dua: boolean
  lebarHalaman: number
  tinggiHalaman: number
  /** Margin kiri (px) dan awal isi dari atas halaman (px). */
  kiri: number
  atas: number
  lebarIsi: number
  lebarKolom: number
  celah: number
  /** Batas bawah area isi (px dari atas halaman) — di atas garis footer. */
  bawah: number
  /** Posisi atas garis footer (px dari atas halaman). */
  footerAtas: number
}

export function geometriCetak(dua: boolean): GeometriCetak {
  const lebarHalaman = mm(210)
  // 296,5 mm (bukan 297) agar pembulatan browser tak melahirkan halaman kosong ekstra.
  const tinggiHalaman = mm(296.5)
  const kiri = mm(dua ? 10 : 14)
  const atas = mm(dua ? 10 : 12)
  const lebarIsi = lebarHalaman - 2 * kiri
  const celah = mm(8)
  const lebarKolom = dua ? (lebarIsi - celah) / 2 : lebarIsi
  const footerAtas = tinggiHalaman - mm(14)
  const bawah = footerAtas - mm(3)
  return { dua, lebarHalaman, tinggiHalaman, kiri, atas, lebarIsi, lebarKolom, celah, bawah, footerAtas }
}

export type Penempatan = { html: string; x: number; y: number; w: number; gap: number }
export type HalamanSusun = {
  blok: Penempatan[]
  /** Garis pemisah kolom (hanya mode 2 kolom). */
  garis?: { x: number; y1: number; y2: number }
}

/** Mengukur tinggi (px) blok pada lebar tertentu, termasuk celah bawah. */
export type PengukurBlok = (html: string, lebar: number, gap: number) => Promise<number>

type BlokUkur = BlokCetak & { h: number; hPenuh: number }

type Wilayah = {
  top: number
  y: [number, number]
  gap: [number, number]
  kol: 0 | 1
  /** Blok yang sudah ditempatkan di wilayah ini (untuk penyeimbangan kolom). */
  item: { b: BlokUkur; p: Penempatan }[]
}

/**
 * Menyusun blok ke halaman A4 berukuran tetap.
 * Aturan: blok tidak dipecah; blok yang tak muat pindah ke kolom/halaman berikutnya;
 * judul bagian selalu bersama blok sesudahnya; kop + identitas + soal pertama berada di halaman 1
 * selama muat; soal uraian (mode 'penuh') ditempatkan di bawah wilayah 2 kolom.
 */
export async function susunHalaman(
  daftar0: BlokCetak[],
  g: GeometriCetak,
  ukur: PengukurBlok,
): Promise<HalamanSusun[]> {
  const lebarBlok = (b: BlokCetak): number => (g.dua && b.mode === 'kolom' ? g.lebarKolom : g.lebarIsi)
  const tinggiPenuhHalaman = g.bawah - g.atas

  // 1) Ukur semua blok; pecah blok yang lebih tinggi dari satu halaman penuh (jarang).
  const daftar: BlokUkur[] = []
  const ukurBlok = async (b: BlokCetak): Promise<BlokUkur> => {
    const h = await ukur(b.html, lebarBlok(b), b.gap)
    const hPenuh = b.penuhBilaAwal && g.dua && b.mode === 'kolom' ? await ukur(b.html, g.lebarIsi, b.gap) : h
    return { ...b, h, hPenuh }
  }
  for (const b of daftar0) {
    const u = await ukurBlok(b)
    if (u.h - u.gap > tinggiPenuhHalaman && b.potongan?.length) {
      for (const p of b.potongan) daftar.push(await ukurBlok(p))
    } else {
      daftar.push(u)
    }
  }

  // 2) Tempatkan.
  const halaman: HalamanSusun[] = []
  let hal: HalamanSusun = { blok: [] }
  let yPenuh = g.atas
  let wil: Wilayah | null = null
  halaman.push(hal)

  const mulaiWilayah = (top: number): Wilayah => ({ top, y: [top, top], gap: [0, 0], kol: 0, item: [] })

  /**
   * Seimbangkan tinggi dua kolom pada wilayah terakhir di halaman (seperti column-fill: balance)
   * agar kolom kanan tidak kosong dan blok 1-kolom berikutnya (uraian) dapat muat lebih rapat.
   * Urutan soal tidak berubah; judul bagian tetap bersama soal sesudahnya.
   */
  const seimbangkan = (w: Wilayah): void => {
    const it = w.item
    if (!g.dua || it.length < 2) return
    const susun = (tinggi: number): number[] | null => {
      const kolom: number[] = []
      let kol = 0
      let y = 0
      for (let i = 0; i < it.length; i++) {
        const b = it[i].b
        const nx = b.jaga ? it[i + 1]?.b : undefined
        const perlu = b.h - b.gap + (nx ? b.gap + nx.h - nx.gap : 0)
        if (y + perlu > tinggi + 0.01 && y > 0) {
          kol++
          y = 0
        }
        if (kol > 1 || perlu > tinggi + 0.01) return null
        kolom.push(kol)
        y += b.h
      }
      return kolom
    }
    let hi = Math.max(w.y[0] - w.gap[0], w.y[1] - w.gap[1]) - w.top
    let lo = Math.max(...it.map((x) => x.b.h - x.b.gap))
    if (hi < lo || !susun(hi)) return
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2
      if (susun(mid)) hi = mid
      else lo = mid
    }
    const kolom = susun(hi)
    if (!kolom) return
    const yKol: [number, number] = [w.top, w.top]
    const gapKol: [number, number] = [0, 0]
    it.forEach((x, i) => {
      const k = kolom[i] as 0 | 1
      x.p.x = g.kiri + (k === 1 ? g.lebarKolom + g.celah : 0)
      x.p.y = yKol[k]
      yKol[k] += x.b.h
      gapKol[k] = x.b.gap
    })
    w.y = yKol
    w.gap = gapKol
  }

  const tutupWilayah = (seimbang = false): void => {
    if (!wil) return
    if (seimbang) seimbangkan(wil)
    const bawahIsi = Math.max(wil.y[0] - wil.gap[0], wil.y[1] - wil.gap[1])
    if (g.dua && wil.y[1] > wil.top + 0.5) {
      hal.garis = { x: g.kiri + g.lebarKolom + g.celah / 2, y1: wil.top, y2: bawahIsi }
    }
    yPenuh = Math.max(wil.y[0], wil.y[1])
    wil = null
  }

  const halamanBaru = (): void => {
    tutupWilayah()
    hal = { blok: [] }
    halaman.push(hal)
    yPenuh = g.atas
    wil = null
  }

  const taruh = (b: BlokUkur, x: number, y: number, w: number): Penempatan => {
    const p: Penempatan = { html: b.html, x, y, w, gap: b.gap }
    hal.blok.push(p)
    return p
  }

  for (let i = 0; i < daftar.length; i++) {
    const b = daftar[i]
    const nx = b.jaga ? daftar[i + 1] : undefined
    // tinggi yang dibutuhkan agar blok + pasangannya (tanpa celah akhir) muat sekaligus
    const butuh = (h: number): number => h - b.gap + (nx ? b.gap + nx.h - nx.gap : 0)

    if (b.halamanBaru && hal.blok.length > 0) {
      tutupWilayah(true)
      halamanBaru()
    }

    if (b.mode === 'penuh' || !g.dua) {
      tutupWilayah(true)
      if (yPenuh + butuh(b.h) > g.bawah && yPenuh > g.atas + 1) halamanBaru()
      taruh(b, g.kiri, yPenuh, g.lebarIsi)
      yPenuh += b.h
      continue
    }

    // mode kolom
    if (!wil) wil = mulaiWilayah(yPenuh)
    const awalWilayah = wil.kol === 0 && wil.y[0] === wil.top && wil.y[1] === wil.top
    if (b.penuhBilaAwal && awalWilayah) {
      // judul bagian di awal wilayah kolom → selebar halaman
      if (wil.top + butuh(b.hPenuh) > g.bawah && wil.top > g.atas + 1) {
        halamanBaru()
        wil = mulaiWilayah(g.atas)
      }
      taruh(b, g.kiri, wil.top, g.lebarIsi)
      wil.top += b.hPenuh
      wil.y = [wil.top, wil.top]
      continue
    }

    for (;;) {
      const y = wil.y[wil.kol]
      if (y + butuh(b.h) <= g.bawah || y <= wil.top + 1) break
      if (wil.kol === 0) {
        wil.kol = 1
      } else {
        halamanBaru()
        wil = mulaiWilayah(g.atas)
      }
    }
    const x = g.kiri + (wil.kol === 1 ? g.lebarKolom + g.celah : 0)
    wil.item.push({ b, p: taruh(b, x, wil.y[wil.kol], g.lebarKolom) })
    wil.y[wil.kol] += b.h
    wil.gap[wil.kol] = b.gap
  }
  tutupWilayah(true)
  return halaman
}

/** Blok-blok dokumen PDF (kop → bagian soal → kunci). */
function bangunBlokPdf(kuis: KuisLms, opsi: OpsiCetakKuis, gambar: Map<string, string>): BlokCetak[] {
  const dua = !!opsi.duaKolom
  const soal = kuis.soal ?? []
  const gapSoal = pt(dua ? 10 : 14)
  const blok: BlokCetak[] = []

  blok.push({ html: htmlKepalaDokumen(kuis, opsi), mode: 'penuh', gap: pt(4) })

  for (const b of susunBagian(soal)) {
    // Hanya uraian yang 1 kolom penuh; bentuk soal lain 2 kolom pada mode dua kolom.
    const mode: 'penuh' | 'kolom' = dua && b.jenis !== 'uraian' ? 'kolom' : 'penuh'
    blok.push({
      html: `<p class="bagian">${esc(b.judul)}</p>`,
      mode,
      gap: pt(3),
      jaga: true,
      penuhBilaAwal: mode === 'kolom',
    })
    for (const it of b.items) {
      const bagian = potonganSoal(it, gambar)
      blok.push({
        html: htmlSatuSoal(it, gambar),
        mode,
        gap: gapSoal,
        potongan: bagian?.map((html, idx) => ({
          html,
          mode,
          gap: idx === bagian.length - 1 ? gapSoal : pt(1),
        })),
      })
    }
  }

  if (!soal.length) {
    blok.push({ html: `<p><em>Belum ada soal di kuis ini.</em></p>`, mode: 'penuh', gap: pt(4) })
  }

  if (opsi.sertakanKunci && soal.length) {
    blok.push({
      html: `<p class="bagian kunci-judul">Kunci jawaban (untuk guru)</p>`,
      mode: 'penuh',
      gap: pt(4),
      jaga: true,
      halamanBaru: true,
    })
    blok.push({
      html:
        `<div class="kunci-baris kepala"><div class="k-no">No</div><div class="k-tipe">Tipe</div>` +
        `<div class="k-isi">Kunci / pedoman</div></div>`,
      mode: 'penuh',
      gap: 0,
      jaga: true,
    })
    for (const d of dataKunci(soal)) {
      blok.push({
        html:
          `<div class="kunci-baris"><div class="k-no">${d.no}</div><div class="k-tipe">${esc(d.tipe)}</div>` +
          `<div class="k-isi">${esc(d.kunci)}</div></div>`,
        mode: 'penuh',
        gap: 0,
      })
    }
  }
  return blok
}

/**
 * CSS jalur PDF. Halaman = elemen `.halaman` berukuran tetap A4 (@page margin 0); posisi blok,
 * garis kolom, dan footer ditentukan skrip (absolute). Jangan memakai column-count / break-inside
 * untuk mengatur pemotongan — lihat ANTIREGRESI §127.26.
 */
const STYLE_PDF = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, 'Liberation Serif', serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.45;
  }
  .memuat { font: 14px sans-serif; padding: 24px; color: #333; }
  .halaman {
    position: relative;
    width: 210mm;
    height: 296.5mm;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
    break-after: page;
  }
  .halaman:last-child { page-break-after: auto; break-after: auto; }
  @media screen {
    body { background: #8a8a8a; }
    .halaman { margin: 10px auto; box-shadow: 0 1px 6px rgba(0,0,0,.4); }
  }
  .blok { position: absolute; box-sizing: border-box; }
  .stage-ukur { position: absolute; left: -99999px; top: 0; visibility: hidden; }
  .garis-kolom { position: absolute; width: 0; border-left: 0.5pt solid #999; }

  /* —— Footer: garis tipis di atas, nomor halaman di kanan bawah —— */
  .footer-halaman {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    align-items: baseline;
    border-top: 0.5pt solid #555;
    padding-top: 2pt;
    font-size: 9pt;
    line-height: 1.2;
    color: #222;
  }
  .footer-meta { color: #555; font-size: 8.5pt; }
  .footer-no { margin-left: auto; font-weight: normal; }

  /* —— Kop surat —— */
  table.kop { width: 100%; border-collapse: collapse; margin: 0 0 2pt; }
  table.kop td { vertical-align: middle; }
  .kop-logo { width: 64px; text-align: center; vertical-align: middle; line-height: 1; }
  .kop-logo img { width: 56px; height: auto; max-height: 60px; display: block; margin: 0 auto; }
  .kop-tengah { text-align: center; padding: 0 6pt; }
  .sekolah { font-size: 13pt; font-weight: bold; margin: 0 0 3pt; letter-spacing: 0.5px; }
  .judul-utama { font-size: 14pt; font-weight: bold; margin: 0 0 3pt; text-transform: uppercase; line-height: 1.3; }
  .tahun { font-size: 11pt; font-weight: bold; margin: 0; }
  .garis-ganda { border-top: 2pt solid #000; border-bottom: 0.75pt solid #000; height: 4pt; margin: 4pt 0 6pt; }

  /* —— Identitas —— */
  table.identitas { width: 100%; border-collapse: collapse; margin: 0 0 4pt; }
  table.identitas td { padding: 1.5pt 2pt; vertical-align: top; }
  .id-label { width: 26%; font-weight: bold; white-space: nowrap; }
  .id-titik { width: 10px; font-weight: bold; }
  .id-label-top { vertical-align: top; padding-top: 2pt; }
  ol.tp { margin: 0; padding-left: 18px; }
  ol.tp li { margin: 0 0 2pt; text-align: justify; }
  .meta-kosong { color: #666; }

  /* —— Tabel paraf —— */
  table.paraf { width: 100%; border-collapse: collapse; margin: 6pt 0 8pt; font-size: 10pt; }
  table.paraf th, table.paraf td { border: 1pt solid #000; padding: 3pt 5pt; }
  table.paraf th { text-align: center; font-weight: bold; }
  .paraf-no { width: 7%; text-align: center; }
  .paraf-nama { width: 38%; }
  .paraf-nilai { width: 12%; text-align: center; }
  .paraf-ttd { width: 21.5%; text-align: center; }
  table.paraf tbody td { height: 20pt; }

  /* —— Judul bagian —— */
  .bagian { font-size: 11pt; font-weight: bold; margin: 4pt 0 2pt; }

  /* —— Satu soal (tabel no | isi) —— */
  table.soal-wrap { width: 100%; border-collapse: collapse; margin: 0; }
  td.soal-no { width: 22px; vertical-align: top; font-weight: bold; padding: 0 4pt 0 0; }
  td.soal-body { vertical-align: top; padding: 0; }
  p.soal-teks { margin: 0 0 3pt; text-align: justify; }
  .soal-gambar { max-width: 85%; max-height: 130pt; width: auto; height: auto; display: block; margin: 3pt 0 6pt 0; }
  .opsi-gambar { max-width: 90pt; max-height: 64pt; width: auto; height: auto; display: block; margin: 2pt 0; }

  .stimulus { margin: 3pt 0 5pt; padding: 5pt 7pt; border: 0.75pt solid #555; }
  .stimulus-label { font-style: italic; font-weight: bold; margin: 0 0 3pt; font-size: 10.5pt; }
  .stimulus-p { margin: 0 0 3pt; text-align: justify; }
  .stimulus-p:last-child { margin-bottom: 0; }

  table.opsi-tbl { width: 100%; border-collapse: collapse; margin: 2pt 0 0 2pt; }
  td.opsi-huruf { width: 22px; vertical-align: top; font-weight: normal; padding: 1pt 4pt 1pt 0; }
  td.opsi-teks { vertical-align: top; padding: 1pt 0; text-align: justify; }
  .petunjuk-kecil { font-size: 9.5pt; font-style: italic; margin: 1pt 0 3pt; }

  /* Isian: garis digambar dengan border (bukan deretan garis-bawah) agar tak melebihi lebar kolom */
  .garis-jawab { display: flex; align-items: flex-end; margin: 5pt 0 0 0; }
  .garis-label { font-weight: bold; margin-right: 4pt; white-space: nowrap; }
  .garis-isi { flex: 1; min-width: 0; max-width: 90mm; height: 12pt; font-size: 0; border-bottom: 0.75pt solid #000; }
  table.ruang-uraian { width: 100%; border-collapse: collapse; margin: 4pt 0 0; }
  td.garis-uraian { border-bottom: 0.75pt solid #444; height: 18pt; font-size: 1pt; }

  table.bs-tbl { width: 100%; border-collapse: collapse; margin: 3pt 0 0; font-size: 10pt; }
  table.bs-tbl th, table.bs-tbl td { border: 0.75pt solid #333; padding: 3pt 5pt; vertical-align: top; }
  table.bs-tbl th { text-align: center; }
  td.no-per, th.no-per { width: 22px; text-align: right; }
  td.bs-col, th.bs-col { width: 14%; text-align: center; white-space: nowrap; }

  table.jodoh-wrap { width: 100%; border-collapse: collapse; margin-top: 3pt; }
  td.jodoh-kol { width: 48%; vertical-align: top; }
  td.jodoh-gap { width: 4%; }
  .jodoh-judul { font-weight: bold; margin: 0 0 3pt; font-size: 10.5pt; }
  table.jodoh-inner { width: 100%; border-collapse: collapse; }
  table.jodoh-inner td { padding: 1pt 2pt; vertical-align: top; }
  td.jodoh-no { width: 22px; font-weight: bold; }

  /* —— Kunci jawaban (baris berdiri sendiri agar bisa mengalir antar halaman) —— */
  .kunci-judul { margin: 0; }
  .kunci-baris {
    display: flex;
    box-sizing: border-box;
    border-left: 0.75pt solid #333;
    border-right: 0.75pt solid #333;
    border-bottom: 0.75pt solid #333;
    font-size: 10pt;
  }
  .kunci-baris.kepala { border-top: 0.75pt solid #333; font-weight: bold; }
  .kunci-baris > div { padding: 3pt 5pt; box-sizing: border-box; }
  .k-no { width: 8%; text-align: center; border-right: 0.75pt solid #333; }
  .k-tipe { width: 22%; border-right: 0.75pt solid #333; }
  .k-isi { flex: 1; }

  /* —— Mode 2 kolom: font tetap ≥ 11pt, ilustrasi menyesuaikan lebar kolom —— */
  body.dua .soal-gambar { max-width: 100%; max-height: 100pt; }
  body.dua .opsi-gambar { max-width: 64pt; max-height: 48pt; }
  body.dua table.bs-tbl { font-size: 11pt; }
  body.dua table.bs-tbl th, body.dua table.bs-tbl td { padding: 3pt 3pt; }
  body.dua td.bs-col, body.dua th.bs-col { width: 15%; white-space: normal; }
  body.dua td.no-per, body.dua th.no-per { width: 18px; }
  body.dua table.paraf { font-size: 10pt; }
`

export function kerangkaPdf(judul: string, dua: boolean): string {
  return (
    `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">` +
    `<title>${esc(judul)}</title><style>${STYLE_PDF}</style></head>` +
    `<body class="${dua ? 'dua' : 'satu'}"><div class="memuat">Menyiapkan dokumen cetak…</div></body></html>`
  )
}

function buatPengukur(doc: Document): { ukur: PengukurBlok; bersihkan: () => void } {
  const stage = doc.createElement('div')
  stage.className = 'stage-ukur'
  doc.body.appendChild(stage)
  const ukur: PengukurBlok = async (html, lebar, gap) => {
    const el = doc.createElement('div')
    el.className = 'blok'
    el.style.cssText = `left:0;top:0;width:${lebar}px;padding-bottom:${gap}px`
    el.innerHTML = html
    stage.appendChild(el)
    await tungguGambar(el)
    const h = el.getBoundingClientRect().height
    stage.removeChild(el)
    return h
  }
  return { ukur, bersihkan: () => stage.remove() }
}

/** Tunggu semua <img> di dalam `akar` selesai dimuat/didekode (agar tinggi terukur benar). */
async function tungguGambar(akar: ParentNode): Promise<void> {
  const daftar = Array.from(akar.querySelectorAll('img'))
  await Promise.all(
    daftar.map((im) => {
      if (im.complete && im.naturalWidth > 0) return undefined
      if (typeof im.decode === 'function') return im.decode().catch(() => undefined)
      return new Promise<void>((resolve) => {
        im.onload = () => resolve()
        im.onerror = () => resolve()
      })
    }),
  )
}

const f2 = (n: number): string => n.toFixed(2)

function htmlHalaman(halaman: HalamanSusun[], g: GeometriCetak, meta: string): string {
  return halaman
    .map((h, i) => {
      const blok = h.blok
        .map(
          (p) =>
            `<div class="blok" style="left:${f2(p.x)}px;top:${f2(p.y)}px;width:${f2(p.w)}px;` +
            `padding-bottom:${f2(p.gap)}px">${p.html}</div>`,
        )
        .join('')
      const garis = h.garis
        ? `<div class="garis-kolom" style="left:${f2(h.garis.x)}px;top:${f2(h.garis.y1)}px;` +
          `height:${f2(Math.max(0, h.garis.y2 - h.garis.y1))}px"></div>`
        : ''
      const footer =
        `<div class="footer-halaman" style="left:${f2(g.kiri)}px;width:${f2(g.lebarIsi)}px;top:${f2(g.footerAtas)}px">` +
        `<span class="footer-meta">${esc(meta)}</span><span class="footer-no">${i + 1}</span></div>`
      return `<section class="halaman">${blok}${garis}${footer}</section>`
    })
    .join('')
}

/**
 * Menyusun dokumen cetak PDF di `doc` (jendela baru). Dipisah dari `cetakKuisPdf` agar bisa diuji.
 * Mengembalikan jumlah halaman.
 */
export async function siapkanDokumenPdf(
  doc: Document,
  kuis: KuisLms,
  opsi: OpsiCetakKuis = {},
): Promise<number> {
  const dua = !!opsi.duaKolom
  const soal = kuis.soal ?? []
  const gambar = await muatGambarMap(kumpulkanGambarIds(soal))
  const g = geometriCetak(dua)
  const blok = bangunBlokPdf(kuis, opsi, gambar)

  const { ukur, bersihkan } = buatPengukur(doc)
  const halaman = await susunHalaman(blok, g, ukur)
  bersihkan()

  const memuat = doc.querySelector('.memuat')
  memuat?.remove()
  doc.body.insertAdjacentHTML('beforeend', htmlHalaman(halaman, g, teksMeta(kuis)))

  // Pastikan gambar & font siap sebelum dialog cetak dibuka.
  await tungguGambar(doc.body)
  const fonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts
  if (fonts) await fonts.ready
  return halaman.length
}

/**
 * Cetak / simpan PDF lewat dialog print browser («Save as PDF»).
 * Jendela dibuka SEGERA (masih dalam klik pengguna) lalu diisi — membuka jendela setelah proses
 * async sering diblokir popup-blocker.
 */
export async function cetakKuisPdf(kuis: KuisLms, opsi: OpsiCetakKuis = {}): Promise<void> {
  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Popup diblokir. Izinkan jendela baru untuk mencetak PDF.')
  }
  try {
    w.document.open()
    w.document.write(kerangkaPdf(namaBerkas(kuis, opsi), !!opsi.duaKolom))
    w.document.close()
    await siapkanDokumenPdf(w.document, kuis, opsi)
    await new Promise<void>((r) => w.setTimeout(r, 150))
  } catch (e) {
    try {
      w.close()
    } catch {
      /* abaikan */
    }
    throw e
  }
  try {
    w.focus()
    w.print()
  } catch {
    /* user dapat File > Print manual */
  }
}

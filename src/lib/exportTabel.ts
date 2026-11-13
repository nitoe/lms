/**
 * Ekspor tabel ke CSV dan XLSX tanpa dependensi tambahan.
 * - CSV: UTF-8 + BOM, pemisah titik koma, desimal koma (terbuka rapi di Excel lokal Indonesia).
 * - XLSX: OOXML minimal (ZIP tanpa kompresi), header tebal, kolom dibekukan, filter otomatis.
 * ANTIREGRESI §119.
 */

export type SelEks = string | number | null

export type LembarEks = {
  /** Nama sheet (maks 31 karakter; karakter terlarang dibersihkan). */
  nama: string
  kolom: string[]
  baris: SelEks[][]
  /** Lebar kolom (karakter); bawaan dihitung dari isi. */
  lebar?: number[]
  /** Jumlah kolom paling kiri yang dibekukan (bawaan 0). */
  bekukanKolom?: number
}

/* -------------------------------------------------------------------- CSV */

function csvSel(v: SelEks): string {
  if (v == null) return ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    return String(v).replace('.', ',')
  }
  let t = v.replace(/\r?\n/g, ' ')
  // Cegah injeksi rumus saat dibuka di spreadsheet.
  if (/^[=+\-@\t]/.test(t)) t = `'${t}`
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Isi CSV (tanpa BOM). Baris dipisah CRLF. */
export function buatCsv(l: LembarEks): string {
  const baris = [l.kolom.map(csvSel).join(';'), ...l.baris.map((r) => r.map(csvSel).join(';'))]
  return baris.join('\r\n') + '\r\n'
}

export function blobCsv(l: LembarEks): Blob {
  return new Blob(['\uFEFF', buatCsv(l)], { type: 'text/csv;charset=utf-8' })
}

/* -------------------------------------------------------------------- XLSX */

const ENC = new TextEncoder()

function xmlEsc(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hurufKolom(i: number): string {
  let n = i + 1
  let out = ''
  while (n > 0) {
    const m = (n - 1) % 26
    out = String.fromCharCode(65 + m) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function namaSheetAman(nama: string, terpakai: Set<string>): string {
  let t = nama.replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Sheet'
  t = t.slice(0, 31)
  let kandidat = t
  let n = 2
  while (terpakai.has(kandidat.toLowerCase())) {
    const akhiran = ` (${n++})`
    kandidat = t.slice(0, 31 - akhiran.length) + akhiran
  }
  terpakai.add(kandidat.toLowerCase())
  return kandidat
}

function xmlLembar(l: LembarEks): string {
  const nKol = l.kolom.length
  const nBaris = l.baris.length
  const lebar =
    l.lebar ??
    l.kolom.map((h, c) => {
      let maks = h.length
      for (const r of l.baris) {
        const v = r[c]
        const p = v == null ? 0 : String(v).length
        if (p > maks) maks = p
      }
      return Math.min(48, Math.max(8, maks + 2))
    })
  const beku = Math.max(0, Math.min(l.bekukanKolom ?? 0, nKol))
  const topLeft = `${hurufKolom(beku)}2`
  const pane =
    `<pane ${beku > 0 ? `xSplit="${beku}" ` : ''}ySplit="1" topLeftCell="${topLeft}" ` +
    `activePane="${beku > 0 ? 'bottomRight' : 'bottomLeft'}" state="frozen"/>`

  const sel = (v: SelEks, c: number, r: number, gaya: number): string => {
    const ref = `${hurufKolom(c)}${r}`
    if (v == null || v === '') return gaya ? `<c r="${ref}" s="${gaya}"/>` : ''
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return ''
      return `<c r="${ref}" s="${Number.isInteger(v) ? 0 : 2}"><v>${v}</v></c>`
    }
    return `<c r="${ref}" t="inlineStr"${gaya ? ` s="${gaya}"` : ''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`
  }

  const header =
    `<row r="1" ht="32" customHeight="1">` +
    l.kolom.map((h, c) => sel(h, c, 1, 1)).join('') +
    `</row>`
  const body = l.baris
    .map((r, i) => `<row r="${i + 2}">${r.map((v, c) => sel(v, c, i + 2, 0)).join('')}</row>`)
    .join('')
  const dim = `A1:${hurufKolom(Math.max(nKol - 1, 0))}${nBaris + 1}`
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dim}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    (nKol > 0 ? `<autoFilter ref="A1:${hurufKolom(nKol - 1)}${Math.max(nBaris + 1, 1)}"/>` : '') +
    `</worksheet>`
  )
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF313083"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

/* ---- ZIP tanpa kompresi (metode store) ---- */

let TABEL_CRC: Uint32Array | null = null
function crc32(data: Uint8Array): number {
  if (!TABEL_CRC) {
    TABEL_CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      TABEL_CRC[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = TABEL_CRC[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files: { nama: string; isi: string }[], tgl = new Date()): Uint8Array {
  const dosTime = (tgl.getHours() << 11) | (tgl.getMinutes() << 5) | (tgl.getSeconds() >> 1)
  const dosDate = (Math.max(tgl.getFullYear() - 1980, 0) << 9) | ((tgl.getMonth() + 1) << 5) | tgl.getDate()
  const bagian: Uint8Array[] = []
  const pusat: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const nama = ENC.encode(f.nama)
    const isi = ENC.encode(f.isi)
    const crc = crc32(isi)

    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true)
    lh.setUint16(4, 20, true)
    lh.setUint16(6, 0x0800, true) // nama berkas UTF-8
    lh.setUint16(8, 0, true)
    lh.setUint16(10, dosTime, true)
    lh.setUint16(12, dosDate, true)
    lh.setUint32(14, crc, true)
    lh.setUint32(18, isi.length, true)
    lh.setUint32(22, isi.length, true)
    lh.setUint16(26, nama.length, true)
    lh.setUint16(28, 0, true)
    bagian.push(new Uint8Array(lh.buffer), nama, isi)

    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true)
    ch.setUint16(4, 20, true)
    ch.setUint16(6, 20, true)
    ch.setUint16(8, 0x0800, true)
    ch.setUint16(10, 0, true)
    ch.setUint16(12, dosTime, true)
    ch.setUint16(14, dosDate, true)
    ch.setUint32(16, crc, true)
    ch.setUint32(20, isi.length, true)
    ch.setUint32(24, isi.length, true)
    ch.setUint16(28, nama.length, true)
    ch.setUint32(42, offset, true)
    pusat.push(new Uint8Array(ch.buffer), nama)

    offset += 30 + nama.length + isi.length
  }

  const ukuranPusat = pusat.reduce((a, b) => a + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, ukuranPusat, true)
  end.setUint32(16, offset, true)

  const semua = [...bagian, ...pusat, new Uint8Array(end.buffer)]
  const out = new Uint8Array(semua.reduce((a, b) => a + b.length, 0))
  let pos = 0
  for (const b of semua) {
    out.set(b, pos)
    pos += b.length
  }
  return out
}

/** Bangun berkas .xlsx (beberapa sheet) sebagai byte. */
export function buatXlsx(lembar: LembarEks[], tgl = new Date()): Uint8Array {
  const daftar = lembar.length ? lembar : [{ nama: 'Data', kolom: [], baris: [] }]
  const terpakai = new Set<string>()
  const namaAman = daftar.map((l) => namaSheetAman(l.nama, terpakai))
  const files: { nama: string; isi: string }[] = [
    {
      nama: '[Content_Types].xml',
      isi:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        daftar
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        `</Types>`,
    },
    {
      nama: '_rels/.rels',
      isi:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nama: 'xl/workbook.xml',
      isi:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${namaAman.map((n, i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        `</workbook>`,
    },
    {
      nama: 'xl/_rels/workbook.xml.rels',
      isi:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        daftar
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${daftar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { nama: 'xl/styles.xml', isi: STYLES },
    ...daftar.map((l, i) => ({ nama: `xl/worksheets/sheet${i + 1}.xml`, isi: xmlLembar(l) })),
  ]
  return zipStore(files, tgl)
}

export function blobXlsx(lembar: LembarEks[]): Blob {
  // Salin ke ArrayBuffer murni agar kompatibel dengan tipe BlobPart.
  const bytes = buatXlsx(lembar)
  const buf = new ArrayBuffer(bytes.length)
  new Uint8Array(buf).set(bytes)
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Picu unduhan berkas di browser. */
export function unduhBlob(blob: Blob, namaBerkas: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaBerkas
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Bersihkan teks untuk nama berkas. */
export function slugBerkas(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

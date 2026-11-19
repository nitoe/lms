import DOMPurify from 'dompurify'

/**
 * Tampilan instruksi tugas untuk siswa (ANTIREGRESI §Tugas.Instruksi).
 *
 * Instruksi disimpan sebagai TEKS POLOS (textarea guru / keluaran AI) berisi baris baru, «1.»,
 * «-» dan judul bagian berakhiran «:». Sebelumnya teks itu langsung dimasukkan ke HTML sehingga
 * semua baris baru runtuh jadi satu paragraf panjang. `instruksiKeHtml` mengubahnya menjadi
 * judul bagian, daftar bernomor, poin bertingkat, dan paragraf. Instruksi yang sudah berisi tag
 * HTML dibiarkan apa adanya. Hasil SELALU dilewatkan `bersihHtmlInstruksi` sebelum dirender.
 */

const TAG_INSTRUKSI = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li', 'h3']

/** Sanitasi hasil `instruksiKeHtml` (tanpa atribut apa pun). */
export function bersihHtmlInstruksi(html: string | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAG_INSTRUKSI, ALLOWED_ATTR: [] })
}

const ADA_TAG_HTML = /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i
const MARKER_NOMOR = /^\s*(\d{1,2})[.)]\s+(.*)$/
const MARKER_POIN = /^\s*[-*•–]\s+(.*)$/
const HURUF_BESAR = '[A-ZÀ-ÝĀ-Ž]'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Inline: **tebal** dan *miring* (setelah di-escape). */
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>')
}

/**
 * Teks tanpa satu pun baris baru (mis. tersimpan «rata» oleh versi lama / disalin dari layar)
 * dipecah di batas yang jelas: nomor «1.», poin « - », dan judul bagian «Judul Bagian: ».
 * Hanya dipakai bila teks panjang dan benar-benar tanpa baris baru.
 */
function pulihkanBarisRata(t: string): string {
  if (t.includes('\n') || t.length < 160) return t
  let x = t
  // Judul bagian yang diawali kalimat selesai: «… rapi. Cara Pengumpulan: Kumpulkan …»
  x = x.replace(
    new RegExp(
      `(?<=(?:[a-zà-ÿ)]\\.|[!?…]|\\p{Extended_Pictographic}|\\uFE0F)\\s+)(?=${HURUF_BESAR}[\\p{L}'’-]*(?:\\s+[\\p{L}()'’-]+){1,6}:\\s)`,
      'gu',
    ),
    '\n',
  )
  // Kalimat penutup yang lazim («Selamat mencoba!», «Jika ada kendala …») jadi paragraf sendiri.
  x = x.replace(
    /(?<=[a-zà-ÿ)]\.\s+)(?=(?:Selamat (?:mencoba|belajar|bekerja)|Jika ada kendala|Tetap semangat|Semangat)\b)/g,
    '\n\n',
  )
  // Nomor langkah: « 2. Posisi …»
  x = x.replace(new RegExp(`\\s+(?=\\d{1,2}\\.\\s+${HURUF_BESAR})`, 'g'), '\n')
  // Poin: « - Duduklah …»
  x = x.replace(new RegExp(`\\s+-\\s+(?=${HURUF_BESAR})`, 'g'), '\n- ')
  return x
}

type Butir = { teks: string; anak: string[] }

/** Ubah instruksi (teks polos / markdown ringan) menjadi HTML terstruktur. */
export function instruksiKeHtml(sumber: string | undefined): string {
  const mentah = (sumber ?? '').replace(/\r\n?/g, '\n').trim()
  if (!mentah) return ''
  if (ADA_TAG_HTML.test(mentah)) return mentah

  const baris = pulihkanBarisRata(mentah).split('\n')
  const out: string[] = []

  let para: string[] = []
  let ol: Butir[] | null = null
  let ul: string[] | null = null

  const tutupPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join('<br>')}</p>`)
      para = []
    }
  }
  const tutupDaftar = () => {
    if (ol) {
      out.push(
        `<ol>${ol
          .map(
            (b) =>
              `<li>${inline(b.teks)}${
                b.anak.length ? `<ul>${b.anak.map((a) => `<li>${inline(a)}</li>`).join('')}</ul>` : ''
              }</li>`,
          )
          .join('')}</ol>`,
      )
      ol = null
    }
    if (ul) {
      out.push(`<ul>${ul.map((a) => `<li>${inline(a)}</li>`).join('')}</ul>`)
      ul = null
    }
  }
  const tutupSemua = () => {
    tutupPara()
    tutupDaftar()
  }

  for (const asli of baris) {
    const b = asli.trimEnd()
    if (!b.trim()) {
      tutupSemua()
      continue
    }

    // Judul markdown: «## Judul» atau «**Judul:**» sebaris penuh.
    const md = /^\s*#{1,4}\s+(.+)$/.exec(b) ?? /^\s*\*\*([^*]{2,80}?):?\*\*:?\s*$/.exec(b)
    if (md) {
      tutupSemua()
      out.push(`<h3>${inline(md[1].replace(/:$/, ''))}</h3>`)
      continue
    }

    const nomor = MARKER_NOMOR.exec(b)
    if (nomor) {
      tutupPara()
      if (ul) tutupDaftar()
      if (!ol) ol = []
      ol.push({ teks: nomor[2], anak: [] })
      continue
    }

    const poin = MARKER_POIN.exec(b)
    if (poin) {
      tutupPara()
      if (ol && ol.length > 0) {
        // Poin tepat di bawah langkah bernomor = rincian langkah tersebut.
        ol[ol.length - 1].anak.push(poin[1])
      } else {
        if (!ul) ul = []
        ul.push(poin[1])
      }
      continue
    }

    // Judul bagian: «Alat dan Bahan:» atau «Cara Pengumpulan: Kumpulkan …».
    const kata = b.trim().split(/\s+/).length
    const judulPenuh = /^[^:]{3,80}:$/.test(b.trim()) && kata <= 10
    const judulSebaris = /^([^:]{3,60}):\s+(\S.*)$/.exec(b.trim())
    if (judulPenuh && /^[A-ZÀ-ÝĀ-Ž0-9]/.test(b.trim())) {
      tutupSemua()
      out.push(`<h3>${inline(b.trim().slice(0, -1))}</h3>`)
      continue
    }
    if (judulSebaris && judulSebaris[1].trim().split(/\s+/).length <= 6 && /^[A-ZÀ-ÝĀ-Ž]/.test(b.trim())) {
      tutupSemua()
      out.push(`<h3>${inline(judulSebaris[1].trim())}</h3>`)
      para.push(judulSebaris[2])
      continue
    }

    // Teks biasa: lanjutan butir (indentasi) atau paragraf.
    if (ol && ol.length > 0 && /^\s{2,}/.test(asli)) {
      const last = ol[ol.length - 1]
      if (last.anak.length) last.anak[last.anak.length - 1] += ` ${b.trim()}`
      else last.teks += ` ${b.trim()}`
      continue
    }
    tutupDaftar()
    para.push(b.trim())
  }
  tutupSemua()
  return out.join('')
}

/** HTML siap tampil (terformat + disanitasi). */
export function htmlInstruksiSiswa(sumber: string | undefined): string {
  return bersihHtmlInstruksi(instruksiKeHtml(sumber))
}

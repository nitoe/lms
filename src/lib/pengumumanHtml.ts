/**
 * Pipeline HTML pengumuman — satu pintu untuk simpan, tampil guru, dan tampil siswa.
 * ANTIREGRESI §Pengumuman.Tampilan.
 *
 * Prinsip:
 * - Isi yang sudah berupa HTML hanya DISANITASI (bersihHtmlMateri); tidak ditulis ulang.
 * - Teks polos / markdown ringan / HTML ter-escape / pagar ``` ditangani normalisasiHtmlPengumuman.
 * - Heuristik «paragraf tebal beruntun → daftar» (khusus keluaran AI) TIDAK dijalankan pada
 *   HTML yang diketik guru, agar paragraf tebal yang disengaja tidak berubah jadi poin.
 */
import { bersihHtmlMateri, normalisasiHtmlPengumuman } from './html'
import { BATAS_KONTEN_PENGUMUMAN } from '../types/pengumuman'

const POLA_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i

/** true bila string butuh jalur normalisasi penuh (bukan HTML bersih biasa). */
function perluNormalisasiPenuh(s: string): boolean {
  if (/^```/.test(s) || /```\s*$/.test(s)) return true
  // HTML ter-escape penuh (&lt;p&gt;…)
  if ((s.match(/&lt;/g) || []).length >= 2 && !/<[a-zA-Z]/.test(s)) return true
  // Tanpa tag sama sekali: teks polos / markdown ringan
  return !POLA_TAG.test(s)
}

/** HTML pengumuman yang aman untuk disimpan dan ditampilkan. */
export function htmlPengumumanBersih(raw: string | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (perluNormalisasiPenuh(s)) return normalisasiHtmlPengumuman(s)
  return bersihHtmlMateri(s)
}

/**
 * Elemen yang TIDAK dikenal editor visual (Tiptap StarterKit di MateriRichEditor):
 * tabel, kunci lipat, garis, kode, daftar definisi, h4, mark.
 * (blockquote dikenal editor visual, jadi tidak ikut daftar ini.)
 * Isi seperti ini hanya aman disunting di mode HTML; editor visual akan membuangnya.
 */
const POLA_STRUKTUR_LANJUT = /<\s*(table|details|summary|hr|pre|code|dl|h4|mark)[\s>/]/i

export function pengumumanPunyaStrukturLanjut(html: string | undefined): boolean {
  return typeof html === 'string' && POLA_STRUKTUR_LANJUT.test(html)
}

/** Siapkan isi untuk disimpan: sanitasi + batas ukuran (tanpa memotong di tengah tag). */
export function siapkanSimpanPengumuman(raw: string | undefined): string {
  const html = htmlPengumumanBersih(raw)
  if (html.length > BATAS_KONTEN_PENGUMUMAN) {
    throw new Error(
      `Isi pengumuman terlalu panjang (${html.length.toLocaleString('id-ID')} karakter HTML; maksimal ${BATAS_KONTEN_PENGUMUMAN.toLocaleString('id-ID')}). Ringkas isinya.`,
    )
  }
  return html
}

import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Extension } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'

/**
 * Atribut dir/lang (ayat Arab / teks RTL) harus ikut lewat Tiptap.
 * Tanpa ini Tiptap membuangnya saat blok dibuka di mode Visual, padahal
 * bersihHtmlMateri mengizinkannya (ANTIREGRESI §Materi.Arab).
 */
const AtributArah = Extension.create({
  name: 'atributArah',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'tableCell', 'tableHeader'],
        attributes: {
          dir: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('dir'),
            renderHTML: (a: Record<string, unknown>) => (a.dir ? { dir: a.dir as string } : {}),
          },
          lang: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('lang'),
            renderHTML: (a: Record<string, unknown>) => (a.lang ? { lang: a.lang as string } : {}),
          },
        },
      },
    ]
  },
})

type Opsi = {
  /** Aktifkan tabel, bagian lipat, garis, kode, sorot (editor materi «gaya baca»). */
  lanjutan: boolean
  placeholder?: string
}

/**
 * Satu-satunya tempat daftar ekstensi editor materi.
 * lanjutan=false → editor ringkas lama (pengumuman, tidak berubah).
 * lanjutan=true  → semua elemen yang diizinkan bersihHtmlMateri kecuali dl/dt/dd & caption.
 */
export function buatEkstensiMateri({ lanjutan, placeholder }: Opsi) {
  const dasar = [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      codeBlock: lanjutan ? undefined : false,
      code: lanjutan ? undefined : false,
      horizontalRule: lanjutan ? undefined : false,
      strike: lanjutan ? undefined : false,
      link: false,
      underline: false,
    }),
    Subscript,
    Superscript,
    Underline,
    Placeholder.configure({ placeholder: placeholder ?? 'Tulis isi halaman…' }),
  ]
  if (!lanjutan) return dasar
  return [
    ...dasar,
    AtributArah,
    Highlight.configure({ multicolor: false }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Details.configure({ persist: false }),
    DetailsSummary,
    DetailsContent,
  ]
}

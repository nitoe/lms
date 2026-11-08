import { Fragment } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Placeholder } from '@tiptap/extensions'
import { bersihHtml } from '../../lib/html'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Tinggi minimum area ketik (rem). */
  minRem?: number
  ariaLabel?: string
}

const SIMBOL = ['½', '¼', '¾', '×', '÷', '²', '³', '√', 'π', '°', '≤', '≥', '≠', '±', '→']

/**
 * Editor teks kaya ringan: tebal, miring, garis bawah, subskrip/superskrip, daftar, simbol matematika.
 * Komponen dipasang ulang (key) tiap berganti soal, jadi `value` hanya dipakai sebagai isi awal.
 */
export default function RichEditor({ value, onChange, placeholder, minRem = 7, ariaLabel }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
        strike: false,
      }),
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: placeholder ?? 'Ketik di sini…' }),
    ],
    content: bersihHtml(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'soal-rich-area',
        style: `min-height:${minRem}rem`,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  })

  if (!editor) return <div className="soal-rich" style={{ minHeight: `${minRem}rem` }} />

  const tombol = (aktif: boolean, label: string, onClick: () => void, judul: string, kelas = '') => (
    <button
      type="button"
      className={`soal-tb ${aktif ? 'soal-tb--on' : ''} ${kelas}`}
      title={judul}
      aria-label={judul}
      aria-pressed={aktif}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  )

  return (
    <div className="soal-rich">
      <div className="soal-rich-bar" role="toolbar" aria-label="Format teks">
        {tombol(editor.isActive('bold'), 'B', () => editor.chain().focus().toggleBold().run(), 'Tebal', 'font-bold')}
        {tombol(editor.isActive('italic'), 'I', () => editor.chain().focus().toggleItalic().run(), 'Miring', 'italic')}
        {tombol(editor.isActive('underline'), 'U', () => editor.chain().focus().toggleUnderline().run(), 'Garis bawah', 'underline')}
        <span className="soal-tb-sep" />
        {tombol(editor.isActive('subscript'), 'x₂', () => editor.chain().focus().toggleSubscript().run(), 'Subskrip')}
        {tombol(editor.isActive('superscript'), 'x²', () => editor.chain().focus().toggleSuperscript().run(), 'Superskrip')}
        <span className="soal-tb-sep" />
        {tombol(editor.isActive('bulletList'), '• Daftar', () => editor.chain().focus().toggleBulletList().run(), 'Daftar poin')}
        {tombol(editor.isActive('orderedList'), '1. Daftar', () => editor.chain().focus().toggleOrderedList().run(), 'Daftar bernomor')}
        <span className="soal-tb-sep" />
        <div className="soal-simbol" aria-label="Simbol">
          {SIMBOL.map((s) => (
            <Fragment key={s}>
              {tombol(false, s, () => editor.chain().focus().insertContent(s).run(), `Sisipkan ${s}`, 'soal-tb--sym')}
            </Fragment>
          ))}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

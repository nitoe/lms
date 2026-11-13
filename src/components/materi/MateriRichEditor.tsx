import { Fragment, useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Underline from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extensions'
import { bersihHtmlMateri } from '../../lib/html'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minRem?: number
  ariaLabel?: string
}

const SIMBOL = ['½', '¼', '¾', '×', '÷', '²', '³', '√', 'π', '°', '≤', '≥', '≠', '±', '→']

function normHtml(html: string): string {
  const t = bersihHtmlMateri(html || '').trim()
  if (!t || t === '<p></p>') return ''
  return t
}

/**
 * Editor teks kaya untuk blok materi halaman.
 * Mirip RichEditor soal, ditambah heading h2/h3 untuk struktur bacaan.
 */
export default function MateriRichEditor({
  value,
  onChange,
  placeholder,
  minRem = 5,
  ariaLabel,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
      }),
      Subscript,
      Superscript,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? 'Tulis isi halaman…' }),
    ],
    content: bersihHtmlMateri(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'mh-rich-area',
        style: `min-height:${minRem}rem`,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const dariProps = normHtml(value)
    const dariEditor = editor.isEmpty ? '' : normHtml(editor.getHTML())
    if (dariProps === dariEditor) return
    editor.commands.setContent(bersihHtmlMateri(value || ''), { emitUpdate: false })
  }, [value, editor])

  if (!editor) return <div className="mh-rich" style={{ minHeight: `${minRem}rem` }} />

  const tombol = (aktif: boolean, label: string, onClick: () => void, judul: string, kelas = '') => (
    <button
      type="button"
      className={`mh-tb ${aktif ? 'mh-tb--on' : ''} ${kelas}`}
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
    <div className="mh-rich">
      <div className="mh-rich-bar" role="toolbar" aria-label="Format teks">
        {tombol(editor.isActive('heading', { level: 2 }), 'H2', () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Judul bagian')}
        {tombol(editor.isActive('heading', { level: 3 }), 'H3', () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Subjudul')}
        <span className="mh-tb-sep" />
        {tombol(editor.isActive('bold'), 'B', () => editor.chain().focus().toggleBold().run(), 'Tebal', 'font-bold')}
        {tombol(editor.isActive('italic'), 'I', () => editor.chain().focus().toggleItalic().run(), 'Miring', 'italic')}
        {tombol(editor.isActive('underline'), 'U', () => editor.chain().focus().toggleUnderline().run(), 'Garis bawah', 'underline')}
        <span className="mh-tb-sep" />
        {tombol(editor.isActive('subscript'), 'x₂', () => editor.chain().focus().toggleSubscript().run(), 'Subskrip')}
        {tombol(editor.isActive('superscript'), 'x²', () => editor.chain().focus().toggleSuperscript().run(), 'Superskrip')}
        <span className="mh-tb-sep" />
        {tombol(editor.isActive('bulletList'), '•', () => editor.chain().focus().toggleBulletList().run(), 'Daftar poin')}
        {tombol(editor.isActive('orderedList'), '1.', () => editor.chain().focus().toggleOrderedList().run(), 'Daftar bernomor')}
        <span className="mh-tb-sep" />
        <div className="mh-simbol" aria-label="Simbol">
          {SIMBOL.map((s) => (
            <Fragment key={s}>
              {tombol(false, s, () => editor.chain().focus().insertContent(s).run(), `Sisipkan ${s}`, 'mh-tb--sym')}
            </Fragment>
          ))}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

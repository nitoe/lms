import { Fragment, useEffect, useMemo } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { bersihHtmlMateri } from '../../lib/html'
import { buatEkstensiMateri } from './materiTiptap'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minRem?: number
  ariaLabel?: string
  /**
   * Editor materi halaman: area ketik memakai kelas YANG SAMA dengan pembaca
   * (`mh-blok mh-blok--teks soal-rich-view`) sehingga tampilan saat menulis = tampilan baca,
   * dan menambah tabel, bagian lipat, garis, kode, sorot (ANTIREGRESI §Materi.VisualHtml).
   * Pengumuman tidak memakai ini (gayanya diatur pengumuman.css).
   */
  gayaBaca?: boolean
}

const SIMBOL = ['½', '¼', '¾', '×', '÷', '²', '³', '√', 'π', '°', '≤', '≥', '≠', '±', '→']

/**
 * Tiptap menambah paragraf kosong di akhir bila dokumen berakhir dengan tabel / bagian lipat /
 * garis / kode (agar kursor bisa menulis setelahnya). Paragraf itu tidak perlu ikut tersimpan,
 * jadi dibuang saat emit dan saat membandingkan (kalau tidak, isi editor ≠ isi props → setContent
 * berulang dan kursor melompat).
 */
function buangParagrafAkhirKosong(html: string): string {
  return html.replace(/(?:<p>\s*<\/p>\s*)+$/i, '')
}

function normHtml(html: string): string {
  const t = buangParagrafAkhirKosong(bersihHtmlMateri(html || '').trim()).trim()
  if (!t || t === '<p></p>') return ''
  return t
}

/**
 * Editor teks kaya untuk blok materi halaman.
 * Mirip RichEditor soal, ditambah heading h2–h4 untuk struktur bacaan.
 */
export default function MateriRichEditor({
  value,
  onChange,
  placeholder,
  minRem = 5,
  ariaLabel,
  gayaBaca = false,
}: Props) {
  const ekstensi = useMemo(
    () => buatEkstensiMateri({ lanjutan: gayaBaca, placeholder }),
    // placeholder tetap per instans editor; useEditor tidak membuat ulang editor saat berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gayaBaca],
  )

  const editor = useEditor({
    extensions: ekstensi,
    content: bersihHtmlMateri(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: gayaBaca
          ? 'mh-rich-baca mh-blok mh-blok--teks soal-rich-view'
          : 'mh-rich-area',
        style: `min-height:${minRem}rem`,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      if (e.isEmpty) return onChange('')
      const html = e.getHTML()
      onChange(gayaBaca ? buangParagrafAkhirKosong(html) : html)
    },
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

  const dalamTabel = gayaBaca && editor.isActive('table')

  return (
    <div className="mh-rich">
      <div className="mh-rich-bar" role="toolbar" aria-label="Format teks">
        {tombol(editor.isActive('heading', { level: 2 }), 'H2', () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Judul bagian')}
        {tombol(editor.isActive('heading', { level: 3 }), 'H3', () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Subjudul')}
        {tombol(editor.isActive('heading', { level: 4 }), 'H4', () =>
          editor.chain().focus().toggleHeading({ level: 4 }).run(), 'Judul kecil')}
        <span className="mh-tb-sep" />
        {tombol(editor.isActive('bold'), 'B', () => editor.chain().focus().toggleBold().run(), 'Tebal', 'font-bold')}
        {tombol(editor.isActive('italic'), 'I', () => editor.chain().focus().toggleItalic().run(), 'Miring', 'italic')}
        {tombol(editor.isActive('underline'), 'U', () => editor.chain().focus().toggleUnderline().run(), 'Garis bawah', 'underline')}
        {gayaBaca && (
          <>
            {tombol(editor.isActive('strike'), 'S', () => editor.chain().focus().toggleStrike().run(), 'Coret', 'line-through')}
            {tombol(editor.isActive('highlight'), 'Sorot', () => editor.chain().focus().toggleHighlight().run(), 'Sorot teks penting')}
            {tombol(editor.isActive('code'), '</>', () => editor.chain().focus().toggleCode().run(), 'Kode sebaris')}
          </>
        )}
        <span className="mh-tb-sep" />
        {tombol(editor.isActive('subscript'), 'x₂', () => editor.chain().focus().toggleSubscript().run(), 'Subskrip')}
        {tombol(editor.isActive('superscript'), 'x²', () => editor.chain().focus().toggleSuperscript().run(), 'Superskrip')}
        <span className="mh-tb-sep" />
        {tombol(editor.isActive('bulletList'), '•', () => editor.chain().focus().toggleBulletList().run(), 'Daftar poin')}
        {tombol(editor.isActive('orderedList'), '1.', () => editor.chain().focus().toggleOrderedList().run(), 'Daftar bernomor')}
        {tombol(editor.isActive('blockquote'), '“', () => editor.chain().focus().toggleBlockquote().run(), 'Kutipan')}
        {gayaBaca && (
          <>
            <span className="mh-tb-sep" />
            {tombol(editor.isActive('table'), 'Tabel', () =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
              'Sisipkan tabel 3×3 (baris pertama judul kolom)')}
            {tombol(editor.isActive('details'), 'Lipat', () => {
              if (editor.isActive('details')) editor.chain().focus().unsetDetails().run()
              else editor.chain().focus().setDetails().run()
            }, 'Bagian lipat (mis. kunci jawaban) — siswa menekan judul untuk membuka')}
            {tombol(false, '―', () => editor.chain().focus().setHorizontalRule().run(), 'Garis pemisah')}
            {tombol(editor.isActive('codeBlock'), 'Blok kode', () => editor.chain().focus().toggleCodeBlock().run(), 'Blok kode')}
          </>
        )}
        <span className="mh-tb-sep" />
        <div className="mh-simbol" aria-label="Simbol">
          {SIMBOL.map((s) => (
            <Fragment key={s}>
              {tombol(false, s, () => editor.chain().focus().insertContent(s).run(), `Sisipkan ${s}`, 'mh-tb--sym')}
            </Fragment>
          ))}
        </div>
        {dalamTabel && (
          <div className="mh-rich-bar-tabel" role="group" aria-label="Ubah tabel">
            <span className="mh-rich-bar-tabel-label">Tabel:</span>
            {tombol(false, '+ Baris', () => editor.chain().focus().addRowAfter().run(), 'Tambah baris di bawah')}
            {tombol(false, '+ Kolom', () => editor.chain().focus().addColumnAfter().run(), 'Tambah kolom di kanan')}
            {tombol(false, '− Baris', () => editor.chain().focus().deleteRow().run(), 'Hapus baris ini')}
            {tombol(false, '− Kolom', () => editor.chain().focus().deleteColumn().run(), 'Hapus kolom ini')}
            {tombol(false, 'Judul baris', () => editor.chain().focus().toggleHeaderRow().run(), 'Jadikan / lepas baris pertama sebagai judul kolom')}
            {tombol(false, 'Gabung/pisah sel', () => editor.chain().focus().mergeOrSplit().run(), 'Gabung sel terpilih (seret untuk memilih beberapa sel) atau pisahkan sel gabungan')}
            {tombol(false, 'Hapus tabel', () => editor.chain().focus().deleteTable().run(), 'Hapus seluruh tabel', 'mh-tb--bahaya')}
          </div>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { ambilGambarDariDataTransfer } from '../../lib/gambar'
import { ekstrakYoutubeId } from '../../lib/materi'
import { bersihHtmlMateri, unggahMedia } from '../../lib/materiHalaman'
import {
  JENIS_KOTAK,
  UKURAN_GAMBAR,
  WARNA_SOROT,
  WARNA_TEKS,
  ekstensiMateri,
  type RataTeks,
} from './ekstensi'

type Props = {
  /** HTML awal. Editor dibuat ulang (pakai `key`) saat berganti halaman. */
  awal: string
  kelas: string
  onChange: (html: string) => void
}

type PanelInput = null | 'youtube' | 'tautan'

const NODE_MEDIA = ['gambarMateri', 'audioMateri', 'videoMateri', 'youtubeMateri']

function Tb({
  aktif,
  judul,
  onClick,
  children,
  disabled,
}: {
  aktif?: boolean
  judul: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`me-tb ${aktif ? 'me-tb--on' : ''}`}
      title={judul}
      aria-label={judul}
      aria-pressed={aktif}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

const Sep = () => <span className="me-sep" aria-hidden />

export default function MateriEditor({ awal, kelas, onChange }: Props) {
  const [unggah, setUnggah] = useState<{ nama: string; persen: number } | null>(null)
  const [galat, setGalat] = useState('')
  const [panel, setPanel] = useState<PanelInput>(null)
  const [isiPanel, setIsiPanel] = useState('')
  const [menuWarna, setMenuWarna] = useState<null | 'teks' | 'sorot'>(null)
  const fileGambar = useRef<HTMLInputElement>(null)
  const fileAudio = useRef<HTMLInputElement>(null)
  const fileVideo = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)

  const sisipkanFile = useCallback(
    async (file: File) => {
      const ed = editorRef.current
      if (!ed) return
      setGalat('')
      setUnggah({ nama: file.name || 'gambar', persen: 0 })
      try {
        const r = await unggahMedia(file, kelas, (persen) => setUnggah({ nama: file.name || 'gambar', persen }))
        if (ed.isDestroyed) return
        const node =
          r.jenis === 'gambar'
            ? { type: 'gambarMateri', attrs: { src: r.url, ukuran: 'sedang', rata: 'tengah' } }
            : r.jenis === 'audio'
              ? { type: 'audioMateri', attrs: { src: r.url } }
              : { type: 'videoMateri', attrs: { src: r.url } }
        ed.chain().focus().insertContent(node).run()
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal mengunggah file.')
      } finally {
        setUnggah(null)
      }
    },
    [kelas],
  )

  const editor = useEditor({
    extensions: ekstensiMateri(),
    content: bersihHtmlMateri(awal),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'mt-isi me-area', 'aria-label': 'Isi halaman materi' },
      handlePaste: (_v, ev) => {
        const f = ambilGambarDariDataTransfer(ev.clipboardData)
        if (!f) return false
        void sisipkanFile(f)
        return true
      },
      handleDrop: (_v, ev) => {
        const f = ambilGambarDariDataTransfer(ev.dataTransfer)
        if (!f) return false
        ev.preventDefault()
        void sisipkanFile(f)
        return true
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  })

  if (!editor) return <div className="me-wrap" style={{ minHeight: '16rem' }} />

  const ch = () => editor.chain().focus()
  const aktifMedia = NODE_MEDIA.find((n) => editor.isActive(n))
  const dalamTabel = editor.isActive('table')
  const dalamKotak = editor.isActive('kotak')

  function rata(v: RataTeks) {
    const val = v === 'kiri' ? null : v
    ch().updateAttributes('paragraph', { rata: val }).updateAttributes('heading', { rata: val }).run()
  }

  function setBlok(v: string) {
    if (v === 'p') ch().setParagraph().run()
    else ch().setHeading({ level: v === 'h2' ? 2 : 3 }).run()
  }

  function terapkanPanel(e: React.FormEvent) {
    e.preventDefault()
    const nilai = isiPanel.trim()
    if (!nilai) return
    if (panel === 'youtube') {
      const id = ekstrakYoutubeId(nilai)
      if (!id || !/^[\w-]{11}$/.test(id)) {
        setGalat('Tautan YouTube tidak dikenali.')
        return
      }
      ch().insertContent({ type: 'youtubeMateri', attrs: { id } }).run()
    } else if (panel === 'tautan') {
      let url = nilai
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`
      try {
        new URL(url)
      } catch {
        setGalat('Alamat tautan tidak valid.')
        return
      }
      if (editor!.state.selection.empty) {
        ch().insertContent({ type: 'text', text: nilai, marks: [{ type: 'link', attrs: { href: url } }] }).run()
      } else {
        ch().extendMarkRange('link').setLink({ href: url }).run()
      }
    }
    setGalat('')
    setIsiPanel('')
    setPanel(null)
  }

  const sel = editor.state.selection as unknown as { node?: { attrs: Record<string, string>; type: { name: string } } }
  const nodeTerpilih = aktifMedia ? sel.node : undefined

  function ubahNode(attrs: Record<string, string>) {
    if (aktifMedia) ch().updateAttributes(aktifMedia, attrs).run()
  }

  const blokNilai = editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'

  return (
    <div className="me-wrap">
      <div className="me-bar" role="toolbar" aria-label="Format dan sisipan">
        <select
          className="me-select"
          aria-label="Gaya paragraf"
          value={blokNilai}
          onChange={(e) => setBlok(e.target.value)}
        >
          <option value="p">Paragraf</option>
          <option value="h2">Judul bagian</option>
          <option value="h3">Sub judul</option>
        </select>
        <Tb aktif={editor.isActive('bold')} judul="Tebal" onClick={() => ch().toggleBold().run()}>
          <b>B</b>
        </Tb>
        <Tb aktif={editor.isActive('italic')} judul="Miring" onClick={() => ch().toggleItalic().run()}>
          <i>I</i>
        </Tb>
        <Tb aktif={editor.isActive('underline')} judul="Garis bawah" onClick={() => ch().toggleUnderline().run()}>
          <u>U</u>
        </Tb>
        <Tb aktif={menuWarna === 'teks' || editor.isActive('warna')} judul="Warna teks" onClick={() => setMenuWarna(menuWarna === 'teks' ? null : 'teks')}>
          <span style={{ color: '#b91c1c', fontWeight: 700 }}>A</span>
        </Tb>
        <Tb aktif={menuWarna === 'sorot' || editor.isActive('sorot')} judul="Stabilo (sorot teks)" onClick={() => setMenuWarna(menuWarna === 'sorot' ? null : 'sorot')}>
          <span style={{ background: '#fef08a', padding: '0 0.25rem', fontWeight: 700 }}>ab</span>
        </Tb>
        <Tb aktif={editor.isActive('subscript')} judul="Subskrip" onClick={() => ch().toggleSubscript().run()}>
          x₂
        </Tb>
        <Tb aktif={editor.isActive('superscript')} judul="Superskrip" onClick={() => ch().toggleSuperscript().run()}>
          x²
        </Tb>
        <Sep />
        <Tb aktif={editor.isActive('bulletList')} judul="Daftar poin" onClick={() => ch().toggleBulletList().run()}>
          •≡
        </Tb>
        <Tb aktif={editor.isActive('orderedList')} judul="Daftar bernomor" onClick={() => ch().toggleOrderedList().run()}>
          1≡
        </Tb>
        <Tb judul="Rata kiri" aktif={!editor.getAttributes('paragraph').rata && !editor.getAttributes('heading').rata} onClick={() => rata('kiri')}>
          ⇤
        </Tb>
        <Tb judul="Rata tengah" aktif={editor.getAttributes('paragraph').rata === 'tengah' || editor.getAttributes('heading').rata === 'tengah'} onClick={() => rata('tengah')}>
          ↔
        </Tb>
        <Tb judul="Rata kanan" aktif={editor.getAttributes('paragraph').rata === 'kanan' || editor.getAttributes('heading').rata === 'kanan'} onClick={() => rata('kanan')}>
          ⇥
        </Tb>
        <Sep />
        <Tb judul="Sisipkan gambar" onClick={() => fileGambar.current?.click()} disabled={!!unggah}>
          🖼 Gambar
        </Tb>
        <Tb judul="Sisipkan audio" onClick={() => fileAudio.current?.click()} disabled={!!unggah}>
          🔊 Audio
        </Tb>
        <Tb judul="Sisipkan video dari file" onClick={() => fileVideo.current?.click()} disabled={!!unggah}>
          🎬 Video
        </Tb>
        <Tb aktif={panel === 'youtube'} judul="Sisipkan video YouTube" onClick={() => setPanel(panel === 'youtube' ? null : 'youtube')}>
          ▶ YouTube
        </Tb>
        <Tb aktif={panel === 'tautan' || editor.isActive('link')} judul="Tautan" onClick={() => setPanel(panel === 'tautan' ? null : 'tautan')}>
          🔗
        </Tb>
        <Sep />
        <Tb judul="Sisipkan tabel 3×3" onClick={() => ch().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          ▦ Tabel
        </Tb>
        <Tb aktif={dalamKotak} judul="Kotak penekanan (Info, Contoh, Penting, Latihan)" onClick={() => (dalamKotak ? ch().lift('kotak').run() : ch().wrapIn('kotak', { jenis: 'info' }).run())}>
          ▣ Kotak
        </Tb>
        <Tb aktif={editor.isActive('blockquote')} judul="Kutipan" onClick={() => ch().toggleBlockquote().run()}>
          ❝
        </Tb>
        <Tb judul="Garis pemisah" onClick={() => ch().setHorizontalRule().run()}>
          ―
        </Tb>
        <Sep />
        <Tb judul="Urungkan" onClick={() => ch().undo().run()} disabled={!editor.can().undo()}>
          ↶
        </Tb>
        <Tb judul="Ulangi" onClick={() => ch().redo().run()} disabled={!editor.can().redo()}>
          ↷
        </Tb>
      </div>

      <input ref={fileGambar} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sisipkanFile(f) }} />
      <input ref={fileAudio} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sisipkanFile(f) }} />
      <input ref={fileVideo} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sisipkanFile(f) }} />

      {menuWarna && (
        <div className="me-sub" role="group" aria-label={menuWarna === 'teks' ? 'Pilih warna teks' : 'Pilih warna stabilo'}>
          <span className="me-sub-label">{menuWarna === 'teks' ? 'Warna teks' : 'Stabilo'}</span>
          {(menuWarna === 'teks' ? WARNA_TEKS : WARNA_SOROT).map((w) => (
            <button
              key={w.id}
              type="button"
              className="me-swatch"
              style={{ background: w.hex }}
              title={w.label}
              aria-label={w.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (menuWarna === 'teks') ch().setMark('warna', { w: w.id }).run()
                else ch().setMark('sorot', { w: w.id }).run()
                setMenuWarna(null)
              }}
            />
          ))}
          <button
            type="button"
            className="me-btn-kecil"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (menuWarna === 'teks') ch().unsetMark('warna').run()
              else ch().unsetMark('sorot').run()
              setMenuWarna(null)
            }}
          >
            Hapus warna
          </button>
        </div>
      )}

      {panel && (
        <form className="me-sub" onSubmit={terapkanPanel}>
          <span className="me-sub-label">{panel === 'youtube' ? 'URL YouTube' : 'Alamat tautan'}</span>
          <input
            autoFocus
            className="me-input"
            type="text"
            inputMode="url"
            value={isiPanel}
            onChange={(e) => setIsiPanel(e.target.value)}
            placeholder={panel === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}
          />
          <button type="submit" className="me-btn-kecil me-btn-kecil--utama">
            {panel === 'youtube' ? 'Sisipkan' : 'Pasang'}
          </button>
          {panel === 'tautan' && editor.isActive('link') && (
            <button type="button" className="me-btn-kecil" onClick={() => { ch().extendMarkRange('link').unsetLink().run(); setPanel(null) }}>
              Lepas tautan
            </button>
          )}
          <button type="button" className="me-btn-kecil" onClick={() => { setPanel(null); setIsiPanel('') }}>
            Batal
          </button>
        </form>
      )}

      {nodeTerpilih && (
        <div className="me-sub" role="group" aria-label="Pengaturan media terpilih">
          <span className="me-sub-label">
            {aktifMedia === 'gambarMateri' ? 'Gambar' : aktifMedia === 'audioMateri' ? 'Audio' : aktifMedia === 'videoMateri' ? 'Video' : 'YouTube'}
          </span>
          {aktifMedia === 'gambarMateri' && (
            <>
              {UKURAN_GAMBAR.map((u) => (
                <button key={u.id} type="button" className={`me-btn-kecil ${nodeTerpilih.attrs.ukuran === u.id ? 'me-btn-kecil--on' : ''}`} onClick={() => ubahNode({ ukuran: u.id })}>
                  {u.label}
                </button>
              ))}
              {(['kiri', 'tengah', 'kanan'] as const).map((r) => (
                <button key={r} type="button" className={`me-btn-kecil ${nodeTerpilih.attrs.rata === r ? 'me-btn-kecil--on' : ''}`} onClick={() => ubahNode({ rata: r })}>
                  {r === 'kiri' ? '⇤ Kiri' : r === 'tengah' ? '↔ Tengah' : 'Kanan ⇥'}
                </button>
              ))}
            </>
          )}
          <input
            className="me-input"
            type="text"
            maxLength={160}
            value={nodeTerpilih.attrs.keterangan ?? ''}
            onChange={(e) => ubahNode({ keterangan: e.target.value })}
            placeholder="Keterangan di bawah media (opsional)"
            aria-label="Keterangan media"
          />
          <button type="button" className="me-btn-kecil me-btn-kecil--bahaya" onClick={() => ch().deleteSelection().run()}>
            Hapus
          </button>
        </div>
      )}

      {dalamKotak && !nodeTerpilih && (
        <div className="me-sub" role="group" aria-label="Jenis kotak">
          <span className="me-sub-label">Kotak</span>
          {JENIS_KOTAK.map((j) => (
            <button key={j.id} type="button" className={`me-btn-kecil ${editor.getAttributes('kotak').jenis === j.id ? 'me-btn-kecil--on' : ''}`} onClick={() => ch().updateAttributes('kotak', { jenis: j.id }).run()}>
              {j.label}
            </button>
          ))}
          <button type="button" className="me-btn-kecil" onClick={() => ch().lift('kotak').run()}>
            Lepas kotak
          </button>
        </div>
      )}

      {dalamTabel && !nodeTerpilih && (
        <div className="me-sub" role="group" aria-label="Pengaturan tabel">
          <span className="me-sub-label">Tabel</span>
          <button type="button" className="me-btn-kecil" onClick={() => ch().addRowAfter().run()}>+ Baris</button>
          <button type="button" className="me-btn-kecil" onClick={() => ch().addColumnAfter().run()}>+ Kolom</button>
          <button type="button" className="me-btn-kecil" onClick={() => ch().deleteRow().run()}>− Baris</button>
          <button type="button" className="me-btn-kecil" onClick={() => ch().deleteColumn().run()}>− Kolom</button>
          <button type="button" className="me-btn-kecil" onClick={() => ch().toggleHeaderRow().run()}>Baris judul</button>
          <button type="button" className="me-btn-kecil me-btn-kecil--bahaya" onClick={() => ch().deleteTable().run()}>Hapus tabel</button>
        </div>
      )}

      {unggah && (
        <div className="me-status" role="status">
          Mengunggah «{unggah.nama}» … {unggah.persen}%
          <span className="me-progres"><span style={{ width: `${unggah.persen}%` }} /></span>
        </div>
      )}
      {galat && (
        <div className="me-galat" role="alert">
          {galat}
          <button type="button" className="me-btn-kecil" onClick={() => setGalat('')}>Tutup</button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

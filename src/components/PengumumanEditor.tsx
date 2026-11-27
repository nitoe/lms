import { useRef, useState } from 'react'
import MateriRichEditor from './materi/MateriRichEditor'
import PengumumanIsi from './PengumumanIsi'
import { htmlPengumumanBersih, pengumumanPunyaStrukturLanjut } from '../lib/pengumumanHtml'
import '../styles/pengumuman.css'
import '../styles/materi-halaman.css'

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
}

type ModeSunting = 'visual' | 'html'

/** Potongan HTML siap sisip untuk mode HTML (semuanya lolos sanitasi bersihHtmlMateri). */
const POTONGAN: { label: string; judul: string; html: string }[] = [
  { label: 'Judul', judul: 'Judul bagian', html: '<h2>Judul bagian</h2>\n' },
  { label: '• Poin', judul: 'Daftar poin', html: '<ul>\n<li>Poin pertama</li>\n<li>Poin kedua</li>\n</ul>\n' },
  { label: '1. Urut', judul: 'Daftar bernomor', html: '<ol>\n<li>Langkah pertama</li>\n<li>Langkah kedua</li>\n</ol>\n' },
  {
    label: 'Tabel',
    judul: 'Tabel jadwal / data',
    html:
      '<table>\n<thead>\n<tr><th>Hari</th><th>Kegiatan</th></tr>\n</thead>\n<tbody>\n<tr><td>Senin</td><td>…</td></tr>\n<tr><td>Selasa</td><td>…</td></tr>\n</tbody>\n</table>\n',
  },
  {
    label: 'Lipat',
    judul: 'Bagian yang bisa dibuka-tutup',
    html: '<details>\n<summary>Lihat selengkapnya</summary>\n<p>Isi yang disembunyikan.</p>\n</details>\n',
  },
  { label: 'Garis', judul: 'Garis pemisah', html: '<hr>\n' },
]

/**
 * Editor isi pengumuman: mode Visual (Tiptap) dan mode HTML (sumber + pratinjau langsung),
 * mengikuti pola editor materi/TKA. Mode HTML otomatis dipakai bila isi memuat tabel,
 * kunci lipat, dsb. yang tidak dikenal editor visual (§Pengumuman.Tampilan).
 *
 * Jangan membungkus komponen ini di <label>: label mewariskan font-weight/ukuran ke isi
 * editor (seluruh teks tampil tebal) dan klik pada label memindahkan fokus.
 */
export default function PengumumanEditor({ value, onChange, disabled = false }: Props) {
  const [mode, setMode] = useState<ModeSunting>('visual')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const lanjut = pengumumanPunyaStrukturLanjut(value)
  // Kunci ke mode HTML begitu isi memuat elemen lanjutan, dan TETAP di HTML walau elemen itu
  // dihapus saat mengetik (jika tidak, editor akan melompat ke Visual di tengah penyuntingan).
  if (lanjut && mode !== 'html') setMode('html')
  const modeEfektif: ModeSunting = lanjut ? 'html' : mode

  function keVisual() {
    // Rapikan dulu (teks polos / markdown → HTML) agar editor visual menerima HTML valid.
    const rapi = htmlPengumumanBersih(value)
    if (rapi !== value) onChange(rapi)
    setMode('visual')
  }

  function sisip(potongan: string) {
    const el = areaRef.current
    const a = el?.selectionStart ?? value.length
    const b = el?.selectionEnd ?? value.length
    onChange(value.slice(0, a) + potongan + value.slice(b))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const p = a + potongan.length
      el.setSelectionRange(p, p)
    })
  }

  return (
    <div className="pg-editor" aria-label="Editor isi pengumuman">
      <div className="pg-mode" role="group" aria-label="Mode sunting isi">
        <button
          type="button"
          className={modeEfektif === 'visual' ? 'pg-mode-on' : ''}
          disabled={disabled || lanjut}
          title={
            lanjut
              ? 'Isi memuat tabel / bagian lipat / elemen lanjutan. Sunting lewat mode HTML agar tidak hilang.'
              : 'Sunting seperti dokumen'
          }
          onClick={keVisual}
        >
          Visual
        </button>
        <button
          type="button"
          className={modeEfektif === 'html' ? 'pg-mode-on' : ''}
          disabled={disabled}
          title="Sunting kode HTML (tabel, bagian lipat, dsb.)"
          onClick={() => setMode('html')}
        >
          HTML / tabel
        </button>
      </div>

      {modeEfektif === 'visual' ? (
        <MateriRichEditor
          value={value}
          onChange={onChange}
          placeholder="Tulis paragraf, daftar, penekanan…"
          minRem={9}
          ariaLabel="Isi pengumuman"
        />
      ) : (
        <>
          <div className="pg-potongan" role="toolbar" aria-label="Sisipkan elemen HTML">
            {POTONGAN.map((p) => (
              <button
                key={p.label}
                type="button"
                className="pg-potongan-btn"
                title={p.judul}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sisip(p.html)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <textarea
            ref={areaRef}
            className="pg-html-area"
            value={value}
            spellCheck={false}
            disabled={disabled}
            aria-label="Sumber HTML isi pengumuman"
            placeholder="Tempel HTML, atau ketik teks biasa (Enter dua kali = paragraf baru)…"
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              const rapi = htmlPengumumanBersih(e.target.value)
              if (rapi !== e.target.value) onChange(rapi)
            }}
          />
          <p className="pg-html-bantu">
            Tag yang diterima: p, h2–h4, daftar, tebal/miring/garis bawah, tabel (th/td), bagian lipat{' '}
            <code>&lt;details&gt;&lt;summary&gt;</code>, blockquote, hr, mark, code, rumus <code>$…$</code>. Tanpa
            style/class/script — dibuang otomatis saat Anda keluar dari kolom ini.
          </p>
          <div className="pg-pratinjau">
            <span className="pg-pratinjau-judul">Pratinjau tampilan siswa</span>
            {value.trim() ? (
              <PengumumanIsi html={value} />
            ) : (
              <p className="pg-pratinjau-kosong">Belum ada isi.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

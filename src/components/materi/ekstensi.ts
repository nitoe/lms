import { Extension, Mark, Node, mergeAttributes, type AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'

/** Semua atribut ber-prefix `data-` agar lolos sanitasi (lib/materiHalaman.ts) dan tidak memakai style inline. */

export const WARNA_TEKS = [
  { id: 'merah', label: 'Merah', hex: '#b91c1c' },
  { id: 'oranye', label: 'Oranye', hex: '#c2410c' },
  { id: 'hijau', label: 'Hijau', hex: '#15803d' },
  { id: 'biru', label: 'Biru', hex: '#1d4ed8' },
  { id: 'ungu', label: 'Ungu', hex: '#6d28d9' },
] as const

export const WARNA_SOROT = [
  { id: 'kuning', label: 'Kuning', hex: '#fef08a' },
  { id: 'hijau', label: 'Hijau', hex: '#bbf7d0' },
  { id: 'biru', label: 'Biru', hex: '#bfdbfe' },
  { id: 'merah', label: 'Merah muda', hex: '#fecdd3' },
] as const

export const JENIS_KOTAK = [
  { id: 'info', label: 'Info' },
  { id: 'contoh', label: 'Contoh' },
  { id: 'penting', label: 'Penting' },
  { id: 'latihan', label: 'Latihan' },
] as const

export const UKURAN_GAMBAR = [
  { id: 'kecil', label: 'Kecil' },
  { id: 'sedang', label: 'Sedang' },
  { id: 'besar', label: 'Besar' },
  { id: 'penuh', label: 'Penuh' },
] as const

export type RataTeks = 'kiri' | 'tengah' | 'kanan'

/** Perataan paragraf & judul (data-rata). Default = kiri (tanpa atribut). */
const Rata = Extension.create({
  name: 'rata',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          rata: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-rata'),
            renderHTML: (a: Record<string, unknown>) => (a.rata ? { 'data-rata': a.rata } : {}),
          },
        },
      },
    ]
  },
})

const Warna = Mark.create({
  name: 'warna',
  addAttributes() {
    return {
      w: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-w'),
        renderHTML: (a: Record<string, unknown>) => (a.w ? { 'data-w': a.w } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-w]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },
})

const Sorot = Mark.create({
  name: 'sorot',
  addAttributes() {
    return {
      w: {
        default: 'kuning',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-w'),
        renderHTML: (a: Record<string, unknown>) => ({ 'data-w': a.w ?? 'kuning' }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'mark[data-w]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0]
  },
})

/** Kotak penekanan (Info / Contoh / Penting / Latihan) berisi blok bebas. */
const Kotak = Node.create({
  name: 'kotak',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      jenis: {
        default: 'info',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-kotak') || 'info',
        renderHTML: (a: Record<string, unknown>) => ({ 'data-kotak': a.jenis ?? 'info' }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-kotak]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0]
  },
})

function keterangan(a: Record<string, unknown>) {
  return typeof a.keterangan === 'string' && a.keterangan.trim() ? a.keterangan.trim() : ''
}

const GambarMateri = Node.create({
  name: 'gambarMateri',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      keterangan: { default: '' },
      ukuran: { default: 'sedang' },
      rata: { default: 'tengah' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-gambar]',
        getAttrs: (el) => {
          const f = el as HTMLElement
          const img = f.querySelector('img')
          return {
            src: img?.getAttribute('src') ?? '',
            keterangan: f.querySelector('figcaption')?.textContent ?? img?.getAttribute('alt') ?? '',
            ukuran: f.getAttribute('data-ukuran') || 'sedang',
            rata: f.getAttribute('data-rata') || 'tengah',
          }
        },
      },
    ]
  },
  renderHTML({ node }) {
    const a = node.attrs
    const k = keterangan(a)
    const fig = { 'data-gambar': '', 'data-ukuran': a.ukuran, 'data-rata': a.rata }
    const img = ['img', { src: a.src, alt: k || 'Gambar materi', loading: 'lazy' }] as const
    return k ? ['figure', fig, img, ['figcaption', k]] : ['figure', fig, img]
  },
})

function buatNodeMedia(nama: string, penanda: string, tag: 'audio' | 'video') {
  return Node.create({
    name: nama,
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
      return { src: { default: '' }, keterangan: { default: '' } }
    },
    parseHTML() {
      return [
        {
          tag: `figure[${penanda}]`,
          getAttrs: (el) => {
            const f = el as HTMLElement
            return {
              src: f.querySelector(tag)?.getAttribute('src') ?? '',
              keterangan: f.querySelector('figcaption')?.textContent ?? '',
            }
          },
        },
      ]
    },
    renderHTML({ node }) {
      const k = keterangan(node.attrs)
      const media = [
        tag,
        mergeAttributes({ src: node.attrs.src, controls: '', preload: 'metadata' }, tag === 'video' ? { playsinline: '' } : {}),
      ] as const
      return k
        ? ['figure', { [penanda]: '' }, media, ['figcaption', k]]
        : ['figure', { [penanda]: '' }, media]
    },
  })
}

const AudioMateri = buatNodeMedia('audioMateri', 'data-audio', 'audio')
const VideoMateri = buatNodeMedia('videoMateri', 'data-video', 'video')

/** Video YouTube: hanya menyimpan ID; iframe dibuat pembaca (lihat MateriBaca). */
const YoutubeMateri = Node.create({
  name: 'youtubeMateri',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { id: { default: '' }, keterangan: { default: '' } }
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-yt]',
        getAttrs: (el) => {
          const f = el as HTMLElement
          return {
            id: f.getAttribute('data-yt') ?? '',
            keterangan: f.querySelector('figcaption')?.textContent ?? '',
          }
        },
      },
    ]
  },
  renderHTML({ node }) {
    const k = keterangan(node.attrs)
    return k
      ? ['figure', { 'data-yt': node.attrs.id }, ['figcaption', k]]
      : ['figure', { 'data-yt': node.attrs.id }]
  },
})

export function ekstensiMateri(placeholder?: string): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),
    Subscript,
    Superscript,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Rata,
    Warna,
    Sorot,
    Kotak,
    GambarMateri,
    AudioMateri,
    VideoMateri,
    YoutubeMateri,
    Placeholder.configure({ placeholder: placeholder ?? 'Ketik materi di sini…' }),
  ]
}

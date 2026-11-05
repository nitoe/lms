/** Palet soft untuk kartu ruang kelas — deterministik per nama mapel. */
export type AksenMapel = {
  bar: string
  chip: string
  soft: string
  /** Gradien cover kartu (CSS) */
  cover: string
  /** Warna aksen teks di cover */
  coverFg: string
}

const AKSEEN: AksenMapel[] = [
  {
    bar: '#313083',
    chip: 'bg-muh-50 text-muh-700',
    soft: 'bg-[#eff0fa]',
    cover: 'linear-gradient(135deg, #313083 0%, #5b61c4 55%, #8b9cf7 100%)',
    coverFg: '#e8eaff',
  },
  {
    bar: '#0369a1',
    chip: 'bg-sky-50 text-sky-800',
    soft: 'bg-sky-50',
    cover: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #7dd3fc 100%)',
    coverFg: '#e0f2fe',
  },
  {
    bar: '#0f766e',
    chip: 'bg-teal-50 text-teal-800',
    soft: 'bg-teal-50',
    cover: 'linear-gradient(135deg, #134e4a 0%, #0d9488 50%, #5eead4 100%)',
    coverFg: '#ccfbf1',
  },
  {
    bar: '#a16207',
    chip: 'bg-amber-50 text-amber-900',
    soft: 'bg-amber-50',
    cover: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #fcd34d 100%)',
    coverFg: '#fef3c7',
  },
  {
    bar: '#9f1239',
    chip: 'bg-rose-50 text-rose-800',
    soft: 'bg-rose-50',
    cover: 'linear-gradient(135deg, #881337 0%, #e11d48 50%, #fb7185 100%)',
    coverFg: '#ffe4e6',
  },
  {
    bar: '#6d28d9',
    chip: 'bg-violet-50 text-violet-800',
    soft: 'bg-violet-50',
    cover: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #c4b5fd 100%)',
    coverFg: '#ede9fe',
  },
  {
    bar: '#c2410c',
    chip: 'bg-orange-50 text-orange-900',
    soft: 'bg-orange-50',
    cover: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fdba74 100%)',
    coverFg: '#ffedd5',
  },
  {
    bar: '#15803d',
    chip: 'bg-green-50 text-green-800',
    soft: 'bg-green-50',
    cover: 'linear-gradient(135deg, #14532d 0%, #16a34a 50%, #86efac 100%)',
    coverFg: '#dcfce7',
  },
]

export function aksenMapel(nama: string): AksenMapel {
  let h = 0
  for (let i = 0; i < nama.length; i++) h = (h * 31 + nama.charCodeAt(i)) >>> 0
  return AKSEEN[h % AKSEEN.length]
}

export function inisialMapel(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

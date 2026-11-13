import type { ReactNode } from 'react'

/** Ikon garis kecil untuk halaman Beranda / Ruang Kelas (dekoratif, aria-hidden). */
function Svg({ size = 18, sw = 1.8, children }: { size?: number; sw?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const IkonCari = ({ size = 16 }: P) => (
  <Svg size={size} sw={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)

export const IkonPlus = ({ size = 14 }: P) => (
  <Svg size={size} sw={2.6}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IkonPanah = ({ size = 14 }: P) => (
  <Svg size={size} sw={2.2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)

export const IkonRefresh = ({ size = 15 }: P) => (
  <Svg size={size} sw={2}>
    <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
  </Svg>
)

export const IkonJam = ({ size = 11 }: P) => (
  <Svg size={size} sw={2.6}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)

export const IkonTugas = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
    <path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H16" />
    <path d="m9 14 2 2 4-4" />
  </Svg>
)

export const IkonKuis = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.7 2.3-2.7 3.8" />
    <path d="M12 17.2h.01" />
  </Svg>
)

export const IkonMateri = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </Svg>
)

export const IkonBankSoal = ({ size }: P) => (
  <Svg size={size}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Svg>
)

export const IkonPengumuman = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
  </Svg>
)

export const IkonRekap = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16" />
  </Svg>
)

export const IkonTka = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M7 10.5V16c0 1.4 2.2 3 5 3s5-1.6 5-3v-5.5" />
  </Svg>
)

export const IkonRuang = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
)

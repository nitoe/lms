/**
 * Pembuat kode QR kecil tanpa dependensi (mode byte, koreksi galat M, versi 1–6 → hingga 106 byte).
 * Cukup untuk tautan YouTube / https pendek di materi cetak. ANTIREGRESI §Materi.Cetak.
 * Diverifikasi dengan pemindai QR (jsQR) untuk semua pola mask dan beberapa panjang teks.
 */

type TabelVersi = { total: number; data: number; ecPerBlok: number; blok: number }
// Koreksi galat M. total = jumlah codeword, data = codeword data, ecPerBlok, blok (sama besar).
const VERSI_M: TabelVersi[] = [
  { total: 26, data: 16, ecPerBlok: 10, blok: 1 },
  { total: 44, data: 28, ecPerBlok: 16, blok: 1 },
  { total: 70, data: 44, ecPerBlok: 26, blok: 1 },
  { total: 100, data: 64, ecPerBlok: 18, blok: 2 },
  { total: 134, data: 86, ecPerBlok: 24, blok: 2 },
  { total: 172, data: 108, ecPerBlok: 16, blok: 4 },
]
const BATAS_ALIGNMENT = [0, 18, 22, 26, 30, 34] // pusat pola alignment (versi 2–6), indeks = versi-1

/* ── Aritmatika Galois GF(256), polinomial 0x11d ── */
const EXP = new Array<number>(512)
const LOG = new Array<number>(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function kaliGf(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]
}

function polinomGenerator(derajat: number): number[] {
  let g = [1]
  for (let i = 0; i < derajat; i++) {
    const next = new Array<number>(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j]
      next[j + 1] ^= kaliGf(g[j], EXP[i])
    }
    g = next
  }
  return g
}

function sisaReedSolomon(data: number[], jumlahEc: number): number[] {
  const gen = polinomGenerator(jumlahEc)
  const sisa = new Array<number>(jumlahEc).fill(0)
  for (const d of data) {
    const faktor = d ^ sisa[0]
    sisa.shift()
    sisa.push(0)
    for (let i = 0; i < jumlahEc; i++) sisa[i] ^= kaliGf(gen[i + 1], faktor)
  }
  return sisa
}

function utf8(teks: string): number[] {
  return Array.from(new TextEncoder().encode(teks))
}

/** Bit-string → codeword data (sudah dengan penutup dan padding 0xEC/0x11). */
function susunData(bytes: number[], kapasitasData: number): number[] {
  const bits: number[] = []
  const dorong = (nilai: number, panjang: number) => {
    for (let i = panjang - 1; i >= 0; i--) bits.push((nilai >> i) & 1)
  }
  dorong(0b0100, 4) // mode byte
  dorong(bytes.length, 8) // jumlah karakter (versi 1–9 = 8 bit)
  for (const b of bytes) dorong(b, 8)
  const kapasitasBit = kapasitasData * 8
  dorong(0, Math.min(4, kapasitasBit - bits.length)) // terminator
  while (bits.length % 8 !== 0) bits.push(0)
  const cw: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    cw.push(v)
  }
  for (let pad = 0; cw.length < kapasitasData; pad++) cw.push(pad % 2 === 0 ? 0xec : 0x11)
  return cw
}

function susunCodeword(data: number[], t: TabelVersi): number[] {
  const ukuranBlok = t.data / t.blok
  const blokData: number[][] = []
  const blokEc: number[][] = []
  for (let b = 0; b < t.blok; b++) {
    const bagian = data.slice(b * ukuranBlok, (b + 1) * ukuranBlok)
    blokData.push(bagian)
    blokEc.push(sisaReedSolomon(bagian, t.ecPerBlok))
  }
  const hasil: number[] = []
  for (let i = 0; i < ukuranBlok; i++) for (const b of blokData) hasil.push(b[i])
  for (let i = 0; i < t.ecPerBlok; i++) for (const b of blokEc) hasil.push(b[i])
  return hasil
}

/* ── Matriks ── */
type Matriks = { n: number; m: (boolean | null)[][]; fungsi: boolean[][] }

function matriksKosong(n: number): Matriks {
  return {
    n,
    m: Array.from({ length: n }, () => new Array<boolean | null>(n).fill(null)),
    fungsi: Array.from({ length: n }, () => new Array<boolean>(n).fill(false)),
  }
}

function setFungsi(mx: Matriks, r: number, c: number, gelap: boolean) {
  if (r < 0 || c < 0 || r >= mx.n || c >= mx.n) return
  mx.m[r][c] = gelap
  mx.fungsi[r][c] = true
}

function polaFinder(mx: Matriks, r0: number, c0: number) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = r0 + dr
      const c = c0 + dc
      const dalam = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
      const gelap =
        dalam && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
      setFungsi(mx, r, c, gelap)
    }
  }
}

function polaFungsi(mx: Matriks, versi: number) {
  const n = mx.n
  polaFinder(mx, 0, 0)
  polaFinder(mx, 0, n - 7)
  polaFinder(mx, n - 7, 0)
  // timing
  for (let i = 8; i < n - 8; i++) {
    setFungsi(mx, 6, i, i % 2 === 0)
    setFungsi(mx, i, 6, i % 2 === 0)
  }
  // alignment (versi 2–6: satu pola di (p,p))
  if (versi >= 2) {
    const p = BATAS_ALIGNMENT[versi - 1]
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const jarak = Math.max(Math.abs(dr), Math.abs(dc))
        setFungsi(mx, p + dr, p + dc, jarak !== 1)
      }
    }
  }
  // modul gelap tetap
  setFungsi(mx, 4 * versi + 9, 8, true)
  // cadangan area format (diisi nanti)
  for (let i = 0; i < 9; i++) {
    if (!mx.fungsi[8][i]) setFungsi(mx, 8, i, false)
    if (!mx.fungsi[i][8]) setFungsi(mx, i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    setFungsi(mx, 8, n - 1 - i, false)
    setFungsi(mx, n - 1 - i, 8, false)
  }
}

function tempatkanData(mx: Matriks, cw: number[]) {
  const bits: number[] = []
  for (const b of cw) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1)
  let idx = 0
  let naik = true
  for (let kanan = mx.n - 1; kanan >= 1; kanan -= 2) {
    if (kanan === 6) kanan = 5
    for (let k = 0; k < mx.n; k++) {
      const r = naik ? mx.n - 1 - k : k
      for (let dc = 0; dc < 2; dc++) {
        const c = kanan - dc
        if (mx.fungsi[r][c]) continue
        mx.m[r][c] = idx < bits.length ? bits[idx] === 1 : false
        idx++
      }
    }
    naik = !naik
  }
}

const MASK: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function terapkanMask(mx: Matriks, mask: number): boolean[][] {
  return mx.m.map((baris, r) =>
    baris.map((v, c) => (mx.fungsi[r][c] ? v === true : (v === true) !== MASK[mask](r, c))),
  )
}

function bitFormat(mask: number): number {
  const data = (0b00 << 3) | mask // level M = 00
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

function tulisFormat(m: boolean[][], mask: number) {
  const n = m.length
  const f = bitFormat(mask)
  const bit = (i: number) => ((f >> i) & 1) === 1
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i)
  m[7][8] = bit(6)
  m[8][8] = bit(7)
  m[8][7] = bit(8)
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i)
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i)
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i)
  m[n - 8][8] = true
}

function penalti(m: boolean[][]): number {
  const n = m.length
  let skor = 0
  // aturan 1: deretan ≥5 modul sama
  for (let a = 0; a < n; a++) {
    for (const arah of [0, 1]) {
      let sama = 1
      for (let b = 1; b < n; b++) {
        const cur = arah ? m[b][a] : m[a][b]
        const prev = arah ? m[b - 1][a] : m[a][b - 1]
        if (cur === prev) {
          sama++
          if (sama === 5) skor += 3
          else if (sama > 5) skor += 1
        } else sama = 1
      }
    }
  }
  // aturan 2: blok 2×2
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++)
      if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) skor += 3
  // aturan 3: pola mirip finder
  const pola = [true, false, true, true, true, false, true, false, false, false, false]
  const polaBalik = [...pola].reverse()
  for (let a = 0; a < n; a++)
    for (let b = 0; b <= n - 11; b++)
      for (const arah of [0, 1]) {
        const cocok = (p: boolean[]) => p.every((v, i) => (arah ? m[b + i][a] : m[a][b + i]) === v)
        if (cocok(pola)) skor += 40
        if (cocok(polaBalik)) skor += 40
      }
  // aturan 4: keseimbangan gelap/terang
  let gelap = 0
  for (const baris of m) for (const v of baris) if (v) gelap++
  const persen = (gelap * 100) / (n * n)
  skor += Math.floor(Math.abs(persen - 50) / 5) * 10
  return skor
}

export const BATAS_BYTE_QR = 106

/**
 * Matriks QR (true = modul gelap). Melempar Error bila teks > 106 byte UTF-8.
 * `maskPaksa` hanya untuk uji.
 */
export function buatMatriksQr(teks: string, maskPaksa?: number): boolean[][] {
  const bytes = utf8(teks)
  const idxVersi = VERSI_M.findIndex((t) => Math.floor((t.data * 8 - 12) / 8) >= bytes.length)
  if (idxVersi < 0) throw new Error(`Teks terlalu panjang untuk kode QR (maks ${BATAS_BYTE_QR} byte).`)
  const versi = idxVersi + 1
  const t = VERSI_M[idxVersi]
  const cw = susunCodeword(susunData(bytes, t.data), t)
  const mx = matriksKosong(17 + 4 * versi)
  polaFungsi(mx, versi)
  tempatkanData(mx, cw)
  let terbaik: boolean[][] | null = null
  let skorTerbaik = Infinity
  const daftarMask = maskPaksa !== undefined ? [maskPaksa] : [0, 1, 2, 3, 4, 5, 6, 7]
  for (const mask of daftarMask) {
    const kandidat = terapkanMask(mx, mask)
    tulisFormat(kandidat, mask)
    const skor = penalti(kandidat)
    if (skor < skorTerbaik) {
      skorTerbaik = skor
      terbaik = kandidat
    }
  }
  return terbaik as boolean[][]
}

/** SVG inline kode QR (zona tenang 4 modul), ukuran dalam `ukuran` (CSS, mis. «3cm»). */
export function svgQr(teks: string, ukuran = '3cm'): string {
  const mx = buatMatriksQr(teks)
  const n = mx.length
  const tenang = 4
  const total = n + tenang * 2
  let path = ''
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (!mx[r][c]) {
        c++
        continue
      }
      let akhir = c
      while (akhir < n && mx[r][akhir]) akhir++
      path += `M${c + tenang} ${r + tenang}h${akhir - c}v1h-${akhir - c}z`
      c = akhir
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${ukuran}" height="${ukuran}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="Kode QR"><rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  )
}

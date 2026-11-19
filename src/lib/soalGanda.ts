/**
 * Deteksi & pembersihan soal ganda — dipakai Gabungkan paket, editor paket (bank soal),
 * detail kuis, dan wizard susun kuis; berlaku untuk mapel reguler, TKA, dan Lomba.
 * Lihat ANTIREGRESI §Soal.Ganda.
 *
 * Dua tingkat:
 *  - «sama»  : isi sama setelah dinormalisasi (HTML, huruf besar/kecil, tanda baca, spasi, urutan
 *              pilihan diabaikan). Kunci jawaban TIDAK ikut dibandingkan (soal yang sama tetapi kuncinya
 *              berbeda tetap dilaporkan, dengan penanda `kunciBeda`).
 *  - «mirip» : (opsional) kemiripan ≥ ambang. Angka pada soal harus identik — «125 + 340» dan
 *              «125 + 350» adalah soal berbeda.
 *
 * ID soal TIDAK pernah dipakai sebagai dasar: soal hasil salin/gabung selalu berID baru.
 */
import type { Soal } from '../types/soal'
import { teksPolos } from './html'

export interface OpsiCariGanda {
  /** Sertakan soal «mirip» (bukan hanya yang sama persis). Bawaan: false. */
  mirip?: boolean
  /** Ambang kemiripan 0–1 untuk «mirip». Bawaan: 0.9. */
  ambang?: number
}

export interface KelompokGanda {
  /** Indeks soal (urut kemunculan) yang saling ganda; selalu ≥ 2 anggota. */
  indeks: number[]
  jenis: 'sama' | 'mirip'
  /** Skor kemiripan terendah dalam kelompok (1 = sama persis). */
  skor: number
  /** Kunci jawaban anggota kelompok tidak seragam — periksa sebelum menghapus. */
  kunciBeda: boolean
}

export const AMBANG_MIRIP_BAWAAN = 0.9

/* ------------------------------------------------------------------ */
/* Normalisasi                                                          */
/* ------------------------------------------------------------------ */

/** Teks → bentuk kanonik. Operator & simbol matematika dipertahankan; angka desimal utuh. */
export function normalisasiIsi(html: string | undefined): string {
  let t = teksPolos(html)
  if (!t) return ''
  t = t
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d)[.,](\d)/g, '$1\u0001$2')
  // Buang tanda baca teks; pertahankan + - * / = < > % ^ × ÷ $ \ ( ) agar rumus tidak runtuh.
  t = t.replace(/[.,;:!?"'`’‘“”«»–—…\[\]{}|_~#@&]/g, ' ')
  t = t.replace(/\u0001/g, ',').replace(/\s+/g, ' ').trim()
  return t
}

interface Ciri {
  tipe: string
  gambar: string
  stim: string
  /** Pertanyaan + pilihan (pilihan diurut agar urutan tidak berpengaruh). */
  isi: string
  angka: string
  kunci: string
}

function pilihanTeks(s: Soal): { opsi: string[]; kunci: string } {
  switch (s.tipe) {
    case 'pg': {
      const opsi = (s.opsi ?? []).map((o) => normalisasiIsi(o.teks) || (o.gambarId ?? ''))
      const benar = (s.opsi ?? []).filter((o) => o.id === s.kunci).map((o) => normalisasiIsi(o.teks) || (o.gambarId ?? ''))
      return { opsi, kunci: benar.join('|') }
    }
    case 'pgk': {
      const opsi = (s.opsi ?? []).map((o) => normalisasiIsi(o.teks) || (o.gambarId ?? ''))
      const benar = (s.opsi ?? [])
        .filter((o) => (s.kunci ?? []).includes(o.id))
        .map((o) => normalisasiIsi(o.teks) || (o.gambarId ?? ''))
        .sort()
      return { opsi, kunci: benar.join('|') }
    }
    case 'bs': {
      const p = (s.pernyataan ?? []).map((x) => ({ t: normalisasiIsi(x.teks), b: x.benar ? 1 : 0 }))
      return { opsi: p.map((x) => x.t), kunci: p.map((x) => `${x.t}:${x.b}`).sort().join('|') }
    }
    case 'jodoh': {
      const p = (s.pasangan ?? []).map((x) => `${normalisasiIsi(x.kiri) || (x.kiriGambarId ?? '')}>${normalisasiIsi(x.kanan)}`)
      return { opsi: p, kunci: [...p].sort().join('|') }
    }
    case 'isian': {
      const k = (s.kunci ?? []).map((x) => normalisasiIsi(x)).filter(Boolean).sort()
      return { opsi: [], kunci: k.join('|') }
    }
    case 'uraian':
      return { opsi: [], kunci: '' }
  }
}

function hitungCiri(s: Soal): Ciri {
  const stim = normalisasiIsi(s.stimulus)
  const badan = normalisasiIsi(s.teks)
  const { opsi, kunci } = pilihanTeks(s)
  const isi = `${badan}\u241E${[...opsi].sort().join('\u241F')}`
  const angka = ((stim + ' ' + isi).match(/\d+(?:,\d+)?/g) ?? []).sort().join(' ')
  return { tipe: s.tipe, gambar: s.gambarId ?? '', stim, isi, angka, kunci }
}

/** Kunci kesamaan persis (tanpa kunci jawaban). Dipakai juga untuk lewati duplikat saat menambah soal. */
export function sidikJariSoal(s: Soal): string {
  const c = hitungCiri(s)
  return [c.tipe, c.gambar, c.stim, c.isi].join('\u241D')
}

/* ------------------------------------------------------------------ */
/* Kemiripan (Dice pada bigram karakter)                                */
/* ------------------------------------------------------------------ */

function bigram(t: string): Map<string, number> {
  const m = new Map<string, number>()
  const s = t.replace(/\s+/g, ' ')
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

function dice(a: Map<string, number>, b: Map<string, number>): number {
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v
  for (const v of b.values()) nb += v
  if (na === 0 && nb === 0) return 1
  if (na === 0 || nb === 0) return 0
  let irisan = 0
  for (const [g, v] of a) irisan += Math.min(v, b.get(g) ?? 0)
  return (2 * irisan) / (na + nb)
}

/* ------------------------------------------------------------------ */
/* Pencarian kelompok                                                   */
/* ------------------------------------------------------------------ */

export function cariSoalGanda(soal: Soal[], opsi: OpsiCariGanda = {}): KelompokGanda[] {
  const n = soal.length
  if (n < 2) return []
  const ambang = Math.min(1, Math.max(0.5, opsi.ambang ?? AMBANG_MIRIP_BAWAAN))
  const ciri = soal.map(hitungCiri)

  const induk = Array.from({ length: n }, (_, i) => i)
  const cari = (x: number): number => {
    while (induk[x] !== x) {
      induk[x] = induk[induk[x]]
      x = induk[x]
    }
    return x
  }
  const satukan = (a: number, b: number) => {
    const ra = cari(a)
    const rb = cari(b)
    if (ra !== rb) induk[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  // Kesamaan persis: kelompokkan lewat kunci.
  const peta = new Map<string, number[]>()
  soal.forEach((_, i) => {
    const k = [ciri[i].tipe, ciri[i].gambar, ciri[i].stim, ciri[i].isi].join('\u241D')
    // Soal yang seluruh isinya kosong tidak dianggap ganda satu sama lain.
    if (!ciri[i].stim && !ciri[i].isi.replace(/\u241E/g, '') && !ciri[i].gambar) return
    const arr = peta.get(k)
    if (arr) arr.push(i)
    else peta.set(k, [i])
  })
  const pasanganSama = new Set<string>()
  for (const arr of peta.values()) {
    for (let j = 1; j < arr.length; j++) {
      satukan(arr[0], arr[j])
      pasanganSama.add(`${arr[0]}:${arr[j]}`)
    }
  }

  // Kemiripan (opsional).
  const sisiMirip: { i: number; skor: number }[] = []
  const dipakaiMirip = new Set<number>()
  if (opsi.mirip) {
    const bgIsi = ciri.map((c) => bigram(c.isi))
    const bgStim = ciri.map((c) => bigram(c.stim))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ciri[i]
        const b = ciri[j]
        if (cari(i) === cari(j)) continue
        if (a.tipe !== b.tipe || a.gambar !== b.gambar) continue
        if (a.angka !== b.angka) continue
        if (!a.isi.replace(/\u241E/g, '') && !b.isi.replace(/\u241E/g, '')) continue
        const sStim = dice(bgStim[i], bgStim[j])
        if (sStim < ambang) continue
        const sIsi = dice(bgIsi[i], bgIsi[j])
        if (sIsi < ambang) continue
        const skor = Math.min(sStim, sIsi)
        satukan(i, j)
        dipakaiMirip.add(i)
        dipakaiMirip.add(j)
        sisiMirip.push({ i, skor })
      }
    }
  }

  const kel = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = cari(i)
    const arr = kel.get(r)
    if (arr) arr.push(i)
    else kel.set(r, [i])
  }
  const hasil: KelompokGanda[] = []
  for (const [akar, idx] of kel) {
    if (idx.length < 2) continue
    const adaMirip = idx.some((i) => dipakaiMirip.has(i))
    // Skor tampil = kemiripan terendah di antara pasangan «mirip» dalam kelompok.
    let skor = 1
    if (adaMirip) {
      for (const e of sisiMirip) if (cari(e.i) === akar) skor = Math.min(skor, e.skor)
    }
    hasil.push({
      indeks: idx,
      jenis: adaMirip ? 'mirip' : 'sama',
      skor,
      kunciBeda: new Set(idx.map((i) => ciri[i].kunci)).size > 1,
    })
  }
  hasil.sort((a, b) => a.indeks[0] - b.indeks[0])
  return hasil
}

/* ------------------------------------------------------------------ */
/* Penerapan                                                            */
/* ------------------------------------------------------------------ */

export type KebijakanGanda = 'pertama' | 'terakhir'

/**
 * Hapus soal ganda: satu soal dipertahankan per kelompok.
 *  - `pilihan[nomorKelompok]` = indeks soal yang dipertahankan (bawaan menurut `kebijakan`).
 *  - `posisi: 'pertama'` menaruh soal yang dipertahankan di posisi anggota pertama kelompok
 *    (dipakai «timpa»: versi terbaru menggantikan versi lama di tempat yang sama).
 */
export function hapusSoalGanda<T>(
  soal: T[],
  kelompok: KelompokGanda[],
  opsi: { kebijakan?: KebijakanGanda; pilihan?: Record<number, number>; posisi?: 'asli' | 'pertama' } = {},
): { hasil: T[]; dihapus: number } {
  const kebijakan = opsi.kebijakan ?? 'pertama'
  const buang = new Set<number>()
  const ganti = new Map<number, T>()
  kelompok.forEach((g, nomor) => {
    const dipilih = opsi.pilihan?.[nomor]
    const jaga =
      dipilih !== undefined && g.indeks.includes(dipilih)
        ? dipilih
        : kebijakan === 'terakhir'
          ? g.indeks[g.indeks.length - 1]
          : g.indeks[0]
    const pertama = g.indeks[0]
    for (const i of g.indeks) if (i !== jaga) buang.add(i)
    if (opsi.posisi === 'pertama' && jaga !== pertama) {
      buang.delete(pertama)
      buang.add(jaga)
      ganti.set(pertama, soal[jaga])
    }
  })
  const hasil: T[] = []
  soal.forEach((s, i) => {
    if (ganti.has(i)) hasil.push(ganti.get(i) as T)
    else if (!buang.has(i)) hasil.push(s)
  })
  return { hasil, dihapus: soal.length - hasil.length }
}

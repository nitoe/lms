import type { JawabanSoal, Soal } from '../types/soal'

export type StatusJawaban = 'benar' | 'sebagian' | 'salah' | 'kosong' | 'manual'

export interface HasilNilai {
  skor: number
  maks: number
  status: StatusJawaban
}

function bulat(n: number): number {
  return Math.round(n * 100) / 100
}

function rapikan(s: string, abaikanKapital: boolean): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return abaikanKapital ? t.toLocaleLowerCase('id') : t
}

function sebagaiAngka(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

function dariPecahan(frac: number, maks: number): HasilNilai {
  const skor = bulat(maks * Math.max(0, Math.min(1, frac)))
  const status: StatusJawaban = skor >= maks ? 'benar' : skor > 0 ? 'sebagian' : 'salah'
  return { skor, maks, status }
}

/**
 * Menilai satu jawaban. Fungsi murni — dipakai pratinjau guru (Fase 2a)
 * dan penilaian kuis siswa (Fase 2b). Uraian selalu 'manual' (skor 0 sampai guru menilai).
 */
export function nilaiJawaban(soal: Soal, jawaban: JawabanSoal | undefined): HasilNilai {
  const maks = soal.poin
  const kosong: HasilNilai = { skor: 0, maks, status: 'kosong' }

  switch (soal.tipe) {
    case 'pg': {
      if (typeof jawaban !== 'string' || !jawaban) return kosong
      return jawaban === soal.kunci ? { skor: maks, maks, status: 'benar' } : { skor: 0, maks, status: 'salah' }
    }
    case 'pgk': {
      if (!Array.isArray(jawaban) || jawaban.length === 0) return kosong
      const pilih = new Set(jawaban)
      const kunci = new Set(soal.kunci)
      let benar = 0
      let salah = 0
      for (const p of pilih) (kunci.has(p) ? benar++ : salah++)
      if (!soal.nilaiParsial) {
        return benar === kunci.size && salah === 0
          ? { skor: maks, maks, status: 'benar' }
          : { skor: 0, maks, status: 'salah' }
      }
      return dariPecahan((benar - salah) / Math.max(1, kunci.size), maks)
    }
    case 'jodoh': {
      if (!jawaban || typeof jawaban !== 'object' || Array.isArray(jawaban)) return kosong
      const j = jawaban as Record<string, string>
      if (Object.keys(j).length === 0) return kosong
      const benar = soal.pasangan.filter((p) => j[p.id] === p.id).length
      if (!soal.nilaiParsial) {
        return benar === soal.pasangan.length ? { skor: maks, maks, status: 'benar' } : { skor: 0, maks, status: 'salah' }
      }
      return dariPecahan(benar / Math.max(1, soal.pasangan.length), maks)
    }
    case 'bs': {
      if (!jawaban || typeof jawaban !== 'object' || Array.isArray(jawaban)) return kosong
      const j = jawaban as Record<string, boolean>
      if (Object.keys(j).length === 0) return kosong
      const benar = soal.pernyataan.filter((p) => j[p.id] === p.benar).length
      if (!soal.nilaiParsial) {
        return benar === soal.pernyataan.length ? { skor: maks, maks, status: 'benar' } : { skor: 0, maks, status: 'salah' }
      }
      return dariPecahan(benar / Math.max(1, soal.pernyataan.length), maks)
    }
    case 'isian': {
      if (typeof jawaban !== 'string' || !jawaban.trim()) return kosong
      const a = rapikan(jawaban, soal.abaikanKapital)
      const angkaA = sebagaiAngka(jawaban)
      const cocok = soal.kunci.some((k) => {
        if (!k.trim()) return false
        if (rapikan(k, soal.abaikanKapital) === a) return true
        const angkaK = sebagaiAngka(k)
        return angkaA !== null && angkaK !== null && angkaA === angkaK
      })
      return cocok ? { skor: maks, maks, status: 'benar' } : { skor: 0, maks, status: 'salah' }
    }
    case 'uraian': {
      if (typeof jawaban !== 'string' || !jawaban.trim()) return kosong
      return { skor: 0, maks, status: 'manual' }
    }
  }
}

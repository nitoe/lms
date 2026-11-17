import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { SiswaIconName } from '../pages/siswa/SiswaIcon'

/**
 * Pencapaian siswa — DIHITUNG di klien dari data yang sudah ada (baca saja):
 * - lms_jawaban  (query `siswaId ==` sendiri; rules: siswa membaca miliknya, ANTIREGRESI §131.15)
 * - lms_nilai_tugas (query siswaId + kelas, sama dengan halaman Tugas)
 * Tidak ada koleksi, field, atau rules baru. Jangan menulis apa pun dari halaman Pencapaian.
 */

export const AMBANG_NILAI_BAGUS = 80

export type DataPencapaian = {
  /** Jumlah kuis berbeda yang sudah dikerjakan. */
  kuisSelesai: number
  /** Rata-rata skor tertinggi per kuis (skala 100); null bila belum ada. */
  rataKuis: number | null
  skorKuisTertinggi: number
  tugasDinilai: number
  rataTugas: number | null
  tugasNilaiBagus: number
}

export type Lencana = {
  id: string
  judul: string
  syarat: string
  ikon: SiswaIconName
  tone: 'violet' | 'amber' | 'emerald' | 'sky' | 'rose'
  nilai: number
  target: number
  terbuka: boolean
}

type JawabanMini = { kuisId: string; skor100: number }
type NilaiMini = { nilai: number }

export async function muatDataPencapaian(
  siswaId: string,
  kelas: string,
): Promise<{ jawaban: JawabanMini[]; nilai: NilaiMini[] }> {
  const [snapJ, snapN] = await Promise.all([
    getDocs(query(collection(db, 'lms_jawaban'), where('siswaId', '==', siswaId))),
    getDocs(
      query(
        collection(db, 'lms_nilai_tugas'),
        where('siswaId', '==', siswaId),
        where('kelas', '==', String(kelas).toUpperCase()),
      ),
    ),
  ])

  const jawaban: JawabanMini[] = []
  for (const d of snapJ.docs) {
    const x = d.data()
    const total = Number(x.totalPoin) || 0
    const kuisId = typeof x.kuisId === 'string' ? x.kuisId : ''
    if (!kuisId || total <= 0) continue
    jawaban.push({ kuisId, skor100: Math.min(100, ((Number(x.skorOtomatis) || 0) / total) * 100) })
  }

  const nilai: NilaiMini[] = []
  for (const d of snapN.docs) {
    const n = d.data().nilai
    if (typeof n === 'number' && Number.isFinite(n)) nilai.push({ nilai: n })
  }
  return { jawaban, nilai }
}

export function hitungPencapaian(jawaban: JawabanMini[], nilai: NilaiMini[]): DataPencapaian {
  const terbaik = new Map<string, number>()
  for (const j of jawaban) {
    terbaik.set(j.kuisId, Math.max(terbaik.get(j.kuisId) ?? 0, j.skor100))
  }
  const skor = [...terbaik.values()]
  const rata = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : null)
  return {
    kuisSelesai: skor.length,
    rataKuis: rata(skor),
    skorKuisTertinggi: skor.length ? Math.max(...skor) : 0,
    tugasDinilai: nilai.length,
    rataTugas: rata(nilai.map((n) => n.nilai)),
    tugasNilaiBagus: nilai.filter((n) => n.nilai >= AMBANG_NILAI_BAGUS).length,
  }
}

/** Bintang = satu per kuis yang selesai + satu per tugas yang sudah dinilai. */
export function hitungBintang(d: DataPencapaian): number {
  return d.kuisSelesai + d.tugasDinilai
}

function buat(
  l: Omit<Lencana, 'terbuka' | 'nilai'> & { nilai: number },
): Lencana {
  return { ...l, nilai: Math.min(l.nilai, l.target), terbuka: l.nilai >= l.target }
}

/** Daftar lencana + syaratnya. Satu-satunya sumber kriteria (tampil juga di UI). */
export function susunLencana(d: DataPencapaian): Lencana[] {
  return [
    buat({ id: 'langkah-pertama', judul: 'Langkah Pertama', syarat: 'Selesaikan 1 kuis', ikon: 'target', tone: 'violet', nilai: d.kuisSelesai, target: 1 }),
    buat({ id: 'rajin-berlatih', judul: 'Rajin Berlatih', syarat: 'Selesaikan 5 kuis', ikon: 'target', tone: 'violet', nilai: d.kuisSelesai, target: 5 }),
    buat({ id: 'pelajar-tekun', judul: 'Pelajar Tekun', syarat: 'Selesaikan 10 kuis', ikon: 'book', tone: 'sky', nilai: d.kuisSelesai, target: 10 }),
    buat({ id: 'nilai-bagus', judul: 'Nilai Bagus', syarat: `Skor ${AMBANG_NILAI_BAGUS} atau lebih di satu kuis`, ikon: 'star', tone: 'amber', nilai: d.skorKuisTertinggi >= AMBANG_NILAI_BAGUS ? 1 : 0, target: 1 }),
    buat({ id: 'nilai-sempurna', judul: 'Nilai Sempurna', syarat: 'Skor 100 di satu kuis', ikon: 'sparkles', tone: 'rose', nilai: d.skorKuisTertinggi >= 100 ? 1 : 0, target: 1 }),
    buat({ id: 'tugas-pertama', judul: 'Tugas Pertama', syarat: '1 tugas sudah dinilai', ikon: 'pencil', tone: 'amber', nilai: d.tugasDinilai, target: 1 }),
    buat({ id: 'tugas-tuntas', judul: 'Tugas Tuntas', syarat: '5 tugas sudah dinilai', ikon: 'check', tone: 'emerald', nilai: d.tugasDinilai, target: 5 }),
    buat({ id: 'tugas-cemerlang', judul: 'Tugas Cemerlang', syarat: `3 tugas bernilai ${AMBANG_NILAI_BAGUS} atau lebih`, ikon: 'star', tone: 'emerald', nilai: d.tugasNilaiBagus, target: 3 }),
  ]
}

export function pesanGagalPencapaian(e: unknown): string {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Pencapaian belum bisa dibuka. Beri tahu gurumu ya.'
  }
  return 'Pencapaian gagal dimuat. Periksa internet lalu coba lagi.'
}

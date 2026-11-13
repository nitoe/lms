import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { TugasLms } from '../types/tugas'
import type { NilaiTugasDok } from './nilaiTugas'

/** Status tugas dari sudut pandang siswa (tanpa pengumpulan file dulu). */
export type StatusTugasSiswa = 'belum' | 'dinilai' | 'lewat'

export type TugasSiswaRingkas = {
  tugas: TugasLms
  status: StatusTugasSiswa
  nilai?: NilaiTugasDok
}

function docKeTugas(id: string, data: Record<string, unknown>): TugasLms {
  const jenis = data.jenis === 'proyek' ? 'proyek' : 'mapel'
  const jenisPenilaian =
    data.jenisPenilaian === 'latihan' ||
    data.jenisPenilaian === 'slm' ||
    data.jenisPenilaian === 'sts' ||
    data.jenisPenilaian === 'sas'
      ? data.jenisPenilaian
      : 'slm'

  return {
    id,
    kelas: String(data.kelas || '').toUpperCase(),
    mapel: String(data.mapel || ''),
    mapelLain: Array.isArray(data.mapelLain)
      ? (data.mapelLain as string[]).filter(Boolean)
      : undefined,
    judul: String(data.judul || ''),
    deskripsi: typeof data.deskripsi === 'string' ? data.deskripsi : undefined,
    instruksi: typeof data.instruksi === 'string' ? data.instruksi : undefined,
    jenis,
    jenisPenilaian,
    tpList: Array.isArray(data.tpList) ? (data.tpList as TugasLms['tpList']) : undefined,
    tenggat: data.tenggat,
    aktif: data.aktif === true,
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatOlehNama: typeof data.dibuatOlehNama === 'string' ? data.dibuatOlehNama : undefined,
    jumlahPengumpulan:
      typeof data.jumlahPengumpulan === 'number' ? data.jumlahPengumpulan : undefined,
    pengaturanPenilaian:
      data.pengaturanPenilaian && typeof data.pengaturanPenilaian === 'object'
        ? (data.pengaturanPenilaian as TugasLms['pengaturanPenilaian'])
        : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/**
 * Tugas aktif untuk satu rombel (query selaras rules siswa:
 * aktif == true && kelas == claim kelas).
 */
export async function daftarTugasAktifKelas(kelas: string): Promise<TugasLms[]> {
  const q = query(
    collection(db, 'lms_tugas'),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('aktif', '==', true),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => docKeTugas(d.id, d.data() as Record<string, unknown>))
  list.sort((a, b) => {
    const ta = tenggatMs(a.tenggat)
    const tb = tenggatMs(b.tenggat)
    if (ta && tb) return ta - tb
    if (ta) return -1
    if (tb) return 1
    return (a.judul || '').localeCompare(b.judul || '', 'id')
  })
  return list
}

export function tenggatMs(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return Number((v as { seconds: number }).seconds) * 1000
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  return 0
}

/** Apakah tenggat sudah lewat (hari ini melewati akhir hari tenggat). */
export function tenggatLewat(tenggat: unknown, sekarang = Date.now()): boolean {
  const ms = tenggatMs(tenggat)
  if (!ms) return false
  return ms < sekarang
}

/**
 * Status tampilan siswa:
 * - dinilai: ada dokumen nilai
 * - lewat: belum dinilai dan tenggat sudah lewat
 * - belum: selain itu
 */
export function statusTugasSiswa(
  tugas: Pick<TugasLms, 'tenggat'>,
  nilai?: Pick<NilaiTugasDok, 'nilai'> | null,
): StatusTugasSiswa {
  if (nilai && typeof nilai.nilai === 'number') return 'dinilai'
  if (tenggatLewat(tugas.tenggat)) return 'lewat'
  return 'belum'
}

/** Teks tenggat relatif untuk chip siswa. */
export function formatTenggatRelatif(tenggat: unknown, sekarang = Date.now()): string {
  const ms = tenggatMs(tenggat)
  if (!ms) return ''
  try {
    const tgl = new Date(ms)
    const absolut = tgl.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: tgl.getFullYear() !== new Date(sekarang).getFullYear() ? 'numeric' : undefined,
    })
    const selisihHari = Math.ceil((ms - sekarang) / (24 * 60 * 60 * 1000))
    if (selisihHari < 0) {
      const lewat = Math.abs(selisihHari)
      return lewat === 0 ? `Hari ini (${absolut})` : `Lewat ${lewat} hari (${absolut})`
    }
    if (selisihHari === 0) return `Hari ini (${absolut})`
    if (selisihHari === 1) return `Besok (${absolut})`
    if (selisihHari <= 7) return `${selisihHari} hari lagi (${absolut})`
    return absolut
  } catch {
    return ''
  }
}

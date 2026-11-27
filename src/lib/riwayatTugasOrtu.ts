/**
 * Publikasi NILAI + STATUS + TENGGAT tugas ke portal orang tua (ANTIREGRESI §Tugas.Ortu).
 *
 * Pola sama dengan rapor_sts_ortu / lms_tka_hasil_ortu: guru menekan tombol → LMS menulis salinan
 * ke `lms_tugas_hasil_ortu/{tugasId_siswaId}`; portal hanya membaca salinan itu.
 *
 * Isi dokumen SENGAJA terbatas. Catatan guru, poin perbaikan, riwayat percobaan,
 * nilai per rubrik, dan bukti siswa TIDAK pernah ditulis ke sini (rules juga membatasi lewat hasOnly).
 *
 * Status nilai:
 *  - dinilai   : nilai yang dipakai ada
 *  - perbaikan : nilai ada, dan guru sedang membuka percobaan berikutnya (`bukaPerbaikan`)
 *  - belum     : belum ada nilai tersimpan
 *
 * Status pengumpulan (`statusKumpul`) — opsional, diisi saat bagikan bila data tersedia:
 *  - belum_kumpul : belum ada dokumen pengumpulan
 *  - sudah_kumpul : sudah ada pengumpulan
 * Field `tenggat` (Timestamp | null) ikut disalin dari dokumen tugas agar portal bisa menampilkan
 * tenggat waktu tanpa membaca `lms_tugas` mentah.
 */
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { BarisNilaiTugas } from './nilaiTugas'
import { predikatDariNilai, RENTANG_PREDIKAT_DEFAULT } from './penilaianTugas'
import type { RentangPredikat, TugasLms } from '../types/tugas'

export type StatusTugasOrtu = 'dinilai' | 'perbaikan' | 'belum'
export type StatusKumpulOrtu = 'belum_kumpul' | 'sudah_kumpul'

/** ID sama dengan dokumen `lms_nilai_tugas` agar mudah ditelusuri. */
export function idTugasHasilOrtu(tugasId: string, siswaId: string): string {
  return `${tugasId}_${siswaId}`
}

/** Nilai yang dilihat orang tua = nilai yang DIPAKAI (rapor), bukan percobaan terakhir. */
export function nilaiUntukOrtu(r: BarisNilaiTugas): number | null {
  if (!r.sudahAda) return null
  const n = r.nilaiDipakai
  return typeof n === 'number' && !Number.isNaN(n) && n >= 0 && n <= 100 ? n : null
}

export function statusUntukOrtu(r: BarisNilaiTugas): StatusTugasOrtu {
  if (nilaiUntukOrtu(r) === null) return 'belum'
  return r.bukaPerbaikan ? 'perbaikan' : 'dinilai'
}

export type RingkasanBagikanOrtu = {
  total: number
  dinilai: number
  perbaikan: number
  belum: number
}

export function hitungRingkasanBagikan(baris: BarisNilaiTugas[]): RingkasanBagikanOrtu {
  const out: RingkasanBagikanOrtu = { total: baris.length, dinilai: 0, perbaikan: 0, belum: 0 }
  for (const r of baris) out[statusUntukOrtu(r)] += 1
  return out
}

/** Normalisasi tenggat tugas → Timestamp | null untuk disimpan di snapshot ortu. */
export function tenggatUntukOrtu(tenggat: unknown): Timestamp | null {
  if (tenggat == null) return null
  if (tenggat instanceof Timestamp) return tenggat
  if (tenggat instanceof Date && !Number.isNaN(tenggat.getTime())) {
    return Timestamp.fromDate(tenggat)
  }
  if (typeof tenggat === 'object' && tenggat !== null && 'seconds' in tenggat) {
    const s = Number((tenggat as { seconds: unknown }).seconds)
    if (Number.isFinite(s)) return new Timestamp(s, 0)
  }
  if (typeof tenggat === 'string' || typeof tenggat === 'number') {
    const d = new Date(tenggat)
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d)
  }
  return null
}

const CHUNK = 400

/**
 * Bagikan (publikasi ulang) nilai + status + tenggat seluruh siswa roster tugas ini.
 * Memakai baris yang SUDAH TERSIMPAN di server (`barisNilai`), bukan draf yang belum disimpan.
 * Publikasi ulang menimpa dokumen lama (nilai terbaru); tidak ada dokumen baru selain per siswa.
 *
 * `sudahKumpulBySiswa` opsional: map siswaId → true bila sudah ada pengumpulan.
 * Bila tidak diberi, field `statusKumpul` tidak ditulis (dokumen lama tetap valid).
 */
export async function bagikanTugasKeOrtu(input: {
  tugas: Pick<TugasLms, 'id' | 'judul' | 'kelas' | 'mapel' | 'tenggat'>
  baris: BarisNilaiTugas[]
  rentang?: RentangPredikat[]
  namaGuru?: string
  /** Map siswaId → sudah mengumpulkan (dari `pengumpulanMap` di halaman detail). */
  sudahKumpulBySiswa?: Record<string, boolean>
}): Promise<RingkasanBagikanOrtu> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const { tugas } = input
  if (!tugas.id) throw new Error('Simpan tugas dulu sebelum dibagikan ke orang tua.')
  if (!input.baris.length) throw new Error('Roster kelas kosong, tidak ada yang dibagikan.')

  const kelas = String(tugas.kelas).toUpperCase()
  const rentang = input.rentang?.length ? input.rentang : RENTANG_PREDIKAT_DEFAULT
  const judul = String(tugas.judul || 'Tugas').trim().slice(0, 200) || 'Tugas'
  const tenggat = tenggatUntukOrtu(tugas.tenggat)
  const punyaMapKumpul = input.sudahKumpulBySiswa != null

  const ops = input.baris.map((r) => {
    const nilai = nilaiUntukOrtu(r)
    const predikat = nilai === null ? '' : (predikatDariNilai(nilai, rentang)?.predikat ?? '')
    const data: Record<string, unknown> = {
      tugasId: tugas.id,
      siswaId: r.siswaId,
      kelas,
      mapel: String(tugas.mapel).trim(),
      judul,
      nilai,
      predikat,
      status: statusUntukOrtu(r),
      tenggat,
      published: true,
      publishedAt: serverTimestamp(),
      publishedBy: uid,
      publishedByNama: input.namaGuru || '',
      updatedAt: serverTimestamp(),
    }
    if (punyaMapKumpul) {
      data.statusKumpul = input.sudahKumpulBySiswa![r.siswaId]
        ? ('sudah_kumpul' as StatusKumpulOrtu)
        : ('belum_kumpul' as StatusKumpulOrtu)
    }
    return {
      ref: doc(db, 'lms_tugas_hasil_ortu', idTugasHasilOrtu(tugas.id, r.siswaId)),
      data,
    }
  })

  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const o of ops.slice(i, i + CHUNK)) batch.set(o.ref, o.data, { merge: true })
    await batch.commit()
  }
  return hitungRingkasanBagikan(input.baris)
}

/**
 * Tarik dari portal: dokumen tetap ada tetapi `published=false` (portal memfilter published == true).
 * Mengembalikan jumlah dokumen yang ditarik.
 */
export async function tarikTugasDariOrtu(input: {
  tugas: Pick<TugasLms, 'id' | 'kelas' | 'mapel'>
}): Promise<number> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const { tugas } = input
  if (!tugas.id) throw new Error('Tugas belum tersimpan.')

  const snap = await getDocs(
    query(
      collection(db, 'lms_tugas_hasil_ortu'),
      where('tugasId', '==', tugas.id),
      where('kelas', '==', String(tugas.kelas).toUpperCase()),
    ),
  )
  const docs = snap.docs.filter((d) => d.data().published === true)
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.set(d.ref, { published: false, updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
  return docs.length
}

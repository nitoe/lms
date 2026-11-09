import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { muatSiswaKelas, type SiswaDasar } from './siswaAuth'

/** Dokumen `lms_nilai_tugas/{tugasId_siswaId}`. */
export type NilaiTugasDok = {
  id: string
  tugasId: string
  siswaId: string
  siswaNama: string
  kelas: string
  mapel: string
  nilai: number
  komentar?: string
  dinilaiOleh: string
  dinilaiOlehNama?: string
  updatedAt?: unknown
  createdAt?: unknown
}

export type BarisNilaiTugas = {
  siswaId: string
  siswaNama: string
  nilai: number | null
  komentar: string
  sudahAda: boolean
}

function idNilai(tugasId: string, siswaId: string): string {
  return `${tugasId}_${siswaId}`
}

function koleksi() {
  return collection(db, 'lms_nilai_tugas')
}

/** Ambil semua nilai untuk satu tugas (query by tugasId + kelas + mapel agar selaras rules). */
export async function daftarNilaiTugas(
  tugasId: string,
  kelas: string,
  mapel: string,
): Promise<NilaiTugasDok[]> {
  const q = query(
    koleksi(),
    where('tugasId', '==', tugasId),
    where('kelas', '==', String(kelas).toUpperCase()),
    where('mapel', '==', mapel),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      tugasId: String(data.tugasId || ''),
      siswaId: String(data.siswaId || ''),
      siswaNama: String(data.siswaNama || ''),
      kelas: String(data.kelas || ''),
      mapel: String(data.mapel || ''),
      nilai: typeof data.nilai === 'number' ? data.nilai : 0,
      komentar: typeof data.komentar === 'string' ? data.komentar : undefined,
      dinilaiOleh: String(data.dinilaiOleh || ''),
      dinilaiOlehNama:
        typeof data.dinilaiOlehNama === 'string' ? data.dinilaiOlehNama : undefined,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
    }
  })
}

/**
 * Gabungkan roster siswa kelas + nilai yang sudah ada.
 * Baris tanpa nilai: nilai = null.
 */
export async function muatBarisNilaiTugas(
  tugasId: string,
  kelas: string,
  mapel: string,
): Promise<BarisNilaiTugas[]> {
  const kelasU = String(kelas).toUpperCase()
  const [siswa, nilaiList] = await Promise.all([
    muatSiswaKelas(kelasU),
    daftarNilaiTugas(tugasId, kelasU, mapel),
  ])
  const mapNilai = new Map(nilaiList.map((n) => [n.siswaId, n]))
  const rows: BarisNilaiTugas[] = siswa.map((s: SiswaDasar) => {
    const n = mapNilai.get(s.id)
    return {
      siswaId: s.id,
      siswaNama: s.nama,
      nilai: n ? n.nilai : null,
      komentar: n?.komentar || '',
      sudahAda: !!n,
    }
  })
  // Nilai untuk siswa yang sudah tidak di roster (pindah kelas) tetap tampil di bawah
  for (const n of nilaiList) {
    if (rows.some((r) => r.siswaId === n.siswaId)) continue
    rows.push({
      siswaId: n.siswaId,
      siswaNama: n.siswaNama + ' (tidak di roster)',
      nilai: n.nilai,
      komentar: n.komentar || '',
      sudahAda: true,
    })
  }
  rows.sort((a, b) => a.siswaNama.localeCompare(b.siswaNama, 'id'))
  return rows
}

/** Simpan / perbarui satu nilai (setDoc merge, id stabil). */
export async function simpanNilaiTugas(input: {
  tugasId: string
  siswaId: string
  siswaNama: string
  kelas: string
  mapel: string
  nilai: number
  komentar?: string
  namaGuru?: string
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  if (!input.tugasId || !input.siswaId) throw new Error('Data tugas/siswa tidak lengkap.')
  if (typeof input.nilai !== 'number' || Number.isNaN(input.nilai)) {
    throw new Error('Nilai harus berupa angka.')
  }
  if (input.nilai < 0 || input.nilai > 1000) {
    throw new Error('Nilai di luar rentang yang diizinkan (0–1000).')
  }

  const id = idNilai(input.tugasId, input.siswaId)
  const ref = doc(db, 'lms_nilai_tugas', id)
  const payload: Record<string, unknown> = {
    tugasId: input.tugasId,
    siswaId: input.siswaId,
    siswaNama: input.siswaNama.trim() || '—',
    kelas: String(input.kelas).toUpperCase(),
    mapel: input.mapel.trim(),
    nilai: input.nilai,
    dinilaiOleh: uid,
    dinilaiOlehNama: input.namaGuru || '',
    updatedAt: serverTimestamp(),
  }
  if (input.komentar?.trim()) payload.komentar = input.komentar.trim()
  else payload.komentar = null

  // setDoc tanpa merge agar create rules terpenuhi saat dokumen baru;
  // untuk update, field kunci (tugasId, siswaId, kelas, mapel) tetap sama.
  await setDoc(ref, { ...payload, createdAt: serverTimestamp() }, { merge: true })
}

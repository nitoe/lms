import { alasanTugasDitutup } from './tugasTutup'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { TugasLms } from '../types/tugas'
import type { NilaiTugasDok } from './nilaiTugas'
import { rapikanBuktiList } from './buktiTugas'
import { normKesempatanMaks, normNilaiDipakai } from './kesempatanTugas'

/** Status tugas dari sudut pandang siswa (tanpa pengumpulan file dulu). */
export type StatusTugasSiswa = 'belum' | 'dinilai' | 'lewat' | 'ditutup'

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
    kelasList: Array.isArray(data.kelasList)
      ? (data.kelasList as string[]).map((x) => String(x).toUpperCase()).filter(Boolean)
      : undefined,
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
    statusTugas:
      data.statusTugas === 'draf' ||
      data.statusTugas === 'aktif_guru' ||
      data.statusTugas === 'aktif_siswa'
        ? data.statusTugas
        : data.aktif === true
          ? 'aktif_siswa'
          : 'draf',
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatOlehNama: typeof data.dibuatOlehNama === 'string' ? data.dibuatOlehNama : undefined,
    jumlahPengumpulan:
      typeof data.jumlahPengumpulan === 'number' ? data.jumlahPengumpulan : undefined,
    pengaturanPenilaian:
      data.pengaturanPenilaian && typeof data.pengaturanPenilaian === 'object'
        ? (data.pengaturanPenilaian as TugasLms['pengaturanPenilaian'])
        : undefined,
    buktiList: (() => {
      const b = rapikanBuktiList(data.buktiList)
      return b.length ? b : undefined
    })(),
    lampiranList: Array.isArray(data.lampiranList)
      ? (data.lampiranList as TugasLms['lampiranList'])
      : undefined,
    modeKelompok: data.modeKelompok === true,
    // Salinan mapping siswa HARUS ikut (ANTIREGRESI §Tugas.Kesempatan): tanpa ini siswa tak melihat aturan.
    kesempatanMaks: normKesempatanMaks(data.kesempatanMaks),
    nilaiDipakai: normNilaiDipakai(data.nilaiDipakai),
    kelompokMaxAnggota:
      typeof data.kelompokMaxAnggota === 'number' && data.kelompokMaxAnggota >= 2
        ? Math.min(12, Math.floor(data.kelompokMaxAnggota))
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
  const k = String(kelas).toUpperCase()
  const map = new Map<string, TugasLms>()

  const q1 = query(
    collection(db, 'lms_tugas'),
    where('kelas', '==', k),
    where('aktif', '==', true),
  )
  const snap1 = await getDocs(q1)
  for (const d of snap1.docs) {
    map.set(d.id, docKeTugas(d.id, d.data() as Record<string, unknown>))
  }

  // Share ke rombel paralel. Rules siswa untuk cabang kelasList mensyaratkan aktif == true, dan rules
  // BUKAN filter: kueri wajib memuat predikat yang sama (kelasList array-contains + aktif == true),
  // kalau tidak seluruh kueri ditolak permission-denied. Butuh index lms_tugas (kelasList, aktif)
  // di firestore.indexes.json. ANTIREGRESI §Rules.Sinkron.
  try {
    const q2 = query(
      collection(db, 'lms_tugas'),
      where('kelasList', 'array-contains', k),
      where('aktif', '==', true),
    )
    const snap2 = await getDocs(q2)
    for (const d of snap2.docs) {
      if (map.has(d.id)) continue
      const t = docKeTugas(d.id, d.data() as Record<string, unknown>)
      if (t.aktif) map.set(d.id, t)
    }
  } catch (e) {
    console.warn('daftarTugasAktifKelas kelasList', e)
  }

  const list = [...map.values()]
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
 * - ditutup: guru menandai selesai, atau tenggat lewat pada tugas bertanda tutup otomatis —
 *   siswa tidak bisa membuka/mengirim
 *   (ANTIREGRESI §Tugas.Selesai.Ditutup)
 * - lewat: belum dinilai dan tenggat sudah lewat
 * - belum: selain itu
 */
export function statusTugasSiswa(
  tugas: Pick<TugasLms, 'tenggat' | 'selesai' | 'tutupSetelahTenggat'>,
  nilai?: Pick<NilaiTugasDok, 'nilai'> | null,
): StatusTugasSiswa {
  if (nilai && typeof nilai.nilai === 'number') return 'dinilai'
  if (alasanTugasDitutup(tugas) !== null) return 'ditutup'
  if (tenggatLewat(tugas.tenggat)) return 'lewat'
  return 'belum'
}

/**
 * Teks batas waktu relatif (bahasa siswa).
 * Tetap dipakai di tempat lama; lebih jelas: «Batas akhir …».
 */
export function formatTenggatRelatif(tenggat: unknown, sekarang = Date.now()): string {
  const info = infoBatasAkhirSiswa(tenggat, sekarang)
  return info ? info.ringkas : ''
}

export type InfoBatasAkhirSiswa = {
  /** Satu baris singkat untuk meta/chip, mis. «Batas akhir 28 Nov · 3 hari lagi» */
  ringkas: string
  /** Baris lebih lengkap untuk kartu, mis. «Batas akhir: Sabtu, 28 Nov» */
  tanggal: string
  /** Penjelasan sisa waktu, mis. «Masih 3 hari» / «Hari ini» / «Sudah lewat 2 hari» */
  sisa: string
  /** true bila sudah lewat */
  lewat: boolean
  /** true bila hari ini / besok / ≤ 3 hari (perlu penekanan visual) */
  mendesak: boolean
}

/** Info batas akhir tugas untuk UI siswa (kartu & detail). */
export function infoBatasAkhirSiswa(tenggat: unknown, sekarang = Date.now()): InfoBatasAkhirSiswa | null {
  const ms = tenggatMs(tenggat)
  if (!ms) return null
  try {
    const tgl = new Date(ms)
    const sekarangD = new Date(sekarang)
    const tanggal = tgl.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: tgl.getFullYear() !== sekarangD.getFullYear() ? 'numeric' : undefined,
    })
    const tglPendek = tgl.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: tgl.getFullYear() !== sekarangD.getFullYear() ? 'numeric' : undefined,
    })
    // Hari kalender untuk status lewat/hari ini; sisa waktu pakai selisih jam/menit agar countdown hidup.
    const awalHari = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const selisihHari = Math.round((awalHari(tgl) - awalHari(sekarangD)) / (24 * 60 * 60 * 1000))
    const sisaMs = ms - sekarang

    const teksSisaAktif = (): string => {
      if (sisaMs <= 0) return ''
      const totalMenit = Math.max(1, Math.floor(sisaMs / 60_000))
      const hari = Math.floor(totalMenit / (60 * 24))
      const jam = Math.floor((totalMenit % (60 * 24)) / 60)
      const mnt = totalMenit % 60
      if (hari >= 2) {
        return jam > 0 ? `Masih ${hari} hari ${jam} jam` : `Masih ${hari} hari`
      }
      if (hari === 1) {
        return jam > 0 ? `Masih 1 hari ${jam} jam` : 'Masih 1 hari'
      }
      if (jam >= 1) {
        return mnt > 0 ? `Sisa ${jam} jam ${mnt} menit` : `Sisa ${jam} jam`
      }
      return `Sisa ${mnt} menit`
    }

    if (selisihHari < 0 || sisaMs <= 0) {
      const lewatHari = Math.max(1, Math.abs(selisihHari === 0 && sisaMs <= 0 ? 0 : selisihHari))
      // Jika lewat kurang dari 1 hari kalender, sebut jam.
      let sisa: string
      if (sisaMs > -60 * 60 * 1000 && sisaMs <= 0) {
        sisa = 'Baru saja lewat'
      } else if (selisihHari >= -1 && sisaMs > -24 * 60 * 60 * 1000) {
        const jamLewat = Math.max(1, Math.floor(Math.abs(sisaMs) / 3_600_000))
        sisa = jamLewat === 1 ? 'Sudah lewat 1 jam' : `Sudah lewat ${jamLewat} jam`
      } else {
        sisa = lewatHari <= 1 ? 'Sudah lewat 1 hari' : `Sudah lewat ${lewatHari} hari`
      }
      return {
        ringkas: `${sisa} (batas ${tglPendek})`,
        tanggal: `Batas akhir: ${tanggal}`,
        sisa,
        lewat: true,
        mendesak: true,
      }
    }

    const sisa = teksSisaAktif()
    const mendesak = selisihHari <= 3 || sisaMs <= 3 * 24 * 60 * 60 * 1000

    if (selisihHari === 0) {
      return {
        ringkas: `Batas akhir hari ini (${tglPendek}) · ${sisa}`,
        tanggal: `Batas akhir: ${tanggal}`,
        sisa: sisa || 'Hari ini — segera kumpulkan',
        lewat: false,
        mendesak: true,
      }
    }
    if (selisihHari === 1) {
      return {
        ringkas: `Batas akhir besok (${tglPendek}) · ${sisa}`,
        tanggal: `Batas akhir: ${tanggal}`,
        sisa,
        lewat: false,
        mendesak: true,
      }
    }
    return {
      ringkas: `Batas akhir ${tglPendek} · ${sisa}`,
      tanggal: `Batas akhir: ${tanggal}`,
      sisa,
      lewat: false,
      mendesak,
    }
  } catch {
    return null
  }
}

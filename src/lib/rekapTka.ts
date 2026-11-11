/**
 * Muat & simpan Rekap Nilai Try Out TKA.
 * Otomatis: skor dari lms_jawaban pada kuis dengan tahapTryOutTka cocok.
 * Manual: override di lms_rekap_tka (menang atas otomatis).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { daftarKuis } from './kuis'
import {
  daftarJawabanKuisMultiKelas,
  ringkasPerSiswa,
  skorKe100,
} from './jawabanKuis'
import { muatSiswaKelas, type SiswaDasar } from './siswaAuth'
import {
  KELAS_TKA_BANK,
  MAPEL_TKA,
  type MapelTkaNama,
} from './tkaAkses'
import type { KuisLms, TahapTryOutTka } from '../types/kuis'
import type { BarisRekapTka, RekapTkaDok, SelNilaiTka, SumberNilaiTka } from '../types/rekapTka'
import { idRekapTka } from '../types/rekapTka'

function koleksi() {
  return collection(db, 'lms_rekap_tka')
}

/** Kuis TKA (kelas bank «6») yang bertanda tahap tertentu, per mapel. */
export async function muatKuisTkaPerTahap(
  tahap: TahapTryOutTka,
): Promise<Record<MapelTkaNama, KuisLms[]>> {
  const out = {} as Record<MapelTkaNama, KuisLms[]>
  await Promise.all(
    MAPEL_TKA.map(async (mapel) => {
      const semua = await daftarKuis(KELAS_TKA_BANK, mapel)
      out[mapel] = semua.filter((k) => k.tahapTryOutTka === tahap)
    }),
  )
  return out
}

/**
 * Nilai otomatis 0–100 untuk satu siswa pada satu mapel dari daftar kuis tahap.
 * Jika beberapa kuis: ambil skor tertinggi (skala 100).
 */
async function nilaiOtomatisMapel(
  mapel: MapelTkaNama,
  kuisList: KuisLms[],
  kelasList: string[],
): Promise<Map<string, { nilai: number; kuisId: string; judul: string }>> {
  const hasil = new Map<string, { nilai: number; kuisId: string; judul: string }>()
  for (const k of kuisList) {
    if (!k.id) continue
    const jawaban = await daftarJawabanKuisMultiKelas(k.id, kelasList, mapel)
    const ringkas = ringkasPerSiswa(jawaban)
    for (const j of ringkas) {
      const sid = j.siswaId || j.siswaUid
      if (!sid) continue
      const n = skorKe100(j.skorOtomatis, j.totalPoin || k.totalPoin || 0)
      const prev = hasil.get(sid)
      if (!prev || n > prev.nilai) {
        hasil.set(sid, { nilai: n, kuisId: k.id, judul: k.judul })
      }
    }
  }
  return hasil
}

/** Muat override manual untuk tahap + daftar kelas. */
export async function muatRekapTkaManual(
  tahap: TahapTryOutTka,
  kelasList: string[],
): Promise<Map<string, RekapTkaDok>> {
  const map = new Map<string, RekapTkaDok>()
  await Promise.all(
    kelasList.map(async (kelas) => {
      const q = query(
        koleksi(),
        where('tahap', '==', tahap),
        where('kelas', '==', String(kelas).toUpperCase()),
      )
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        const data = d.data()
        map.set(d.id, {
          id: d.id,
          kelas: String(data.kelas ?? kelas),
          tahap: data.tahap as TahapTryOutTka,
          siswaId: String(data.siswaId ?? ''),
          siswaNama: String(data.siswaNama ?? ''),
          nilai: (data.nilai as RekapTkaDok['nilai']) ?? {},
          sumber: (data.sumber as RekapTkaDok['sumber']) ?? {},
          kuisIdRef: (data.kuisIdRef as RekapTkaDok['kuisIdRef']) ?? {},
          diubahOleh: typeof data.diubahOleh === 'string' ? data.diubahOleh : undefined,
          diubahOlehNama: typeof data.diubahOlehNama === 'string' ? data.diubahOlehNama : undefined,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt,
        })
      }
    }),
  )
  return map
}

/** Gabungkan roster siswa + otomatis + manual menjadi baris UI. */
export async function bangunRekapTka(input: {
  tahap: TahapTryOutTka
  kelasList: string[]
}): Promise<{
  baris: BarisRekapTka[]
  kuisPerMapel: Record<MapelTkaNama, KuisLms[]>
  siswa: SiswaDasar[]
}> {
  const { tahap, kelasList } = input
  const [kuisPerMapel, siswaBatches, manualMap] = await Promise.all([
    muatKuisTkaPerTahap(tahap),
    Promise.all(kelasList.map((k) => muatSiswaKelas(k))),
    muatRekapTkaManual(tahap, kelasList),
  ])
  const siswa = siswaBatches
    .flat()
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id') || a.kelas.localeCompare(b.kelas))

  const autoPerMapel = {} as Record<
    MapelTkaNama,
    Map<string, { nilai: number; kuisId: string; judul: string }>
  >
  await Promise.all(
    MAPEL_TKA.map(async (mapel) => {
      autoPerMapel[mapel] = await nilaiOtomatisMapel(mapel, kuisPerMapel[mapel], kelasList)
    }),
  )

  const baris: BarisRekapTka[] = siswa.map((s) => {
    const dokId = idRekapTka(s.kelas, tahap, s.id)
    const manual = manualMap.get(dokId)
    const perMapel = {} as Record<MapelTkaNama, SelNilaiTka>
    for (const mapel of MAPEL_TKA) {
      const mVal = manual?.nilai?.[mapel]
      const mSrc = manual?.sumber?.[mapel]
      if (mSrc === 'manual' && mVal != null && !Number.isNaN(Number(mVal))) {
        perMapel[mapel] = { nilai: Number(mVal), sumber: 'manual' }
        continue
      }
      const auto = autoPerMapel[mapel].get(s.id)
      if (auto) {
        perMapel[mapel] = {
          nilai: auto.nilai,
          sumber: 'otomatis',
          dariKuis: auto.judul,
          kuisId: auto.kuisId,
        }
      } else {
        perMapel[mapel] = { nilai: null, sumber: null }
      }
    }
    return {
      siswaId: s.id,
      siswaNama: s.nama,
      kelas: s.kelas,
      perMapel,
    }
  })

  return { baris, kuisPerMapel, siswa }
}

/** Simpan / perbarui nilai manual satu mapel untuk satu siswa. */
export async function simpanNilaiManualTka(input: {
  kelas: string
  tahap: TahapTryOutTka
  siswaId: string
  siswaNama: string
  mapel: MapelTkaNama
  /** null = hapus override manual (kembali ke otomatis / kosong). */
  nilai: number | null
  namaGuru?: string
}): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anda harus masuk terlebih dahulu.')
  const kelas = String(input.kelas).toUpperCase()
  const id = idRekapTka(kelas, input.tahap, input.siswaId)
  const ref = doc(db, 'lms_rekap_tka', id)

  const existing = await getDoc(ref)
  const prev = existing.exists() ? existing.data() : {}
  const nilai: Record<string, number | null> = {
    ...((prev.nilai as Record<string, number | null>) || {}),
  }
  const sumber: Record<string, SumberNilaiTka> = {
    ...((prev.sumber as Record<string, SumberNilaiTka>) || {}),
  }

  if (input.nilai == null || Number.isNaN(Number(input.nilai))) {
    delete nilai[input.mapel]
    delete sumber[input.mapel]
  } else {
    const n = Math.round(Number(input.nilai) * 10) / 10
    if (n < 0 || n > 100) throw new Error('Nilai harus antara 0 dan 100.')
    nilai[input.mapel] = n
    sumber[input.mapel] = 'manual'
  }

  await setDoc(
    ref,
    {
      kelas,
      tahap: input.tahap,
      siswaId: input.siswaId,
      siswaNama: input.siswaNama,
      nilai,
      sumber,
      diubahOleh: uid,
      diubahOlehNama: input.namaGuru || '',
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
}

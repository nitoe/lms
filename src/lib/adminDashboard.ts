/**
 * Agregat dashboard admin LMS — performa guru, cakupan konten, aktivitas siswa.
 * Hanya dipanggil saat peran admin (rules: isAdmin boleh list lms_* + users + siswa).
 */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import { DAFTAR_KELAS_SD } from './kelasLms'
import { getDaftarMapel } from './mapelData'

export type GuruStat = {
  key: string
  nama: string
  uid?: string
  materi: number
  kuis: number
  tugas: number
  total: number
}

export type KelasCakupan = {
  kelas: string
  jumlahMateri: number
  jumlahKuis: number
  jumlahTugas: number
  mapelDenganMateri: string[]
  mapelTanpaMateri: string[]
}

export type AktivitasHariIni = {
  jawabanKuis: number
  pengumpulanTugas: number
  siswaUnik: number
  kelasTeratas: { kelas: string; aktivitas: number }[]
}

export type AdminDashboardData = {
  dimuatPada: Date
  ringkas: {
    totalMateri: number
    totalKuis: number
    totalKuisAktif: number
    totalTugas: number
    totalTugasAktif: number
    totalSiswa: number
    totalGuru: number
    guruDenganKonten: number
  }
  guru: GuruStat[]
  kelasCakupan: KelasCakupan[]
  aktivitasHariIni: AktivitasHariIni
  alert: string[]
}

function awalHariLokal(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function namaDari(data: Record<string, unknown>): string {
  const n =
    (typeof data.dibuatOlehNama === 'string' && data.dibuatOlehNama.trim()) ||
    (typeof data.dibuatOleh === 'string' && data.dibuatOleh) ||
    'Tanpa nama'
  return n
}

function keyPembuat(data: Record<string, unknown>): string {
  if (typeof data.dibuatOleh === 'string' && data.dibuatOleh) return `uid:${data.dibuatOleh}`
  const n = namaDari(data)
  return `nama:${n}`
}

/**
 * Muat agregat dashboard. Aman dipanggil hanya oleh admin.
 * Gagal sebagian → field terkait kosong/0, tidak melempar agar UI tetap tampil.
 */
export async function muatAdminDashboard(): Promise<AdminDashboardData> {
  const kosong: AdminDashboardData = {
    dimuatPada: new Date(),
    ringkas: {
      totalMateri: 0,
      totalKuis: 0,
      totalKuisAktif: 0,
      totalTugas: 0,
      totalTugasAktif: 0,
      totalSiswa: 0,
      totalGuru: 0,
      guruDenganKonten: 0,
    },
    guru: [],
    kelasCakupan: [],
    aktivitasHariIni: {
      jawabanKuis: 0,
      pengumpulanTugas: 0,
      siswaUnik: 0,
      kelasTeratas: [],
    },
    alert: [],
  }

  if (!isFirebaseConfigured) {
    kosong.alert.push('Firebase belum dikonfigurasi.')
    return kosong
  }

  const guruMap = new Map<string, GuruStat>()
  const bumpGuru = (data: Record<string, unknown>, field: 'materi' | 'kuis' | 'tugas') => {
    const key = keyPembuat(data)
    let g = guruMap.get(key)
    if (!g) {
      g = {
        key,
        nama: namaDari(data),
        uid: typeof data.dibuatOleh === 'string' ? data.dibuatOleh : undefined,
        materi: 0,
        kuis: 0,
        tugas: 0,
        total: 0,
      }
      guruMap.set(key, g)
    }
    g[field] += 1
    g.total += 1
    if (typeof data.dibuatOlehNama === 'string' && data.dibuatOlehNama.trim()) {
      g.nama = data.dibuatOlehNama.trim()
    }
  }

  const materiPerKelasMapel = new Map<string, Set<string>>() // kelas → mapel set
  const countMateriKelas = new Map<string, number>()
  const countKuisKelas = new Map<string, number>()
  const countTugasKelas = new Map<string, number>()

  let totalMateri = 0
  let totalKuis = 0
  let totalKuisAktif = 0
  let totalTugas = 0
  let totalTugasAktif = 0

  const mulaiHari = Timestamp.fromDate(awalHariLokal())

  const [
    materiSnap,
    kuisSnap,
    tugasSnap,
    siswaSnap,
    usersSnap,
    jawabanHari,
    pengumpulanHari,
    daftarMapel,
  ] = await Promise.all([
    getDocs(collection(db, 'lms_materi')).catch((e) => {
      console.warn('adminDashboard materi', e)
      return null
    }),
    getDocs(collection(db, 'lms_kuis')).catch((e) => {
      console.warn('adminDashboard kuis', e)
      return null
    }),
    getDocs(collection(db, 'lms_tugas')).catch((e) => {
      console.warn('adminDashboard tugas', e)
      return null
    }),
    getDocs(collection(db, 'siswa')).catch((e) => {
      console.warn('adminDashboard siswa', e)
      return null
    }),
    getDocs(collection(db, 'users')).catch((e) => {
      console.warn('adminDashboard users', e)
      return null
    }),
    // Aktivitas hari ini — batas 500 agar tidak memberatkan; cukup untuk SD
    getDocs(
      query(
        collection(db, 'lms_jawaban'),
        where('createdAt', '>=', mulaiHari),
        orderBy('createdAt', 'desc'),
        limit(500),
      ),
    ).catch((e) => {
      console.warn('adminDashboard jawaban hari ini', e)
      return null
    }),
    getDocs(
      query(
        collection(db, 'lms_pengumpulan'),
        where('createdAt', '>=', mulaiHari),
        orderBy('createdAt', 'desc'),
        limit(500),
      ),
    ).catch((e) => {
      console.warn('adminDashboard pengumpulan hari ini', e)
      return null
    }),
    getDaftarMapel().catch(() => [] as string[]),
  ])

  // Materi (skip konten Lomba agar tidak mencampur statistik pembelajaran reguler)
  if (materiSnap) {
    for (const d of materiSnap.docs) {
      const data = d.data() as Record<string, unknown>
      if (data.lombaId) continue
      totalMateri += 1
      bumpGuru(data, 'materi')
      const kelas = String(data.kelas || '').toUpperCase()
      const mapel = String(data.mapel || '').trim()
      if (kelas) {
        countMateriKelas.set(kelas, (countMateriKelas.get(kelas) || 0) + 1)
        if (mapel) {
          let set = materiPerKelasMapel.get(kelas)
          if (!set) {
            set = new Set()
            materiPerKelasMapel.set(kelas, set)
          }
          set.add(mapel)
        }
      }
      // kelasList: hitung juga sebagai cakupan bagi paralel yang dibagikan
      if (Array.isArray(data.kelasList)) {
        for (const k of data.kelasList) {
          const kk = String(k || '').toUpperCase()
          if (!kk || kk === kelas) continue
          if (mapel) {
            let set = materiPerKelasMapel.get(kk)
            if (!set) {
              set = new Set()
              materiPerKelasMapel.set(kk, set)
            }
            set.add(mapel)
          }
        }
      }
    }
  }

  if (kuisSnap) {
    for (const d of kuisSnap.docs) {
      const data = d.data() as Record<string, unknown>
      if (data.lombaId) continue
      totalKuis += 1
      if (data.aktif === true) totalKuisAktif += 1
      bumpGuru(data, 'kuis')
      const kelas = String(data.kelas || '').toUpperCase()
      if (kelas) countKuisKelas.set(kelas, (countKuisKelas.get(kelas) || 0) + 1)
    }
  }

  if (tugasSnap) {
    for (const d of tugasSnap.docs) {
      const data = d.data() as Record<string, unknown>
      totalTugas += 1
      if (data.aktif === true) totalTugasAktif += 1
      bumpGuru(data, 'tugas')
      const kelas = String(data.kelas || '').toUpperCase()
      if (kelas) countTugasKelas.set(kelas, (countTugasKelas.get(kelas) || 0) + 1)
    }
  }

  let totalSiswa = 0
  if (siswaSnap) {
    for (const d of siswaSnap.docs) {
      const data = d.data()
      if (data.aktif === false) continue
      totalSiswa += 1
    }
  }

  let totalGuru = 0
  const ROLE_GURU = new Set(['guru', 'guru_tahsin_tahfizh', 'guru_akademik', 'admin'])
  if (usersSnap) {
    for (const d of usersSnap.docs) {
      const data = d.data()
      if (data.aktif === false) continue
      const role = String(data.role || '')
      if (ROLE_GURU.has(role) || data.peranLms === 'admin' || data.peranLms === 'guru') {
        totalGuru += 1
      }
    }
  }

  const guruList = [...guruMap.values()].sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama, 'id'))

  // Cakupan per kelas
  const mapelMaster = daftarMapel.filter((m) => m && m !== 'Wali kelas')
  const kelasCakupan: KelasCakupan[] = []
  const alert: string[] = []

  for (const kelas of DAFTAR_KELAS_SD) {
    const punya = materiPerKelasMapel.get(kelas) || new Set<string>()
    const mapelDengan = mapelMaster.filter((m) => punya.has(m))
    const mapelTanpa = mapelMaster.filter((m) => !punya.has(m))
    kelasCakupan.push({
      kelas,
      jumlahMateri: countMateriKelas.get(kelas) || 0,
      jumlahKuis: countKuisKelas.get(kelas) || 0,
      jumlahTugas: countTugasKelas.get(kelas) || 0,
      mapelDenganMateri: mapelDengan,
      mapelTanpaMateri: mapelTanpa,
    })
    if (mapelMaster.length > 0 && mapelTanpa.length === mapelMaster.length) {
      alert.push(`Kelas ${kelas}: belum ada materi sama sekali.`)
    } else if (mapelTanpa.length > 0 && mapelTanpa.length <= 3) {
      alert.push(`Kelas ${kelas}: belum ada materi untuk ${mapelTanpa.join(', ')}.`)
    } else if (mapelTanpa.length > 3) {
      alert.push(`Kelas ${kelas}: ${mapelTanpa.length} mapel belum punya materi.`)
    }
  }

  // Aktivitas hari ini
  const siswaUnik = new Set<string>()
  const aktKelas = new Map<string, number>()
  let jawabanKuis = 0
  let pengumpulanTugas = 0

  if (jawabanHari) {
    for (const d of jawabanHari.docs) {
      const data = d.data() as Record<string, unknown>
      if (data.lombaId) continue
      jawabanKuis += 1
      const sid = String(data.siswaId || data.siswaUid || '')
      if (sid) siswaUnik.add(sid)
      const kelas = String(data.kelas || '').toUpperCase()
      if (kelas) aktKelas.set(kelas, (aktKelas.get(kelas) || 0) + 1)
    }
  }
  if (pengumpulanHari) {
    for (const d of pengumpulanHari.docs) {
      const data = d.data() as Record<string, unknown>
      pengumpulanTugas += 1
      const sid = String(data.siswaId || '')
      if (sid) siswaUnik.add(sid)
      const kelas = String(data.kelas || '').toUpperCase()
      if (kelas) aktKelas.set(kelas, (aktKelas.get(kelas) || 0) + 1)
    }
  }

  const kelasTeratas = [...aktKelas.entries()]
    .map(([kelas, aktivitas]) => ({ kelas, aktivitas }))
    .sort((a, b) => b.aktivitas - a.aktivitas)
    .slice(0, 5)

  if (jawabanKuis + pengumpulanTugas === 0) {
    alert.push('Belum ada aktivitas siswa (jawaban kuis / pengumpulan tugas) hari ini.')
  }

  // Guru tanpa konten (opsional — hanya hitung yang punya nama di users tapi 0 konten)
  // Diabaikan detail agar tidak menuduh salah; fokus ke ranking yang aktif.

  return {
    dimuatPada: new Date(),
    ringkas: {
      totalMateri,
      totalKuis,
      totalKuisAktif,
      totalTugas,
      totalTugasAktif,
      totalSiswa,
      totalGuru,
      guruDenganKonten: guruList.length,
    },
    guru: guruList,
    kelasCakupan,
    aktivitasHariIni: {
      jawabanKuis,
      pengumpulanTugas,
      siswaUnik: siswaUnik.size,
      kelasTeratas,
    },
    alert: alert.slice(0, 12),
  }
}

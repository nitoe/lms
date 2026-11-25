/**
 * Tugas kelompok — ANTIREGRESI §Tugas.Kelompok.
 *
 * Satu dokumen per kelompok di `lms_tugas_kelompok/{id}`.
 * - Kelompok BARU memakai id deterministik `{tugasId}_{ketuaId}` (sama dengan id pengumpulan ketua,
 *   dipakai rules agar anggota boleh membaca status pengumpulan ketuanya). Kelompok lama (id acak)
 *   tetap berfungsi, hanya tanpa status «terkumpul lewat ketua» di sisi anggota.
 * - Siswa membentuk kelompok + pilih ketua. Konfirmasi anggota hanya INFORMATIF: tidak pernah
 *   menghalangi pengumpulan ketua (keputusan guru: anggota disusun lewat diskusi antar siswa).
 * - Status per anggota (konfirmasi + pengajuan kirim mandiri) ada di koleksi terpisah
 *   `lms_tugas_kelompok_anggota/{kelompokId}_{siswaId}` agar rules kelompok lama tidak diubah.
 * - Hanya ketua yang mengunggah pengumpulan kelompok; anggota dianggap terkumpul setelah ketua
 *   mengirim. Anggota boleh mengunggah sendiri HANYA jika pengajuannya diterima ketua.
 * - Tidak ada dokumen shadow pengumpulan untuk anggota (hindari regresi rules & storage).
 * - Query siswa WAJIB menyertakan `kelas` (rules mengevaluasi resource.data.kelas); query guru
 *   WAJIB menyertakan tugasId + kelas per rombel (ANTIREGRESI §Tugas.Kelompok).
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { SiswaDasar } from './siswaAuth'
import { idPengumpulan } from './pengumpulan'

export type AnggotaKelompok = {
  id: string
  nama: string
}

/** Dokumen `lms_tugas_kelompok/{id}`. */
export type TugasKelompokDok = {
  id: string
  tugasId: string
  kelas: string
  ketuaId: string
  ketuaNama: string
  /** Termasuk ketua. */
  anggotaIds: string[]
  anggotaList: AnggotaKelompok[]
  dibuatOleh: string
  dibuatMs: number
  diubahMs: number
}

function koleksi() {
  return collection(db, 'lms_tugas_kelompok')
}

function normalisasiAnggota(raw: unknown): AnggotaKelompok[] {
  if (!Array.isArray(raw)) return []
  const out: AnggotaKelompok[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = String(o.id || '').trim()
    const nama = String(o.nama || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ id, nama: nama || id })
  }
  return out
}

function docKeKelompok(id: string, data: Record<string, unknown>): TugasKelompokDok {
  const anggotaList = normalisasiAnggota(data.anggotaList)
  const anggotaIds = Array.isArray(data.anggotaIds)
    ? (data.anggotaIds as unknown[]).map(String).filter(Boolean)
    : anggotaList.map((a) => a.id)
  // Pastikan ketua selalu di daftar
  const ketuaId = String(data.ketuaId || '')
  const ketuaNama = String(data.ketuaNama || '')
  if (ketuaId && !anggotaIds.includes(ketuaId)) {
    anggotaIds.unshift(ketuaId)
    if (!anggotaList.some((a) => a.id === ketuaId)) {
      anggotaList.unshift({ id: ketuaId, nama: ketuaNama || ketuaId })
    }
  }
  return {
    id,
    tugasId: String(data.tugasId || ''),
    kelas: String(data.kelas || '').toUpperCase(),
    ketuaId,
    ketuaNama,
    anggotaIds,
    anggotaList,
    dibuatOleh: String(data.dibuatOleh || ''),
    dibuatMs: typeof data.dibuatMs === 'number' ? data.dibuatMs : 0,
    diubahMs: typeof data.diubahMs === 'number' ? data.diubahMs : 0,
  }
}

/** Id deterministik kelompok baru: sama dengan id pengumpulan ketua. */
export function idKelompokBaru(tugasId: string, ketuaId: string): string {
  return `${tugasId}_${ketuaId}`
}

/**
 * Semua kelompok satu tugas pada SATU rombel (guru + siswa sekelas).
 * `kelas` wajib: rules mengevaluasi resource.data.kelas, query tanpa kelas ditolak.
 */
export async function daftarKelompokTugas(
  tugasId: string,
  kelas: string,
): Promise<TugasKelompokDok[]> {
  const snap = await getDocs(
    query(
      koleksi(),
      where('tugasId', '==', tugasId),
      where('kelas', '==', String(kelas).toUpperCase()),
    ),
  )
  const list = snap.docs.map((d) => docKeKelompok(d.id, d.data() as Record<string, unknown>))
  list.sort((a, b) => a.ketuaNama.localeCompare(b.ketuaNama, 'id'))
  return list
}

/** Kelompok yang memuat siswa tertentu pada tugas ini (0 atau 1). Disaring di klien. */
export async function kelompokSaya(
  tugasId: string,
  siswaId: string,
  kelas: string,
): Promise<TugasKelompokDok | null> {
  if (!tugasId || !siswaId || !kelas) return null
  const list = await daftarKelompokTugas(tugasId, kelas)
  return list.find((k) => k.anggotaIds.includes(siswaId)) ?? null
}

/** Semua kelompok yang memuat siswa di satu kelas (semua tugas) — untuk beranda & katalog. */
export async function kelompokKelasSaya(
  kelas: string,
  siswaId: string,
): Promise<TugasKelompokDok[]> {
  if (!kelas || !siswaId) return []
  const snap = await getDocs(query(koleksi(), where('kelas', '==', String(kelas).toUpperCase())))
  return snap.docs
    .map((d) => docKeKelompok(d.id, d.data() as Record<string, unknown>))
    .filter((k) => k.anggotaIds.includes(siswaId))
}

export async function ambilKelompok(id: string): Promise<TugasKelompokDok | null> {
  const snap = await getDoc(doc(db, 'lms_tugas_kelompok', id))
  if (!snap.exists()) return null
  return docKeKelompok(snap.id, snap.data() as Record<string, unknown>)
}

function susunAnggota(ketua: SiswaDasar, anggotaLain: SiswaDasar[], max: number): AnggotaKelompok[] {
  const seen = new Set<string>([ketua.id])
  const list: AnggotaKelompok[] = [{ id: ketua.id, nama: ketua.nama || ketua.id }]
  for (const s of anggotaLain) {
    if (!s?.id || seen.has(s.id)) continue
    if (list.length >= max) break
    seen.add(s.id)
    list.push({ id: s.id, nama: s.nama || s.id })
  }
  return list
}

/**
 * Pastikan tidak ada calon anggota yang sudah berada di kelompok LAIN pada tugas yang sama.
 * Rules tidak bisa menegakkan ini (tidak ada dokumen keanggotaan per siswa), jadi dicek di klien
 * tepat sebelum simpan. Melempar Error berisi nama siswa yang bentrok.
 */
export async function pastikanTanpaBentrok(params: {
  tugasId: string
  kelas: string
  anggota: AnggotaKelompok[]
  kelompokIdSendiri?: string
}): Promise<void> {
  const semua = await daftarKelompokTugas(params.tugasId, params.kelas)
  const terpakai = new Map<string, string>()
  for (const k of semua) {
    if (k.id === params.kelompokIdSendiri) continue
    for (const a of k.anggotaList) terpakai.set(a.id, k.ketuaNama)
  }
  const bentrok = params.anggota.filter((a) => terpakai.has(a.id))
  if (bentrok.length > 0) {
    throw new Error(
      `${bentrok.map((a) => a.nama).join(', ')} sudah masuk kelompok lain untuk tugas ini. ` +
        'Keluarkan dari pilihan lalu simpan lagi.',
    )
  }
}

/**
 * Buat kelompok baru. Pembuat otomatis menjadi ketua.
 * `anggotaLain` = teman yang dipilih; ketua selalu dimasukkan.
 * Id deterministik `{tugasId}_{ketuaId}` → satu ketua hanya bisa punya satu kelompok per tugas.
 */
export async function buatKelompok(params: {
  tugasId: string
  kelas: string
  ketua: SiswaDasar
  anggotaLain: SiswaDasar[]
  maxAnggota: number
}): Promise<TugasKelompokDok> {
  const { tugasId, kelas, ketua, anggotaLain, maxAnggota } = params
  const max = Math.max(2, Math.min(12, maxAnggota || 4))
  const list = susunAnggota(ketua, anggotaLain, max)
  const kelasUp = String(kelas).toUpperCase()
  await pastikanTanpaBentrok({ tugasId, kelas: kelasUp, anggota: list })
  const id = idKelompokBaru(tugasId, ketua.id)
  const now = Date.now()
  const payload = {
    tugasId,
    kelas: kelasUp,
    ketuaId: ketua.id,
    ketuaNama: ketua.nama || ketua.id,
    anggotaIds: list.map((a) => a.id),
    anggotaList: list,
    dibuatOleh: ketua.id,
    dibuatMs: now,
    diubahMs: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'lms_tugas_kelompok', id), payload)
  return { id, ...payload, createdAt: undefined, updatedAt: undefined } as TugasKelompokDok
}

/**
 * Perbarui daftar anggota. Hanya ketua (dicek di UI + rules).
 * Anggota yang dikeluarkan: dokumen statusnya dihapus (best-effort).
 */
export async function perbaruiAnggotaKelompok(params: {
  kelompokId: string
  ketua: SiswaDasar
  anggotaLain: SiswaDasar[]
  maxAnggota: number
}): Promise<TugasKelompokDok> {
  const { kelompokId, ketua, anggotaLain, maxAnggota } = params
  const max = Math.max(2, Math.min(12, maxAnggota || 4))
  const lama = await ambilKelompok(kelompokId)
  if (!lama) throw new Error('Kelompok tidak ditemukan.')
  const list = susunAnggota(ketua, anggotaLain, max)
  await pastikanTanpaBentrok({
    tugasId: lama.tugasId,
    kelas: lama.kelas,
    anggota: list,
    kelompokIdSendiri: kelompokId,
  })
  const now = Date.now()
  await updateDoc(doc(db, 'lms_tugas_kelompok', kelompokId), {
    ketuaId: ketua.id,
    ketuaNama: ketua.nama || ketua.id,
    anggotaIds: list.map((a) => a.id),
    anggotaList: list,
    diubahMs: now,
    updatedAt: serverTimestamp(),
  })
  const baru = new Set(list.map((a) => a.id))
  await hapusStatusKelompok(
    lama,
    lama.anggotaList.filter((a) => !baru.has(a.id)).map((a) => a.id),
  )
  const updated = await ambilKelompok(kelompokId)
  if (!updated) throw new Error('Kelompok tidak ditemukan setelah diperbarui.')
  return updated
}

/** Anggota keluar dari kelompok (hapus diri sendiri). Jika ketua keluar → kelompok dihapus. */
export async function keluarKelompok(
  kelompok: TugasKelompokDok,
  siswaId: string,
): Promise<'hapus' | 'update'> {
  if (kelompok.ketuaId === siswaId) {
    await hapusStatusKelompok(
      kelompok,
      kelompok.anggotaList.filter((a) => a.id !== kelompok.ketuaId).map((a) => a.id),
    )
    await deleteDoc(doc(db, 'lms_tugas_kelompok', kelompok.id))
    return 'hapus'
  }
  const list = kelompok.anggotaList.filter((a) => a.id !== siswaId)
  const ids = list.map((a) => a.id)
  await updateDoc(doc(db, 'lms_tugas_kelompok', kelompok.id), {
    anggotaIds: ids,
    anggotaList: list,
    diubahMs: Date.now(),
    updatedAt: serverTimestamp(),
  })
  await hapusStatusKelompok(kelompok, [siswaId])
  return 'update'
}

/** Guru/admin menghapus kelompok. */
export async function hapusKelompok(kelompokId: string): Promise<void> {
  await deleteDoc(doc(db, 'lms_tugas_kelompok', kelompokId))
}

/** Apakah siswa adalah ketua kelompok ini. */
export function isKetua(kelompok: TugasKelompokDok | null | undefined, siswaId: string): boolean {
  return !!kelompok && kelompok.ketuaId === siswaId
}

/** Apakah siswa anggota (termasuk ketua). */
export function isAnggota(kelompok: TugasKelompokDok | null | undefined, siswaId: string): boolean {
  return !!kelompok && kelompok.anggotaIds.includes(siswaId)
}

// ---------------------------------------------------------------------------
// Status anggota: konfirmasi (informatif) + pengajuan kirim mandiri
// ---------------------------------------------------------------------------

export type StatusPengajuan = 'tidak' | 'menunggu' | 'diterima' | 'ditolak'

/** Dokumen `lms_tugas_kelompok_anggota/{kelompokId}_{siswaId}`. */
export type StatusAnggotaDok = {
  id: string
  kelompokId: string
  tugasId: string
  kelas: string
  siswaId: string
  siswaNama: string
  ketuaId: string
  /** 0 = belum konfirmasi. Hanya informasi — tidak menghalangi pengumpulan ketua. */
  konfirmasiMs: number
  pengajuan: StatusPengajuan
  /** Alasan anggota ingin mengirim sendiri (maks. 200 huruf). */
  alasan: string
  /** Catatan ketua saat menerima/menolak (maks. 200 huruf). */
  catatanKetua: string
  diubahMs: number
}

/**
 * Auto-konfirmasi (informatif): anggota yang tidak merespons dianggap sudah dikonfirmasi setelah
 * selang ini — untuk siswa yang tidak memegang HP/akun sendiri. Dihitung DI KLIEN dari waktu
 * kelompok terakhir diubah (`diubahMs`: dibentuk / ketua mengubah anggota); tidak ada penulisan
 * ke Firestore dan tidak ada fungsi terjadwal. ANTIREGRESI §Tugas.Kelompok.AutoKonfirmasi.
 */
export const WAKTU_AUTO_KONFIRMASI_MS = 60 * 60 * 1000

export type StatusKonfirmasi = {
  /** manual = anggota menekan tombol; otomatis = tanpa respons ≥ 1 jam; belum = masih menunggu. */
  jenis: 'manual' | 'otomatis' | 'belum'
  /** Untuk `belum`: sisa waktu menuju otomatis (ms); 0 bila waktu mulai tidak diketahui. */
  sisaMs: number
}

/** Status konfirmasi seorang anggota (non-ketua) pada saat `now`. */
export function statusKonfirmasi(
  kelompok: Pick<TugasKelompokDok, 'diubahMs' | 'dibuatMs'>,
  st: Pick<StatusAnggotaDok, 'konfirmasiMs'> | null | undefined,
  now: number = Date.now(),
): StatusKonfirmasi {
  if (st && st.konfirmasiMs > 0) return { jenis: 'manual', sisaMs: 0 }
  const mulai = Math.max(kelompok.diubahMs || 0, kelompok.dibuatMs || 0)
  if (mulai <= 0) return { jenis: 'belum', sisaMs: 0 }
  const sisa = mulai + WAKTU_AUTO_KONFIRMASI_MS - now
  return sisa <= 0 ? { jenis: 'otomatis', sisaMs: 0 } : { jenis: 'belum', sisaMs: sisa }
}

/** «±23 mnt» / «±1 mnt» untuk hitung mundur singkat. */
export function teksSisaKonfirmasi(sisaMs: number): string {
  const mnt = Math.max(1, Math.ceil(sisaMs / 60_000))
  return `±${mnt} mnt`
}

export const BATAS_TEKS_STATUS = 200

export function idStatusAnggota(kelompokId: string, siswaId: string): string {
  return `${kelompokId}_${siswaId}`
}

function koleksiStatus() {
  return collection(db, 'lms_tugas_kelompok_anggota')
}

function docKeStatus(id: string, data: Record<string, unknown>): StatusAnggotaDok {
  const p = String(data.pengajuan || 'tidak')
  return {
    id,
    kelompokId: String(data.kelompokId || ''),
    tugasId: String(data.tugasId || ''),
    kelas: String(data.kelas || '').toUpperCase(),
    siswaId: String(data.siswaId || ''),
    siswaNama: String(data.siswaNama || ''),
    ketuaId: String(data.ketuaId || ''),
    konfirmasiMs: typeof data.konfirmasiMs === 'number' ? data.konfirmasiMs : 0,
    pengajuan: p === 'menunggu' || p === 'diterima' || p === 'ditolak' ? p : 'tidak',
    alasan: String(data.alasan || ''),
    catatanKetua: String(data.catatanKetua || ''),
    diubahMs: typeof data.diubahMs === 'number' ? data.diubahMs : 0,
  }
}

/** Semua status anggota pada satu tugas + rombel (siswa sekelas & guru mapel×kelas). */
export async function daftarStatusAnggota(
  tugasId: string,
  kelas: string,
): Promise<StatusAnggotaDok[]> {
  const snap = await getDocs(
    query(
      koleksiStatus(),
      where('tugasId', '==', tugasId),
      where('kelas', '==', String(kelas).toUpperCase()),
    ),
  )
  return snap.docs.map((d) => docKeStatus(d.id, d.data() as Record<string, unknown>))
}

/** Status milik siswa di satu kelas (semua tugas) — beranda. */
export async function statusAnggotaSaya(
  kelas: string,
  siswaId: string,
): Promise<StatusAnggotaDok[]> {
  if (!kelas || !siswaId) return []
  const snap = await getDocs(
    query(
      koleksiStatus(),
      where('kelas', '==', String(kelas).toUpperCase()),
      where('siswaId', '==', siswaId),
    ),
  )
  return snap.docs.map((d) => docKeStatus(d.id, d.data() as Record<string, unknown>))
}

/** Pengajuan yang masuk ke ketua di satu kelas (semua tugas) — beranda ketua. */
export async function statusUntukKetua(
  kelas: string,
  ketuaId: string,
): Promise<StatusAnggotaDok[]> {
  if (!kelas || !ketuaId) return []
  const snap = await getDocs(
    query(
      koleksiStatus(),
      where('kelas', '==', String(kelas).toUpperCase()),
      where('ketuaId', '==', ketuaId),
    ),
  )
  return snap.docs.map((d) => docKeStatus(d.id, d.data() as Record<string, unknown>))
}

function potong(s: string): string {
  return String(s || '').trim().slice(0, BATAS_TEKS_STATUS)
}

/**
 * Simpan perubahan status MILIK SENDIRI (anggota non-ketua). `ada` = dokumen yang sudah dimuat
 * (null jika belum pernah dibuat). Dokumen dibuat saat konfirmasi/pengajuan pertama.
 */
export async function simpanStatusSaya(params: {
  kelompok: TugasKelompokDok
  siswa: SiswaDasar
  ada: StatusAnggotaDok | null
  perubahan: { konfirmasi?: boolean; pengajuan?: 'menunggu'; alasan?: string }
}): Promise<StatusAnggotaDok> {
  const { kelompok, siswa, ada, perubahan } = params
  const now = Date.now()
  const id = idStatusAnggota(kelompok.id, siswa.id)
  const konfirmasiMs = perubahan.konfirmasi ? now : (ada?.konfirmasiMs ?? 0)
  const pengajuan: StatusPengajuan = perubahan.pengajuan ?? ada?.pengajuan ?? 'tidak'
  const alasan = perubahan.pengajuan ? potong(perubahan.alasan ?? '') : (ada?.alasan ?? '')
  if (ada) {
    await updateDoc(doc(db, 'lms_tugas_kelompok_anggota', id), {
      konfirmasiMs,
      pengajuan,
      alasan,
      diubahMs: now,
    })
  } else {
    await setDoc(doc(db, 'lms_tugas_kelompok_anggota', id), {
      kelompokId: kelompok.id,
      tugasId: kelompok.tugasId,
      kelas: kelompok.kelas,
      siswaId: siswa.id,
      siswaNama: siswa.nama || siswa.id,
      ketuaId: kelompok.ketuaId,
      konfirmasiMs,
      pengajuan,
      alasan,
      catatanKetua: '',
      diubahMs: now,
    })
  }
  return {
    id,
    kelompokId: kelompok.id,
    tugasId: kelompok.tugasId,
    kelas: kelompok.kelas,
    siswaId: siswa.id,
    siswaNama: siswa.nama || siswa.id,
    ketuaId: kelompok.ketuaId,
    konfirmasiMs,
    pengajuan,
    alasan,
    catatanKetua: ada?.catatanKetua ?? '',
    diubahMs: now,
  }
}

/** Ketua menerima/menolak pengajuan kirim mandiri seorang anggota. */
export async function putuskanPengajuan(params: {
  status: StatusAnggotaDok
  terima: boolean
  catatan?: string
}): Promise<StatusAnggotaDok> {
  const { status, terima } = params
  const catatanKetua = potong(params.catatan ?? '')
  const pengajuan: StatusPengajuan = terima ? 'diterima' : 'ditolak'
  const now = Date.now()
  await updateDoc(doc(db, 'lms_tugas_kelompok_anggota', status.id), {
    pengajuan,
    catatanKetua,
    diubahMs: now,
  })
  return { ...status, pengajuan, catatanKetua, diubahMs: now }
}

/**
 * Hapus dokumen status milik `siswaIds` pada kelompok ini (best-effort: galat hanya `console.warn`).
 * Hanya dokumen yang TERBUKTI ada (dari hasil kueri) yang dihapus: `deleteDoc` pada dokumen yang
 * tidak ada ditolak rules (resource null; §Tugas.FotoYatim.3) dan memunculkan galat konsol.
 * Anggota yang belum pernah konfirmasi/mengajukan memang tidak punya dokumen status.
 */
export async function hapusStatusKelompok(
  kelompok: TugasKelompokDok,
  siswaIds: string[],
): Promise<void> {
  if (siswaIds.length === 0) return
  try {
    const ada = await daftarStatusAnggota(kelompok.tugasId, kelompok.kelas)
    for (const st of ada) {
      if (st.kelompokId !== kelompok.id || !siswaIds.includes(st.siswaId)) continue
      try {
        await deleteDoc(doc(db, 'lms_tugas_kelompok_anggota', st.id))
      } catch (e) {
        console.warn('hapusStatusKelompok', st.id, e)
      }
    }
  } catch (e) {
    console.warn('hapusStatusKelompok', e)
  }
}

/**
 * Apakah ketua sudah mengirim pengumpulan kelompok? `null` = tidak diketahui (kelompok lama
 * berid acak atau rules belum diperbarui) — UI tidak boleh menampilkan «terkumpul» pada null.
 */
export async function ketuaSudahMengumpulkan(
  kelompok: TugasKelompokDok,
): Promise<boolean | null> {
  if (kelompok.id !== idKelompokBaru(kelompok.tugasId, kelompok.ketuaId)) return null
  try {
    const snap = await getDoc(
      doc(db, 'lms_pengumpulan', idPengumpulan(kelompok.tugasId, kelompok.ketuaId)),
    )
    return snap.exists()
  } catch (e) {
    console.warn('ketuaSudahMengumpulkan', e)
    return null
  }
}

/** Anggota boleh mengunggah sendiri: pengajuan diterima ketua DAN masih tercatat anggota. */
export function punyaIzinMandiri(
  kelompok: TugasKelompokDok | null | undefined,
  status: StatusAnggotaDok | null | undefined,
  siswaId: string,
): boolean {
  return !!kelompok && !!status && status.pengajuan === 'diterima' && kelompok.anggotaIds.includes(siswaId)
}

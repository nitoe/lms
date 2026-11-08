import { getFunctions, httpsCallable } from 'firebase/functions'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { app, auth, db } from './firebase'
import type { KompleksitasSoal, Soal, TipeSoal } from '../types/soal'
import { idAcak } from './soal'

/** Hanya akun ini — harus cocok UID + email sesi Auth. Mirror functions/generateAi.js. */
export const UID_GENERATE_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
export const EMAIL_GENERATE_AI = 'arif.azwar79@gmail.com'

const REGION_FUNGSI = 'asia-southeast2'

/**
 * Kosmetik UI. Yang menjaga kunci Gemini adalah Cloud Function (bolehPemanggilAi).
 * Dicek terhadap sesi Auth aktif, bukan profil Firestore.
 */
export function bolehGenerateSoalAi(uid: string | undefined): boolean {
  if (!uid || uid !== UID_GENERATE_AI) return false
  const sesi = auth.currentUser
  if (!sesi || sesi.uid !== UID_GENERATE_AI) return false
  return (sesi.email ?? '').trim().toLowerCase() === EMAIL_GENERATE_AI
}

function pastikanBerhak() {
  if (!bolehGenerateSoalAi(auth.currentUser?.uid)) {
    throw new Error('Fitur AI soal tidak tersedia untuk akun Anda.')
  }
}

function pesan(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    if (m && m !== 'internal') return m
  }
  return 'Gagal menghubungi layanan AI.'
}

/** Level stimulus teks yang diminta ke AI (Buku Saku: stimulus fungsional, proporsional kelas). */
export type LevelStimulusAi = 'tanpa' | 'ringan' | 'sedang' | 'kaya'

/** Draf soal dari AI (masih bisa diedit sebelum masuk paket). */
export type DrafSoalAi = Soal & {
  butuhGambar?: boolean
  petunjukGambar?: string
}

export async function generateSoalLmsAi(input: {
  mapel: string
  kelas: string
  tpNama?: string
  tpNomor?: number
  tipe: TipeSoal
  kompleksitas: KompleksitasSoal
  /** Selalu 1 untuk alur tinjau-per-soal. */
  jumlah?: number
  konteks?: string
  /** @deprecated pakai levelStimulus */
  butuhStimulus?: boolean
  levelStimulus?: LevelStimulusAi
  /** Wajib true: AI menulis narasi baru, bukan mempertahankan teks kartu. */
  gantiTeks?: boolean
  /** Nonce agar generate ulang berbeda. */
  variasi?: string
  /** Ringkasan soal lain di paket yang harus dihindari. */
  hindariSoal?: string[]
}): Promise<DrafSoalAi[]> {
  pastikanBerhak()
  const panggil = httpsCallable<typeof input & { provider: 'gemini' }, { soal: DrafSoalAi[] }>(
    getFunctions(app, REGION_FUNGSI),
    'generateSoalLmsAi',
  )
  try {
    let levelStimulus = input.levelStimulus
    if (!levelStimulus) {
      levelStimulus = input.butuhStimulus ? 'sedang' : 'tanpa'
    }
    const payload = {
      ...input,
      provider: 'gemini' as const,
      jumlah: 1,
      levelStimulus,
      gantiTeks: input.gantiTeks !== false,
      variasi: input.variasi || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      hindariSoal: Array.isArray(input.hindariSoal) ? input.hindariSoal.slice(0, 15) : undefined,
    }
    const res = await panggil(payload)
    const list = Array.isArray(res.data?.soal) ? res.data.soal : []
    // Pastikan setiap soal punya id unik di klien (server bisa pakai tmp_).
    return list.map((s) => ({ ...s, id: idAcak() }) as DrafSoalAi)
  } catch (e) {
    throw new Error(pesan(e))
  }
}

/** Kompres data URL AI agar muat dokumen lms_gambar (sama batasan unggah manual). */
async function kompresDataUrl(dataUrl: string): Promise<{ data: string; lebar: number; tinggi: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Gambar AI tidak dapat dibaca.'))
    el.src = dataUrl
  })
  const sisiMaks = 1024
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  const skala0 = Math.min(1, sisiMaks / Math.max(w, h, 1))
  w = Math.max(1, Math.round(w * skala0))
  h = Math.max(1, Math.round(h * skala0))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Peramban tidak mendukung kanvas.')

  const sasaran = 280_000
  let skala = 1
  for (let putaran = 0; putaran < 6; putaran++) {
    for (const mutu of [0.85, 0.72, 0.6, 0.48]) {
      canvas.width = Math.max(1, Math.round(w * skala))
      canvas.height = Math.max(1, Math.round(h * skala))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      let out = canvas.toDataURL('image/webp', mutu)
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', mutu)
      if (out.length <= sasaran) {
        return { data: out, lebar: canvas.width, tinggi: canvas.height }
      }
    }
    skala *= 0.78
  }
  throw new Error('Gambar AI terlalu besar setelah kompresi. Coba petunjuk lebih sederhana.')
}

/**
 * Generate ilustrasi fungsional (terpisah dari teks soal), simpan ke lms_gambar, kembalikan id.
 */
export async function generateDanSimpanIlustrasiSoal(input: {
  teksSoal: string
  petunjukGambar?: string
  kelas?: string
  mapel?: string
  targetJawaban?: string
  variasi?: string
}): Promise<string> {
  pastikanBerhak()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sesi berakhir. Silakan masuk lagi.')

  const panggil = httpsCallable<
    typeof input & { provider: 'gemini' },
    { dataUrl: string }
  >(getFunctions(app, REGION_FUNGSI), 'generateIlustrasiSoalLmsAi')

  let dataUrl: string
  try {
    const res = await panggil({
      ...input,
      provider: 'gemini',
      variasi: input.variasi || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    dataUrl = res.data?.dataUrl
  } catch (e) {
    throw new Error(pesan(e))
  }
  if (!dataUrl?.startsWith('data:image/')) {
    throw new Error('AI tidak mengembalikan gambar.')
  }

  const k = await kompresDataUrl(dataUrl)
  const ref = await addDoc(collection(db, 'lms_gambar'), {
    data: k.data,
    lebar: k.lebar,
    tinggi: k.tinggi,
    dibuatOleh: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

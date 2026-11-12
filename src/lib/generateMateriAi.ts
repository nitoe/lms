import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from './firebase'
import { bolehGenerateSoalAi, EMAIL_GENERATE_AI, UID_GENERATE_AI } from './generateSoalAi'
import { teksPolos } from './html'
import { idBaru, unggahDataUrlHalaman } from './materi'
import type { MateriBlok, MateriHalaman } from '../types/materi'

const REGION_FUNGSI = 'asia-southeast2'

/** Sama dengan generate soal AI — UI + server harus cocok UID + email. */
export function bolehGenerateMateriAi(uid: string | undefined): boolean {
  return bolehGenerateSoalAi(uid)
}

export { EMAIL_GENERATE_AI, UID_GENERATE_AI }

function pastikanBerhak() {
  if (!bolehGenerateMateriAi(auth.currentUser?.uid)) {
    throw new Error('Fitur AI materi tidak tersedia untuk akun Anda.')
  }
}

function pesan(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    if (m && m !== 'internal') return m
  }
  return 'Gagal menghubungi layanan AI materi.'
}

/** Blok dari AI sebelum di-merge ke editor (gambar masih berupa petunjuk). */
export type DrafBlokMateriAi =
  | { tipe: 'teks'; html: string; butuhGambar?: boolean; petunjukGambar?: string }
  | {
      tipe: 'gambar'
      butuhGambar: true
      petunjukGambar: string
      caption?: string
    }

export type DrafHalamanMateriAi = {
  judulHalaman?: string
  blok: DrafBlokMateriAi[]
  judulMateri?: string
  deskripsiMateri?: string
}

export type RingkasHalamanUntukAi = {
  judul?: string
  ringkasan: string
}

/** Ringkas halaman untuk konteks generate berikutnya (ANTIREGRESI §115.9). */
export function ringkasHalamanUntukAi(h: MateriHalaman): RingkasHalamanUntukAi {
  const potongan: string[] = []
  for (const b of h.blok || []) {
    if (b.tipe === 'teks' && b.html) {
      const t = teksPolos(b.html)
      if (t) potongan.push(t)
    } else if (b.tipe === 'gambar') {
      potongan.push(b.caption ? `[gambar: ${b.caption}]` : '[gambar]')
    }
  }
  let ringkasan = potongan.join(' ').replace(/\s+/g, ' ').trim()
  if (ringkasan.length > 400) ringkasan = `${ringkasan.slice(0, 397)}…`
  return {
    judul: h.judul?.trim() || undefined,
    ringkasan: ringkasan || '(halaman masih kosong)',
  }
}

export function ringkasHalamanSebelumnya(
  halaman: MateriHalaman[],
  indeksAktif: number,
): RingkasHalamanUntukAi[] {
  if (indeksAktif <= 0) return []
  return halaman.slice(0, indeksAktif).map(ringkasHalamanUntukAi)
}

/**
 * Generate teks satu halaman materi (Cloud Function generateMateriLmsAi).
 * Tidak menghasilkan file gambar — hanya petunjukGambar bila butuh visual.
 */
export async function generateMateriHalamanAi(input: {
  mapel: string
  kelas: string
  tpNama?: string
  tpNomor?: number
  judulMateri?: string
  deskripsiMateri?: string
  indeksHalaman: number
  totalHalaman: number
  judulHalamanSaatIni?: string
  petunjukGuru?: string
  halamanSebelumnya: RingkasHalamanUntukAi[]
  /** true = halaman 0 dan meta masih kosong → AI boleh isi judul/deskripsi materi */
  isiMeta?: boolean
  variasi?: string
}): Promise<DrafHalamanMateriAi> {
  pastikanBerhak()
  const panggil = httpsCallable<
    typeof input & { provider: 'gemini' },
    DrafHalamanMateriAi
  >(getFunctions(app, REGION_FUNGSI), 'generateMateriLmsAi')

  try {
    const res = await panggil({
      ...input,
      provider: 'gemini',
      variasi: input.variasi || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    const data = res.data
    if (!data || !Array.isArray(data.blok) || data.blok.length === 0) {
      throw new Error('AI tidak mengembalikan isi halaman.')
    }
    return data
  } catch (e) {
    throw new Error(pesan(e))
  }
}

/**
 * Ubah draf AI menjadi blok editor.
 * Blok gambar → placeholder tipe gambar (url kosong + petunjukGambar) untuk generate terpisah.
 */
export function drafKeBlokEditor(draf: DrafHalamanMateriAi): {
  judul?: string
  blok: MateriBlok[]
  petunjukGambarMenunggu: { blokId: string; petunjuk: string }[]
} {
  const blok: MateriBlok[] = []
  const petunjukGambarMenunggu: { blokId: string; petunjuk: string }[] = []

  for (const b of draf.blok) {
    if (b.tipe === 'teks' && b.html?.trim()) {
      const id = idBaru('b')
      blok.push({ id, tipe: 'teks', html: b.html })
      if (b.butuhGambar && b.petunjukGambar?.trim()) {
        const gid = idBaru('b')
        const petunjuk = b.petunjukGambar.trim()
        blok.push({
          id: gid,
          tipe: 'gambar',
          url: '',
          petunjukGambar: petunjuk,
        })
        petunjukGambarMenunggu.push({ blokId: gid, petunjuk })
      }
    } else if (b.tipe === 'gambar' && b.petunjukGambar?.trim()) {
      const id = idBaru('b')
      const petunjuk = b.petunjukGambar.trim()
      blok.push({
        id,
        tipe: 'gambar',
        url: '',
        caption: b.caption,
        petunjukGambar: petunjuk,
      })
      petunjukGambarMenunggu.push({ blokId: id, petunjuk })
    }
  }

  if (blok.length === 0) {
    blok.push({ id: idBaru('b'), tipe: 'teks', html: '' })
  }

  return {
    judul: draf.judulHalaman?.trim() || undefined,
    blok,
    petunjukGambarMenunggu,
  }
}

/** Kompres data URL agar muat di Storage (selaras generate ilustrasi soal). */
async function kompresDataUrl(dataUrl: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Gambar AI tidak dapat dibaca.'))
    el.src = dataUrl
  })
  const sisiMaks = 1280
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  const skala0 = Math.min(1, sisiMaks / Math.max(w, h, 1))
  w = Math.max(1, Math.round(w * skala0))
  h = Math.max(1, Math.round(h * skala0))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Peramban tidak mendukung kanvas.')

  const sasaran = 900_000
  let skala = 1
  for (let putaran = 0; putaran < 6; putaran++) {
    for (const mutu of [0.88, 0.75, 0.62, 0.5]) {
      canvas.width = Math.max(1, Math.round(w * skala))
      canvas.height = Math.max(1, Math.round(h * skala))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      let out = canvas.toDataURL('image/webp', mutu)
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', mutu)
      if (out.length <= sasaran) return out
    }
    skala *= 0.78
  }
  throw new Error('Gambar AI terlalu besar setelah kompresi. Sederhanakan petunjuk.')
}

/**
 * Generate ilustrasi materi (callable terpisah dari teks) lalu unggah ke Storage.
 * Tidak mengubah teks halaman.
 */
export async function generateDanSimpanIlustrasiMateri(input: {
  kelas: string
  mapel: string
  petunjukGambar: string
  konteksHalaman?: string
  caption?: string
  variasi?: string
}): Promise<{ url: string; storagePath: string }> {
  pastikanBerhak()
  if (!input.petunjukGambar.trim()) {
    throw new Error('Petunjuk gambar wajib diisi.')
  }

  const panggil = httpsCallable<
    {
      provider: 'gemini'
      petunjukGambar: string
      konteksHalaman?: string
      mapel?: string
      kelas?: string
      variasi?: string
    },
    { dataUrl: string }
  >(getFunctions(app, REGION_FUNGSI), 'generateIlustrasiMateriLmsAi')

  let dataUrl: string
  try {
    const res = await panggil({
      provider: 'gemini',
      petunjukGambar: input.petunjukGambar,
      konteksHalaman: input.konteksHalaman,
      mapel: input.mapel,
      kelas: input.kelas,
      variasi: input.variasi || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    dataUrl = res.data?.dataUrl
  } catch (e) {
    throw new Error(pesan(e))
  }
  if (!dataUrl?.startsWith('data:image/')) {
    throw new Error('AI tidak mengembalikan gambar.')
  }

  const kompres = await kompresDataUrl(dataUrl)
  return unggahDataUrlHalaman(input.kelas, kompres, 'ilustrasi-ai.webp')
}

import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from './firebase'
import { bolehGenerateSoalAi, EMAIL_GENERATE_AI, UID_GENERATE_AI } from './generateSoalAi'
import { teksPolos } from './html'
import type { MateriBlok, MateriHalaman } from '../types/materi'
import { idBaru } from './materi'

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
 * Tidak menghasilkan file gambar — hanya petunjukGambar bila butuh visual (Tahap C).
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
 * Blok gambar tanpa URL → placeholder teks petunjuk (siap diganti generate gambar Tahap C).
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
        petunjukGambarMenunggu.push({ blokId: id, petunjuk: b.petunjukGambar.trim() })
      }
    } else if (b.tipe === 'gambar' && b.petunjukGambar?.trim()) {
      const id = idBaru('b')
      // Placeholder: teks singkat; URL kosong diganti di Tahap C
      blok.push({
        id,
        tipe: 'teks',
        html: `<p><em>[Ilustrasi menunggu generate gambar]</em>${
          b.caption ? ` ${escapeMinimal(b.caption)}` : ''
        }</p><p>${escapeMinimal(b.petunjukGambar)}</p>`,
      })
      petunjukGambarMenunggu.push({ blokId: id, petunjuk: b.petunjukGambar.trim() })
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

function escapeMinimal(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

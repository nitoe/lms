import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { storage } from './firebase'

/**
 * Video bukti tugas (ANTIREGRESI §Tugas.Video).
 *
 * Alur siswa: pilih video → `periksaVideo` (durasi; > 1 menit DITOLAK tanpa konversi) →
 * bila besar, `kompresVideo` (dikecilkan di HP: ±480p, ±0,7 Mbps → ±6 MB/menit) → unggah ke
 * Storage `lms/pengumpulan/{tugasId}/{siswaId}_{slot}.{webm|mp4}` saat «Kumpulkan».
 * Pemeriksaan durasi hanya di klien (rules tidak bisa); ukuran ≤ 15 MB dan tipe dijaga storage.rules.
 */

export const BATAS_DURASI_VIDEO_DETIK = 60
/** Toleransi pembulatan metadata (mis. 60,2 dtk tetap lolos). */
const TOLERANSI_DETIK = 0.6
export const BATAS_UKURAN_VIDEO = 15 * 1024 * 1024
/** Video mp4/webm sekecil ini dipakai apa adanya (tanpa konversi). */
const UKURAN_LANGSUNG = 6 * 1024 * 1024
const BATAS_FILE_ASAL = 600 * 1024 * 1024
const SISI_PENDEK_MAKS = 480
const BITRATE_VIDEO = 700_000
const BITRATE_AUDIO = 64_000
const FPS = 24
/** Unggahan video dianggap macet bila tak ada kemajuan selama ini. */
const BATAS_MACET_UNGGAH_MS = 90_000

export type TipeVideo = 'video/webm' | 'video/mp4'

export type VideoSiap = {
  blob: Blob
  tipe: TipeVideo
  /** Durasi detik (dari video asal). */
  durasi: number
  ukuran: number
}

/** Info berkas yang tersimpan di `lms_pengumpulan.videos[slot]`. */
export type VideoMeta = {
  path: string
  tipe: TipeVideo
  ukuran: number
  durasi: number
}

export function formatDurasi(detik: number): string {
  const d = Math.max(0, Math.round(detik))
  const m = Math.floor(d / 60)
  const s = d % 60
  return m > 0 ? `${m} mnt ${s} dtk` : `${s} dtk`
}

export function formatUkuran(byte: number): string {
  return byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.round(byte / 1024)} KB`
}

export function dukungKonversiVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype &&
    typeof AudioContext !== 'undefined'
  )
}

const PESAN_TAK_BISA_DIBUKA =
  'Video ini tidak bisa dibuka di perangkatmu. Coba rekam ulang, atau kumpulkan dengan foto.'

function tungguEvent(el: HTMLMediaElement, ok: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      bersih()
      reject(new Error(PESAN_TAK_BISA_DIBUKA))
    }, ms)
    const onOk = () => {
      bersih()
      resolve()
    }
    const onErr = () => {
      bersih()
      reject(new Error(PESAN_TAK_BISA_DIBUKA))
    }
    function bersih() {
      window.clearTimeout(t)
      el.removeEventListener(ok, onOk)
      el.removeEventListener('error', onErr)
    }
    el.addEventListener(ok, onOk)
    el.addEventListener('error', onErr)
  })
}

const TIPE_DARI_EKSTENSI: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  mkv: 'video/x-matroska',
}

/**
 * Tipe video: dari `file.type`, atau dari ekstensi bila kosong. Pemilih file Android sering memberi
 * tipe kosong untuk video yang valid (ANTIREGRESI §Kirim.Diagnostik). Kosong = bukan video.
 */
export function tipeVideoDari(file: File): string {
  if (file.type && file.type.startsWith('video/')) return file.type
  if (file.type && !file.type.startsWith('video/') && file.type !== 'application/octet-stream') return ''
  const ext = /\.([a-z0-9]+)$/i.exec(file.name || '')?.[1]?.toLowerCase() ?? ''
  return TIPE_DARI_EKSTENSI[ext] ?? ''
}

/**
 * mp4 kecil berkodek HEVC (H.265, kamera «efisiensi tinggi») bisa diputar di HP tetapi sering hitam di
 * PC guru. Dicari penanda `hvc1`/`hev1` pada byte (hanya untuk berkas ≤ UKURAN_LANGSUNG).
 */
async function mp4Hevc(file: File): Promise<boolean> {
  if (tipeVideoDari(file) !== 'video/mp4' || file.size > UKURAN_LANGSUNG) return false
  try {
    const b = new Uint8Array(await file.arrayBuffer())
    for (let i = 0; i + 4 <= b.length; i++) {
      if (
        b[i] === 0x68 &&
        ((b[i + 1] === 0x76 && b[i + 2] === 0x63 && b[i + 3] === 0x31) ||
          (b[i + 1] === 0x65 && b[i + 2] === 0x76 && b[i + 3] === 0x31))
      ) {
        return true
      }
    }
  } catch {
    /* tak terbaca → anggap bukan HEVC */
  }
  return false
}

export type HasilPeriksa = { durasi: number; lebar: number; tinggi: number; hevc: boolean }

/** Baca durasi & ukuran gambar video. Melempar Error berbahasa siswa bila tak layak (mis. > 1 menit). */
export async function periksaVideo(file: File): Promise<HasilPeriksa> {
  if (!tipeVideoDari(file)) throw new Error('File yang kamu pilih bukan video.')
  if (file.size > BATAS_FILE_ASAL) throw new Error('Video terlalu besar. Rekam video yang lebih pendek (maksimal 1 menit).')
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.src = url
  try {
    await tungguEvent(video, 'loadedmetadata', 15000)
    let durasi = video.duration
    if (!Number.isFinite(durasi)) {
      // Beberapa webm tanpa durasi: paksa loncat ke akhir agar browser menghitung.
      video.currentTime = 1e6
      await tungguEvent(video, 'timeupdate', 8000)
      durasi = video.duration
    }
    if (!Number.isFinite(durasi) || durasi <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error(PESAN_TAK_BISA_DIBUKA)
    }
    if (durasi > BATAS_DURASI_VIDEO_DETIK + TOLERANSI_DETIK) {
      throw new Error(
        `Videomu ${formatDurasi(durasi)}, terlalu panjang. Maksimal 1 menit. Potong atau rekam ulang ya.`,
      )
    }
    return { durasi, lebar: video.videoWidth, tinggi: video.videoHeight, hevc: await mp4Hevc(file) }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

/** Video mp4/webm kecil dipakai apa adanya; selain itu `null` (perlu konversi). */
export function videoLangsung(file: File, durasi: number): VideoSiap | null {
  const tipeAsal = tipeVideoDari(file)
  const tipe = tipeAsal === 'video/mp4' ? 'video/mp4' : tipeAsal === 'video/webm' ? 'video/webm' : null
  if (!tipe || file.size > UKURAN_LANGSUNG) return null
  return { blob: file, tipe, durasi, ukuran: file.size }
}

function pilihMime(): string {
  const kandidat = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  const ok = kandidat.find((m) => MediaRecorder.isTypeSupported(m))
  if (!ok) throw new Error('Perangkat ini belum bisa memperkecil video. Kumpulkan dengan foto ya.')
  return ok
}

function genap(n: number): number {
  const x = Math.max(2, Math.round(n))
  return x % 2 === 0 ? x : x + 1
}

/**
 * Perkecil video di perangkat: putar video asal (kecepatan normal) ke kanvas ±480p lalu rekam ulang
 * dengan MediaRecorder (webm VP9/VP8 + Opus). Lamanya ≈ durasi video. Gagal bila halaman
 * ditinggalkan (tab/aplikasi lain) agar tidak menghasilkan video beku.
 */
export async function kompresVideo(
  file: File,
  onProgress: (bagian: number) => void,
): Promise<VideoSiap> {
  if (!dukungKonversiVideo()) {
    throw new Error('Perangkat ini belum bisa memperkecil video. Kumpulkan dengan foto ya.')
  }
  const mime = pilihMime()
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  let ac: AudioContext | null = null
  let rec: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let kunci: { release: () => Promise<void> } | null = null
  let berhenti = false

  const bersihkan = () => {
    berhenti = true
    try {
      if (rec && rec.state !== 'inactive') rec.stop()
    } catch {
      /* abaikan */
    }
    stream?.getTracks().forEach((t) => t.stop())
    void ac?.close().catch(() => undefined)
    void kunci?.release().catch(() => undefined)
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }

  try {
    await tungguEvent(video, 'loadedmetadata', 15000)
    const durasi = video.duration
    if (!Number.isFinite(durasi) || durasi <= 0) throw new Error(PESAN_TAK_BISA_DIBUKA)
    if (durasi > BATAS_DURASI_VIDEO_DETIK + TOLERANSI_DETIK) {
      throw new Error('Video lebih dari 1 menit. Potong atau rekam ulang ya.')
    }

    const skala = Math.min(1, SISI_PENDEK_MAKS / Math.min(video.videoWidth, video.videoHeight))
    const lebar = genap(video.videoWidth * skala)
    const tinggi = genap(video.videoHeight * skala)
    const kanvas = document.createElement('canvas')
    kanvas.width = lebar
    kanvas.height = tinggi
    const ctx = kanvas.getContext('2d')
    if (!ctx) throw new Error(PESAN_TAK_BISA_DIBUKA)

    // Suara lewat WebAudio (tidak disambung ke speaker → senyap saat konversi).
    ac = new AudioContext()
    const sumber = ac.createMediaElementSource(video)
    const tujuan = ac.createMediaStreamDestination()
    sumber.connect(tujuan)
    await ac.resume().catch(() => undefined)

    stream = new MediaStream([
      ...kanvas.captureStream(FPS).getVideoTracks(),
      ...tujuan.stream.getAudioTracks(),
    ])
    rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: BITRATE_VIDEO,
      audioBitsPerSecond: BITRATE_AUDIO,
    })
    const potongan: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) potongan.push(e.data)
    }

    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      kunci = wl ? await wl.request('screen') : null
    } catch {
      kunci = null
    }

    const hasil = await new Promise<Blob>((resolve, reject) => {
      const batas = window.setTimeout(
        () => reject(new Error('Konversi terlalu lama. Coba lagi atau kumpulkan dengan foto.')),
        (durasi + 40) * 1000,
      )
      const gagal = (pesan: string) => {
        window.clearTimeout(batas)
        document.removeEventListener('visibilitychange', onTersembunyi)
        reject(new Error(pesan))
      }
      const onTersembunyi = () => {
        if (document.hidden) gagal('Konversi terhenti karena kamu meninggalkan halaman. Ulangi dan tunggu sampai selesai ya.')
      }
      document.addEventListener('visibilitychange', onTersembunyi)

      rec!.onstop = () => {
        window.clearTimeout(batas)
        document.removeEventListener('visibilitychange', onTersembunyi)
        resolve(new Blob(potongan, { type: 'video/webm' }))
      }
      rec!.onerror = () => gagal('Video gagal diperkecil. Coba lagi atau kumpulkan dengan foto.')
      video.onerror = () => gagal(PESAN_TAK_BISA_DIBUKA)
      video.onended = () => {
        berhenti = true
        onProgress(1)
        try {
          rec!.stop()
        } catch {
          gagal('Video gagal diperkecil. Coba lagi.')
        }
      }

      const gambar = () => {
        if (berhenti) return
        ctx.drawImage(video, 0, 0, lebar, tinggi)
        onProgress(Math.min(0.99, video.currentTime / durasi))
        jadwal()
      }
      const jadwal = () => {
        if ('requestVideoFrameCallback' in video) {
          ;(video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(gambar)
        } else {
          requestAnimationFrame(gambar)
        }
      }

      rec!.start(1000)
      video.play().then(jadwal).catch(() => {
        gagal('Konversi tidak bisa dimulai. Ketuk «Perkecil video» sekali lagi.')
      })
    })

    if (hasil.size > BATAS_UKURAN_VIDEO) {
      throw new Error('Video masih terlalu besar setelah diperkecil. Rekam video yang lebih pendek.')
    }
    if (hasil.size < 1000) throw new Error('Video gagal diperkecil. Coba lagi atau kumpulkan dengan foto.')
    return { blob: hasil, tipe: 'video/webm', durasi, ukuran: hasil.size }
  } finally {
    bersihkan()
  }
}

/* ───────────────────────── Storage ───────────────────────── */

export function pathVideoTugas(tugasId: string, siswaId: string, slot: number, tipe: TipeVideo): string {
  return `lms/pengumpulan/${tugasId}/${siswaId}_${slot}.${tipe === 'video/mp4' ? 'mp4' : 'webm'}`
}

export async function unggahVideoTugas(
  tugasId: string,
  siswaId: string,
  slot: number,
  v: VideoSiap,
  onProgress: (bagian: number) => void,
): Promise<VideoMeta> {
  const path = pathVideoTugas(tugasId, siswaId, slot, v.tipe)
  const task = uploadBytesResumable(ref(storage, path), v.blob, { contentType: v.tipe })
  await new Promise<void>((resolve, reject) => {
    // Deteksi unggahan macet: sinyal hilang membuat SDK mencoba ulang sampai ±10 menit tanpa kabar,
    // sehingga siswa melihat persen diam. Tanpa kemajuan 90 detik → batalkan dengan kode `storage/stalled`.
    let macet = 0
    const mulaiPantau = () => {
      window.clearTimeout(macet)
      macet = window.setTimeout(() => {
        task.cancel()
        reject(Object.assign(new Error('Unggahan video macet.'), { code: 'storage/stalled' }))
      }, BATAS_MACET_UNGGAH_MS)
    }
    mulaiPantau()
    task.on(
      'state_changed',
      (s) => {
        mulaiPantau()
        onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0)
      },
      (e) => {
        window.clearTimeout(macet)
        reject(e)
      },
      () => {
        window.clearTimeout(macet)
        resolve()
      },
    )
  })
  return { path, tipe: v.tipe, ukuran: v.ukuran, durasi: Math.round(v.durasi) }
}

/** URL putar (siswa pemilik atau guru). Jangan disimpan/dibagikan: berisi token akses. */
export async function urlVideoTugas(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}

export async function hapusVideoTugas(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path))
  } catch (e) {
    console.warn('Hapus video gagal', path, e)
  }
}

export function pathVideoAman(p: unknown): p is string {
  return typeof p === 'string' && p.startsWith('lms/pengumpulan/') && p.length <= 300
}

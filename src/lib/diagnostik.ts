/**
 * Kode diagnostik untuk galat pengiriman/pembacaan media (ANTIREGRESI §Kirim.Diagnostik).
 * Konsol HP siswa tidak bisa dilihat guru, jadi pesan galat di layar membawa ringkasan perangkat
 * yang cukup untuk dilacak dari foto layar. TIDAK memuat data pribadi (nama, kelas, ID).
 */

type NavigatorTambahan = Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }

/** Contoh: «Chrome 79; Android 9; online; 3g». */
export function ringkasPerangkat(): string {
  if (typeof navigator === 'undefined') return 'tanpa-navigator'
  const ua = navigator.userAgent || ''
  let peramban = 'peramban-lain'
  const versi = (re: RegExp) => re.exec(ua)?.[1]?.split('.')[0] ?? '?'
  if (/FBAN|FBAV|FB_IAB/.test(ua)) peramban = 'FacebookApp'
  else if (/Instagram/.test(ua)) peramban = 'Instagram'
  else if (/Line\//.test(ua)) peramban = 'LINE'
  else if (/; wv\)/.test(ua)) peramban = `WebView ${versi(/Chrome\/([\d.]+)/)}`
  else if (/SamsungBrowser\//.test(ua)) peramban = `Samsung ${versi(/SamsungBrowser\/([\d.]+)/)}`
  else if (/EdgA?\//.test(ua)) peramban = `Edge ${versi(/EdgA?\/([\d.]+)/)}`
  else if (/OPR\//.test(ua)) peramban = `Opera ${versi(/OPR\/([\d.]+)/)}`
  else if (/Firefox\//.test(ua)) peramban = `Firefox ${versi(/Firefox\/([\d.]+)/)}`
  else if (/CriOS\//.test(ua)) peramban = `ChromeiOS ${versi(/CriOS\/([\d.]+)/)}`
  else if (/Chrome\//.test(ua)) peramban = `Chrome ${versi(/Chrome\/([\d.]+)/)}`
  else if (/Safari\//.test(ua)) peramban = `Safari ${versi(/Version\/([\d.]+)/)}`

  let os = 'OS?'
  const android = /Android ([\d.]+)/.exec(ua)
  const ios = /(?:iPhone|iPad).*OS (\d+)[._]/.exec(ua)
  if (android) os = `Android ${android[1].split('.')[0]}`
  else if (ios) os = `iOS ${ios[1]}`
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua)) os = 'macOS'

  const net = (navigator as NavigatorTambahan).connection
  const jaringan = net?.effectiveType ? `; ${net.effectiveType}${net.saveData ? '+hemat' : ''}` : ''
  return `${peramban}; ${os}; ${navigator.onLine === false ? 'offline' : 'online'}${jaringan}`
}

/** Kode galat (mis. `unavailable`, `storage/unauthorized`) atau nama galat; kosong bila tak ada. */
export function kodeGalat(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const c = (e as { code?: unknown }).code
    if (typeof c === 'string' && c) return c.replace(/^firestore\//, '')
    const n = (e as { name?: unknown }).name
    if (typeof n === 'string' && n && n !== 'Error') return n
  }
  return ''
}

/** Langkah pengiriman yang gagal (`foto-3`, `video-1`, `meta-baru`, …); kosong bila tak ada. */
export function langkahGalat(e: unknown): string {
  return typeof e === 'object' && e !== null && 'langkahKirim' in e
    ? String((e as { langkahKirim: unknown }).langkahKirim)
    : ''
}

/** Contoh: « (kode: foto-3/unavailable; Chrome 79; Android 9; online; 3g)». */
export function akhiranDiagnostik(e: unknown): string {
  const kode = [langkahGalat(e), kodeGalat(e)].filter(Boolean).join('/')
  return ` (kode: ${kode || 'tanpa-kode'}; ${ringkasPerangkat()})`
}

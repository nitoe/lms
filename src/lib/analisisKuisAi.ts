/**
 * Analisis kuis AI (kelas + per siswa / nilai isian·uraian).
 * Hanya UID + email pemilik AI.
 */
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'

export const UID_ANALISIS_KUIS_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
export const EMAIL_ANALISIS_KUIS_AI = 'arif.azwar79@gmail.com'

export function bolehAnalisisKuisAi(uid: string | undefined): boolean {
  if (!uid || uid !== UID_ANALISIS_KUIS_AI) return false
  const sesi = auth.currentUser
  if (!sesi || sesi.uid !== UID_ANALISIS_KUIS_AI) return false
  return (sesi.email ?? '').trim().toLowerCase() === EMAIL_ANALISIS_KUIS_AI
}

export type HasilAnalisisKuisAi = {
  mode: 'kuis'
  ringkas: string
  kekuatan: string[]
  kelemahan: string[]
  butirBermasalah: { no: number; alasan: string; saran: string }[]
  miskonsepsi: string[]
  tindakLanjutGuru: string[]
  perbaikanSoal: string[]
  meta?: {
    nSiswa: number
    rata100: number
    nSoal: number
    judul?: string
    mapel?: string
    kelas?: string
  }
}

export type PenilaianButirAi = {
  soalId: string
  no: number
  tipe: string
  skor: number
  poinMaks: number
  alasan: string
  pertanyaan?: string
  jawabanSiswa?: string
}

export type HasilAnalisisSiswaAi = {
  mode: 'siswa'
  penilaian: PenilaianButirAi[]
  ringkasSiswa: string
  catatanOrangTua: string
  saranBelajar: string[]
  meta?: {
    jawabanId: string
    siswaNama: string
    percobaan: number
    skorOtomatis: number
    totalPoin: number
    judul?: string
    mapel?: string
    kelas?: string
  }
}

export async function analisisKuisDenganAi(kuisId: string): Promise<HasilAnalisisKuisAi> {
  if (!bolehAnalisisKuisAi(auth.currentUser?.uid)) {
    throw new Error('Analisis AI kuis tidak tersedia untuk akun Anda.')
  }
  const fn = httpsCallable<{ kuisId: string; mode: 'kuis' }, HasilAnalisisKuisAi>(
    functions,
    'analisisKuisLmsAi',
  )
  const res = await fn({ kuisId, mode: 'kuis' })
  return { ...res.data, mode: 'kuis' }
}

export async function analisisSiswaDenganAi(
  kuisId: string,
  jawabanId: string,
): Promise<HasilAnalisisSiswaAi> {
  if (!bolehAnalisisKuisAi(auth.currentUser?.uid)) {
    throw new Error('Analisis AI kuis tidak tersedia untuk akun Anda.')
  }
  const fn = httpsCallable<
    { kuisId: string; mode: 'siswa'; jawabanId: string },
    HasilAnalisisSiswaAi
  >(functions, 'analisisKuisLmsAi')
  const res = await fn({ kuisId, mode: 'siswa', jawabanId })
  return { ...res.data, mode: 'siswa' }
}

/** Unduh laporan sederhana yang bisa dibuka Word (.doc via HTML). */
export function unduhLaporanDoc(opts: {
  namaFile: string
  judul: string
  htmlBody: string
}) {
  const aman = opts.namaFile.replace(/[^\w.\-()\s\u00C0-\u024F]+/g, '_').slice(0, 80)
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.judul)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; }
  h1 { font-size: 16pt; color: #282768; }
  h2 { font-size: 12pt; color: #313083; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  th { background: #eff0fa; text-align: left; }
  .meta { color: #64748b; font-size: 10pt; margin-bottom: 12px; }
  ul { margin: 6px 0 12px 18px; }
</style>
</head>
<body>
${opts.htmlBody}
</body>
</html>`
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = aman.endsWith('.doc') ? aman : `${aman}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function htmlLaporanKuis(h: HasilAnalisisKuisAi): string {
  const m = h.meta
  const li = (arr: string[]) =>
    arr.length ? `<ul>${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p>—</p>'
  const butir =
    h.butirBermasalah.length > 0
      ? `<table><tr><th>No</th><th>Alasan</th><th>Saran</th></tr>${h.butirBermasalah
          .map(
            (b) =>
              `<tr><td>${b.no}</td><td>${escapeHtml(b.alasan)}</td><td>${escapeHtml(b.saran)}</td></tr>`,
          )
          .join('')}</table>`
      : '<p>—</p>'
  return `
<h1>Analisis hasil kuis</h1>
<p class="meta">${escapeHtml(m?.judul || '')} · ${escapeHtml(m?.mapel || '')} · kelas ${escapeHtml(m?.kelas || '')}<br/>
${m?.nSiswa ?? '—'} siswa · rata-rata ${m?.rata100 ?? '—'}/100 · ${m?.nSoal ?? '—'} soal</p>
<h2>Ringkasan</h2>
<p>${escapeHtml(h.ringkas)}</p>
<h2>Kekuatan</h2>${li(h.kekuatan)}
<h2>Kelemahan</h2>${li(h.kelemahan)}
<h2>Butir bermasalah</h2>${butir}
<h2>Miskonsepsi</h2>${li(h.miskonsepsi)}
<h2>Tindak lanjut guru</h2>${li(h.tindakLanjutGuru)}
<h2>Perbaikan soal</h2>${li(h.perbaikanSoal)}
`
}

export function htmlLaporanSiswa(h: HasilAnalisisSiswaAi): string {
  const m = h.meta
  const li = (arr: string[]) =>
    arr.length ? `<ul>${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p>—</p>'
  const rows = h.penilaian
    .map(
      (p) => `<tr>
<td>${p.no}</td>
<td>${escapeHtml(p.tipe)}</td>
<td>${escapeHtml((p.pertanyaan || '').slice(0, 120))}</td>
<td>${escapeHtml((p.jawabanSiswa || '').slice(0, 200))}</td>
<td>${p.skor} / ${p.poinMaks}</td>
<td>${escapeHtml(p.alasan)}</td>
</tr>`,
    )
    .join('')
  return `
<h1>Laporan penilaian siswa (AI)</h1>
<p class="meta">${escapeHtml(m?.siswaNama || '')} · percobaan #${m?.percobaan ?? '—'}<br/>
${escapeHtml(m?.judul || '')} · ${escapeHtml(m?.mapel || '')} · kelas ${escapeHtml(m?.kelas || '')}</p>
<h2>Ringkasan untuk guru</h2>
<p>${escapeHtml(h.ringkasSiswa)}</p>
<h2>Catatan untuk orang tua</h2>
<p>${escapeHtml(h.catatanOrangTua)}</p>
<h2>Saran belajar</h2>${li(h.saranBelajar)}
<h2>Penilaian isian &amp; uraian</h2>
<table>
<tr><th>No</th><th>Tipe</th><th>Soal</th><th>Jawaban</th><th>Skor</th><th>Alasan</th></tr>
${rows}
</table>
`
}

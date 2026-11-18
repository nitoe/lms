/**
 * Kartu peserta Lomba — cetak A4, 8 kartu per lembar (2 kolom × 4 baris, tiap kartu 97 × 70,1 mm).
 *
 * Isi kartu: identitas lomba, nama, kelas, NISN (= kata sandi login siswa), alamat LMS, cara masuk.
 * Dibuka di jendela baru (pola sama dengan cetakKuisPdf): jendela dibuka SINKRON di awal klik
 * lalu diisi setelah data siap. ANTIREGRESI §Lomba.29 — jangan memindahkan `window.open` ke
 * setelah `await`, jangan menyimpan NISN ke dokumen `lms_lomba`.
 */

import { doc, getDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import type { Lomba, PesertaLomba } from '../types/lomba'
import { TINGKAT_LOMBA } from '../types/lomba'

/** Alamat publik LMS (bukan window.location.origin: domain preview/web.app berbeda). */
export const DOMAIN_LMS_PUBLIK = 'lms.sdmuhammadiyah01kks.sch.id'
/** Halaman masuk siswa; «/» mengarah ke login staf. */
export const PATH_MASUK_SISWA = '/siswa/masuk'
export const KARTU_PER_HALAMAN = 8
const NAMA_SEKOLAH = 'SD Muhammadiyah 01 Kukusan'

export interface OpsiKartuLomba {
  /** ID peserta yang dicetak; kosong/undefined = semua peserta. */
  pesertaIds?: string[]
  /** Teks bebas pelaksanaan, mis. «Sabtu, 22 Nov 2026 · 07.30 · Aula». Kosong = pakai masa lomba. */
  jadwal?: string
  /** Mis. «2026/2027». Kosong = dihitung otomatis. */
  tahunPelajaran?: string
  /** Sisakan kotak foto 2×3 untuk ditempel. */
  kotakFoto?: boolean
}

export interface PesertaBernomor extends PesertaLomba {
  no: number
}

export interface DataKartu {
  no: number
  nama: string
  kelas: string
  nisn: string
  nonaktif: boolean
}

export interface HasilCetakKartu {
  jumlah: number
  lembar: number
  tanpaNisn: string[]
  nonaktif: string[]
}

/** Urut kelas (1A…6B) lalu nama; nomor kartu menetap menurut urutan seluruh peserta. */
export function susunPesertaBernomor(list: PesertaLomba[]): PesertaBernomor[] {
  return [...list]
    .sort(
      (a, b) =>
        a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
        a.nama.localeCompare(b.nama, 'id'),
    )
    .map((p, i) => ({ ...p, no: i + 1 }))
}

export function tahunPelajaranOtomatis(acuan: Date = new Date()): string {
  const y = acuan.getFullYear()
  // Tahun pelajaran dimulai Juli.
  return acuan.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tgl(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function teksMasa(l: Lomba): string {
  if (l.mulai && l.selesai) {
    return l.mulai.toDateString() === l.selesai.toDateString()
      ? tgl(l.mulai)
      : `${tgl(l.mulai)} – ${tgl(l.selesai)}`
  }
  if (l.mulai) return `Mulai ${tgl(l.mulai)}`
  if (l.selesai) return `Sampai ${tgl(l.selesai)}`
  return ''
}

async function muatLogo(): Promise<string> {
  try {
    const r = await fetch('/logo-sdm.png', { cache: 'force-cache' })
    if (!r.ok) return ''
    const b = await r.blob()
    // SPA fallback bisa mengembalikan index.html (200) bila berkas hilang.
    if (!b.type.startsWith('image/')) return ''
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.onerror = () => rej(fr.error)
      fr.readAsDataURL(b)
    })
  } catch (e) {
    console.warn('kartuLomba: logo tidak dapat dimuat', e)
    return ''
  }
}

/**
 * NISN dibaca langsung dari `siswa/{id}` saat cetak (sumber sama dengan login siswa).
 * Nama/kelas ikut disegarkan agar kartu sama dengan daftar di halaman masuk.
 */
async function muatDataKartu(list: PesertaBernomor[]): Promise<DataKartu[]> {
  return Promise.all(
    list.map(async (p) => {
      let nama = p.nama
      let kelas = p.kelas
      let nisn = ''
      let nonaktif = false
      try {
        const s = await getDoc(doc(db, 'siswa', p.id))
        if (s.exists()) {
          const d = s.data()
          nisn = String(d.nisn ?? '').trim()
          nama = String(d.nama ?? '').trim() || nama
          kelas = String(d.kelas ?? '').trim() || kelas
          nonaktif = d.aktif === false
        }
      } catch (e) {
        console.warn('kartuLomba: gagal membaca siswa', p.id, e)
      }
      if (!nisn && typeof p.nisn === 'string') nisn = p.nisn.trim()
      return { no: p.no, nama, kelas, nisn, nonaktif }
    }),
  )
}

const CSS = `
@page { size: A4 portrait; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
body {
  font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif;
  color: #1e293b; background: #e5e7eb;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.no-print { font-size: 13px }
.bar {
  position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px;
  justify-content: space-between; padding: 10px 16px; background: #7c2d12; color: #fff;
}
.bar strong { display: block; font-size: 14px }
.bar span { font-size: 12px; opacity: .85 }
.bar button {
  border: 0; border-radius: 999px; padding: 9px 20px; font: 700 13px inherit;
  background: #fff; color: #9a3412; cursor: pointer;
}
.info { max-width: 210mm; margin: 10px auto; padding: 0 12px; color: #475569; line-height: 1.5 }
.info.warn { color: #9a3412; background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 8px 12px }
.info.warn ul { margin: 4px 0 0; padding-left: 18px }
.lembar {
  width: 210mm; height: 296.5mm; padding: 8mm; margin: 0 auto 8mm; background: #fff;
  display: grid; grid-template-columns: 97mm 97mm; grid-template-rows: repeat(4, 70.1mm);
  overflow: hidden; break-after: page; page-break-after: always;
  box-shadow: 0 2px 12px rgba(0,0,0,.18);
}
.kartu {
  width: 97mm; height: 70.1mm; padding: 1.5mm; border: .25mm dashed #6b7280; overflow: hidden;
}
.kartu:nth-child(even) { border-left: none }
.kartu:nth-child(n+3) { border-top: none }
.isi {
  height: 100%; display: flex; flex-direction: column; overflow: hidden;
  border: .35mm solid #c2410c; border-radius: 2.2mm; background: #fff;
}
.kepala {
  display: flex; align-items: center; gap: 2mm; padding: 1.5mm 2.2mm;
  background: #fff7ed; border-top: 1.2mm solid #c2410c; border-bottom: .3mm solid #fdba74;
}
.logo { flex: none; height: 11mm; max-width: 11mm; object-fit: contain }
.judul { flex: 1; min-width: 0 }
.atas { font-size: 5.8pt; font-weight: 700; letter-spacing: .14em; color: #9a3412; text-transform: uppercase }
.lomba {
  font-size: 9.5pt; font-weight: 800; line-height: 1.15; color: #0f172a;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sub { font-size: 6.2pt; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.nomor {
  flex: none; text-align: center; line-height: 1; padding: .7mm 2.2mm;
  border: .3mm solid #c2410c; border-radius: 1.6mm; color: #9a3412; background: #fff;
}
.nomor span { display: block; font-size: 5.2pt; font-weight: 700; letter-spacing: .12em }
.nomor b { display: block; font-size: 13pt; font-weight: 800; margin-top: .3mm }
.data { display: flex; gap: 2.5mm; padding: 1.6mm 2.4mm 0; flex: 1; min-height: 0 }
.data table { flex: 1; min-width: 0; border-collapse: collapse; table-layout: fixed }
.data td { padding: .3mm 0; vertical-align: top; font-size: 7pt; line-height: 1.2 }
.data td.l { width: 17.5mm; color: #64748b; font-weight: 600 }
.data td.t { width: 2mm; color: #94a3b8 }
.data td.v { font-weight: 600; color: #0f172a; overflow: hidden }
.data td.v.nama { font-size: 9.6pt; font-weight: 800; line-height: 1.15 }
.data td.v.sat { white-space: nowrap; text-overflow: ellipsis }
.sandi {
  display: inline-block; padding: .2mm 1.6mm; border: .3mm dashed #c2410c; border-radius: 1mm;
  background: #fff7ed; font-family: 'Courier New', Consolas, monospace; font-size: 10pt;
  font-weight: 800; letter-spacing: .12em; color: #0f172a;
}
.sandi.kosong { font-family: inherit; font-size: 6.4pt; letter-spacing: 0; color: #b91c1c; border-color: #b91c1c; background: #fef2f2 }
.foto {
  flex: none; width: 16.5mm; height: 22mm; display: flex; align-items: center; justify-content: center;
  text-align: center; border: .3mm dashed #94a3b8; border-radius: 1mm; font-size: 5.6pt; color: #94a3b8; line-height: 1.3;
}
.masuk { margin: 1.2mm 2.4mm 0; padding: 1.1mm 2mm; border: .25mm solid #cbd5e1; border-radius: 1.4mm; background: #f8fafc }
.masuk .mj { font-size: 5.6pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #9a3412 }
.masuk .url { font-family: 'Courier New', Consolas, monospace; font-size: 7.6pt; font-weight: 800; color: #0f172a; margin: .2mm 0 .3mm; white-space: nowrap }
.masuk .lk { font-size: 6.2pt; line-height: 1.3; color: #334155 }
.kaki { display: flex; justify-content: space-between; gap: 2mm; padding: .9mm 2.4mm 1.2mm; font-size: 5.5pt; color: #64748b }
@media print {
  body { background: #fff }
  .no-print { display: none !important }
  .lembar { margin: 0; box-shadow: none }
  .lembar:last-child { break-after: auto; page-break-after: auto }
}
`

function htmlKartu(d: DataKartu, l: Lomba, o: Required<Pick<OpsiKartuLomba, 'kotakFoto'>> & {
  logo: string
  tahun: string
  pelaksanaan: string
  mapel: string
  tingkat: string
}): string {
  const nomor = String(d.no).padStart(2, '0')
  const sub = [l.identitas?.trim() || NAMA_SEKOLAH, o.tingkat].filter(Boolean).join(' · ')
  const baris: string[] = [
    `<tr><td class="l">Nama</td><td class="t">:</td><td class="v nama">${esc(d.nama)}</td></tr>`,
    `<tr><td class="l">Kelas</td><td class="t">:</td><td class="v">${esc(d.kelas)}</td></tr>`,
    `<tr><td class="l">NISN (sandi)</td><td class="t">:</td><td class="v">${
      d.nisn
        ? `<span class="sandi">${esc(d.nisn)}</span>`
        : '<span class="sandi kosong">Belum terdaftar — hubungi admin</span>'
    }</td></tr>`,
  ]
  if (o.pelaksanaan) {
    baris.push(
      `<tr><td class="l">Pelaksanaan</td><td class="t">:</td><td class="v">${esc(o.pelaksanaan)}</td></tr>`,
    )
  }
  if (o.mapel) {
    baris.push(`<tr><td class="l">Mapel</td><td class="t">:</td><td class="v sat">${esc(o.mapel)}</td></tr>`)
  }
  return (
    `<div class="kartu"><div class="isi">` +
    `<div class="kepala">` +
    (o.logo ? `<img class="logo" src="${o.logo}" alt="" />` : '') +
    `<div class="judul"><div class="atas">Kartu Peserta Lomba</div>` +
    `<div class="lomba">${esc(l.nama)}</div><div class="sub">${esc(sub)}</div></div>` +
    `<div class="nomor"><span>NO.</span><b>${nomor}</b></div>` +
    `</div>` +
    `<div class="data"><table>${baris.join('')}</table>` +
    (o.kotakFoto ? `<div class="foto">Foto 2×3</div>` : '') +
    `</div>` +
    `<div class="masuk"><div class="mj">Cara masuk LMS</div>` +
    `<div class="url">${esc(DOMAIN_LMS_PUBLIK + PATH_MASUK_SISWA)}</div>` +
    `<div class="lk">1. Buka alamat di atas. 2. Pilih kelas dan namamu. 3. Kata sandi = NISN.</div></div>` +
    `<div class="kaki"><span>${esc(NAMA_SEKOLAH)} · TP ${esc(o.tahun)}</span>` +
    `<span>Simpan kartu &amp; jangan bagikan NISN</span></div>` +
    `</div></div>`
  )
}

/** Susun dokumen HTML lengkap (murni, tanpa efek samping — mudah diuji). */
export function susunHtmlKartu(
  lomba: Lomba,
  data: DataKartu[],
  opsi: OpsiKartuLomba,
  logo: string,
): { html: string; lembar: number } {
  const tahun = opsi.tahunPelajaran?.trim() || tahunPelajaranOtomatis(lomba.mulai ?? new Date())
  const pelaksanaan = opsi.jadwal?.trim() || teksMasa(lomba)
  const tingkat = TINGKAT_LOMBA.find((x) => x.value === lomba.tingkat)?.label ?? ''
  const p = {
    logo,
    tahun,
    pelaksanaan,
    mapel: lomba.mapelTerkait.join(', '),
    tingkat,
    kotakFoto: !!opsi.kotakFoto,
  }
  const halaman: string[] = []
  for (let i = 0; i < data.length; i += KARTU_PER_HALAMAN) {
    const isi = data
      .slice(i, i + KARTU_PER_HALAMAN)
      .map((d) => htmlKartu(d, lomba, p))
      .join('')
    halaman.push(`<section class="lembar">${isi}</section>`)
  }
  const tanpaNisn = data.filter((d) => !d.nisn).map((d) => d.nama)
  const nonaktif = data.filter((d) => d.nonaktif).map((d) => d.nama)
  const peringatan =
    tanpaNisn.length || nonaktif.length
      ? `<div class="info warn no-print"><strong>Perlu diperiksa sebelum dicetak</strong><ul>` +
        (tanpaNisn.length ? `<li>NISN belum terdaftar: ${esc(tanpaNisn.join(', '))}</li>` : '') +
        (nonaktif.length ? `<li>Siswa nonaktif (tidak bisa masuk LMS): ${esc(nonaktif.join(', '))}</li>` : '') +
        `</ul></div>`
      : ''
  const html =
    `<!doctype html><html lang="id"><head><meta charset="utf-8" />` +
    `<title>Kartu Peserta — ${esc(lomba.nama)}</title><style>${CSS}</style></head><body>` +
    `<div class="bar no-print"><div><strong>Kartu peserta — ${esc(lomba.nama)}</strong>` +
    `<span>${data.length} kartu · ${halaman.length} lembar A4 (8 kartu per lembar)</span></div>` +
    `<button type="button" onclick="window.print()">Cetak / Simpan PDF</button></div>` +
    `<div class="info no-print">Pengaturan cetak: kertas <b>A4</b>, skala <b>100%</b> (Actual size), margin <b>None</b>, ` +
    `matikan <b>Headers and footers</b>. Potong mengikuti garis putus-putus.</div>` +
    peringatan +
    `<main>${halaman.join('')}</main></body></html>`
  return { html, lembar: halaman.length }
}

/**
 * Buka jendela cetak kartu. WAJIB dipanggil langsung dari handler klik (window.open sinkron
 * sebelum await pertama). Galat dilempar sebagai Error berpesan bahasa Indonesia.
 */
export async function cetakKartuPeserta(
  lomba: Lomba,
  opsi: OpsiKartuLomba = {},
): Promise<HasilCetakKartu> {
  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi.')
  }
  try {
    w.document.title = 'Menyiapkan kartu…'
    w.document.body.innerHTML =
      '<p style="font:14px Arial,sans-serif;padding:24px">Menyiapkan kartu peserta…</p>'

    if (!isFirebaseConfigured) throw new Error('Firebase belum dikonfigurasi.')
    const semua = susunPesertaBernomor(lomba.siswaList)
    const pilih = opsi.pesertaIds ? new Set(opsi.pesertaIds) : null
    const terpilih = pilih ? semua.filter((p) => pilih.has(p.id)) : semua
    if (terpilih.length === 0) throw new Error('Tidak ada peserta yang dipilih.')

    const [data, logo] = await Promise.all([muatDataKartu(terpilih), muatLogo()])
    const { html, lembar } = susunHtmlKartu(lomba, data, opsi, logo)
    w.document.open()
    w.document.write(html)
    w.document.close()
    return {
      jumlah: data.length,
      lembar,
      tanpaNisn: data.filter((d) => !d.nisn).map((d) => d.nama),
      nonaktif: data.filter((d) => d.nonaktif).map((d) => d.nama),
    }
  } catch (e) {
    try {
      w.close()
    } catch {
      /* ignore */
    }
    throw e instanceof Error ? e : new Error('Gagal menyiapkan kartu peserta.')
  }
}

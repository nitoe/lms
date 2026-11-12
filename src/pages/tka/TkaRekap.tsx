import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  EMAIL_AKSES_KHUSUS_TKA,
  LABEL_MAPEL_TKA,
  MAPEL_TKA,
  adalahAdminTka,
  bolehAksesTkaStaf,
  bolehPublishTkaOrtu,
  kelasRekapTkaBolehDilihat,
  type MapelTkaNama,
} from '../../lib/tkaAkses'
import { bangunRekapTka } from '../../lib/rekapTka'
import {
  hitungRataRata,
  mapelUntukRata,
  muatStatusPublikasi,
  publikasikanTkaOrtu,
  tarikPublikasiTkaOrtu,
} from '../../lib/tkaPublikasi'
import { KKM_TKA } from '../../lib/sebaranTka'
import { blobCsv, blobXlsx, unduhBlob } from '../../lib/exportTabel'
import {
  namaBerkasTka,
  susunBerkasTka,
  susunLembarMapel,
  susunLembarRekap,
} from '../../lib/exportRekapTka'
import type { NilaiOrtuTka, TkaPublikasiDok } from '../../types/tkaPublikasi'
import {
  DAFTAR_TAHAP_TRYOUT_TKA,
  NAMA_TAHAP_TRYOUT_TKA,
  type TahapTryOutTka,
} from '../../types/kuis'
import type { BarisRekapTka, SelNilaiTka } from '../../types/rekapTka'
import type { KuisLms } from '../../types/kuis'
import TkaRekapMapel from './TkaRekapMapel'
import '../../styles/tka.css'

const LABEL_SINGKAT: Record<MapelTkaNama, string> = {
  'TKA Bahasa Indonesia': 'BI',
  'TKA Matematika': 'MTK',
  'TKA IPA': 'IPA',
}

const KUNCI_ORTU: Record<MapelTkaNama, 'BI' | 'MTK' | 'IPA'> = {
  'TKA Bahasa Indonesia': 'BI',
  'TKA Matematika': 'MTK',
  'TKA IPA': 'IPA',
}

/** Urutan tab: tiap mapel (nilai + sebaran) → rekap nilai akhir → publikasi portal. */
type TabRekap = MapelTkaNama | 'rekap' | 'publikasi'

function teksNilai(sel: SelNilaiTka | undefined): string {
  if (!sel || sel.nilai == null) return '—'
  const n = sel.nilai
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

function teksAngka(n: number | null): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

function nilaiOrtu(r: BarisRekapTka): NilaiOrtuTka {
  return {
    BI: r.perMapel['TKA Bahasa Indonesia']?.nilai ?? null,
    MTK: r.perMapel['TKA Matematika']?.nilai ?? null,
    IPA: r.perMapel['TKA IPA']?.nilai ?? null,
  }
}

export default function TkaRekap() {
  const { user, profil } = useAuth()
  const boleh = bolehAksesTkaStaf(user, profil)
  const kelasIzin = useMemo(() => kelasRekapTkaBolehDilihat(user, profil), [user, profil])
  const adminTka = adalahAdminTka(user, profil)

  const [tab, setTab] = useState<TabRekap>('TKA Matematika')
  const [tahap, setTahap] = useState<TahapTryOutTka>('I')
  const [kelasFilter, setKelasFilter] = useState<string>('semua')
  const [baris, setBaris] = useState<BarisRekapTka[] | null>(null)
  const [kuisPerMapel, setKuisPerMapel] = useState<Record<MapelTkaNama, KuisLms[]> | null>(null)
  const [peringatanSebaran, setPeringatanSebaran] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [statusPub, setStatusPub] = useState<Record<string, TkaPublikasiDok | null>>({})
  const [busyPub, setBusyPub] = useState(false)
  const [catatanOrtu, setCatatanOrtu] = useState('')
  const [kelasPublish, setKelasPublish] = useState<string>('')

  const muat = useCallback(async () => {
    if (!boleh || kelasIzin.length === 0) return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const hasilRekap = await bangunRekapTka({
        tahap,
        kelasList: kelasIzin,
      })
      setBaris(hasilRekap.baris)
      setKuisPerMapel(hasilRekap.kuisPerMapel)
      setPeringatanSebaran(hasilRekap.peringatanSebaran || [])
      const peringatanManual = hasilRekap.peringatanManual || []
      if (peringatanManual.length) {
        setError(peringatanManual.join(' · '))
      }
      // Status publikasi portal per kelas izin
      const st: Record<string, TkaPublikasiDok | null> = {}
      await Promise.all(
        kelasIzin.map(async (k) => {
          st[k] = await muatStatusPublikasi(k, tahap)
        }),
      )
      setStatusPub(st)
      if (!kelasPublish || !kelasIzin.includes(kelasPublish)) {
        setKelasPublish(kelasIzin[0] || '')
      }
    } catch (e) {
      setBaris(null)
      setError(e instanceof Error ? e.message : 'Gagal memuat rekap.')
    } finally {
      setLoading(false)
    }
  }, [boleh, kelasIzin, tahap])

  useEffect(() => {
    void muat()
  }, [muat])

  const tampil = useMemo(() => {
    if (!baris) return []
    if (kelasFilter === 'semua') return baris
    return baris.filter((r) => r.kelas === kelasFilter)
  }, [baris, kelasFilter])

  const ringkas = useMemo(() => {
    const avg = (mapel: MapelTkaNama) => {
      const vals = tampil
        .map((r) => r.perMapel[mapel]?.nilai)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
      if (!vals.length) return null
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    }
    return {
      jumlah: tampil.length,
      bi: avg('TKA Bahasa Indonesia'),
      mtk: avg('TKA Matematika'),
      ipa: avg('TKA IPA'),
    }
  }, [tampil])

  /** Ringkasan kesiapan publikasi untuk kelas yang dipilih. */
  const kesiapan = useMemo(() => {
    const k = kelasPublish || kelasIzin[0] || ''
    const rows = (baris ?? []).filter((r) => String(r.kelas).toUpperCase() === k)
    return {
      kelas: k,
      jumlah: rows.length,
      perMapel: MAPEL_TKA.map((m) => ({
        mapel: m,
        nilai: rows.filter((r) => r.perMapel[m]?.nilai != null).length,
        sebaran: rows.filter((r) => r.perMapel[m]?.sebaran != null).length,
      })),
      wajib: mapelUntukRata(tahap),
    }
  }, [baris, kelasPublish, kelasIzin, tahap])

  /** Ekspor ke Excel (semua lembar) atau CSV (tab yang sedang dibuka). Mengikuti filter tahap & kelas. */
  function ekspor(format: 'xlsx' | 'csv') {
    if (!baris || tampil.length === 0) return
    setError('')
    try {
      const kelasLabel = kelasFilter === 'semua' ? kelasIzin.join(' + ') : kelasFilter
      const rata = (r: BarisRekapTka) => hitungRataRata(nilaiOrtu(r), tahap)
      if (format === 'xlsx') {
        const lembar = susunBerkasTka({ baris: tampil, tahap, kelasLabel, rata })
        unduhBlob(blobXlsx(lembar), namaBerkasTka(tahap, kelasLabel, 'xlsx'))
        setInfo(`Excel diunduh: ${lembar.length} lembar, ${tampil.length} siswa (${kelasLabel}).`)
        return
      }
      const mapelTab = (MAPEL_TKA as readonly string[]).includes(tab) ? (tab as MapelTkaNama) : null
      const lembar = mapelTab ? susunLembarMapel(tampil, mapelTab) : susunLembarRekap(tampil, rata)
      unduhBlob(
        blobCsv(lembar),
        namaBerkasTka(tahap, kelasLabel, 'csv', mapelTab ? LABEL_MAPEL_TKA[mapelTab] : 'nilai-akhir'),
      )
      setInfo(`CSV diunduh: ${lembar.nama}, ${tampil.length} siswa (${kelasLabel}).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengekspor.')
    }
  }

  async function handlePublish() {
    const k = kelasPublish || kelasIzin[0]
    if (!k || !bolehPublishTkaOrtu(user, profil, k)) {
      setError('Anda tidak berwenang mempublikasikan kelas ini.')
      return
    }
    if (
      !window.confirm(
        `Publikasikan Try Out tahap ${tahap} kelas ${k} ke portal orang tua?\n` +
          `Nilai dan sebaran capaian disalin (snapshot). Ranking 10 besar dihitung dari gabungan 6A+6B.`,
      )
    ) {
      return
    }
    setBusyPub(true)
    setError('')
    setInfo('')
    try {
      const hasil = await publikasikanTkaOrtu({
        kelas: k,
        tahap,
        catatanOrtu,
        namaGuru: profil?.nama,
      })
      setInfo(
        `Dipublikasikan: ${hasil.jumlahSiswa} siswa kelas ${k}. ` +
          `Peserta ranking gabungan 6A+6B: ${hasil.jumlahRanking}.`,
      )
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mempublikasikan.')
    } finally {
      setBusyPub(false)
    }
  }

  async function handleTarik() {
    const k = kelasPublish || kelasIzin[0]
    if (!k || !bolehPublishTkaOrtu(user, profil, k)) {
      setError('Anda tidak berwenang menarik publikasi kelas ini.')
      return
    }
    if (!window.confirm(`Tarik publikasi tahap ${tahap} kelas ${k} dari portal orang tua?`)) return
    setBusyPub(true)
    setError('')
    setInfo('')
    try {
      await tarikPublikasiTkaOrtu({ kelas: k, tahap, namaGuru: profil?.nama })
      setInfo(`Publikasi kelas ${k} tahap ${tahap} ditarik.`)
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menarik publikasi.')
    } finally {
      setBusyPub(false)
    }
  }

  if (!boleh) {
    return (
      <div className="lms-empty">
        <p className="font-medium text-slate-700">Akses TKA terbatas</p>
        <p className="mt-1 text-sm text-slate-600">
          Rekap ini hanya untuk wali kelas 6A/6B atau akun uji sistem.
        </p>
        <Link to="/tka" className="mt-3 inline-block text-sm font-semibold text-muh-600 hover:underline">
          ← Kembali ke TKA
        </Link>
      </div>
    )
  }

  const tabList: { id: TabRekap; label: string }[] = [
    ...MAPEL_TKA.map((m) => ({ id: m as TabRekap, label: LABEL_MAPEL_TKA[m] })),
    { id: 'rekap', label: 'Rekap nilai akhir' },
    { id: 'publikasi', label: 'Publikasi ke portal' },
  ]

  return (
    <div className="tka-rekap space-y-4">
      <div className="tka-rekap-header">
        <div>
          <Link to="/tka" className="tka-rekap-breadcrumb">
            ← Dashboard TKA
          </Link>
          <h1 className="tka-rekap-title">Rekap Nilai Try Out TKA</h1>
          <p className="tka-rekap-sub">
            Per mata pelajaran: nilai akhir + sebaran kompetensi. Otomatis dari kuis LMS dengan tahap
            yang sama; bisa diisi/diimpor manual jika try out di luar LMS.
          </p>
        </div>
        <div className="tka-rekap-ekspor">
          <button
            type="button"
            className="lms-btn-secondary text-sm"
            disabled={loading || !baris || tampil.length === 0}
            onClick={() => ekspor('xlsx')}
            title="Semua lembar: rekap nilai akhir, tiap mata pelajaran (dengan sebaran kompetensi), keterangan"
          >
            Unduh Excel
          </button>
          <button
            type="button"
            className="lms-btn-secondary text-sm"
            disabled={loading || !baris || tampil.length === 0}
            onClick={() => ekspor('csv')}
            title="Tab yang sedang dibuka · titik koma, UTF-8 (siap dibuka di Excel Indonesia)"
          >
            Unduh CSV
          </button>
          <button
            type="button"
            className="lms-btn-secondary text-sm"
            disabled={loading}
            onClick={() => void muat()}
          >
            {loading ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
      </div>

      <div className="tka-rekap-meta-row">
        <div className="tka-rekap-akses">
          {adminTka ? (
            <p>
              Akses <strong>admin TKA</strong> ({EMAIL_AKSES_KHUSUS_TKA}): rekap siswa{' '}
              <strong>6A dan 6B</strong>.
            </p>
          ) : (
            <p>
              Rekap terbatas pada kelas yang Anda wali:{' '}
              <strong>{kelasIzin.join(', ') || '—'}</strong>. Guru 6A tidak melihat siswa 6B, dan
              sebaliknya.
            </p>
          )}
        </div>
        <div className="tka-rekap-hint-manual" role="note">
          Try out tidak lewat LMS? Isi nilai lewat tombol <strong>+ Isi manual</strong> pada tab mata
          pelajaran, atau impor lewat alat import admin.
        </div>
      </div>

      <div className="tka-rekap-controls">
        <div className="tka-rekap-toolbar">
          <label className="tka-rekap-field">
            <span>Tahap Try Out</span>
            <select
              value={tahap}
              onChange={(e) => setTahap(e.target.value as TahapTryOutTka)}
              className="lms-input"
            >
              {DAFTAR_TAHAP_TRYOUT_TKA.map((t) => (
                <option key={t} value={t}>
                  {NAMA_TAHAP_TRYOUT_TKA[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="tka-rekap-field">
            <span>Kelas</span>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="lms-input"
            >
              <option value="semua">Semua ({kelasIzin.join(', ')})</option>
              {kelasIzin.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="tka-tabs" role="tablist" aria-label="Rekap TKA per mata pelajaran">
        {tabList.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tka-tab tka-tab--aktif' : 'tka-tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {info}
        </div>
      )}
      {peringatanSebaran.length > 0 && (tab as string) !== 'rekap' && (
        <div className="tka-rekap-hint-manual" role="note">
          <strong>Label soal belum lengkap:</strong>
          <ul className="mt-1 list-disc pl-5">
            {peringatanSebaran.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && !baris && <div className="lms-empty">Memuat rekap…</div>}

      {baris && baris.length === 0 && (
        <div className="lms-empty">Tidak ada siswa di kelas yang diizinkan.</div>
      )}

      {baris && baris.length > 0 && (MAPEL_TKA as readonly string[]).includes(tab) && (
        <TkaRekapMapel
          key={tab}
          mapel={tab as MapelTkaNama}
          tahap={tahap}
          baris={baris}
          kelasIzin={kelasIzin}
          kelasFilter={kelasFilter}
          kuis={kuisPerMapel?.[tab as MapelTkaNama] ?? []}
          namaGuru={profil?.nama}
          onReload={muat}
          onError={setError}
          onInfo={setInfo}
        />
      )}

      {tab === 'rekap' && tampil.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Rekap <strong>nilai akhir</strong> seluruh mata pelajaran. Rata-rata mengikuti aturan
            ranking portal:{' '}
            {tahap === 'I' ? 'tahap I = BI + MTK' : `tahap ${tahap} = BI + MTK + IPA`}. Untuk melihat
            atau mengubah sebaran kompetensi, buka tab mata pelajarannya.
          </p>
          <div className="tka-rekap-stats" aria-label="Ringkasan rekap">
            <div className="tka-rekap-stat tka-rekap-stat--siswa">
              <span className="tka-rekap-stat-label">Siswa</span>
              <span className="tka-rekap-stat-value">{ringkas.jumlah}</span>
              <span className="tka-rekap-stat-hint">di filter aktif</span>
            </div>
            <div className="tka-rekap-stat tka-rekap-stat--bi">
              <span className="tka-rekap-stat-label">Rata-rata BI</span>
              <span className="tka-rekap-stat-value">{ringkas.bi == null ? '—' : ringkas.bi}</span>
              <span className="tka-rekap-stat-hint">skala 100</span>
            </div>
            <div className="tka-rekap-stat tka-rekap-stat--mtk">
              <span className="tka-rekap-stat-label">Rata-rata MTK</span>
              <span className="tka-rekap-stat-value">{ringkas.mtk == null ? '—' : ringkas.mtk}</span>
              <span className="tka-rekap-stat-hint">skala 100</span>
            </div>
            <div className="tka-rekap-stat tka-rekap-stat--ipa">
              <span className="tka-rekap-stat-label">Rata-rata IPA</span>
              <span className="tka-rekap-stat-value">{ringkas.ipa == null ? '—' : ringkas.ipa}</span>
              <span className="tka-rekap-stat-hint">skala 100</span>
            </div>
          </div>
          <div className="tka-rekap-table-wrap">
            <table className="tka-rekap-table tka-sb-table">
              <thead>
                <tr>
                  <th className="tka-rekap-th-nama">Siswa</th>
                  <th>Kelas</th>
                  {MAPEL_TKA.map((m) => {
                    const cls =
                      m === 'TKA Bahasa Indonesia'
                        ? 'tka-rekap-th-nilai tka-rekap-th-bi'
                        : m === 'TKA Matematika'
                          ? 'tka-rekap-th-nilai tka-rekap-th-mtk'
                          : 'tka-rekap-th-nilai tka-rekap-th-ipa'
                    return (
                      <th key={m} className={cls}>
                        {LABEL_SINGKAT[m]}
                      </th>
                    )
                  })}
                  <th>Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((r) => {
                  const rata = hitungRataRata(nilaiOrtu(r), tahap)
                  return (
                    <tr key={`${r.kelas}-${r.siswaId}`}>
                      <td className="tka-rekap-nama">{r.siswaNama}</td>
                      <td className="tka-rekap-kelas">{r.kelas}</td>
                      {MAPEL_TKA.map((m) => {
                        const sel = r.perMapel[m]
                        return (
                          <td key={m} className="tka-sb-hitung">
                            {teksNilai(sel)}
                          </td>
                        )
                      })}
                      <td className="tka-sb-hitung">
                        <b>{teksAngka(rata)}</b>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="tka-rekap-nama" colSpan={2}>
                    Rata-rata kelas ({kelasFilter === 'semua' ? kelasIzin.join(' + ') : kelasFilter})
                  </td>
                  {MAPEL_TKA.map((m) => {
                    const v = tampil
                      .map((r) => r.perMapel[m]?.nilai)
                      .filter((n): n is number => typeof n === 'number')
                    const rata = v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
                    return (
                      <td key={m} className="tka-sb-hitung">
                        <b>{teksAngka(rata)}</b>
                        <span className="tka-sb-sub">
                          {v.length} siswa · tuntas {v.filter((n) => n >= KKM_TKA).length}
                        </span>
                      </td>
                    )
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'publikasi' && (
        <div className="space-y-3">
          <div className="tka-rekap-publikasi">
            <p className="tka-rekap-publikasi-judul">Portal orang tua (kelas 6)</p>
            <p className="tka-rekap-publikasi-desc">
              Snapshot nilai + sebaran kompetensi + ranking 10 besar gabungan 6A/6B. Tahap I: BI+MTK.
              Tahap II–V: BI+MTK+IPA. Hanya tahap yang dipublikasikan yang terlihat orang tua.
            </p>
            <div className="tka-rekap-publikasi-form">
              <label className="tka-rekap-field">
                <span>Kelas publish</span>
                <select
                  className="lms-input"
                  value={kelasPublish || kelasIzin[0] || ''}
                  onChange={(e) => setKelasPublish(e.target.value)}
                >
                  {kelasIzin.map((k) => (
                    <option key={k} value={k} disabled={!bolehPublishTkaOrtu(user, profil, k)}>
                      {k}
                      {statusPub[k]?.published ? ' · sudah publish' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tka-rekap-field tka-rekap-field--grow">
                <span>Catatan untuk orang tua (opsional)</span>
                <input
                  className="lms-input"
                  value={catatanOrtu}
                  onChange={(e) => setCatatanOrtu(e.target.value)}
                  maxLength={500}
                  placeholder="Mis. Try Out I fokus BI & Matematika"
                />
              </label>
              <button
                type="button"
                className="lms-btn-primary text-sm"
                disabled={
                  busyPub || loading || !kelasPublish || !bolehPublishTkaOrtu(user, profil, kelasPublish)
                }
                onClick={() => void handlePublish()}
              >
                {busyPub
                  ? 'Memproses…'
                  : statusPub[kelasPublish || '']?.published
                    ? 'Perbarui publikasi'
                    : 'Publikasikan ke portal'}
              </button>
              {statusPub[kelasPublish || '']?.published ? (
                <button
                  type="button"
                  className="lms-btn-secondary text-sm"
                  disabled={busyPub || loading}
                  onClick={() => void handleTarik()}
                >
                  Tarik publikasi
                </button>
              ) : null}
            </div>
            <div className="tka-rekap-publikasi-status">
              {kelasIzin.map((k) => {
                const st = statusPub[k]
                if (!st?.published) {
                  return (
                    <span key={k} className="tka-rekap-pub-chip">
                      {k}: belum dipublikasikan
                    </span>
                  )
                }
                return (
                  <span key={k} className="tka-rekap-pub-chip tka-rekap-pub-chip--ok">
                    {k}: sudah dipublikasikan
                    {st.publishedByNama ? ` · ${st.publishedByNama}` : ''}
                    {st.jumlahSiswa != null ? ` · ${st.jumlahSiswa} siswa` : ''}
                  </span>
                )
              })}
            </div>
          </div>

          {baris && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Yang akan diterima orang tua · kelas {kesiapan.kelas} · {NAMA_TAHAP_TRYOUT_TKA[tahap]}
              </p>
              <div className="tka-rekap-table-wrap">
                <table className="tka-rekap-table tka-sb-table">
                  <thead>
                    <tr>
                      <th className="tka-rekap-th-nama">Mata pelajaran</th>
                      <th>Siswa bernilai</th>
                      <th>Siswa dengan sebaran</th>
                      <th>Masuk rata-rata ranking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kesiapan.perMapel.map((p) => (
                      <tr key={p.mapel}>
                        <td className="tka-rekap-nama">{LABEL_MAPEL_TKA[p.mapel]}</td>
                        <td className="tka-sb-hitung">
                          {p.nilai} / {kesiapan.jumlah}
                        </td>
                        <td className="tka-sb-hitung">
                          {p.sebaran} / {kesiapan.jumlah}
                        </td>
                        <td className="tka-sb-hitung">
                          {kesiapan.wajib.includes(KUNCI_ORTU[p.mapel]) ? 'ya' : 'tidak'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                Setelah mengubah nilai atau sebaran, tekan <em>Perbarui publikasi</em> agar portal
                memperoleh snapshot terbaru.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

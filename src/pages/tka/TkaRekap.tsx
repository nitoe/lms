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
import { bangunRekapTka, simpanNilaiManualTka } from '../../lib/rekapTka'
import {
  muatStatusPublikasi,
  publikasikanTkaOrtu,
  tarikPublikasiTkaOrtu,
} from '../../lib/tkaPublikasi'
import type { TkaPublikasiDok } from '../../types/tkaPublikasi'
import {
  DAFTAR_TAHAP_TRYOUT_TKA,
  NAMA_TAHAP_TRYOUT_TKA,
  type TahapTryOutTka,
} from '../../types/kuis'
import type { BarisRekapTka, SelNilaiTka } from '../../types/rekapTka'
import type { KuisLms } from '../../types/kuis'
import '../../styles/tka.css'

const LABEL_SINGKAT: Record<MapelTkaNama, string> = {
  'TKA Bahasa Indonesia': 'BI',
  'TKA Matematika': 'MTK',
  'TKA IPA': 'IPA',
}

function teksNilai(sel: SelNilaiTka): string {
  if (sel.nilai == null) return '—'
  const n = sel.nilai
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

export default function TkaRekap() {
  const { user, profil } = useAuth()
  const boleh = bolehAksesTkaStaf(user, profil)
  const kelasIzin = useMemo(() => kelasRekapTkaBolehDilihat(user, profil), [user, profil])
  const adminTka = adalahAdminTka(user, profil)

  const [tahap, setTahap] = useState<TahapTryOutTka>('I')
  const [kelasFilter, setKelasFilter] = useState<string>('semua')
  const [baris, setBaris] = useState<BarisRekapTka[] | null>(null)
  const [kuisPerMapel, setKuisPerMapel] = useState<Record<MapelTkaNama, KuisLms[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [edit, setEdit] = useState<{
    siswaId: string
    mapel: MapelTkaNama
    draft: string
  } | null>(null)
  const [busySimpan, setBusySimpan] = useState(false)
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
    const n = tampil.length
    const avg = (mapel: MapelTkaNama) => {
      const vals = tampil
        .map((r) => r.perMapel[mapel]?.nilai)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
      if (!vals.length) return null
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    }
    return {
      jumlah: n,
      bi: avg('TKA Bahasa Indonesia'),
      mtk: avg('TKA Matematika'),
      ipa: avg('TKA IPA'),
    }
  }, [tampil])

  async function simpanEdit() {
    if (!edit) return
    const row = baris?.find((r) => r.siswaId === edit.siswaId)
    if (!row) return
    if (!kelasIzin.includes(row.kelas)) {
      setError(`Anda tidak berwenang mengubah nilai kelas ${row.kelas}.`)
      return
    }
    setBusySimpan(true)
    setError('')
    setInfo('')
    try {
      const raw = edit.draft.trim()
      const nilai = raw === '' ? null : Number(raw.replace(',', '.'))
      if (raw !== '' && (Number.isNaN(nilai!) || nilai! < 0 || nilai! > 100)) {
        throw new Error('Nilai harus angka 0–100, atau kosongkan untuk kembali ke otomatis.')
      }
      await simpanNilaiManualTka({
        kelas: row.kelas,
        tahap,
        siswaId: row.siswaId,
        siswaNama: row.siswaNama,
        mapel: edit.mapel,
        nilai,
        namaGuru: profil?.nama,
      })
      setEdit(null)
      setInfo(nilai == null ? 'Override manual dihapus.' : 'Nilai manual disimpan.')
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusySimpan(false)
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
          `Nilai disalin (snapshot). Ranking 10 besar dihitung dari gabungan 6A+6B.`,
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

  return (
    <div className="tka-rekap space-y-4">
      <div className="tka-rekap-header">
        <div>
          <Link to="/tka" className="tka-rekap-breadcrumb">
            ← Dashboard TKA
          </Link>
          <h1 className="tka-rekap-title">Rekap Nilai Try Out TKA</h1>
          <p className="tka-rekap-sub">
            Nilai per tahap × mapel. Otomatis dari kuis LMS dengan tahap yang sama; bisa diisi
            manual jika try out di luar LMS.
          </p>
        </div>
        <button
          type="button"
          className="lms-btn-secondary text-sm"
          disabled={loading}
          onClick={() => void muat()}
        >
          {loading ? 'Memuat…' : 'Muat ulang'}
        </button>
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
          Try out tidak lewat LMS? Isi nilai lewat tombol <strong>+ Isi manual</strong> di kolom BI /
          MTK / IPA pada tabel.
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

        <div className="tka-rekap-publikasi">
          <p className="tka-rekap-publikasi-judul">Portal orang tua (kelas 6)</p>
          <p className="tka-rekap-publikasi-desc">
            Snapshot nilai + ranking 10 besar gabungan 6A/6B. Tahap I: BI+MTK. Tahap II–V:
            BI+MTK+IPA. Hanya tahap yang dipublikasikan yang terlihat orang tua.
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
                busyPub ||
                loading ||
                !kelasPublish ||
                !bolehPublishTkaOrtu(user, profil, kelasPublish)
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
      </div>

      {kuisPerMapel && (
        <div className="tka-rekap-sumber">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Kuis sumber {NAMA_TAHAP_TRYOUT_TKA[tahap]}
          </span>
          <ul>
            {MAPEL_TKA.map((m) => {
              const list = kuisPerMapel[m] ?? []
              return (
                <li key={m}>
                  <strong>{LABEL_SINGKAT[m]}</strong>:{' '}
                  {list.length === 0
                    ? 'belum ada kuis bertahap ini'
                    : list.map((k) => k.judul).join(', ')}
                </li>
              )
            })}
          </ul>
        </div>
      )}

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

      {loading && !baris && <div className="lms-empty">Memuat rekap…</div>}

      {baris && tampil.length === 0 && (
        <div className="lms-empty">Tidak ada siswa di kelas yang diizinkan.</div>
      )}

      {tampil.length > 0 && (
        <div className="tka-rekap-stats" aria-label="Ringkasan rekap">
          <div className="tka-rekap-stat tka-rekap-stat--siswa">
            <span className="tka-rekap-stat-label">Siswa</span>
            <span className="tka-rekap-stat-value">{ringkas.jumlah}</span>
            <span className="tka-rekap-stat-hint">di filter aktif</span>
          </div>
          <div className="tka-rekap-stat tka-rekap-stat--bi">
            <span className="tka-rekap-stat-label">Rata-rata BI</span>
            <span className="tka-rekap-stat-value">
              {ringkas.bi == null ? '—' : ringkas.bi}
            </span>
            <span className="tka-rekap-stat-hint">skala 100</span>
          </div>
          <div className="tka-rekap-stat tka-rekap-stat--mtk">
            <span className="tka-rekap-stat-label">Rata-rata MTK</span>
            <span className="tka-rekap-stat-value">
              {ringkas.mtk == null ? '—' : ringkas.mtk}
            </span>
            <span className="tka-rekap-stat-hint">skala 100</span>
          </div>
          <div className="tka-rekap-stat tka-rekap-stat--ipa">
            <span className="tka-rekap-stat-label">Rata-rata IPA</span>
            <span className="tka-rekap-stat-value">
              {ringkas.ipa == null ? '—' : ringkas.ipa}
            </span>
            <span className="tka-rekap-stat-hint">skala 100</span>
          </div>
        </div>
      )}

      {tampil.length > 0 && (
        <div className="tka-rekap-table-wrap">
          <table className="tka-rekap-table">
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
              </tr>
            </thead>
            <tbody>
              {tampil.map((r) => (
                <tr key={`${r.kelas}-${r.siswaId}`}>
                  <td className="tka-rekap-nama">{r.siswaNama}</td>
                  <td className="tka-rekap-kelas">{r.kelas}</td>
                  {MAPEL_TKA.map((m) => {
                    const sel = r.perMapel[m]
                    const sedangEdit = edit?.siswaId === r.siswaId && edit.mapel === m
                    return (
                      <td key={m} className="tka-rekap-nilai">
                        {sedangEdit ? (
                          <div className="tka-rekap-edit">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={edit.draft}
                              onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                              className="lms-input tka-rekap-input"
                              autoFocus
                              placeholder="0–100"
                              aria-label={`Nilai manual ${LABEL_SINGKAT[m]} ${r.siswaNama}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void simpanEdit()
                                }
                                if (e.key === 'Escape') setEdit(null)
                              }}
                            />
                            <button
                              type="button"
                              className="lms-btn-primary text-xs"
                              disabled={busySimpan}
                              onClick={() => void simpanEdit()}
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              className="lms-btn-secondary text-xs"
                              disabled={busySimpan}
                              onClick={() => setEdit(null)}
                            >
                              Batal
                            </button>
                            {sel.sumber === 'manual' && (
                              <button
                                type="button"
                                className="tka-rekap-btn-hapus text-xs"
                                disabled={busySimpan}
                                title="Hapus nilai manual, kembali ke LMS bila ada"
                                onClick={() => {
                                  setEdit({ siswaId: r.siswaId, mapel: m, draft: '' })
                                  // simpan kosong = hapus override
                                  void (async () => {
                                    setBusySimpan(true)
                                    setError('')
                                    try {
                                      await simpanNilaiManualTka({
                                        kelas: r.kelas,
                                        tahap,
                                        siswaId: r.siswaId,
                                        siswaNama: r.siswaNama,
                                        mapel: m,
                                        nilai: null,
                                        namaGuru: profil?.nama,
                                      })
                                      setEdit(null)
                                      setInfo('Nilai manual dihapus.')
                                      await muat()
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
                                    } finally {
                                      setBusySimpan(false)
                                    }
                                  })()
                                }}
                              >
                                Hapus manual
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="tka-rekap-cell">
                            <div className="tka-rekap-cell-nilai">
                              <span className="tka-rekap-angka">{teksNilai(sel)}</span>
                              {sel.sumber === 'manual' && (
                                <span className="tka-rekap-badge tka-rekap-badge--manual">manual</span>
                              )}
                              {sel.sumber === 'otomatis' && (
                                <span
                                  className="tka-rekap-badge tka-rekap-badge--auto"
                                  title={sel.dariKuis ? `Dari kuis: ${sel.dariKuis}` : undefined}
                                >
                                  LMS
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className={
                                sel.nilai == null
                                  ? 'tka-rekap-btn-isi'
                                  : 'tka-rekap-btn-ubah'
                              }
                              onClick={() =>
                                setEdit({
                                  siswaId: r.siswaId,
                                  mapel: m,
                                  draft: sel.nilai != null ? String(sel.nilai) : '',
                                })
                              }
                            >
                              {sel.nilai == null ? '+ Isi manual' : 'Ubah'}
                            </button>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="tka-rekap-petunjuk">
        <p>
          <strong>Input manual:</strong> tombol <em>+ Isi manual</em> / <em>Ubah</em> pada setiap
          sel mapel — untuk try out di luar LMS (kertas, sistem lain). Nilai 0–100.
        </p>
        <p>
          Kosongkan field lalu <em>Simpan</em>, atau <em>Hapus manual</em>, untuk menghapus
          override dan kembali ke nilai otomatis dari kuis LMS (jika ada). Mapel:{' '}
          {MAPEL_TKA.map((m) => `${LABEL_SINGKAT[m]}=${LABEL_MAPEL_TKA[m]}`).join(' · ')}.
        </p>
      </div>
    </div>
  )
}

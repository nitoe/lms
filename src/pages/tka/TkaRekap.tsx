import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  EMAIL_AKSES_KHUSUS_TKA,
  LABEL_MAPEL_TKA,
  MAPEL_TKA,
  adalahAdminTka,
  bolehAksesTkaStaf,
  kelasRekapTkaBolehDilihat,
  type MapelTkaNama,
} from '../../lib/tkaAkses'
import { bangunRekapTka, simpanNilaiManualTka } from '../../lib/rekapTka'
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

  const muat = useCallback(async () => {
    if (!boleh || kelasIzin.length === 0) return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const { baris: b, kuisPerMapel: k } = await bangunRekapTka({
        tahap,
        kelasList: kelasIzin,
      })
      setBaris(b)
      setKuisPerMapel(k)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/tka" className="text-sm font-semibold text-muh-600 hover:underline">
            ← Dashboard TKA
          </Link>
          <h1 className="mt-1 text-lg font-bold text-slate-900">Rekap Nilai Try Out TKA</h1>
          <p className="text-sm text-slate-600">
            Nilai per tahap × mapel. Otomatis dari kuis LMS dengan tahap yang sama; bisa diisi manual
            jika try out di luar LMS.
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

      <div className="tka-rekap-akses">
        {adminTka ? (
          <p>
            Akses <strong>admin TKA</strong> ({EMAIL_AKSES_KHUSUS_TKA}): rekap siswa{' '}
            <strong>6A dan 6B</strong>.
          </p>
        ) : (
          <p>
            Rekap terbatas pada kelas yang Anda wali: <strong>{kelasIzin.join(', ') || '—'}</strong>.
            Guru 6A tidak melihat siswa 6B, dan sebaliknya.
          </p>
        )}
      </div>

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
        <div className="tka-rekap-table-wrap">
          <table className="tka-rekap-table">
            <thead>
              <tr>
                <th className="tka-rekap-th-nama">Siswa</th>
                <th>Kelas</th>
                {MAPEL_TKA.map((m) => (
                  <th key={m}>{LABEL_SINGKAT[m]}</th>
                ))}
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
                              className="lms-input"
                              autoFocus
                              placeholder="0–100"
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
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="tka-rekap-sel"
                            title={
                              sel.sumber === 'otomatis' && sel.dariKuis
                                ? `Dari kuis: ${sel.dariKuis} — klik untuk ubah manual`
                                : 'Klik untuk input manual'
                            }
                            onClick={() =>
                              setEdit({
                                siswaId: r.siswaId,
                                mapel: m,
                                draft: sel.nilai != null ? String(sel.nilai) : '',
                              })
                            }
                          >
                            <span className="tka-rekap-angka">{teksNilai(sel)}</span>
                            {sel.sumber === 'manual' && (
                              <span className="tka-rekap-badge tka-rekap-badge--manual">manual</span>
                            )}
                            {sel.sumber === 'otomatis' && (
                              <span className="tka-rekap-badge tka-rekap-badge--auto">LMS</span>
                            )}
                          </button>
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

      <p className="text-xs text-slate-500">
        Klik sel nilai untuk mengisi manual (misalnya try out kertas). Kosongkan lalu simpan untuk
        menghapus override dan kembali ke nilai dari kuis LMS. Label mapel: {MAPEL_TKA.map((m) => `${LABEL_SINGKAT[m]}=${LABEL_MAPEL_TKA[m]}`).join(' · ')}.
      </p>
    </div>
  )
}

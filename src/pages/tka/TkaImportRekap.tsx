import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { peranDari } from '../../lib/peran'
import {
  DATA_TRYOUT_TAHAP_1,
  SUMBER_TRYOUT_TAHAP_1,
  type BarisTryOutImport,
} from '../../data/tryoutTahap1'
import {
  cocokkanBaris,
  imporRekapTkaManual,
  muatRosterTka6,
  type BarisPratinjauImport,
} from '../../lib/importRekapTka'
import {
  DAFTAR_TAHAP_TRYOUT_TKA,
  NAMA_TAHAP_TRYOUT_TKA,
  type TahapTryOutTka,
} from '../../types/kuis'
import '../../styles/tka.css'

function parseJsonBaris(teks: string): BarisTryOutImport[] {
  const raw = JSON.parse(teks) as unknown
  const arr = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data
  if (!Array.isArray(arr)) throw new Error('JSON harus array objek {nama, kelas, mtk, bi}.')
  return arr.map((row, i) => {
    const r = row as Record<string, unknown>
    const nama = String(r.nama ?? r.Nama ?? '').trim()
    const kelas = String(r.kelas ?? r.Kelas ?? '')
      .trim()
      .toUpperCase()
    const mtk = Number(r.mtk ?? r.MTK ?? r.matematika)
    const bi = Number(r.bi ?? r.BI ?? r.bahasaIndonesia)
    if (!nama) throw new Error(`Baris ${i + 1}: nama kosong.`)
    if (kelas !== '6A' && kelas !== '6B') throw new Error(`Baris ${i + 1}: kelas harus 6A/6B.`)
    if (Number.isNaN(mtk) || Number.isNaN(bi)) throw new Error(`Baris ${i + 1}: mtk/bi bukan angka.`)
    return { nama, kelas, mtk, bi }
  })
}

export default function TkaImportRekap() {
  const { user, profil } = useAuth()
  const peran = peranDari(profil)
  const isAdmin = peran === 'admin'

  const [tahap, setTahap] = useState<TahapTryOutTka>('I')
  const [pratinjau, setPratinjau] = useState<BarisPratinjauImport[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [jsonTeks, setJsonTeks] = useState('')

  const ringkas = useMemo(() => {
    if (!pratinjau) return null
    const cocok = pratinjau.filter((b) => b.status === 'cocok').length
    const ganda = pratinjau.filter((b) => b.status === 'ganda').length
    const tidak = pratinjau.filter((b) => b.status === 'tidak_ketemu').length
    return { total: pratinjau.length, cocok, ganda, tidak }
  }, [pratinjau])

  const jalankanCocok = useCallback(
    async (sumber: readonly BarisTryOutImport[]) => {
      setLoading(true)
      setError('')
      setInfo('')
      setPratinjau(null)
      try {
        const roster = await muatRosterTka6()
        if (roster.length === 0) {
          throw new Error('Roster siswa 6A/6B kosong. Pastikan data siswa sudah diimpor.')
        }
        const hasil = cocokkanBaris(sumber, roster)
        setPratinjau(hasil)
        const nCocok = hasil.filter((h) => h.status === 'cocok').length
        setInfo(
          `Pratinjau: ${nCocok}/${hasil.length} cocok dengan roster. Periksa baris merah/kuning sebelum menyimpan.`,
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mencocokkan data.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isAdmin) return
    // default: muat data Try Out I bawaan
    void jalankanCocok(DATA_TRYOUT_TAHAP_1)
  }, [isAdmin, jalankanCocok])

  async function simpan() {
    if (!pratinjau) return
    const nCocok = pratinjau.filter((b) => b.status === 'cocok').length
    if (nCocok === 0) {
      setError('Tidak ada baris yang cocok untuk disimpan.')
      return
    }
    if (
      !window.confirm(
        `Simpan ${nCocok} nilai manual tahap ${tahap} (MTK + BI) ke lms_rekap_tka?\nBaris yang tidak cocok akan dilewati.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const hasil = await imporRekapTkaManual({
        tahap,
        baris: pratinjau,
        namaGuru: profil?.nama,
      })
      setInfo(
        `Selesai: ${hasil.ditulis} dokumen ditulis, ${hasil.dilewati} dilewati.` +
          (hasil.error.length ? ` Error: ${hasil.error.join('; ')}` : ''),
      )
      if (hasil.error.length) setError(hasil.error.join('\n'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  function muatDariJson() {
    try {
      const baris = parseJsonBaris(jsonTeks)
      void jalankanCocok(baris)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON tidak valid.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="lms-empty">
        <p className="font-medium text-slate-700">Hanya Administrator LMS</p>
        <p className="mt-1 text-sm text-slate-600">
          Tool import rekap TKA hanya untuk akun dengan role <strong>admin</strong>.
        </p>
        <Link to="/tka" className="mt-3 inline-block text-sm font-semibold text-muh-600 hover:underline">
          ← Kembali ke TKA
        </Link>
      </div>
    )
  }

  return (
    <div className="tka-import space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/tka" className="text-sm font-semibold text-muh-600 hover:underline">
            ← Dashboard TKA
          </Link>
          <h1 className="mt-1 text-lg font-bold text-slate-900">Import Rekap Try Out TKA</h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Khusus <strong>admin LMS</strong>. Mencocokkan nama + kelas ke roster siswa, lalu menulis
            nilai manual (MTK &amp; BI) ke koleksi <code className="text-xs">lms_rekap_tka</code>.
          </p>
        </div>
        <Link to="/tka/rekap" className="lms-btn-secondary text-sm">
          Buka halaman rekap
        </Link>
      </div>

      <div className="tka-import-box">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sumber bawaan</p>
        <p className="mt-1 text-sm text-slate-700">{SUMBER_TRYOUT_TAHAP_1}</p>
        <p className="mt-1 text-xs text-slate-500">
          {DATA_TRYOUT_TAHAP_1.length} siswa · hanya mapel Matematika &amp; Bahasa Indonesia (IPA
          kosong).
        </p>
        <button
          type="button"
          className="lms-btn-secondary text-sm mt-3"
          disabled={loading || busy}
          onClick={() => void jalankanCocok(DATA_TRYOUT_TAHAP_1)}
        >
          Muat ulang data Try Out I
        </button>
      </div>

      <div className="tka-rekap-toolbar">
        <label className="tka-rekap-field">
          <span>Tahap tujuan</span>
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
      </div>

      <details className="tka-import-box">
        <summary className="cursor-pointer font-semibold text-sm text-slate-800">
          Atau tempel JSON kustom
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Format: array <code>{`[{ "nama", "kelas": "6A"|"6B", "mtk", "bi" }]`}</code>
        </p>
        <textarea
          className="lms-input mt-2 w-full font-mono text-xs"
          rows={6}
          value={jsonTeks}
          onChange={(e) => setJsonTeks(e.target.value)}
          placeholder='[{"nama":"Contoh Siswa","kelas":"6A","mtk":70,"bi":65}]'
        />
        <button
          type="button"
          className="lms-btn-secondary text-sm mt-2"
          disabled={loading || busy || !jsonTeks.trim()}
          onClick={muatDariJson}
        >
          Pratinjau dari JSON
        </button>
      </details>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {info}
        </div>
      )}

      {ringkas && (
        <div className="tka-import-stats">
          <div>
            <b>{ringkas.total}</b>
            <span>total</span>
          </div>
          <div className="ok">
            <b>{ringkas.cocok}</b>
            <span>cocok</span>
          </div>
          <div className="warn">
            <b>{ringkas.ganda}</b>
            <span>ganda</span>
          </div>
          <div className="bad">
            <b>{ringkas.tidak}</b>
            <span>tidak ketemu</span>
          </div>
        </div>
      )}

      {loading && <div className="lms-empty">Mencocokkan ke roster…</div>}

      {pratinjau && pratinjau.length > 0 && (
        <>
          <div className="tka-rekap-table-wrap">
            <table className="tka-rekap-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Nama (sumber)</th>
                  <th>Kelas</th>
                  <th>MTK</th>
                  <th>BI</th>
                  <th>Siswa LMS</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {pratinjau.map((b, i) => (
                  <tr
                    key={`${b.sumber.kelas}-${b.sumber.nama}-${i}`}
                    className={
                      b.status === 'cocok'
                        ? undefined
                        : b.status === 'ganda'
                          ? 'tka-import-row--warn'
                          : 'tka-import-row--bad'
                    }
                  >
                    <td>
                      <span
                        className={
                          b.status === 'cocok'
                            ? 'tka-rekap-badge tka-rekap-badge--auto'
                            : b.status === 'ganda'
                              ? 'tka-rekap-badge tka-rekap-badge--manual'
                              : 'tka-import-badge-bad'
                        }
                      >
                        {b.status === 'cocok' ? 'cocok' : b.status === 'ganda' ? 'ganda' : 'tidak'}
                      </span>
                    </td>
                    <td className="tka-rekap-nama">{b.sumber.nama}</td>
                    <td>{b.sumber.kelas}</td>
                    <td>{b.sumber.mtk}</td>
                    <td>{b.sumber.bi}</td>
                    <td className="text-sm">
                      {b.siswa ? (
                        <>
                          {b.siswa.nama}
                          <span className="block text-xs text-slate-400 font-mono">{b.siswa.id}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-xs text-slate-500">{b.pesan || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="lms-btn-primary text-sm"
              disabled={busy || loading || !ringkas?.cocok}
              onClick={() => void simpan()}
            >
              {busy ? 'Menyimpan…' : `Simpan ${ringkas?.cocok ?? 0} nilai manual (tahap ${tahap})`}
            </button>
            <p className="text-xs text-slate-500 self-center">
              Login: {user?.email || '—'} · hanya baris berstatus cocok yang ditulis.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

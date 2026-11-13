/**
 * Tab satu mapel pada Rekap Try Out TKA: tabel nilai + sebaran capaian.
 * - Sebaran kompetensi: kompetensi dasar (L1–L3) dan kompetensi materi (tipe materi; IPA = domain)
 * - Tabel siswa: nilai akhir + capaian per kompetensi
 * ANTIREGRESI §109.
 */
import { useMemo, useState } from 'react'
import { simpanNilaiManualTka } from '../../lib/rekapTka'
import {
  BATAS_RENDAH_TKA,
  KKM_TKA,
  NAMA_DIMENSI,
  agregatSebaran,
  kompetensiTerlemah,
  kolomDariAgregat,
  type AgregatSebaran,
  type DimensiSebaran,
} from '../../lib/sebaranTka'
import { LABEL_MAPEL_TKA, type MapelTkaNama } from '../../lib/tkaAkses'
import type { KuisLms, TahapTryOutTka } from '../../types/kuis'
import { NAMA_TAHAP_TRYOUT_TKA } from '../../types/kuis'
import type { BarisRekapTka, BarisSebaranTka, SebaranMapelTka } from '../../types/rekapTka'
import TkaSebaranManual from './TkaSebaranManual'

type Props = {
  mapel: MapelTkaNama
  tahap: TahapTryOutTka
  /** Semua baris rekap untuk kelas yang diizinkan (belum difilter kelas). */
  baris: BarisRekapTka[]
  kelasIzin: string[]
  /** 'semua' atau satu kelas. */
  kelasFilter: string
  kuis: KuisLms[]
  namaGuru?: string
  onReload: () => Promise<void>
  onError: (pesan: string) => void
  onInfo: (pesan: string) => void
}

type Scope = {
  id: string
  label: string
  rows: BarisRekapTka[]
  nilai: number[]
  agregat: AgregatSebaran
}

type Kolom = { id: string; judul: string; sub?: string; dim: DimensiSebaran; key: string }

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

function kelasCapaian(persen: number): string {
  if (persen < BATAS_RENDAH_TKA) return 'tka-sb-rendah'
  if (persen < KKM_TKA) return 'tka-sb-sedang'
  return 'tka-sb-tuntas'
}

function BarCapaian({ persen }: { persen: number }) {
  return (
    <span className="tka-sb-bar" aria-hidden>
      <span className={`tka-sb-bar-isi ${kelasCapaian(persen)}`} style={{ width: `${Math.min(100, persen)}%` }} />
    </span>
  )
}

function cariBaris(
  s: SebaranMapelTka | null | undefined,
  dim: DimensiSebaran,
  key: string,
): BarisSebaranTka | undefined {
  return s?.[dim]?.find((r) => r.key === key)
}

export default function TkaRekapMapel({
  mapel,
  tahap,
  baris,
  kelasIzin,
  kelasFilter,
  kuis,
  namaGuru,
  onReload,
  onError,
  onInfo,
}: Props) {
  const label = LABEL_MAPEL_TKA[mapel]
  const [edit, setEdit] = useState<{ siswaId: string; draft: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [inputSebaran, setInputSebaran] = useState(false)

  const kelasScope = useMemo(
    () => (kelasFilter === 'semua' ? kelasIzin : kelasIzin.filter((k) => k === kelasFilter)),
    [kelasFilter, kelasIzin],
  )

  const scopes = useMemo<Scope[]>(() => {
    const buat = (id: string, lbl: string, rows: BarisRekapTka[]): Scope => ({
      id,
      label: lbl,
      rows,
      nilai: rows
        .map((r) => r.perMapel[mapel]?.nilai)
        .filter((n): n is number => typeof n === 'number'),
      agregat: agregatSebaran(rows.map((r) => r.perMapel[mapel]?.sebaran ?? null)),
    })
    const perKelas = kelasScope.map((k) =>
      buat(k, k, baris.filter((r) => String(r.kelas).toUpperCase() === k)),
    )
    if (perKelas.length <= 1) return perKelas
    return [...perKelas, buat('gabungan', 'Gabungan', perKelas.flatMap((s) => s.rows))]
  }, [baris, kelasScope, mapel])

  const dasar = scopes[scopes.length - 1] // gabungan bila >1 kelas, selain itu satu-satunya
  const rowsTabel = dasar?.rows ?? []
  const nSiswa = rowsTabel.length
  const nNilai = dasar?.nilai.length ?? 0
  const nSebaran = dasar?.agregat.n ?? 0

  // Dimensi yang punya data pada cakupan saat ini. Kompetensi dasar (L1–L3) dan kompetensi
  // materi SELALU tabel terpisah, termasuk Bahasa Indonesia (ANTIREGRESI §123).
  const dimensiTampil = useMemo<DimensiSebaran[]>(() => {
    const ag = dasar?.agregat
    if (!ag) return []
    const dims: DimensiSebaran[] = []
    if (ag.kompleksitas.length) dims.push('kompleksitas')
    if (ag.materi.length) dims.push('materi')
    if (ag.domain.length) dims.push('domain')
    return dims
  }, [dasar])

  const kolom = useMemo<Kolom[]>(
    () => (dasar ? kolomDariAgregat(dasar.agregat) : []),
    [dasar],
  )

  // Kelompok header: kompetensi dasar (L1–L3) dan kompetensi materi (tipe materi / domain IPA).
  const kelompokKolom = useMemo(() => {
    const out: { id: string; label: string; jumlah: number }[] = []
    for (const c of kolom) {
      const label =
        c.dim === 'kompleksitas'
          ? 'Kompetensi dasar'
          : c.dim === 'domain'
            ? 'Kompetensi materi (Pengetahuan IPA & Keterampilan Proses Sains)'
            : 'Kompetensi materi'
      const id = c.dim === 'domain' ? 'materi-ipa' : c.dim
      const last = out[out.length - 1]
      if (last && last.id === id) last.jumlah += 1
      else out.push({ id, label, jumlah: 1 })
    }
    return out
  }, [kolom])

  async function simpan(row: BarisRekapTka, nilai: number | null) {
    const sel = row.perMapel[mapel]
    if (
      sel?.sebaran &&
      sel.sumber === 'manual' &&
      (nilai == null || nilai !== sel.nilai) &&
      !window.confirm(
        `Nilai ${row.siswaNama} berasal dari data import yang memuat sebaran capaian.\n` +
          `Mengubah/menghapus nilai akan menghapus sebaran capaiannya untuk ${label}. Lanjutkan?`,
      )
    ) {
      return
    }
    setBusy(true)
    onError('')
    onInfo('')
    try {
      await simpanNilaiManualTka({
        kelas: row.kelas,
        tahap,
        siswaId: row.siswaId,
        siswaNama: row.siswaNama,
        mapel,
        nilai,
        namaGuru,
      })
      setEdit(null)
      onInfo(nilai == null ? 'Override manual dihapus.' : 'Nilai manual disimpan.')
      await onReload()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  function simpanDraft(row: BarisRekapTka) {
    if (!edit) return
    const raw = edit.draft.trim()
    const nilai = raw === '' ? null : Number(raw.replace(',', '.'))
    if (raw !== '' && (Number.isNaN(nilai!) || nilai! < 0 || nilai! > 100)) {
      onError('Nilai harus angka 0–100, atau kosongkan untuk kembali ke otomatis.')
      return
    }
    void simpan(row, nilai)
  }

  const sumberKuis = kuis.length ? kuis.map((k) => k.judul).join(', ') : null
  const adaNilaiManual = rowsTabel.some((r) => r.perMapel[mapel]?.sumber === 'manual')

  // Tabel sebaran satu dimensi. Fungsi biasa, bukan komponen.
  function tabelDimensi(dim: DimensiSebaran) {
    if (!dasar) return null
    const ag = dasar.agregat
    const judul = NAMA_DIMENSI[dim]
    const baseRows = ag[dim].map((r) => ({ nama: r.nama, key: r.key, dimLookup: dim, agg: r }))
    if (baseRows.length === 0) return null
    return (
      <div className="tka-rekap-table-wrap">
        <table className="tka-rekap-table tka-sb-table">
          <caption className="tka-sb-caption">{judul}</caption>
          <thead>
            <tr>
              <th className="tka-rekap-th-nama">Kompetensi</th>
              {scopes.map((s) => (
                <th key={s.id}>Capaian {s.label}</th>
              ))}
              <th title={`Siswa dengan capaian < ${BATAS_RENDAH_TKA}%`}>&lt; {BATAS_RENDAH_TKA}%</th>
              <th title={`Capaian ${BATAS_RENDAH_TKA}–${KKM_TKA - 1}%`}>
                {BATAS_RENDAH_TKA}–{KKM_TKA - 1}%
              </th>
              <th title={`Capaian ≥ ${KKM_TKA}%`}>≥ {KKM_TKA}%</th>
            </tr>
          </thead>
          <tbody>
            {baseRows.map((r) => (
              <tr key={`${dim}:${r.key}`}>
                <td className="tka-rekap-nama">
                  {r.nama}
                </td>
                {scopes.map((s) => {
                  const a = s.agregat[r.dimLookup].find((x) => x.key === r.key)
                  return (
                    <td key={s.id}>
                      {a ? (
                        <span className="tka-sb-sel">
                          <b className={kelasCapaian(a.persen)}>{fmt(a.persen)}%</b>
                          <BarCapaian persen={a.persen} />
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
                <td className="tka-sb-hitung">{r.agg.rendah}</td>
                <td className="tka-sb-hitung">{r.agg.sedang}</td>
                <td className="tka-sb-hitung">{r.agg.tuntas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="tka-rekap-sumber">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label} · {NAMA_TAHAP_TRYOUT_TKA[tahap]}
        </span>
        <ul>
          <li>
            Kuis sumber LMS: {sumberKuis ?? 'belum ada kuis bertahap ini'}
            {adaNilaiManual ? ' · sebagian nilai berasal dari input/import manual' : ''}
          </li>
          <li>
            Nilai tersedia: <strong>{nNilai}</strong> dari {nSiswa} siswa · sebaran kompetensi
            tersedia: <strong>{nSebaran}</strong> siswa
          </li>
        </ul>
      </div>

      {nNilai > nSebaran && (
        <div className="tka-rekap-hint-manual" role="note">
          {nNilai - nSebaran} siswa punya nilai tetapi <strong>tanpa data butir</strong> (nilai manual
          tanpa sebaran) — mereka tidak ikut dihitung dalam sebaran kompetensi di bawah.
        </div>
      )}

      {nNilai === 0 && (
        <div className="lms-empty">
          <p className="font-medium text-slate-700">Belum ada nilai {label} pada {NAMA_TAHAP_TRYOUT_TKA[tahap]}</p>
          <p className="mt-1 text-sm text-slate-600">
            Nilai muncul otomatis dari kuis LMS bertahap {tahap}, atau isi manual lewat tombol pada
            tabel di bawah.
          </p>
        </div>
      )}

      {rowsTabel.length > 0 && !inputSebaran && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="lms-btn-secondary text-sm" onClick={() => setInputSebaran(true)}>
            + Input sebaran kompetensi manual
          </button>
          <span className="text-xs text-slate-500">
            Untuk try out di luar LMS: isi poin per kompetensi, nilai akhir ikut terhitung.
          </span>
        </div>
      )}

      {inputSebaran && (
        <TkaSebaranManual
          mapel={mapel}
          tahap={tahap}
          rows={rowsTabel}
          namaGuru={namaGuru}
          onSelesai={onReload}
          onTutup={() => setInputSebaran(false)}
          onError={onError}
          onInfo={onInfo}
        />
      )}

      {rowsTabel.length > 0 && (
        <section className="space-y-2">
          <h2 className="tka-sb-judul">Nilai &amp; capaian per siswa</h2>
          <div className="tka-rekap-table-wrap">
            <table className="tka-rekap-table tka-sb-table">
              <thead>
                <tr>
                  <th className="tka-rekap-th-nama" rowSpan={kolom.length ? 2 : 1}>Siswa</th>
                  <th rowSpan={kolom.length ? 2 : 1}>Kelas</th>
                  <th rowSpan={kolom.length ? 2 : 1}>Nilai akhir</th>
                  {kelompokKolom.map((g) => (
                    <th key={g.id} colSpan={g.jumlah} className="tka-sb-grup">
                      {g.label}
                    </th>
                  ))}
                  {kolom.length > 0 && <th rowSpan={2}>Terlemah</th>}
                </tr>
                {kolom.length > 0 && (
                  <tr>
                    {kolom.map((c) => (
                      <th key={c.id} title={c.sub ? `${c.judul} / ${c.sub}` : c.judul}>
                        {c.judul}
                        {c.sub ? <span className="tka-sb-sub">{c.sub}</span> : null}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {rowsTabel.map((r) => {
                  const sel = r.perMapel[mapel]
                  const sedangEdit = edit?.siswaId === r.siswaId
                  const terlemah = kompetensiTerlemah(sel?.sebaran)
                  return (
                    <tr key={`${r.kelas}-${r.siswaId}`}>
                      <td className="tka-rekap-nama">{r.siswaNama}</td>
                      <td className="tka-rekap-kelas">{r.kelas}</td>
                      <td className="tka-rekap-nilai">
                        {sedangEdit && edit ? (
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
                              aria-label={`Nilai manual ${label} ${r.siswaNama}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  simpanDraft(r)
                                }
                                if (e.key === 'Escape') setEdit(null)
                              }}
                            />
                            <button
                              type="button"
                              className="lms-btn-primary text-xs"
                              disabled={busy}
                              onClick={() => simpanDraft(r)}
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              className="lms-btn-secondary text-xs"
                              disabled={busy}
                              onClick={() => setEdit(null)}
                            >
                              Batal
                            </button>
                            {sel?.sumber === 'manual' && (
                              <button
                                type="button"
                                className="tka-rekap-btn-hapus text-xs"
                                disabled={busy}
                                title="Hapus nilai manual, kembali ke LMS bila ada"
                                onClick={() => void simpan(r, null)}
                              >
                                Hapus manual
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="tka-rekap-cell">
                            <div className="tka-rekap-cell-nilai">
                              <span className="tka-rekap-angka">{fmt(sel?.nilai)}</span>
                              {sel?.sumber === 'manual' && (
                                <span className="tka-rekap-badge tka-rekap-badge--manual">manual</span>
                              )}
                              {sel?.sumber === 'otomatis' && (
                                <span
                                  className="tka-rekap-badge tka-rekap-badge--auto"
                                  title={sel.dariKuis ? `Dari kuis: ${sel.dariKuis}` : undefined}
                                >
                                  LMS
                                </span>
                              )}
                              {sel?.sebaran?.waktuHabis && (
                                <span
                                  className="tka-rekap-badge tka-rekap-badge--manual"
                                  title="Waktu habis: soal yang tidak sempat tampil tidak dihitung (data sumber lama)."
                                >
                                  waktu habis
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className={sel?.nilai == null ? 'tka-rekap-btn-isi' : 'tka-rekap-btn-ubah'}
                              onClick={() =>
                                setEdit({
                                  siswaId: r.siswaId,
                                  draft: sel?.nilai != null ? String(sel.nilai) : '',
                                })
                              }
                            >
                              {sel?.nilai == null ? '+ Isi manual' : 'Ubah'}
                            </button>
                          </div>
                        )}
                      </td>
                      {kolom.map((c) => {
                        const b = cariBaris(sel?.sebaran, c.dim, c.key)
                        return (
                          <td key={c.id} className="tka-sb-hitung">
                            {b ? (
                              <span className={`tka-sb-chip ${kelasCapaian(b.persen)}`} title={`${fmt(b.poin)} / ${fmt(b.maks)} poin`}>
                                {fmt(b.persen)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )
                      })}
                      {kolom.length > 0 && (
                        <td className="tka-sb-sub-teks">{terlemah ? `${terlemah.nama} (${fmt(terlemah.persen)}%)` : '—'}</td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Angka kompetensi = capaian (%) dengan penanda warna: merah &lt; {BATAS_RENDAH_TKA}%, kuning{' '}
            {BATAS_RENDAH_TKA}–{KKM_TKA - 1}%, hijau ≥ {KKM_TKA}%. Arahkan kursor ke angka untuk melihat
            poin. Nilai manual boleh diisi untuk try out di luar LMS.
          </p>
        </section>
      )}
      {nSebaran > 0 && dasar && (
        <section className="space-y-2">
          <h2 className="tka-sb-judul">Sebaran kompetensi per kelas</h2>
          <p className="text-xs text-slate-500">
            Capaian = gabungan poin diperoleh ÷ poin maksimum (berbobot poin) pada tiap kompetensi.
            Kolom kanan: banyak siswa menurut capaian (rendah / sedang / tuntas).
          </p>
          {dimensiTampil.map((d) => (
            <div key={d}>{tabelDimensi(d)}</div>
          ))}
        </section>
      )}


    </div>
  )
}

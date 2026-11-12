/**
 * Input sebaran kompetensi manual untuk Try Out TKA di luar LMS (tahap II dst.).
 * Satu grid: poin maksimum per kompetensi (sekali), lalu poin diperoleh per siswa.
 * Nilai akhir dihitung dari poin (boleh ditimpa). ANTIREGRESI §113.
 */
import { useMemo, useState } from 'react'
import { simpanNilaiManualTka } from '../../lib/rekapTka'
import {
  bangunSebaranManual,
  kelompokInputSebaran,
  nilaiDariSebaran,
  type KelompokInputSebaran,
  type NilaiInputSebaran,
} from '../../lib/sebaranTka'
import { LABEL_MAPEL_TKA, type MapelTkaNama } from '../../lib/tkaAkses'
import { NAMA_TAHAP_TRYOUT_TKA, type TahapTryOutTka } from '../../types/kuis'
import type { BarisRekapTka, SebaranMapelTka } from '../../types/rekapTka'

type Props = {
  mapel: MapelTkaNama
  tahap: TahapTryOutTka
  /** Siswa pada cakupan kelas saat ini. */
  rows: BarisRekapTka[]
  namaGuru?: string
  onSelesai: () => Promise<void>
  onTutup: () => void
  onError: (pesan: string) => void
  onInfo: (pesan: string) => void
}

function angka(v: string | undefined): number | null {
  const t = (v ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

function teks(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export default function TkaSebaranManual({
  mapel,
  tahap,
  rows,
  namaGuru,
  onSelesai,
  onTutup,
  onError,
  onInfo,
}: Props) {
  const kelompok = useMemo(() => kelompokInputSebaran(mapel), [mapel])
  const label = LABEL_MAPEL_TKA[mapel]

  // Siswa dengan nilai otomatis dari LMS sudah punya sebaran dari jawaban — tidak diisi manual.
  const dapatDiisi = useMemo(
    () => rows.filter((r) => r.perMapel[mapel]?.sumber !== 'otomatis'),
    [rows, mapel],
  )
  const nOtomatis = rows.length - dapatDiisi.length

  // Prefill dari sebaran yang sudah ada (mis. data import) — maks diambil dari siswa pertama.
  const [maks, setMaks] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const r of dapatDiisi) {
      const s = r.perMapel[mapel]?.sebaran
      if (!s) continue
      for (const g of kelompok) {
        const b = s[g.dim]?.find((x) => x.key === g.key)
        if (b && out[g.id] == null) out[g.id] = teks(b.maks)
      }
    }
    return out
  })
  const [poin, setPoin] = useState<Record<string, Record<string, string>>>(() => {
    const out: Record<string, Record<string, string>> = {}
    for (const r of dapatDiisi) {
      const s = r.perMapel[mapel]?.sebaran
      if (!s) continue
      const baris: Record<string, string> = {}
      for (const g of kelompok) {
        const b = s[g.dim]?.find((x) => x.key === g.key)
        if (b) baris[g.id] = teks(b.poin)
      }
      out[r.siswaId] = baris
    }
    return out
  })
  const [nilaiManual, setNilaiManual] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const grup = useMemo(() => {
    const out: { label: string; jumlah: number }[] = []
    for (const g of kelompok) {
      const last = out[out.length - 1]
      if (last && last.label === g.grup) last.jumlah += 1
      else out.push({ label: g.grup, jumlah: 1 })
    }
    return out
  }, [kelompok])

  function masukan(r: BarisRekapTka): Record<string, NilaiInputSebaran> | null | 'kurang' {
    const baris = poin[r.siswaId] ?? {}
    const terisi = kelompok.filter((g) => (baris[g.id] ?? '').trim() !== '')
    if (terisi.length === 0) return null
    const out: Record<string, NilaiInputSebaran> = {}
    for (const g of kelompok) {
      const p = angka(baris[g.id])
      const m = angka(maks[g.id])
      if (p == null || m == null) return 'kurang'
      out[g.id] = { poin: p, maks: m }
    }
    return out
  }

  /** Hasil pratinjau per siswa: teks status + nilai akhir yang akan disimpan. */
  function tinjau(r: BarisRekapTka): { status: string; ok: boolean; nilai: number | null } {
    const m = masukan(r)
    if (m == null) return { status: '', ok: false, nilai: null }
    if (m === 'kurang') return { status: 'Belum lengkap', ok: false, nilai: null }
    const hasil = bangunSebaranManual(mapel, m)
    if ('error' in hasil) return { status: hasil.error, ok: false, nilai: null }
    const manual = angka(nilaiManual[r.siswaId])
    const nilai = manual != null && !Number.isNaN(manual) ? manual : nilaiDariSebaran(hasil.sebaran)
    if (nilai < 0 || nilai > 100) return { status: 'Nilai akhir harus 0–100', ok: false, nilai: null }
    return { status: 'Siap disimpan', ok: true, nilai }
  }

  async function simpanSemua() {
    onError('')
    onInfo('')
    // 1) Poin maksimum harus konsisten (dasar = materi).
    const nol: Record<string, NilaiInputSebaran> = {}
    for (const g of kelompok) {
      const m = angka(maks[g.id])
      if (m == null || Number.isNaN(m)) {
        onError(`Poin maksimum ${g.nama} belum diisi.`)
        return
      }
      nol[g.id] = { poin: 0, maks: m }
    }
    const cek = bangunSebaranManual(mapel, nol)
    if ('error' in cek) {
      onError(cek.error)
      return
    }
    // 2) Validasi semua baris dulu — tidak menyimpan apa pun bila ada yang salah.
    const antrian: { r: BarisRekapTka; nilai: number; sebaran: SebaranMapelTka }[] = []
    const salah: string[] = []
    for (const r of dapatDiisi) {
      const m = masukan(r)
      if (m == null) continue
      if (m === 'kurang') {
        salah.push(`${r.siswaNama}: poin belum lengkap`)
        continue
      }
      const hasil = bangunSebaranManual(mapel, m)
      if ('error' in hasil) {
        salah.push(`${r.siswaNama}: ${hasil.error}`)
        continue
      }
      const t = tinjau(r)
      if (!t.ok || t.nilai == null) {
        salah.push(`${r.siswaNama}: ${t.status}`)
        continue
      }
      antrian.push({ r, nilai: t.nilai, sebaran: hasil.sebaran })
    }
    if (salah.length) {
      onError(`Perbaiki dulu ${salah.length} baris — ${salah.slice(0, 4).join(' · ')}${salah.length > 4 ? ' …' : ''}`)
      return
    }
    if (antrian.length === 0) {
      onError('Belum ada poin yang diisi.')
      return
    }
    if (
      !window.confirm(
        `Simpan sebaran ${label} ${NAMA_TAHAP_TRYOUT_TKA[tahap]} untuk ${antrian.length} siswa?\n` +
          `Nilai akhir ikut diperbarui (sumber: manual).`,
      )
    ) {
      return
    }
    setBusy(true)
    const gagal: string[] = []
    let ok = 0
    for (const a of antrian) {
      try {
        await simpanNilaiManualTka({
          kelas: a.r.kelas,
          tahap,
          siswaId: a.r.siswaId,
          siswaNama: a.r.siswaNama,
          mapel,
          nilai: a.nilai,
          sebaran: a.sebaran,
          namaGuru,
        })
        ok += 1
      } catch (e) {
        gagal.push(`${a.r.siswaNama}: ${e instanceof Error ? e.message : 'gagal'}`)
      }
    }
    setBusy(false)
    if (gagal.length) onError(`Gagal menyimpan ${gagal.length} siswa — ${gagal.slice(0, 3).join(' · ')}`)
    if (ok) onInfo(`Sebaran ${label} tersimpan untuk ${ok} siswa. Tekan «Perbarui publikasi» agar portal ikut berubah.`)
    await onSelesai()
    if (!gagal.length) onTutup()
  }

  function setP(siswaId: string, g: KelompokInputSebaran, v: string) {
    setPoin((prev) => ({ ...prev, [siswaId]: { ...(prev[siswaId] ?? {}), [g.id]: v } }))
  }

  const nTerisi = dapatDiisi.filter((r) => masukan(r) != null).length

  return (
    <section className="tka-sbm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="tka-sb-judul">
            Input sebaran manual · {label} · {NAMA_TAHAP_TRYOUT_TKA[tahap]}
          </h2>
          <p className="text-xs text-slate-500">
            Untuk try out di luar LMS. Isi <strong>poin maksimum</strong> tiap kompetensi satu kali
            (baris pertama), lalu <strong>poin yang diperoleh</strong> tiap siswa. Nilai akhir
            dihitung otomatis dari poin (poin ÷ maks × 100) dan boleh ditimpa. Kosongkan seluruh
            baris siswa untuk melewatinya.
            {mapel === 'TKA Bahasa Indonesia'
              ? ' Pada Bahasa Indonesia, L1–L3 sekaligus menjadi Pemahaman Tekstual / Inferensial / Evaluasi dan Apresiasi.'
              : ''}
          </p>
          {nOtomatis > 0 && (
            <p className="text-xs text-slate-500">
              {nOtomatis} siswa tidak ditampilkan karena nilainya otomatis dari kuis LMS (sebaran sudah
              dihitung dari jawaban).
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className="lms-btn-secondary text-sm" disabled={busy} onClick={onTutup}>
            Tutup
          </button>
          <button
            type="button"
            className="lms-btn-primary text-sm"
            disabled={busy || nTerisi === 0}
            onClick={() => void simpanSemua()}
          >
            {busy ? 'Menyimpan…' : `Simpan (${nTerisi} siswa)`}
          </button>
        </div>
      </div>

      {dapatDiisi.length === 0 ? (
        <div className="lms-empty">Semua siswa pada filter ini bernilai otomatis dari LMS.</div>
      ) : (
        <div className="tka-rekap-table-wrap">
          <table className="tka-rekap-table tka-sb-table">
            <thead>
              <tr>
                <th className="tka-rekap-th-nama" rowSpan={2}>
                  Siswa
                </th>
                <th rowSpan={2}>Kelas</th>
                {grup.map((g) => (
                  <th key={g.label} colSpan={g.jumlah} className="tka-sb-grup">
                    {g.label}
                  </th>
                ))}
                <th rowSpan={2}>Nilai akhir</th>
                <th rowSpan={2}>Status</th>
              </tr>
              <tr>
                {kelompok.map((g) => (
                  <th key={g.id}>{g.nama}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="tka-sbm-maks">
                <td className="tka-rekap-nama" colSpan={2}>
                  <strong>Poin maksimum</strong>
                </td>
                {kelompok.map((g) => (
                  <td key={g.id} className="tka-sb-hitung">
                    <input
                      className="lms-input tka-sbm-input"
                      inputMode="decimal"
                      value={maks[g.id] ?? ''}
                      onChange={(e) => setMaks((p) => ({ ...p, [g.id]: e.target.value }))}
                      aria-label={`Poin maksimum ${g.nama}`}
                      placeholder="maks"
                    />
                  </td>
                ))}
                <td />
                <td />
              </tr>
              {dapatDiisi.map((r) => {
                const t = tinjau(r)
                const m = masukan(r)
                let preview: number | null = null
                if (m && m !== 'kurang') {
                  const h = bangunSebaranManual(mapel, m)
                  if ('sebaran' in h) preview = nilaiDariSebaran(h.sebaran)
                }
                return (
                  <tr key={`${r.kelas}-${r.siswaId}`}>
                    <td className="tka-rekap-nama">{r.siswaNama}</td>
                    <td className="tka-rekap-kelas">{r.kelas}</td>
                    {kelompok.map((g) => (
                      <td key={g.id} className="tka-sb-hitung">
                        <input
                          className="lms-input tka-sbm-input"
                          inputMode="decimal"
                          value={poin[r.siswaId]?.[g.id] ?? ''}
                          onChange={(e) => setP(r.siswaId, g, e.target.value)}
                          aria-label={`Poin ${g.nama} ${r.siswaNama}`}
                        />
                      </td>
                    ))}
                    <td className="tka-sb-hitung">
                      <input
                        className="lms-input tka-sbm-input"
                        inputMode="decimal"
                        value={nilaiManual[r.siswaId] ?? ''}
                        onChange={(e) => setNilaiManual((p) => ({ ...p, [r.siswaId]: e.target.value }))}
                        placeholder={preview != null ? String(preview) : '—'}
                        aria-label={`Nilai akhir ${r.siswaNama}`}
                      />
                    </td>
                    <td className={t.ok ? 'tka-sbm-ok' : t.status ? 'tka-sbm-salah' : 'tka-sb-sub-teks'}>
                      {t.status || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

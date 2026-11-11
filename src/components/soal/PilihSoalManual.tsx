import { useEffect, useMemo, useState } from 'react'
import { teksPolos } from '../../lib/html'
import type { PaketSoal, Soal, TipeSoal } from '../../types/soal'
import { NAMA_KOMPLEKSITAS, NAMA_TIPE, normalisasiKompleksitas } from '../../types/soal'
import SoalTampil from './SoalTampil'
import StimulusSoal, { punyaStimulus } from './StimulusSoal'

export type PilihanSoalRef = { paketId: string; soalId: string }

type Item = {
  paketId: string
  paketJudul: string
  soal: Soal
  indexInPaket: number
}

type Props = {
  paketDipilih: PaketSoal[]
  pilihan: PilihanSoalRef[]
  onToggle: (paketId: string, soalId: string) => void
  /** Bentuk yang ditampilkan di filter (TKA: pg/pgk/bs). */
  tipePilihan: readonly TipeSoal[]
}

/**
 * Pemilihan soal manual: daftar kiri + panel pratinjau penuh kanan
 * (stimulus, gambar, opsi, kunci guru) — UX katalog, bukan potongan 100 karakter.
 */
export default function PilihSoalManual({ paketDipilih, pilihan, onToggle, tipePilihan }: Props) {
  const [q, setQ] = useState('')
  const [filterTipe, setFilterTipe] = useState<'' | TipeSoal>('')
  const [fokus, setFokus] = useState<PilihanSoalRef | null>(null)

  const items: Item[] = useMemo(() => {
    const out: Item[] = []
    for (const p of paketDipilih) {
      ;(p.soal ?? []).forEach((s, i) => {
        out.push({ paketId: p.id, paketJudul: p.judul || 'Paket', soal: s, indexInPaket: i })
      })
    }
    return out
  }, [paketDipilih])

  const tersaring = useMemo(() => {
    const kata = q.trim().toLowerCase()
    return items.filter((it) => {
      if (filterTipe && it.soal.tipe !== filterTipe) return false
      if (!kata) return true
      const hay = [
        teksPolos(it.soal.teks),
        it.soal.stimulus ? teksPolos(it.soal.stimulus) : '',
        it.soal.tipeMateri || '',
        it.paketJudul,
        NAMA_TIPE[it.soal.tipe] || it.soal.tipe,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(kata)
    })
  }, [items, q, filterTipe])

  // Pertahankan fokus bila masih ada; jika tidak, fokus item pertama tersaring.
  useEffect(() => {
    if (fokus && tersaring.some((it) => it.paketId === fokus.paketId && it.soal.id === fokus.soalId)) {
      return
    }
    if (tersaring.length === 0) {
      setFokus(null)
      return
    }
    setFokus({ paketId: tersaring[0].paketId, soalId: tersaring[0].soal.id })
  }, [tersaring, fokus])

  const itemFokus = useMemo(() => {
    if (!fokus) return null
    return items.find((it) => it.paketId === fokus.paketId && it.soal.id === fokus.soalId) ?? null
  }, [items, fokus])

  const dipilih = (paketId: string, soalId: string) =>
    pilihan.some((x) => x.paketId === paketId && x.soalId === soalId)

  const seed = useMemo(() => 'pilih-manual', [])

  return (
    <div className="pilih-soal">
      <div className="pilih-soal-toolbar">
        <label className="pilih-soal-cari">
          <span className="sr-only">Cari soal</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari teks, stimulus, materi…"
          />
        </label>
        <select
          value={filterTipe}
          onChange={(e) => setFilterTipe(e.target.value as '' | TipeSoal)}
          aria-label="Filter bentuk soal"
        >
          <option value="">Semua bentuk</option>
          {tipePilihan.map((t) => (
            <option key={t} value={t}>
              {NAMA_TIPE[t]}
            </option>
          ))}
        </select>
        <span className="pilih-soal-count">
          {pilihan.length} dipilih · {tersaring.length}/{items.length} tampil
        </span>
      </div>

      <div className="pilih-soal-layout">
        <div className="pilih-soal-daftar" role="listbox" aria-label="Daftar soal">
          {tersaring.length === 0 ? (
            <p className="pilih-soal-kosong">Tidak ada soal yang cocok. Ubah pencarian atau pilih paket lain.</p>
          ) : (
            tersaring.map((it) => {
              const aktif = fokus?.paketId === it.paketId && fokus?.soalId === it.soal.id
              const checked = dipilih(it.paketId, it.soal.id)
              const cuplikan = teksPolos(it.soal.teks).slice(0, 90) || '(tanpa teks soal)'
              return (
                <div
                  key={`${it.paketId}-${it.soal.id}`}
                  role="option"
                  aria-selected={aktif}
                  className={`pilih-soal-item ${aktif ? 'pilih-soal-item--aktif' : ''} ${checked ? 'pilih-soal-item--dicek' : ''}`}
                  onClick={() => setFokus({ paketId: it.paketId, soalId: it.soal.id })}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(it.paketId, it.soal.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih soal ${it.indexInPaket + 1}`}
                  />
                  <div className="pilih-soal-item-isi min-w-0">
                    <div className="pilih-soal-item-meta">
                      <span className="pilih-soal-badge">{NAMA_TIPE[it.soal.tipe]}</span>
                      <span className="pilih-soal-badge pilih-soal-badge--soft">
                        {NAMA_KOMPLEKSITAS[normalisasiKompleksitas(it.soal.kompleksitas)]}
                      </span>
                      {it.soal.tipeMateri && (
                        <span className="pilih-soal-badge pilih-soal-badge--soft" title={it.soal.tipeMateri}>
                          {it.soal.tipeMateri}
                        </span>
                      )}
                      {normalisasiDomainTka(it.soal.domainTka) && (
                        <span
                          className="pilih-soal-badge pilih-soal-badge--soft"
                          title={NAMA_DOMAIN_TKA[normalisasiDomainTka(it.soal.domainTka)!]}
                        >
                          {NAMA_DOMAIN_TKA[normalisasiDomainTka(it.soal.domainTka)!]}
                        </span>
                      )}
                      {(it.soal.gambarId || punyaStimulus(it.soal)) && (
                        <span className="pilih-soal-badge pilih-soal-badge--media" title="Ada gambar/stimulus">
                          media
                        </span>
                      )}
                    </div>
                    <p className="pilih-soal-cuplikan">
                      <span className="text-slate-400">{it.indexInPaket + 1}.</span> {cuplikan}
                    </p>
                    <p className="pilih-soal-paket">{it.paketJudul}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="pilih-soal-pratinjau" aria-live="polite">
          {!itemFokus ? (
            <div className="pilih-soal-pratinjau-kosong">
              <p>Pilih baris di kiri untuk melihat soal lengkap (teks, stimulus, gambar, opsi).</p>
            </div>
          ) : (
            <>
              <div className="pilih-soal-pratinjau-kepala">
                <div className="min-w-0">
                  <p className="pilih-soal-pratinjau-sub">Pratinjau lengkap · {itemFokus.paketJudul}</p>
                  <div className="pilih-soal-item-meta">
                    <span className="pilih-soal-badge">{NAMA_TIPE[itemFokus.soal.tipe]}</span>
                    <span className="pilih-soal-badge pilih-soal-badge--soft">
                      {NAMA_KOMPLEKSITAS[normalisasiKompleksitas(itemFokus.soal.kompleksitas)]}
                    </span>
                    {itemFokus.soal.tipeMateri && (
                      <span className="pilih-soal-badge pilih-soal-badge--soft">{itemFokus.soal.tipeMateri}</span>
                    )}
                    {normalisasiDomainTka(itemFokus.soal.domainTka) && (
                      <span className="pilih-soal-badge pilih-soal-badge--soft">
                        {NAMA_DOMAIN_TKA[normalisasiDomainTka(itemFokus.soal.domainTka)!]}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={
                    dipilih(itemFokus.paketId, itemFokus.soal.id)
                      ? 'lms-btn-secondary'
                      : 'lms-btn-primary'
                  }
                  onClick={() => onToggle(itemFokus.paketId, itemFokus.soal.id)}
                >
                  {dipilih(itemFokus.paketId, itemFokus.soal.id) ? 'Keluarkan dari kuis' : 'Pilih soal ini'}
                </button>
              </div>

              <div className="pilih-soal-pratinjau-badan">
                {punyaStimulus(itemFokus.soal) && (
                  <StimulusSoal soal={itemFokus.soal} className="pilih-soal-stimulus" />
                )}
                <SoalTampil
                  soal={itemFokus.soal}
                  nomor={itemFokus.indexInPaket + 1}
                  seed={seed}
                  jawaban={undefined}
                  onJawab={() => {}}
                  tanpaStimulus
                />
                <KunciGuru soal={itemFokus.soal} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Ringkas kunci untuk guru saat memilih (bukan untuk siswa). */
function KunciGuru({ soal }: { soal: Soal }) {
  let isi: string | null = null
  if (soal.tipe === 'pg') {
    const o = soal.opsi.find((x) => x.id === soal.kunci)
    isi = o ? `Opsi: ${teksPolos(o.teks).slice(0, 120) || '(gambar/opsi)'}` : null
  } else if (soal.tipe === 'pgk') {
    const teks = soal.opsi
      .filter((o) => soal.kunci.includes(o.id))
      .map((o) => teksPolos(o.teks).slice(0, 60) || '…')
      .join(' · ')
    isi = teks ? `Opsi benar: ${teks}` : null
  } else if (soal.tipe === 'bs') {
    const nBenar = soal.pernyataan.filter((p) => p.benar).length
    isi = `${nBenar}/${soal.pernyataan.length} pernyataan «${soal.labelBenar || 'Benar'}»`
  } else if (soal.tipe === 'isian') {
    isi = `Jawaban: ${(soal.kunci || []).filter(Boolean).join(' / ') || '—'}`
  } else if (soal.tipe === 'jodoh') {
    isi = `${soal.pasangan.length} pasangan`
  } else if (soal.tipe === 'uraian') {
    isi = soal.kunciJawaban ? teksPolos(soal.kunciJawaban).slice(0, 160) : 'Dinilai manual'
  }
  if (!isi) return null
  return (
    <div className="pilih-soal-kunci" role="note">
      <strong>Kunci (hanya guru)</strong>
      <p>{isi}</p>
    </div>
  )
}

import { useState } from 'react'
import { GambarPicker } from './GambarSoal'
import AiSoalPanel from './AiSoalPanel'
import JawabanEditor from './JawabanEditor'
import RichEditor from './RichEditor'
import { AngkaInput } from './kontrol'
import { masalahSoal, ubahTipe } from '../../lib/soal'
import type { KompleksitasSoal, Soal, TipeSoal } from '../../types/soal'
import { NAMA_KOMPLEKSITAS, URUTAN_KOMPLEKSITAS, normalisasiKompleksitas } from '../../types/soal'
import { NAMA_TIPE, URUTAN_TIPE } from '../../types/soal'

type Props = {
  soal: Soal
  nomor: number
  onChange: (s: Soal) => void
  kelas?: string
  mapel?: string
  tpNama?: string
  tpNomor?: number
  uid?: string
  soalLain?: string[]
}

/** Kartu editor satu soal (mengikuti tata letak referensi: tipe, teks + gambar, pilihan, pengaturan bawah). */
export default function SoalEditorKartu({
  soal, nomor, onChange, kelas, mapel, tpNama, tpNomor, uid, soalLain,
}: Props) {
  const [pembahasanTerbuka, setPembahasanTerbuka] = useState(!!soal.pembahasan)
  const masalah = masalahSoal(soal)
  const punyaAcak = soal.tipe === 'pg' || soal.tipe === 'pgk'

  return (
    <article className="soal-kartu" aria-label={`Soal ${nomor}`}>
      <header className="soal-kartu-kepala">
        <label className="soal-tipe-pilih">
          <span className="sr-only">Tipe soal</span>
          <select
            value={soal.tipe}
            onChange={(e) => onChange(ubahTipe(soal, e.target.value as TipeSoal))}
            aria-label="Tipe soal"
          >
            {URUTAN_TIPE.map((t) => (
              <option key={t} value={t}>
                {NAMA_TIPE[t]}
              </option>
            ))}
          </select>
        </label>
        {masalah.length > 0 && (
          <span className="soal-peringatan" title={masalah.join('\n')}>
            ⚠ {masalah.length} hal perlu dilengkapi
          </span>
        )}
      </header>

      {(kelas && mapel) && (
        <div className="soal-kartu-ai">
          <AiSoalPanel
            uid={uid}
            soal={soal}
            nomor={nomor}
            kelas={kelas}
            mapel={mapel}
            tpNama={tpNama}
            tpNomor={tpNomor}
            onTerapkan={onChange}
            soalLain={soalLain}
          />
        </div>
      )}

      <div className="soal-kartu-badan">
        <h3 className="soal-label">
          <span className="soal-label-ikon" aria-hidden>?</span>
          Soal {nomor} <span className="soal-wajib">*</span>
        </h3>

        <div className="soal-teks-baris">
          <div className="soal-teks-kolom">
            <RichEditor
              key={`t-${soal.id}`}
              value={soal.teks}
              minRem={9}
              placeholder="Ketik pertanyaan di sini…"
              ariaLabel={`Teks soal ${nomor}`}
              onChange={(h) => onChange({ ...soal, teks: h })}
            />
          </div>
          <div className="soal-gambar-kolom">
            <GambarPicker
              gambarId={soal.gambarId}
              label="Tambah gambar soal"
              onChange={(id) => onChange({ ...soal, gambarId: id })}
              ai={kelas && mapel ? { teksSoal: soal.teks, kelas, mapel } : undefined}
            />
          </div>
        </div>

        <JawabanEditor soal={soal} onChange={onChange} />

        <div className="soal-pembahasan">
          {pembahasanTerbuka ? (
            <>
              <div className="soal-blok-kepala">
                <h4 className="soal-blok-judul">Pembahasan (opsional)</h4>
                <span className="soal-sekat" />
                {!soal.pembahasan && (
                  <button type="button" className="lms-btn-ghost" onClick={() => setPembahasanTerbuka(false)}>
                    Tutup
                  </button>
                )}
              </div>
              <RichEditor
                key={`p-${soal.id}`}
                value={soal.pembahasan ?? ''}
                minRem={5}
                placeholder="Penjelasan yang tampil setelah siswa menjawab…"
                ariaLabel="Pembahasan"
                onChange={(h) => onChange({ ...soal, pembahasan: h || undefined })}
              />
            </>
          ) : (
            <button type="button" className="soal-tambah" onClick={() => setPembahasanTerbuka(true)}>
              + Tambah pembahasan
            </button>
          )}
        </div>
      </div>

      <footer className="soal-kartu-kaki">
        {punyaAcak && (soal.tipe === 'pg' || soal.tipe === 'pgk') && (
          <label className="soal-kaki-kolom">
            <span>Urutan pilihan</span>
            <select
              className="soal-input"
              value={soal.acakOpsi ? 'acak' : 'tetap'}
              onChange={(e) => onChange({ ...soal, acakOpsi: e.target.value === 'acak' })}
            >
              <option value="tetap">Urutan tetap seperti ini</option>
              <option value="acak">Acak urutan pilihan</option>
            </select>
          </label>
        )}
        <label className="soal-kaki-kolom soal-kaki-kolom--kecil">
          <span>Kompleksitas</span>
          <select
            className="soal-input"
            value={normalisasiKompleksitas(soal.kompleksitas)}
            onChange={(e) => onChange({ ...soal, kompleksitas: e.target.value as KompleksitasSoal })}
            aria-label="Kompleksitas soal"
            title={NAMA_KOMPLEKSITAS[normalisasiKompleksitas(soal.kompleksitas)]}
          >
            {URUTAN_KOMPLEKSITAS.map((k) => (
              <option key={k} value={k}>{NAMA_KOMPLEKSITAS[k]}</option>
            ))}
          </select>
        </label>
        <div className="soal-kaki-kolom soal-kaki-kolom--kecil">
          <span>Estimasi waktu</span>
          <AngkaInput ariaLabel="Estimasi waktu (menit)" nilai={soal.waktuMenit} min={0} maks={120}
            satuan="Menit" onChange={(n) => onChange({ ...soal, waktuMenit: n })} />
        </div>
        <div className="soal-kaki-kolom soal-kaki-kolom--kecil">
          <span>Poin soal</span>
          <AngkaInput ariaLabel="Poin soal" nilai={soal.poin} min={0.5} maks={100}
            satuan="Poin" onChange={(n) => onChange({ ...soal, poin: n })} />
        </div>
      </footer>
    </article>
  )
}

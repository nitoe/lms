import { useMemo } from 'react'
import { GambarSoal } from './GambarSoal'
import RichView from './RichView'
import type { HasilNilai } from '../../lib/penilaian'
import type { JawabanSoal, OpsiSoal, Soal } from '../../types/soal'
import { NAMA_TIPE } from '../../types/soal'

/** Pengacak deterministik (mulberry32) agar urutan stabil selama satu sesi pengerjaan. */
function acakStabil<T>(arr: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type Props = {
  soal: Soal
  nomor: number
  jawaban: JawabanSoal | undefined
  onJawab: (j: JawabanSoal) => void
  /** Kunci acak (mis. id sesi) supaya urutan acak konsisten. */
  seed: string
  /** Tampilkan kunci & hasil (setelah diperiksa). */
  diperiksa?: boolean
  hasil?: HasilNilai
}

const LABEL_STATUS: Record<string, string> = {
  benar: 'Benar',
  sebagian: 'Sebagian benar',
  salah: 'Belum tepat',
  kosong: 'Belum dijawab',
  manual: 'Dinilai guru',
}

function KontenOpsi({ o }: { o: OpsiSoal }) {
  return (
    <span className="tampil-opsi-isi">
      {o.teks && <span>{o.teks}</span>}
      {o.gambarId && <GambarSoal id={o.gambarId} className="soal-img--kecil" />}
    </span>
  )
}

/** Tampilan soal seperti yang dilihat siswa. Dipakai pratinjau guru (2a) dan pengerjaan siswa (2b). */
export default function SoalTampil({ soal, nomor, jawaban, onJawab, seed, diperiksa = false, hasil }: Props) {
  const opsiTampil = useMemo(() => {
    if (soal.tipe !== 'pg' && soal.tipe !== 'pgk') return []
    return soal.acakOpsi ? acakStabil(soal.opsi, `${seed}:${soal.id}`) : soal.opsi
  }, [soal, seed])

  const kananTampil = useMemo(() => {
    if (soal.tipe !== 'jodoh') return []
    return acakStabil(soal.pasangan, `${seed}:${soal.id}:k`)
  }, [soal, seed])

  const kosongAtauBukan = (v: unknown) => v === undefined

  return (
    <section className={`tampil ${diperiksa && hasil ? `tampil--${hasil.status}` : ''}`}>
      <header className="tampil-kepala">
        <span className="tampil-no">{nomor}</span>
        <span className="tampil-tipe">{NAMA_TIPE[soal.tipe]}</span>
        <span className="tampil-poin">{soal.poin} poin</span>
        {diperiksa && hasil && (
          <span className={`tampil-status tampil-status--${hasil.status}`}>
            {LABEL_STATUS[hasil.status]}
            {hasil.status !== 'manual' && hasil.status !== 'kosong' ? ` · ${hasil.skor}/${hasil.maks}` : ''}
          </span>
        )}
      </header>

      <RichView html={soal.teks} className="tampil-teks" />
      {soal.gambarId && <GambarSoal id={soal.gambarId} className="soal-img--soal" />}

      {(soal.tipe === 'pg' || soal.tipe === 'pgk') && (
        <ul className="tampil-opsi">
          {opsiTampil.map((o) => {
            const benar = soal.tipe === 'pg' ? soal.kunci === o.id : soal.kunci.includes(o.id)
            const dipilih = soal.tipe === 'pg' ? jawaban === o.id : Array.isArray(jawaban) && jawaban.includes(o.id)
            const kelas = diperiksa
              ? benar ? 'tampil-opsi-item--benar' : dipilih ? 'tampil-opsi-item--salah' : ''
              : dipilih ? 'tampil-opsi-item--pilih' : ''
            return (
              <li key={o.id}>
                <label className={`tampil-opsi-item ${kelas}`}>
                  <input
                    type={soal.tipe === 'pg' ? 'radio' : 'checkbox'}
                    name={`j-${soal.id}`}
                    checked={dipilih}
                    disabled={diperiksa}
                    onChange={() => {
                      if (soal.tipe === 'pg') onJawab(o.id)
                      else {
                        const cur = Array.isArray(jawaban) ? jawaban : []
                        onJawab(cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id])
                      }
                    }}
                  />
                  <KontenOpsi o={o} />
                  {diperiksa && benar && <span className="tampil-tanda" aria-label="Jawaban benar">✓</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {soal.tipe === 'jodoh' && (
        <ul className="tampil-jodoh">
          {soal.pasangan.map((p) => {
            const j = (typeof jawaban === 'object' && jawaban && !Array.isArray(jawaban)
              ? (jawaban as Record<string, string>) : {})
            const pilih = j[p.id] ?? ''
            const benar = pilih === p.id
            return (
              <li key={p.id} className="tampil-jodoh-baris">
                <div className="tampil-jodoh-kiri">
                  {p.kiri && <span>{p.kiri}</span>}
                  {p.kiriGambarId && <GambarSoal id={p.kiriGambarId} className="soal-img--kecil" />}
                </div>
                <select
                  className="soal-input"
                  value={pilih}
                  disabled={diperiksa}
                  aria-label={`Pasangan untuk ${p.kiri || `baris ${p.id}`}`}
                  onChange={(e) => onJawab({ ...j, [p.id]: e.target.value })}
                >
                  <option value="">— pilih pasangan —</option>
                  {kananTampil.map((k) => (
                    <option key={k.id} value={k.id}>{k.kanan}</option>
                  ))}
                </select>
                {diperiksa && (
                  <span className={benar ? 'tampil-kunci tampil-kunci--benar' : 'tampil-kunci tampil-kunci--salah'}>
                    {benar ? '✓' : `Kunci: ${p.kanan}`}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {soal.tipe === 'bs' && (
        <table className="tampil-bs">
          <thead>
            <tr><th>Pernyataan</th><th>Benar</th><th>Salah</th></tr>
          </thead>
          <tbody>
            {soal.pernyataan.map((p) => {
              const j = (typeof jawaban === 'object' && jawaban && !Array.isArray(jawaban)
                ? (jawaban as Record<string, boolean>) : {})
              const v = j[p.id]
              const ok = diperiksa && v === p.benar
              const salah = diperiksa && !kosongAtauBukan(v) && v !== p.benar
              return (
                <tr key={p.id} className={ok ? 'tampil-bs--ok' : salah || (diperiksa && v === undefined) ? 'tampil-bs--no' : ''}>
                  <td>
                    {p.teks}
                    {diperiksa && v !== p.benar && (
                      <span className="tampil-kunci tampil-kunci--salah"> Kunci: {p.benar ? 'Benar' : 'Salah'}</span>
                    )}
                  </td>
                  <td><input type="radio" name={`bs-${soal.id}-${p.id}`} checked={v === true} disabled={diperiksa}
                    aria-label="Benar" onChange={() => onJawab({ ...j, [p.id]: true })} /></td>
                  <td><input type="radio" name={`bs-${soal.id}-${p.id}`} checked={v === false} disabled={diperiksa}
                    aria-label="Salah" onChange={() => onJawab({ ...j, [p.id]: false })} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {soal.tipe === 'isian' && (
        <div>
          <input
            className="soal-input"
            placeholder="Ketik jawabanmu…"
            value={typeof jawaban === 'string' ? jawaban : ''}
            disabled={diperiksa}
            maxLength={200}
            onChange={(e) => onJawab(e.target.value)}
          />
          {diperiksa && hasil?.status !== 'benar' && (
            <p className="tampil-kunci tampil-kunci--salah">
              Kunci: {soal.kunci.filter((k) => k.trim()).join(' / ')}
            </p>
          )}
        </div>
      )}

      {soal.tipe === 'uraian' && (
        <div>
          <textarea
            className="soal-input"
            rows={4}
            placeholder="Tulis jawabanmu…"
            value={typeof jawaban === 'string' ? jawaban : ''}
            disabled={diperiksa}
            maxLength={3000}
            onChange={(e) => onJawab(e.target.value)}
          />
          {diperiksa && soal.kunciJawaban && (
            <div className="tampil-pedoman">
              <strong>Pedoman guru:</strong>
              <RichView html={soal.kunciJawaban} />
            </div>
          )}
        </div>
      )}

      {diperiksa && soal.pembahasan && (
        <div className="tampil-bahas">
          <strong>Pembahasan</strong>
          <RichView html={soal.pembahasan} />
        </div>
      )}
    </section>
  )
}

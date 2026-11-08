import { GambarPicker } from './GambarSoal'
import RichEditor from './RichEditor'
import { Saklar } from './kontrol'
import { idAcak, ubahTipe } from '../../lib/soal'
import type { OpsiSoal, Soal } from '../../types/soal'
import { BATAS_OPSI } from '../../types/soal'

type Props = { soal: Soal; onChange: (s: Soal) => void }

function geser<T>(arr: T[], dari: number, ke: number): T[] {
  if (ke < 0 || ke >= arr.length) return arr
  const salin = [...arr]
  const [x] = salin.splice(dari, 1)
  salin.splice(ke, 0, x)
  return salin
}

function TombolUrut({ i, n, onGeser }: { i: number; n: number; onGeser: (arah: -1 | 1) => void }) {
  return (
    <div className="soal-urut">
      <button type="button" className="soal-ikon-btn" disabled={i === 0} onClick={() => onGeser(-1)}
        aria-label="Naikkan" title="Naikkan">▲</button>
      <button type="button" className="soal-ikon-btn" disabled={i === n - 1} onClick={() => onGeser(1)}
        aria-label="Turunkan" title="Turunkan">▼</button>
    </div>
  )
}

function TombolHapus({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="soal-ikon-btn soal-ikon-btn--bahaya" disabled={disabled} onClick={onClick}
      aria-label="Hapus" title="Hapus">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    </button>
  )
}

/* ───────────── Pilihan ganda & PG kompleks ───────────── */
function EditorPilihan({ soal, onChange }: { soal: Extract<Soal, { tipe: 'pg' | 'pgk' }>; onChange: (s: Soal) => void }) {
  const ganda = soal.tipe === 'pgk'
  const adaKunci = (id: string) => (soal.tipe === 'pg' ? soal.kunci === id : soal.kunci.includes(id))

  function setOpsi(opsi: OpsiSoal[]) {
    onChange({ ...soal, opsi })
  }
  function ubahOpsi(i: number, p: Partial<OpsiSoal>) {
    setOpsi(soal.opsi.map((o, k) => (k === i ? { ...o, ...p } : o)))
  }
  function tandaiKunci(id: string) {
    if (soal.tipe === 'pg') onChange({ ...soal, kunci: id })
    else {
      const k = soal.kunci.includes(id) ? soal.kunci.filter((x) => x !== id) : [...soal.kunci, id]
      onChange({ ...soal, kunci: k })
    }
  }
  function tambah() {
    if (soal.opsi.length >= BATAS_OPSI) return
    setOpsi([...soal.opsi, { id: idAcak(), teks: '' }])
  }
  function hapus(i: number) {
    if (soal.opsi.length <= 2) return
    const id = soal.opsi[i].id
    const opsi = soal.opsi.filter((_, k) => k !== i)
    if (soal.tipe === 'pg') onChange({ ...soal, opsi, kunci: soal.kunci === id ? '' : soal.kunci })
    else onChange({ ...soal, opsi, kunci: soal.kunci.filter((x) => x !== id) })
  }

  return (
    <section className="soal-blok" aria-label="Pilihan jawaban">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Pilihan jawaban <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar
          label="Jawaban ganda"
          aktif={ganda}
          onChange={(v) => onChange(ubahTipe(soal, v ? 'pgk' : 'pg'))}
        />
        <Saklar
          label="Jawaban bergambar"
          aktif={soal.opsiGambar}
          onChange={(v) => onChange({ ...soal, opsiGambar: v })}
        />
        {ganda && soal.tipe === 'pgk' && (
          <Saklar
            label="Skor sebagian"
            aktif={soal.nilaiParsial}
            onChange={(v) => onChange({ ...soal, nilaiParsial: v })}
          />
        )}
      </div>

      <p className="soal-petunjuk">
        {ganda ? 'Centang semua jawaban yang benar.' : 'Pilih satu jawaban yang benar.'}
      </p>

      <ul className="soal-opsi-list">
        {soal.opsi.map((o, i) => (
          <li key={o.id} className="soal-opsi">
            <input
              type={ganda ? 'checkbox' : 'radio'}
              name={`kunci-${soal.id}`}
              className="soal-kunci"
              checked={adaKunci(o.id)}
              onChange={() => tandaiKunci(o.id)}
              aria-label={`Tandai pilihan ${i + 1} sebagai benar`}
            />
            <div className="soal-opsi-isi">
              <input
                className="soal-input"
                value={o.teks}
                maxLength={300}
                placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                onChange={(e) => ubahOpsi(i, { teks: e.target.value })}
              />
              {soal.opsiGambar && (
                <GambarPicker kecil gambarId={o.gambarId} onChange={(id) => ubahOpsi(i, { gambarId: id })} />
              )}
            </div>
            <TombolUrut i={i} n={soal.opsi.length} onGeser={(a) => setOpsi(geser(soal.opsi, i, i + a))} />
            <TombolHapus disabled={soal.opsi.length <= 2} onClick={() => hapus(i)} />
          </li>
        ))}
      </ul>

      <button type="button" className="soal-tambah" disabled={soal.opsi.length >= BATAS_OPSI} onClick={tambah}>
        + Tambah jawaban
      </button>
    </section>
  )
}

/* ───────────── Menjodohkan ───────────── */
function EditorJodoh({ soal, onChange }: { soal: Extract<Soal, { tipe: 'jodoh' }>; onChange: (s: Soal) => void }) {
  const ubah = (i: number, p: Partial<(typeof soal.pasangan)[number]>) =>
    onChange({ ...soal, pasangan: soal.pasangan.map((x, k) => (k === i ? { ...x, ...p } : x)) })

  return (
    <section className="soal-blok" aria-label="Pasangan">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Pasangan <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar label="Skor sebagian" aktif={soal.nilaiParsial} onChange={(v) => onChange({ ...soal, nilaiParsial: v })} />
      </div>
      <p className="soal-petunjuk">
        Isi pasangan yang benar sejajar dalam satu baris. Sisi kanan akan diacak saat siswa mengerjakan.
      </p>
      <ul className="soal-opsi-list">
        {soal.pasangan.map((p, i) => (
          <li key={p.id} className="soal-opsi soal-opsi--jodoh">
            <span className="soal-nomor">{i + 1}</span>
            <div className="soal-opsi-isi">
              <input className="soal-input" value={p.kiri} maxLength={200} placeholder="Sisi kiri"
                onChange={(e) => ubah(i, { kiri: e.target.value })} />
              <GambarPicker kecil label="Gambar" gambarId={p.kiriGambarId}
                onChange={(id) => ubah(i, { kiriGambarId: id })} />
            </div>
            <span className="soal-panah" aria-hidden>⟷</span>
            <div className="soal-opsi-isi">
              <input className="soal-input" value={p.kanan} maxLength={200} placeholder="Pasangannya"
                onChange={(e) => ubah(i, { kanan: e.target.value })} />
            </div>
            <TombolUrut i={i} n={soal.pasangan.length}
              onGeser={(a) => onChange({ ...soal, pasangan: geser(soal.pasangan, i, i + a) })} />
            <TombolHapus disabled={soal.pasangan.length <= 2}
              onClick={() => onChange({ ...soal, pasangan: soal.pasangan.filter((_, k) => k !== i) })} />
          </li>
        ))}
      </ul>
      <button type="button" className="soal-tambah" disabled={soal.pasangan.length >= BATAS_OPSI}
        onClick={() => onChange({ ...soal, pasangan: [...soal.pasangan, { id: idAcak(), kiri: '', kanan: '' }] })}>
        + Tambah pasangan
      </button>
    </section>
  )
}

/* ───────────── Benar / Salah ───────────── */
function EditorBs({ soal, onChange }: { soal: Extract<Soal, { tipe: 'bs' }>; onChange: (s: Soal) => void }) {
  const ubah = (i: number, p: Partial<(typeof soal.pernyataan)[number]>) =>
    onChange({ ...soal, pernyataan: soal.pernyataan.map((x, k) => (k === i ? { ...x, ...p } : x)) })

  return (
    <section className="soal-blok" aria-label="Pernyataan">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Pernyataan <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar label="Skor sebagian" aktif={soal.nilaiParsial} onChange={(v) => onChange({ ...soal, nilaiParsial: v })} />
      </div>
      <p className="soal-petunjuk">Tulis tiap pernyataan, lalu tandai apakah pernyataan itu benar atau salah.</p>
      <ul className="soal-opsi-list">
        {soal.pernyataan.map((p, i) => (
          <li key={p.id} className="soal-opsi soal-opsi--bs">
            <span className="soal-nomor">{i + 1}</span>
            <div className="soal-opsi-isi">
              <input className="soal-input" value={p.teks} maxLength={400} placeholder="Pernyataan"
                onChange={(e) => ubah(i, { teks: e.target.value })} />
            </div>
            <div className="soal-segmen" role="radiogroup" aria-label={`Kunci pernyataan ${i + 1}`}>
              <button type="button" role="radio" aria-checked={p.benar}
                className={`soal-segmen-btn ${p.benar ? 'soal-segmen-btn--benar' : ''}`}
                onClick={() => ubah(i, { benar: true })}>Benar</button>
              <button type="button" role="radio" aria-checked={!p.benar}
                className={`soal-segmen-btn ${!p.benar ? 'soal-segmen-btn--salah' : ''}`}
                onClick={() => ubah(i, { benar: false })}>Salah</button>
            </div>
            <TombolUrut i={i} n={soal.pernyataan.length}
              onGeser={(a) => onChange({ ...soal, pernyataan: geser(soal.pernyataan, i, i + a) })} />
            <TombolHapus disabled={soal.pernyataan.length <= 1}
              onClick={() => onChange({ ...soal, pernyataan: soal.pernyataan.filter((_, k) => k !== i) })} />
          </li>
        ))}
      </ul>
      <button type="button" className="soal-tambah" disabled={soal.pernyataan.length >= BATAS_OPSI}
        onClick={() => onChange({ ...soal, pernyataan: [...soal.pernyataan, { id: idAcak(), teks: '', benar: true }] })}>
        + Tambah pernyataan
      </button>
    </section>
  )
}

/* ───────────── Isian singkat ───────────── */
function EditorIsian({ soal, onChange }: { soal: Extract<Soal, { tipe: 'isian' }>; onChange: (s: Soal) => void }) {
  return (
    <section className="soal-blok" aria-label="Kunci jawaban">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Kunci jawaban <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar label="Abaikan huruf besar/kecil" aktif={soal.abaikanKapital}
          onChange={(v) => onChange({ ...soal, abaikanKapital: v })} />
      </div>
      <p className="soal-petunjuk">
        Tambahkan semua bentuk jawaban yang dianggap benar (mis. «0,5» dan «1/2»). Angka desimal dengan koma atau titik
        dianggap sama.
      </p>
      <ul className="soal-opsi-list">
        {soal.kunci.map((k, i) => (
          <li key={i} className="soal-opsi">
            <span className="soal-nomor">{i + 1}</span>
            <div className="soal-opsi-isi">
              <input className="soal-input" value={k} maxLength={200} placeholder="Jawaban yang benar"
                onChange={(e) => onChange({ ...soal, kunci: soal.kunci.map((x, j) => (j === i ? e.target.value : x)) })} />
            </div>
            <TombolHapus disabled={soal.kunci.length <= 1}
              onClick={() => onChange({ ...soal, kunci: soal.kunci.filter((_, j) => j !== i) })} />
          </li>
        ))}
      </ul>
      <button type="button" className="soal-tambah" disabled={soal.kunci.length >= BATAS_OPSI}
        onClick={() => onChange({ ...soal, kunci: [...soal.kunci, ''] })}>
        + Tambah jawaban alternatif
      </button>
    </section>
  )
}

/* ───────────── Uraian ───────────── */
function EditorUraian({ soal, onChange }: { soal: Extract<Soal, { tipe: 'uraian' }>; onChange: (s: Soal) => void }) {
  return (
    <section className="soal-blok" aria-label="Pedoman penskoran">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Pedoman penskoran</h4>
      </div>
      <p className="soal-petunjuk">
        Soal uraian dinilai manual oleh guru. Tulis jawaban ideal atau rubrik skor sebagai pegangan (tidak ditampilkan
        ke siswa).
      </p>
      <RichEditor key={`ku-${soal.id}`} minRem={5} value={soal.kunciJawaban ?? ''}
        placeholder="Jawaban ideal / rubrik penskoran…" ariaLabel="Pedoman penskoran"
        onChange={(h) => onChange({ ...soal, kunciJawaban: h })} />
    </section>
  )
}

export default function JawabanEditor({ soal, onChange }: Props) {
  switch (soal.tipe) {
    case 'pg':
    case 'pgk':
      return <EditorPilihan soal={soal} onChange={onChange} />
    case 'jodoh':
      return <EditorJodoh soal={soal} onChange={onChange} />
    case 'bs':
      return <EditorBs soal={soal} onChange={onChange} />
    case 'isian':
      return <EditorIsian soal={soal} onChange={onChange} />
    case 'uraian':
      return <EditorUraian soal={soal} onChange={onChange} />
  }
}

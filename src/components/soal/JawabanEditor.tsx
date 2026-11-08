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
  const opsi = Array.isArray(soal.opsi) && soal.opsi.length >= 2
    ? soal.opsi
    : [
        { id: idAcak(), teks: '' },
        { id: idAcak(), teks: '' },
        { id: idAcak(), teks: '' },
        { id: idAcak(), teks: '' },
      ]
  const kunciArr = ganda
    ? (Array.isArray(soal.kunci) ? soal.kunci : [])
    : []
  const kunciPg = !ganda && typeof soal.kunci === 'string' ? soal.kunci : ''

  const adaKunci = (id: string) => (ganda ? kunciArr.includes(id) : kunciPg === id)

  function setOpsi(next: OpsiSoal[]) {
    if (ganda) onChange({ ...soal, tipe: 'pgk', opsi: next, kunci: kunciArr.filter((k) => next.some((o) => o.id === k)) })
    else onChange({ ...soal, tipe: 'pg', opsi: next, kunci: next.some((o) => o.id === kunciPg) ? kunciPg : '' })
  }
  function ubahOpsi(i: number, p: Partial<OpsiSoal>) {
    setOpsi(opsi.map((o, k) => (k === i ? { ...o, ...p } : o)))
  }
  function tandaiKunci(id: string) {
    if (!ganda) onChange({ ...soal, tipe: 'pg', opsi, kunci: id })
    else {
      const k = kunciArr.includes(id) ? kunciArr.filter((x) => x !== id) : [...kunciArr, id]
      onChange({ ...soal, tipe: 'pgk', opsi, kunci: k })
    }
  }
  function tambah() {
    if (opsi.length >= BATAS_OPSI) return
    setOpsi([...opsi, { id: idAcak(), teks: '' }])
  }
  function hapus(i: number) {
    if (opsi.length <= 2) return
    const id = opsi[i].id
    const next = opsi.filter((_, k) => k !== i)
    if (!ganda) onChange({ ...soal, tipe: 'pg', opsi: next, kunci: kunciPg === id ? '' : kunciPg })
    else onChange({ ...soal, tipe: 'pgk', opsi: next, kunci: kunciArr.filter((x) => x !== id) })
  }

  return (
    <section className="soal-blok" aria-label="Pilihan jawaban">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">
          {ganda ? 'Pilihan ganda kompleks' : 'Pilihan ganda'} <span className="soal-wajib">*</span>
        </h4>
        <span className="soal-sekat" />
        <Saklar
          label="Jawaban ganda"
          aktif={ganda}
          onChange={(v) => onChange(ubahTipe(soal, v ? 'pgk' : 'pg'))}
        />
        <Saklar
          label="Jawaban bergambar"
          aktif={!!soal.opsiGambar}
          onChange={(v) => onChange({ ...soal, opsiGambar: v })}
        />
        {ganda && (
          <Saklar
            label="Skor sebagian"
            aktif={!!soal.nilaiParsial}
            onChange={(v) => onChange({ ...soal, tipe: 'pgk', opsi, kunci: kunciArr, nilaiParsial: v })}
          />
        )}
      </div>

      <p className="soal-petunjuk">
        {ganda
          ? 'Centang semua pilihan yang benar. Aktifkan «Skor sebagian» bila jawaban sebagian masih mendapat poin.'
          : 'Pilih satu bulatan di kiri sebagai kunci jawaban yang benar.'}
      </p>

      <ul className="soal-opsi-list">
        {opsi.map((o, i) => (
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
            <TombolUrut i={i} n={opsi.length} onGeser={(a) => setOpsi(geser(opsi, i, i + a))} />
            <TombolHapus disabled={opsi.length <= 2} onClick={() => hapus(i)} />
          </li>
        ))}
      </ul>

      <button type="button" className="soal-tambah" disabled={opsi.length >= BATAS_OPSI} onClick={tambah}>
        + Tambah pilihan
      </button>
    </section>
  )
}

/* ───────────── Menjodohkan ───────────── */
function EditorJodoh({ soal, onChange }: { soal: Extract<Soal, { tipe: 'jodoh' }>; onChange: (s: Soal) => void }) {
  const pasangan = Array.isArray(soal.pasangan) && soal.pasangan.length >= 2
    ? soal.pasangan
    : [
        { id: idAcak(), kiri: '', kanan: '' },
        { id: idAcak(), kiri: '', kanan: '' },
      ]

  const setPasangan = (next: typeof pasangan) => onChange({ ...soal, tipe: 'jodoh', pasangan: next, nilaiParsial: !!soal.nilaiParsial })
  const ubah = (i: number, p: Partial<(typeof pasangan)[number]>) =>
    setPasangan(pasangan.map((x, k) => (k === i ? { ...x, ...p } : x)))

  return (
    <section className="soal-blok" aria-label="Pasangan">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Pasangan <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar
          label="Skor sebagian"
          aktif={!!soal.nilaiParsial}
          onChange={(v) => onChange({ ...soal, tipe: 'jodoh', pasangan, nilaiParsial: v })}
        />
      </div>
      <p className="soal-petunjuk">
        Isi pasangan yang benar dalam satu baris (kiri ↔ kanan). Saat siswa mengerjakan, sisi kanan diacak.
      </p>

      <div className="soal-jodoh-kepala" aria-hidden>
        <span className="soal-jodoh-label">Kiri</span>
        <span className="soal-jodoh-spasi" />
        <span className="soal-jodoh-label">Kanan (pasangan benar)</span>
        <span className="soal-jodoh-spasi-aksi" />
      </div>

      <ul className="soal-opsi-list">
        {pasangan.map((p, i) => (
          <li key={p.id} className="soal-opsi soal-opsi--jodoh">
            <span className="soal-nomor">{i + 1}</span>
            <div className="soal-jodoh-grid">
              <div className="soal-opsi-isi">
                <input
                  className="soal-input"
                  value={p.kiri}
                  maxLength={200}
                  placeholder="Sisi kiri"
                  onChange={(e) => ubah(i, { kiri: e.target.value })}
                />
                <GambarPicker kecil label="Gambar kiri" gambarId={p.kiriGambarId}
                  onChange={(id) => ubah(i, { kiriGambarId: id })} />
              </div>
              <span className="soal-panah" aria-hidden>⟷</span>
              <div className="soal-opsi-isi">
                <input
                  className="soal-input"
                  value={p.kanan}
                  maxLength={200}
                  placeholder="Pasangan kanan yang benar"
                  onChange={(e) => ubah(i, { kanan: e.target.value })}
                />
              </div>
            </div>
            <div className="soal-opsi-aksi">
              <TombolUrut i={i} n={pasangan.length}
                onGeser={(a) => setPasangan(geser(pasangan, i, i + a))} />
              <TombolHapus disabled={pasangan.length <= 2}
                onClick={() => setPasangan(pasangan.filter((_, k) => k !== i))} />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="soal-tambah"
        disabled={pasangan.length >= BATAS_OPSI}
        onClick={() => setPasangan([...pasangan, { id: idAcak(), kiri: '', kanan: '' }])}
      >
        + Tambah pasangan
      </button>
    </section>
  )
}

/* ───────────── Benar / Salah ───────────── */
function EditorBs({ soal, onChange }: { soal: Extract<Soal, { tipe: 'bs' }>; onChange: (s: Soal) => void }) {
  const pernyataan = Array.isArray(soal.pernyataan) && soal.pernyataan.length >= 1
    ? soal.pernyataan
    : [
        { id: idAcak(), teks: '', benar: true },
        { id: idAcak(), teks: '', benar: true },
        { id: idAcak(), teks: '', benar: false },
      ]

  const setPernyataan = (next: typeof pernyataan) =>
    onChange({ ...soal, tipe: 'bs', pernyataan: next, nilaiParsial: !!soal.nilaiParsial })
  const ubah = (i: number, p: Partial<(typeof pernyataan)[number]>) =>
    setPernyataan(pernyataan.map((x, k) => (k === i ? { ...x, ...p } : x)))

  return (
    <section className="soal-blok" aria-label="Pernyataan">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Pernyataan <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar
          label="Skor sebagian"
          aktif={!!soal.nilaiParsial}
          onChange={(v) => onChange({ ...soal, tipe: 'bs', pernyataan, nilaiParsial: v })}
        />
      </div>
      <p className="soal-petunjuk">
        Tulis tiap pernyataan, lalu tandai apakah pernyataan itu <strong>Benar</strong> atau <strong>Salah</strong>.
      </p>
      <ul className="soal-opsi-list">
        {pernyataan.map((p, i) => (
          <li key={p.id} className="soal-opsi soal-opsi--bs">
            <span className="soal-nomor">{i + 1}</span>
            <div className="soal-opsi-isi">
              <input
                className="soal-input"
                value={p.teks}
                maxLength={400}
                placeholder={`Pernyataan ${i + 1}`}
                onChange={(e) => ubah(i, { teks: e.target.value })}
              />
            </div>
            <div className="soal-segmen" role="radiogroup" aria-label={`Kunci pernyataan ${i + 1}`}>
              <button
                type="button"
                role="radio"
                aria-checked={p.benar === true}
                className={`soal-segmen-btn ${p.benar ? 'soal-segmen-btn--benar' : ''}`}
                onClick={() => ubah(i, { benar: true })}
              >
                Benar
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={p.benar === false}
                className={`soal-segmen-btn ${!p.benar ? 'soal-segmen-btn--salah' : ''}`}
                onClick={() => ubah(i, { benar: false })}
              >
                Salah
              </button>
            </div>
            <div className="soal-opsi-aksi">
              <TombolUrut i={i} n={pernyataan.length}
                onGeser={(a) => setPernyataan(geser(pernyataan, i, i + a))} />
              <TombolHapus disabled={pernyataan.length <= 1}
                onClick={() => setPernyataan(pernyataan.filter((_, k) => k !== i))} />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="soal-tambah"
        disabled={pernyataan.length >= BATAS_OPSI}
        onClick={() => setPernyataan([...pernyataan, { id: idAcak(), teks: '', benar: true }])}
      >
        + Tambah pernyataan
      </button>
    </section>
  )
}

/* ───────────── Isian singkat ───────────── */
function EditorIsian({ soal, onChange }: { soal: Extract<Soal, { tipe: 'isian' }>; onChange: (s: Soal) => void }) {
  const kunci = Array.isArray(soal.kunci) && soal.kunci.length >= 1 ? soal.kunci : ['']

  const setKunci = (next: string[]) =>
    onChange({ ...soal, tipe: 'isian', kunci: next, abaikanKapital: soal.abaikanKapital !== false })

  return (
    <section className="soal-blok" aria-label="Kunci jawaban isian">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Kunci jawaban <span className="soal-wajib">*</span></h4>
        <span className="soal-sekat" />
        <Saklar
          label="Abaikan huruf besar/kecil"
          aktif={soal.abaikanKapital !== false}
          onChange={(v) => onChange({ ...soal, tipe: 'isian', kunci, abaikanKapital: v })}
        />
      </div>
      <p className="soal-petunjuk">
        Tambahkan semua bentuk jawaban yang diterima (mis. «0,5» dan «1/2»). Desimal dengan koma atau titik dianggap sama.
      </p>
      <ul className="soal-opsi-list">
        {kunci.map((k, i) => (
          <li key={i} className="soal-opsi">
            <span className="soal-nomor">{i + 1}</span>
            <div className="soal-opsi-isi">
              <input
                className="soal-input"
                value={k}
                maxLength={200}
                placeholder="Jawaban yang benar"
                onChange={(e) => setKunci(kunci.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
            <TombolHapus
              disabled={kunci.length <= 1}
              onClick={() => setKunci(kunci.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="soal-tambah"
        disabled={kunci.length >= BATAS_OPSI}
        onClick={() => setKunci([...kunci, ''])}
      >
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
        <h4 className="soal-blok-judul">Pedoman penskoran (untuk guru)</h4>
      </div>
      <p className="soal-petunjuk">
        Soal uraian dinilai manual. Tulis jawaban ideal atau rubrik skor sebagai pegangan —
        <strong> tidak ditampilkan ke siswa</strong>.
      </p>
      <RichEditor
        key={`ku-${soal.id}`}
        minRem={6}
        value={soal.kunciJawaban ?? ''}
        placeholder="Jawaban ideal / rubrik penskoran… (opsional)"
        ariaLabel="Pedoman penskoran"
        onChange={(h) => onChange({ ...soal, tipe: 'uraian', kunciJawaban: h || undefined })}
      />
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
    default:
      return (
        <section className="soal-blok">
          <p className="soal-petunjuk">Tipe soal tidak dikenali. Pilih ulang tipe di atas.</p>
        </section>
      )
  }
}

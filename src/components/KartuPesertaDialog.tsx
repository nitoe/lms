import { useEffect, useMemo, useState } from 'react'
import type { Lomba } from '../types/lomba'
import {
  cetakKartuPeserta,
  KARTU_PER_HALAMAN,
  susunPesertaBernomor,
  tahunPelajaranOtomatis,
} from '../lib/kartuLomba'
import '../styles/kartuLomba.css'

/**
 * Dialog opsi cetak kartu peserta lomba (A4, 8 kartu/lembar).
 * Tombol «Cetak» memanggil cetakKartuPeserta LANGSUNG dari handler klik (window.open sinkron;
 * ANTIREGRESI §Lomba.29).
 */
export default function KartuPesertaDialog({
  lomba,
  onTutup,
}: {
  lomba: Lomba
  onTutup: () => void
}) {
  const peserta = useMemo(() => susunPesertaBernomor(lomba.siswaList), [lomba.siswaList])
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set(peserta.map((p) => p.id)))
  const [jadwal, setJadwal] = useState('')
  const [tahun, setTahun] = useState(() => tahunPelajaranOtomatis(lomba.mulai ?? new Date()))
  const [kotakFoto, setKotakFoto] = useState(false)
  const [proses, setProses] = useState(false)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !proses) onTutup()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onTutup, proses])

  const jumlah = terpilih.size
  const lembar = Math.ceil(jumlah / KARTU_PER_HALAMAN)
  const semua = jumlah === peserta.length

  function toggle(id: string) {
    setTerpilih((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function cetak() {
    setGalat('')
    setInfo('')
    setProses(true)
    cetakKartuPeserta(lomba, {
      pesertaIds: [...terpilih],
      jadwal,
      tahunPelajaran: tahun,
      kotakFoto,
    })
      .then((r) => {
        setInfo(`${r.jumlah} kartu (${r.lembar} lembar) dibuka di jendela baru. Cek lalu tekan «Cetak / Simpan PDF».`)
      })
      .catch((e: unknown) => {
        setGalat(e instanceof Error ? e.message : 'Gagal menyiapkan kartu.')
      })
      .finally(() => setProses(false))
  }

  return (
    <div className="kp-overlay" role="dialog" aria-modal="true" aria-label="Cetak kartu peserta">
      <div className="kp-dialog">
        <h2 className="kp-judul">Cetak kartu peserta</h2>
        <p className="kp-sub">
          {lomba.nama} · A4, {KARTU_PER_HALAMAN} kartu per lembar. NISN diambil dari data siswa saat dicetak.
        </p>

        <div className="kp-grid">
          <label className="kp-field kp-span">
            <span>Pelaksanaan (opsional)</span>
            <input
              type="text"
              value={jadwal}
              onChange={(e) => setJadwal(e.target.value)}
              maxLength={80}
              placeholder="Kosong = pakai masa lomba. Contoh: Sabtu, 22 Nov · 07.30 · Aula"
            />
          </label>
          <label className="kp-field">
            <span>Tahun pelajaran</span>
            <input type="text" value={tahun} onChange={(e) => setTahun(e.target.value)} maxLength={9} />
          </label>
          <label className="kp-cek">
            <input type="checkbox" checked={kotakFoto} onChange={(e) => setKotakFoto(e.target.checked)} />
            <span>Sisakan kotak foto 2×3</span>
          </label>
        </div>

        <div className="kp-peserta-head">
          <strong>Peserta ({jumlah}/{peserta.length})</strong>
          <button
            type="button"
            className="kp-link"
            onClick={() => setTerpilih(semua ? new Set() : new Set(peserta.map((p) => p.id)))}
          >
            {semua ? 'Kosongkan' : 'Pilih semua'}
          </button>
        </div>
        <ul className="kp-peserta">
          {peserta.map((p) => (
            <li key={p.id}>
              <label>
                <input type="checkbox" checked={terpilih.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="no">{String(p.no).padStart(2, '0')}</span>
                <span className="nm">{p.nama}</span>
                <span className="kl">{p.kelas}</span>
              </label>
            </li>
          ))}
        </ul>

        {galat && <p className="kp-galat" role="alert">{galat}</p>}
        {info && <p className="kp-info">{info}</p>}

        <div className="kp-aksi-dialog">
          <button type="button" className="kp-btn kp-btn--sek" onClick={onTutup} disabled={proses}>
            Tutup
          </button>
          <button type="button" className="kp-btn" onClick={cetak} disabled={proses || jumlah === 0}>
            {proses ? 'Menyiapkan…' : `Buka kartu (${jumlah} kartu · ${lembar} lembar)`}
          </button>
        </div>
      </div>
    </div>
  )
}

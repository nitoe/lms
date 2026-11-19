import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Soal } from '../../types/soal'
import { NAMA_TIPE } from '../../types/soal'
import { cariSoalGanda, hapusSoalGanda, type KebijakanGanda } from '../../lib/soalGanda'
import { teksPolos } from '../../lib/html'
import '../../styles/soal-ganda.css'

type Props<T extends Soal> = {
  soal: T[]
  /** Teks kecil di bawah tiap soal (mis. judul paket asal) agar mudah memilih. */
  keterangan?: (s: T, indeks: number) => string
  onTerapkan: (hasil: T[], dihapus: number) => void
  onTutup: () => void
}

/**
 * Dialog «Soal ganda»: mendeteksi soal berisi sama (atau mirip) dan menghapus kelebihannya.
 * Dipakai di editor paket (bank soal), detail kuis, dan semua ruang (mapel, TKA, Lomba).
 * Penerapan hanya mengubah daftar di memori pemanggil — pemanggil yang menyimpan (ANTIREGRESI §Soal.Ganda).
 */
export default function SoalGandaDialog<T extends Soal>({ soal, keterangan, onTerapkan, onTutup }: Props<T>) {
  const [mirip, setMirip] = useState(false)
  const [kebijakan, setKebijakan] = useState<KebijakanGanda>('pertama')
  const [pilihan, setPilihan] = useState<Record<number, number>>({})

  const kelompok = useMemo(() => cariSoalGanda(soal, { mirip }), [soal, mirip])

  useEffect(() => {
    setPilihan({})
  }, [mirip])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTutup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  const jaga = (nomor: number): number => {
    const g = kelompok[nomor]
    const p = pilihan[nomor]
    if (p !== undefined && g.indeks.includes(p)) return p
    return kebijakan === 'terakhir' ? g.indeks[g.indeks.length - 1] : g.indeks[0]
  }

  const jumlahHapus = kelompok.reduce((n, g) => n + g.indeks.length - 1, 0)

  function terapkan() {
    const peta: Record<number, number> = {}
    kelompok.forEach((_, i) => {
      peta[i] = jaga(i)
    })
    const { hasil, dihapus } = hapusSoalGanda(soal, kelompok, { pilihan: peta })
    onTerapkan(hasil, dihapus)
  }

  return createPortal(
    <div className="sg-lapisan" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup() }}>
      <div className="sg-dialog" role="dialog" aria-modal="true" aria-label="Soal ganda">
        <div className="sg-kepala">
          <div>
            <h3>Soal ganda</h3>
            <p>{soal.length} soal diperiksa menurut isinya (pilihan jawaban, huruf besar/kecil, dan tanda baca tidak berpengaruh).</p>
          </div>
          <button type="button" className="sg-tutup" onClick={onTutup} aria-label="Tutup" autoFocus>×</button>
        </div>

        <div className="sg-alat">
          <label className="sg-cek">
            <input type="checkbox" checked={mirip} onChange={(e) => setMirip(e.target.checked)} />
            <span>Sertakan soal yang mirip (≥ 90%, angka sama)</span>
          </label>
          {kelompok.length > 0 && (
            <div className="sg-pintas">
              <button type="button" className={`sg-btn${kebijakan === 'pertama' && Object.keys(pilihan).length === 0 ? ' sg-btn--on' : ''}`}
                onClick={() => { setKebijakan('pertama'); setPilihan({}) }}>
                Pertahankan yang pertama
              </button>
              <button type="button" className={`sg-btn${kebijakan === 'terakhir' && Object.keys(pilihan).length === 0 ? ' sg-btn--on' : ''}`}
                onClick={() => { setKebijakan('terakhir'); setPilihan({}) }}>
                Pertahankan yang terakhir
              </button>
            </div>
          )}
        </div>

        <div className="sg-isi">
          {kelompok.length === 0 ? (
            <p className="sg-kosong">
              {mirip ? 'Tidak ada soal ganda maupun yang mirip.' : 'Tidak ditemukan soal ganda.'}
              {!mirip && ' Centang «mirip» untuk mencari soal yang hampir sama.'}
            </p>
          ) : (
            <ol className="sg-daftar">
              {kelompok.map((g, nomor) => (
                <li key={g.indeks.join('-')} className="sg-kelompok">
                  <div className="sg-kelompok-kepala">
                    <b>Kelompok {nomor + 1}</b>
                    <span className={`sg-lencana${g.jenis === 'mirip' ? ' sg-lencana--mirip' : ''}`}>
                      {g.jenis === 'sama' ? 'Sama persis' : `Mirip ${Math.round(g.skor * 100)}%`}
                    </span>
                    {g.kunciBeda && <span className="sg-lencana sg-lencana--awas">Kunci berbeda</span>}
                  </div>
                  <ul className="sg-baris-daftar">
                    {g.indeks.map((i) => {
                      const s = soal[i]
                      const dijaga = jaga(nomor) === i
                      return (
                        <li key={i}>
                          <label className={`sg-baris${dijaga ? ' sg-baris--jaga' : ' sg-baris--hapus'}`}>
                            <input
                              type="radio"
                              name={`sg-${nomor}`}
                              checked={dijaga}
                              onChange={() => setPilihan((p) => ({ ...p, [nomor]: i }))}
                            />
                            <span className="sg-teks">
                              <b>
                                No. {i + 1} · {NAMA_TIPE[s.tipe]}
                                <em>{dijaga ? ' — dipertahankan' : ' — dihapus'}</em>
                              </b>
                              <span>{teksPolos(s.teks).slice(0, 160) || (s.stimulus ? teksPolos(s.stimulus).slice(0, 160) : '(tanpa teks)')}</span>
                              {keterangan && <small>{keterangan(s, i)}</small>}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="sg-kaki">
          <span>{kelompok.length > 0 ? `${kelompok.length} kelompok · ${jumlahHapus} soal akan dihapus` : ''}</span>
          <div>
            <button type="button" className="sg-btn" onClick={onTutup}>Batal</button>
            <button type="button" className="sg-btn sg-btn--utama" disabled={jumlahHapus === 0} onClick={terapkan}>
              Hapus {jumlahHapus || ''} soal ganda
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

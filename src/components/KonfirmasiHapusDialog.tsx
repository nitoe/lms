/**
 * Dialog konfirmasi penghapusan data penting (kuis TKA / kuis mapel).
 * Mencegah hapus tak sengaja: pengguna harus mengetik kata kunci (bawaan «HAPUS»).
 * ANTIREGRESI §119.
 */
import { useEffect, useId, useRef, useState } from 'react'
import '../styles/konfirmasi-hapus.css'

type Props = {
  /** Judul dialog, mis. «Hapus kuis?». */
  judul: string
  /** Nama objek yang dihapus (ditampilkan tebal). */
  nama: string
  /** Rincian dampak (daftar poin). */
  rincian?: string[]
  /** Peringatan khusus (mis. dampak ke rekap TKA). */
  peringatan?: string[]
  /** Saran alternatif non-destruktif. */
  saran?: string
  kataKunci?: string
  labelKonfirmasi?: string
  busy?: boolean
  onBatal: () => void
  onKonfirmasi: () => void
}

export default function KonfirmasiHapusDialog({
  judul,
  nama,
  rincian = [],
  peringatan = [],
  saran,
  kataKunci = 'HAPUS',
  labelKonfirmasi = 'Hapus permanen',
  busy = false,
  onBatal,
  onKonfirmasi,
}: Props) {
  const [ketik, setKetik] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const idJudul = useId()
  const idInput = useId()
  const cocok = ketik.trim().toUpperCase() === kataKunci.toUpperCase()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onBatal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onBatal])

  return (
    <div className="kh-overlay" role="presentation">
      <div className="kh-dialog" role="alertdialog" aria-modal="true" aria-labelledby={idJudul}>
        <h2 id={idJudul} className="kh-judul">
          {judul}
        </h2>
        <p className="kh-nama">«{nama}»</p>

        {peringatan.length > 0 && (
          <div className="kh-peringatan" role="note">
            <ul>
              {peringatan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {rincian.length > 0 && (
          <ul className="kh-rincian">
            {rincian.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {saran && <p className="kh-saran">{saran}</p>}

        <p className="kh-info">Tindakan ini <strong>tidak dapat dibatalkan</strong>.</p>
        <label className="kh-label" htmlFor={idInput}>
          Ketik <strong>{kataKunci}</strong> untuk melanjutkan
        </label>
        <input
          id={idInput}
          ref={inputRef}
          className="lms-input kh-input"
          value={ketik}
          onChange={(e) => setKetik(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && cocok && !busy) {
              e.preventDefault()
              onKonfirmasi()
            }
          }}
        />
        <div className="kh-aksi">
          <button type="button" className="lms-btn-secondary text-sm" disabled={busy} onClick={onBatal}>
            Batal
          </button>
          <button
            type="button"
            className="kh-btn-hapus"
            disabled={!cocok || busy}
            onClick={onKonfirmasi}
          >
            {busy ? 'Menghapus…' : labelKonfirmasi}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { AppUser } from '../types/user'
import { kelasBolehShare, labelKelasDibagikan, normalisasiKelasList } from '../lib/kelasLms'
import '../styles/konfirmasi-hapus.css'

type Props = {
  open: boolean
  judulItem: string
  jenis: 'materi' | 'kuis' | 'tugas'
  kelasUtama: string
  mapel: string
  kelasListSaatIni?: string[] | null
  profil: AppUser | null
  busy?: boolean
  onBatal: () => void
  onSimpan: (kelasList: string[]) => void | Promise<void>
}

/**
 * Modal checklist kelas paralel se-tingkat yang guru ampu untuk mapel ini.
 * Kelas yang tidak diampu tidak ditampilkan (rules menolak jika dipaksa).
 */
export default function BerbagiKelasDialog({
  open,
  judulItem,
  jenis,
  kelasUtama,
  mapel,
  kelasListSaatIni,
  profil,
  busy,
  onBatal,
  onSimpan,
}: Props) {
  const opsi = useMemo(
    () => kelasBolehShare(profil, kelasUtama, mapel),
    [profil, kelasUtama, mapel],
  )

  const [centang, setCentang] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const awal = new Set(
      (kelasListSaatIni || [])
        .map((k) => String(k).toUpperCase())
        .filter((k) => k && k !== String(kelasUtama).toUpperCase()),
    )
    setCentang(awal)
  }, [open, kelasListSaatIni, kelasUtama])

  if (!open) return null

  const labelJenis =
    jenis === 'materi' ? 'materi' : jenis === 'kuis' ? 'kuis' : 'tugas'

  function toggle(k: string) {
    setCentang((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  async function simpan() {
    const list = normalisasiKelasList(kelasUtama, [...centang])
    await onSimpan(list)
  }

  const ringkas = labelKelasDibagikan(kelasUtama, [...centang, String(kelasUtama).toUpperCase()])

  return (
    <div className="kh-overlay" role="presentation" onClick={onBatal}>
      <div
        className="kh-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="berbagi-judul"
        style={{ borderTopColor: '#0d9488' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="berbagi-judul" className="kh-judul" style={{ color: '#0f766e' }}>
          Bagikan {labelJenis}
        </h2>
        <p className="kh-nama">«{judulItem}»</p>
        <p className="kh-info">
          Kelas utama <strong>{kelasUtama}</strong>. Hanya kelas paralel se-tingkat yang Anda
          ampu untuk mapel ini yang bisa dicentang. Siswa di kelas tersebut melihat {labelJenis}{' '}
          yang sama (satu dokumen).
        </p>

        {opsi.length === 0 ? (
          <div className="kh-peringatan" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>
            Tidak ada kelas paralel yang Anda ampu untuk <strong>{mapel}</strong>. Jika Anda hanya
            mengajar di {kelasUtama}, tidak ada target berbagi.
          </div>
        ) : (
          <ul className="kh-rincian" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {opsi.map((k) => (
              <li key={k} style={{ marginBottom: '0.4rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.55rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={centang.has(k)}
                    onChange={() => toggle(k)}
                    disabled={busy}
                  />
                  <span style={{ fontWeight: 600 }}>Kelas {k}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <p className="kh-saran">
          {ringkas
            ? `Akan dibagikan ke: ${ringkas}`
            : `Tidak dibagikan ke kelas lain (hanya ${kelasUtama}).`}
        </p>

        <div className="kh-aksi">
          <button type="button" className="lms-btn-secondary" onClick={onBatal} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className="lms-btn-primary"
            disabled={busy || opsi.length === 0}
            onClick={() => void simpan()}
          >
            {busy ? 'Menyimpan…' : 'Simpan berbagi'}
          </button>
        </div>
      </div>
    </div>
  )
}

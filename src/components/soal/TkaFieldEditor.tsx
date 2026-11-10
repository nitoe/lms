import { useEffect, useId } from 'react'
import StimulusSoal from './StimulusSoal'
import { adalahMapelTka } from '../../lib/tkaAkses'
import type { Soal } from '../../types/soal'

/** Editor field khusus TKA hanya untuk ruang TKA atau soal yang sudah memuat field TKA. */
export function perluEditorTka(soal: Soal, mapel?: string): boolean {
  return adalahMapelTka(mapel) || !!soal.stimulus || !!soal.rumus || !!soal.tipeMateri
}

const MATERI_BI = ['Pemahaman Tekstual', 'Inferensial', 'Evaluasi dan Apresiasi']
const MATERI_MTK = ['Bilangan', 'Geometri', 'Pengukuran', 'Data dan Peluang', 'Aljabar']

/**
 * Bahan bacaan (stimulus), materi, rumus, dan label kolom Benar/Salah kustom untuk soal TKA.
 * Stimulus disimpan apa adanya (teks biasa atau HTML) dan dibersihkan saat ditampilkan
 * (bersihHtmlStimulus) — textarea dipakai, bukan RichEditor, agar tabel tidak hilang saat disunting.
 */
export default function TkaFieldEditor({
  soal,
  mapel,
  onChange,
}: {
  soal: Soal
  mapel?: string
  onChange: (s: Soal) => void
}) {
  const idMateri = useId()
  const tka = adalahMapelTka(mapel)
  const saran = mapel === 'TKA Bahasa Indonesia' ? MATERI_BI : mapel === 'TKA Matematika' ? MATERI_MTK : []
  const set = (patch: Partial<Soal>) => onChange({ ...soal, ...patch } as Soal)

  // Soal baru di ruang TKA: rumus aktif secara bawaan (soal hasil migrasi sudah true).
  useEffect(() => {
    if (tka && soal.rumus === undefined) onChange({ ...soal, rumus: true } as Soal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tka, soal.id])

  return (
    <section className="tka-editor" aria-label="Pengaturan TKA">
      <div className="soal-blok-kepala">
        <h4 className="soal-blok-judul">Bahan bacaan &amp; pengaturan TKA</h4>
        <span className="soal-sekat" />
        <span className="tka-editor-bantu">Opsional</span>
      </div>

      <label className="tka-editor-kolom">
        <span>Bahan bacaan / stimulus</span>
        <textarea
          className="soal-input tka-editor-area"
          rows={6}
          value={soal.stimulus ?? ''}
          placeholder="Tempel teks bacaan, data, atau tabel di sini…"
          onChange={(e) => set({ stimulus: e.target.value || undefined })}
        />
        <small className="tka-editor-bantu">
          Teks biasa boleh (Enter dua kali = paragraf baru) atau HTML sederhana: &lt;p&gt;, &lt;b&gt;, &lt;table&gt;.
          Rumus: <code>$x^2$</code> (sebaris) atau <code>$$…$$</code> (blok).
        </small>
      </label>

      {!!soal.stimulus?.trim() && (
        <div className="tka-editor-kolom">
          <span>Pratinjau bacaan</span>
          <StimulusSoal soal={soal} />
        </div>
      )}

      <div className="tka-editor-baris">
        <label className="tka-editor-kolom">
          <span>Materi</span>
          <input
            className="soal-input"
            list={idMateri}
            maxLength={80}
            value={soal.tipeMateri ?? ''}
            placeholder={saran[0] ? `mis. ${saran[0]}` : 'mis. Bilangan'}
            onChange={(e) => set({ tipeMateri: e.target.value.trim() ? e.target.value : undefined })}
          />
          <datalist id={idMateri}>
            {saran.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="tka-editor-cek">
          <input type="checkbox" checked={!!soal.rumus} onChange={(e) => set({ rumus: e.target.checked || undefined })} />
          <span>Tampilkan rumus (<code>$…$</code>)</span>
        </label>
      </div>

      {soal.tipe === 'bs' && (
        <div className="tka-editor-baris">
          <label className="tka-editor-kolom">
            <span>Label kolom pertama (bawaan: Benar)</span>
            <input
              className="soal-input"
              maxLength={30}
              value={soal.labelBenar ?? ''}
              placeholder="Benar"
              onChange={(e) => set({ labelBenar: e.target.value.trim() ? e.target.value : undefined })}
            />
          </label>
          <label className="tka-editor-kolom">
            <span>Label kolom kedua (bawaan: Salah)</span>
            <input
              className="soal-input"
              maxLength={30}
              value={soal.labelSalah ?? ''}
              placeholder="Salah"
              onChange={(e) => set({ labelSalah: e.target.value.trim() ? e.target.value : undefined })}
            />
          </label>
        </div>
      )}
    </section>
  )
}

import { buktiBaru } from '../lib/buktiTugas'
import {
  BATAS_BUKTI_TUGAS,
  type BuktiTugas,
  type KategoriPenilaian,
} from '../types/tugas'

type Props = {
  bukti: BuktiTugas[]
  kategori: KategoriPenilaian[]
  onChange: (next: BuktiTugas[]) => void
}

/**
 * Editor «Bukti pengumpulan» (tab Isi Tugas). Tiap bukti = satu foto berlabel yang harus dikirim
 * siswa, opsional dikaitkan ke kategori rubrik. Slot foto tetap per bukti (ANTIREGRESI §Tugas.Bukti).
 */
export default function BuktiTugasEditor({ bukti, kategori, onChange }: Props) {
  const kategoriAda = kategori.filter((k) => k.nama.trim())

  function ubah(i: number, patch: Partial<BuktiTugas>) {
    onChange(bukti.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  }

  function pindah(i: number, arah: -1 | 1) {
    const j = i + arah
    if (j < 0 || j >= bukti.length) return
    const baru = [...bukti]
    ;[baru[i], baru[j]] = [baru[j], baru[i]]
    onChange(baru)
  }

  function tambah() {
    const b = buktiBaru(bukti)
    if (b) onChange([...bukti, b])
  }

  function toggleKategori(i: number, id: string) {
    const sekarang = bukti[i].kategoriIds ?? []
    ubah(i, {
      kategoriIds: sekarang.includes(id) ? sekarang.filter((x) => x !== id) : [...sekarang, id],
    })
  }

  return (
    <section className="td-kartu">
      <div className="td-kartu-kepala td-kartu-kepala--row">
        <div>
          <h2>Bukti pengumpulan (foto)</h2>
          <p>
            Tentukan foto apa saja yang harus dikirim siswa, mis. «Catatan hasil sebelum aktivitas».
            Siswa melihat satu kartu per bukti. Kosongkan bila cukup 1–3 foto bebas. Maksimal{' '}
            {BATAS_BUKTI_TUGAS} bukti. Hindari mengubah atau menghapus bukti setelah siswa mulai
            mengumpulkan: foto lama bisa tampil di bukti yang salah.
          </p>
        </div>
        <button
          type="button"
          className="tg-btn tg-btn--utama"
          onClick={tambah}
          disabled={bukti.length >= BATAS_BUKTI_TUGAS}
        >
          + Bukti
        </button>
      </div>
      <div className="td-kartu-badan space-y-3">
        {bukti.length === 0 ? (
          <div className="td-kosong-kecil">
            <b>Belum ada bukti berlabel</b>
            <p>Siswa akan mengunggah 1–3 foto tanpa keterangan. Tambahkan bukti agar jelas foto untuk tahap apa.</p>
          </div>
        ) : (
          bukti.map((b, i) => (
            <div key={b.id} className="td-bukti-item">
              <div className="td-bukti-baris">
                <span className="td-bukti-no" aria-hidden>
                  {i + 1}
                </span>
                <label className="td-field td-field--grow">
                  <span>Nama bukti</span>
                  <input
                    value={b.label}
                    maxLength={120}
                    onChange={(e) => ubah(i, { label: e.target.value })}
                    placeholder="Contoh: Catatan hasil sebelum aktivitas"
                  />
                </label>
                <label className="td-bukti-cek">
                  <input
                    type="checkbox"
                    checked={b.wajib}
                    onChange={(e) => ubah(i, { wajib: e.target.checked })}
                  />
                  Wajib
                </label>
                <button type="button" className="tg-btn" onClick={() => pindah(i, -1)} disabled={i === 0} title="Naikkan">
                  ↑
                </button>
                <button
                  type="button"
                  className="tg-btn"
                  onClick={() => pindah(i, 1)}
                  disabled={i === bukti.length - 1}
                  title="Turunkan"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="tg-btn tg-btn--bahaya"
                  onClick={() => onChange(bukti.filter((_, j) => j !== i))}
                  title="Hapus bukti"
                >
                  Hapus
                </button>
              </div>
              <label className="td-field">
                <span>Petunjuk untuk siswa (opsional)</span>
                <input
                  value={b.petunjuk ?? ''}
                  maxLength={300}
                  onChange={(e) => ubah(i, { petunjuk: e.target.value })}
                  placeholder="Contoh: Foto tabel yang berisi jumlah detak nadi dan napas, pastikan tulisan terbaca"
                />
              </label>
              <div className="td-bukti-kait">
                <span className="td-bukti-kait-judul">Bukti ini dinilai pada kategori rubrik:</span>
                {kategoriAda.length === 0 ? (
                  <span className="td-field-hint">
                    Rubrik belum dibuat. Tambahkan kategori di tab «Input nilai» lalu kembali ke sini.
                  </span>
                ) : (
                  kategoriAda.map((k) => {
                    const on = b.kategoriIds?.includes(k.id) ?? false
                    return (
                      <label key={k.id} className={`td-bukti-chip${on ? ' td-bukti-chip--on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleKategori(i, k.id)} />
                        {k.nama}
                        {k.mapel ? ` · ${k.mapel}` : ''}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  BATAS_CATATAN,
  BATAS_FOTO_PENGUMPULAN,
  kirimPengumpulan,
  muatFoto,
  pesanGagalKumpul,
  siapkanFoto,
  type PengumpulanDok,
} from '../../lib/pengumpulan'
import type { TugasLms } from '../../types/tugas'
import SiswaIcon from './SiswaIcon'

type Props = {
  tugas: TugasLms
  siswaId: string
  siswaNama: string
  kelas: string
  /** Pengumpulan yang sudah ada (null = belum pernah). */
  ada: PengumpulanDok | null
  /** Tugas sudah dinilai → dikunci (rules juga menolak). */
  terkunci: boolean
  onTersimpan: (d: PengumpulanDok) => void
}

type Item = { key: string; src: string }

function waktuTeks(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Kumpulkan tugas dengan foto (maks. 3). Foto dikecilkan otomatis di perangkat. */
export default function PengumpulanSiswa({
  tugas,
  siswaId,
  siswaNama,
  kelas,
  ada,
  terkunci,
  onTersimpan,
}: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [catatan, setCatatan] = useState(ada?.catatan ?? '')
  const [memuat, setMemuat] = useState(false)
  const [olah, setOlah] = useState(false)
  const [busy, setBusy] = useState(false)
  const [galat, setGalat] = useState('')
  const [sukses, setSukses] = useState(false)
  const [ubah, setUbah] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const kunciAda = ada?.fotoIds.join('|') ?? ''

  // Muat foto yang sudah terkirim (untuk pratinjau & kirim ulang).
  useEffect(() => {
    if (!ada || ada.fotoIds.length === 0) {
      setItems([])
      return
    }
    let batal = false
    setMemuat(true)
    void muatFoto(ada.fotoIds)
      .then((list) => {
        if (!batal) setItems(list.map((src, i) => ({ key: `lama-${i}`, src })))
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciAda])

  async function pilih(files: FileList | null) {
    if (!files || files.length === 0) return
    setGalat('')
    setSukses(false)
    const sisa = BATAS_FOTO_PENGUMPULAN - items.length
    if (sisa <= 0) {
      setGalat(`Maksimal ${BATAS_FOTO_PENGUMPULAN} foto.`)
      return
    }
    setOlah(true)
    try {
      const baru: Item[] = []
      for (const f of Array.from(files).slice(0, sisa)) {
        const src = await siapkanFoto(f)
        baru.push({ key: `baru-${Date.now()}-${baru.length}`, src })
      }
      setItems((prev) => [...prev, ...baru])
      if (files.length > sisa) setGalat(`Hanya ${sisa} foto yang ditambahkan (maksimal ${BATAS_FOTO_PENGUMPULAN}).`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Foto tidak bisa diproses.')
    } finally {
      setOlah(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function hapus(key: string) {
    setItems((prev) => prev.filter((x) => x.key !== key))
    setSukses(false)
  }

  async function kirim() {
    setGalat('')
    setSukses(false)
    if (items.length === 0) {
      setGalat('Tambahkan minimal satu foto dulu ya.')
      return
    }
    setBusy(true)
    try {
      const dok = await kirimPengumpulan({
        tugas,
        siswaId,
        siswaNama,
        kelas,
        foto: items.map((x) => x.src),
        catatan,
        ada,
      })
      onTersimpan(dok)
      setSukses(true)
      setUbah(false)
    } catch (e) {
      console.warn('Kirim pengumpulan gagal', e)
      setGalat(pesanGagalKumpul(e))
    } finally {
      setBusy(false)
    }
  }

  /* —— Sudah dinilai: hanya tampilkan —— */
  if (terkunci) {
    return (
      <section className="sw-kat-panel sw-kumpul">
        <h2>Pengumpulan</h2>
        {ada ? (
          <>
            <p className="sw-kumpul-status sw-kumpul-status--ok">
              <SiswaIcon name="check" size={18} /> Terkumpul {waktuTeks(ada.diubahMs)}
            </p>
            <div className="sw-kumpul-thumbs">
              {items.map((x) => (
                <img key={x.key} src={x.src} alt="Foto tugasmu" className="sw-kumpul-thumb" />
              ))}
            </div>
          </>
        ) : (
          <p className="sw-kat-hint">Tugas ini sudah dinilai gurumu.</p>
        )}
        <p className="sw-kat-hint">Tugas yang sudah dinilai tidak bisa dikumpulkan ulang.</p>
      </section>
    )
  }

  const tampilForm = !ada || ubah

  return (
    <section className="sw-kat-panel sw-kumpul">
      <h2>Kumpulkan tugas</h2>

      {ada && (
        <p className="sw-kumpul-status sw-kumpul-status--ok">
          <SiswaIcon name="check" size={18} /> Sudah dikumpulkan {waktuTeks(ada.diubahMs)}
        </p>
      )}

      {memuat && <p className="sw-kat-hint">Memuat fotomu…</p>}

      {items.length > 0 && (
        <div className="sw-kumpul-thumbs">
          {items.map((x, i) => (
            <div key={x.key} className="sw-kumpul-thumb-wrap">
              <img src={x.src} alt={`Foto tugas ${i + 1}`} className="sw-kumpul-thumb" />
              {tampilForm && (
                <button
                  type="button"
                  className="sw-kumpul-hapus"
                  onClick={() => hapus(x.key)}
                  aria-label={`Hapus foto ${i + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tampilForm ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sw-kumpul-input"
            onChange={(e) => void pilih(e.target.files)}
            disabled={olah || busy || items.length >= BATAS_FOTO_PENGUMPULAN}
            id={`kumpul-${tugas.id}`}
          />
          <label
            htmlFor={`kumpul-${tugas.id}`}
            className={`sw-kumpul-tambah${
              olah || busy || items.length >= BATAS_FOTO_PENGUMPULAN ? ' sw-kumpul-tambah--off' : ''
            }`}
          >
            {olah ? 'Memproses foto…' : 'Ambil / pilih foto'}
          </label>
          <p className="sw-kat-hint">
            Foto hasil tugasmu, maksimal {BATAS_FOTO_PENGUMPULAN} foto. Pastikan tulisan terlihat jelas.
          </p>

          <label className="sw-kumpul-label" htmlFor={`catatan-${tugas.id}`}>
            Catatan untuk guru (boleh kosong)
          </label>
          <textarea
            id={`catatan-${tugas.id}`}
            className="sw-kumpul-catatan"
            rows={2}
            maxLength={BATAS_CATATAN}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />

          <div className="sw-kumpul-aksi">
            <button
              type="button"
              className="sw-btn-primary"
              disabled={busy || olah || items.length === 0}
              onClick={() => void kirim()}
            >
              {busy ? 'Mengirim…' : ada ? 'Kirim ulang' : 'Kumpulkan'}
            </button>
            {ada && (
              <button type="button" className="sw-btn-ghost" onClick={() => setUbah(false)} disabled={busy}>
                Batal
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="sw-kumpul-aksi">
          <button type="button" className="sw-btn-ghost" onClick={() => setUbah(true)}>
            Ubah / kirim ulang
          </button>
        </div>
      )}

      {sukses && (
        <p className="sw-kumpul-status sw-kumpul-status--ok" role="status">
          Hebat! Tugasmu sudah terkumpul.
        </p>
      )}
      {galat && (
        <p className="sw-kumpul-status sw-kumpul-status--err" role="alert">
          {galat}
        </p>
      )}
    </section>
  )
}

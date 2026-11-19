import { useEffect, useRef, useState } from 'react'
import {
  BATAS_CATATAN,
  BATAS_FOTO_PENGUMPULAN,
  buktiWajibKurang,
  DAFTAR_SLOT,
  kirimPengumpulan,
  muatFoto,
  muatFotoBerslot,
  pesanGagalKumpul,
  siapkanFoto,
  type PengumpulanDok,
} from '../../lib/pengumpulan'
import { adaBukti, kelompokBuktiPerTahap, namaKategoriBukti } from '../../lib/buktiTugas'
import { LABEL_TAHAP } from '../../types/tugas'
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

/**
 * Kumpulkan tugas dengan foto (maks. 3). Foto dikecilkan otomatis di perangkat.
 * Dua mode: tugas dengan «bukti berlabel» (`tugas.buktiList`, satu kartu per bukti, slot tetap)
 * atau mode lama tanpa label (ANTIREGRESI §132 & §Tugas.Bukti).
 */
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
  const modeBukti = adaBukti(tugas)
  const [fotoSlot, setFotoSlot] = useState<Record<number, string>>({})
  const [olahSlot, setOlahSlot] = useState<number | null>(null)
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
      setFotoSlot({})
      return
    }
    let batal = false
    setMemuat(true)
    const tugasMuat = modeBukti
      ? muatFotoBerslot(ada.fotoIds).then((m) => {
          if (!batal) setFotoSlot(m)
        })
      : muatFoto(ada.fotoIds).then((list) => {
          if (!batal) setItems(list.map((src, i) => ({ key: `lama-${i}`, src })))
        })
    void tugasMuat.finally(() => {
      if (!batal) setMemuat(false)
    })
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciAda, modeBukti])

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

  async function pilihBukti(slot: number, files: FileList | null, input: HTMLInputElement | null) {
    const f = files?.[0]
    if (!f) return
    setGalat('')
    setSukses(false)
    setOlahSlot(slot)
    try {
      const src = await siapkanFoto(f)
      setFotoSlot((prev) => ({ ...prev, [slot]: src }))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Foto tidak bisa diproses.')
    } finally {
      setOlahSlot(null)
      if (input) input.value = ''
    }
  }

  function hapusBukti(slot: number) {
    setFotoSlot((prev) => {
      const baru = { ...prev }
      delete baru[slot]
      return baru
    })
    setSukses(false)
  }

  function hapus(key: string) {
    setItems((prev) => prev.filter((x) => x.key !== key))
    setSukses(false)
  }

  async function kirim() {
    setGalat('')
    setSukses(false)
    if (modeBukti) {
      const kurang = buktiWajibKurang(tugas, fotoSlot)
      if (kurang.length > 0) {
        setGalat(`Foto yang wajib belum lengkap: ${kurang.join(', ')}.`)
        return
      }
    } else if (items.length === 0) {
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
        ...(modeBukti ? { fotoSlot } : { foto: items.map((x) => x.src) }),
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

  const buktiList = tugas.buktiList ?? []
  const kategori = tugas.pengaturanPenilaian?.kategori
  const slotBukti = new Set(buktiList.map((b) => b.slot))
  const slotLain = [...DAFTAR_SLOT].filter((n) => fotoSlot[n] && !slotBukti.has(n))
  const kurang = modeBukti ? buktiWajibKurang(tugas, fotoSlot) : []
  const jumlahWajib = buktiList.filter((b) => b.wajib).length
  const jumlahFotoBukti = buktiList.filter((b) => fotoSlot[b.slot]).length

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
            {modeBukti ? (
              <div className="sw-bukti-daftar">
                {buktiList
                  .filter((b) => fotoSlot[b.slot])
                  .map((b) => (
                    <figure key={b.id} className="sw-bukti-baca">
                      <img src={fotoSlot[b.slot]} alt={b.label} className="sw-kumpul-thumb" />
                      <figcaption>{b.label}</figcaption>
                    </figure>
                  ))}
              </div>
            ) : (
              <div className="sw-kumpul-thumbs">
                {items.map((x) => (
                  <img key={x.key} src={x.src} alt="Foto tugasmu" className="sw-kumpul-thumb" />
                ))}
              </div>
            )}
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

      {modeBukti ? (
        <>
          <p className="sw-kat-hint">
            Gurumu meminta {buktiList.length} foto bukti
            {jumlahWajib < buktiList.length ? ` (${jumlahWajib} wajib)` : ''}. Ambil foto satu per satu
            sesuai namanya ya.
          </p>
          {kelompokBuktiPerTahap(buktiList).map((g) => (
            <div key={g.tahap ?? 'lain'} className="sw-bukti-kelompok">
              {g.tahap && <h3 className="sw-bukti-tahap">{LABEL_TAHAP[g.tahap]}</h3>}
              <ol className="sw-bukti-daftar">
            {g.items.map(({ b, i }) => {
              const src = fotoSlot[b.slot]
              const dinilai = namaKategoriBukti(b, kategori)
              const idInput = `bukti-${tugas.id}-${b.slot}`
              const sibuk = olahSlot === b.slot
              const off = busy || olahSlot !== null
              return (
                <li
                  key={b.id}
                  className={`sw-bukti${src ? ' sw-bukti--ok' : b.wajib ? ' sw-bukti--kurang' : ''}`}
                >
                  <div className="sw-bukti-head">
                    <span className="sw-bukti-no" aria-hidden>
                      {i + 1}
                    </span>
                    <div className="sw-bukti-judul">
                      <strong className="sw-bukti-label">{b.label}</strong>
                      <span className={`sw-bukti-tag${b.wajib ? ' sw-bukti-tag--wajib' : ''}`}>
                        {b.wajib ? 'Wajib' : 'Boleh dikosongkan'}
                      </span>
                    </div>
                  </div>
                  {b.petunjuk ? <p className="sw-bukti-petunjuk">{b.petunjuk}</p> : null}
                  {dinilai.length > 0 && (
                    <p className="sw-bukti-dinilai">Dinilai pada: {dinilai.join(', ')}</p>
                  )}
                  {src ? (
                    <div className="sw-kumpul-thumb-wrap sw-bukti-foto">
                      <img src={src} alt={`Foto: ${b.label}`} className="sw-kumpul-thumb" />
                      {tampilForm && (
                        <button
                          type="button"
                          className="sw-kumpul-hapus"
                          onClick={() => hapusBukti(b.slot)}
                          aria-label={`Hapus foto ${b.label}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="sw-bukti-kosong">Belum ada foto</div>
                  )}
                  {tampilForm && (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        className="sw-kumpul-input"
                        id={idInput}
                        disabled={off}
                        onChange={(e) => void pilihBukti(b.slot, e.target.files, e.target)}
                      />
                      <label
                        htmlFor={idInput}
                        className={`sw-kumpul-tambah${off ? ' sw-kumpul-tambah--off' : ''}`}
                      >
                        {sibuk ? 'Memproses foto…' : src ? 'Ganti foto' : 'Ambil / pilih foto'}
                      </label>
                    </>
                  )}
                </li>
              )
            })}
              </ol>
            </div>
          ))}

          {slotLain.length > 0 && (
            <div className="sw-bukti sw-bukti--ok">
              <strong className="sw-bukti-label">Foto lain (sudah terkirim)</strong>
              <div className="sw-kumpul-thumbs">
                {slotLain.map((n) => (
                  <div key={n} className="sw-kumpul-thumb-wrap">
                    <img src={fotoSlot[n]} alt={`Foto lain ${n}`} className="sw-kumpul-thumb" />
                    {tampilForm && (
                      <button
                        type="button"
                        className="sw-kumpul-hapus"
                        onClick={() => hapusBukti(n)}
                        aria-label={`Hapus foto lain ${n}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tampilForm && (
            <p className={`sw-bukti-ringkas${kurang.length === 0 ? ' sw-bukti-ringkas--ok' : ''}`}>
              {kurang.length === 0
                ? `Semua foto yang wajib sudah lengkap (${jumlahFotoBukti} dari ${buktiList.length}).`
                : `Belum lengkap — masih perlu: ${kurang.join(', ')}.`}
            </p>
          )}
        </>
      ) : (
        <>
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

          {tampilForm && (
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
                Foto hasil tugasmu, maksimal {BATAS_FOTO_PENGUMPULAN} foto. Pastikan tulisan terlihat
                jelas.
              </p>
            </>
          )}
        </>
      )}

      {tampilForm ? (
        <>
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
              disabled={
                busy ||
                olah ||
                olahSlot !== null ||
                (modeBukti ? kurang.length > 0 : items.length === 0)
              }
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

/**
 * Panel kelompok di detail tugas siswa: pembentukan kelompok, pemberitahuan + konfirmasi anggota
 * (informatif, tidak menghalangi ketua), dan pengajuan kirim mandiri anggota → keputusan ketua.
 * ANTIREGRESI §Tugas.Kelompok.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { muatSiswaKelas, type SiswaDasar } from '../../lib/siswaAuth'
import {
  BATAS_TEKS_STATUS,
  buatKelompok,
  daftarKelompokTugas,
  daftarStatusAnggota,
  keluarKelompok,
  perbaruiAnggotaKelompok,
  punyaIzinMandiri,
  putuskanPengajuan,
  simpanStatusSaya,
  statusKonfirmasi,
  type StatusAnggotaDok,
  type TugasKelompokDok,
  isKetua,
} from '../../lib/tugasKelompok'
import type { TugasLms } from '../../types/tugas'
import { useSekarang } from '../../lib/useSekarang'
import SiswaIcon from './SiswaIcon'
import '../../styles/kelompok-status.css'

type Props = {
  tugas: TugasLms
  siswaId: string
  siswaNama: string
  kelas: string
  /** Dipanggil setelah kelompok berubah (buat/update/keluar). */
  onKelompokChange: (k: TugasKelompokDok | null) => void
  /** Kelompok saat ini (null = belum punya). */
  kelompok: TugasKelompokDok | null
  /** Jika true, form pengumpulan sudah dikunci (sudah dinilai). */
  terkunci: boolean
  /** Dipanggil saat izin kirim mandiri anggota berubah (true = ketua sudah menerima). */
  onIzinChange?: (izin: boolean) => void
}

export default function KelompokSiswaPanel({
  tugas,
  siswaId,
  siswaNama,
  kelas,
  onKelompokChange,
  kelompok,
  terkunci,
  onIzinChange,
}: Props) {
  const sekarang = useSekarang()
  const maxAnggota = Math.max(2, Math.min(12, tugas.kelompokMaxAnggota ?? 4))
  const [roster, setRoster] = useState<SiswaDasar[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modeEdit, setModeEdit] = useState(false)
  /** ID teman yang dicentang (belum termasuk diri sendiri). */
  const [pilihIds, setPilihIds] = useState<string[]>([])
  /** Siswa yang sudah di kelompok LAIN pada tugas ini (id → nama ketua). */
  const [dikelompokLain, setDikelompokLain] = useState<Record<string, string>>({})
  /** Status anggota (konfirmasi + pengajuan) untuk kelompok ini. */
  const [statusList, setStatusList] = useState<StatusAnggotaDok[]>([])
  const [alasan, setAlasan] = useState('')
  const [catatan, setCatatan] = useState<Record<string, string>>({})

  const muatRoster = useCallback(async () => {
    setLoadingRoster(true)
    try {
      const list = await muatSiswaKelas(kelas)
      setRoster(list.filter((s) => s.id !== siswaId))
    } catch (e) {
      console.warn('roster kelompok', e)
      setRoster([])
    } finally {
      setLoadingRoster(false)
    }
  }, [kelas, siswaId])

  useEffect(() => {
    void muatRoster()
  }, [muatRoster])

  // Kelompok lain pada tugas ini → siswa di dalamnya tidak bisa dipilih lagi.
  const muatKelompokLain = useCallback(async () => {
    try {
      const semua = await daftarKelompokTugas(tugas.id, kelas)
      const peta: Record<string, string> = {}
      for (const k of semua) {
        if (k.id === kelompok?.id) continue
        for (const a of k.anggotaList) peta[a.id] = k.ketuaNama
      }
      setDikelompokLain(peta)
    } catch (e) {
      console.warn('kelompok lain', e)
      setDikelompokLain({})
    }
  }, [tugas.id, kelas, kelompok?.id])

  useEffect(() => {
    void muatKelompokLain()
  }, [muatKelompokLain])

  // Status anggota kelompok ini. Gagal baca tidak boleh merusak panel (hanya fitur tambahan).
  const muatStatus = useCallback(async () => {
    if (!kelompok) {
      setStatusList([])
      return
    }
    try {
      const semua = await daftarStatusAnggota(tugas.id, kelas)
      setStatusList(semua.filter((x) => x.kelompokId === kelompok.id))
    } catch (e) {
      console.warn('status anggota kelompok', e)
      setStatusList([])
    }
  }, [kelompok, tugas.id, kelas])

  useEffect(() => {
    void muatStatus()
  }, [muatStatus])

  const statusSaya = useMemo(
    () => statusList.find((x) => x.siswaId === siswaId) ?? null,
    [statusList, siswaId],
  )

  useEffect(() => {
    onIzinChange?.(punyaIzinMandiri(kelompok, statusSaya, siswaId))
  }, [kelompok, statusSaya, siswaId, onIzinChange])

  // Saat buka mode edit / buat, isi centang dari anggota yang sudah ada
  useEffect(() => {
    if (kelompok && isKetua(kelompok, siswaId)) {
      setPilihIds(kelompok.anggotaIds.filter((id) => id !== siswaId))
    } else if (!kelompok) {
      setPilihIds([])
    }
  }, [kelompok, siswaId])

  // Siswa yang sudah di kelompok lain disembunyikan; dicek ulang di lib saat simpan.
  const temanTersedia = useMemo(
    () => roster.filter((s) => !dikelompokLain[s.id]),
    [roster, dikelompokLain],
  )
  const jumlahDisembunyikan = roster.length - temanTersedia.length

  const ketua = isKetua(kelompok, siswaId)

  async function handleBuat() {
    setBusy(true)
    setError('')
    try {
      const anggotaLain = temanTersedia.filter((s) => pilihIds.includes(s.id))
      const k = await buatKelompok({
        tugasId: tugas.id,
        kelas,
        ketua: { id: siswaId, nama: siswaNama, kelas },
        anggotaLain,
        maxAnggota,
      })
      onKelompokChange(k)
      setModeEdit(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal membuat kelompok')
    } finally {
      setBusy(false)
    }
  }

  async function handleSimpanAnggota() {
    if (!kelompok) return
    setBusy(true)
    setError('')
    try {
      const anggotaLain = temanTersedia.filter((s) => pilihIds.includes(s.id))
      const k = await perbaruiAnggotaKelompok({
        kelompokId: kelompok.id,
        ketua: { id: siswaId, nama: siswaNama, kelas },
        anggotaLain,
        maxAnggota,
      })
      onKelompokChange(k)
      setModeEdit(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan anggota')
    } finally {
      setBusy(false)
    }
  }

  async function handleKeluar() {
    if (!kelompok) return
    const msg =
      kelompok.ketuaId === siswaId
        ? 'Anda ketua. Keluar akan menghapus kelompok ini. Lanjutkan?'
        : 'Keluar dari kelompok?'
    if (!window.confirm(msg)) return
    setBusy(true)
    setError('')
    try {
      await keluarKelompok(kelompok, siswaId)
      onKelompokChange(null)
      setModeEdit(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal keluar kelompok')
    } finally {
      setBusy(false)
    }
  }

  async function handleKonfirmasi() {
    if (!kelompok) return
    setBusy(true)
    setError('')
    try {
      const baru = await simpanStatusSaya({
        kelompok,
        siswa: { id: siswaId, nama: siswaNama, kelas },
        ada: statusSaya,
        perubahan: { konfirmasi: true },
      })
      setStatusList((prev) => [...prev.filter((x) => x.id !== baru.id), baru])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan konfirmasi')
    } finally {
      setBusy(false)
    }
  }

  async function handleAjukan() {
    if (!kelompok) return
    setBusy(true)
    setError('')
    try {
      const baru = await simpanStatusSaya({
        kelompok,
        siswa: { id: siswaId, nama: siswaNama, kelas },
        ada: statusSaya,
        perubahan: { pengajuan: 'menunggu', alasan },
      })
      setStatusList((prev) => [...prev.filter((x) => x.id !== baru.id), baru])
      setAlasan('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim pengajuan')
    } finally {
      setBusy(false)
    }
  }

  async function handlePutuskan(st: StatusAnggotaDok, terima: boolean) {
    setBusy(true)
    setError('')
    try {
      const baru = await putuskanPengajuan({ status: st, terima, catatan: catatan[st.id] ?? '' })
      setStatusList((prev) => prev.map((x) => (x.id === baru.id ? baru : x)))
      setCatatan((prev) => ({ ...prev, [st.id]: '' }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan keputusan')
    } finally {
      setBusy(false)
    }
  }

  function chipAnggota(id: string) {
    if (!kelompok || id === kelompok.ketuaId) return null
    const st = statusList.find((x) => x.siswaId === id)
    const kf = statusKonfirmasi(kelompok, st, sekarang)
    if (kf.jenis === 'manual') {
      return <span className="sw-kelompok-chip sw-kelompok-chip--ok">sudah konfirmasi</span>
    }
    if (kf.jenis === 'otomatis') {
      return <span className="sw-kelompok-chip sw-kelompok-chip--auto">terkonfirmasi otomatis</span>
    }
    return <span className="sw-kelompok-chip">belum konfirmasi</span>
  }

  function togglePilih(id: string) {
    setPilihIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      // +1 untuk diri sendiri
      if (prev.length + 1 >= maxAnggota) return prev
      return [...prev, id]
    })
  }

  return (
    <section className="sw-kat-panel sw-kelompok">
      <h3 className="sw-kat-panel-judul">
        <SiswaIcon name="sparkles" size={18} />
        Kelompok
      </h3>

      {error && <p className="sw-error" role="alert">{error}</p>}

      {/* Sudah punya kelompok */}
      {kelompok && !modeEdit && (
        <div className="sw-kelompok-info">
          <p className="sw-kelompok-ketua">
            Ketua: <strong>{kelompok.ketuaNama}</strong>
            {ketua ? ' (Anda)' : ''}
          </p>
          <ul className="sw-kelompok-anggota">
            {kelompok.anggotaList.map((a) => (
              <li key={a.id}>
                {a.nama}
                {a.id === kelompok.ketuaId ? ' · ketua' : ''}
                {a.id === siswaId ? ' · Anda' : ''}
                {chipAnggota(a.id)}
              </li>
            ))}
          </ul>
          <p className="sw-hint">
            {ketua
              ? 'Hanya Anda (ketua) yang mengunggah pengumpulan kelompok. Anggota tercatat terkumpul setelah Anda mengirim. Konfirmasi anggota hanya pemberitahuan, tidak menghalangi Anda mengirim.'
              : 'Hanya ketua yang mengunggah pengumpulan kelompok. Setelah ketua mengirim, status Anda otomatis menjadi terkumpul.'}
          </p>

          {/* Pemberitahuan + konfirmasi (anggota non-ketua) */}
          {!ketua && statusKonfirmasi(kelompok, statusSaya, sekarang).jenis !== 'manual' && (
            <div className="sw-kelompok-kotak sw-kelompok-kotak--pemberitahuan">
              <h4>Anda masuk kelompok {kelompok.ketuaNama}</h4>
              <p>
                Untuk tugas ini Anda tercatat sebagai anggota. Tekan tombol di bawah agar ketua tahu
                Anda sudah melihatnya. Ini hanya pemberitahuan; kelompok tetap berjalan walau belum
                dikonfirmasi.
              </p>
              <p className="sw-hint">
                {statusKonfirmasi(kelompok, statusSaya, sekarang).jenis === 'otomatis'
                  ? 'Status Anda sudah tercatat terkonfirmasi otomatis karena tidak ada respons selama 1 jam. Anda tetap boleh menekan tombol untuk mengonfirmasi sendiri.'
                  : 'Jika tidak ada respons dalam 1 jam, Anda otomatis dianggap sudah konfirmasi.'}
              </p>
              <button
                type="button"
                className="sw-btn-primary"
                disabled={busy}
                onClick={() => void handleKonfirmasi()}
              >
                {busy ? 'Menyimpan…' : 'Saya sudah tahu'}
              </button>
            </div>
          )}

          {/* Pengajuan kirim mandiri (anggota non-ketua) */}
          {!ketua && !terkunci && (
            <div className="sw-kelompok-kotak">
              <h4>Ingin mengirim bukti sendiri?</h4>
              {(!statusSaya || statusSaya.pengajuan === 'tidak' || statusSaya.pengajuan === 'ditolak') && (
                <>
                  {statusSaya?.pengajuan === 'ditolak' && (
                    <p>
                      <span className="sw-kelompok-chip sw-kelompok-chip--danger">ditolak ketua</span>
                      {statusSaya.catatanKetua ? ` Catatan ketua: ${statusSaya.catatanKetua}` : ''}
                    </p>
                  )}
                  <p>
                    Anda bisa meminta izin ketua untuk mengunggah bukti atas nama Anda sendiri.
                  </p>
                  <textarea
                    className="sw-kelompok-alasan"
                    maxLength={BATAS_TEKS_STATUS}
                    placeholder="Alasan singkat (boleh dikosongkan)"
                    value={alasan}
                    disabled={busy}
                    onChange={(e) => setAlasan(e.target.value)}
                  />
                  <div className="sw-kelompok-aksi">
                    <button
                      type="button"
                      className="sw-btn-secondary"
                      disabled={busy}
                      onClick={() => void handleAjukan()}
                    >
                      {busy ? 'Mengirim…' : 'Ajukan ke ketua'}
                    </button>
                  </div>
                </>
              )}
              {statusSaya?.pengajuan === 'menunggu' && (
                <p>
                  <span className="sw-kelompok-chip sw-kelompok-chip--warn">menunggu ketua</span>{' '}
                  Pengajuan Anda sudah terkirim. Tunggu keputusan ketua.
                </p>
              )}
              {statusSaya?.pengajuan === 'diterima' && (
                <p>
                  <span className="sw-kelompok-chip sw-kelompok-chip--ok">diterima ketua</span>{' '}
                  Anda boleh mengunggah bukti sendiri di bagian «Kumpulkan tugas» di bawah.
                  {statusSaya.catatanKetua ? ` Catatan ketua: ${statusSaya.catatanKetua}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Keputusan ketua atas pengajuan anggota */}
          {ketua && !terkunci && statusList.some((x) => x.pengajuan !== 'tidak' && kelompok.anggotaIds.includes(x.siswaId)) && (
            <div className="sw-kelompok-kotak">
              <h4>Pengajuan kirim bukti sendiri</h4>
              <ul className="sw-kelompok-pengajuan-list">
                {statusList
                  .filter((x) => x.pengajuan !== 'tidak' && kelompok.anggotaIds.includes(x.siswaId))
                  .map((x) => (
                    <li key={x.id}>
                      <div className="sw-kelompok-pengajuan-nama">
                        {x.siswaNama}
                        {x.pengajuan === 'menunggu' && (
                          <span className="sw-kelompok-chip sw-kelompok-chip--warn">menunggu keputusan</span>
                        )}
                        {x.pengajuan === 'diterima' && (
                          <span className="sw-kelompok-chip sw-kelompok-chip--ok">diizinkan</span>
                        )}
                        {x.pengajuan === 'ditolak' && (
                          <span className="sw-kelompok-chip sw-kelompok-chip--danger">ditolak</span>
                        )}
                      </div>
                      {x.alasan && <p className="sw-kelompok-pengajuan-alasan">Alasan: {x.alasan}</p>}
                      <input
                        type="text"
                        className="sw-kelompok-alasan"
                        style={{ minHeight: 0 }}
                        maxLength={BATAS_TEKS_STATUS}
                        placeholder="Catatan untuk anggota (boleh dikosongkan)"
                        value={catatan[x.id] ?? ''}
                        disabled={busy}
                        onChange={(e) => setCatatan((prev) => ({ ...prev, [x.id]: e.target.value }))}
                      />
                      <div className="sw-kelompok-aksi">
                        {x.pengajuan !== 'diterima' && (
                          <button
                            type="button"
                            className="sw-btn-primary"
                            disabled={busy}
                            onClick={() => void handlePutuskan(x, true)}
                          >
                            Izinkan
                          </button>
                        )}
                        {x.pengajuan !== 'ditolak' && (
                          <button
                            type="button"
                            className="sw-btn-bahaya"
                            disabled={busy}
                            onClick={() => void handlePutuskan(x, false)}
                          >
                            {x.pengajuan === 'diterima' ? 'Cabut izin' : 'Tolak'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {!terkunci && (
            <div className="sw-kelompok-aksi">
              {ketua && (
                <button
                  type="button"
                  className="sw-btn-secondary"
                  disabled={busy}
                  onClick={() => setModeEdit(true)}
                >
                  Ubah anggota
                </button>
              )}
              <button
                type="button"
                className="sw-btn-bahaya"
                disabled={busy}
                onClick={() => void handleKeluar()}
              >
                {ketua ? 'Hapus kelompok' : 'Keluar kelompok'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Form buat / edit anggota */}
      {(!kelompok || modeEdit) && !terkunci && (
        <div className="sw-kelompok-form">
          {!kelompok && (
            <p className="sw-hint">
              Diskusikan dulu dengan teman sekelas, lalu ketua memasukkan anggota di sini.
              Anggota akan mendapat pemberitahuan di akunnya; konfirmasi mereka hanya sebagai
              informasi dan tidak menghalangi pengumpulan.
            </p>
          )}
          <p className="sw-kelompok-max">
            Pilih teman (maks. {maxAnggota - 1} + Anda = {maxAnggota} orang)
          </p>
          {jumlahDisembunyikan > 0 && (
            <p className="sw-kelompok-sudah-lain">
              {jumlahDisembunyikan} teman tidak ditampilkan karena sudah masuk kelompok lain.
            </p>
          )}
          {loadingRoster ? (
            <p className="sw-hint">Memuat daftar siswa…</p>
          ) : temanTersedia.length === 0 ? (
            <p className="sw-hint">Belum ada data siswa sekelas.</p>
          ) : (
            <ul className="sw-kelompok-pilih">
              {temanTersedia.map((s) => (
                <li key={s.id}>
                  <label className="sw-kelompok-check">
                    <input
                      type="checkbox"
                      checked={pilihIds.includes(s.id)}
                      disabled={busy || (!pilihIds.includes(s.id) && pilihIds.length + 1 >= maxAnggota)}
                      onChange={() => togglePilih(s.id)}
                    />
                    <span>{s.nama}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="sw-kelompok-aksi">
            {kelompok ? (
              <>
                <button
                  type="button"
                  className="sw-btn-primary"
                  disabled={busy}
                  onClick={() => void handleSimpanAnggota()}
                >
                  {busy ? 'Menyimpan…' : 'Simpan anggota'}
                </button>
                <button
                  type="button"
                  className="sw-btn-ghost"
                  disabled={busy}
                  onClick={() => setModeEdit(false)}
                >
                  Batal
                </button>
              </>
            ) : (
              <button
                type="button"
                className="sw-btn-primary"
                disabled={busy}
                onClick={() => void handleBuat()}
              >
                {busy ? 'Membuat…' : 'Buat kelompok (Anda ketua)'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

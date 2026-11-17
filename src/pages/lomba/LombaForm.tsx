import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  buatLomba,
  daftarStafAktif,
  getLomba,
  perbaruiLomba,
} from '../../lib/lomba'
import { adalahAdminLms } from '../../lib/lombaAkses'
import { getDaftarMapel } from '../../lib/mapelData'
import { DAFTAR_KELAS, muatSiswaKelas, type SiswaDasar } from '../../lib/siswaAuth'
import type { PesertaLomba, StatusLomba, TingkatLomba } from '../../types/lomba'
import {
  MAKS_PESERTA_LOMBA,
  STATUS_LOMBA,
  TINGKAT_LOMBA,
} from '../../types/lomba'
import '../../styles/lomba.css'

function toInputDate(d: Date | null): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromInputDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export default function LombaForm() {
  const { lombaId } = useParams<{ lombaId?: string }>()
  const isEdit = Boolean(lombaId) && lombaId !== 'baru'
  const navigate = useNavigate()
  const { user, profil } = useAuth()
  const admin = adalahAdminLms(user, profil)

  const [nama, setNama] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [identitas, setIdentitas] = useState('')
  const [tingkat, setTingkat] = useState<TingkatLomba>('sekolah')
  const [mapelTerkait, setMapelTerkait] = useState<string[]>([])
  const [mulai, setMulai] = useState('')
  const [selesai, setSelesai] = useState('')
  const [status, setStatus] = useState<StatusLomba>('draf')
  const [guruUid, setGuruUid] = useState('')
  const [staf, setStaf] = useState<{ uid: string; nama: string; email: string; role: string }[]>([])
  const [mapelOpsi, setMapelOpsi] = useState<string[]>([])
  const [peserta, setPeserta] = useState<PesertaLomba[]>([])

  const [kelasPilih, setKelasPilih] = useState('')
  const [daftarSiswaKelas, setDaftarSiswaKelas] = useState<SiswaDasar[]>([])
  const [siswaPilih, setSiswaPilih] = useState('')
  const [muatSiswa, setMuatSiswa] = useState(false)

  const [loading, setLoading] = useState(isEdit)
  const [simpan, setSimpan] = useState(false)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!admin) return
    void (async () => {
      try {
        const [s, m] = await Promise.all([daftarStafAktif(), getDaftarMapel()])
        setStaf(s)
        setMapelOpsi(m)
      } catch (e) {
        console.error(e)
        setGalat('Gagal memuat daftar staf / mapel. Pastikan Anda login sebagai admin.')
      }
    })()
  }, [admin])

  useEffect(() => {
    if (!isEdit || !lombaId) return
    let batal = false
    void (async () => {
      setLoading(true)
      try {
        const l = await getLomba(lombaId)
        if (batal) return
        if (!l) {
          setGalat('Lomba tidak ditemukan.')
          return
        }
        setNama(l.nama)
        setDeskripsi(l.deskripsi || '')
        setIdentitas(l.identitas || '')
        setTingkat(l.tingkat)
        setMapelTerkait(l.mapelTerkait)
        setMulai(toInputDate(l.mulai))
        setSelesai(toInputDate(l.selesai))
        setStatus(l.status)
        setGuruUid(l.guruPengampuUid)
        setPeserta(l.siswaList)
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal memuat lomba.')
      } finally {
        if (!batal) setLoading(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [isEdit, lombaId])

  useEffect(() => {
    if (!kelasPilih) {
      setDaftarSiswaKelas([])
      setSiswaPilih('')
      return
    }
    let batal = false
    setMuatSiswa(true)
    void muatSiswaKelas(kelasPilih)
      .then((list) => {
        if (!batal) setDaftarSiswaKelas(list)
      })
      .catch((e) => {
        console.error(e)
        if (!batal) setDaftarSiswaKelas([])
      })
      .finally(() => {
        if (!batal) setMuatSiswa(false)
      })
    return () => {
      batal = true
    }
  }, [kelasPilih])

  const idsSudah = useMemo(() => new Set(peserta.map((p) => p.id)), [peserta])
  const siswaTersedia = useMemo(
    () => daftarSiswaKelas.filter((s) => !idsSudah.has(s.id)),
    [daftarSiswaKelas, idsSudah],
  )

  const tambahPeserta = useCallback(() => {
    if (!siswaPilih) return
    const s = daftarSiswaKelas.find((x) => x.id === siswaPilih)
    if (!s) return
    if (peserta.length >= MAKS_PESERTA_LOMBA) {
      setGalat(`Maksimal ${MAKS_PESERTA_LOMBA} peserta per lomba.`)
      return
    }
    if (idsSudah.has(s.id)) return
    setPeserta((prev) => [...prev, { id: s.id, nama: s.nama, kelas: s.kelas }])
    setSiswaPilih('')
    setGalat('')
  }, [siswaPilih, daftarSiswaKelas, peserta.length, idsSudah])

  function hapusPeserta(id: string) {
    setPeserta((prev) => prev.filter((p) => p.id !== id))
  }

  function toggleMapel(m: string) {
    setMapelTerkait((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!admin || !user || !profil) return
    setGalat('')
    const namaTrim = nama.trim()
    if (!namaTrim) {
      setGalat('Nama lomba wajib diisi.')
      return
    }
    if (!guruUid) {
      setGalat('Pilih guru pengampu.')
      return
    }
    if (mapelTerkait.length === 0) {
      setGalat('Pilih minimal satu mapel terkait.')
      return
    }
    if (peserta.length > MAKS_PESERTA_LOMBA) {
      setGalat(`Peserta maksimal ${MAKS_PESERTA_LOMBA}.`)
      return
    }

    const guru = staf.find((s) => s.uid === guruUid)
    const siswaIds = peserta.map((p) => p.id)
    const payload = {
      nama: namaTrim,
      deskripsi: deskripsi.trim() || undefined,
      identitas: identitas.trim() || undefined,
      tingkat,
      mapelTerkait,
      mulai: fromInputDate(mulai),
      selesai: fromInputDate(selesai),
      status,
      guruPengampuUid: guruUid,
      guruPengampuNama: guru?.nama || '',
      guruPengampuEmail: guru?.email,
      siswaIds,
      siswaList: peserta,
      dibuatOleh: user.uid,
      dibuatOlehNama: profil.nama || user.email || '',
    }

    setSimpan(true)
    try {
      if (isEdit && lombaId) {
        await perbaruiLomba(lombaId, payload)
        navigate(`/lomba/${lombaId}`, { replace: true })
      } else {
        const id = await buatLomba(payload)
        navigate(`/lomba/${id}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan.')
    } finally {
      setSimpan(false)
    }
  }

  if (!admin) {
    return (
      <div className="lomba-dash">
        <section className="lomba-hero">
          <div className="lomba-hero-inner">
            <p className="lomba-eyebrow">Modul lomba</p>
            <h1 className="lomba-judul">Hanya administrator</h1>
            <p className="lomba-lead">
              Membuat atau mengubah meta lomba (nama, pengampu, peserta, mapel) hanya untuk
              administrator LMS.
            </p>
          </div>
        </section>
      </div>
    )
  }

  if (loading) {
    return <div className="lms-empty p-8 text-sm text-muted">Memuat…</div>
  }

  return (
    <div className="lomba-dash space-y-4">
      <div>
        <Link to={isEdit && lombaId ? `/lomba/${lombaId}` : '/lomba'} className="lomba-back">
          ← {isEdit ? 'Kembali ke detail' : 'Daftar lomba'}
        </Link>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">
          {isEdit ? 'Ubah lomba' : 'Lomba baru'}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Isi identitas, mapel terkait, guru pengampu, dan peserta (maks. {MAKS_PESERTA_LOMBA}).
        </p>
      </div>

      {galat && <div className="lomba-alert">{galat}</div>}

      <form onSubmit={(e) => void handleSubmit(e)} className="lomba-form">
        <section className="lomba-form-card">
          <h3>Identitas lomba</h3>
          <label className="lomba-field">
            <span>Nama lomba *</span>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={120}
              required
              placeholder="Contoh: Olimpiade Sains Sekolah 2026"
            />
          </label>
          <label className="lomba-field">
            <span>Identitas / penyelenggara</span>
            <input
              type="text"
              value={identitas}
              onChange={(e) => setIdentitas(e.target.value)}
              maxLength={200}
              placeholder="Opsional — e.g. Dinas Pendidikan Kota Depok"
            />
          </label>
          <label className="lomba-field">
            <span>Deskripsi</span>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </label>
          <div className="lomba-field-row">
            <label className="lomba-field">
              <span>Tingkat *</span>
              <select
                value={tingkat}
                onChange={(e) => setTingkat(e.target.value as TingkatLomba)}
              >
                {TINGKAT_LOMBA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lomba-field">
              <span>Status *</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusLomba)}
              >
                {STATUS_LOMBA.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="lomba-field-row">
            <label className="lomba-field">
              <span>Mulai</span>
              <input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </label>
            <label className="lomba-field">
              <span>Selesai</span>
              <input type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="lomba-form-card">
          <h3>Mapel terkait *</h3>
          <p className="hint">
            TP pada materi, bank soal, dan kuis lomba dibatasi ke mapel yang dipilih di sini.
          </p>
          <div className="lomba-mapel-chips">
            {mapelOpsi.length === 0 ? (
              <span className="text-xs text-muted">Memuat mapel…</span>
            ) : (
              mapelOpsi.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mapelTerkait.includes(m) ? 'on' : ''}
                  onClick={() => toggleMapel(m)}
                >
                  {m}
                </button>
              ))
            )}
          </div>

          <h3 className="mt-5">Guru pengampu *</h3>
          <label className="lomba-field">
            <span>Pilih staf aktif</span>
            <select
              value={guruUid}
              onChange={(e) => setGuruUid(e.target.value)}
              required
            >
              <option value="">— Pilih guru —</option>
              {staf.map((s) => (
                <option key={s.uid} value={s.uid}>
                  {s.nama}
                  {s.email ? ` (${s.email})` : ''} · {s.role}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="lomba-form-card lomba-form-span">
          <h3>
            Peserta siswa{' '}
            <span className="font-normal text-slate-500">
              ({peserta.length}/{MAKS_PESERTA_LOMBA})
            </span>
          </h3>
          <p className="hint">
            Pilih kelas, lalu tambahkan siswa satu per satu. Menu Lomba di akun siswa hanya muncul
            bagi yang terdaftar di sini.
          </p>

          <div className="lomba-add-peserta">
            <label className="lomba-field">
              <span>Kelas</span>
              <select
                value={kelasPilih}
                onChange={(e) => {
                  setKelasPilih(e.target.value)
                  setSiswaPilih('')
                }}
              >
                <option value="">—</option>
                {DAFTAR_KELAS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="lomba-field grow">
              <span>Siswa</span>
              <select
                value={siswaPilih}
                onChange={(e) => setSiswaPilih(e.target.value)}
                disabled={!kelasPilih || muatSiswa}
              >
                <option value="">
                  {muatSiswa
                    ? 'Memuat…'
                    : siswaTersedia.length
                      ? '— Pilih —'
                      : 'Tidak ada / sudah semua'}
                </option>
                {siswaTersedia.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-add"
              onClick={tambahPeserta}
              disabled={!siswaPilih || peserta.length >= MAKS_PESERTA_LOMBA}
            >
              + Tambah
            </button>
          </div>

          {peserta.length > 0 ? (
            <ul className="lomba-peserta-edit">
              {peserta.map((p) => (
                <li key={p.id}>
                  <span>
                    <span className="nama">{p.nama}</span>
                    <span className="kelas">Kelas {p.kelas}</span>
                  </span>
                  <button type="button" onClick={() => hapusPeserta(p.id)}>
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Belum ada peserta.</p>
          )}
        </section>

        <div className="lomba-form-actions lomba-form-span">
          <button type="submit" className="primary" disabled={simpan}>
            {simpan ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Buat lomba'}
          </button>
          <Link
            to={isEdit && lombaId ? `/lomba/${lombaId}` : '/lomba'}
            className="secondary"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  )
}

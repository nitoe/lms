import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { normalisasiHtmlPengumuman } from '../lib/html'
import {
  bolehGeneratePengumumanAi,
  generatePengumumanLmsAi,
} from '../lib/generatePengumumanAi'
import {
  cuplikanPengumuman,
  daftarPengumumanGuru,
  hapusPengumuman,
  tambahPengumuman,
  ubahPengumuman,
} from '../lib/pengumuman'
import type { PengumumanLms } from '../types/pengumuman'
import MateriRichEditor from './materi/MateriRichEditor'
import '../styles/pengumuman.css'
import '../styles/materi-halaman.css'

type Props = { kelas: string; mapel: string }

type ModeForm = 'baru' | 'edit' | null

function fmtTanggal(v: unknown): string {
  if (!v) return ''
  try {
    const d =
      typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function'
        ? (v as { toDate: () => Date }).toDate()
        : v instanceof Date
          ? v
          : null
    if (!d || Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

export default function PengumumanPanel({ kelas, mapel }: Props) {
  const { user, profil } = useAuth()
  const bolehAi = bolehGeneratePengumumanAi(user?.uid)

  const [list, setList] = useState<PengumumanLms[] | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState<ModeForm>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [judul, setJudul] = useState('')
  const [kontenHtml, setKontenHtml] = useState('')
  const [aktif, setAktif] = useState(true)
  const [pin, setPin] = useState(false)

  const [aiInfo, setAiInfo] = useState('')
  const [aiTujuan, setAiTujuan] = useState('')
  const [busyAi, setBusyAi] = useState(false)
  const [tampilAi, setTampilAi] = useState(false)

  const muat = useCallback(async () => {
    setError('')
    try {
      const rows = await daftarPengumumanGuru(kelas, mapel)
      setList(rows)
    } catch (e) {
      setList([])
      setError(e instanceof Error ? e.message : 'Gagal memuat pengumuman.')
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  function bukaBaru() {
    setMode('baru')
    setEditId(null)
    setJudul('')
    setKontenHtml('')
    setAktif(true)
    setPin(false)
    setTampilAi(false)
    setAiInfo('')
    setAiTujuan('')
    setError('')
    setInfo('')
  }

  function bukaEdit(p: PengumumanLms) {
    setMode('edit')
    setEditId(p.id)
    setJudul(p.judul)
    setKontenHtml(p.kontenHtml)
    setAktif(p.aktif)
    setPin(!!p.pin)
    setTampilAi(false)
    setError('')
    setInfo('')
  }

  function tutupForm() {
    setMode(null)
    setEditId(null)
  }

  async function simpan() {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'baru') {
        await tambahPengumuman({
          kelas,
          mapel,
          judul,
          kontenHtml,
          aktif,
          pin,
          namaGuru: profil?.nama || user?.email || '',
        })
        setInfo('Pengumuman disimpan.')
      } else if (mode === 'edit' && editId) {
        await ubahPengumuman(editId, { judul, kontenHtml, aktif, pin })
        setInfo('Perubahan disimpan.')
      }
      tutupForm()
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function onHapus(p: PengumumanLms) {
    if (!window.confirm(`Hapus pengumuman «${p.judul}»?`)) return
    setBusy(true)
    setError('')
    try {
      await hapusPengumuman(p.id)
      if (editId === p.id) tutupForm()
      await muat()
      setInfo('Pengumuman dihapus.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleAktif(p: PengumumanLms) {
    setBusy(true)
    try {
      await ubahPengumuman(p.id, { aktif: !p.aktif })
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status.')
    } finally {
      setBusy(false)
    }
  }

  async function jalankanAi() {
    setBusyAi(true)
    setError('')
    try {
      const h = await generatePengumumanLmsAi({
        mapel,
        kelas,
        informasi: aiInfo,
        tujuan: aiTujuan || undefined,
        variasi: String(Date.now()),
      })
      setJudul(h.judul)
      setKontenHtml(normalisasiHtmlPengumuman(h.kontenHtml))
      setInfo('Draf AI siap — tinjau lalu simpan.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal generate AI.')
    } finally {
      setBusyAi(false)
    }
  }

  return (
    <div className="pg-panel">
      <div className="pg-toolbar">
        <div>
          <h2>Pengumuman</h2>
          <p>
            Informasi untuk orang tua dan siswa di ruang {mapel} · {kelas}
          </p>
        </div>
        <div className="pg-aksi">
          {mode === null && (
            <button type="button" className="pg-btn pg-btn--utama" onClick={bukaBaru} disabled={busy}>
              + Buat pengumuman
            </button>
          )}
        </div>
      </div>

      {error && <div className="pg-pesan pg-pesan--err">{error}</div>}
      {info && <div className="pg-pesan pg-pesan--ok">{info}</div>}

      {mode && (
        <div className="pg-form">
          <h3>{mode === 'baru' ? 'Pengumuman baru' : 'Ubah pengumuman'}</h3>

          {bolehAi && (
            <div className="pg-ai">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h4>Bantuan AI — bahasa Islami yang hangat</h4>
                <button
                  type="button"
                  className="pg-btn"
                  onClick={() => setTampilAi((v) => !v)}
                  disabled={busy || busyAi}
                >
                  {tampilAi ? 'Sembunyikan' : 'Tulis dengan AI'}
                </button>
              </div>
              {tampilAi && (
                <>
                  <p>
                    AI menyusun pengumuman untuk ayah/bunda dengan sebutan ananda. Hanya tersedia untuk akun
                    yang diizinkan.
                  </p>
                  <label className="pg-label">
                    Informasi yang ingin disampaikan
                    <textarea
                      className="pg-textarea"
                      value={aiInfo}
                      onChange={(e) => setAiInfo(e.target.value)}
                      placeholder="Contoh: Ulangan harian IPA bab 3 digeser ke Rabu 3 Des, bawa alat tulis lengkap…"
                      disabled={busyAi}
                    />
                  </label>
                  <label className="pg-label">
                    Tujuan / nada (opsional)
                    <input
                      className="pg-input"
                      value={aiTujuan}
                      onChange={(e) => setAiTujuan(e.target.value)}
                      placeholder="Pengingat, undangan, apresiasi, permohonan doa…"
                      disabled={busyAi}
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      className="pg-btn pg-btn--ai"
                      disabled={busyAi || aiInfo.trim().length < 8}
                      onClick={() => void jalankanAi()}
                    >
                      {busyAi ? 'Menyusun…' : 'Generate pengumuman AI'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <label className="pg-label">
            Judul
            <input
              className="pg-input"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              maxLength={160}
              placeholder="Judul singkat pengumuman"
              disabled={busy}
            />
          </label>

          <label className="pg-label">
            Isi pengumuman
            <MateriRichEditor
              value={kontenHtml}
              onChange={setKontenHtml}
              placeholder="Tulis paragraf, daftar, penekanan… Editor mendukung format profesional."
              minRem={8}
              ariaLabel="Isi pengumuman"
            />
          </label>

          <div className="pg-baris">
            <label className="pg-cek">
              <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} disabled={busy} />
              Tampilkan ke siswa
            </label>
            <label className="pg-cek">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} disabled={busy} />
              Sematkan di atas
            </label>
          </div>

          <div className="pg-form-kaki">
            <button type="button" className="pg-btn" onClick={tutupForm} disabled={busy}>
              Batal
            </button>
            <button type="button" className="pg-btn pg-btn--utama" onClick={() => void simpan()} disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {list === null && <p className="text-sm text-slate-500">Memuat pengumuman…</p>}

      {list && list.length === 0 && mode === null && (
        <div className="pg-kosong">
          <b>Belum ada pengumuman</b>
          <p>Buat pengumuman pertama untuk rombel ini. Siswa hanya melihat yang ditandai aktif.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="pg-list">
          {list.map((p) => (
            <li
              key={p.id}
              className={`pg-kartu${p.pin ? ' pg-kartu--pin' : ''}${!p.aktif ? ' pg-kartu--draf' : ''}`}
            >
              <div className="pg-kartu-kepala">
                <h3 className="pg-kartu-judul">{p.judul}</h3>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {p.pin && <span className="pg-badge pg-badge--pin">Sematan</span>}
                  <span className={`pg-badge ${p.aktif ? 'pg-badge--aktif' : 'pg-badge--draf'}`}>
                    {p.aktif ? 'Aktif' : 'Draf'}
                  </span>
                </div>
              </div>
              <p className="pg-meta">
                {p.dibuatOlehNama && <span>{p.dibuatOlehNama}</span>}
                {fmtTanggal(p.updatedAt || p.createdAt) && (
                  <span>{fmtTanggal(p.updatedAt || p.createdAt)}</span>
                )}
                {!p.aktif && <span title={cuplikanPengumuman(p.kontenHtml)}>Belum tampil di siswa</span>}
              </p>
              <div
                className="pg-isi"
                dangerouslySetInnerHTML={{ __html: normalisasiHtmlPengumuman(p.kontenHtml) }}
              />
              <div className="pg-kartu-kaki">
                <button type="button" className="pg-btn" disabled={busy} onClick={() => bukaEdit(p)}>
                  Ubah
                </button>
                <button type="button" className="pg-btn" disabled={busy} onClick={() => void toggleAktif(p)}>
                  {p.aktif ? 'Jadikan draf' : 'Aktifkan'}
                </button>
                <button
                  type="button"
                  className="pg-btn pg-btn--bahaya"
                  disabled={busy}
                  onClick={() => void onHapus(p)}
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

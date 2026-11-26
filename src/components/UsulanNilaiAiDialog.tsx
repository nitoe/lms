/**
 * Tinjauan USULAN nilai AI untuk satu siswa: skor + alasan per kategori, bukti yang dirujuk
 * (foto/video asli siswa) agar guru bisa memverifikasi sebelum menerapkan ke draf nilai.
 * ANTIREGRESI §Tugas.NilaiAi.
 */
import { useEffect, useRef, useState } from 'react'
import { muatFotoBerslot, type PengumpulanDok } from '../lib/pengumpulan'
import { urlVideoTugas } from '../lib/videoTugas'
import { daftarPoinPerbaikanDariUsulan, type UsulanNilaiAi } from '../lib/nilaiTugasAi'

type Props = {
  usulan: UsulanNilaiAi
  pengumpulan?: PengumpulanDok
  /** Nama siswa pada baris yang membuka dialog (bisa berbeda dari pemilik bukti pada tugas kelompok). */
  namaTarget: string
  /** Terisi bila bukti untuk tugas kelompok (ketua atau wakil yang mengumpulkan). */
  kelompok?: {
    ketuaNama: string
    jumlahAnggota: number
    jumlahPenerima: number
    /** Bukti diunggah anggota mewakili ketua (bukan ketua sendiri). */
    diwakili?: boolean
    namaPengumpul?: string
  }
  sudahDiterapkan: boolean
  onTerapkan: () => void
  /** Terapkan ke seluruh anggota kelompok yang layak (draf saja). */
  onTerapkanKelompok?: () => void
  onTutup: () => void
}

const LABEL_YAKIN = { tinggi: 'Yakin tinggi', sedang: 'Yakin sedang', rendah: 'Yakin rendah' } as const

export default function UsulanNilaiAiDialog({
  usulan,
  pengumpulan,
  namaTarget,
  kelompok,
  sudahDiterapkan,
  onTerapkan,
  onTerapkanKelompok,
  onTutup,
}: Props) {
  const [foto, setFoto] = useState<Record<number, string>>({})
  const [video, setVideo] = useState<Record<number, string>>({})
  const [besar, setBesar] = useState<number | null>(null)
  const tutupRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    tutupRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTutup()
    }
    window.addEventListener('keydown', onKey)
    const lama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = lama
    }
  }, [onTutup])

  useEffect(() => {
    let batal = false
    if (!pengumpulan) return
    void (async () => {
      try {
        const f = await muatFotoBerslot(pengumpulan.fotoIds)
        if (!batal) setFoto(f)
      } catch {
        /* thumbnail opsional */
      }
      const v: Record<number, string> = {}
      for (const [k, meta] of Object.entries(pengumpulan.videos ?? {})) {
        try {
          v[Number(k)] = await urlVideoTugas(meta.path)
        } catch {
          /* video bisa sudah kedaluwarsa (120 hari) */
        }
      }
      if (!batal) setVideo(v)
    })()
    return () => {
      batal = true
    }
  }, [pengumpulan])

  const nomorDipilih = besar
  const dinilai = usulan.kategori.filter((k) => k.skor !== null)
  const perluCek = usulan.kategori.filter((k) => k.perluDicek).length

  return (
    <div className="td-modal-latar" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
      <div className="td-modal" role="dialog" aria-modal="true" aria-labelledby="td-ai-judul">
        <header className="td-modal-kepala">
          <div>
            <h2 id="td-ai-judul">Usulan nilai AI — {kelompok ? `Kelompok ${kelompok.ketuaNama}` : namaTarget}</h2>
            <p className="td-hint">
              Ini usulan, bukan nilai. Periksa alasan dan bukti, ubah bila perlu, lalu simpan seperti biasa.
            </p>
          </div>
          <button ref={tutupRef} type="button" className="tg-btn" onClick={onTutup} aria-label="Tutup">
            Tutup
          </button>
        </header>

        <div className="td-modal-badan">
          {kelompok && (
            <p className="td-ai-kelompok">
              {kelompok.diwakili ? (
                <>
                  Bukti dikumpulkan <b>{kelompok.namaPengumpul || 'anggota'}</b> mewakili kelompok{' '}
                  <b>{kelompok.ketuaNama}</b> ({kelompok.jumlahAnggota} anggota).
                </>
              ) : (
                <>
                  Bukti dikumpulkan ketua kelompok (<b>{kelompok.ketuaNama}</b>, {kelompok.jumlahAnggota} anggota).
                </>
              )}{' '}
              Usulan untuk hasil kelompok — terapkan ke semua anggota yang ikut, lalu sesuaikan per siswa bila perlu.
            </p>
          )}
          {usulan.ringkasan && <p className="td-ai-ringkasan">{usulan.ringkasan}</p>}

          {usulan.bukti.length > 0 && (
            <section aria-label="Bukti yang dianalisis">
              <h3 className="td-ai-subjudul">Bukti yang dianalisis</h3>
              <div className="td-ai-bukti">
                {usulan.bukti.map((b) => (
                  <figure
                    key={b.nomor}
                    className={`td-ai-bukti-item${nomorDipilih === b.nomor ? ' td-ai-bukti-item--on' : ''}`}
                  >
                    <div className="td-ai-bukti-media">
                      {b.jenis === 'foto' && foto[b.slot] ? (
                        <img src={foto[b.slot]} alt={b.label} loading="lazy" />
                      ) : b.jenis === 'video' && video[b.slot] ? (
                        <video src={video[b.slot]} controls preload="metadata" playsInline />
                      ) : (
                        <span className="td-ai-bukti-kosong">{b.jenis === 'video' ? 'Video' : 'Foto'}</span>
                      )}
                    </div>
                    <figcaption>
                      <b>#{b.nomor}</b> {b.label}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Skor per kategori">
            <h3 className="td-ai-subjudul">Skor per kategori</h3>
            <ul className="td-ai-kat">
              {usulan.kategori.map((k) => (
                <li
                  key={k.id}
                  className={`td-ai-kat-item${k.skor === null ? ' td-ai-kat-item--kosong' : ''}${k.perluDicek ? ' td-ai-kat-item--cek' : ''}`}
                >
                  <div className="td-ai-kat-skor" aria-label={k.skor === null ? 'Tidak dinilai AI' : `Skor ${k.skor}`}>
                    {k.skor === null ? '—' : k.skor}
                  </div>
                  <div className="td-ai-kat-isi">
                    <div className="td-ai-kat-judul">
                      <b>{k.nama}</b>
                      {k.dinilaiAi && (
                        <span className={`td-chip td-ai-yakin td-ai-yakin--${k.keyakinan}`}>{LABEL_YAKIN[k.keyakinan]}</span>
                      )}
                      {!k.dinilaiAi && <span className="td-chip">Nilai manual</span>}
                    </div>
                    <p>{k.alasan}</p>
                    {k.bukti.length > 0 && k.dinilaiAi && (
                      <div className="td-ai-rujuk">
                        Bukti:{' '}
                        {k.bukti.map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="td-ai-rujuk-btn"
                            onClick={() => setBesar(besar === n ? null : n)}
                            aria-pressed={besar === n}
                          >
                            #{n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {usulan.komentarSiswa && (
            <section aria-label="Draf komentar untuk siswa">
              <h3 className="td-ai-subjudul">Draf komentar untuk siswa</h3>
              <p className="td-ai-komentar">{usulan.komentarSiswa}</p>
            </section>
          )}

          {(() => {
            const poinList = daftarPoinPerbaikanDariUsulan(usulan)
            if (!poinList.length) return null
            return (
              <section aria-label="Poin perbaikan untuk siswa">
                <h3 className="td-ai-subjudul">Poin perbaikan untuk siswa</h3>
                <p className="td-ai-hint" style={{ marginTop: 0 }}>
                  Daftar ini masuk ke kotak «Poin perbaikan» (satu baris per butir) saat diterapkan. Guru boleh
                  mengedit sebelum menyimpan / minta perbaikan.
                </p>
                <ol className="td-ai-poin" style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                  {poinList.map((x, i) => (
                    <li key={i} style={{ marginBottom: '0.35rem' }}>
                      {x}
                    </li>
                  ))}
                </ol>
              </section>
            )
          })()}

          {(usulan.catatanKualitas.length > 0 || usulan.belumDikumpulkan.length > 0) && (
            <section aria-label="Catatan">
              <h3 className="td-ai-subjudul">Catatan</h3>
              <ul className="td-ai-catatan">
                {usulan.belumDikumpulkan.length > 0 && (
                  <li>Belum dikumpulkan: {usulan.belumDikumpulkan.join('; ')}.</li>
                )}
                {usulan.catatanKualitas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="td-modal-kaki">
          <span className="td-hint">
            {dinilai.length} kategori diusulkan
            {perluCek > 0 ? ` · ${perluCek} perlu Anda periksa` : ''} · model {usulan.model}
          </span>
          <div className="td-aksi-tombol">
            <button type="button" className="tg-btn" onClick={onTutup}>
              {sudahDiterapkan ? 'Tutup' : 'Batal'}
            </button>
            <button
              type="button"
              className={`tg-btn${onTerapkanKelompok ? '' : ' tg-btn--utama'}`}
              onClick={onTerapkan}
              disabled={dinilai.length === 0}
            >
              {sudahDiterapkan ? `Terapkan ulang ke ${namaTarget}` : onTerapkanKelompok ? `Hanya ${namaTarget}` : 'Terapkan ke draf nilai'}
            </button>
            {onTerapkanKelompok && kelompok && (
              <button type="button" className="tg-btn tg-btn--utama" onClick={onTerapkanKelompok} disabled={dinilai.length === 0}>
                Terapkan ke {kelompok.jumlahPenerima} anggota
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

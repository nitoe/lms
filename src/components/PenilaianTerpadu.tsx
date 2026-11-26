/**
 * «Menilai per siswa» — bukti pengumpulan (foto/video) dan input rubrik dalam SATU layar,
 * agar guru tidak bolak-balik antara tab Pengumpulan dan Daftar nilai. ANTIREGRESI §Tugas.Terpadu.
 *
 * Komponen ini TIDAK memegang data nilai: draf, status, dan penyimpanan tetap milik TugasDetail
 * (satu sumber kebenaran dengan Daftar nilai). Di sini hanya tampilan + navigasi siswa.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { muatFotoBerslot, slotDariFotoId, type PengumpulanDok } from '../lib/pengumpulan'
import { urlVideoTugas } from '../lib/videoTugas'
import type { BarisNilaiTugas } from '../lib/nilaiTugas'
import type { UsulanNilaiAi } from '../lib/nilaiTugasAi'
import type { TugasKelompokDok } from '../lib/tugasKelompok'
import { normKesempatanMaks, sisaKesempatan, tugasBerulang } from '../lib/kesempatanTugas'
import type { KategoriPenilaian, RentangPredikat, TugasLms } from '../types/tugas'
import '../styles/penilaian-terpadu.css'

export type DraftNilai = {
  perKategori: Record<string, string>
  nilaiAkhir: string
  predikat: string
  komentar: string
  /** Poin perbaikan untuk siswa, satu poin per baris (opsional; lihat DraftBaris di TugasDetail). */
  poin?: string
}
export type StatusBaris = 'kosong' | 'ubah' | 'ok'
export type SumberBukti = {
  pemilikId: string
  dok: PengumpulanDok
  via: 'sendiri' | 'kelompok'
  kelompok?: TugasKelompokDok
  /** Pemilik bukti adalah anggota yang mewakili ketua (ANTIREGRESI §Tugas.Kelompok.Wakil). */
  mewakili?: boolean
}

type Props = {
  tugas: TugasLms
  kategori: KategoriPenilaian[]
  rentang: RentangPredikat[]
  baris: BarisNilaiTugas[]
  draft: Record<string, DraftNilai>
  status: Record<string, StatusBaris>
  pengumpulanMap: Record<string, PengumpulanDok> | null
  sumberBukti: (siswaId: string) => SumberBukti | null
  kelompokList: TugasKelompokDok[]
  /** Anggota kelompok yang sedang mengikuti nilai ketua. */
  ikutKetua: (siswaId: string) => boolean
  /** Ketua atau anggota yang mewakili ketua: mengisi nilainya = mengisi nilai kelompok. */
  adalahPenentu: (siswaId: string) => boolean
  /** Jumlah baris kelompok (ketua + pengikut) yang belum tersimpan. */
  jumlahBelumSimpanKelompok: (ketuaId: string) => number
  terpilih: string | null
  onPilih: (siswaId: string) => void
  menyimpan: string | null
  bisaAi: boolean
  usulanAi: Record<string, UsulanNilaiAi>
  aiBusyId: string | null
  onSkor: (siswaId: string, katId: string, val: string) => void
  onNilaiAkhir: (siswaId: string, val: string) => void
  onPatch: (siswaId: string, patch: Partial<DraftNilai>) => void
  onSimpan: (siswaId: string, nama: string) => Promise<boolean>
  /** «Minta perbaikan» — buka percobaan berikutnya (hanya tugas berulang). */
  onMintaPerbaikan: (siswaId: string, nama: string) => Promise<boolean>
  onSimpanKelompok: (ketuaId: string) => Promise<boolean>
  onUsulkanAi: (pemilikId: string, targetId: string, nama: string) => Promise<boolean>
  onTerapkanUsulan: (siswaId: string, u: UsulanNilaiAi) => void
  onSamakan: (ketuaId: string) => void
  onIkutiKetua: (siswaId: string) => void
  onKeDaftar: () => void
  onKePengaturan: () => void
}

type Media = { foto: Record<number, string>; video: Record<number, string> }

type ItemBukti = {
  kunci: string
  nomor: number
  label: string
  petunjuk: string
  jenis: 'foto' | 'video'
  slot: number
  kategoriIds: string[]
}

const IKON_STATUS: Record<StatusBaris, string> = { ok: '✓', ubah: '●', kosong: '○' }
const TEKS_STATUS: Record<StatusBaris, string> = {
  ok: 'Tersimpan',
  ubah: 'Belum disimpan',
  kosong: 'Belum dinilai',
}

export default function PenilaianTerpadu(p: Props) {
  const {
    tugas, kategori, rentang, baris, draft, status, pengumpulanMap, sumberBukti, kelompokList,
    terpilih, menyimpan, bisaAi, usulanAi, aiBusyId,
  } = p

  const [saring, setSaring] = useState<'semua' | 'kosong'>('semua')
  const [fokusKat, setFokusKat] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const [media, setMedia] = useState<Record<string, Media>>({})
  const panelNilaiRef = useRef<HTMLDivElement>(null)
  const panelBuktiRef = useRef<HTMLDivElement>(null)

  // Siswa terpilih: default = siswa pertama yang belum dinilai, bila tidak ada → pertama.
  const idAktif = useMemo(() => {
    if (terpilih && baris.some((r) => r.siswaId === terpilih)) return terpilih
    return (baris.find((r) => status[r.siswaId] === 'kosong') ?? baris[0])?.siswaId ?? null
  }, [terpilih, baris, status])

  const nav = useMemo(
    () => baris.filter((r) => r.siswaId === idAktif || saring === 'semua' || status[r.siswaId] === 'kosong'),
    [baris, idAktif, saring, status],
  )
  const idx = nav.findIndex((r) => r.siswaId === idAktif)
  const row = idx >= 0 ? nav[idx] : null
  const nomorAsli = row ? baris.findIndex((r) => r.siswaId === row.siswaId) + 1 : 0

  const sb = row ? sumberBukti(row.siswaId) : null
  const pemilikId = sb?.pemilikId ?? null
  const d: DraftNilai = (row && draft[row.siswaId]) || { perKategori: {}, nilaiAkhir: '', predikat: '', komentar: '' }
  const st: StatusBaris = row ? (status[row.siswaId] ?? 'kosong') : 'kosong'
  const kel = row ? kelompokList.find((k) => k.anggotaIds.includes(row.siswaId)) : undefined
  const adalahKetua = !!kel && !!row && kel.ketuaId === row.siswaId
  const mengikuti = !!row && p.ikutKetua(row.siswaId)
  const adalahPenentu = !!row && !!kel && p.adalahPenentu(row.siswaId)
  const mewakili = !!sb?.mewakili
  const namaPemilik = pemilikId ? (baris.find((r) => r.siswaId === pemilikId)?.siswaNama ?? 'anggota') : ''
  // Mengirim sendiri DAN dinilai terpisah; anggota yang mewakili ketua justru ikut nilai ketua.
  const kirimMandiri = !!row && !!pengumpulanMap?.[row.siswaId] && !(mewakili && !!kel)
  const belumSimpanKel = adalahPenentu ? p.jumlahBelumSimpanKelompok(row.siswaId) : 0
  const u = pemilikId ? usulanAi[pemilikId] : undefined
  const sibukSimpan = menyimpan !== null
  // —— Tugas berulang (ANTIREGRESI §Tugas.Kesempatan) ——
  const berulang = tugasBerulang(tugas)
  const maksKes = normKesempatanMaks(tugas.kesempatanMaks)
  const kirimanBaru = !!row && row.bukaPerbaikan && (pengumpulanMap?.[row.siswaId]?.diubahMs ?? 0) > row.dibukaMs
  const menungguSiswa = !!row && row.bukaPerbaikan && !kirimanBaru
  const sisaKes = row ? sisaKesempatan(tugas.kesempatanMaks, row.percobaanKe) : 0
  const punyaPoinTersimpan = !!row && (row.poin || '').trim().length > 0
  const bisaMintaPerbaikan =
    berulang &&
    !!row &&
    row.sudahAda &&
    st === 'ok' &&
    !row.bukaPerbaikan &&
    sisaKes > 0 &&
    !kel &&
    punyaPoinTersimpan
  const alasanMintaPerbaikan = (() => {
    if (!berulang) return 'Tugas ini hanya sekali mengerjakan (atur kesempatan > 1 di pengaturan).'
    if (kel) return 'Tugas kelompok tidak mendukung perbaikan berulang.'
    if (!row?.sudahAda) return 'Simpan nilai siswa ini dulu.'
    if (st === 'ubah') return 'Ada perubahan di formulir yang belum disimpan. Klik «Simpan» dulu.'
    if (st === 'kosong') return 'Isi dan simpan nilai dulu.'
    if (row.bukaPerbaikan) return 'Perbaikan sudah dibuka — menunggu siswa mengirim ulang.'
    if (sisaKes <= 0) return 'Kesempatan mengerjakan sudah habis.'
    if (!punyaPoinTersimpan) {
      return 'Isi minimal satu poin perbaikan, lalu klik «Simpan». Setelah tersimpan, tombol ini aktif.'
    }
    return ''
  })()
  const sibukAi = !!pemilikId && aiBusyId === pemilikId
  const sibukMintaIni = menyimpan === row?.siswaId

  // Muat foto/video bukti siswa terpilih (di-cache per pemilik bukti).
  useEffect(() => {
    if (!sb) return
    // Kunci memuat waktu kirim: pengiriman ulang (percobaan baru) harus memuat foto baru, bukan cache lama.
    const id = `${sb.pemilikId}:${sb.dok.diubahMs}`
    if (media[id]) return
    let batal = false
    void (async () => {
      let foto: Record<number, string> = {}
      try {
        foto = await muatFotoBerslot(sb.dok.fotoIds)
      } catch {
        /* tampil «tidak dapat dimuat» */
      }
      const video: Record<number, string> = {}
      for (const [k, meta] of Object.entries(sb.dok.videos ?? {})) {
        try {
          video[Number(k)] = await urlVideoTugas(meta.path)
        } catch {
          /* video bisa sudah kedaluwarsa (120 hari) */
        }
      }
      if (!batal) setMedia((m) => ({ ...m, [id]: { foto, video } }))
    })()
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pemilikId, sb?.dok.diubahMs])

  // Ganti siswa → fokus rubrik direset, panel bukti kembali ke atas.
  useEffect(() => {
    setFokusKat(null)
    panelBuktiRef.current?.scrollTo({ top: 0 })
  }, [idAktif])

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  // Daftar bukti berlabel (mode baru) atau foto/video apa adanya (mode lama).
  const items: ItemBukti[] = useMemo(() => {
    if (!sb) return []
    const bl = tugas.buktiList ?? []
    if (bl.length > 0) {
      return bl.map((b, i) => ({
        kunci: b.id,
        nomor: i + 1,
        label: b.label,
        petunjuk: b.petunjuk ?? '',
        jenis: b.jenis === 'video' ? ('video' as const) : ('foto' as const),
        slot: b.slot,
        kategoriIds: b.kategoriIds ?? [],
      }))
    }
    const hasil: ItemBukti[] = []
    sb.dok.fotoIds.forEach((id) => {
      const slot = slotDariFotoId(id) // slot 1..10 (jangan pakai regex satu angka)
      if (slot) hasil.push({ kunci: `f${slot}`, nomor: hasil.length + 1, label: `Foto ${hasil.length + 1}`, petunjuk: '', jenis: 'foto', slot, kategoriIds: [] })
    })
    Object.keys(sb.dok.videos ?? {}).forEach((k) => {
      hasil.push({ kunci: `v${k}`, nomor: hasil.length + 1, label: `Video ${k}`, petunjuk: '', jenis: 'video', slot: Number(k), kategoriIds: [] })
    })
    return hasil
  }, [sb, tugas.buktiList])

  const namaKat = (id: string) => kategori.find((k) => k.id === id)?.nama ?? ''

  // Skor cepat dari rentang predikat (nilai tengah tiap rentang).
  const cepat = useMemo(
    () =>
      [...rentang]
        .sort((a, b) => b.min - a.min)
        .map((r) => ({ predikat: r.predikat, nilai: Math.min(100, Math.round((r.min + r.max) / 2)) })),
    [rentang],
  )

  function fokusKe(katId: string) {
    setFokusKat(katId)
    const pertama = items.find((it) => it.kategoriIds.includes(katId))
    if (pertama) {
      document.getElementById(`pt-bukti-${pertama.kunci}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  function pergi(arah: -1 | 1) {
    const t = nav[idx + arah]
    if (t) p.onPilih(t.siswaId)
  }

  async function simpan(lalu: boolean) {
    if (!row) return
    if (adalahPenentu && belumSimpanKel > 1) {
      if (!(await p.onSimpanKelompok(row.siswaId))) return
    } else if (st === 'ubah') {
      if (!(await p.onSimpan(row.siswaId, row.siswaNama))) return
    }
    if (lalu) pergi(1)
  }

  function enterBerikutnya(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const semua = Array.from(panelNilaiRef.current?.querySelectorAll<HTMLInputElement>('input[data-skor]') ?? [])
    const i = semua.indexOf(e.currentTarget)
    const berikut = semua[i + 1]
    if (berikut) berikut.focus()
    else panelNilaiRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
  }

  if (kategori.length === 0) {
    return (
      <div className="td-kosong-kecil">
        <b>Rubrik belum diatur</b>
        <p>Tambahkan kategori penilaian dulu agar bukti siswa bisa dinilai berdampingan dengan rubriknya.</p>
        <button type="button" className="tg-btn tg-btn--utama" onClick={p.onKePengaturan}>
          Atur rubrik
        </button>
      </div>
    )
  }
  if (baris.length === 0 || !row) {
    return (
      <div className="td-kosong-kecil">
        <b>Belum ada siswa</b>
        <p>Roster kelas kosong atau belum tersinkron dari Penilaian.</p>
      </div>
    )
  }

  const media1 = pemilikId && sb ? media[`${pemilikId}:${sb.dok.diubahMs}`] : undefined
  const adaBukti = !!sb

  return (
    <div className="pt">
      {/* Navigasi siswa */}
      <div className="pt-nav" role="group" aria-label="Pilih siswa">
        <button type="button" className="tg-btn" onClick={() => pergi(-1)} disabled={idx <= 0 || sibukSimpan} aria-label="Siswa sebelumnya">
          ◀
        </button>
        <label className="pt-nav-pilih">
          <span className="tg-sr">Siswa</span>
          <select value={row.siswaId} onChange={(e) => p.onPilih(e.target.value)} disabled={sibukSimpan}>
            {nav.map((r) => (
              <option key={r.siswaId} value={r.siswaId}>
                {IKON_STATUS[status[r.siswaId] ?? 'kosong']} {baris.findIndex((x) => x.siswaId === r.siswaId) + 1}. {r.siswaNama}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="tg-btn" onClick={() => pergi(1)} disabled={idx >= nav.length - 1 || sibukSimpan} aria-label="Siswa berikutnya">
          ▶
        </button>
        <span className="pt-nav-hitung">
          {idx + 1}/{nav.length}
        </span>
        <div className="pt-nav-saring" role="group" aria-label="Saring siswa">
          <button type="button" className={`tg-seg${saring === 'semua' ? ' tg-seg--on' : ''}`} aria-pressed={saring === 'semua'} onClick={() => setSaring('semua')}>
            Semua<i>{baris.length}</i>
          </button>
          <button type="button" className={`tg-seg${saring === 'kosong' ? ' tg-seg--on' : ''}`} aria-pressed={saring === 'kosong'} onClick={() => setSaring('kosong')}>
            Belum dinilai<i>{baris.filter((r) => status[r.siswaId] === 'kosong').length}</i>
          </button>
        </div>
        <button type="button" className="tg-btn pt-nav-daftar" onClick={p.onKeDaftar}>
          Lihat daftar nilai
        </button>
      </div>

      <div className={`pt-grid${adaBukti ? '' : ' pt-grid--tanpa'}`}>
        {/* ====== Bukti ====== */}
        <section className="pt-bukti" aria-label="Bukti pengumpulan" ref={panelBuktiRef}>
          <header className="pt-bukti-kepala">
            <h3>Bukti pengumpulan</h3>
            {sb?.via === 'kelompok' && !mewakili && (
              <span className="td-chip pt-chip-kel">Lewat ketua: {sb.kelompok?.ketuaNama}</span>
            )}
            {mewakili && <span className="td-chip pt-chip-kel">Dikirim {namaPemilik} mewakili ketua</span>}
            {sb && (
              <span className="td-hint">
                {sb.dok.fotoIds.length} foto
                {Object.keys(sb.dok.videos ?? {}).length > 0 ? ` · ${Object.keys(sb.dok.videos).length} video` : ''}
              </span>
            )}
          </header>

          {!adaBukti && (
            <div className="pt-kosong">
              {kel && !kirimMandiri
                ? `Menunggu ketua kelompok (${kel.ketuaNama}) mengumpulkan.`
                : pengumpulanMap === null
                  ? 'Memuat pengumpulan…'
                  : 'Belum ada pengumpulan dari siswa ini. Nilai tetap bisa diisi manual di samping.'}
            </div>
          )}

          {adaBukti && sb.dok.catatan && (
            <p className="pt-catatan">
              <b>Catatan siswa:</b> {sb.dok.catatan}
            </p>
          )}

          {adaBukti && !media1 && <div className="pt-kosong">Memuat bukti…</div>}

          {adaBukti && media1 && (
            <ul className="pt-bukti-daftar">
              {items.map((it) => {
                const url = it.jenis === 'video' ? media1.video[it.slot] : media1.foto[it.slot]
                const terkait = fokusKat !== null && it.kategoriIds.includes(fokusKat)
                const redup = fokusKat !== null && !terkait && it.kategoriIds.length > 0
                return (
                  <li
                    key={it.kunci}
                    id={`pt-bukti-${it.kunci}`}
                    className={`pt-item${terkait ? ' pt-item--fokus' : ''}${redup ? ' pt-item--redup' : ''}`}
                  >
                    <div className="pt-item-kepala">
                      <b>
                        #{it.nomor} {it.label}
                      </b>
                      {it.kategoriIds.map((kid) => (
                        <button key={kid} type="button" className="pt-tag" onClick={() => fokusKe(kid)} title="Sorot kategori ini">
                          {namaKat(kid)}
                        </button>
                      ))}
                    </div>
                    {it.petunjuk && <p className="td-hint">{it.petunjuk}</p>}
                    {url ? (
                      it.jenis === 'video' ? (
                        <video src={url} controls preload="metadata" playsInline />
                      ) : (
                        <button type="button" className="pt-foto" onClick={() => setZoom(url)} aria-label={`Perbesar ${it.label}`}>
                          <img src={url} alt={it.label} loading="lazy" />
                        </button>
                      )
                    ) : (
                      <div className="pt-kosong pt-kosong--kecil">Tidak dikumpulkan / tidak dapat dimuat</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ====== Rubrik & nilai ====== */}
        <section className="pt-nilai" aria-label="Penilaian" ref={panelNilaiRef}>
          <header className="pt-nilai-kepala">
            <div>
              <h3>
                {nomorAsli}. {row.siswaNama}
              </h3>
              <span className={`td-status-baris td-status-baris--${st}`}>{TEKS_STATUS[st]}</span>
            </div>
            {bisaAi && adaBukti && (
              <div className="pt-ai-aksi">
                <button
                  type="button"
                  className="td-btn-ai-teks"
                  disabled={sibukAi || aiBusyId !== null}
                  onClick={() => pemilikId && void p.onUsulkanAi(pemilikId, row.siswaId, row.siswaNama)}
                >
                  {sibukAi ? 'Menganalisis…' : u ? '↻ Usulan AI ulang' : '✦ Usulan AI'}
                </button>
                {u && (
                  <button type="button" className="td-btn-ai-teks" onClick={() => p.onTerapkanUsulan(row.siswaId, u)}>
                    Terapkan semua
                  </button>
                )}
              </div>
            )}
          </header>

          {kel && (
            <div className="pt-kelompok">
              {adalahPenentu ? (
                <p>
                  {adalahKetua ? (
                    <>
                      <b>Ketua kelompok</b> · {kel.anggotaIds.length} anggota.
                    </>
                  ) : (
                    <>
                      <b>{row.siswaNama}</b> mengirim bukti mewakili ketua ({kel.ketuaNama}) · {kel.anggotaIds.length} anggota.
                    </>
                  )}{' '}
                  Nilai di sini adalah nilai kelompok: otomatis diikuti ketua{adalahKetua ? ' dan wakilnya' : ''} serta anggota yang
                  belum disesuaikan.
                  {adalahKetua && mewakili && (
                    <>
                      {' '}
                      Bukti dikirim <b>{namaPemilik}</b> mewakili ketua.
                    </>
                  )}
                </p>
              ) : kirimMandiri ? (
                <p>Anggota ini mengirim sendiri; dinilai dari buktinya sendiri.</p>
              ) : mengikuti ? (
                <p>
                  Mengikuti nilai ketua (<b>{kel.ketuaNama}</b>). Mengubah nilai di sini hanya berlaku untuk {row.siswaNama}.
                </p>
              ) : (
                <p>
                  Nilai disesuaikan manual.{' '}
                  <button type="button" className="td-link-kecil" onClick={() => p.onIkutiKetua(row.siswaId)}>
                    Ikuti nilai ketua lagi
                  </button>
                </p>
              )}
              <div className="pt-kelompok-anggota">
                {kel.anggotaList.map((a) => {
                  const s = status[a.id]
                  if (!s) return null
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`pt-anggota${a.id === row.siswaId ? ' pt-anggota--on' : ''}`}
                      onClick={() => p.onPilih(a.id)}
                      title={TEKS_STATUS[s]}
                    >
                      <span className={`pt-dot pt-dot--${s}`} aria-hidden="true" />
                      {a.nama}
                      {a.id === kel.ketuaId ? ' (ketua)' : ''}
                    </button>
                  )
                })}
              </div>
              {adalahPenentu && (
                <button type="button" className="td-link-kecil" onClick={() => p.onSamakan(row.siswaId)}>
                  {adalahKetua ? 'Samakan semua anggota dengan ketua' : 'Samakan ketua & semua anggota dengan nilai ini'}
                </button>
              )}
            </div>
          )}

          {u && u.ringkasan && <p className="td-ai-ringkasan">{u.ringkasan}</p>}

          <ul className="pt-kat-daftar">
            {kategori.map((k) => {
              const tertaut = items.filter((it) => it.kategoriIds.includes(k.id))
              const uk = u?.kategori.find((x) => x.id === k.id)
              return (
                <li key={k.id} className={`pt-kat${fokusKat === k.id ? ' pt-kat--fokus' : ''}`}>
                  <div className="pt-kat-kepala">
                    <b>{k.nama}</b>
                    <span className="td-chip">bobot {k.bobot}</span>
                    {k.sumber === 'observasi' && <span className="td-chip">Observasi</span>}
                  </div>
                  {k.deskripsi && <p className="pt-kat-desk">{k.deskripsi}</p>}
                  {tertaut.length > 0 && (
                    <div className="pt-kat-bukti">
                      Lihat:{' '}
                      {tertaut.map((it) => (
                        <button key={it.kunci} type="button" className="pt-tag" onClick={() => fokusKe(k.id)}>
                          #{it.nomor} {it.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="pt-kat-input">
                    <input
                      data-skor
                      type="text"
                      inputMode="decimal"
                      className="td-input-sm pt-skor"
                      placeholder="0–100"
                      value={d.perKategori[k.id] ?? ''}
                      onFocus={() => fokusKe(k.id)}
                      onChange={(e) => p.onSkor(row.siswaId, k.id, e.target.value)}
                      onKeyDown={enterBerikutnya}
                      aria-label={`Skor ${k.nama}`}
                    />
                    <div className="pt-cepat" role="group" aria-label={`Skor cepat ${k.nama}`}>
                      {cepat.map((c) => (
                        <button
                          key={c.predikat}
                          type="button"
                          className={`pt-cepat-btn${d.perKategori[k.id] === String(c.nilai) ? ' pt-cepat-btn--on' : ''}`}
                          title={`${c.predikat} = ${c.nilai}`}
                          onClick={() => p.onSkor(row.siswaId, k.id, String(c.nilai))}
                        >
                          {c.predikat}
                        </button>
                      ))}
                    </div>
                  </div>
                  {uk && (
                    <div className={`pt-ai${uk.perluDicek ? ' pt-ai--cek' : ''}`}>
                      <div className="pt-ai-baris">
                        <b>AI: {uk.skor === null ? 'tidak dinilai' : uk.skor}</b>
                        {uk.dinilaiAi && <span className={`td-chip td-ai-yakin td-ai-yakin--${uk.keyakinan}`}>{uk.keyakinan}</span>}
                        {uk.skor !== null && (
                          <button type="button" className="td-link-kecil" onClick={() => p.onSkor(row.siswaId, k.id, String(uk.skor))}>
                            Pakai
                          </button>
                        )}
                      </div>
                      <p>{uk.alasan}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="pt-hasil">
            <label className="td-field td-field--sempit">
              <span>Nilai akhir</span>
              <input
                type="text"
                inputMode="decimal"
                className="td-input-sm td-input--tebal"
                value={d.nilaiAkhir}
                onChange={(e) => p.onNilaiAkhir(row.siswaId, e.target.value)}
                aria-label="Nilai akhir"
              />
            </label>
            <label className="td-field td-field--sempit">
              <span>Predikat</span>
              <select className="td-select-sm" value={d.predikat} onChange={(e) => p.onPatch(row.siswaId, { predikat: e.target.value })}>
                <option value="">—</option>
                {rentang.map((r) => (
                  <option key={r.predikat} value={r.predikat}>
                    {r.predikat}
                  </option>
                ))}
              </select>
            </label>
            <label className="td-field pt-komentar">
              <span>Komentar untuk siswa</span>
              <textarea rows={3} value={d.komentar} onChange={(e) => p.onPatch(row.siswaId, { komentar: e.target.value })} placeholder="Opsional" />
            </label>
            <label className="td-field pt-komentar">
              <span>Poin perbaikan untuk siswa (satu poin per baris)</span>
              <textarea
                rows={3}
                value={d.poin ?? ''}
                onChange={(e) => p.onPatch(row.siswaId, { poin: e.target.value })}
                placeholder={'Tulis dengan bahasa yang mudah untuk anak SD, beserta contoh.\nContoh: Tambahkan nama bagian pada gambarmu, misalnya tulis «akar» di dekat bagian bawah tanaman.'}
              />
            </label>
          </div>

          {berulang && row && (
            <div className={`td-hint${menungguSiswa ? '' : ' td-hint--warn'}`} role="status">
              <strong>
                Percobaan ke-{Math.max(1, row.percobaanKe)}
                {maksKes === 0 ? '' : ` dari ${maksKes}`}
              </strong>
              {row.sudahAda && row.nilaiDipakai !== null ? ` · nilai yang dipakai: ${row.nilaiDipakai}` : ''}
              {row.riwayat.length > 1
                ? ` · riwayat: ${row.riwayat.map((r) => `${r.ke}→${r.nilai}`).join(', ')}`
                : ''}
              {kirimanBaru ? ' · Siswa sudah mengirim perbaikan — silakan dinilai.' : ''}
              {menungguSiswa ? ' · Perbaikan dibuka, menunggu siswa mengirim ulang.' : ''}
              {!menungguSiswa && !kirimanBaru && row.sudahAda && sisaKes <= 0 ? ' · Kesempatan habis.' : ''}
              {kel ? ' · Tugas kelompok tidak mendukung perbaikan berulang.' : ''}
            </div>
          )}
          {berulang && row && !bisaMintaPerbaikan && alasanMintaPerbaikan && !row.bukaPerbaikan && (
            <p className="td-hint td-hint--warn" role="status">
              «Minta perbaikan» belum aktif: {alasanMintaPerbaikan}
            </p>
          )}
          {berulang && row && menungguSiswa && (
            <p className="td-hint" role="status">
              Perbaikan sudah dibuka untuk siswa ini. Menunggu kiriman ulang.
            </p>
          )}

          <div className="pt-aksi td-aksi--lekat">
            <span className="td-ubah td-ubah--teks">
              <span className={`pt-dot pt-dot--${st}`} aria-hidden="true" /> {TEKS_STATUS[st]}
            </span>
            <div className="td-aksi-tombol">
              <button
                type="button"
                className="tg-btn"
                disabled={sibukSimpan || (st !== 'ubah' && !(adalahPenentu && belumSimpanKel > 0))}
                onClick={() => void simpan(false)}
              >
                {menyimpan !== null ? 'Menyimpan…' : adalahPenentu && belumSimpanKel > 1 ? `Simpan kelompok (${belumSimpanKel})` : 'Simpan'}
              </button>
              {berulang && (
                <button
                  type="button"
                  className="tg-btn"
                  disabled={sibukSimpan || !bisaMintaPerbaikan}
                  title={bisaMintaPerbaikan ? 'Buka percobaan berikutnya agar siswa bisa mengirim ulang.' : alasanMintaPerbaikan}
                  onClick={() => {
                    if (!row) return
                    if (!bisaMintaPerbaikan) {
                      window.alert(alasanMintaPerbaikan || 'Belum bisa meminta perbaikan.')
                      return
                    }
                    void (async () => {
                      const ok = await p.onMintaPerbaikan(row.siswaId, row.siswaNama)
                      if (ok) {
                        window.alert(
                          `Perbaikan dibuka untuk ${row.siswaNama}.\nSiswa dapat melihat poin perbaikan dan mengirim ulang.`,
                        )
                      }
                      // Gagal: parent setError — tetap alert ringkas agar terlihat di panel menilai
                      else {
                        window.alert(
                          'Gagal membuka perbaikan. Periksa pesan merah di bagian atas halaman (poin perbaikan harus sudah disimpan, atau kesempatan habis).',
                        )
                      }
                    })()
                  }}
                >
                  {sibukMintaIni ? 'Membuka…' : 'Minta perbaikan'}
                </button>
              )}
              <button type="button" className="tg-btn tg-btn--utama" disabled={sibukSimpan || idx >= nav.length - 1 && st !== 'ubah'} onClick={() => void simpan(true)}>
                {st === 'ubah' ? 'Simpan & berikutnya ▶' : 'Berikutnya ▶'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {zoom && (
        <div className="pt-zoom" role="dialog" aria-modal="true" aria-label="Foto diperbesar" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Bukti diperbesar" />
          <button type="button" className="tg-btn" onClick={() => setZoom(null)}>
            Tutup
          </button>
        </div>
      )}
    </div>
  )
}

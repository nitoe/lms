import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { bolehGenerateSoalAi } from '../lib/generateSoalAi'
import {
  buatKuisDariPaket,
  daftarKuis,
  daftarKuisDibuatOleh,
  daftarPaketSiap,
  aturBerbagiKuis,
  hapusKuis,
  updateKuis,
} from '../lib/kuis'
import {
  deteksiDuplikatKasar,
  hitungRingkasanKuis,
  kumpulkanKandidat,
  susunManual,
  susunOtomatis,
} from '../lib/susunKuis'
import { teksPolos } from '../lib/html'
import { daftarJawabanKuis } from '../lib/jawabanKuis'
import { ringkasanPaket } from '../lib/soal'
import type { FilterSusunKuis, KuisLms, ModeSusunKuis, SoalKuis, TahapTryOutTka } from '../types/kuis'
import {
  DAFTAR_TAHAP_TRYOUT_TKA,
  NAMA_JENIS_PENILAIAN,
  NAMA_JENIS_PENILAIAN_SISWA,
  NAMA_TAHAP_TRYOUT_TKA,
} from '../types/kuis'
import type { KompleksitasSoal, PaketSoal, TipeSoal } from '../types/soal'
import {
  NAMA_KOMPLEKSITAS,
  NAMA_TIPE,
  URUTAN_KOMPLEKSITAS,
  URUTAN_TIPE,
  normalisasiKompleksitas,
} from '../types/soal'
import { adalahMapelTka, LABEL_MAPEL_TKA, materiTkaUntuk, TIPE_SOAL_TKA } from '../lib/tkaAkses'
import { kelasAksenMapel, LABEL_TIPE_PENDEK, materiPaket, paketMemuatMateri } from '../lib/aksenTka'
import KonfirmasiHapusDialog from './KonfirmasiHapusDialog'
import BerbagiKelasDialog from './BerbagiKelasDialog'
import { labelKelasDibagikan } from '../lib/kelasLms'
import KuisDetail, { INSTRUKSI_TIPE } from './KuisDetail'
import HasilKuisPanel from './HasilKuisPanel'
import OfflineKuisPanel from './OfflineKuisPanel'
import { KnKembali, KuisKepala, type ChipKepala } from './KuisNav'
import { IkonAtur, IkonGrafik, IkonInput } from './ikonRuang'
import PilihSoalManual from './soal/PilihSoalManual'
import '../styles/tka-bank.css'

type Props = {
  kelas: string
  mapel: string
}

type Langkah = 'daftar' | 'wizard' | 'detail'

function urutkanMenurutBentuk(
  list: SoalKuis[],
  urutan: readonly TipeSoal[] = URUTAN_TIPE,
): SoalKuis[] {
  const map = new Map<string, SoalKuis[]>()
  for (const t of urutan) map.set(t, [])
  for (const s of list) {
    const arr = map.get(s.tipe)
    if (arr) arr.push(s)
    else {
      // tipe di luar daftar (mis. data lama) — tampilkan di akhir
      if (!map.has(s.tipe)) map.set(s.tipe, [])
      map.get(s.tipe)!.push(s)
    }
  }
  const out: SoalKuis[] = []
  for (const t of urutan) {
    out.push(...(map.get(t) ?? []))
  }
  for (const [t, arr] of map) {
    if (!(urutan as readonly string[]).includes(t) && arr.length) out.push(...arr)
  }
  return out
}



function kelompokkanPerTipe(soal: SoalKuis[], urutan: readonly TipeSoal[]) {
  const peta = new Map<string, SoalKuis[]>()
  for (const t of urutan) peta.set(t, [])
  for (const s of soal) {
    const arr = peta.get(s.tipe)
    if (arr) arr.push(s)
    else peta.set(s.tipe, [s])
  }
  const urut = [
    ...urutan,
    ...[...peta.keys()].filter((t) => !(urutan as readonly string[]).includes(t)),
  ]
  return urut
    .map((t) => ({ tipe: t as TipeSoal, items: peta.get(t) ?? [] }))
    .filter((g) => g.items.length > 0)
}

const PRESET_JUMLAH = [10, 15, 20, 25, 30]

export default function KuisPanel({ kelas, mapel }: Props) {
  const { profil, user } = useAuth()
  const bolehAi = bolehGenerateSoalAi(user?.uid)
  /** Filter bentuk soal TKA hanya PG / PGK / BS — jangan regresi mapel biasa (ANTIREGRESI §88). */
  const isTka = adalahMapelTka(mapel)
  const tipePilihan: readonly TipeSoal[] = isTka ? TIPE_SOAL_TKA : URUTAN_TIPE

  const [list, setList] = useState<KuisLms[] | null>(null)
  const [paketSiap, setPaketSiap] = useState<PaketSoal[]>([])
  /** Diagnosis bila tidak ada paket Siap padahal Bank Soal TKA berisi paket (ANTIREGRESI §121). */
  const [diagnosaPaket, setDiagnosaPaket] = useState('')
  /** Kuis yang sedang dikonfirmasi untuk dihapus (jumlahJawaban null = sedang dihitung). */
  const [hapusTarget, setHapusTarget] = useState<{ kuis: KuisLms; jumlahJawaban: number | null } | null>(null)
  const [berbagiTarget, setBerbagiTarget] = useState<KuisLms | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [langkah, setLangkah] = useState<Langkah>('daftar')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'atur' | 'hasil' | 'offline'>('atur')

  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [tahapTryOutTka, setTahapTryOutTka] = useState<TahapTryOutTka | ''>('')
  const [paketIds, setPaketIds] = useState<string[]>([])
  const [mode, setMode] = useState<ModeSusunKuis>('otomatis')
  const [jumlahSoal, setJumlahSoal] = useState(10)
  const [tipeAktif, setTipeAktif] = useState<TipeSoal[]>([])
  const [kompleksitasAktif, setKompleksitasAktif] = useState<KompleksitasSoal[]>([])
  const [pilihanManual, setPilihanManual] = useState<{ paketId: string; soalId: string }[]>([])
  const [pratinjau, setPratinjau] = useState<SoalKuis[] | null>(null)
  const [peringatanDuplikat, setPeringatanDuplikat] = useState<string[]>([])

  const muat = useCallback(async () => {
    setError('')
    try {
      const kelasU = String(kelas).toUpperCase()
      const [k, milikSaya, p] = await Promise.all([
        daftarKuis(kelas, mapel).catch((e) => {
          console.warn('daftarKuis', e)
          return [] as KuisLms[]
        }),
        daftarKuisDibuatOleh().catch((e) => {
          console.warn('daftarKuisDibuatOleh', e)
          return [] as KuisLms[]
        }),
        daftarPaketSiap(kelas, mapel).catch(() => []),
      ])
      // Gabung: query kelas×mapel + kuis saya di kelas yang sama (mapel sama ATAU
      // mapel beda sedikit — tetap ditampilkan agar data lama tidak hilang dari UI).
      const map = new Map<string, KuisLms>()
      for (const item of k) map.set(item.id, item)
      // TKA: tiga mapel berbagi kelas bank «6» — kuis mapel TKA lain JANGAN ikut tampil
      // (ANTIREGRESI §120). Mapel biasa tetap toleran terhadap data lama.
      const ketatMapel = adalahMapelTka(mapel)
      for (const item of milikSaya) {
        const itemKelas = String(item.kelas || '').toUpperCase()
        const diList =
          Array.isArray(item.kelasList) &&
          item.kelasList.map((x) => String(x).toUpperCase()).includes(kelasU)
        if (itemKelas !== kelasU && !diList) continue
        if (ketatMapel && String(item.mapel || '').trim() !== String(mapel).trim()) continue
        // prioritaskan mapel yang sama; tetap sertakan mapel lain di kelas ini milik saya
        if (!map.has(item.id)) map.set(item.id, item)
      }
      const gabung = [...map.values()].sort((a, b) => {
        const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0
        const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0
        return tb - ta
      })
      setList(gabung)
      setPaketSiap(p)
      setDiagnosaPaket('')
      if (p.length === 0 && adalahMapelTka(mapel)) {
        void ringkasanPaket(kelas, mapel)
          .then((r) => {
            if (r.total === 0) return
            const kelasTeks = Object.entries(r.perKelas)
              .map(([kl, n]) => `${kl}: ${n}`)
              .join(', ')
            const bagian = [`Bank Soal memuat ${r.total} paket (${kelasTeks})`]
            if (r.draf > 0) bagian.push(`${r.draf} masih Draf`)
            if (r.siapKosong > 0) bagian.push(`${r.siapKosong} berstatus Siap tetapi tidak berisi soal`)
            setDiagnosaPaket(bagian.join(' · ') + '.')
          })
          .catch(() => {})
      }
      if (gabung.length === 0 && k.length === 0) {
        // biarkan empty state; error hanya jika keduanya gagal total sudah di-catch di atas
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kuis.')
      setList([])
    }
  }, [kelas, mapel])

  useEffect(() => {
    void muat()
  }, [muat])

  const filterSusun: FilterSusunKuis = useMemo(
    () => ({
      jumlahSoal: jumlahSoal > 0 ? jumlahSoal : undefined,
      // TKA: kosong = hanya bentuk resmi TKA (pg/pgk/bs), bukan semua tipe mapel
      tipe: tipeAktif.length
        ? tipeAktif
        : isTka
          ? ([...TIPE_SOAL_TKA] as TipeSoal[])
          : undefined,
      kompleksitas: kompleksitasAktif.length ? kompleksitasAktif : undefined,
    }),
    [jumlahSoal, tipeAktif, kompleksitasAktif, isTka],
  )

  const kandidat = useMemo(() => {
    const dipilih = paketSiap.filter((p) => paketIds.includes(p.id))
    return kumpulkanKandidat(dipilih)
  }, [paketSiap, paketIds])

  const [qPaket, setQPaket] = useState('')
  const [materiPaketAktif, setMateriPaketAktif] = useState('')

  const paketTampil = useMemo(() => {
    const kata = qPaket.trim().toLowerCase()
    return paketSiap.filter((p) => {
      if (isTka && materiPaketAktif && !paketMemuatMateri(p, materiPaketAktif)) return false
      if (!kata) return true
      return `${p.judul} ${p.tpNama ?? ''} ${materiPaket(p)}`.toLowerCase().includes(kata)
    })
  }, [paketSiap, qPaket, materiPaketAktif, isTka])

  const materiTersedia = useMemo(() => {
    if (!isTka) return [] as { materi: string; n: number }[]
    return materiTkaUntuk(mapel)
      .map((m) => ({ materi: m, n: paketSiap.filter((p) => paketMemuatMateri(p, m)).length }))
      .filter((x) => x.n > 0)
  }, [isTka, mapel, paketSiap])

  /** Jumlah soal yang benar-benar tersedia dari paket terpilih, menurut filter aktif. */
  const tersedia = useMemo(() => {
    const perTipe: Partial<Record<TipeSoal, number>> = {}
    const perLevel: Partial<Record<KompleksitasSoal, number>> = {}
    let total = 0
    const tipeEfektif: readonly TipeSoal[] = tipeAktif.length ? tipeAktif : isTka ? TIPE_SOAL_TKA : []
    for (const c of kandidat) {
      const t = c.soal.tipe
      const k = normalisasiKompleksitas(c.soal.kompleksitas)
      const lolosTipe = tipeEfektif.length === 0 || tipeEfektif.includes(t)
      const lolosLevel = kompleksitasAktif.length === 0 || kompleksitasAktif.includes(k)
      if (lolosLevel && (!isTka || (TIPE_SOAL_TKA as readonly string[]).includes(t))) {
        perTipe[t] = (perTipe[t] ?? 0) + 1
      }
      if (lolosTipe) perLevel[k] = (perLevel[k] ?? 0) + 1
      if (lolosTipe && lolosLevel) total += 1
    }
    return { perTipe, perLevel, total }
  }, [kandidat, tipeAktif, kompleksitasAktif, isTka])

  function pilihSemuaTampil() {
    setPaketIds((prev) => Array.from(new Set([...prev, ...paketTampil.map((p) => p.id)])))
    setPratinjau(null)
    setPeringatanDuplikat([])
  }

  function kosongkanPaket() {
    setPaketIds([])
    setPilihanManual([])
    setPratinjau(null)
    setPeringatanDuplikat([])
  }

  function keBagian(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function mulaiWizard() {
    resetWizard()
    setMode(bolehAi ? 'otomatis_ai' : 'otomatis')
    setLangkah('wizard')
  }

  function togglePaket(id: string) {
    setPaketIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPratinjau(null)
    setPeringatanDuplikat([])
  }

  function toggleTipe(t: TipeSoal) {
    setTipeAktif((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
    setPratinjau(null)
  }

  function toggleKompleksitas(k: KompleksitasSoal) {
    setKompleksitasAktif((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    )
    setPratinjau(null)
  }

  function togglePilihanManual(paketId: string, soalId: string) {
    setPilihanManual((prev) => {
      const ada = prev.some((p) => p.paketId === paketId && p.soalId === soalId)
      if (ada) return prev.filter((p) => !(p.paketId === paketId && p.soalId === soalId))
      return [...prev, { paketId, soalId }]
    })
    setPratinjau(null)
  }

  function buatPratinjau() {
    setError('')
    setPeringatanDuplikat([])
    if (!paketIds.length) {
      setError('Pilih minimal satu paket yang siap.')
      return
    }
    try {
      let soal: SoalKuis[]
      if (mode === 'manual') {
        if (!pilihanManual.length) {
          setError('Pilih minimal satu soal secara manual.')
          return
        }
        soal = susunManual(kandidat, pilihanManual)
      } else {
        soal = susunOtomatis(kandidat, filterSusun, { seedAcak: true })
      }
      if (!soal.length) {
        setError('Tidak ada soal yang memenuhi filter. Perlonggar filter atau pilih paket lain.')
        setPratinjau([])
        return
      }
      // Otomatis kelompokkan menurut bentuk soal
      soal = urutkanMenurutBentuk(soal, tipePilihan)
      setPratinjau(soal)

      if (mode === 'otomatis_ai' || mode === 'otomatis') {
        const dup = deteksiDuplikatKasar(soal)
        if (dup.length) {
          setPeringatanDuplikat(
            dup.slice(0, 8).map((d) => {
              const a = teksPolos(soal[d.a].teks).slice(0, 60)
              const b = teksPolos(soal[d.b].teks).slice(0, 60)
              return `Soal #${d.a + 1} ≈ #${d.b + 1} (${Math.round(d.skor * 100)}%): «${a}…» ↔ «${b}…»`
            }),
          )
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyusun pratinjau.')
    }
  }

  function buangDuplikatKasar() {
    if (!pratinjau?.length) return
    const dup = deteksiDuplikatKasar(pratinjau)
    if (!dup.length) return
    const buang = new Set<number>()
    for (const d of dup) {
      buang.add(d.b)
    }
    const sisa = urutkanMenurutBentuk(pratinjau.filter((_, i) => !buang.has(i)), tipePilihan)
    setPratinjau(sisa)
    setPeringatanDuplikat([])
  }

  async function onSimpanKuis() {
    if (!judul.trim()) {
      setError('Judul kuis wajib diisi.')
      return
    }
    if (!pratinjau?.length) {
      setError('Susun pratinjau soal terlebih dahulu.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Kumpulkan TP unik dari paket yang dipilih
      const tpMap = new Map<string, string>()
      for (const pid of paketIds) {
        const pk = paketSiap.find((x) => x.id === pid)
        if (pk?.tpId && pk.tpNama) {
          const namaBersih = String(pk.tpNama).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
          const label = pk.tpNomor ? `TP ${pk.tpNomor}. ${namaBersih}` : namaBersih
          tpMap.set(pk.tpId, label)
        }
      }
      const tpIds = [...tpMap.keys()]
      const tpNamaList = [...tpMap.values()]

      const id = await buatKuisDariPaket({
        kelas,
        mapel,
        judul,
        deskripsi,
        namaGuru: profil?.nama,
        sumberPaketIds: paketIds,
        modeSusun: mode,
        filterSusun: mode === 'manual' ? undefined : filterSusun,
        soalSiap: pratinjau,
        tpIds: tpIds.length ? tpIds : undefined,
        tpNamaList: tpNamaList.length ? tpNamaList : undefined,
        tahapTryOutTka: isTka && tahapTryOutTka ? tahapTryOutTka : undefined,
      })
      resetWizard()
      await muat()
      setSelectedId(id)
      setLangkah('detail')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat kuis.')
    } finally {
      setBusy(false)
    }
  }

  function resetWizard() {
    setJudul('')
    setDeskripsi('')
    setTahapTryOutTka('')
    setPaketIds([])
    setMode(bolehAi ? 'otomatis_ai' : 'otomatis')
    setJumlahSoal(10)
    setTipeAktif([])
    setKompleksitasAktif([])
    setPilihanManual([])
    setPratinjau(null)
    setPeringatanDuplikat([])
    setQPaket('')
    setMateriPaketAktif('')
  }

  /** Langkah 1: buka dialog konfirmasi (hitung dulu hasil siswa yang akan kehilangan kuis). */
  function onHapus(k: KuisLms) {
    setHapusTarget({ kuis: k, jumlahJawaban: null })
    void daftarJawabanKuis(k.id, k.kelas, k.mapel)
      .then((list) => {
        setHapusTarget((cur) => (cur && cur.kuis.id === k.id ? { kuis: k, jumlahJawaban: list.length } : cur))
      })
      .catch(() => {
        /* jumlah tetap tidak diketahui; konfirmasi tetap berlaku */
      })
  }

  /** Langkah 2: hapus setelah pengguna mengetik kata kunci di dialog. */
  async function konfirmasiHapus() {
    if (!hapusTarget) return
    const k = hapusTarget.kuis
    setBusy(true)
    setError('')
    try {
      await hapusKuis(k.id)
      setHapusTarget(null)
      if (selectedId === k.id) {
        setSelectedId(null)
        setLangkah('daftar')
      }
      await muat()
    } catch (err) {
      setHapusTarget(null)
      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  function dialogHapus() {
    if (!hapusTarget) return null
    const { kuis: k, jumlahJawaban } = hapusTarget
    const tka = Boolean(k.tahapTryOutTka) || adalahMapelTka(k.mapel)
    const rincian = [
      `${k.jumlahSoal} soal ikut terhapus.`,
      jumlahJawaban == null
        ? 'Memeriksa hasil pengerjaan siswa…'
        : jumlahJawaban > 0
          ? `${jumlahJawaban} hasil pengerjaan siswa tidak dapat ditampilkan lagi (nilai & analisis soal hilang dari rekap kuis).`
          : 'Belum ada hasil pengerjaan siswa.',
    ]
    const peringatan: string[] = []
    if (tka) {
      peringatan.push(
        k.tahapTryOutTka
          ? `Kuis Try Out TKA ${NAMA_TAHAP_TRYOUT_TKA[k.tahapTryOutTka]}: nilai otomatis dan sebaran kompetensi dari kuis ini akan hilang dari Rekap Nilai TKA. Nilai manual tidak terpengaruh.`
          : 'Kuis TKA: nilai & sebaran dari kuis ini dapat hilang dari Rekap Nilai TKA.',
      )
    }
    if (jumlahJawaban != null && jumlahJawaban > 0) {
      peringatan.push('Siswa sudah mengerjakan kuis ini.')
    }
    return (
      <KonfirmasiHapusDialog
        judul="Hapus kuis ini?"
        nama={k.judul}
        rincian={rincian}
        peringatan={peringatan}
        saran="Hanya ingin menyembunyikan dari siswa? Pakai «Nonaktifkan» — data tetap aman."
        busy={busy}
        onBatal={() => setHapusTarget(null)}
        onKonfirmasi={() => void konfirmasiHapus()}
      />
    )
  }

  async function onToggleAktif(k: KuisLms) {
    setBusy(true)
    setError('')
    try {
      await updateKuis(k.id, { aktif: !k.aktif })
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusy(false)
    }
  }

  if (langkah === 'detail' && selectedId) {
    const kuis = list?.find((k) => k.id === selectedId)
    const offline = kuis?.modePelaksanaan === 'offline'
    const kembaliKeDaftar = () => {
      setSelectedId(null)
      setDetailTab('atur')
      setLangkah('daftar')
    }

    if (!kuis) {
      return (
        <div className="space-y-4">
          <KnKembali onClick={kembaliKeDaftar}>Daftar kuis</KnKembali>
          <div className="lms-empty">Kuis tidak ditemukan.</div>
        </div>
      )
    }

    // Kuis online tidak punya tab «Input offline»; perilaku lama: jatuh ke Hasil siswa.
    const tabEfektif = detailTab === 'offline' && !offline ? 'hasil' : detailTab
    const chips: ChipKepala[] = []
    if (adalahMapelTka(kuis.mapel) && kuis.tahapTryOutTka) {
      chips.push({ teks: NAMA_TAHAP_TRYOUT_TKA[kuis.tahapTryOutTka], nada: 'jenis' })
    } else {
      const jp = kuis.jenisPenilaian ?? 'latihan'
      chips.push({ teks: NAMA_JENIS_PENILAIAN_SISWA[jp], nada: 'jenis', title: NAMA_JENIS_PENILAIAN[jp] })
    }
    chips.push({ teks: offline ? 'Offline' : 'Online', nada: offline ? 'offline' : 'online' })
    chips.push({
      teks: kuis.aktif ? 'Aktif' : 'Nonaktif',
      nada: kuis.aktif ? 'aktif' : 'nonaktif',
      title: kuis.aktif ? 'Terlihat oleh siswa' : 'Belum terlihat oleh siswa',
    })
    chips.push({ teks: `${kuis.jumlahSoal} soal` })

    return (
      <div className="space-y-4">
        <KuisKepala
          onKembali={kembaliKeDaftar}
          labelKembali="Daftar kuis"
          judul={kuis.judul}
          chips={chips}
          nav={{
            label: 'Bagian kuis',
            idPrefix: 'kuis-detail',
            nilai: tabEfektif,
            onPilih: setDetailTab,
            opsi: [
              { v: 'atur', teks: 'Atur kuis', ikon: <IkonAtur size={15} /> },
              ...(offline ? [{ v: 'offline' as const, teks: 'Input offline', ikon: <IkonInput size={15} /> }] : []),
              { v: 'hasil', teks: 'Hasil siswa', ikon: <IkonGrafik size={15} /> },
            ],
          }}
        />
        <div
          role="tabpanel"
          id="kuis-detail-panel"
          aria-labelledby={`kuis-detail-tab-${tabEfektif}`}
          className="min-w-0"
        >
          {tabEfektif === 'atur' ? (
            <KuisDetail kuis={kuis} onUpdated={async () => { await muat() }} />
          ) : tabEfektif === 'offline' ? (
            <OfflineKuisPanel kuis={kuis} onTersimpan={() => { void muat() }} />
          ) : (
            <HasilKuisPanel kuis={kuis} onUpdated={async () => { await muat() }} />
          )}
        </div>
      </div>
    )
  }

  if (langkah === 'wizard') {
    const ringkas = pratinjau ? hitungRingkasanKuis(pratinjau) : null
    const adaPratinjau = !!pratinjau && pratinjau.length > 0
    const selesai = [
      judul.trim().length > 0,
      paketIds.length > 0,
      mode === 'manual' ? pilihanManual.length > 0 : paketIds.length > 0 && tersedia.total > 0,
      adaPratinjau,
    ]
    const idxBelum = selesai.findIndex((x) => !x)
    const langkahAktif = idxBelum === -1 ? 3 : idxBelum
    const stepList = [
      { id: 'wz-identitas', judul: 'Identitas', sub: judul.trim() || 'Judul kuis' },
      { id: 'wz-paket', judul: 'Paket soal', sub: paketIds.length ? `${paketIds.length} paket dipilih` : 'Pilih paket Siap' },
      {
        id: 'wz-susun',
        judul: 'Susun soal',
        sub: mode === 'manual' ? `${pilihanManual.length} soal dipilih` : `${jumlahSoal} soal`,
      },
      { id: 'wz-tinjau', judul: 'Tinjau & simpan', sub: adaPratinjau ? `${pratinjau!.length} soal` : 'Belum disusun' },
    ]
    const opsiMode: { kode: ModeSusunKuis; judul: string; desk: string }[] = [
      {
        kode: 'otomatis',
        judul: 'Susun otomatis',
        desk: 'Sistem mengambil soal acak dari paket terpilih sesuai jumlah, bentuk, dan level yang Anda tentukan.',
      },
      {
        kode: 'manual',
        judul: 'Pilih manual',
        desk: 'Pilih soal satu per satu dengan pratinjau lengkap: stimulus, gambar, opsi, dan kunci jawaban.',
      },
      ...(bolehAi
        ? [
            {
              kode: 'otomatis_ai' as ModeSusunKuis,
              judul: 'Otomatis + bantuan AI',
              desk: 'Disusun otomatis, lalu soal yang sama atau mirip ditandai agar bisa dibuang sebelum disimpan.',
            },
          ]
        : []),
    ]
    const petunjuk = !judul.trim()
      ? 'Isi judul kuis terlebih dahulu.'
      : !paketIds.length
        ? 'Pilih minimal satu paket soal yang siap.'
        : mode === 'manual' && !pilihanManual.length
          ? 'Pilih minimal satu soal.'
          : mode !== 'manual' && tersedia.total === 0
            ? 'Tidak ada soal yang cocok dengan filter.'
            : !adaPratinjau
              ? 'Klik «Susun pratinjau» untuk melihat isi kuis.'
              : 'Kuis siap disimpan.'
    const targetSoal =
      mode === 'manual' ? pilihanManual.length : Math.min(jumlahSoal, tersedia.total)
    const kelompokPv = pratinjau ? kelompokkanPerTipe(pratinjau, tipePilihan) : []
    let noPv = 0

    return (
      <div className={`wz ${kelasAksenMapel(mapel)}`}>
        <div className="wz-kepala">
          <button
            type="button"
            className="wz-kembali"
            onClick={() => {
              resetWizard()
              setLangkah('daftar')
            }}
          >
            <span aria-hidden>←</span> Batal dan kembali
          </button>
          <h3 className="wz-judul-halaman">Susun kuis dari bank soal</h3>
        </div>

        <ol className="wz-stepper" aria-label="Langkah penyusunan kuis">
          {stepList.map((st, i) => (
            <li key={st.id}>
              <button
                type="button"
                className={
                  'wz-step' +
                  (i === langkahAktif ? ' wz-step--aktif' : '') +
                  (selesai[i] && i !== langkahAktif ? ' wz-step--selesai' : '')
                }
                aria-current={i === langkahAktif ? 'step' : undefined}
                onClick={() => keBagian(st.id)}
              >
                <span className="wz-step-no" aria-hidden>
                  {selesai[i] && i !== langkahAktif ? '✓' : i + 1}
                </span>
                <span className="wz-step-teks">
                  <b>{st.judul}</b>
                  <span>{st.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="wz-layout">
          <div className="wz-utama">
            {/* 1 — Identitas */}
            <section id="wz-identitas" className="wz-seksi">
              <div className="wz-seksi-kepala">
                <div>
                  <h4 className="wz-seksi-judul">
                    <span className="wz-seksi-no">1</span> Identitas kuis
                  </h4>
                  <p className="wz-seksi-bantu">Judul dan petunjuk singkat yang akan dilihat siswa.</p>
                </div>
              </div>
              <div className="wz-form-grid">
                <label className={`wz-field${isTka ? '' : ' wz-penuh'}`}>
                  <span>Judul kuis</span>
                  <input
                    required
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder={
                      isTka ? 'Contoh: Try Out IPA — Tahap II' : 'Contoh: Kuis IPAS — Organ Pernapasan'
                    }
                  />
                </label>
                {isTka && (
                  <label className="wz-field">
                    <span>Tahap Try Out</span>
                    <select
                      value={tahapTryOutTka}
                      onChange={(e) => setTahapTryOutTka((e.target.value || '') as TahapTryOutTka | '')}
                    >
                      <option value="">— Belum ditentukan —</option>
                      {DAFTAR_TAHAP_TRYOUT_TKA.map((t) => (
                        <option key={t} value={t}>
                          {NAMA_TAHAP_TRYOUT_TKA[t]}
                        </option>
                      ))}
                    </select>
                    <small>Menentukan kolom di Rekap Nilai TKA. Bisa diubah lagi di Atur kuis.</small>
                  </label>
                )}
                <label className="wz-field wz-penuh">
                  <span>Deskripsi (opsional)</span>
                  <textarea
                    rows={2}
                    value={deskripsi}
                    onChange={(e) => setDeskripsi(e.target.value)}
                    placeholder="Petunjuk singkat untuk siswa"
                  />
                </label>
              </div>
            </section>

            {/* 2 — Paket */}
            <section id="wz-paket" className="wz-seksi">
              <div className="wz-seksi-kepala">
                <div>
                  <h4 className="wz-seksi-judul">
                    <span className="wz-seksi-no">2</span> Pilih paket soal
                  </h4>
                  <p className="wz-seksi-bantu">
                    Hanya paket berstatus <strong>Siap</strong> yang muncul di sini.
                    {paketIds.length > 0 && ` ${paketIds.length} paket dipilih.`}
                  </p>
                </div>
              </div>
              {paketSiap.length === 0 ? (
                <div className="wz-kosong-paket">
                  Belum ada paket berstatus <strong>Siap</strong>. Buka tab <strong>Bank Soal</strong>, lengkapi
                  paket, lalu ubah statusnya menjadi Siap.
                  {diagnosaPaket && <span className="block mt-1 text-xs opacity-80">{diagnosaPaket}</span>}
                </div>
              ) : (
                <>
                  {isTka && materiTersedia.length > 1 && (
                    <div className="pk-materi-bar" role="group" aria-label="Saring paket menurut materi">
                      <span className="pk-materi-label">Materi</span>
                      <button
                        type="button"
                        className={`pk-materi-chip${materiPaketAktif === '' ? ' pk-materi-chip--on' : ''}`}
                        aria-pressed={materiPaketAktif === ''}
                        onClick={() => setMateriPaketAktif('')}
                      >
                        Semua <i>{paketSiap.length}</i>
                      </button>
                      {materiTersedia.map(({ materi, n }) => (
                        <button
                          key={materi}
                          type="button"
                          className={`pk-materi-chip${materiPaketAktif === materi ? ' pk-materi-chip--on' : ''}`}
                          aria-pressed={materiPaketAktif === materi}
                          onClick={() => setMateriPaketAktif(materiPaketAktif === materi ? '' : materi)}
                        >
                          {materi} <i>{n}</i>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="wz-alat">
                    <div className="wz-cari">
                      <input
                        type="search"
                        value={qPaket}
                        onChange={(e) => setQPaket(e.target.value)}
                        placeholder="Cari judul paket atau materi…"
                        aria-label="Cari paket soal"
                      />
                    </div>
                    <button type="button" className="wz-tautan" onClick={pilihSemuaTampil} disabled={paketTampil.length === 0}>
                      Pilih semua yang tampil
                    </button>
                    <button type="button" className="wz-tautan" onClick={kosongkanPaket} disabled={paketIds.length === 0}>
                      Kosongkan
                    </button>
                  </div>
                  {paketTampil.length === 0 ? (
                    <div className="wz-kosong-paket">Tidak ada paket yang cocok dengan pencarian.</div>
                  ) : (
                    <div className="wz-paket-grid">
                      {paketTampil.map((p) => {
                        const on = paketIds.includes(p.id)
                        const jk = p.jumlahPerKompleksitas ?? {}
                        const totalK = URUTAN_KOMPLEKSITAS.reduce((n, k) => n + (jk[k] ?? 0), 0)
                        const m = materiPaket(p)
                        const label = m || (p.tpNama ? `TP ${p.tpNomor ? `${p.tpNomor} · ` : ''}${p.tpNama}` : '')
                        return (
                          <label key={p.id} className={`wz-paket${on ? ' wz-paket--on' : ''}`}>
                            <input
                              type="checkbox"
                              className="pk-sr"
                              checked={on}
                              onChange={() => togglePaket(p.id)}
                            />
                            <span className="wz-paket-cek" aria-hidden>✓</span>
                            {label && (
                              <span className="wz-paket-materi" title={label}>
                                {label}
                              </span>
                            )}
                            <span className="wz-paket-judul">{p.judul}</span>
                            <span className="wz-paket-meta">
                              <span><b>{p.jumlahSoal}</b> soal</span>
                              <span><b>{p.totalPoin}</b> poin</span>
                            </span>
                            {totalK > 0 && (
                              <span className="pk-sebaran-bar" aria-hidden>
                                {URUTAN_KOMPLEKSITAS.filter((k) => (jk[k] ?? 0) > 0).map((k) => (
                                  <i
                                    key={k}
                                    className={`pk-seg--${k.toLowerCase()}`}
                                    style={{ flex: `${jk[k]} 1 0` }}
                                  />
                                ))}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 3 — Susun */}
            <section id="wz-susun" className="wz-seksi">
              <div className="wz-seksi-kepala">
                <div>
                  <h4 className="wz-seksi-judul">
                    <span className="wz-seksi-no">3</span> Cara menyusun soal
                  </h4>
                  <p className="wz-seksi-bantu">Pilih cara, lalu atur jumlah dan filter bila perlu.</p>
                </div>
              </div>

              <div className="wz-mode" role="radiogroup" aria-label="Cara menyusun soal">
                {opsiMode.map((o) => (
                  <button
                    key={o.kode}
                    type="button"
                    role="radio"
                    aria-checked={mode === o.kode}
                    className={`wz-mode-kartu${mode === o.kode ? ' wz-mode-kartu--on' : ''}`}
                    onClick={() => {
                      setMode(o.kode)
                      setPratinjau(null)
                    }}
                  >
                    <b>{o.judul}</b>
                    <span>{o.desk}</span>
                  </button>
                ))}
              </div>

              {mode !== 'manual' && (
                <>
                  <div className="wz-chip-blok">
                    <span className="wz-chip-label">Jumlah soal</span>
                    <div className="wz-jumlah">
                      <div className="wz-angka">
                        <button
                          type="button"
                          aria-label="Kurangi jumlah soal"
                          disabled={jumlahSoal <= 1}
                          onClick={() => {
                            setJumlahSoal((n) => Math.max(1, n - 1))
                            setPratinjau(null)
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={jumlahSoal}
                          aria-label="Jumlah soal"
                          onChange={(e) => {
                            setJumlahSoal(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                            setPratinjau(null)
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Tambah jumlah soal"
                          disabled={jumlahSoal >= 100}
                          onClick={() => {
                            setJumlahSoal((n) => Math.min(100, n + 1))
                            setPratinjau(null)
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div className="wz-preset">
                        {PRESET_JUMLAH.map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={jumlahSoal === n}
                            onClick={() => {
                              setJumlahSoal(n)
                              setPratinjau(null)
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="wz-chip-blok">
                    <span className="wz-chip-label">
                      Bentuk soal
                      <small>
                        {isTka
                          ? 'kosong = semua bentuk TKA (PG, PG kompleks, Benar–Salah)'
                          : 'kosong = semua bentuk'}
                      </small>
                    </span>
                    <div className="wz-chip-grup">
                      {tipePilihan.map((t) => {
                        const on = tipeAktif.includes(t)
                        const n = tersedia.perTipe[t] ?? 0
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={on}
                            disabled={!on && n === 0}
                            className={`wz-chip${on ? ' wz-chip--on' : ''}`}
                            onClick={() => toggleTipe(t)}
                          >
                            {LABEL_TIPE_PENDEK[t]} <i>{n}</i>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="wz-chip-blok">
                    <span className="wz-chip-label">
                      Kompleksitas <small>kosong = semua level</small>
                    </span>
                    <div className="wz-chip-grup">
                      {URUTAN_KOMPLEKSITAS.map((k) => {
                        const on = kompleksitasAktif.includes(k)
                        const n = tersedia.perLevel[k] ?? 0
                        return (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={on}
                            disabled={!on && n === 0}
                            className={`wz-chip${on ? ' wz-chip--on' : ''}`}
                            onClick={() => toggleKompleksitas(k)}
                          >
                            {NAMA_KOMPLEKSITAS[k]} <i>{n}</i>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {paketIds.length === 0 ? (
                    <p className="wz-info">Pilih paket di langkah 2 untuk melihat jumlah soal yang tersedia.</p>
                  ) : tersedia.total === 0 ? (
                    <p className="wz-peringatan">
                      Tidak ada soal yang memenuhi filter ini. Longgarkan bentuk atau level, atau tambah paket.
                    </p>
                  ) : jumlahSoal > tersedia.total ? (
                    <p className="wz-peringatan">
                      Hanya <strong>{tersedia.total}</strong> soal yang memenuhi filter — kuis akan berisi{' '}
                      {tersedia.total} soal, bukan {jumlahSoal}.
                    </p>
                  ) : (
                    <p className="wz-info">
                      Tersedia <strong>{tersedia.total}</strong> soal dari {paketIds.length} paket. Bobot awal setiap
                      soal <strong>1 poin</strong> dan bisa diubah setelah kuis dibuat.
                    </p>
                  )}
                  {mode === 'otomatis_ai' && (
                    <p className="wz-info">
                      Setelah disusun, soal yang sama atau hampir sama (teks/esensi) akan ditandai agar bisa
                      dibuang sebelum disimpan.
                    </p>
                  )}
                </>
              )}

              {mode === 'manual' &&
                (paketIds.length === 0 ? (
                  <div className="wz-kosong-paket">Pilih paket di langkah 2 dulu, lalu soalnya bisa dipilih di sini.</div>
                ) : (
                  <>
                    <p className="wz-info">
                      <strong>{pilihanManual.length}</strong> soal dipilih. Klik baris untuk melihat soal lengkap di
                      panel kanan, lalu centang atau tekan «Pilih soal ini».
                    </p>
                    <PilihSoalManual
                      paketDipilih={paketSiap.filter((p) => paketIds.includes(p.id))}
                      pilihan={pilihanManual}
                      onToggle={togglePilihanManual}
                      tipePilihan={tipePilihan}
                    />
                  </>
                ))}
            </section>

            {/* 4 — Tinjau */}
            <section id="wz-tinjau" className="wz-seksi">
              <div className="wz-seksi-kepala">
                <div>
                  <h4 className="wz-seksi-judul">
                    <span className="wz-seksi-no">4</span> Tinjau &amp; simpan
                  </h4>
                  <p className="wz-seksi-bantu">
                    Soal otomatis dikelompokkan menurut bentuknya, lengkap dengan petunjuk pengerjaan.
                  </p>
                </div>
                {adaPratinjau && peringatanDuplikat.length > 0 && (
                  <button type="button" className="pk-btn" onClick={buangDuplikatKasar}>
                    Buang yang mirip ({peringatanDuplikat.length} pasangan)
                  </button>
                )}
              </div>

              {peringatanDuplikat.length > 0 && (
                <div className="wz-peringatan">
                  <strong>Kemungkinan soal mirip / sama:</strong>
                  <ul>
                    {peringatanDuplikat.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  {mode === 'otomatis_ai' && (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem' }}>
                      Deteksi teks kasar (Jaccard). Analisis esensi yang lebih dalam akan ditambahkan pada iterasi
                      berikutnya.
                    </p>
                  )}
                </div>
              )}

              {!pratinjau ? (
                <div className="wz-kosong-paket">
                  Belum ada pratinjau. Lengkapi langkah 1–3, lalu tekan <strong>Susun pratinjau</strong> di bawah.
                </div>
              ) : (
                <>
                  <div className="wz-pv-stat">
                    <div>
                      <b>{ringkas?.jumlahSoal ?? 0}</b>
                      <span>soal</span>
                    </div>
                    <div>
                      <b>{ringkas?.totalPoin ?? 0}</b>
                      <span>poin</span>
                    </div>
                    {kelompokPv.map((g) => (
                      <div key={g.tipe}>
                        <b>{g.items.length}</b>
                        <span>{LABEL_TIPE_PENDEK[g.tipe] ?? g.tipe}</span>
                      </div>
                    ))}
                  </div>
                  <div className="wz-pv-scroll">
                    {kelompokPv.map((g) => (
                      <div key={g.tipe} className="wz-pv-grup">
                        <div className="wz-pv-grup-kepala">
                          <b>
                            {NAMA_TIPE[g.tipe] ?? g.tipe} ({g.items.length})
                          </b>
                          <small>{INSTRUKSI_TIPE[g.tipe] ?? ''}</small>
                        </div>
                        <ol className="wz-pv-list">
                          {g.items.map((s, j) => {
                            noPv += 1
                            const lv = normalisasiKompleksitas(s.kompleksitas)
                            return (
                              <li key={`${s.sumberPaketId}-${s.id}-${j}`} className="wz-pv-item">
                                <span className="wz-pv-no">{noPv}</span>
                                <div className="wz-pv-teks">
                                  {teksPolos(s.teks).slice(0, 140) || '(tanpa teks)'}
                                  <div className="wz-pv-meta">
                                    <span className={`wz-lv--${lv.toLowerCase()}`}>{lv}</span>
                                    <span>{s.poin} poin</span>
                                    {s.sumberPaketJudul && <span>{s.sumberPaketJudul}</span>}
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Ringkasan (layar lebar) */}
          <aside className="wz-samping" aria-label="Ringkasan kuis">
            <div>
              <p className="wz-samping-label">Kuis yang disusun</p>
              <p className={`wz-sum-judul${judul.trim() ? '' : ' wz-sum-judul--kosong'}`}>
                {judul.trim() || 'Belum diberi judul'}
              </p>
              {isTka && tahapTryOutTka && (
                <span className="wz-sum-tag">{NAMA_TAHAP_TRYOUT_TKA[tahapTryOutTka]}</span>
              )}
            </div>
            <div className="wz-sum-grid">
              <div className="wz-sum-sel">
                <b>{paketIds.length}</b>
                <span>Paket</span>
              </div>
              <div className="wz-sum-sel">
                <b>{adaPratinjau ? pratinjau!.length : targetSoal}</b>
                <span>{adaPratinjau ? 'Soal disusun' : 'Target soal'}</span>
              </div>
            </div>
            <ul className="wz-cek">
              <li className={selesai[0] ? 'ok' : ''}>
                <span className="wz-cek-ikon" aria-hidden>✓</span> Judul terisi
              </li>
              <li className={selesai[1] ? 'ok' : ''}>
                <span className="wz-cek-ikon" aria-hidden>✓</span> Paket soal dipilih
              </li>
              <li className={selesai[2] ? 'ok' : ''}>
                <span className="wz-cek-ikon" aria-hidden>✓</span>{' '}
                {mode === 'manual' ? 'Soal dipilih' : 'Ada soal yang cocok'}
              </li>
              <li className={selesai[3] ? 'ok' : ''}>
                <span className="wz-cek-ikon" aria-hidden>✓</span> Pratinjau disusun
              </li>
            </ul>
          </aside>
        </div>

        {/* Bar aksi — selalu terlihat */}
        <div className="wz-bar" role="region" aria-label="Aksi penyusunan kuis">
          {error && (
            <p className="wz-galat" role="alert" style={{ flex: '1 0 100%' }}>
              {error}
            </p>
          )}
          <div className="wz-bar-info">
            {adaPratinjau
              ? `${ringkas?.jumlahSoal ?? 0} soal · ${ringkas?.totalPoin ?? 0} poin`
              : `${paketIds.length} paket · ${tersedia.total} soal tersedia`}
            <small>{petunjuk}</small>
          </div>
          <div className="wz-bar-aksi">
            <button
              type="button"
              className={`pk-btn${adaPratinjau ? '' : ' pk-btn--utama'}`}
              onClick={buatPratinjau}
              disabled={busy}
            >
              {adaPratinjau ? (mode === 'manual' ? 'Perbarui pratinjau' : 'Susun ulang') : 'Susun pratinjau'}
            </button>
            {adaPratinjau && (
              <button
                type="button"
                className="pk-btn pk-btn--utama"
                disabled={busy || !judul.trim()}
                onClick={() => void onSimpanKuis()}
              >
                {busy ? 'Menyimpan…' : 'Simpan kuis'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${kelasAksenMapel(mapel)}`}>
      {isTka && (
        <div
          className={
            'tka-panel-intro' +
            (mapel === 'TKA IPA'
              ? ' tka-panel-intro--ipa'
              : mapel === 'TKA Matematika'
                ? ' tka-panel-intro--mtk'
                : ' tka-panel-intro--bi')
          }
        >
          <div className="tka-panel-intro-text">
            <p className="tka-panel-intro-eyebrow">Kuis & try out · {LABEL_MAPEL_TKA[mapel as keyof typeof LABEL_MAPEL_TKA] ?? mapel}</p>
            <p className="tka-panel-intro-lead">
              {mapel === 'TKA IPA'
                ? 'Susun latihan atau try out dari paket bank yang Siap. Tautkan tahap Try Out (I–V) bila nilai masuk rekap TKA.'
                : 'Susun latihan atau try out dari paket bank yang Siap. Tautkan tahap Try Out (I–V) bila nilai masuk rekap TKA.'}
            </p>
          </div>
        </div>
      )}
      <div className="lms-toolbar">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="lms-count-pill">{list === null ? '…' : `${list.length} kuis`}</span>
        </div>
        <button
          type="button"
          className="lms-btn-primary"
          onClick={mulaiWizard}
        >
          + Kuis baru
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {list === null && <div className="lms-empty">Memuat kuis…</div>}

      {list && list.length === 0 && (
        <div className="pk-kosong">
          <b>Belum ada kuis</b>
          <p>
            {isTka
              ? 'Buat kuis atau try out dari paket bank soal yang sudah berstatus Siap. Untuk rekap portal, isi tahap Try Out saat menyusun.'
              : 'Buat kuis dari paket bank soal yang sudah berstatus Siap.'}
          </p>
          <div className="pk-kosong-aksi">
            <button type="button" className="pk-btn pk-btn--utama" onClick={mulaiWizard}>
              + Kuis baru
            </button>
          </div>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="pk-grid">
          {list.map((k) => {
            const jumlah = k.jumlahSoal ?? k.soal?.length ?? 0
            const tahapKosong = isTka && !k.tahapTryOutTka
            const labelAtas = isTka
              ? k.tahapTryOutTka
                ? NAMA_TAHAP_TRYOUT_TKA[k.tahapTryOutTka]
                : 'Tahap belum diisi'
              : k.jenisPenilaian
                ? NAMA_JENIS_PENILAIAN[k.jenisPenilaian]
                : 'Kuis'
            const labelMode =
              k.modeSusun === 'manual'
                ? 'Disusun manual'
                : k.modeSusun === 'otomatis_ai'
                  ? 'Disusun otomatis + AI'
                  : k.modeSusun === 'otomatis'
                    ? 'Disusun otomatis'
                    : ''
            const bukaKuis = () => {
              setSelectedId(k.id)
              setLangkah('detail')
            }
            return (
              <li key={k.id} className={`pk-kartu pk-kartu--${k.aktif ? 'siap' : 'draf'}`}>
                <div className="pk-utama">
                  <div className="pk-atas">
                    <span className={`pk-materi${tahapKosong ? ' pk-materi--kosong' : ''}`} title={labelAtas}>
                      {labelAtas}
                    </span>
                    <span className={`pk-status pk-status--${k.aktif ? 'siap' : 'draf'}`}>
                      {k.aktif ? 'Aktif' : 'Draf'}
                    </span>
                    {labelKelasDibagikan(k.kelas, k.kelasList) &&
                      String(k.kelas || '').toUpperCase() === String(kelas).toUpperCase() && (
                      <span className="pk-materi" title="Dibagikan ke kelas paralel">
                        → {labelKelasDibagikan(k.kelas, k.kelasList)}
                      </span>
                    )}
                    {String(k.kelas || '').toUpperCase() !== String(kelas).toUpperCase() && (
                      <span className="pk-materi" title="Dari kelas lain">Dari {k.kelas}</span>
                    )}
                  </div>
                  <button type="button" className="pk-judul" title={k.judul} onClick={bukaKuis}>
                    {k.judul}
                  </button>
                  <div className="pk-angka">
                    <div>
                      <b>{jumlah}</b>
                      <span>soal</span>
                    </div>
                    {typeof k.totalPoin === 'number' && (
                      <div>
                        <b>{k.totalPoin}</b>
                        <span>poin</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pk-kaki">
                  <span className="pk-waktu">{labelMode}</span>
                  <div className="pk-aksi">
                    {String(k.kelas || '').toUpperCase() === String(kelas).toUpperCase() && (
                      <button
                        type="button"
                        className="pk-btn"
                        disabled={busy}
                        onClick={() => setBerbagiTarget(k)}
                      >
                        Bagikan
                      </button>
                    )}
                    <button
                      type="button"
                      className="pk-btn pk-btn--bahaya"
                      disabled={busy}
                      onClick={() => onHapus(k)}
                      aria-label={`Hapus kuis ${k.judul}`}
                    >
                      Hapus
                    </button>
                    <button type="button" className="pk-btn" disabled={busy} onClick={() => void onToggleAktif(k)}>
                      {k.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button type="button" className="pk-btn pk-btn--utama" onClick={bukaKuis}>
                      Buka
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {dialogHapus()}
      <BerbagiKelasDialog
        open={!!berbagiTarget}
        judulItem={berbagiTarget?.judul || ''}
        jenis="kuis"
        kelasUtama={berbagiTarget?.kelas || kelas}
        mapel={mapel}
        kelasListSaatIni={berbagiTarget?.kelasList}
        profil={profil}
        busy={busy}
        onBatal={() => setBerbagiTarget(null)}
        onSimpan={async (list) => {
          if (!berbagiTarget) return
          setBusy(true)
          setError('')
          try {
            await aturBerbagiKuis(berbagiTarget.id, berbagiTarget.kelas, list)
            setBerbagiTarget(null)
            await muat()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengatur berbagi.')
          } finally {
            setBusy(false)
          }
        }}
      />

    </div>
  )
}

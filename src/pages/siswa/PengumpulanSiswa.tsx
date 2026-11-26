import { useEffect, useRef, useState } from 'react'
import {
  BATAS_CATATAN,
  BATAS_FOTO_PENGUMPULAN,
  buktiWajibKurang,
  DAFTAR_SLOT,
  dataUrlGambarAman,
  kirimPengumpulan,
  muatFoto,
  muatFotoBerslot,
  pesanGagalKumpul,
  siapkanFoto,
  type PengumpulanDok,
} from '../../lib/pengumpulan'
import { adaBukti, kelompokBuktiPerTahap, namaKategoriBukti } from '../../lib/buktiTugas'
import { LABEL_TAHAP } from '../../types/tugas'
import {
  dukungKonversiVideo,
  kompresVideo,
  periksaVideo,
  urlVideoTugas,
  videoLangsung,
} from '../../lib/videoTugas'
import VideoBukti, { type VideoUI } from './VideoBukti'
import type { TugasLms } from '../../types/tugas'
import SiswaIcon from './SiswaIcon'
import { hapusDraf, muatDraf, simpanDraf } from '../../lib/drafPengumpulan'

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
  /** Tugas mode kelompok (ANTIREGRESI §Tugas.Kelompok). */
  modeKelompok?: boolean
  /** true jika siswa adalah ketua kelompok (atau bukan mode kelompok). */
  isKetuaKelompok?: boolean
  /** true jika siswa sudah punya kelompok (atau bukan mode kelompok). */
  punyaKelompok?: boolean
  /** true jika ketua sudah menerima pengajuan anggota ini untuk mengunggah sendiri. */
  izinMandiri?: boolean
  /** Ketua sudah mengirim pengumpulan kelompok (null = tidak diketahui → jangan klaim terkumpul). */
  terkumpulLewatKetua?: boolean | null
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
 * Kumpulkan tugas dengan foto (maks. 10). Foto dikecilkan otomatis di perangkat.
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
  modeKelompok = false,
  isKetuaKelompok = true,
  punyaKelompok = true,
  izinMandiri = false,
  terkumpulLewatKetua = null,
}: Props) {
  const [items, setItems] = useState<Item[]>([])
  const modeBukti = adaBukti(tugas)
  const [fotoSlot, setFotoSlot] = useState<Record<number, string>>({})
  /** slot (1..10) → buktiId pemilik (multi-foto per bukti). */
  const [slotMilik, setSlotMilik] = useState<Record<number, string>>({})
  /** Sisa foto multi-pilih galeri — dipasang manual ke kartu bukti kosong (bukan otomatis nyebrang). */
  const [antrianFoto, setAntrianFoto] = useState<string[]>([])
  const [olahSlot, setOlahSlot] = useState<number | null>(null)
  // Video bukti (ANTIREGRESI §Tugas.Video): keadaan per slot, video lama yang dihapus, URL putar lama.
  const [videoUI, setVideoUI] = useState<Record<number, VideoUI>>({})
  const [videoLamaDihapus, setVideoLamaDihapus] = useState<Record<number, boolean>>({})
  const [urlLama, setUrlLama] = useState<Record<number, string>>({})
  const [persenUnggah, setPersenUnggah] = useState<number | null>(null)
  /** Kemajuan pengiriman foto: [selesai, total]. */
  const [kemajuanFoto, setKemajuanFoto] = useState<[number, number] | null>(null)
  /** Kemajuan pemrosesan (kompres) foto yang baru dipilih: [selesai, total]. */
  const [prosesFoto, setProsesFoto] = useState<[number, number] | null>(null)
  const videoUIRef = useRef(videoUI)
  videoUIRef.current = videoUI
  const [catatan, setCatatan] = useState(ada?.catatan ?? '')
  const [memuat, setMemuat] = useState(false)
  const [olah, setOlah] = useState(false)
  const [busy, setBusy] = useState(false)
  const [galat, setGalat] = useState('')
  const [sukses, setSukses] = useState(false)
  const [ubah, setUbah] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Turunan video: slot yang akan punya video saat dikirim (baru siap + lama yang tidak dihapus/diganti).
  const videoBaru: Record<number, NonNullable<VideoUI['siap']>> = {}
  for (const [k, v] of Object.entries(videoUI)) if (v.fase === 'siap' && v.siap) videoBaru[Number(k)] = v.siap
  const videoPertahankan = Object.keys(ada?.videos ?? {})
    .map(Number)
    .filter((n) => !videoLamaDihapus[n] && !videoBaru[n])
  const videoAda: Record<number, boolean> = {}
  for (const n of videoPertahankan) videoAda[n] = true
  for (const n of Object.keys(videoBaru)) videoAda[Number(n)] = true
  const videoSibuk = Object.values(videoUI).some((v) => v.fase === 'periksa' || v.fase === 'konversi')
  const kunciAda = ada?.fotoIds.join('|') ?? ''
  const kunciVideo = Object.values(ada?.videos ?? {})
    .map((v) => v.path)
    .join('|')

  // Draf lokal (ANTIREGRESI §Tugas.Draf): foto & catatan pengumpulan PERTAMA bertahan bila Android
  // mematikan tab saat kamera terbuka. Penyimpanan baru boleh jalan SETELAH pemulihan selesai
  // (`drafSiap`), kalau tidak state kosong awal menimpa draf yang belum sempat dibaca.
  const kunciDraf = `${tugas.id}_${siswaId}`
  const belumAda = ada === null
  const [drafSiap, setDrafSiap] = useState(false)
  const [drafDipulihkan, setDrafDipulihkan] = useState(0)

  useEffect(() => {
    setDrafSiap(false)
    if (!belumAda) {
      setDrafSiap(true)
      return
    }
    let batal = false
    void muatDraf(kunciDraf)
      .then((d) => {
        if (batal || !d) return
        // Hanya memulihkan ke bagian yang masih kosong (siswa mungkin sudah mulai memilih foto).
        setItems((p) => (p.length > 0 ? p : d.items.map((src, i) => ({ key: `draf-${i}`, src }))))
        setFotoSlot((p) => (Object.keys(p).length > 0 ? p : d.fotoSlot))
        setAntrianFoto((p) => (p.length > 0 ? p : d.antrian))
        setCatatan((p) => (p.trim() ? p : d.catatan))
        const jumlah = d.items.length + Object.keys(d.fotoSlot).length + d.antrian.length
        if (jumlah > 0) setDrafDipulihkan(jumlah)
      })
      .catch((e) => console.warn('Muat draf gagal', e))
      .finally(() => {
        if (!batal) setDrafSiap(true)
      })
    return () => {
      batal = true
    }
  }, [kunciDraf, belumAda])

  useEffect(() => {
    if (!drafSiap || !belumAda) return
    const adaIsi =
      items.length > 0 || Object.keys(fotoSlot).length > 0 || antrianFoto.length > 0 || catatan.trim() !== ''
    const t = window.setTimeout(() => {
      if (adaIsi) {
        void simpanDraf(kunciDraf, {
          items: items.map((x) => x.src),
          fotoSlot,
          antrian: antrianFoto,
          catatan,
        })
      } else {
        void hapusDraf(kunciDraf)
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [drafSiap, belumAda, items, fotoSlot, antrianFoto, catatan, kunciDraf])

  // Bersihkan object URL pratinjau saat komponen ditutup.
  useEffect(
    () => () => {
      for (const v of Object.values(videoUIRef.current)) if (v.url) URL.revokeObjectURL(v.url)
    },
    [],
  )

  // Muat URL putar video yang sudah terkirim; pengiriman baru membersihkan keadaan lokal.
  useEffect(() => {
    setVideoUI({})
    setVideoLamaDihapus({})
    setUrlLama({})
    let batal = false
    for (const [k, v] of Object.entries(ada?.videos ?? {})) {
      void urlVideoTugas(v.path)
        .then((u) => {
          if (!batal) setUrlLama((p) => ({ ...p, [Number(k)]: u }))
        })
        .catch((e) => console.warn('URL video gagal', e))
    }
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciVideo])

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
          if (batal) return
          setFotoSlot(m)
          // Pulihkan ownership dari buktiSlots (multi-foto) atau fallback slot primer.
          const milik: Record<number, string> = {}
          if (ada.buktiSlots) {
            for (const [buktiId, slots] of Object.entries(ada.buktiSlots)) {
              for (const s of slots) if (m[s]) milik[s] = buktiId
            }
          } else {
            for (const b of tugas.buktiList ?? []) {
              if (b.jenis !== 'video' && m[b.slot]) milik[b.slot] = b.id
            }
          }
          setSlotMilik(milik)
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
      const terpilih = Array.from(files).slice(0, sisa)
      // Satu foto yang tak terbaca TIDAK boleh menggagalkan foto lain yang sudah beres diproses
      // (ANTIREGRESI §Gambar.Dekode): kumpulkan yang berhasil, laporkan yang gagal.
      const gagal: string[] = []
      let pesanGagal = ''
      for (const f of terpilih) {
        setProsesFoto([baru.length + gagal.length + 1, terpilih.length])
        try {
          const src = await siapkanFoto(f)
          baru.push({ key: `baru-${Date.now()}-${baru.length}`, src })
        } catch (e) {
          console.warn('Foto tidak bisa diproses', f.name, f.type, f.size, e)
          gagal.push(f.name || `foto ke-${baru.length + gagal.length + 1}`)
          if (!pesanGagal) pesanGagal = e instanceof Error ? e.message : 'Foto tidak bisa diproses.'
        }
      }
      if (baru.length > 0) setItems((prev) => [...prev, ...baru])
      if (gagal.length > 0) {
        setGalat(
          gagal.length === terpilih.length && terpilih.length === 1
            ? pesanGagal
            : `${gagal.length} dari ${terpilih.length} foto tidak bisa diproses (${gagal.join(', ')}). ${pesanGagal}`,
        )
      } else if (files.length > sisa) {
        setGalat(`Hanya ${sisa} foto yang ditambahkan (maksimal ${BATAS_FOTO_PENGUMPULAN}).`)
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Foto tidak bisa diproses.')
    } finally {
      setOlah(false)
      setProsesFoto(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /**
   * Multi-foto per bukti (ANTIREGRESI §Tugas.MultiFotoBukti).
   * «Tambah foto» SELALU menambah (tidak mengganti foto yang sudah ada).
   * - Slot kosong global yang belum diklaim bukti lain dipakai untuk foto baru.
   * - Slot primer hanya diisi bila masih kosong.
   * - Hapus foto individual lewat tombol × di thumbnail.
   * - Ownership dicatat di slotMilik agar guru/AI tahu foto mana milik bukti mana.
   */
  async function pilihBukti(slot: number, files: FileList | null, input: HTMLInputElement | null) {
    if (!files || files.length === 0) return
    setGalat('')
    setSukses(false)
    setOlahSlot(slot)
    try {
      const daftar = Array.from(files)
      const jadi: string[] = []
      let pesanGagal = ''
      for (const f of daftar) {
        try {
          jadi.push(await siapkanFoto(f))
        } catch (e) {
          console.warn('Foto tidak bisa diproses', f.name, f.type, f.size, e)
          if (!pesanGagal) pesanGagal = e instanceof Error ? e.message : 'Foto tidak bisa diproses.'
        }
      }
      if (jadi.length === 0) {
        setGalat(pesanGagal || 'Foto tidak bisa diproses.')
        return
      }

      const bukti = (tugas.buktiList ?? []).find((b) => b.slot === slot)
      const buktiId = bukti?.id ?? `slot-${slot}`

      // Slot yang sudah terisi foto (apa pun pemiliknya) — jangan ditimpa saat menambah.
      const slotTerisi = new Set(
        Object.keys(fotoSlot)
          .map(Number)
          .filter((n) => dataUrlGambarAman(fotoSlot[n])),
      )
      // Slot diklaim bukti LAIN — tidak boleh dipakai.
      const diklaimLain = new Set(
        Object.entries(slotMilik)
          .filter(([, id]) => id && id !== buktiId)
          .map(([s]) => Number(s)),
      )
      // Slot kosong yang boleh dipakai bukti ini.
      const slotKosong = DAFTAR_SLOT.filter((n) => !slotTerisi.has(n) && !diklaimLain.has(n))

      // Prioritas: slot primer dulu HANYA bila masih kosong; sisanya slot kosong lain.
      // Ini memastikan «Tambah foto» menambah, bukan mengganti.
      const target: number[] = []
      if (!slotTerisi.has(slot) && !diklaimLain.has(slot)) {
        target.push(slot)
      }
      for (const n of slotKosong) {
        if (n !== slot) target.push(n)
      }

      if (target.length === 0) {
        setGalat(`Tidak ada slot kosong (maksimal ${BATAS_FOTO_PENGUMPULAN} foto). Hapus salah satu dulu.`)
        return
      }

      const maxBaru = Math.min(jadi.length, target.length)
      const dipakai = jadi.slice(0, maxBaru)
      const sisaAntrian = jadi.slice(maxBaru)

      setFotoSlot((prev) => {
        const next = { ...prev }
        dipakai.forEach((src, i) => {
          next[target[i]] = src
        })
        return next
      })
      setSlotMilik((prev) => {
        const next = { ...prev }
        dipakai.forEach((_, i) => {
          next[target[i]] = buktiId
        })
        return next
      })
      if (sisaAntrian.length > 0) {
        setAntrianFoto((prev) => [...prev, ...sisaAntrian])
        setGalat(
          `Hanya ${dipakai.length} foto yang dipasang (batas slot/total ${BATAS_FOTO_PENGUMPULAN}). Sisanya di antrian.`,
        )
      } else if (pesanGagal) {
        setGalat(`Sebagian foto tidak bisa diproses. ${pesanGagal}`)
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Foto tidak bisa diproses.')
    } finally {
      setOlahSlot(null)
      if (input) input.value = ''
    }
  }

  /** Pasang foto berikutnya dari antrian multi-pilih ke slot bukti yang masih kosong. */
  function pasangDariAntrian(slot: number) {
    setAntrianFoto((prev) => {
      if (prev.length === 0) return prev
      const [kepala, ...rest] = prev
      setFotoSlot((fs) => ({ ...fs, [slot]: kepala }))
      setSukses(false)
      setGalat('')
      return rest
    })
  }

  function buangAntrian() {
    setAntrianFoto([])
  }

  function hapusBukti(slot: number) {
    setFotoSlot((prev) => {
      const baru = { ...prev }
      delete baru[slot]
      return baru
    })
    setSukses(false)
  }

  function setVideoSlot(slot: number, st: VideoUI | null) {
    setVideoUI((p) => {
      const baru = { ...p }
      if (p[slot]?.url && p[slot].url !== st?.url) URL.revokeObjectURL(p[slot].url!)
      if (st) baru[slot] = st
      else delete baru[slot]
      return baru
    })
  }

  async function pilihVideo(slot: number, files: FileList | null, input: HTMLInputElement | null) {
    const f = files?.[0]
    if (!f) return
    setGalat('')
    setSukses(false)
    setVideoSlot(slot, { fase: 'periksa', persen: 0 })
    try {
      const info = await periksaVideo(f)
      // mp4 HEVC dipakai apa adanya hanya bila HP tak bisa mengonversi; selain itu dikonversi ke webm
      // agar bisa diputar di PC guru (ANTIREGRESI §Kirim.Diagnostik).
      const langsung = info.hevc && dukungKonversiVideo() ? null : videoLangsung(f, info.durasi)
      if (langsung) {
        setVideoSlot(slot, { fase: 'siap', persen: 1, siap: langsung, url: URL.createObjectURL(langsung.blob) })
      } else if (!dukungKonversiVideo()) {
        throw new Error('Perangkat ini belum bisa memperkecil video. Kumpulkan dengan foto ya.')
      } else {
        setVideoSlot(slot, { fase: 'perlu', persen: 0, file: f, durasi: info.durasi })
      }
    } catch (e) {
      setVideoSlot(slot, null)
      setGalat(e instanceof Error ? e.message : 'Video tidak bisa diproses.')
    } finally {
      if (input) input.value = ''
    }
  }

  async function konversiVideo(slot: number) {
    const st = videoUI[slot]
    if (!st?.file) return
    setGalat('')
    setVideoSlot(slot, { ...st, fase: 'konversi', persen: 0 })
    try {
      const v = await kompresVideo(st.file, (b) =>
        setVideoUI((p) => (p[slot] ? { ...p, [slot]: { ...p[slot], persen: b } } : p)),
      )
      setVideoSlot(slot, { fase: 'siap', persen: 1, siap: v, url: URL.createObjectURL(v.blob) })
    } catch (e) {
      setVideoSlot(slot, { ...st, fase: 'perlu' })
      setGalat(e instanceof Error ? e.message : 'Video gagal diperkecil.')
    }
  }

  function hapusVideo(slot: number) {
    setVideoSlot(slot, null)
    if (ada?.videos[slot]) setVideoLamaDihapus((p) => ({ ...p, [slot]: true }))
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
      const kurang = buktiWajibKurang(tugas, fotoSlot, videoAda)
      if (kurang.length > 0) {
        setGalat(`Bukti yang wajib belum lengkap: ${kurang.join(', ')}.`)
        return
      }
    } else if (items.length === 0) {
      setGalat('Tambahkan minimal satu foto dulu ya.')
      return
    }
    setBusy(true)
    setPersenUnggah(null)
    setKemajuanFoto(null)
    try {
      // Bangun mapping buktiId → slots dari slotMilik (hanya slot yang punya foto).
      const buktiSlotsKirim: Record<string, number[]> = {}
      if (modeBukti) {
        for (const [slotStr, buktiId] of Object.entries(slotMilik)) {
          const slot = Number(slotStr)
          if (!dataUrlGambarAman(fotoSlot[slot])) continue
          if (!buktiSlotsKirim[buktiId]) buktiSlotsKirim[buktiId] = []
          if (!buktiSlotsKirim[buktiId].includes(slot)) buktiSlotsKirim[buktiId].push(slot)
        }
        // Pastikan slot primer juga tercatat meski slotMilik belum terisi (data lama / satu foto).
        for (const b of tugas.buktiList ?? []) {
          if (b.jenis === 'video') continue
          if (dataUrlGambarAman(fotoSlot[b.slot])) {
            if (!buktiSlotsKirim[b.id]) buktiSlotsKirim[b.id] = []
            if (!buktiSlotsKirim[b.id].includes(b.slot)) buktiSlotsKirim[b.id].unshift(b.slot)
          }
        }
        for (const id of Object.keys(buktiSlotsKirim)) {
          buktiSlotsKirim[id].sort((a, b) => a - b)
        }
      }
      const dok = await kirimPengumpulan({
        tugas,
        siswaId,
        siswaNama,
        kelas,
        ...(modeBukti
          ? { fotoSlot, buktiSlots: Object.keys(buktiSlotsKirim).length ? buktiSlotsKirim : undefined }
          : { foto: items.map((x) => x.src) }),
        videoBaru,
        videoPertahankan,
        onProgressVideo: setPersenUnggah,
        onProgressFoto: (s, t) => setKemajuanFoto([s, t]),
        catatan,
        ada,
      })
      void hapusDraf(kunciDraf)
      setDrafDipulihkan(0)
      onTersimpan(dok)
      setSukses(true)
      setUbah(false)
    } catch (e) {
      console.warn('Kirim pengumpulan gagal', e)
      setGalat(pesanGagalKumpul(e))
    } finally {
      setBusy(false)
      setPersenUnggah(null)
      setKemajuanFoto(null)
    }
  }

  const buktiList = tugas.buktiList ?? []
  const kategori = tugas.pengaturanPenilaian?.kategori
  const slotBukti = new Set(buktiList.map((b) => b.slot))
  const slotLain = [...DAFTAR_SLOT].filter((n) => fotoSlot[n] && !slotBukti.has(n))
  // Bangun buktiSlots lokal untuk cek wajib (konsisten dengan yang akan dikirim).
  const buktiSlotsLokal: Record<string, number[]> = {}
  if (modeBukti) {
    for (const [slotStr, buktiId] of Object.entries(slotMilik)) {
      const slot = Number(slotStr)
      if (!dataUrlGambarAman(fotoSlot[slot])) continue
      if (!buktiSlotsLokal[buktiId]) buktiSlotsLokal[buktiId] = []
      if (!buktiSlotsLokal[buktiId].includes(slot)) buktiSlotsLokal[buktiId].push(slot)
    }
    for (const b of tugas.buktiList ?? []) {
      if (b.jenis === 'video') continue
      if (dataUrlGambarAman(fotoSlot[b.slot])) {
        if (!buktiSlotsLokal[b.id]) buktiSlotsLokal[b.id] = []
        if (!buktiSlotsLokal[b.id].includes(b.slot)) buktiSlotsLokal[b.id].unshift(b.slot)
      }
    }
  }
  const kurang = modeBukti ? buktiWajibKurang(tugas, fotoSlot, videoAda, buktiSlotsLokal) : []
  const jumlahFotoSekarang = modeBukti
    ? Object.keys(fotoSlot).filter((k) => dataUrlGambarAman(fotoSlot[Number(k)])).length
    : items.length
  const masihBisaTambah = jumlahFotoSekarang < BATAS_FOTO_PENGUMPULAN
  const jumlahWajib = buktiList.filter((b) => b.wajib).length
  const jumlahFotoBukti = buktiList.filter((b) => (b.jenis === 'video' ? videoAda[b.slot] : fotoSlot[b.slot])).length
  /** Daftar foto siap kirim (mode bukti) — untuk pratinjau lengkap. */
  const pratinjauBuktiFoto = buktiList
    .filter((b) => b.jenis !== 'video' && fotoSlot[b.slot])
    .map((b) => ({ slot: b.slot, label: b.label, src: fotoSlot[b.slot]! }))
  const jumlahVideoSiap = buktiList.filter((b) => b.jenis === 'video' && videoAda[b.slot]).length

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
                  .filter((b) => b.jenis !== 'video')
                  .map((b) => {
                    const milik = Object.entries(slotMilik)
                      .filter(([, id]) => id === b.id)
                      .map(([s]) => Number(s))
                    const slots = [...new Set([b.slot, ...milik])]
                      .filter((s) => dataUrlGambarAman(fotoSlot[s]))
                      .sort((a, c) => a - c)
                    if (slots.length === 0) return null
                    return (
                      <figure key={b.id} className="sw-bukti-baca">
                        <div className="sw-bukti-foto-multi">
                          {slots.map((s) => (
                            <img key={s} src={fotoSlot[s]} alt={b.label} className="sw-kumpul-thumb" />
                          ))}
                        </div>
                        <figcaption>{b.label}{slots.length > 1 ? ` (${slots.length} foto)` : ''}</figcaption>
                      </figure>
                    )
                  })}
                {buktiList
                  .filter((b) => b.jenis === 'video' && ada.videos[b.slot])
                  .map((b) => (
                    <figure key={b.id} className="sw-bukti-baca">
                      {urlLama[b.slot] ? (
                        <video className="sw-video" src={urlLama[b.slot]} controls playsInline preload="metadata" />
                      ) : (
                        <div className="sw-bukti-kosong">Memuat video…</div>
                      )}
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

  // Mode kelompok: non-ketua tanpa izin ketua / belum punya kelompok tidak boleh upload.
  // Anggota yang pengajuannya diterima ketua (izinMandiri) memakai form biasa di bawah.
  if (modeKelompok && !isKetuaKelompok && !izinMandiri) {
    return (
      <section className="sw-kat-panel sw-kumpul">
        <h2>Kumpulkan tugas</h2>
        {ada ? (
          <p className="sw-kumpul-status sw-kumpul-status--ok">
            <SiswaIcon name="check" size={18} /> Sudah dikumpulkan
            {ada.diubahMs ? ` · ${waktuTeks(ada.diubahMs)}` : ''}
          </p>
        ) : terkumpulLewatKetua === true ? (
          <p className="sw-kumpul-status sw-kumpul-status--ok">
            <SiswaIcon name="check" size={18} /> Sudah terkumpul lewat kelompok (dikirim ketua)
          </p>
        ) : (
          <p className="sw-kat-hint">
            {punyaKelompok
              ? 'Hanya ketua kelompok yang dapat mengunggah. Setelah ketua mengirim, status Anda otomatis menjadi terkumpul. Ingin mengirim sendiri? Ajukan ke ketua di panel Kelompok di atas.'
              : 'Buat atau bergabung ke kelompok dulu (panel di atas), lalu ketua yang mengunggah pengumpulan.'}
          </p>
        )}
      </section>
    )
  }

  if (modeKelompok && !punyaKelompok) {
    return (
      <section className="sw-kat-panel sw-kumpul">
        <h2>Kumpulkan tugas</h2>
        <p className="sw-kat-hint">
          Buat kelompok dulu (Anda akan menjadi ketua), lalu unggah pengumpulan di sini.
        </p>
      </section>
    )
  }

  const tampilForm = !ada || ubah

  return (
    <section className="sw-kat-panel sw-kumpul">
      <h2>
        Kumpulkan tugas
        {modeKelompok ? (isKetuaKelompok ? ' (sebagai ketua)' : ' (izin dari ketua)') : ''}
      </h2>

      {ada && (
        <p className="sw-kumpul-status sw-kumpul-status--ok">
          <SiswaIcon name="check" size={18} /> Sudah dikumpulkan {waktuTeks(ada.diubahMs)}
        </p>
      )}

      {memuat && <p className="sw-kat-hint">Memuat fotomu…</p>}

      {modeBukti ? (
        <>
          <p className="sw-kat-hint">
            Gurumu meminta {buktiList.length} bukti
            {jumlahWajib < buktiList.length ? ` ({jumlahWajib} wajib)` : ''}.
            Isi tiap kartu sesuai namanya. Setiap bukti boleh lebih dari satu foto (total maks. 10).
            Beberapa HP hanya bisa pilih satu foto sekali jalan — ketuk lagi «Tambah foto» untuk menambah.
            Di galeri Google Photos biasanya bisa centang beberapa sekaligus.
          </p>
          {kelompokBuktiPerTahap(buktiList).map((g) => (
            <div key={g.tahap ?? 'lain'} className="sw-bukti-kelompok">
              {g.tahap && <h3 className="sw-bukti-tahap">{LABEL_TAHAP[g.tahap]}</h3>}
              <ol className="sw-bukti-daftar">
            {g.items.map(({ b, i }) => {
              const video = b.jenis === 'video'
              const src = video ? undefined : fotoSlot[b.slot]
              const dinilai = namaKategoriBukti(b, kategori)
              const idInput = `bukti-${tugas.id}-${b.slot}`
              const sibuk = olahSlot === b.slot
              const off = busy || olahSlot !== null || videoSibuk
              const offTambah = off || !masihBisaTambah
              return (
                <li
                  key={b.id}
                  className={`sw-bukti${(video ? videoAda[b.slot] : Object.entries(slotMilik).some(([s, id]) => id === b.id && dataUrlGambarAman(fotoSlot[Number(s)])) || dataUrlGambarAman(fotoSlot[b.slot])) ? ' sw-bukti--ok' : b.wajib ? ' sw-bukti--kurang' : ''}`}
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
                  {video ? (
                    <VideoBukti
                      slot={b.slot}
                      idInput={idInput}
                      tampilForm={tampilForm}
                      sibuk={busy}
                      ui={videoUI[b.slot]}
                      lama={videoLamaDihapus[b.slot] ? undefined : ada?.videos[b.slot]}
                      urlLama={urlLama[b.slot]}
                      onPilih={(sl, f, inp) => void pilihVideo(sl, f, inp)}
                      onKonversi={(sl) => void konversiVideo(sl)}
                      onHapus={hapusVideo}
                    />
                  ) : (
                    <>
                  {(() => {
                    // Kumpulkan semua slot milik bukti ini (primer + tambahan dari slotMilik).
                    const milik = Object.entries(slotMilik)
                      .filter(([, id]) => id === b.id)
                      .map(([s]) => Number(s))
                    const slotsFoto = [...new Set([b.slot, ...milik])]
                      .filter((s) => dataUrlGambarAman(fotoSlot[s]))
                      .sort((a, c) => a - c)
                    if (slotsFoto.length === 0) {
                      return <div className="sw-bukti-kosong">Belum ada foto</div>
                    }
                    return (
                      <div className="sw-bukti-foto-multi">
                        {slotsFoto.map((s) => (
                          <div key={s} className="sw-kumpul-thumb-wrap sw-bukti-foto">
                            <span className="sw-kumpul-thumb-no sw-kumpul-thumb-no--ok" aria-hidden>
                              ✓
                            </span>
                            <img src={fotoSlot[s]} alt={`Foto: ${b.label}`} className="sw-kumpul-thumb" />
                            {tampilForm && (
                              <button
                                type="button"
                                className="sw-kumpul-hapus"
                                onClick={() => {
                                  setFotoSlot((prev) => {
                                    const n = { ...prev }
                                    delete n[s]
                                    return n
                                  })
                                  setSlotMilik((prev) => {
                                    const n = { ...prev }
                                    delete n[s]
                                    return n
                                  })
                                  setSukses(false)
                                }}
                                aria-label={`Hapus foto ${b.label}`}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {tampilForm && !src && antrianFoto.length > 0 && (
                    <button
                      type="button"
                      className="sw-kumpul-tambah"
                      disabled={off}
                      onClick={() => pasangDariAntrian(b.slot)}
                    >
                      Pasang foto dari antrian ({antrianFoto.length})
                    </button>
                  )}
                  {tampilForm && (
                    <>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                        multiple
                        className="sw-kumpul-input"
                        id={idInput}
                        disabled={offTambah}
                        onChange={(e) => void pilihBukti(b.slot, e.target.files, e.target)}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sw-kumpul-input"
                        id={`${idInput}-kamera`}
                        disabled={offTambah}
                        onChange={(e) => void pilihBukti(b.slot, e.target.files, e.target)}
                      />
                      <div className="sw-kumpul-aksi">
                        <label
                          htmlFor={idInput}
                          className={`sw-kumpul-tambah${offTambah ? ' sw-kumpul-tambah--off' : ''}`}
                        >
                          {sibuk
                            ? 'Memproses…'
                            : !masihBisaTambah
                              ? 'Batas 10 foto'
                              : (Object.entries(slotMilik).some(([s, id]) => id === b.id && dataUrlGambarAman(fotoSlot[Number(s)])) || dataUrlGambarAman(fotoSlot[b.slot]))
                                ? 'Tambah foto'
                                : 'Dari galeri'}
                        </label>
                        <label
                          htmlFor={`${idInput}-kamera`}
                          className={`sw-kumpul-tambah sw-kumpul-tambah--sekunder${offTambah ? ' sw-kumpul-tambah--off' : ''}`}
                        >
                          Kamera
                        </label>
                      </div>
                    </>
                  )}
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

          {tampilForm && antrianFoto.length > 0 && (
            <div className="sw-kumpul-antrian" role="status">
              <p className="sw-kumpul-pratinjau-judul">
                Antrian · {antrianFoto.length} foto menunggu dipasang ke bukti kosong
              </p>
              <p className="sw-kat-hint" style={{ marginTop: 0 }}>
                Tidak dipasang otomatis ke bukti lain. Ketuk «Pasang foto dari antrian» pada kartu yang
                masih kosong.
              </p>
              <div className="sw-kumpul-thumbs">
                {antrianFoto.map((src, i) => (
                  <div key={`antrian-${i}`} className="sw-kumpul-thumb-wrap">
                    <span className="sw-kumpul-thumb-no" aria-hidden>
                      {i + 1}
                    </span>
                    <img src={src} alt={`Antrian ${i + 1}`} className="sw-kumpul-thumb" />
                  </div>
                ))}
              </div>
              <button type="button" className="sw-btn-ghost" onClick={buangAntrian} style={{ marginTop: '0.5rem' }}>
                Buang antrian
              </button>
            </div>
          )}

          {/* Pratinjau lengkap semua foto yang akan dikirim (bukan hanya 1 kartu). */}
          {pratinjauBuktiFoto.length > 0 && (
            <div className="sw-kumpul-pratinjau" aria-label="Pratinjau foto yang akan dikirim">
              <p className="sw-kumpul-pratinjau-judul">
                Pratinjau · {pratinjauBuktiFoto.length} foto
                {jumlahVideoSiap > 0 ? ` · ${jumlahVideoSiap} video` : ''} siap dikirim
              </p>
              <div className="sw-kumpul-thumbs">
                {pratinjauBuktiFoto.map((p, i) => (
                  <div key={p.slot} className="sw-kumpul-thumb-wrap">
                    <span className="sw-kumpul-thumb-no" aria-hidden>
                      {i + 1}
                    </span>
                    <img src={p.src} alt={p.label} className="sw-kumpul-thumb" />
                    <span className="sw-kumpul-thumb-label">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tampilForm && (
            <p className={`sw-bukti-ringkas${kurang.length === 0 ? ' sw-bukti-ringkas--ok' : ''}`}>
              {kurang.length === 0
                ? `Semua bukti yang wajib sudah lengkap (${jumlahFotoBukti} foto` +
                  (jumlahVideoSiap ? ` + ${jumlahVideoSiap} video` : '') +
                  ` dari ${buktiList.length} bukti).`
                : `Belum lengkap — masih perlu: ${kurang.join(', ')}.`}
            </p>
          )}
        </>
      ) : (
        <>
          {items.length > 0 && (
            <div className="sw-kumpul-pratinjau" aria-label="Pratinjau foto yang akan dikirim">
              <p className="sw-kumpul-pratinjau-judul">
                Pratinjau · {items.length} foto siap dikirim
                {items.length >= BATAS_FOTO_PENGUMPULAN ? ' (batas maksimal)' : ''}
              </p>
              <div className="sw-kumpul-thumbs">
                {items.map((x, i) => (
                  <div key={x.key} className="sw-kumpul-thumb-wrap">
                    <span className="sw-kumpul-thumb-no" aria-hidden>
                      {i + 1}
                    </span>
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
            </div>
          )}

          {tampilForm && (
            <>
              {/* Galeri: tanpa capture → Android membuka pemilih foto/file (Browse). multiple = centang beberapa. */}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                multiple
                className="sw-kumpul-input"
                onChange={(e) => void pilih(e.target.files)}
                disabled={olah || busy || items.length >= BATAS_FOTO_PENGUMPULAN}
                id={`kumpul-galeri-${tugas.id}`}
              />
              {/* Kamera: capture environment → langsung kamera belakang (satu foto). */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sw-kumpul-input"
                onChange={(e) => void pilih(e.target.files)}
                disabled={olah || busy || items.length >= BATAS_FOTO_PENGUMPULAN}
                id={`kumpul-kamera-${tugas.id}`}
              />
              <div className="sw-kumpul-aksi">
                <label
                  htmlFor={`kumpul-galeri-${tugas.id}`}
                  className={`sw-kumpul-tambah${
                    olah || busy || items.length >= BATAS_FOTO_PENGUMPULAN ? ' sw-kumpul-tambah--off' : ''
                  }`}
                >
                  {olah ? (prosesFoto ? `Memproses foto ${prosesFoto[0]} dari ${prosesFoto[1]}…` : 'Memproses…') : items.length > 0 ? 'Tambah dari galeri' : 'Pilih dari galeri'}
                </label>
                <label
                  htmlFor={`kumpul-kamera-${tugas.id}`}
                  className={`sw-kumpul-tambah sw-kumpul-tambah--sekunder${
                    olah || busy || items.length >= BATAS_FOTO_PENGUMPULAN ? ' sw-kumpul-tambah--off' : ''
                  }`}
                >
                  Kamera
                </label>
              </div>
              <p className="sw-kat-hint">
                <strong>Pilih dari galeri</strong> membuka foto di HP (bisa centang beberapa, maks.{' '}
                {BATAS_FOTO_PENGUMPULAN}). Jika kotak foto kosong, izinkan akses foto/media untuk
                browser, atau ketuk <em>Browse</em>. <strong>Kamera</strong> untuk foto baru.
              </p>
            </>
          )}
        </>
      )}

      {tampilForm ? (
        <>
          {drafDipulihkan > 0 && !ada && (
            <p className="sw-kat-hint" role="status">
              {drafDipulihkan} foto dari pekerjaanmu sebelumnya dipulihkan dari HP ini. Periksa dulu, lalu kumpulkan.
              {modeBukti ? ' Video (bila ada) perlu dipilih lagi.' : ''}
            </p>
          )}
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
                videoSibuk ||
                (modeBukti ? kurang.length > 0 : items.length === 0)
              }
              onClick={() => void kirim()}
            >
              {busy
                ? persenUnggah !== null
                  ? `Mengunggah video… ${Math.round(persenUnggah * 100)}%`
                  : kemajuanFoto && kemajuanFoto[1] > 0
                    ? `Mengirim foto ${Math.min(kemajuanFoto[0] + 1, kemajuanFoto[1])} dari ${kemajuanFoto[1]}…`
                    : 'Mengirim…'
                : ada
                  ? 'Kirim ulang'
                  : 'Kumpulkan'}
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

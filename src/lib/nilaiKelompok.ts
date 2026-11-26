/**
 * Aturan penyebaran nilai KELOMPOK di «Daftar nilai» & «Menilai per siswa». ANTIREGRESI §Tugas.Kelompok.Penentu.
 *
 * Modul MURNI (tanpa Firebase/React) agar bisa diuji. `wakilId` diberikan pemanggil dari
 * `wakilBuktiKelompok` (satu-satunya aturan wakil, §Tugas.Kelompok.Wakil); jangan menduplikasinya di sini.
 *
 * Istilah:
 * - PENENTU nilai kelompok = ketua, ditambah anggota yang mewakili ketua (wakil bukti) bila ada.
 *   Wakil adalah pemilik bukti yang tampil di layar penilaian, sehingga guru wajar mengisi nilai lewat
 *   barisnya. Mengisi nilai pada salah satu penentu = mengisi nilai kelompok; penentu TIDAK PERNAH
 *   «lepas» dari kelompoknya.
 * - PENGIKUT = anggota lain yang tidak mengirim sendiri; ikut nilai penentu selama belum disesuaikan manual.
 * - PENGIRIM MANDIRI = anggota yang mengirim sendiri padahal ketua punya bukti, atau ambigu; dinilai sendiri.
 */
export type KelompokNilai = { ketuaId: string; anggotaIds: string[] }

export type BarisRujukan = {
  siswaId: string
  sudahAda: boolean
  nilaiAkhir: number | null
  perKategori: Record<string, number | null>
}

export type KonteksKelompok = {
  kelompok: KelompokNilai
  /** Hasil `wakilBuktiKelompok(kelompok, pengumpulan)`. */
  wakilId: string | null
  /** siswaId → ada dokumen pengumpulan; null = belum dimuat. */
  pengumpulan: Record<string, unknown> | null
  baris: BarisRujukan[] | null
  kategoriIds: string[]
  /** Anggota yang nilainya disesuaikan manual (tidak lagi ikut penentu). */
  lepas: Record<string, boolean>
}

function barisDari(ctx: KonteksKelompok, id: string): BarisRujukan | undefined {
  return ctx.baris?.find((r) => r.siswaId === id)
}

/** Ketua lebih dulu, lalu wakil bukti (bila ada). */
export function penentuIds(ctx: KonteksKelompok): string[] {
  return ctx.wakilId && ctx.wakilId !== ctx.kelompok.ketuaId
    ? [ctx.kelompok.ketuaId, ctx.wakilId]
    : [ctx.kelompok.ketuaId]
}

export function adalahPenentu(ctx: KonteksKelompok, id: string): boolean {
  return penentuIds(ctx).includes(id)
}

function samaTersimpan(ctx: KonteksKelompok, a: BarisRujukan, b: BarisRujukan): boolean {
  return (
    a.nilaiAkhir === b.nilaiAkhir &&
    ctx.kategoriIds.every((c) => (a.perKategori[c] ?? null) === (b.perKategori[c] ?? null))
  )
}

/**
 * PENGIKUT: bukan penentu, tidak disesuaikan manual, tidak mengirim sendiri, dan (belum punya nilai
 * tersimpan ATAU nilai tersimpannya identik dengan salah satu penentu yang sudah tersimpan).
 * Nilai tersimpan yang berbeda tidak pernah ditimpa otomatis (gunakan «Samakan»).
 */
export function ikutPenentu(ctx: KonteksKelompok, id: string): boolean {
  if (!ctx.kelompok.anggotaIds.includes(id) || adalahPenentu(ctx, id) || ctx.lepas[id]) return false
  if (ctx.pengumpulan?.[id]) return false // pengirim mandiri
  const r = barisDari(ctx, id)
  if (!r) return false
  if (!r.sudahAda) return true
  return penentuIds(ctx).some((p) => {
    const rp = barisDari(ctx, p)
    return !!rp && rp.sudahAda && samaTersimpan(ctx, r, rp)
  })
}

/** Siapa yang menerima salinan draf bila `sumberId` diedit. Kosong bila sumber bukan penentu. */
export function targetSebar(ctx: KonteksKelompok, sumberId: string): string[] {
  if (!adalahPenentu(ctx, sumberId)) return []
  const out: string[] = []
  for (const id of ctx.kelompok.anggotaIds) {
    if (id === sumberId) continue
    if (adalahPenentu(ctx, id)) {
      if (barisDari(ctx, id)) out.push(id) // penentu lain selalu serempak (draf saja)
    } else if (ikutPenentu(ctx, id)) {
      out.push(id)
    }
  }
  return out
}

/** «Samakan»: seluruh anggota yang tidak mengirim mandiri (penentu lain ikut). */
export function targetSamakan(ctx: KonteksKelompok, sumberId: string): string[] {
  const ada = new Set((ctx.baris ?? []).map((r) => r.siswaId))
  return ctx.kelompok.anggotaIds.filter(
    (id) => id !== sumberId && ada.has(id) && (adalahPenentu(ctx, id) || !ctx.pengumpulan?.[id]),
  )
}

/** Baris kelompok yang ikut «Simpan kelompok»: penentu + pengikut yang belum tersimpan, penentu lebih dulu. */
export function idBelumSimpanKelompok(
  ctx: KonteksKelompok,
  status: (id: string) => 'kosong' | 'ubah' | 'ok' | undefined,
): string[] {
  const ids = ctx.kelompok.anggotaIds.filter((id) => {
    if (!barisDari(ctx, id) || status(id) !== 'ubah') return false
    return adalahPenentu(ctx, id) || ikutPenentu(ctx, id)
  })
  const urut = penentuIds(ctx)
  const bobot = (id: string) => {
    const i = urut.indexOf(id)
    return i === -1 ? urut.length : i
  }
  return ids.sort((a, b) => bobot(a) - bobot(b))
}

/** Penentu yang menjadi sumber salinan untuk «Ikuti lagi»: ketua bila ia sudah berisi, selain itu wakil. */
export function sumberIkutiLagi(
  ctx: KonteksKelompok,
  berisi: (id: string) => boolean,
): string {
  const urut = penentuIds(ctx)
  return urut.find((id) => berisi(id)) ?? ctx.kelompok.ketuaId
}

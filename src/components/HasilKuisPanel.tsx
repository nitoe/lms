import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  agregatPerSoal,
  daftarJawabanKuis,
  daftarJawabanKuisMultiKelas,
  formatSkor100,
  ringkasPerSiswa,
  jawabanTsMs,
  simpanNilaiManual,
  skorKe100,
  type JawabanKuis,
} from '../lib/jawabanKuis'
import { teksPolos } from '../lib/html'
import type { KuisLms, SoalKuis } from '../types/kuis'
import { NAMA_JENIS_PENILAIAN, type JenisPenilaianKuis } from '../types/kuis'
import { NAMA_TIPE, type TipeSoal, normalisasiDomainTka, NAMA_DOMAIN_TKA, type DomainTka } from '../types/soal'
import { useAuth } from '../context/AuthContext'
import {
  analisisKuisDenganAi,
  analisisSiswaDenganAi,
  bolehAnalisisKuisAi,
  htmlLaporanKuis,
  htmlLaporanSiswa,
  unduhLaporanDoc,
  type HasilAnalisisKuisAi,
  type HasilAnalisisSiswaAi,
} from '../lib/analisisKuisAi'
import { sinkronNilaiKuisKePenilaian } from '../lib/sinkronNilaiKuis'
import {
  adalahAdminTka,
  adalahMapelTka,
  kelasHasilTkaBolehDilihat,
} from '../lib/tkaAkses'
import { muatSiswaKelas, type SiswaDasar } from '../lib/siswaAuth'

type Props = {
  kuis: KuisLms
}

/** Baris roster hasil TKA: siswa selalu tampil, jawaban opsional. */
type BarisHasilTka = {
  siswaId: string
  siswaNama: string
  kelas: string
  jawaban: JawabanKuis | null
}

/** Hitung skor per domain TKA (hanya soal yang berdomain). */
function skorPerDomain(jawaban: JawabanKuis | null, soalList: SoalKuis[]): Record<string, { skor: number; maks: number }> {
  const out: Record<string, { skor: number; maks: number }> = {}
  if (!jawaban?.detail) return out
  const byId = new Map(jawaban.detail.map((d) => [d.soalId, d]))
  for (const s of soalList) {
    const dom = normalisasiDomainTka(s.domainTka)
    if (!dom) continue
    if (!out[dom]) out[dom] = { skor: 0, maks: 0 }
    out[dom].maks += s.poin || 0
    const d = byId.get(s.id)
    out[dom].skor += Number(d?.skor) || 0
  }
  return out
}

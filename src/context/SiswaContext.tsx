import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SiswaDasar } from '../lib/siswaAuth'

const STORAGE_KEY = 'lms_siswa_sesi'

interface SiswaSesi {
  id: string
  nama: string
  kelas: string
}

interface SiswaState {
  sesi: SiswaSesi | null
  loading: boolean
  masuk: (siswa: SiswaDasar, nisn: string) => Promise<void>
  keluar: () => void
}

const SiswaContext = createContext<SiswaState>({
  sesi: null,
  loading: true,
  masuk: async () => {},
  keluar: () => {},
})

function bacaSesi(): SiswaSesi | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SiswaSesi
  } catch {
    return null
  }
}

export function SiswaProvider({ children }: { children: ReactNode }) {
  const [sesi, setSesi] = useState<SiswaSesi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSesi(bacaSesi())
    setLoading(false)
  }, [])

  const masuk = useCallback(async (siswa: SiswaDasar, nisn: string) => {
    const input = nisn.trim()
    const expected = (siswa.nisn || '').trim()
    if (!expected) {
      throw new Error('NISN siswa belum terdaftar. Hubungi guru atau admin.')
    }
    if (input !== expected) {
      throw new Error('NISN tidak cocok. Periksa kembali.')
    }
    const s: SiswaSesi = { id: siswa.id, nama: siswa.nama, kelas: siswa.kelas }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    setSesi(s)
  }, [])

  const keluar = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setSesi(null)
  }, [])

  const value = useMemo(
    () => ({ sesi, loading, masuk, keluar }),
    [sesi, loading, masuk, keluar],
  )

  return <SiswaContext.Provider value={value}>{children}</SiswaContext.Provider>
}

export function useSiswa() {
  return useContext(SiswaContext)
}

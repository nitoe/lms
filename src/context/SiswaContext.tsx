import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithCustomToken,
  signOut,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions, isFirebaseConfigured } from '../lib/firebase'

interface SiswaSesi {
  id: string
  nama: string
  kelas: string
}

interface SiswaState {
  sesi: SiswaSesi | null
  loading: boolean
  /** Verifikasi NISN dilakukan Cloud Function loginSiswaLms; NISN tidak pernah dicocokkan di klien. */
  masuk: (siswaId: string, nisn: string) => Promise<void>
  keluar: () => Promise<void>
}

const SiswaContext = createContext<SiswaState>({
  sesi: null,
  loading: true,
  masuk: async () => {},
  keluar: async () => {},
})

/** Sesi siswa diturunkan dari claims token (lmsSiswa, siswaId, kelas, nama). */
async function sesiDariUser(user: User | null): Promise<SiswaSesi | null> {
  if (!user) return null
  try {
    const { claims } = await user.getIdTokenResult()
    if (claims.lmsSiswa !== true || typeof claims.siswaId !== 'string') return null
    return {
      id: claims.siswaId,
      nama: typeof claims.nama === 'string' ? claims.nama : '',
      kelas: typeof claims.kelas === 'string' ? claims.kelas : '',
    }
  } catch {
    return null
  }
}

export function SiswaProvider({ children }: { children: ReactNode }) {
  const [sesi, setSesi] = useState<SiswaSesi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    let aktif = true
    let terakhir = 0
    const berhenti = onAuthStateChanged(auth, (user) => {
      const n = ++terakhir
      void sesiDariUser(user).then((s) => {
        // Abaikan hasil lama bila status login berubah lagi sebelum token selesai dibaca.
        if (!aktif || n !== terakhir) return
        setSesi(s)
        setLoading(false)
      })
    })
    return () => {
      aktif = false
      berhenti()
    }
  }, [])

  const masuk = useCallback(async (siswaId: string, nisn: string) => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase belum dikonfigurasi. Isi file .env terlebih dahulu.')
    }
    // Sesi siswa hilang saat tab ditutup (perangkat kelas dipakai bergantian).
    await setPersistence(auth, browserSessionPersistence)
    const panggil = httpsCallable<{ siswaId: string; nisn: string }, { token: string }>(
      functions,
      'loginSiswaLms',
    )
    const hasil = await panggil({ siswaId, nisn: nisn.trim() })
    await signInWithCustomToken(auth, hasil.data.token)
  }, [])

  const keluar = useCallback(async () => {
    if (isFirebaseConfigured) await signOut(auth)
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

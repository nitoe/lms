import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { fetchUserProfile, subscribeAuth } from '../lib/auth'
import { peranDari } from '../lib/peran'
import type { AppUser, PeranLms } from '../types/user'

interface AuthState {
  user: User | null
  profil: AppUser | null
  peran: PeranLms | null
  loading: boolean
  refreshProfil: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  profil: null,
  peran: null,
  loading: true,
  refreshProfil: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profil, setProfil] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeAuth((u, p) => {
      setUser(u)
      setProfil(p)
      setLoading(false)
    })
  }, [])

  const refreshProfil = useCallback(async () => {
    if (!user) return
    setProfil(await fetchUserProfile(user.uid))
  }, [user])

  const value = useMemo(
    () => ({
      user,
      profil,
      peran: peranDari(profil),
      loading,
      refreshProfil,
    }),
    [user, profil, loading, refreshProfil],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

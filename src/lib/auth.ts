import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'
import { peranDari } from './peran'
import type { AppUser } from '../types/user'

export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  if (!isFirebaseConfigured) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid,
    email: (d.email as string) || '',
    nama: (d.nama as string) || '',
    gelar: (d.gelar as string) || undefined,
    role: d.role,
    peranLms: d.peranLms,
    aktif: typeof d.aktif === 'boolean' ? d.aktif : undefined,
    penugasan: d.penugasan,
    penugasanKelas: d.penugasanKelas,
    penugasanKelasMapel: d.penugasanKelasMapel,
    waliKelas: d.waliKelas,
    kelasAmpu: d.kelasAmpu,
    anakIds: d.anakIds,
    status: d.status,
  }
}

export async function loginWithEmail(email: string, password: string) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase belum dikonfigurasi. Isi file .env terlebih dahulu.')
  }
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
  const profil = await fetchUserProfile(cred.user.uid)
  if (!profil) {
    await signOut(auth)
    throw new Error('Akun ini belum memiliki profil. Hubungi administrator.')
  }
  if (profil.aktif === false) {
    await signOut(auth)
    throw new Error('Akun ini dinonaktifkan. Hubungi administrator.')
  }
  return { user: cred.user, profil, peran: peranDari(profil) }
}

export async function logout() {
  await signOut(auth)
}

export function subscribeAuth(cb: (user: User | null, profil: AppUser | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null, null)
    try {
      cb(user, await fetchUserProfile(user.uid))
    } catch {
      cb(user, null)
    }
  })
}

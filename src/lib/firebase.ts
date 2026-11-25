import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

/** Wilayah Cloud Functions. HARUS sama dengan region di repo SDM01Penilaian (functions/loginSiswaLms.js). */
export const REGION_FUNGSI = 'asia-southeast2'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId,
)

let app: FirebaseApp | undefined
let auth: Auth
let db: Firestore
let storage: FirebaseStorage
let functions: Functions

if (isFirebaseConfigured) {
  app = initializeApp(config)
  auth = getAuth(app)
  // Deteksi otomatis jaringan yang memblokir koneksi streaming Firestore (WiFi sekolah, proxy, VPN,
  // filter DNS): beralih ke long-polling alih-alih menggantung. ANTIREGRESI §Kirim.Diagnostik.
  // initializeFirestore hanya boleh sekali per aplikasi; HMR di dev memanggilnya ulang → pakai instance yang ada.
  try {
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  } catch {
    db = getFirestore(app)
  }
  storage = getStorage(app)
  functions = getFunctions(app, REGION_FUNGSI)
} else {
  // Placeholder agar import tidak error saat .env belum diisi.
  auth = null as unknown as Auth
  db = null as unknown as Firestore
  storage = null as unknown as FirebaseStorage
  functions = null as unknown as Functions
}

export { app, auth, db, storage, functions }

import { useEffect, useState } from 'react'

/** Waktu sekarang (ms) yang diperbarui berkala — agar hitung mundur/penanda waktu ikut berubah. */
export function useSekarang(intervalMs = 30_000): number {
  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setSekarang(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return sekarang
}

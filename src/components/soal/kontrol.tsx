import { useEffect, useState } from 'react'

/** Saklar on/off bergaya screenshot (Multiple answer / Answer with image). */
export function Saklar({
  aktif,
  onChange,
  label,
  disabled,
}: {
  aktif: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className={`soal-saklar ${disabled ? 'soal-saklar--mati' : ''}`}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={aktif}
        disabled={disabled}
        className={`soal-saklar-trek ${aktif ? 'soal-saklar-trek--on' : ''}`}
        onClick={() => onChange(!aktif)}
      >
        <span className="soal-saklar-bulat" />
      </button>
    </label>
  )
}

/** Input angka yang tidak "melompat" saat mengetik (mis. mengosongkan lalu mengetik 2). */
export function AngkaInput({
  nilai,
  onChange,
  min = 0,
  maks = 1000,
  langkah = 1,
  satuan,
  ariaLabel,
}: {
  nilai: number
  onChange: (n: number) => void
  min?: number
  maks?: number
  langkah?: number
  satuan: string
  ariaLabel: string
}) {
  const [teks, setTeks] = useState(String(nilai))
  useEffect(() => {
    setTeks((t) => (Number(t.replace(',', '.')) === nilai ? t : String(nilai)))
  }, [nilai])

  return (
    <div className="soal-angka">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={teks}
        onChange={(e) => {
          setTeks(e.target.value)
          const n = Number(e.target.value.replace(',', '.'))
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= maks) onChange(n)
        }}
        onBlur={() => {
          const n = Number(teks.replace(',', '.'))
          const ok = teks.trim() !== '' && Number.isFinite(n) && n >= min && n <= maks
          const akhir = ok ? n : Math.min(maks, Math.max(min, nilai || min || langkah))
          setTeks(String(akhir))
          onChange(akhir)
        }}
      />
      <span className="soal-angka-satuan">{satuan}</span>
    </div>
  )
}

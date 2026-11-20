import { BATAS_DURASI_VIDEO_DETIK, formatDurasi, formatUkuran, type VideoMeta, type VideoSiap } from '../../lib/videoTugas'

/** Keadaan satu kartu bukti video di sisi siswa (ANTIREGRESI §Tugas.Video). */
export type VideoUI = {
  fase: 'periksa' | 'perlu' | 'konversi' | 'siap'
  /** 0..1 — kemajuan konversi. */
  persen: number
  /** Video terpilih yang menunggu «Perkecil video» (fase `perlu`). */
  file?: File
  durasi?: number
  /** Hasil final yang akan diunggah saat «Kumpulkan» (fase `siap`). */
  siap?: VideoSiap
  /** Object URL pratinjau video baru. */
  url?: string
}

type Props = {
  slot: number
  idInput: string
  tampilForm: boolean
  sibuk: boolean
  ui: VideoUI | undefined
  /** Video yang sudah tersimpan di server untuk slot ini (belum dihapus siswa). */
  lama: VideoMeta | undefined
  urlLama: string | undefined
  onPilih: (slot: number, files: FileList | null, input: HTMLInputElement | null) => void
  onKonversi: (slot: number) => void
  onHapus: (slot: number) => void
}

export default function VideoBukti({
  slot,
  idInput,
  tampilForm,
  sibuk,
  ui,
  lama,
  urlLama,
  onPilih,
  onKonversi,
  onHapus,
}: Props) {
  const fase = ui?.fase
  const adaVideo = fase === 'siap' || (!ui && !!lama)
  const sumberPutar = fase === 'siap' ? ui?.url : urlLama
  const info = fase === 'siap' ? ui?.siap : lama
  const proses = fase === 'periksa' || fase === 'konversi'

  return (
    <>
      {adaVideo ? (
        <div className="sw-video-wrap">
          {sumberPutar ? (
            <video className="sw-video" src={sumberPutar} controls playsInline preload="metadata" />
          ) : (
            <div className="sw-bukti-kosong">Memuat video…</div>
          )}
          {info && (
            <p className="sw-video-info">
              {formatDurasi(info.durasi)} · {formatUkuran(info.ukuran)}
              {fase === 'siap' ? ' · belum dikirim' : ''}
            </p>
          )}
          {tampilForm && (
            <button type="button" className="sw-kumpul-hapus" onClick={() => onHapus(slot)} aria-label="Hapus video">
              ×
            </button>
          )}
        </div>
      ) : fase === 'perlu' ? (
        <div className="sw-video-perlu">
          <p>
            Video dipilih ({formatDurasi(ui?.durasi ?? 0)}, {formatUkuran(ui?.file?.size ?? 0)}). Perkecil dulu supaya
            cepat terkirim.
          </p>
          <button type="button" className="sw-btn-primary" onClick={() => onKonversi(slot)}>
            Perkecil video
          </button>
          <button type="button" className="sw-btn-ghost" onClick={() => onHapus(slot)}>
            Batal
          </button>
        </div>
      ) : proses ? (
        <div className="sw-video-proses" role="status">
          <p>
            {fase === 'periksa'
              ? 'Memeriksa video…'
              : `Memperkecil video… ${Math.round((ui?.persen ?? 0) * 100)}%`}
          </p>
          {fase === 'konversi' && (
            <>
              <div className="sw-video-bar">
                <span style={{ width: `${Math.round((ui?.persen ?? 0) * 100)}%` }} />
              </div>
              <p className="sw-kat-hint">Tunggu sampai selesai dan jangan pindah ke aplikasi lain.</p>
            </>
          )}
        </div>
      ) : (
        <div className="sw-bukti-kosong">Belum ada video</div>
      )}

      {tampilForm && !proses && fase !== 'perlu' && (
        <>
          <input
            type="file"
            accept="video/*"
            className="sw-kumpul-input"
            id={idInput}
            disabled={sibuk}
            onChange={(e) => onPilih(slot, e.target.files, e.target)}
          />
          <label htmlFor={idInput} className={`sw-kumpul-tambah${sibuk ? ' sw-kumpul-tambah--off' : ''}`}>
            {adaVideo ? 'Ganti video' : 'Rekam / pilih video'}
          </label>
          <p className="sw-kat-hint">
            Video maksimal {BATAS_DURASI_VIDEO_DETIK / 60} menit. Video yang lebih panjang tidak bisa dikirim.
          </p>
        </>
      )}
    </>
  )
}

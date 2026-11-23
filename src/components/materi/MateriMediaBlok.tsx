import { useState } from 'react'
import type { MateriBlok } from '../../types/materi'
import { BATAS_UKURAN } from '../../types/materi'
import { ekstrakYoutubeId, tipeKontenMedia, unggahMediaHalaman } from '../../lib/materi'

export type BlokMedia = Extract<MateriBlok, { tipe: 'video' | 'audio' }>

/** Tampilan blok video/audio untuk siswa dan pratinjau guru. */
export function MateriMediaTampil({ blok }: { blok: BlokMedia }) {
  if (!blok.url) return null
  if (blok.tipe === 'video' && blok.sumber === 'youtube') {
    const id = ekstrakYoutubeId(blok.url)
    if (!id) return null
    return (
      <figure className="mh-blok mh-blok--media">
        <div className="mh-media-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={blok.caption || 'Video materi'}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12 }}
          />
        </div>
        {blok.caption && <figcaption className="mh-media-cap">{blok.caption}</figcaption>}
      </figure>
    )
  }
  if (blok.tipe === 'video') {
    return (
      <figure className="mh-blok mh-blok--media">
        <video
          controls
          playsInline
          preload="metadata"
          src={blok.url}
          style={{ width: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000' }}
        >
          Peramban Anda tidak mendukung pemutar video.
        </video>
        {blok.caption && <figcaption className="mh-media-cap">{blok.caption}</figcaption>}
      </figure>
    )
  }
  return (
    <figure className="mh-blok mh-blok--media">
      <audio controls preload="metadata" src={blok.url} style={{ width: '100%' }}>
        Peramban Anda tidak mendukung pemutar audio.
      </audio>
      {blok.caption && <figcaption className="mh-media-cap">{blok.caption}</figcaption>}
    </figure>
  )
}

type EditorProps = {
  blok: BlokMedia
  kelas: string
  disabled?: boolean
  onChange: (patch: Partial<BlokMedia>) => void
  onError: (pesan: string) => void
}

/** Editor satu blok video/audio: unggah file ATAU tautan (YouTube untuk video, https untuk audio). */
export function MateriMediaEditor({ blok, kelas, disabled, onChange, onError }: EditorProps) {
  const [progres, setProgres] = useState<number | null>(null)
  const jenis = blok.tipe
  const batasMb = Math.round((jenis === 'video' ? BATAS_UKURAN.video : BATAS_UKURAN.audio) / (1024 * 1024))
  const sumberVideo = blok.tipe === 'video' ? blok.sumber : 'unggah'
  const sibuk = progres !== null

  async function pilihFile(file: File | undefined) {
    if (!file) return
    if (!tipeKontenMedia(file, jenis)) {
      onError(
        jenis === 'video'
          ? 'Format video tidak didukung. Gunakan MP4 (disarankan), WebM, OGV, atau MOV.'
          : 'Format audio tidak didukung. Gunakan MP3 (disarankan), M4A, AAC, WAV, atau OGG.',
      )
      return
    }
    onError('')
    setProgres(0)
    try {
      const hasil = await unggahMediaHalaman(kelas, file, jenis, setProgres)
      onChange({ url: hasil.url, storagePath: hasil.storagePath, contentType: hasil.contentType } as Partial<BlokMedia>)
    } catch (e) {
      onError(e instanceof Error ? e.message : `Gagal mengunggah ${jenis}.`)
    } finally {
      setProgres(null)
    }
  }

  return (
    <div className="mh-img-edit" style={{ display: 'grid', gap: 10 }}>
      {blok.tipe === 'video' && (
        <div role="radiogroup" aria-label="Sumber video" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['unggah', 'youtube'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sumberVideo === s}
              className={sumberVideo === s ? 'lms-btn-primary' : 'lms-btn-secondary'}
              disabled={disabled || sibuk}
              onClick={() => onChange({ sumber: s, url: '', storagePath: undefined, contentType: undefined } as Partial<BlokMedia>)}
            >
              {s === 'unggah' ? 'Unggah file video' : 'Tautan YouTube'}
            </button>
          ))}
        </div>
      )}

      {sumberVideo === 'youtube' && blok.tipe === 'video' ? (
        <label className="materi-field">
          <span>Tautan YouTube</span>
          <input
            type="url"
            value={blok.url}
            placeholder="https://www.youtube.com/watch?v=…"
            disabled={disabled}
            onChange={(e) => onChange({ url: e.target.value.trim() })}
          />
          {blok.url && !ekstrakYoutubeId(blok.url) && (
            <span role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>
              Tautan YouTube tidak dikenali.
            </span>
          )}
        </label>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <label className="materi-field">
            <span>
              {blok.url ? `Ganti file ${jenis}` : `Unggah file ${jenis}`} (maks {batasMb} MB;{' '}
              {jenis === 'video' ? 'MP4 disarankan' : 'MP3 disarankan'})
            </span>
            <input
              type="file"
              accept={jenis === 'video' ? 'video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.m4v,.webm,.mov' : 'audio/*,.mp3,.m4a,.aac,.wav,.ogg'}
              disabled={disabled || sibuk}
              onChange={(e) => {
                void pilihFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {sibuk && (
            <div role="status" aria-live="polite" style={{ fontSize: 12 }}>
              Mengunggah… {progres}%
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, marginTop: 4 }}>
                <div style={{ height: 6, width: `${progres}%`, background: '#0f7a4d', borderRadius: 4 }} />
              </div>
            </div>
          )}
          {blok.tipe === 'audio' && !blok.storagePath && (
            <label className="materi-field">
              <span>atau tempel tautan audio langsung (https)</span>
              <input
                type="url"
                value={blok.url}
                placeholder="https://…/narasi.mp3"
                disabled={disabled || sibuk}
                onChange={(e) => onChange({ url: e.target.value.trim() })}
              />
            </label>
          )}
        </div>
      )}

      <label className="materi-field">
        <span>Keterangan (opsional)</span>
        <input
          type="text"
          maxLength={300}
          value={blok.caption ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </label>

      {blok.url ? (
        <div>
          <p style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Pratinjau</p>
          <MateriMediaTampil blok={blok} />
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#64748b' }}>
          Blok masih kosong — unggah file atau isi tautan. Blok kosong tidak ikut tersimpan.
        </p>
      )}
    </div>
  )
}

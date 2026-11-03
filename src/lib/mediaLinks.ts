export type MediaSource =
  | 'youtube'
  | 'vimeo'
  | 'spotify'
  | 'deezer'
  | 'apple'
  | 'bandcamp'
  | 'external'

export interface MediaInfo {
  source: MediaSource
  /** Nome curto exibido na interface (ex.: 'YouTube') */
  label: string
  /** URL para abrir dentro do app (iframe) ou null quando não é possível embutir */
  embedUrl: string | null
  /** URL original, para abrir no navegador */
  watchUrl: string
  /** Identificador do recurso na origem (ex.: id do vídeo) */
  id: string | null
}

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]

const SPOTIFY_KINDS = ['track', 'album', 'playlist', 'episode', 'show', 'artist']
const DEEZER_KINDS = ['track', 'album', 'playlist']

function safeUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

/** Extrai o ID do vídeo de qualquer formato de link do YouTube. */
export function extractYouTubeId(raw: string): string | null {
  const url = safeUrl(raw)
  if (!url) return null

  const host = url.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.includes(host)) return null

  // youtu.be/ID
  if (host.endsWith('youtu.be')) {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id && /^[\w-]{11}$/.test(id) ? id : null
  }

  // /watch?v=ID
  const v = url.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v

  // /embed/ID, /shorts/ID, /live/ID, /v/ID
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const [kind, id] = parts
    if (['embed', 'shorts', 'live', 'v'].includes(kind) && /^[\w-]{11}$/.test(id)) return id
  }

  return null
}

export function extractVimeoId(raw: string): string | null {
  const url = safeUrl(raw)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  if (host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop()
    return id && /^\d+$/.test(id) ? id : null
  }
  if (host.endsWith('vimeo.com')) {
    const id = url.pathname.split('/').filter(Boolean).pop()
    return id && /^\d+$/.test(id) ? id : null
  }
  return null
}

/**
 * Descreve um link de mídia: fonte, se pode ser embutido no app e a URL de embed.
 * Retorna null para links vazios/inválidos.
 */
export function describeMedia(raw: string): MediaInfo | null {
  const url = safeUrl(raw)
  if (!url) return null

  const watchUrl = url.toString()
  const host = url.hostname.toLowerCase().replace(/^www\./, '')

  /* ------------------------------- YouTube ------------------------------- */
  const ytId = extractYouTubeId(watchUrl)
  if (ytId) {
    return {
      source: 'youtube',
      label: 'YouTube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1`,
      watchUrl: `https://www.youtube.com/watch?v=${ytId}`,
      id: ytId,
    }
  }

  /* -------------------------------- Vimeo -------------------------------- */
  const vimeoId = extractVimeoId(watchUrl)
  if (vimeoId) {
    return {
      source: 'vimeo',
      label: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      watchUrl: `https://vimeo.com/${vimeoId}`,
      id: vimeoId,
    }
  }

  /* ------------------------------- Spotify ------------------------------- */
  if (host === 'open.spotify.com' || host === 'spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const kind = parts[0]
    const id = parts[1]
    if (kind && id && SPOTIFY_KINDS.includes(kind)) {
      return {
        source: 'spotify',
        label: 'Spotify',
        embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
        watchUrl: `https://open.spotify.com/${kind}/${id}`,
        id,
      }
    }
  }

  /* -------------------------------- Deezer ------------------------------- */
  if (host === 'deezer.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const kind = parts[0]
    const id = parts[1]
    if (kind && id && DEEZER_KINDS.includes(kind)) {
      return {
        source: 'deezer',
        label: 'Deezer',
        embedUrl: `https://www.deezer.com/embed/${kind}/${id}`,
        watchUrl: `https://www.deezer.com/${kind}/${id}`,
        id,
      }
    }
  }

  /* ------------------------------ Apple Music ---------------------------- */
  if (host === 'music.apple.com') {
    return {
      source: 'apple',
      label: 'Apple Music',
      embedUrl: null,
      watchUrl,
      id: null,
    }
  }

  /* ------------------------------- Bandcamp ------------------------------ */
  if (host.endsWith('bandcamp.com')) {
    return {
      source: 'bandcamp',
      label: 'Bandcamp',
      embedUrl: null,
      watchUrl,
      id: null,
    }
  }

  /* ------------------------------- Genérico ------------------------------ */
  return {
    source: 'external',
    label: 'Link externo',
    embedUrl: null,
    watchUrl,
    id: null,
  }
}

/** Icones/classes por fonte, para manter o visual consistente. */
export const SOURCE_STYLE: Record<MediaSource, { chip: string; text: string }> = {
  youtube: { chip: 'bg-red-500/12 text-red-300 ring-red-500/25', text: 'text-red-300' },
  vimeo: { chip: 'bg-sky-500/12 text-sky-300 ring-sky-500/25', text: 'text-sky-300' },
  spotify: { chip: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25', text: 'text-emerald-300' },
  deezer: { chip: 'bg-violet-500/12 text-violet-300 ring-violet-500/25', text: 'text-violet-300' },
  apple: { chip: 'bg-white/8 text-zinc-200 ring-white/12', text: 'text-zinc-200' },
  bandcamp: { chip: 'bg-cyan-500/12 text-cyan-300 ring-cyan-500/25', text: 'text-cyan-300' },
  external: { chip: 'bg-white/8 text-zinc-300 ring-white/12', text: 'text-zinc-300' },
}

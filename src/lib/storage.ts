import type { Member, Presence, Service, ServiceSong, Song, SessionUser } from './types'

const PREFIX = 'worshipflow:'

export const STORAGE_KEYS = {
  members: `${PREFIX}members`,
  services: `${PREFIX}services`,
  songs: `${PREFIX}songs`,
  presence: `${PREFIX}presence`,
  session: `${PREFIX}session`,
  seeded: `${PREFIX}seeded`,
} as const

export function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStore<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / modo privado */
  }
}

export function removeStore(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export type StoreShape = {
  members: Member[]
  services: Service[]
  songs: Song[]
  presence: Presence[]
  session: SessionUser | null
}

/**
 * Normaliza escalas gravadas em versões anteriores do app.
 * Antes, `songs` era um array de títulos (string); agora cada item é um
 * objeto com link, letra, cifra e tom.
 */
export function normalizeService(input: Service): Service {
  const raw = input as Service & { songs?: unknown }
  const list = Array.isArray(raw.songs) ? raw.songs : []
  const songs: ServiceSong[] = list.map((song) =>
    typeof song === 'string' ? { title: song } : (song as ServiceSong),
  )
  return { ...input, songs }
}

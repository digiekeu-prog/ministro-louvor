/**
 * Monta a **escala pública** a partir do que já está salvo no aparelho.
 *
 * Para que serve: quando o banco do servidor está fora do ar (cota do Neon),
 * a página pública ainda precisa mostrar a equipe e o repertório. O app
 * guarda uma cópia dos dados em `localStorage` — então dá para remontar a
 * escala sem depender do Postgres.
 *
 * É a mesma montagem que a API faz em `handlePublicScale` (`api/_lib/app.ts`):
 * mesma ordem, mesmas informações e — o mais importante — **sem** telefone,
 * e-mail nem confirmação de presença.
 */

import type { Category, Member, Service, Song } from './types'

export interface EquipeItem {
  memberId: string
  nome: string
  funcao: string
  categoria: Category
  observacao: string | null
}

export interface MusicaPublica {
  title: string
  artist: string | null
  link: string | null
  lyrics: string | null
  chords: string | null
  key: string | null
  bpm: number | null
  progression: string | null
  audioId: string | null
  audioName: string | null
  audioSize: number | null
}

export interface EscalaPublica {
  id: string
  title: string
  date: string
  time: string
  location: string | null
  status: 'rascunho' | 'confirmado' | 'realizado'
  notes: string | null
  equipe: EquipeItem[]
  musicas: MusicaPublica[]
}

/** Lê uma lista do cache local do app (sem quebrar se não existir). */
function ler<T>(chave: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(chave)
    const valor = raw ? JSON.parse(raw) : []
    return Array.isArray(valor) ? (valor as T[]) : []
  } catch {
    return []
  }
}

/**
 * Remonta a escala pública usando o cache do app.
 * Devolve `null` se este aparelho não tem essa escala salva.
 */
export function escalaDoCache(id: string): EscalaPublica | null {
  if (!id) return null

  const servicos = ler<Service>('worshipflow:services')
  const membros = ler<Member>('worshipflow:members')
  const catalogo = ler<Song>('worshipflow:songs')

  const servico = servicos.find((s) => s.id === id)
  if (!servico) return null

  const porId = new Map(membros.map((m) => [m.id, m]))
  const musicaDoCatalogo = new Map(catalogo.map((s) => [s.id, s]))

  return {
    id: servico.id,
    title: servico.title,
    date: servico.date,
    time: servico.time,
    location: servico.location ?? null,
    status: servico.status,
    notes: servico.notes ?? null,
    equipe: (servico.slots ?? [])
      .filter((slot) => slot.memberId)
      .map((slot) => {
        const member = porId.get(slot.memberId ?? '')
        return {
          memberId: slot.memberId ?? '',
          nome: member?.name ?? 'Vaga em aberto',
          funcao: slot.functionName,
          categoria: slot.category,
          observacao: slot.notes ?? null,
        }
      }),
    musicas: (servico.songs ?? []).map((song) => {
      // a letra/cifra pode estar no catálogo do app (e não na escala)
      const doCatalogo = song.id ? musicaDoCatalogo.get(song.id) : undefined
      const fonte = doCatalogo ?? song
      return {
        title: song.title,
        artist: song.artist ?? null,
        link: song.link ?? null,
        lyrics: song.lyrics ?? fonte.lyrics ?? null,
        chords: song.chords ?? fonte.chords ?? null,
        key: song.key ?? fonte.key ?? null,
        bpm: song.bpm ?? fonte.bpm ?? null,
        progression: song.progression ?? fonte.progression ?? null,
        audioId: song.audioId ?? null,
        audioName: song.audioName ?? null,
        audioSize: song.audioSize ?? null,
      }
    }),
  }
}

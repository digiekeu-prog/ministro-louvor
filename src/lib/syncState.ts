/**
 * Estado compartilhado do ministério (o "banco de dados" da equipe).
 *
 * Este módulo é puro: serve tanto para o app (React) quanto para as
 * functions da Vercel (Node), por isso não pode usar nada do navegador.
 *
 * O formato é uma lista de "operações" (upsert/delete/reset). Cada operação
 * vira uma linha no log do servidor, o que faz a sincronização entre
 * aparelhos ser simples e sem conflito: todo mundo aplica as mesmas
 * operações na mesma ordem.
 */

import type { Member, Presence, Service, Song } from './types'

/** Coleções que são compartilhadas entre todos os aparelhos. */
export type Collection = 'members' | 'services' | 'songs' | 'presence'

/** Todo o dado do ministerial, em um único objeto. */
export interface AppData {
  members: Member[]
  services: Service[]
  songs: Song[]
  presence: Presence[]
}

export const EMPTY_DATA: AppData = {
  members: [],
  services: [],
  songs: [],
  presence: [],
}

export type SyncOp =
  | { op: 'upsert'; collection: Collection; id: string; payload: unknown }
  | { op: 'delete'; collection: Collection; id: string }
  /** Substitui tudo (usado na primeira sincronização e no botão do ministro). */
  | { op: 'reset'; payload: AppData }

/** Uma operação guardada no servidor, com o número da versão. */
export interface SyncChange {
  seq: number
  op: SyncOp['op']
  collection: Collection | 'all'
  itemId: string | null
  payload: unknown
  actor: string | null
  createdAt: string
}

/** Chave única de um item dentro de uma coleção. */
export function itemId(collection: Collection, item: unknown): string {
  if (collection === 'presence') {
    const presence = item as Presence
    return presenceId(presence.memberId, presence.serviceId)
  }
  return (item as { id: string }).id
}

/** A presença é identificada pelo par memberId + serviceId. */
export function presenceId(memberId: string, serviceId: string): string {
  return `${memberId}:${serviceId}`
}

/** Garante que o objeto tiver as quatro listas (protege contra dado corrompido). */
export function normalizeData(raw: unknown): AppData {
  const data = (raw ?? {}) as Partial<AppData>
  return {
    members: Array.isArray(data.members) ? data.members : [],
    services: Array.isArray(data.services) ? data.services : [],
    songs: Array.isArray(data.songs) ? data.songs : [],
    presence: Array.isArray(data.presence) ? data.presence : [],
  }
}

/**
 * Aplica uma lista de operações sobre o estado atual.
 * É idempotente: reaplicar a mesma operação não muda nada.
 */
export function applyOps(data: AppData, ops: SyncOp[]): AppData {
  let next = data

  for (const op of ops) {
    if (op.op === 'reset') {
      next = normalizeData(op.payload)
      continue
    }

    const list = next[op.collection] as unknown[]
    const index = list.findIndex((item) => itemId(op.collection, item) === op.id)

    if (op.op === 'delete') {
      if (index >= 0) {
        next = { ...next, [op.collection]: list.filter((_, i) => i !== index) }
      }
      continue
    }

    // upsert: substitui se já existe, senão acrescenta no fim
    if (index >= 0) {
      const copy = list.slice()
      copy[index] = op.payload
      next = { ...next, [op.collection]: copy }
    } else {
      next = { ...next, [op.collection]: [...list, op.payload] }
    }
  }

  return next
}

/** Compara dois estados para saber se são iguais (ignora a ordem das listas). */
export function sameData(a: AppData, b: AppData): boolean {
  return (
    a.members.length === b.members.length &&
    a.services.length === b.services.length &&
    a.songs.length === b.songs.length &&
    a.presence.length === b.presence.length &&
    JSON.stringify(a) === JSON.stringify(b)
  )
}

/** Converte uma linha do log do servidor de volta em operação. */
export function changeToOp(change: SyncChange): SyncOp {
  if (change.op === 'reset') {
    return { op: 'reset', payload: normalizeData(change.payload) }
  }
  if (change.op === 'delete') {
    return { op: 'delete', collection: change.collection as Collection, id: change.itemId ?? '' }
  }
  return {
    op: 'upsert',
    collection: change.collection as Collection,
    id: change.itemId ?? '',
    payload: change.payload,
  }
}

/** Reconstrói o estado completo a partir do log de operações. */
export function stateFromChanges(changes: SyncChange[]): AppData {
  return applyOps(EMPTY_DATA, changes.map(changeToOp))
}

/** Procura um membro pelo e-mail (sem diferenciar maiúsculas/minúsculas). */
export function findMemberByEmail(data: AppData, email: string): Member | undefined {
  const normalized = email.trim().toLowerCase()
  return data.members.find((member) => member.email.trim().toLowerCase() === normalized)
}

/** Monta a operação de criação/edição de um item. */
export function upsertOp(collection: Collection, item: unknown): SyncOp {
  return { op: 'upsert', collection, id: itemId(collection, item), payload: item }
}

/** Monta a operação de exclusão de um item. */
export function deleteOp(collection: Collection, id: string): SyncOp {
  return { op: 'delete', collection, id }
}

/** Operação que substitui o estado inteiro. */
export function resetOp(data: AppData): SyncOp {
  return { op: 'reset', payload: data }
}

export type { Member, Presence, Service, Song }

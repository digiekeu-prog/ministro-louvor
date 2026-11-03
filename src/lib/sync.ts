/**
 * Sincronização entre os aparelhos da equipe.
 *
 * Como funciona:
 *  - cada alteração feita no app vira uma operação ("op") e entra numa fila;
 *  - a fila é enviada para o servidor (/api/sync), que guarda tudo em ordem;
 *  - de tempos em tempos o app pergunta "o que há de novo?" (/api/sync?since=N)
 *    e aplica as operações dos outros aparelhos.
 *
 * Se o servidor estiver fora do ar, o app continua funcionando com os dados
 * salvos no próprio aparelho e reenvia a fila quando a internet voltar.
 */

import { useSyncExternalStore } from 'react'
import type { AppData, SyncChange, SyncOp } from './syncState'
import type { Member } from './types'
import { normalizeData } from './syncState'

export type SyncState = 'desligado' | 'conectando' | 'sincronizado' | 'erro'

export interface SyncStatus {
  state: SyncState
  /** Última vez que o app falou com o servidor (timestamp). */
  lastSyncAt: number | null
  /** Alterações esperando envio. */
  pending: number
  /** Mensagem de erro (quando state = 'erro'). */
  message: string | null
  /** O servidor ainda tem somente os dados de exemplo. */
  pristine: boolean
}

export interface SyncHandlers {
  /** Estado completo vindo do servidor (primeira sincronização). */
  onSnapshot: (data: AppData, pristine: boolean) => void
  /** Novidades dos outros aparelhos. */
  onChanges: (changes: SyncChange[]) => void
}

const TOKEN_KEY = 'worshipflow:token'
const SEQ_KEY = 'worshipflow:seq'
const PENDING_KEY = 'worshipflow:pending'

/** De quanto em quanto tempo perguntamos o que há de novo (ms). */
const POLL_INTERVAL = 4000

/** Quantas vezes tentamos antes de considerar "sem internet". */
const MAX_RETRIES = 3

let status: SyncStatus = {
  state: 'desligado',
  lastSyncAt: null,
  pending: 0,
  message: null,
  pristine: false,
}

let token: string | null = null
let seq = 0
let pending: SyncOp[] = []
let handlers: SyncHandlers | null = null
let timer: number | null = null
let running = false
let failures = 0

const listeners = new Set<() => void>()

/* ------------------------------- armazenamento ------------------------------ */

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* modo privado / cota cheia */
  }
}

/* --------------------------------- status --------------------------------- */

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getStatus() {
  return status
}

/** Status da sincronização (para mostrar na tela). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus)
}

/* --------------------------------- requisição ------------------------------- */

class SyncError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new SyncError(data?.error ?? 'Não foi possível falar com o servidor.', response.status)
  }
  return data
}

/* ---------------------------------- login ---------------------------------- */

/**
 * Pede um token ao servidor para o e-mail informado.
 *
 * Devolve { ok: false, offline: true } quando o servidor não pode ser
 * alcançado (aí o app entra no modo local) e { ok: false } quando o
 * servidor recusou o e-mail.
 */
export async function syncLogin(email: string): Promise<{
  ok: boolean
  error?: string
  offline?: boolean
  user?: { id: string; name: string; email: string; category: Member['category'] }
}> {
  try {
    const data = await request<{
      token: string
      user?: { id: string; name: string; email: string; category: Member['category'] }
    }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    token = data.token
    writeStored(TOKEN_KEY, token)
    seq = 0
    writeStored(SEQ_KEY, 0)
    setStatus({ state: 'conectando', message: null, pristine: false })
    start()
    return { ok: true, user: data.user }
  } catch (error) {
    if (error instanceof SyncError) return { ok: false, error: error.message }
    return {
      ok: false,
      offline: true,
      error: 'Sem conexão com o servidor. Os dados ficarão só neste aparelho.',
    }
  }
}

/** Sai da sincronização (mantém os dados locais). */
export function syncLogout() {
  stop()
  token = null
  seq = 0
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(SEQ_KEY)
  } catch {
    /* ignore */
  }
  setStatus({ state: 'desligado', lastSyncAt: null, message: null, pristine: false })
}

/* ------------------------------ pulls e pushes ------------------------------ */

/** Busca as novidades do servidor. */
async function pull(): Promise<void> {
  if (!token) return

  const data = await request<{
    seq: number
    state?: AppData
    changes?: SyncChange[]
    pristine?: boolean
  }>(`/sync?since=${seq}`)

  if (data.state) {
    seq = data.seq
    writeStored(SEQ_KEY, seq)
    handlers?.onSnapshot(normalizeData(data.state), Boolean(data.pristine))
    return
  }

  const changes = Array.isArray(data.changes) ? data.changes : []
  if (changes.length) {
    seq = data.seq
    writeStored(SEQ_KEY, seq)
    handlers?.onChanges(changes)
  } else {
    seq = Math.max(seq, data.seq ?? seq)
  }
}

/** Envia a fila de alterações para o servidor. */
async function flush(): Promise<void> {
  if (!token || pending.length === 0) return

  const ops = pending
  const data = await request<{ seq: number }>('/sync', {
    method: 'POST',
    body: JSON.stringify({ ops }),
  })

  pending = pending.slice(ops.length)
  writeStored(PENDING_KEY, pending)
  if (typeof data.seq === 'number') {
    seq = Math.max(seq, data.seq)
    writeStored(SEQ_KEY, seq)
  }
  setStatus({ pending: pending.length })
}

/** Roda uma rodada: traz novidades e manda o que está pendente. */
async function tick() {
  if (!token || running) return
  running = true

  try {
    // envia primeiro o que está pendente (para não perder alteração feita
    // offline) e só depois busca o que há de novo
    await flush()
    await pull()
    failures = 0
    setStatus({
      state: 'sincronizado',
      lastSyncAt: Date.now(),
      message: null,
      pending: pending.length,
    })
  } catch (error) {
    failures += 1
    const expired = error instanceof SyncError && error.status === 401
    setStatus({
      state: expired ? 'erro' : failures >= MAX_RETRIES ? 'erro' : 'conectando',
      message: error instanceof Error ? error.message : 'Erro ao sincronizar.',
      pending: pending.length,
    })
  } finally {
    running = false
  }
}

/* --------------------------------- fila ---------------------------------- */

/** Coloca operações na fila (chamado a cada alteração no app). */
export function queueOps(ops: SyncOp[]) {
  if (ops.length === 0) return
  pending = [...pending, ...ops]
  writeStored(PENDING_KEY, pending)
  setStatus({ pending: pending.length })
  void tick()
}

/** Envia o estado inteiro deste aparelho (botão do ministro). */
export function queueFullState(data: AppData) {
  queueOps([{ op: 'reset', payload: data }])
}

/* --------------------------------- ciclo ---------------------------------- */

function start() {
  if (typeof window === 'undefined') return
  if (timer === null) {
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void tick()
    }, POLL_INTERVAL)
  }
  void tick()
}

function stop() {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/** Liga o motor ao app (chamado pelo DataProvider). */
export function attachSync(next: SyncHandlers) {
  handlers = next
}

/** Já existe token salvo neste aparelho? */
export function hasToken(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(TOKEN_KEY))
}

/** Retoma a sincronização com o token já salvo (ao abrir o app). */
export function resumeSync() {
  if (typeof window === 'undefined') return
  const stored = readStored<string | null>(TOKEN_KEY, null)
  if (!stored) return
  token = stored
  seq = readStored<number>(SEQ_KEY, 0)
  pending = readStored<SyncOp[]>(PENDING_KEY, [])
  setStatus({ pending: pending.length, state: 'conectando' })
  start()
}

/** Erro de sessão expirada (a tela de login usa para avisar). */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof SyncError && error.status === 401
}

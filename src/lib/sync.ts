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
import { apiUrl } from './api'
import { intervaloAgora, marcarAtividade, observarAtividade, vigiarAtividade } from './poll'

export type SyncState =
  | 'desligado'
  | 'conectando'
  | 'sincronizado'
  | 'sem_conexao'
  | 'sem_acesso'
  | 'erro'

/** Motivo pelo qual o login foi recusado pelo servidor. */
export type LoginFailure = 'desconhecido' | 'inativo' | 'sem_conexao' | 'erro'

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

/**
 * De quanto em quanto tempo perguntamos o que há de novo **enquanto o app está
 * em uso** (ms). Parado ou em segundo plano o ritmo cai (ver `src/lib/poll.ts`):
 * cada pergunta acorda o banco e queima cota do Neon.
 */
const POLL_INTERVAL = 4000

/** Quantas vezes tentamos antes de considerar "sem internet". */
const MAX_RETRIES = 3

/** Espera máxima entre duas tentativas depois de um erro (ms). */
const MAX_ATRASO_REDE = 60000
const MAX_ATRASO_SERVIDOR = 300000

let status: SyncStatus = {
  // começa "conectando": assim que o app abre, o selo já mostra que ele está
  // tentando falar com o servidor (e não um "Só neste aparelho" que assusta)
  state: 'conectando',
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
/** O motor está ligado? */
let ligado = false
/** Desliga os ouvintes de tela/atividade. */
let desmontar: (() => void) | null = null
/** Espera extra depois de um erro — evita martelar o servidor. */
let atrasoErro = 0

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
  const response = await fetch(apiUrl(`/api${path}`), {
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
 * Pede um token ao servidor para o celular informado.
 *
 * Devolve { ok: false, reason: 'sem_conexao' } quando o servidor não pode
 * ser alcançado (aí o app entra no modo local) e { ok: false } com o
 * motivo (`desconhecido`, `inativo` ou `erro`) quando o servidor recusou
 * o celular.
 */
export async function syncLogin(phone: string): Promise<{
  ok: boolean
  error?: string
  offline?: boolean
  reason?: LoginFailure
  user?: { id: string; name: string; phone: string; category: Member['category'] }
}> {
  try {
    const data = await request<{
      token: string
      user?: { id: string; name: string; phone: string; category: Member['category'] }
    }>('/login', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
    token = data.token
    writeStored(TOKEN_KEY, token)
    seq = 0
    writeStored(SEQ_KEY, 0)
    setStatus({ state: 'conectando', message: null, pristine: false })
    start()
    return { ok: true, user: data.user }
  } catch (error) {
    if (error instanceof SyncError) {
      const reason: LoginFailure =
        error.status === 404
          ? 'desconhecido'
          : error.status === 403
            ? 'inativo'
            : 'erro'
      return { ok: false, error: error.message, reason }
    }
    return {
      ok: false,
      offline: true,
      reason: 'sem_conexao',
      error: 'Sem conexão com o servidor. Os dados ficarão só neste aparelho.',
    }
  }
}

/** Token da sessão (usado para enviar MP3 e falar com a API). */
export function syncToken(): string | null {
  return token
}

/** Sai da sincronização (mantém os dados locais). */
export function syncLogout() {  stop()
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
    atrasoErro = 0
    setStatus({
      state: 'sincronizado',
      lastSyncAt: Date.now(),
      message: null,
      pending: pending.length,
    })
  } catch (error) {
    failures += 1
    const statusCode = error instanceof SyncError ? error.status : 0
    const mensagem = error instanceof Error ? error.message : 'Erro ao sincronizar.'

    if (statusCode === 401) {
      // a sessão não vale mais: o e-mail saiu da lista da equipe (ou o token
      // venceu). O app avisa e leva a pessoa para a tela de login.
      stop()
      token = null
      seq = 0
      try {
        window.localStorage.removeItem(TOKEN_KEY)
        window.localStorage.removeItem(SEQ_KEY)
      } catch {
        /* ignore */
      }
      setStatus({
        state: 'sem_acesso',
        lastSyncAt: null,
        message: mensagem,
        pending: pending.length,
      })
      return
    }

    if (statusCode === 403) {
      // o servidor recusou a alteração (permissão): não adianta reenviar a
      // mesma fila para sempre — ela fica guardada no aparelho.
      pending = []
      writeStored(PENDING_KEY, pending)
      atrasoErro = 0
      setStatus({ state: 'erro', message: mensagem, pending: 0 })
      return
    }

    if (statusCode === 409) {
      // o servidor recusou substituir o estado inteiro (o da equipe já vale):
      // tira da fila essa operação e segue com as demais
      pending = pending.filter((op) => op.op !== 'reset')
      writeStored(PENDING_KEY, pending)
      atrasoErro = 0
      setStatus({ state: 'erro', message: mensagem, pending: pending.length })
      return
    }

    // erro de rede (fetch quebrou) = sem internet; resposta HTTP = erro do servidor
    const semConexao = !(error instanceof SyncError)

    // não martela o servidor: depois de um erro a espera dobra (até o limite).
    // Erro do servidor (5xx) é o caso grave — cada tentativa acorda o banco.
    const limite = semConexao ? MAX_ATRASO_REDE : MAX_ATRASO_SERVIDOR
    atrasoErro = Math.min(atrasoErro ? atrasoErro * 2 : 15000, limite)

    setStatus({
      state: semConexao
        ? failures >= MAX_RETRIES
          ? 'sem_conexao'
          : 'conectando'
        : 'erro',
      message: semConexao
        ? 'Sem conexão com o servidor. As alterações ficam guardadas neste aparelho e vão assim que a internet voltar.'
        : mensagem,
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
  // o app está em uso: acelera o ritmo das consultas por um tempo
  marcarAtividade()
  void tick()
}

/**
 * Marca que o aparelho está sem conexão com o servidor (entrou offline).
 * O app mostra um aviso explaining que as alterações ficam guardadas aqui e
 * vão assim que a internet voltar.
 */
export function markOffline(message?: string) {
  setStatus({
    state: 'sem_conexao',
    message:
      message ??
      'Sem conexão com o servidor. As alterações ficam guardadas neste aparelho e vão assim que a internet voltar.',
  })
}

/**
 * Marca que o servidor respondeu, mas com erro (5xx, banco fora do ar, cota
 * do Neon esgotada). Não é falta de internet — a distinction importa para o
 * aviso que o usuário vê na tela.
 */
export function markServerError(message?: string) {
  setStatus({
    state: 'erro',
    message:
      message ??
      'O servidor está com problema agora. As alterações ficam guardadas neste aparelho e vão assim que ele voltar.',
  })
}

/**
 * Envia o estado inteiro deste aparelho.
 *
 * Só é usado na **primeira configuração** (quando o servidor ainda tem
 * somente os dados de exemplo). Depois disso o envio é por diferenças, para
 * nunca sobrescrever o trabalho de outro aparelho.
 */
export function queueFullState(data: AppData) {
  queueOps([{ op: 'reset', payload: data }])
}

/* --------------------------------- ciclo ---------------------------------- */

/**
 * Agenda a próxima rodada.
 *
 * O ritmo se ajusta ao uso: rápido enquanto a pessoa mexe no app, mais
 * devagar com o app parado e bem devagar em segundo plano (para o banco
 * poder suspender e não queimar cota).
 */
function agendar() {
  if (!ligado || typeof window === 'undefined') return
  if (timer !== null) window.clearTimeout(timer)
  const espera = atrasoErro || intervaloAgora(POLL_INTERVAL)
  timer = window.setTimeout(async () => {
    timer = null
    await tick()
    agendar()
  }, espera)
}

/** A tela voltou a ficar visível (ou a pessoa mexeu): pergunta na hora. */
function acorda() {
  if (!ligado) return
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  void tick().finally(() => agendar())
}

function start() {
  if (typeof window === 'undefined' || ligado) return
  ligado = true

  const aoVoltar = () => {
    if (document.visibilityState !== 'visible') return
    marcarAtividade()
    acorda()
  }
  const aoMexer = () => acorda()
  const pararVigia = vigiarAtividade()
  const pararObservador = observarAtividade(aoMexer)

  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('focus', aoVoltar)

  desmontar = () => {
    document.removeEventListener('visibilitychange', aoVoltar)
    window.removeEventListener('focus', aoVoltar)
    pararVigia()
    pararObservador()
  }

  void tick().finally(() => agendar())
}

function stop() {
  ligado = false
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  if (desmontar) {
    desmontar()
    desmontar = null
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

/**
 * Regras da sincronização (usadas pelas functions da Vercel e pelo servidor
 * local de desenvolvimento).
 *
 * Protocolo:
 *  - POST /api/login  { email }  -> { token, user, role }
 *  - GET  /api/sync?since=N        -> { seq, changes } ou { seq, state }
 *  - POST /api/sync  { ops: [...] } -> { seq, changes }
 */

import type { AppData, SyncChange, SyncOp } from '../../src/lib/syncState.ts'
import { findMemberByEmail, stateFromChanges } from '../../src/lib/syncState.ts'
import { getSecret, signToken, verifyToken } from './auth.ts'
import type { Store } from './store.ts'

export type Role = 'admin' | 'member'

export interface ApiResult {
  status: number
  body: Record<string, unknown>
}

/** Coleções que só o ministro (admin) pode mexer. */
const ADMIN_ONLY: Record<string, boolean> = {
  members: true,
  services: true,
  songs: true,
}

/** O log ainda é o inicial (seed)? Serve para o app oferecer a sincronização. */
function isPristine(changes: SyncChange[]): boolean {
  return changes.length === 1 && changes[0].op === 'reset' && changes[0].actor === 'seed'
}

function lastSeq(changes: SyncChange[]): number {
  return changes.length ? changes[changes.length - 1].seq : 0
}

/** Descobre quem está logado e qual o papel (admin ou membro da equipe). */
async function authenticate(
  store: Store,
  token: string | null,
): Promise<{ ok: true; email: string; role: Role } | { ok: false; result: ApiResult }> {
  const secret = await getSecret(store)
  const payload = verifyToken(secret, token)
  if (!payload) {
    return {
      ok: false,
      result: { status: 401, body: { error: 'Sessão inválida ou vencida. Entre novamente.' } },
    }
  }

  const members = stateFromChanges(await store.allChanges('members'))
  const member = findMemberByEmail(members, payload.email)
  if (!member || !member.active) {
    return {
      ok: false,
      result: { status: 401, body: { error: 'Conta não encontrada ou inativa.' } },
    }
  }

  return {
    ok: true,
    email: member.email,
    role: member.category === 'admin' ? 'admin' : 'member',
  }
}

/** POST /api/login — entra no app e devolve o token da sessão. */
export async function handleLogin(
  store: Store,
  body: { email?: string; password?: string } | null,
): Promise<ApiResult> {
  await store.ensure()

  const email = (body?.email ?? '').trim().toLowerCase()
  if (!email) return { status: 400, body: { error: 'Informe o e-mail.' } }

  const members = stateFromChanges(await store.allChanges('members'))
  const member = findMemberByEmail(members, email)
  if (!member) {
    return { status: 404, body: { error: 'Não encontramos uma conta com esse e-mail.' } }
  }
  if (!member.active) {
    return { status: 403, body: { error: 'Esta conta está inativa. Fale com o ministro.' } }
  }

  const secret = await getSecret(store)
  const token = signToken(secret, member.email)

  return {
    status: 200,
    body: {
      token,
      role: member.category === 'admin' ? 'admin' : 'member',
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        category: member.category,
      },
    },
  }
}

/** GET /api/sync — traz as novidades do servidor para este aparelho. */
export async function handlePull(store: Store, since: number, token: string | null): Promise<ApiResult> {
  await store.ensure()

  const auth = await authenticate(store, token)
  if (!auth.ok) return auth.result

  if (since <= 0) {
    const all = await store.allChanges()
    const state: AppData = stateFromChanges(all)
    return {
      status: 200,
      body: { seq: lastSeq(all), state, pristine: isPristine(all) },
    }
  }

  const changes = await store.changesSince(since)
  return {
    status: 200,
    body: {
      seq: changes.length ? changes[changes.length - 1].seq : since,
      changes,
    },
  }
}

/** POST /api/sync — envia as alterações deste aparelho para o servidor. */
export async function handlePush(
  store: Store,
  body: { ops?: SyncOp[] } | null,
  token: string | null,
): Promise<ApiResult> {
  await store.ensure()

  const auth = await authenticate(store, token)
  if (!auth.ok) return auth.result

  const ops = Array.isArray(body?.ops) ? body.ops.slice(0, 300) : []
  if (ops.length === 0) {
    return { status: 200, body: { seq: 0, changes: [] } }
  }

  for (const op of ops) {
    const collection = op.op === 'reset' ? 'all' : op.collection
    if (collection === 'all' || ADMIN_ONLY[collection]) {
      if (auth.role !== 'admin') {
        return {
          status: 403,
          body: { error: 'Só o ministro pode alterar a equipe e as escalas.' },
        }
      }
    }
  }

  const inserted = await store.append(ops, auth.email)
  return {
    status: 200,
    body: { seq: lastSeq(inserted), changes: inserted },
  }
}

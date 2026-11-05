/**
 * Regras da sincronização (usadas pelas functions da Vercel e pelo servidor
 * local de desenvolvimento).
 *
 * Protocolo:
 *  - POST /api/login  { phone }  -> { token, user, role }
 *  - GET  /api/sync?since=N        -> { seq, changes } ou { seq, state }
 *  - POST /api/sync  { ops: [...] } -> { seq, changes }
 */

import type { AppData, SyncChange, SyncOp } from '../../src/lib/syncState.ts'
import {
  findMemberByLegacyEmail,
  findMemberByPhone,
  itemId,
  stateFromChanges,
  upsertOp,
} from '../../src/lib/syncState.ts'
import type { Presence } from '../../src/lib/types.ts'
import { phoneKey } from '../../src/lib/phone.ts'
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
export async function authenticate(
  store: Store,
  token: string | null,
): Promise<{ ok: true; id: string; actor: string; role: Role } | { ok: false; result: ApiResult }> {
  const secret = await getSecret(store)
  const payload = verifyToken(secret, token)
  if (!payload) {
    return {
      ok: false,
      result: { status: 401, body: { error: 'Sessão inválida ou vencida. Entre novamente.' } },
    }
  }

  const estado = stateFromChanges(await store.allChanges('members'))
  // token novo: busca pelo id. Token antigo (login por e-mail): pelo e-mail.
  const member =
    (payload.id ? estado.members.find((m) => m.id === payload.id) : undefined) ??
    (payload.email ? findMemberByLegacyEmail(estado, payload.email) : undefined)

  if (!member || !member.active) {
    return {
      ok: false,
      result: {
        status: 401,
        body: { error: 'Conta não encontrada ou inativa na lista da equipe.' },
      },
    }
  }

  return {
    ok: true,
    id: member.id,
    actor: member.phone ?? member.id,
    role: member.category === 'admin' ? 'admin' : 'member',
  }
}

/** POST /api/login — entra no app e devolve o token da sessão. */
export async function handleLogin(
  store: Store,
  body: { phone?: string; password?: string; email?: string } | null,
): Promise<ApiResult> {
  await store.ensure()

  const telefone = phoneKey(body?.phone ?? '')
  // transição: versões antigas do app ainda mandavam o e-mail
  const emailAntigo = (body?.email ?? '').trim().toLowerCase()

  if (!telefone && !emailAntigo) {
    return { status: 400, body: { error: 'Informe o celular.' } }
  }

  const members = stateFromChanges(await store.allChanges('members'))
  const member = telefone
    ? findMemberByPhone(members, telefone)
    : findMemberByLegacyEmail(members, emailAntigo)

  if (!member) {
    return { status: 404, body: { error: 'Não encontramos uma conta com esse celular.' } }
  }
  if (!member.active) {
    return { status: 403, body: { error: 'Esta conta está inativa. Fale com o ministro.' } }
  }

  const secret = await getSecret(store)
  const token = signToken(secret, { id: member.id, phone: member.phone })

  return {
    status: 200,
    body: {
      token,
      role: member.category === 'admin' ? 'admin' : 'member',
      user: {
        id: member.id,
        name: member.name,
        phone: member.phone ?? '',
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

/**
 * GET /api/escala?id=svc_xxx — dados da escala para quem só vai **visualizar**
 * (sem login). É o link que o ministro manda no grupo da equipe.
 *
 * Não devolve e-mail, telefone nem confirmação de presença: só o que a
 * equipe precisa ver (quem está escalado e o repertório com letra/cifra).
 */
export async function handlePublicScale(store: Store, id: string): Promise<ApiResult> {
  await store.ensure()

  const scaleId = (id ?? '').trim()
  if (!scaleId) return { status: 400, body: { error: 'Informe a escala.' } }

  const state = stateFromChanges(await store.allChanges())
  const service = state.services.find((s) => s.id === scaleId)
  if (!service) return { status: 404, body: { error: 'Escala não encontrada.' } }

  const porId = new Map(state.members.map((member) => [member.id, member]))

  return {
    status: 200,
    body: {
      escala: {
        id: service.id,
        title: service.title,
        date: service.date,
        time: service.time,
        location: service.location ?? null,
        status: service.status,
        notes: service.notes ?? null,
        equipe: service.slots
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
        musicas: service.songs.map((song) => ({
          title: song.title,
          artist: song.artist ?? null,
          link: song.link ?? null,
          lyrics: song.lyrics ?? null,
          chords: song.chords ?? null,
          key: song.key ?? null,
          bpm: song.bpm ?? null,
          progression: song.progression ?? null,
          // o MP3 enviado pelo ministro (o arquivo fica guardado no servidor)
          audioId: song.audioId ?? null,
          audioName: song.audioName ?? null,
          audioSize: song.audioSize ?? null,
        })),
      },
    },
  }
}

/**
 * POST /api/escala?id=svc_xxx — resposta de presença vinda do link público.
 *
 * É por aqui que o músico avisa se vai estar no culto ("Vou participar" ou
 * "Não vou"). A resposta vira uma operação de presença no log, então chega
 * nos aparelhos dos ministros pela sincronização normal.
 *
 * O link é público, então o servidor confere se a pessoa está de fato na
 * escala e se o nome digitado bate com o cadastro.
 */
export async function handlePublicResponse(
  store: Store,
  id: string,
  body: { memberId?: string; nome?: string; confirmado?: boolean } | null,
): Promise<ApiResult> {
  await store.ensure()

  const scaleId = (id ?? '').trim()
  if (!scaleId) return { status: 400, body: { error: 'Informe a escala.' } }

  const memberId = (body?.memberId ?? '').trim()
  const nome = (body?.nome ?? '').trim().toLowerCase()
  if (!memberId || !nome) {
    return { status: 400, body: { error: 'Digite seu nome para enviar a resposta.' } }
  }

  const state = stateFromChanges(await store.allChanges())
  const service = state.services.find((s) => s.id === scaleId)
  if (!service) return { status: 404, body: { error: 'Escala não encontrada.' } }

  const naEscala = service.slots.some((slot) => slot.memberId === memberId)
  if (!naEscala) {
    return { status: 403, body: { error: 'Você não está na lista desta escala.' } }
  }

  const member = state.members.find((m) => m.id === memberId)
  if (!member || member.name.trim().toLowerCase() !== nome) {
    return {
      status: 403,
      body: { error: 'O nome não bate com a escala. Digite seu nome como está na lista.' },
    }
  }

  const presence: Presence = {
    memberId,
    serviceId: scaleId,
    confirmed: body?.confirmado !== false,
    respondedAt: new Date().toISOString(),
  }

  await store.append([upsertOp('presence', presence)], `publico:${memberId}`)

  return {
    status: 200,
    body: {
      ok: true,
      confirmado: presence.confirmed,
      respondedAt: presence.respondedAt,
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

  // Um "reset" substitui o estado inteiro do servidor. Só é aceito enquanto o
  // log for o do seed (primeira configuração) — depois disso, qualquer aparelho
  // poderia apagar o trabalho da equipe. Para mandar dados de outro aparelho,
  // o app envia só as diferenças (upsert/delete do que mudou).
  if (ops.some((op) => op.op === 'reset')) {
    const all = await store.allChanges()
    if (!isPristine(all)) {
      return {
        status: 409,
        body: {
          error:
            'O servidor já tem os dados da equipe. Envie apenas as diferenças — o trabalho de outros aparelhos não pode ser apagado.',
        },
      }
    }
  }

  // Envio por diferenças: a operação só entra se o item ainda NÃO existir no
  // servidor. Assim, um aparelho com uma cópia antiga não sobrescreve a
  // versão mais nova que outro aparelho gravou.
  const soSeFalta = ops.filter(
    (op): op is Extract<SyncOp, { op: 'upsert' }> =>
      op.op === 'upsert' && op.onlyIfMissing === true,
  )
  if (soSeFalta.length) {
    const jaExiste = new Set<string>()
    const colecoes = [...new Set(soSeFalta.map((op) => op.collection))]
    for (const collection of colecoes) {
      const estado = stateFromChanges(await store.allChanges(collection))
      const lista = estado[collection] as unknown[]
      for (const item of lista) jaExiste.add(itemId(collection, item))
    }
    const filtradas = ops.filter(
      (op) => !(op.op === 'upsert' && op.onlyIfMissing === true && jaExiste.has(op.id)),
    )
    if (filtradas.length === 0) {
      return { status: 200, body: { seq: lastSeq(await store.allChanges()), changes: [] } }
    }
    ops.splice(0, ops.length, ...filtradas)
  }

  const inserted = await store.append(ops, auth.actor)
  return {
    status: 200,
    body: { seq: lastSeq(inserted), changes: inserted },
  }
}

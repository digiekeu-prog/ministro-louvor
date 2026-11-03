/**
 * Sessão simples da equipe: token assinado (HMAC) com o e-mail de quem entrou.
 *
 * O segredo fica no próprio banco (tabela wf_meta), então não precisa de
 * variável de ambiente extra e continua válido depois de um novo deploy.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Store } from './store.ts'

/** Duração do token: 30 dias. */
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30

export interface TokenPayload {
  email: string
  exp: number
}

/** Lê (ou cria) o segredo do servidor. */
export async function getSecret(store: Store): Promise<string> {
  const existing = await store.meta('secret')
  if (existing) return existing
  const secret = randomBytes(32).toString('hex')
  await store.setMeta('secret', secret)
  return (await store.meta('secret')) ?? secret
}

/** Gera um token para o e-mail informado. */
export function signToken(secret: string, email: string): string {
  const payload: TokenPayload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + TOKEN_TTL,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

/** Confere o token; devolve null se estiver forjado ou vencido. */
export function verifyToken(
  secret: string,
  token: string | null | undefined,
): TokenPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [body, signature] = parts
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const given = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
    if (typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

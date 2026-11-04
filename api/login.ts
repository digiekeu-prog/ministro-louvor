/**
 * POST /api/login
 *
 * Confere o e-mail contra a lista de membros que está no banco compartilhado
 * e devolve um token de sessão (assinado no servidor).
 */

import { handleLogin } from './_lib/app.ts'
import { applyCors, fail, readBody } from './_lib/http.ts'
import type { ApiRequest, ApiResponse } from './_lib/http.ts'
import { createPostgresStore } from './_lib/postgres.ts'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res)) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' })
    return
  }

  try {
    const body = await readBody<{ email?: string; password?: string }>(req)
    const result = await handleLogin(createPostgresStore(), body)
    res.setHeader('Cache-Control', 'no-store')
    res.status(result.status).json(result.body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    console.error('[api/login]', message)
    fail(res, 'Não foi possível entrar no momento. Tente novamente.')
  }
}

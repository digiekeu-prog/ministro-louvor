/**
 * POST /api/login
 *
 * Confere o **celular** contra a lista de membros que está no banco
 * compartilhado e devolve um token de sessão (assinado no servidor).
 */

import { handleLogin } from './_lib/app.ts'
import { applyCors, fail, failQuota, isQuotaError, readBody } from './_lib/http.ts'
import type { ApiRequest, ApiResponse } from './_lib/http.ts'
import { createPostgresStore } from './_lib/postgres.ts'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res)) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' })
    return
  }

  try {
    const body = await readBody<{ phone?: string; password?: string; email?: string }>(req)
    const result = await handleLogin(createPostgresStore(), body)
    res.setHeader('Cache-Control', 'no-store')
    res.status(result.status).json(result.body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    console.error('[api/login]', message)
    // banco sem cota (plano do Neon): o app precisa saber que é isso
    if (isQuotaError(error)) {
      failQuota(res)
      return
    }
    fail(res, 'Não foi possível entrar no momento. Tente novamente.')
  }
}

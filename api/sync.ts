/**
 * GET  /api/sync?since=N  -> novidades do servidor (ou o estado completo)
 * POST /api/sync           -> envia as alterações deste aparelho
 */

import { handlePull, handlePush } from './_lib/app.ts'
import {
  applyCors,
  bearerToken,
  fail,
  failQuota,
  isQuotaError,
  queryValue,
  readBody,
} from './_lib/http.ts'
import type { ApiRequest, ApiResponse } from './_lib/http.ts'
import { createPostgresStore } from './_lib/postgres.ts'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res)) return

  const store = createPostgresStore()
  const token = bearerToken(req)
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') {
      const since = Number(queryValue(req, 'since') ?? '0')
      const result = await handlePull(store, Number.isFinite(since) ? since : 0, token)
      res.status(result.status).json(result.body)
      return
    }

    if (req.method === 'POST') {
      const body = await readBody<{ ops?: unknown }>(req)
      const result = await handlePush(store, body as { ops?: never } | null, token)
      res.status(result.status).json(result.body)
      return
    }

    res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    console.error('[api/sync]', message)
    // banco sem cota (plano do Neon): o app precisa saber que é isso
    if (isQuotaError(error)) {
      failQuota(res)
      return
    }
    fail(res, 'Não foi possível sincronizar com o servidor. Tente novamente.')
  }
}

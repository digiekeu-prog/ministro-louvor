/**
 * GET  /api/escala?id=svc_xxx -> dados da escala (link público)
 * POST /api/escala?id=svc_xxx -> resposta de presença ("vou participar")
 *
 * Dados da escala para quem só vai **visualizar** (sem login): é o link que
 * o ministro manda no grupo da equipe depois de salvar a escala.
 *
 * Devolve só o que a equipe precisa ver — quem está escalado e o repertório
 * com letra/cifra. E-mail, telefone e presença não são expostos.
 */

import { handlePublicResponse, handlePublicScale } from './_lib/app.ts'
import { applyCors, fail, queryValue, readBody } from './_lib/http.ts'
import type { ApiRequest, ApiResponse } from './_lib/http.ts'
import { createPostgresStore } from './_lib/postgres.ts'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res)) return

  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') {
      const result = await handlePublicScale(createPostgresStore(), queryValue(req, 'id') ?? '')
      res.status(result.status).json(result.body)
      return
    }

    if (req.method === 'POST') {
      const body = await readBody<{ memberId?: string; nome?: string; confirmado?: boolean }>(req)
      const result = await handlePublicResponse(
        createPostgresStore(),
        queryValue(req, 'id') ?? '',
        body,
      )
      res.status(result.status).json(result.body)
      return
    }

    res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    console.error('[api/escala]', message)
    fail(res, 'Não foi possível carregar a escala. Tente novamente.')
  }
}

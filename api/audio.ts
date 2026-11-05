/**
 * /api/audio — os MP3 do repertório.
 *
 *   POST   /api/audio            -> envia uma parte do arquivo (só ministro)
 *   GET    /api/audio?id=aud_xxx -> entrega o arquivo para tocar (público)
 *   DELETE /api/audio?id=aud_xxx -> apaga o arquivo (só ministro)
 *
 * O envio vem em partes porque a function da Vercel aceita no máximo ~4,5 MB
 * por requisição. O GET aceita `Range`, para o player poder pular para outro
 * ponto da música.
 */

import {
  handleAudioDelete,
  handleAudioGet,
  handleAudioUpload,
} from './_lib/audio.ts'
import type { AudioUploadBody } from './_lib/audio.ts'
import { authenticate } from './_lib/app.ts'
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
import { createPostgresAudioStore, createPostgresStore } from './_lib/postgres.ts'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res)) return

  const audio = createPostgresAudioStore()
  const token = bearerToken(req)

  try {
    /* ------------------------------- tocar -------------------------------- */
    if (req.method === 'GET') {
      const headers = req.headers ?? {}
      const rawRange = headers.range ?? headers.Range
      const range = Array.isArray(rawRange) ? rawRange[0] : rawRange

      const result = await handleAudioGet(audio, queryValue(req, 'id') ?? '', range)
      if (!result) {
        res.status(404).json({ error: 'Áudio não encontrado.' })
        return
      }

      for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value)
      res.status(result.status)
      res.end?.(result.body)
      return
    }

    /* ------------------------------ enviar -------------------------------- */
    if (req.method === 'POST') {
      const store = createPostgresStore()
      await store.ensure()
      const auth = await authenticate(store, token)
      if (!auth.ok) {
        res.status(auth.result.status).json(auth.result.body)
        return
      }

      const body = await readBody<AudioUploadBody>(req)
      const result = await handleAudioUpload(audio, body, auth.role === 'admin')
      res.status(result.status).json(result.body)
      return
    }

    /* ------------------------------- apagar ------------------------------- */
    if (req.method === 'DELETE') {
      const store = createPostgresStore()
      await store.ensure()
      const auth = await authenticate(store, token)
      if (!auth.ok) {
        res.status(auth.result.status).json(auth.result.body)
        return
      }

      const result = await handleAudioDelete(
        audio,
        queryValue(req, 'id') ?? '',
        auth.role === 'admin',
      )
      res.status(result.status).json(result.body)
      return
    }

    res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    console.error('[api/audio]', message)
    // banco sem cota (plano do Neon): o app precisa saber que é isso
    if (isQuotaError(error)) {
      failQuota(res)
      return
    }
    fail(res, 'Não foi possível lidar com o áudio. Tente novamente.')
  }
}

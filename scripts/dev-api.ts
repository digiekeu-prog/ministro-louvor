/**
 * Servidor da API para desenvolvimento local.
 *
 *   npm run dev:api
 *
 * Fala o mesmo protocolo das functions da Vercel, mas guarda tudo em um
 * arquivo JSON — assim dá para testar a sincronização entre duas abas do
 * navegador sem mexer no banco de verdade.
 */

import { createServer } from 'node:http'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { handleAudioDelete, handleAudioGet, handleAudioUpload } from '../api/_lib/audio.ts'
import type { AudioMeta, AudioStore, AudioUploadBody } from '../api/_lib/audio.ts'
import {
  authenticate,
  handleLogin,
  handlePull,
  handlePublicResponse,
  handlePublicScale,
  handlePush,
} from '../api/_lib/app.ts'
import type { Store } from '../api/_lib/store.ts'
import type { Collection, SyncChange, SyncOp } from '../src/lib/syncState.ts'
import { seedMembers, seedPresence, seedServices, seedSongs } from '../src/lib/seed.ts'

const PORTA = Number(process.env.PORT ?? 8787)
const ARQUIVO = resolve(process.cwd(), '.dev-data/sync.json')
const PASTA_AUDIO = resolve(process.cwd(), '.dev-data/audio')

interface Arquivo {
  seq: number
  changes: SyncChange[]
  meta: Record<string, string>
}

let dados: Arquivo = { seq: 0, changes: [], meta: {} }

async function carregar() {
  try {
    const raw = await readFile(ARQUIVO, 'utf8')
    dados = JSON.parse(raw) as Arquivo
  } catch {
    // primeira execução: começa com os dados de exemplo (como no servidor)
    dados = { seq: 0, changes: [], meta: {} }
    await store.append(
      [
        {
          op: 'reset',
          payload: {
            members: seedMembers,
            services: seedServices,
            songs: seedSongs,
            presence: seedPresence,
          },
        },
      ],
      'seed',
    )
  }
}

async function salvar() {
  await mkdir(dirname(ARQUIVO), { recursive: true })
  await writeFile(ARQUIVO, JSON.stringify(dados, null, 2), 'utf8')
}

const store: Store = {
  async ensure() {
    await carregar()
  },
  async allChanges(collection?: Collection) {
    if (collection) {
      return dados.changes.filter((c) => c.collection === collection || c.op === 'reset')
    }
    return dados.changes
  },
  async changesSince(seq: number, limit = 500) {
    return dados.changes.filter((c) => c.seq > seq).slice(0, limit)
  },
  async append(ops: SyncOp[], actor: string | null) {
    const inserted: SyncChange[] = []
    for (const op of ops) {
      dados.seq += 1
      const change: SyncChange = {
        seq: dados.seq,
        op: op.op,
        collection: op.op === 'reset' ? 'all' : op.collection,
        itemId: op.op === 'reset' ? null : op.id,
        payload: op.op === 'delete' ? null : op.payload,
        actor,
        createdAt: new Date().toISOString(),
      }
      dados.changes.push(change)
      inserted.push(change)
    }
    await salvar()
    return inserted
  },
  async meta(key: string) {
    return dados.meta[key] ?? null
  },
  async setMeta(key: string, value: string) {
    dados.meta[key] = value
    await salvar()
  },
}

await carregar()

/**
 * Os MP3 do repertório ficam em arquivos na pasta `.dev-data/audio`
 * (na nuvem eles vão para o Postgres).
 */
const audioStore: AudioStore = {
  async saveChunk(uploadId: string, parte: number, bytes: Buffer) {
    const pasta = resolve(PASTA_AUDIO, 'tmp')
    await mkdir(pasta, { recursive: true })
    await writeFile(resolve(pasta, `${uploadId}.${parte}`), bytes)
  },
  async readChunks(uploadId: string, total: number) {
    const pasta = resolve(PASTA_AUDIO, 'tmp')
    const partes: Buffer[] = []
    for (let parte = 0; parte < total; parte++) {
      partes.push(await readFile(resolve(pasta, `${uploadId}.${parte}`)))
    }
    return partes
  },
  async clearChunks(uploadId: string) {
    const pasta = resolve(PASTA_AUDIO, 'tmp')
    const arquivos = await readdir(pasta).catch(() => [] as string[])
    await Promise.all(
      arquivos
        .filter((nome) => nome.startsWith(`${uploadId}.`))
        .map((nome) => rm(resolve(pasta, nome), { force: true })),
    )
  },
  async save(meta: AudioMeta, bytes: Buffer) {
    await mkdir(PASTA_AUDIO, { recursive: true })
    await writeFile(resolve(PASTA_AUDIO, `${meta.id}.bin`), bytes)
    await writeFile(resolve(PASTA_AUDIO, `${meta.id}.json`), JSON.stringify(meta), 'utf8')
  },
  async read(id: string) {
    try {
      const bytes = await readFile(resolve(PASTA_AUDIO, `${id}.bin`))
      const meta = JSON.parse(
        await readFile(resolve(PASTA_AUDIO, `${id}.json`), 'utf8'),
      ) as AudioMeta
      return { meta, bytes }
    } catch {
      return null
    }
  },
  async remove(id: string) {
    await rm(resolve(PASTA_AUDIO, `${id}.bin`), { force: true })
    await rm(resolve(PASTA_AUDIO, `${id}.json`), { force: true })
  },
}

function tokenDoRequisicao(req: import('node:http').IncomingMessage): string | null {
  const raw = req.headers.authorization
  if (!raw) return null
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim())
  return match ? match[1].trim() : null
}

async function corpo(req: import('node:http').IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = []
  for await (const parte of req) partes.push(parte as Buffer)
  if (!partes.length) return null
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'))
  } catch {
    return null
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  // CORS: deixa outro domínio (ex.: preview do Lovable) falar com a API local
  const origin = req.headers.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const result = await handleLogin(
        store,
        (await corpo(req)) as { phone?: string; password?: string; email?: string } | null,
      )
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    if (url.pathname === '/api/escala' && req.method === 'GET') {
      const result = await handlePublicScale(store, url.searchParams.get('id') ?? '')
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    if (url.pathname === '/api/escala' && req.method === 'POST') {
      const body = (await corpo(req)) as {
        memberId?: string
        nome?: string
        confirmado?: boolean
      } | null
      const result = await handlePublicResponse(
        store,
        url.searchParams.get('id') ?? '',
        body,
      )
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    if (url.pathname === '/api/sync' && req.method === 'GET') {
      const since = Number(url.searchParams.get('since') ?? '0')
      const result = await handlePull(store, Number.isFinite(since) ? since : 0, tokenDoRequisicao(req))
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const body = (await corpo(req)) as { ops?: SyncOp[] } | null
      const result = await handlePush(store, body, tokenDoRequisicao(req))
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    /* ------------------------------ áudio (MP3) ------------------------------ */
    if (url.pathname === '/api/audio' && req.method === 'POST') {
      const auth = await authenticate(store, tokenDoRequisicao(req))
      if (!auth.ok) {
        res.statusCode = auth.result.status
        res.end(JSON.stringify(auth.result.body))
        return
      }
      const body = (await corpo(req)) as AudioUploadBody | null
      const result = await handleAudioUpload(audioStore, body, auth.role === 'admin')
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    if (url.pathname === '/api/audio' && req.method === 'DELETE') {
      const auth = await authenticate(store, tokenDoRequisicao(req))
      if (!auth.ok) {
        res.statusCode = auth.result.status
        res.end(JSON.stringify(auth.result.body))
        return
      }
      const result = await handleAudioDelete(
        audioStore,
        url.searchParams.get('id') ?? '',
        auth.role === 'admin',
      )
      res.statusCode = result.status
      res.end(JSON.stringify(result.body))
      return
    }

    if (url.pathname === '/api/audio' && req.method === 'GET') {
      const range = req.headers.range
      const result = await handleAudioGet(audioStore, url.searchParams.get('id') ?? '', range)
      if (!result) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Áudio não encontrado.' }))
        return
      }
      for (const [nome, valor] of Object.entries(result.headers)) res.setHeader(nome, valor)
      res.statusCode = result.status
      res.end(result.body)
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: 'Rota não encontrada.' }))
  } catch (error) {
    console.error('[dev-api]', error)
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'Erro no servidor local.' }))
  }
})

servidor.listen(PORTA, () => {
  console.log(`API local de desenvolvimento em http://localhost:${PORTA}/api`)
})

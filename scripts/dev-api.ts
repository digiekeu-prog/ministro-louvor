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
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { handleLogin, handlePull, handlePush } from '../api/_lib/app.ts'
import type { Store } from '../api/_lib/store.ts'
import type { Collection, SyncChange, SyncOp } from '../src/lib/syncState.ts'
import { seedMembers, seedPresence, seedServices, seedSongs } from '../src/lib/seed.ts'

const PORTA = Number(process.env.PORT ?? 8787)
const ARQUIVO = resolve(process.cwd(), '.dev-data/sync.json')

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

  try {
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const result = await handleLogin(store, (await corpo(req)) as { email?: string } | null)
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

/**
 * Acesso ao banco (Postgres do Neon) e ao "log" de operações.
 *
 * O log é a fonte da verdade: cada linha é uma operação (upsert/delete/reset).
 * Como só acrescentamos linhas (nunca reescrevemos), dois aparelhos que
 * editam ao mesmo tempo não se sobrescrevem — todo mundo replaya o log e
 * chega ao mesmo estado.
 */

import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

/** Cliente do Neon (modo linhas, sem resultados completos). */
type Sql = NeonQueryFunction<false, false>
import type { Collection, SyncChange, SyncOp } from '../../src/lib/syncState.ts'
import type { Store } from './store.ts'

let cachedSql: Sql | null = null

/** Monta a string de conexão a partir das variáveis que a Vercel injeta. */
function connectionString(): string {
  const direct =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_UNPOOLED
  if (direct) return direct

  const host = process.env.PGHOST
  const user = process.env.PGUSER
  const password = process.env.PGPASSWORD
  const database = process.env.PGDATABASE
  if (!host || !user || !password || !database) {
    throw new Error(
      'Banco de dados não configurado: faltam DATABASE_URL (ou PGHOST/PGUSER/PGPASSWORD/PGDATABASE).',
    )
  }

  const port = process.env.PGPORT || '5432'
  const sslmode = process.env.PGSSLMODE || 'require'
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=${sslmode}`
}

export function getSql(): Sql {
  if (!cachedSql) cachedSql = neon(connectionString())
  return cachedSql
}

type Row = {
  seq: number | string
  op: string
  collection: string
  item_id: string | null
  payload: unknown
  actor: string | null
  created_at: Date | string
}

function toChange(row: Row): SyncChange {
  return {
    seq: Number(row.seq),
    op: row.op as SyncChange['op'],
    collection: row.collection as Collection | 'all',
    itemId: row.item_id,
    payload: row.payload,
    actor: row.actor,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

/** Cria as tabelas (idempotente) — roda sozinho no primeiro acesso. */
export async function ensureSchema(sql: Sql): Promise<void> {
  await sql`
    create table if not exists wf_changes (
      seq bigserial primary key,
      op text not null,
      collection text not null,
      item_id text,
      payload jsonb,
      actor text,
      created_at timestamptz not null default now()
    )
  `
  await sql`
    create table if not exists wf_meta (
      key text primary key,
      value text not null
    )
  `
}

/** Lê o log inteiro (usado para reconstruir o estado e validar o login). */
export async function readAll(sql: Sql, collection?: Collection): Promise<SyncChange[]> {
  const rows = collection
    ? await sql`select seq, op, collection, item_id, payload, actor, created_at
                 from wf_changes
                 where collection = ${collection} or op = 'reset'
                 order by seq asc limit 20000`
    : await sql`select seq, op, collection, item_id, payload, actor, created_at
                 from wf_changes order by seq asc limit 20000`
  return (rows as Row[]).map(toChange)
}

/** Lê apenas as operações depois de uma versão (usado no polling). */
export async function readSince(
  sql: Sql,
  seq: number,
  limit = 500,
): Promise<SyncChange[]> {
  const rows = await sql`select seq, op, collection, item_id, payload, actor, created_at
                        from wf_changes where seq > ${seq} order by seq asc limit ${limit}`
  return (rows as Row[]).map(toChange)
}

/** Acrescenta operações ao log (append-only, sem conflito de escrita). */
export async function appendOps(
  sql: Sql,
  ops: SyncOp[],
  actor: string | null,
): Promise<SyncChange[]> {
  const inserted: SyncChange[] = []

  for (const op of ops) {
    const collection = op.op === 'reset' ? 'all' : op.collection
    const itemId = op.op === 'reset' ? null : op.id
    const payload = op.op === 'delete' ? null : op.payload

    const rows = await sql`
      insert into wf_changes (op, collection, item_id, payload, actor)
      values (${op.op}, ${collection}, ${itemId}, ${JSON.stringify(payload ?? null)}::jsonb, ${actor})
      returning seq, op, collection, item_id, payload, actor, created_at
    `
    for (const row of rows as Row[]) inserted.push(toChange(row))
  }

  return inserted
}

/** Lê um valor da tabela de metadados (ex.: o segredo dos tokens). */
export async function readMeta(sql: Sql, key: string): Promise<string | null> {
  const rows = await sql`select value from wf_meta where key = ${key} limit 1`
  const row = rows as { value: string }[]
  return row.length ? row[0].value : null
}

/** Grava um valor na tabela de metadados. */
export async function writeMeta(
  sql: Sql,
  key: string,
  value: string,
): Promise<void> {
  await sql`
    insert into wf_meta (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value
  `
}

/** Implementação do Store usando o Postgres do Neon. */
export function createPostgresStore(): Store {
  return {
    async ensure() {
      await ensureSchema(getSql())
    },
    async allChanges(collection) {
      return readAll(getSql(), collection)
    },
    async changesSince(seq, limit = 500) {
      return readSince(getSql(), seq, limit)
    },
    async append(ops, actor) {
      return appendOps(getSql(), ops, actor)
    },
    async meta(key) {
      return readMeta(getSql(), key)
    },
    async setMeta(key, value) {
      await writeMeta(getSql(), key, value)
    },
  }
}

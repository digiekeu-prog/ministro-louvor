/**
 * Prepara o banco compartilhado com os dados de exemplo (roda uma vez).
 *
 *   node --env-file=.env.local scripts/seed-db.ts
 *   node --env-file=.env.local scripts/seed-db.ts --reset   (recomeça do zero)
 *
 * Sem isso, a lista de membros ficaria vazia no servidor e ninguém conseguiria
 * entrar no app até o primeiro aparelho enviar os dados.
 */

import { createPostgresStore } from '../api/_lib/postgres.ts'
import { seedMembers, seedPresence, seedServices, seedSongs } from '../src/lib/seed.ts'
import { getSql } from '../api/_lib/postgres.ts'

const store = createPostgresStore()

await store.ensure()

if (process.argv.includes('--reset')) {
  const sql = getSql()
  await sql`truncate table wf_changes restart identity`
  console.log('Log de operacoes apagado.')
}

const existing = await store.allChanges()
if (existing.length > 0) {
  console.log(`Banco ja tem ${existing.length} operacao(oes). Nada foi mudado.`)
  process.exit(0)
}

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

console.log('Dados de exemplo inseridos no banco compartilhado.')

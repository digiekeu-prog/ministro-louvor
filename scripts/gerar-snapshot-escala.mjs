/**
 * Gera a **cópia estática** (snapshot) de uma escala.
 *
 * Por que: o banco do Neon (Postgres) pode ficar fora do ar — por exemplo,
 * quando a cota mensal do plano Free acaba. A API responde 503 e a página
 * pública dos músicos não consegue buscar a escala. Mas um arquivo estático
 * no CDN da Vercel continua no ar, porque não depende do banco.
 *
 * O script baixa a escala pela API e grava em `public/escala-snapshot/<id>.json`.
 * A página pública (`/escala/:id`) usa esse arquivo como plano B: só quando a
 * API falha (5xx), nunca quando a escala não existe (404).
 *
 * Uso:
 *   npm run snapshot -- svc_hvesek0031g                     # produção
 *   npm run snapshot -- svc_hvesek0031g http://localhost:8787  # API local
 *
 * Depois é só `git add` + `git commit` + `git push` que a Vercel publica.
 */

import fs from 'node:fs'
import path from 'node:path'

const [, , idEscala, baseArg] = process.argv
if (!idEscala) {
  console.error('Uso: node scripts/gerar-snapshot-escala.mjs <idDaEscala> [urlDaApi]')
  process.exit(1)
}

const base = (baseArg || 'https://ministro-louvor.vercel.app').replace(/\/$/, '')
const url = `${base}/api/escala?id=${encodeURIComponent(idEscala)}`

console.log(`Buscando a escala em ${url} ...`)

const response = await fetch(url)
const texto = await response.text()

if (!response.ok) {
  console.error(`A API respondeu ${response.status}: ${texto.slice(0, 300)}`)
  console.error('\nDica: só dá para gerar a cópia com o banco no ar (a cópia vem dele).')
  process.exit(1)
}

let corpo
try {
  corpo = JSON.parse(texto)
} catch {
  console.error('A API não devolveu JSON válido.')
  process.exit(1)
}

const escala = corpo?.escala
if (!escala?.id) {
  console.error('A resposta não tem a escala.')
  process.exit(1)
}

const destino = path.join(process.cwd(), 'public', 'escala-snapshot', `${idEscala}.json`)
fs.mkdirSync(path.dirname(destino), { recursive: true })

const conteudo = {
  escala,
  geradoEm: new Date().toISOString(),
}
fs.writeFileSync(destino, JSON.stringify(conteudo, null, 2), 'utf8')

console.log(`\nCópia gerada: ${destino}`)
console.log(`  título: ${escala.title}`)
console.log(`  data: ${escala.date} ${escala.time ?? ''}`)
console.log(`  equipe: ${escala.equipe?.length ?? 0} pessoas`)
console.log(`  músicas: ${escala.musicas?.length ?? 0}`)
console.log('\nAgora é só publicar: git add -A && git commit -m "..." && git push')

# WorshipFlow · Ministério de Louvor

App de escalas para o culto: o ministro monta a escala, divide a equipe por função, e cada
músico vê **o que ele toca/canta**, a **letra**, a **cifra** e o **vídeo** dentro do próprio
aplicativo — sem sair da tela.

Interface dark premium (grafite + neon de palco), pensada para leitura no escuro do palco.

## Funcionalidades

- **Dados compartilhados na nuvem**: escalas, equipe, repertório e presenças ficam salvos num
  Postgres (Neon) e chegam em **todos os aparelhos** (celular, tablet, notebook) em poucos
  segundos. O app continua funcionando sem internet e reenvia tudo quando a conexão volta.
- **Login**: o e-mail precisa estar na lista demembers da equipe (a senha é livre — é só a porta
  de entrada da UI; quem decide quem entra é a lista compartilhada).
- **Escalas**: criar, editar, duplicar e arquivar cultos com status (`rascunho`, `confirmado`, `realizado`).
- **Divisão de equipe**: vagas separadas em *Instrumentistas* e *Vocais*, com a função de cada um
  (Teclado, Violão, Bateria, Guitarra, Ministro, Backing Vocal, Coral…).
- **Painel do músico** (`Minha escala`): próximos cultos, passados, função atribuída e confirmação de presença.
- **Repertório por culto**: link de mídia (YouTube, Vimeo, Spotify, Deezer, Apple Music, Bandcamp ou
  qualquer URL), letra, cifra, tom, BPM e progressão de acordes.
- **Visualizador de música interno**: vídeo no topo e **letra/cifra logo abaixo, na mesma tela**,
  com janela arrastável (segure o cabeçalho), botão *Centralizar* e botão único que alterna
  entre **só a letra** e **letra com as cifras**.
- **Equipe**: cadastro de integrantes, funções que cada pessoa pode executar, busca e filtro.
- **Perfil**: dados cadastrais e troca de senha (simulada).

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- lucide-react (ícones)
- react-router-dom 7
- **Serverless Functions da Vercel** (`api/`) + **Postgres do Neon** (via Marketplace da Vercel)

## Como a sincronização funciona

- Toda alteração vira uma **operação** (`upsert` / `delete` / `reset`) guardada num log no Postgres.
- O app envia a fila para `/api/sync` e de tempos em tempos pergunta *"o que há de novo?"*
  (`/api/sync?since=N`) — por isso todo aparelho converge para o mesmo estado.
- O log é *append-only*: dois aparelhos editando ao mesmo tempo não sobrescrevem o trabalho um
  do outro (vale o que foi gravado por último).
- O token de sessão é assinado no servidor (HMAC) e o segredo fica no próprio banco.
- Permissões no servidor: só **ministros** (`category: admin`) alteram equipe e escalas; qualquer
  integrante confirma a própria presença.

## Comandos

```bash
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
npm run dev:api      # API local (http://localhost:8787) — use junto com o dev
npm run build        # typecheck (tsc -b) + build de produção em dist/
npm run preview      # serve o build de produção
npm run lint         # oxlint
npm run db:seed      # coloca os dados de exemplo no banco (uma vez)
```

## Variáveis de ambiente

O app em produção usa as variáveis que a Vercel injeta ao conectar o Neon:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão com o Postgres (o Neon injeta também `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) |

Localmente, use `vercel env pull .env.local --environment=production` (o arquivo é ignorado pelo Git).

## Estrutura

```
api/                # functions da Vercel (login + sync) e o acesso ao Postgres
  _lib/             # regras da sincronização, token, conexão e helpers HTTP
scripts/            # utilitários: seed do banco, API local de desenvolvimento
src/
  components/   # UI compartilhada (ui.tsx, AppShell, SongViewer, SyncStatus, Portal, Logo)
  hooks/        # useDraggable (janelas flutuantes arrastáveis)
  lib/          # tipos, storage, seed, sincronização (sync.ts, syncState.ts) e parser de mídia
  pages/        # Login, Home, Escalas, EscalaDetalhe, CultoEditor, MinhaEscala, Equipe, Perfil
  store/        # contextos de Auth e Data
```

## Observações importantes

- **O primeiro acesso**: o banco começa com os dados de exemplo. O ministro vê um aviso para
  **enviar os dados deste aparelho para a equipe** — vale fazer isso no aparelho que tiver os
  dados mais completos, porque é ele que vira a versão oficial.
- **YouTube só reproduz embed em `localhost`**. Aberto pelo IP da rede, o vídeo é bloqueado
  pelo YouTube — o app mostra um aviso e a letra/cifra continuam funcionando.
- **O player é interno**: o vídeo toca dentro do app, sem abrir o YouTube em outra aba.
- O login aceita qualquer senha para um e-mail cadastrado na equipe.

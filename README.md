# WorshipFlow · Ministério de Louvor

App de escalas para o culto: o ministro monta a escala, divide a equipe por função, e cada
músico vê **o que ele toca/canta**, a **letra**, a **cifra** e o **vídeo** dentro do próprio
aplicativo — sem sair da tela.

Interface dark premium (grafite + neon de palco), pensada para leitura no escuro do palco.

## Funcionalidades

- **Dados compartilhados na nuvem**: escalas, equipe, repertório e presenças ficam salvos num
  Postgres (Neon) e chegam em **todos os aparelhos** (celular, tablet, notebook) em poucos
  segundos. O app continua funcionando sem internet e reenvia tudo quando a conexão volta.
- **Login só dos ministros**: o e-mail precisa estar na lista de membros da equipe (a senha é
  livre — é só a porta de entrada da UI; quem decide quem entra é a lista compartilhada).
  **Integrantes sem e-mail não entram no app**: eles recebem o link da escala e só visualizam.
- **Escala pública por link** (`/escala/:id`): página sem login onde a equipe digita o próprio
  nome e vê "Sim! {nome} está na escala", a função, o repertório, o vídeo, a letra e a cifra.
  É esse link que o ministro manda no grupo.
- **Aviso no WhatsApp**: ao salvar a escala, o app monta uma mensagem **curta** (qual culto, o
  local, o recado e o link) e abre o `wa.me` já com o texto escrito — é só tocar em enviar e
  encaminhar para o grupo. A escala e o repertório ficam **dentro do link**, não na mensagem.
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
  O **e-mail é opcional** — sem e-mail a pessoa só visualiza a escala pelo link.
- **Perfil**: dados cadastrais, **meu WhatsApp** (é para ele que chega o aviso da escala) e
  troca de senha (simulada).

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
- **Exclusão também é operação**: quando alguém remove um integrante, a escala ou uma presença,
  a exclusão entra na fila e chega em todos os aparelhos — não existe "apagar local".
- O token de sessão é assinado no servidor (HMAC) e o segredo fica no próprio banco.
- Permissões no servidor: só **ministros** (`category: admin`) alteram equipe e escalas; qualquer
  integrante confirma a própria presença.

### Nada apaga o trabalho de outro aparelho

- O botão **"Enviar as diferenças"** (do ministro) manda **só o que existe apenas naquele
  aparelho**. Itens que já estão no servidor não são reenviados, e o servidor aceita essa
  operação apenas se o item ainda não existir lá (`onlyIfMissing`) — ou seja, uma cópia antiga
  nunca sobrescreve a versão nova de outro aparelho.
- O servidor **recusa** qualquer operação que substitua o estado inteiro (`reset`) depois da
  primeira configuração. Nenhum aparelho consegue, por acidente, apagar a equipe inteira.
- O selo no topo da tela distingue: **Sincronizado**, **Sincronizando…**, **Sem conexão**
  (sem internet — as alterações ficam guardadas e vão sozinhas quando voltar), **Sem acesso**
  (o e-mail saiu da lista da equipe) e **Erro**.

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

### `VITE_API_URL` e `VITE_APP_URL` (opcionais)

Por padrão o app chama a API no **mesmo domínio** (`/api/...`) e o link da mensagem do WhatsApp
aponta para `https://ministro-louvor.vercel.app`. Só preencha quando o front roda/publica em outro
domínio — por exemplo o preview do Lovable (`*.lovable.app`):

```
VITE_API_URL=https://ministro-louvor.vercel.app   # onde está a API
VITE_APP_URL=https://seu-app.lovable.app           # link da escala na mensagem
```

A API aceita CORS (não usa cookie, a sessão é token Bearer), então o preview do Lovable consegue
falar com a Vercel normalmente.

## Desenvolvendo no Lovable

O projeto é **React + Vite + TypeScript + Tailwind 4**, exatamente a stack do Lovable. O caminho
mais seguro é usar o Lovable como **editor do front** e manter o backend (functions da Vercel +
Neon) onde está:

1. **GitHub**: o código já está em `digiekeu-prog/ministro-louvor` (branch `main`).
2. **Lovable**: *New project → Import from GitHub* (ou *Settings → GitHub → Connect repository*).
   O Lovable clona o repo, detecta o Vite e instala as dependências.
3. **Variável de ambiente**: no Lovable, em *Settings → Environment Variables*, crie
   `VITE_API_URL` = `https://ministro-louvor.vercel.app` (e um *preview* da mesma, para o preview
   do Lovable falar com a API de produção). Se for publicar no Lovable, crie também
   `VITE_APP_URL` com o novo domínio — é o link que vai na mensagem do WhatsApp.
4. **Rodar localmente**: `npm install && npm run dev` (o front em `localhost:5173` usa a API local
   em `localhost:8787` pelo proxy do Vite).
5. **Publicar**: o Lovable publica o front no hosting dele; a API continua na Vercel
   (`https://ministro-louvor.vercel.app/api`). O `vercel.json` **não** pode reescrever `/api`.

O que **não** funciona no Lovable: a pasta `api/` (functions da Vercel) — lá não existe runtime de
functions. Se em algum momento quiser que o Lovable cuide também do backend, o caminho é migrar
para Supabase (tabelas + edge functions) e reimplementar o log de operações; o app em si não
precisa mudar, porque a sincronização conversa só com `/api/sync`.

## Estrutura

```
api/                # functions da Vercel (login + sync + escala pública) e o acesso ao Postgres
  _lib/             # regras da sincronização, token, conexão e helpers HTTP
scripts/            # utilitários: seed do banco, API local de desenvolvimento
src/
  components/   # UI compartilhada (ui.tsx, AppShell, SongViewer, SyncStatus, Portal, Logo, WhatsappShare)
  hooks/        # useDraggable (janelas flutuantes arrastáveis)
  lib/          # tipos, storage, seed, sincronização (sync.ts, syncState.ts), parser de mídia e whatsapp.ts
  pages/        # Login, Home, Escalas, EscalaDetalhe, CultoEditor, EscalaPublica, MinhaEscala, Equipe, Perfil
  store/        # contextos de Auth e Data
```

## Observações importantes

- **O primeiro acesso**: o banco começa com os dados de exemplo. O ministro vê um aviso para
  **enviar os dados deste aparelho para a equipe** — vale fazer isso no aparelho que tiver os
  dados mais completos, porque é ele que vira a versão oficial (é o único caso em que o estado
  inteiro é enviado; depois disso, o envio é sempre por diferenças).
- **Login**: o e-mail precisa estar na lista de membros do servidor. Se o e-mail for removido da
  equipe, o app avisa ("Sem acesso") e leva de volta para a tela de login com a explicação —
  não fica em "Offline" sem dizer nada.
- **YouTube só reproduz embed em `localhost`**. Aberto pelo IP da rede, o vídeo é bloqueado
  pelo YouTube — o app mostra um aviso e a letra/cifra continuam funcionando.
- **O player é interno**: o vídeo toca dentro do app, sem abrir o YouTube em outra aba.
- O login aceita qualquer senha para um e-mail cadastrado na equipe.

# AGENTS.md

App React + Vite (SPA) **com functions na Vercel** (`api/`) e Postgres (Neon) para os dados
compartilhados. O `localStorage` (`worshipflow:*`) continua sendo o cache local (o app abre
rápido e funciona sem internet), mas a **fonte da verdade é o servidor**.

## Comandos

```bash
npm run dev        # dev server em http://localhost:5173 (para testar embed do YouTube use localhost, não o IP)
npm run dev:api    # API local em http://localhost:8787 (o Vite faz proxy de /api para ela)
npm run build      # roda `tsc -b` e depois `vite build` — build quebrado = erro de tipo
npm run lint       # oxlint (config em .oxlintrc.json)
npm run db:seed    # semeia o banco (uma vez); --reset recomeça do zero
```

Sem testes automatizados: **verifique no navegador** (login → escalas → abrir um culto → abrir uma
música no repertório). Para checar a sincronização, abra **duas origens diferentes**
(`localhost:5173` e `127.0.0.1:5173` têm `localStorage` separado) e altere algo em uma.

## Mapa do código

- `src/App.tsx` — rotas. `RequireAdmin` só libera quem tem `isAdmin` (categoria `admin`).
- `src/store/DataContext.tsx` — CRUD de serviços/membros/presenças. Cada alteração vira uma
  **operação** (`upsert`/`delete`/`reset`) e vai para a fila de sincronização.
- `src/store/AuthContext.tsx` — sessão: o **celular precisa existir na lista do servidor**; a
  senha é livre (simulação de UI). Sem internet (ou com a API em 5xx), cai para a lista local.
- `src/lib/sync.ts` — motor de sincronização: fila, polling (adaptativo), token e status na tela.
- `src/lib/poll.ts` — ritmo das consultas ao servidor (4s em uso, 60s parado, 10min em segundo plano).
- `src/lib/syncState.ts` — tipos e a lógica de merge das operações (usada pelo app e pelo servidor).
- `api/_lib/app.ts` — as regras do servidor (login/pull/push e permissões).
- `api/_lib/postgres.ts` — acesso ao Postgres (Neon) e criação das tabelas.
- `api/_lib/auth.ts` — token de sessão assinado (HMAC), com o segredo guardado no banco.
- `src/components/SyncStatus.tsx` — selo de estado da sincronização + aviso de primeira configuração.
- `src/lib/mediaLinks.ts` — `describeMedia()` converte qualquer URL em fonte + URL de embed.
- `src/lib/types.ts` — tipos e as listas `INSTRUMENT_FUNCTIONS` / `VOCAL_FUNCTIONS` /
  `TECHNICAL_FUNCTIONS` (equipe técnica: mesa de som, projeção…) que alimentam selects e filtros
  de skills.
- `src/components/ui.tsx` — `Button`, `Card`, `Field`, `Modal`, `Segmented`, etc.
- `src/components/SongViewer.tsx` — player interno (vídeo em cima, letra/cifra embaixo). Sem rodapé
  e sem botão de copiar: a letra usa todo o espaço que sobra (pedido do usuário). Quando a música
  tem MP3 enviado pelo ministro, o player de áudio aparece no lugar do vídeo (com o botão
  "Ver vídeo" para trocar).
- `src/components/SongAudioField.tsx` — campo "Enviar MP3" do editor de escala.
- `src/lib/audio.ts` — envio do MP3 em partes (2 MB), URL do player e formatação de tamanho.
- `api/_lib/audio.ts` + `api/audio.ts` — armazenamento e entrega dos MP3 (tabela `wf_audio` do
  Postgres; em dev, arquivos em `.dev-data/audio`).
- `src/lib/whatsapp.ts` — monta a mensagem **curta** da escala (culto, local, recado e link) e o
  link `wa.me`.
- `src/components/WhatsappShare.tsx` — modal do aviso (preview, copiar, abrir no WhatsApp).
- `src/pages/EscalaPublica.tsx` — página pública **sem login** (`/escala/:id`): busca pelo nome
  + repertório com vídeo/letra/cifra.
- `api/escala.ts` + `handlePublicScale` (`api/_lib/app.ts`) — endpoint público da escala (não
  expõe e-mail, telefone nem presença).

## Regras que não dá para inferir do código

- **O log no Postgres é a fonte da verdade** (tabela `wf_changes`, append-only). O estado é
  reconstruído aplicando as operações em ordem — por isso dois aparelhos editando ao mesmo tempo
  não se sobrescrevem. Não troque isso por "grava o estado inteiro": perde-se o conflito.
- **Nunca envie o estado inteiro (`reset`) depois da primeira configuração.** O servidor recusa
  com 409 (`api/_lib/app.ts`): foi justamente um `reset` acidental que apagou a equipe no
  passado. O envio do ministro é por **diferenças** (`diffOps` em `src/lib/syncState.ts`): só
  `upsert` do que existe apenas naquele aparelho, marcado com `onlyIfMissing` para o servidor
  ignorar o item se ele já existir lá. `reset` só é aceito enquanto o log for o do seed
  (primeira configuração).
- **Toda alteração da UI precisa virar operação.** Se um `setState` do `DataContext` não passa
  por `commit(..., ops)`, ela não chega aos outros aparelhos.
- **Exclusão é operação como qualquer outra** (`delete`) — não existe "apagar só local".
- **O servidor decide as permissões**: equipe e escalas só podem ser alteradas por `admin`
  (`api/_lib/app.ts`); presença pode ser por qualquer integrante. A UI esconde o botão, mas quem
  protege de verdade é a API.
- **O selo da sincronização distingue os estados**: `sem_conexao` (sem internet, a fila fica
  guardada), `sem_acesso` (o e-mail saiu da lista da equipe → a sessão é encerrada e a tela de
  login explica o motivo) e `erro` (resposta HTTP do servidor). Nunca deixe tudo virar
  "Offline" silencioso.
- **O `vercel.json` não pode reescrever `/api`** — a regra é `"/((?!api/).*)"`. Se o rewrite
  voltar a ser `/(.*)`, as functionssomem e o app fica "só neste aparelho".
- **Modais flutuantes precisam de `Portal`** (`src/components/Portal.tsx`). As páginas usam
  `animate-fade-up`, que aplica `transform` e cria um containing block: sem portal, o
  `position: fixed` do modal passa a se posicionar pelo conteúdo rolado e o modal abre
  "grudado" fora da viewport. Isso já quebrou o visualizador de música.
- **Transform inline + animação não convivem.** Se um painel precisa ser movido
  (`useDraggable`), o `transform` fica no wrapper externo e a animação `animate-fade-up`
  no elemento interno — senão o `fill-mode: both` sobrescreve o transform.
- **Janelas arrastáveis** usam `src/hooks/useDraggable.ts`: o clamp horizontal mantém o painel
  dentro da viewport (para o botão de fechar nunca sair da tela) e o vertical deixa subir/descer.
  O `resetKey` (normalmente `open`) recentraliza ao reabrir.
- **YouTube não reproduz embed por IP.** O app mostra aviso quando `window.location.hostname`
  é um IPv4; testar vídeo sempre em `http://localhost:5173`.
- **Não abrir o vídeo em outra aba** — pedido explícito do usuário: o player fica dentro do app.
- Tailwind v4: cores customizadas via `@theme` em `src/index.css` (`ink-*`, `neon-*`); não
  criar arquivo de config do Tailwind.
- **A página pública (`/escala/:id`) se atualiza sozinha** (8s + quando a tela volta a ficar
  visível). Sem isso, o integrante que abriu o link no celular via a versão antiga da escala e
  achava que a nuvem não estava funcionando.
- **Se o aparelho entrou sem internet, ele volta a sincronizar sozinho** (nova tentativa a cada
  15s em `AuthContext`). Sem isso o app ficava preso em "Só neste aparelho" para sempre.
- **Idioma da UI e dos comentários: português do Brasil.**
- **A mensagem do WhatsApp é curta de propósito** (pedido do usuário): só o culto, o local, o
  recado (observações) e o link público. **Nunca** mandar a lista da equipe nem o repertório no
  texto — a escala, o vídeo, a letra e a cifra ficam dentro do link, senão ninguém entra no app.
- **Só os ministros fazem login.** Integrantes podem ficar sem celular (`Member.phone` é
  opcional) e visualizam pela página pública `/escala/:id`. Não exija celular para ver a escala.
- **O login é pelo celular** (`src/lib/phone.ts`: `samePhone`, `maskPhone`, `formatPhone`): a
  comparação ignora máscara e código do país. Não existe mais e-mail no cadastro — o token da
  sessão leva o **id** do integrante (`api/_lib/auth.ts`), não o telefone, para continuar valendo
  se o número mudar.
- **O endpoint público `/api/escala` não vaza dado pessoal**: o GET devolve só equipe (nome,
  função), repertório e observações — nunca e-mail, telefone nem presença. O **POST** é a resposta
  de presença ("Vou participar" / "Não vou"): o servidor confere se a pessoa está na escala e se o
  nome digitado bate com o cadastro, e grava a resposta como operação `presence` (chega nos
  aparelhos dos ministros pela sincronização normal).
- **Prazo da resposta**: a sexta-feira mais próxima antes do culto (`prazoResposta` em
  `src/lib/utils.ts`). O ministro vê quem respondeu e quem falta em "Respostas da equipe"
  (`src/pages/EscalaDetalhe.tsx`).
- **MP3 do repertório**: o ministro envia o arquivo pelo editor da escala; o app envia em partes
  de 2 MB (a function da Vercel aceita ~4,5 MB por requisição) e o servidor junta e guarda no
  Postgres (`wf_audio`, limite de 15 MB). A música guarda só o `audioId` — o arquivo **não** viaja
  na fila de sincronização. O player serve o arquivo com `Range` (dá para pular na música).
- **A mesma pessoa pode estar em mais de uma função** (toca e canta ao mesmo tempo): isso é
  permitido e **não bloqueia** o salvamento — vira só um aviso informativo ("Também está em: …").
- **A equipe técnica tem categoria própria** (`tecnica`): mesa de som, projeção, projeção de
  letras, filmagem e tecnologia. Entram na escala como qualquer outra vaga e **só visualizam**
  pelo link.
- **A ordem do repertório é do culto** — o editor tem botões para subir/descer cada música
  (`moveSong` em `src/pages/CultoEditor.tsx`); a ordem salva é a que aparece no link público.
- Ao mexer no `api/`, use imports **com a extensão `.ts`** (o Node executa os scripts assim) e
  mantenha o `api/` livre de dependências do navegador.
- **Se toda a API responder 500 ao mesmo tempo, o problema quase nunca é o código: é a cota do
  Neon** (plano free). O banco responde `402: Your account or project has exceeded the quota` e o
  app fica "só neste aparelho" até a cota ser renovada (reset mensal) ou o plano ser atualizado
  (Vercel → Storage → integração Neon → upgrade, ou console.neon.tech). Os dados continuam no
  banco — nada é apagado.
- **Servidor fora do ar não tranca a porta**: quando a API responde 5xx (cota do Neon, banco fora),
  o login **entra com a lista salva no aparelho** — a mesma regra do offline (o celular precisa
  estar na lista). Um 5xx **não** encerra a sessão do ministro (só 403/404 de verdade encerram): o
  `AuthContext` distingue "recusou" de "deu erro" (`remote.reason === 'erro'`).
- **A cota do Neon tem aviso próprio**: a API reconhece o `402` do driver (`isQuotaError` em
  `api/_lib/http.ts`) e responde **503 com `code: 'cota_neon'`**. O app vira o estado `sem_cota`
  (selo "Banco sem cota") e explica que nada foi perdido — não é falha do app.
- **A página pública guarda a escala no aparelho** (`worshipflow:escala:<id>`): com o servidor
  fora, o músico continua vendo a equipe e o repertório, com o aviso "Mostrando a versão salva
  neste aparelho". "Escala não encontrada" só aparece em 404 de verdade — nunca por erro do
  servidor.
- **A resposta de presença não se perde com o banco fora**: se o POST em `/api/escala` falhar por
  rede/5xx, a resposta fica guardada em `worshipflow:resposta-pendente:<id>` e a página a envia
  sozinha no próximo carregamento que der certo (recusa 4xx — nome que não bate — não entra na
  fila: repetir não adianta).
- **A página pública tem três camadas de dados** (nesta ordem): 1) API (fonte da verdade);
  2) **cópia estática** em `public/escala-snapshot/<id>.json` — servida pelo CDN da Vercel, não
  depende do Postgres, então continua no ar com o banco fora; 3) **cache do app** neste aparelho
  (`src/lib/escalaLocal.ts`, remontado de `worshipflow:services`/`members`/`songs`). Só uma
  resposta 404 (escala que não existe) cai na tela de erro. A cópia estática se gera com
  `npm run snapshot -- <idDaEscala>` (precisa do banco no ar).
- **`/copia/<id>`** (`src/pages/CopiaEscala.tsx`) remonta a escala do cache do aparelho e mostra
  o JSON com botão de copiar: é o jeito de gerar a cópia estática sem o banco no ar (o ministro
  copia no celular e envia).
- **Entrada automática do dono**: em `src/pages/Login.tsx`, `CELULAR_DONO`/`SENHA_DONO` — ao digitar
  o celular do dono, a senha entra sozinha e o app entra junto. A senha é livre no app (o que
  libera o acesso é o celular estar na lista da equipe), então ela pode ficar no front.
- **Ritmo das consultas ao servidor** (`src/lib/poll.ts`): 4 s com o app em uso, 60 s com o app
  parado (3 min sem mexer) e 10 min em segundo plano — cada consulta acorda o Neon e queima cota.
  Depois de um erro a espera dobra (até 5 min) para não martelar o servidor. A página pública
  (`/escala/:id`) usa o mesmo ritmo, com 8 s como base.
- **O app volta a sincronizar sozinho** depois de uma queda: o retry do login (`AuthContext`) espera
  15 s, 30 s, 1 min, 2 min… até 5 min; e a tela que volta a ficar visível pergunta na hora.

## Antes de commitar

`npm run build` (typecheck + bundle) e `npm run lint`. Avisos de `react(purity)`
(`Date.now`/`new Date()` no render) e `react(only-export-components)` já existiam no projeto —
não são regressões.

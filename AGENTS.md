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
  senha é livre (simulação de UI). Sem internet, cai para a lista local.
- `src/lib/sync.ts` — motor de sincronização: fila, polling (4s), token e status na tela.
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
  e sem botão de copiar: a letra usa todo o espaço que sobra (pedido do usuário).
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
- **O endpoint público `/api/escala` não vaza dado pessoal**: devolve só equipe (nome, função),
  repertório e observações — nunca e-mail, telefone ou presença.
- **A mesma pessoa pode estar em mais de uma função** (toca e canta ao mesmo tempo): isso é
  permitido e **não bloqueia** o salvamento — vira só um aviso informativo ("Também está em: …").
- **A equipe técnica tem categoria própria** (`tecnica`): mesa de som, projeção, projeção de
  letras, filmagem e tecnologia. Entram na escala como qualquer outra vaga e **só visualizam**
  pelo link.
- **A ordem do repertório é do culto** — o editor tem botões para subir/descer cada música
  (`moveSong` em `src/pages/CultoEditor.tsx`); a ordem salva é a que aparece no link público.
- Ao mexer no `api/`, use imports **com a extensão `.ts`** (o Node executa os scripts assim) e
  mantenha o `api/` livre de dependências do navegador.

## Antes de commitar

`npm run build` (typecheck + bundle) e `npm run lint`. Avisos de `react(purity)`
(`Date.now`/`new Date()` no render) e `react(only-export-components)` já existiam no projeto —
não são regressões.

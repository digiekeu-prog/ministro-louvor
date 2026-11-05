# WorshipFlow · Ministério de Louvor

Escalas de culto para igrejas: o **ministro** monta a escala no celular/notebook, a equipe
(músicos, vocais e **equipe técnica**) vê tudo pelo **link público**, sem precisar de login.
Tudo fica salvo na nuvem (Postgres + functions na Vercel) e o app funciona offline como cache.

Stack: **React + Vite + TypeScript** (SPA), **functions da Vercel** em `api/`, **Postgres (Neon)**
para os dados compartilhados, **Tailwind v4**, **lucide-react** nos ícones.

---

## 1. Como rodar

```bash
npm install
npm run dev        # front em http://localhost:5173
npm run dev:api    # API local em http://localhost:8787 (o Vite faz proxy de /api)
npm run build      # tsc -b + vite build (build quebrado = erro de tipo)
npm run lint       # oxlint
```

Sem testes automatizados: **verifique no navegador** (login → escalas → abrir um culto → abrir uma
música). Para checar a sincronização entre dois aparelhos, abra `localhost:5173` e
`127.0.0.1:5173` (têm `localStorage` separado).

### Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `VITE_API_URL` | Endereço da API quando o front roda em **outro domínio** (ex.: preview do Lovable). Ex.: `https://ministro-louvor.vercel.app`. Na Vercel (mesmo domínio) deixe vazio. |
| `VITE_APP_URL` | Endereço **público do app** — é o link que vai na mensagem do WhatsApp. Ex.: `https://meu-app.lovable.app`. |

A API já libera CORS, então o front do Lovable (`*.lovable.app`) consegue falar com a API da
Vercel.

### Publicar no Lovable

1. Importe o repositório `digiekeu-prog/ministro-louvor` no Lovable (ou conecte o GitHub).
2. Copie as regras deste arquivo para as **instruções** do Lovable (ele passa a seguir o mesmo
   padrão do `AGENTS.md`).
3. Configure `VITE_API_URL=https://ministro-louvor.vercel.app` e
   `VITE_APP_URL=<domínio do Lovable>` nas variáveis do projeto.
4. **A API fica na Vercel** (as functions de `api/` não rodam no Lovable). Se o Lovable pedir
   build, use `npm run build` e publique a pasta `dist/`.

---

## 2. Mapa do código

- `src/App.tsx` — rotas. `RequireAdmin` só libera quem tem `isAdmin` (categoria `admin`).
- `src/store/DataContext.tsx` — CRUD de serviços/membros/presenças. Cada alteração vira uma
  **operação** (`upsert`/`delete`/`reset`) e vai para a fila de sincronização.
- `src/store/AuthContext.tsx` — sessão: o **celular precisa existir na lista do servidor**; a
  senha é livre (simulação de UI). Sem internet, cai para a lista local.
- `src/lib/sync.ts` — motor de sincronização: fila, polling (4s), token e status na tela.
- `src/lib/syncState.ts` — tipos e a lógica de merge das operações (usada pelo app e pelo servidor).
- `src/lib/api.ts` — `API_BASE` (`VITE_API_URL`) e o fetch da API.
- `api/_lib/app.ts` — as regras do servidor (login/pull/push, permissões e a escala pública).
- `api/_lib/postgres.ts` — acesso ao Postgres (Neon) e criação das tabelas.
- `api/_lib/auth.ts` — token de sessão assinado (HMAC), com o segredo guardado no banco.
- `api/escala.ts` + `handlePublicScale` — endpoint público da escala (não expõe celular, telefone
  nem presença).
- `src/components/SyncStatus.tsx` — selo de estado da sincronização + aviso de primeira configuração.
- `src/lib/mediaLinks.ts` — `describeMedia()` converte qualquer URL em fonte + URL de embed.
- `src/lib/types.ts` — tipos e as listas `INSTRUMENT_FUNCTIONS` / `VOCAL_FUNCTIONS` /
  `TECHNICAL_FUNCTIONS` que alimentam selects e filtros de skills.
- `src/components/ui.tsx` — `Button`, `Card`, `Field`, `Modal`, `Segmented`, etc.
- `src/components/SongViewer.tsx` — player interno (vídeo em cima, letra/cifra embaixo).
- `src/lib/whatsapp.ts` — monta a mensagem **curta** da escala (culto, local, recado e link) e o
  link `wa.me`.
- `src/components/WhatsappShare.tsx` — modal do aviso (preview, copiar, abrir no WhatsApp).
- `src/pages/EscalaPublica.tsx` — página pública **sem login** (`/escala/:id`): busca pelo nome
  + repertório com vídeo/letra/cifra.

---

## 3. Regras que não dá para inferir do código

- **O log no Postgres é a fonte da verdade** (tabela `wf_changes`, append-only). O estado é
  reconstruído aplicando as operações em ordem — por isso dois aparelhos editando ao mesmo tempo
  não se sobrescrevem. Não troque isso por "grava o estado inteiro": perde-se o conflito.
- **Nunca envie o estado inteiro (`reset`) depois da primeira configuração.** O servidor recusa
  com 409 (`api/_lib/app.ts`): foi justamente um `reset` acidental que apagou a equipe no
  passado. O envio do ministro é por **diferenças** (`diffOps` em `src/lib/syncState.ts`): só
  `upsert` do que existe apenas naquele aparelho, marcado com `onlyIfMissing` para o servidor
  ignorar o item se ele já existir lá. `reset` só é aceito enquanto o log for o do seed.
- **Toda alteração da UI precisa virar operação.** Se um `setState` do `DataContext` não passa
  por `commit(..., ops)`, ela não chega aos outros aparelhos.
- **Exclusão é operação como qualquer outra** (`delete`) — não existe "apagar só local".
- **O servidor decide as permissões**: equipe e escalas só podem ser alteradas por `admin`
  (`api/_lib/app.ts`); presença pode ser por qualquer integrante. A UI esconde o botão, mas quem
  protege de verdade é a API.
- **O selo da sincronização distingue os estados**: `sem_conexao` (sem internet, a fila fica
  guardada), `sem_acesso` (o celular saiu da lista da equipe → a sessão é encerrada e a tela de
  login explica o motivo) e `erro` (resposta HTTP do servidor). Nunca deixe tudo virar
  "Offline" silencioso.
- **O `vercel.json` não pode reescrever `/api`** — a regra é `"/((?!api/).*)"`. Se o rewrite
  voltar a ser `/(.*)`, as functions somem e o app fica "só neste aparelho".
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
  visível). Sem isso, o integrante que abriu o link no celular achava que a nuvem não funcionava.
- **Se o aparelho entrou sem internet, ele volta a sincronizar sozinho** (nova tentativa a cada
  15s em `AuthContext`).
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
- **A mesma pessoa pode estar em mais de uma função** (toca e canta ao mesmo tempo): isso é
  permitido e **não bloqueia** o salvamento da escala — vira só um aviso informativo
  ("Também está em: …").
- **A equipe técnica tem categoria própria** (`tecnica`): mesa de som, projeção, projeção de
  letras, filmagem e tecnologia. Entram na escala como qualquer outra vaga e **só visualizam**
  pelo link.
- **A ordem do repertório é do culto** — o editor tem botões para subir/descer cada música
  (`moveSong` em `src/pages/CultoEditor.tsx`); a ordem salva é a que aparece no link público.
- **O endpoint público `/api/escala` não vaza dado pessoal**: devolve só equipe (nome, função),
  repertório e observações — nunca celular, telefone ou presença.
- **A mesma pessoa pode estar em mais de uma função** (toca e canta ao mesmo tempo): isso é
  permitido e **não bloqueia** o salvamento da escala — vira só um aviso informativo
  ("Também está em: …").
- **A equipe técnica tem categoria própria** (`tecnica`): mesa de som, projeção, projeção de
  letras e tecnologia. Entram na escala como qualquer outra vaga e **só visualizam** pelo link.
- Ao mexer no `api/`, use imports **com a extensão `.ts`** (o Node executa os scripts assim) e
  mantenha o `api/` livre de dependências do navegador.

---

## 4. Antes de commitar

`npm run build` (typecheck + bundle) e `npm run lint`. Avisos de `react(purity)`
(`Date.now`/`new Date()` no render) e `react(only-export-components)` já existiam no projeto —
não são regressões.

# AGENTS.md

App React + Vite (SPA, sem backend). Tudo é client-side: os dados moram em `localStorage`
com o prefixo `worshipflow:` e o seed inicial é aplicado na primeira visita.

## Comandos

```bash
npm run dev        # dev server em http://localhost:5173 (para testar embed do YouTube use localhost, não o IP)
npm run build      # roda `tsc -b` e depois `vite build` — build quebrado = erro de tipo
npm run lint       # oxlint (config em .oxlintrc.json)
```

Sem testes automatizados: **verifique no navegador** (login → escalas → abrir um culto → abrir uma
música no repertório). O `npm run build` sozinho não cobre comportamento de UI.

## Mapa do código

- `src/App.tsx` — rotas. `RequireAdmin` só libera quem tem `isAdmin` (categoria `admin`).
- `src/store/DataContext.tsx` — CRUD de serviços/membros/presenças + seed, persistido em `localStorage`.
- `src/store/AuthContext.tsx` — sessão fake: **qualquer senha** funciona para um e-mail cadastrado.
- `src/lib/mediaLinks.ts` — `describeMedia()` converte qualquer URL em fonte + URL de embed.
- `src/lib/types.ts` — tipos e as listas `INSTRUMENT_FUNCTIONS` / `VOCAL_FUNCTIONS` que alimentam
  selects e filtros de skills.
- `src/components/ui.tsx` — `Button`, `Card`, `Field`, `Modal`, `Segmented`, etc.
- `src/components/SongViewer.tsx` — player interno (vídeo em cima, letra/cifra embaixo).

## Regras que não dá para inferir do código

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
- Idioma da UI e dos comentários: **português do Brasil**.

## Antes de commitar

`npm run build` (typecheck + bundle) e `npm run lint`. Avisos de `react(purity)`
(`Date.now`/`new Date()` no render) e `react(only-export-components)` já existiam no projeto —
não são regressões.

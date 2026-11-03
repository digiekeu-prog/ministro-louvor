# WorshipFlow · Ministério de Louvor

App de escalas para o culto: o ministro monta a escala, divide a equipe por função, e cada
músico vê **o que ele toca/canta**, a **letra**, a **cifra** e o **vídeo** dentro do próprio
aplicativo — sem sair da tela.

Interface dark premium (grafite + neon de palco), pensada para leitura no escuro do palco.

## Funcionalidades

- **Login local** (sem backend) com três perfis: Ministro/Admin, Instrumentista e Vocal.
- **Escalas**: criar, editar, duplicar e arquivar cultos com status (`rascunho`, `confirmado`, `realizado`).
- **Divisão de equipe**: vagas separadas em *Instrumentistas* e *Vocais*, com a função de cada um
  (Teclado, Violão, Bateria, Guitarra, Ministro, Backing Vocal, Coral…).
- **Painel do músico** (`Minha escala`): próximos cultos, passados, função atribuída e confirmação de presença.
- **Repertório por culto**: link de mídia (YouTube, Vimeo, Spotify, Deezer, Apple Music, Bandcamp ou
  qualquer URL), letra, cifra, tom, BPM e progressão de acordes.
- **Visualizador de música interno**: vídeo no topo e **letra/cifra logo abaixo, na mesma tela**,
  com janela arrastável (segure o cabeçalho) e botão *Centralizar*.
- **Equipe**: cadastro de integrantes, funções que cada pessoa pode executar, busca e filtro.
- **Perfil**: dados cadastrais e troca de senha (simulada).

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- lucide-react (ícones)
- react-router-dom 7

## Comandos

```bash
npm install        # instala as dependências
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # typecheck (tsc -b) + build de produção em dist/
npm run preview    # serve o build de produção
npm run lint       # oxlint
```

## Estrutura

```
src/
  components/   # UI compartilhada (ui.tsx, AppShell, SongViewer, Portal, Logo)
  hooks/        # useDraggable (janelas flutuantes arrastáveis)
  lib/          # tipos, utilidades, storage, seed e parser de links de mídia
  pages/        # Login, Home, Escalas, EscalaDetalhe, CultoEditor, MinhaEscala, Equipe, Perfil
  store/        # contextos de Auth e Data (localStorage)
```

## Observações importantes

- **Dados ficam no `localStorage`** (`worshipflow:*`). Não há backend nem autenticação real;
  o seed inicial cria membros, escalas e o repertório de exemplo.
- **YouTube só reproduz embed em `localhost`**. Aberto pelo IP da rede, o vídeo é bloqueado
  pelo YouTube — o app mostra um aviso e a letra/cifra continuam funcionando.
- **O player é interno**: o vídeo toca dentro do app, sem abrir o YouTube em outra aba.
- O login aceita qualquer senha para um e-mail cadastrado (a senha é só simulação de UI).

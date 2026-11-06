import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  Clock,
  CloudOff,
  FileAudio,
  FileText,
  Guitar,
  MapPin,
  Music2,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { SongViewer } from '../components/SongViewer'
import { Badge, Button, Card, EmptyState, Input } from '../components/ui'
import type { Category, ServiceSong } from '../lib/types'
import { CATEGORY_LABEL, STATUS_LABEL } from '../lib/types'
import { SOURCE_STYLE, describeMedia } from '../lib/mediaLinks'
import { apiUrl } from '../lib/api'
import {
  intervaloAgora,
  marcarAtividade,
  observarAtividade,
  vigiarAtividade,
} from '../lib/poll'
import { cn, formatDateLong, formatarPrazo, formatTime } from '../lib/utils'

interface EquipeItem {
  memberId: string
  nome: string
  funcao: string
  categoria: Category
  observacao: string | null
}

interface EscalaPublica {
  id: string
  title: string
  date: string
  time: string
  location: string | null
  status: 'rascunho' | 'confirmado' | 'realizado'
  notes: string | null
  equipe: EquipeItem[]
  musicas: Array<{
    title: string
    artist: string | null
    link: string | null
    lyrics: string | null
    chords: string | null
    key: string | null
    bpm: number | null
    progression: string | null
    /** MP3 enviado pelo ministro (id do arquivo no servidor). */
    audioId: string | null
    audioName: string | null
    audioSize: number | null
  }>
}

/** De quanto em quanto tempo a página procura a versão nova da escala (ms). */
const INTERVALO_ATUALIZACAO = 8000

/**
 * A escala fica salva no aparelho de quem abre o link.
 *
 * Assim, se o servidor estiver fora do ar (cota do banco, internet caindo),
 * o músico continua vendo a equipe e o repertório — com um aviso de que é a
 * versão salva. Sem isso, ele veria "escala não encontrada" e acharia que o
 * link tinha morrido.
 */
const CHAVE_CACHE = (id: string) => `worshipflow:escala:${id}`

function lerCache(id: string): EscalaPublica | null {
  if (typeof window === 'undefined' || !id) return null
  try {
    const raw = window.localStorage.getItem(CHAVE_CACHE(id))
    return raw ? (JSON.parse(raw) as EscalaPublica) : null
  } catch {
    return null
  }
}

function gravarCache(id: string, escala: EscalaPublica) {
  try {
    window.localStorage.setItem(CHAVE_CACHE(id), JSON.stringify(escala))
  } catch {
    /* cota cheia no navegador: segue sem salvar */
  }
}

/* ------------------------------------------------------------------ *
 * Resposta de presença guardada (quando o servidor está fora do ar)
 * ------------------------------------------------------------------ */

/** Uma resposta de presença que ainda não chegou no servidor. */
interface RespostaPendente {
  memberId: string
  nome: string
  confirmed: boolean
}

const CHAVE_PENDENTE = (id: string) => `worshipflow:resposta-pendente:${id}`

/** Lê as respostas que ficaram guardadas neste aparelho. */
function lerRespostasPendentes(id: string): RespostaPendente[] {
  if (typeof window === 'undefined' || !id) return []
  try {
    const raw = window.localStorage.getItem(CHAVE_PENDENTE(id))
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? (data as RespostaPendente[]) : []
  } catch {
    return []
  }
}

/** Grava a lista inteira de respostas pendentes. */
function gravarRespostasPendentes(id: string, lista: RespostaPendente[]) {
  try {
    window.localStorage.setItem(CHAVE_PENDENTE(id), JSON.stringify(lista))
  } catch {
    /* cota cheia no navegador: segue sem guardar */
  }
}

/**
 * Guarda uma resposta de presença para enviar quando o servidor voltar.
 * Devolve `true` se conseguiu guardar no aparelho.
 */
function guardarRespostaPendente(id: string, resposta: RespostaPendente): boolean {
  if (typeof window === 'undefined' || !id) return false
  try {
    // uma resposta por pessoa: a mais recente vale
    const lista = lerRespostasPendentes(id).filter((r) => r.memberId !== resposta.memberId)
    lista.push(resposta)
    gravarRespostasPendentes(id, lista)
    return true
  } catch {
    return false
  }
}

/** Apaga as respostas pendentes (todas chegaram no servidor). */
function limparRespostasPendentes(id: string) {
  try {
    window.localStorage.removeItem(CHAVE_PENDENTE(id))
  } catch {
    /* segue sem mexer */
  }
}

/**
 * Envia a resposta de presença para o servidor.
 *
 * Lança um erro com `status` quando o servidor recusou (4xx) — nesse caso não
 * adianta tentar de novo, a resposta não é guardada na fila.
 */
async function postResposta(
  escalaId: string,
  memberId: string,
  nome: string,
  confirmado: boolean,
): Promise<void> {
  const response = await fetch(apiUrl(`/api/escala?id=${encodeURIComponent(escalaId)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, nome, confirmado }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    const erro = new Error(data.error ?? 'Não foi possível enviar a resposta.') as Error & {
      status?: number
    }
    erro.status = response.status
    throw erro
  }
}

/**
 * Tenta enviar as respostas que ficaram guardadas (o servidor voltou).
 *
 * Resposta recusada de vez (4xx: nome que não bate, pessoa fora da escala) sai
 * da fila — não adianta repetir. Erro de servidor ou de internet fica na fila
 * para a próxima tentativa.
 */
async function enviarPendentesDoServidor(
  escalaId: string,
): Promise<Array<{ memberId: string; confirmed: boolean }>> {
  const pendentes = lerRespostasPendentes(escalaId)
  if (!pendentes.length) return []

  const aceitas: Array<{ memberId: string; confirmed: boolean }> = []
  const restantes: RespostaPendente[] = []

  for (const item of pendentes) {
    try {
      await postResposta(escalaId, item.memberId, item.nome, item.confirmed)
      aceitas.push({ memberId: item.memberId, confirmed: item.confirmed })
    } catch (error) {
      const status = (error as { status?: number }).status
      const recusada =
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        status !== 408 &&
        status !== 429
      if (recusada) continue
      restantes.push(item)
    }
  }

  if (restantes.length) gravarRespostasPendentes(escalaId, restantes)
  else limparRespostasPendentes(escalaId)

  return aceitas
}

/**
 * Página pública da escala: é o link que o ministro manda no WhatsApp.
 *
 * Não exige login — quem não tem e-mail (ou não quer criar conta) abre e
 * confere se está escalado, além de ver o vídeo, a letra e a cifra.
 *
 * A página se **atualiza sozinha**: de tempos em tempos ela pergunta ao
 * servidor se a escala mudou (e também quando o celular volta para a tela),
 * para o integrante ver a versão nova sem precisar recarregar.
 */
export function EscalaPublicaPage() {
  const { id } = useParams()
  /** Começa pela versão salva no aparelho (se houver): a página abre na hora. */
  const [escala, setEscala] = useState<EscalaPublica | null>(() => lerCache(id ?? ''))
  const [erro, setErro] = useState<string | null>(null)
  /** O servidor não respondeu: estamos mostrando a versão salva. */
  const [servidorFora, setServidorFora] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  /** Resposta de presença enviada por esta pessoa (fica salva no aparelho). */
  const [resposta, setResposta] = useState<{
    escalaId: string
    memberId: string
    confirmed: boolean
  } | null>(() => {
    if (typeof window === 'undefined' || !id) return null
    try {
      const raw = window.localStorage.getItem(`worshipflow:resposta:${id}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [enviandoResposta, setEnviandoResposta] = useState(false)
  const [erroResposta, setErroResposta] = useState<string | null>(null)
  /** A resposta ficou guardada no aparelho (servidor fora do ar). */
  const [respostaGuardada, setRespostaGuardada] = useState(false)
  /** Respostas que ainda não chegaram no servidor (fila do aparelho). */
  const [pendentes, setPendentes] = useState<RespostaPendente[]>(() =>
    lerRespostasPendentes(id ?? ''),
  )
  const [activeSong, setActiveSong] = useState<ServiceSong | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const vivo = useRef(true)
  /**
   * A escala que está na tela. Fica num ref (e não no estado) para o
   * `carregar` não depender do estado — senão cada atualização criaria um
   * `carregar` novo e a página ficaria recarregando sem parar.
   */
  const escalaRef = useRef<EscalaPublica | null>(null)

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  // mantém a ref com a escala da tela (sem depender do estado no `carregar`)
  useEffect(() => {
    escalaRef.current = escala
  }, [escala])

  /**
   * Tenta enviar as respostas de presença que ficaram guardadas neste
   * aparelho (o servidor estava fora do ar quando a pessoa respondeu).
   *
   * Roda sozinho: a cada carregamento que dá certo e quando o celular volta
   * para a tela.
   */
  const enviarPendentes = useCallback(async () => {
    if (!id) return
    const aceitas = await enviarPendentesDoServidor(id)
    if (!vivo.current) return
    setPendentes(lerRespostasPendentes(id))
    if (!aceitas.length) return
    const ultima = aceitas[aceitas.length - 1]
    const nova = {
      escalaId: id,
      memberId: ultima.memberId,
      confirmed: ultima.confirmed,
    }
    setResposta(nova)
    try {
      window.localStorage.setItem(`worshipflow:resposta:${id}`, JSON.stringify(nova))
    } catch {
      /* segue sem salvar no aparelho */
    }
    setErroResposta(null)
    setRespostaGuardada(false)
    setPendentes(lerRespostasPendentes(id))
  }, [id])

  /** Busca a escala no servidor (silencioso = sem mostrar a tela de loading). */
  const carregar = useCallback(
    async (silencioso = false) => {
      if (silencioso) setAtualizando(true)

      try {
        const response = await fetch(apiUrl(`/api/escala?id=${encodeURIComponent(id ?? '')}`))
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const erro = new Error(
            data?.error ?? 'Não foi possível carregar a escala.',
          ) as Error & { status?: number }
          erro.status = response.status
          throw erro
        }
        if (!vivo.current) return
        const nova = data?.escala as EscalaPublica
        escalaRef.current = nova
        setEscala(nova)
        if (id) gravarCache(id, nova)
        setErro(null)
        setServidorFora(false)
        setAtualizadoEm(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        )
        // o servidor voltou: manda as respostas que ficaram guardadas aqui
        await enviarPendentes()
      } catch (error) {
        if (!vivo.current) return
        // servidor fora do ar: continua mostrando a versão salva no aparelho
        const status = (error as { status?: number }).status
        if (escalaRef.current) {
          setServidorFora(true)
          if (!silencioso) setErro(null)
          return
        }
        // ainda não tem nada na tela: mostra o que aconteceu de verdade
        if (!silencioso) {
          setErro(
            status === 404
              ? 'Este link de escala não existe (ou foi apagado).'
              : (error instanceof Error
                  ? error.message
                  : 'Não foi possível carregar a escala.'),
          )
        }
      } finally {
        if (vivo.current) {
          setAtualizando(false)
        }
      }
    },
    [id, enviarPendentes],
  )

  // primeira carga
  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timer)
  }, [carregar])

  // atualização automática: de tempos em tempos e quando o celular volta pra
  // tela. O ritmo acompanha o uso (ver `src/lib/poll.ts`): rápido com a tela
  // na frente, devagar com a página parada e quase parado em segundo plano —
  // cada consulta acorda o banco e queima cota do Neon.
  useEffect(() => {
    let timer: number | null = null

    const agendar = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(async () => {
        timer = null
        await carregar(true)
        agendar()
      }, intervaloAgora(INTERVALO_ATUALIZACAO))
    }

    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return
      marcarAtividade()
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
      void carregar(true).finally(() => agendar())
    }

    // a pessoa mexendo na página (abrindo uma música, procurando o nome)
    // mantém o ritmo rápido
    const pararObservador = observarAtividade(() => agendar())
    const pararVigia = vigiarAtividade()

    document.addEventListener('visibilitychange', aoVoltar)
    agendar()

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
      pararObservador()
      pararVigia()
    }
  }, [carregar])

  const termo = busca.trim().toLowerCase()

  const filtrados = useMemo(() => {
    if (!escala) return []
    if (!termo) return escala.equipe
    return escala.equipe.filter(
      (item) =>
        item.nome.toLowerCase().includes(termo) || item.funcao.toLowerCase().includes(termo),
    )
  }, [escala, termo])

  /** Todas as funções da pessoa encontrada (ela pode tocar e cantar, por exemplo). */
  const achou = useMemo(() => {
    if (!termo || !escala) return null
    const encontrados = escala.equipe.filter((item) =>
      item.nome.toLowerCase().includes(termo),
    )
    return encontrados.length ? encontrados : null
  }, [escala, termo])

  /** A resposta que esta pessoa já deu (para mostrar o estado na tela). */
  const minhaResposta =
    resposta &&
    resposta.escalaId === escala?.id &&
    achou?.[0]?.memberId === resposta.memberId
      ? resposta
      : null

  /** Prazo da resposta: a sexta-feira antes do culto. */
  const prazo = escala ? formatarPrazo(escala.date) : null

  /**
   * Envia a resposta de presença ("vou participar" / "não vou").
   *
   * Se o servidor estiver fora do ar (cota do banco, internet), a resposta
   * fica **guardada neste aparelho** e é enviada sozinha assim que o servidor
   * voltar — o músico não perde o voto.
   */
  async function enviarResposta(confirmed: boolean) {
    const pessoa = achou?.[0]
    if (!pessoa || !escala) return
    setEnviandoResposta(true)
    setErroResposta(null)
    setRespostaGuardada(false)
    try {
      await postResposta(escala.id, pessoa.memberId, pessoa.nome, confirmed)
      const nova = { escalaId: escala.id, memberId: pessoa.memberId, confirmed }
      setResposta(nova)
      setErroResposta(null)
      try {
        window.localStorage.setItem(`worshipflow:resposta:${escala.id}`, JSON.stringify(nova))
      } catch {
        /* segue sem salvar no aparelho */
      }
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : 'Não foi possível enviar a resposta.'
      const status = (error as { status?: number }).status
      // o servidor recusou (4xx): guardar não adianta (nome não bate, não está
      // na escala) — o problema é a resposta, não o servidor
      if (status !== undefined && status >= 400 && status < 500) {
        setErroResposta(mensagem)
        return
      }
      // servidor fora do ar: guarda a resposta para enviar quando voltar
      const guardada = guardarRespostaPendente(escala.id, {
        memberId: pessoa.memberId,
        nome: pessoa.nome,
        confirmed,
      })
      if (guardada) {
        const nova = { escalaId: escala.id, memberId: pessoa.memberId, confirmed }
        setResposta(nova)
        setRespostaGuardada(true)
        setPendentes(lerRespostasPendentes(escala.id))
        try {
          window.localStorage.setItem(`worshipflow:resposta:${escala.id}`, JSON.stringify(nova))
        } catch {
          /* segue sem salvar no aparelho */
        }
        setErroResposta(
          'O servidor está fora do ar. Sua resposta ficou guardada neste aparelho e será enviada sozinha assim que ele voltar.',
        )
      } else {
        setErroResposta(mensagem)
      }
    } finally {
      setEnviandoResposta(false)
    }
  }

  if (erro) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-10">
        <EmptyState
          icon={<CalendarDays size={22} />}
          title={
            erro.startsWith('Este link de escala não existe')
              ? 'Escala não encontrada'
              : 'Não consegui carregar a escala agora'
          }
          description={erro}
          action={
            <Button onClick={() => window.location.reload()}>
              <CalendarDays size={15} /> Tentar de novo
            </Button>
          }
        />
      </div>
    )
  }

  // sem escala na tela (nem no cache): só a tela de carregando
  if (!escala) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-sm text-zinc-500">Carregando a escala…</p>
      </div>
    )
  }

  const categorias: Category[] = ['instrumentista', 'vocal', 'tecnica']

  return (
    <div className="min-h-dvh pb-16">
      {/* Cabeçalho */}
      <header className="border-b border-white/8 bg-ink-900/70 px-4 py-4 backdrop-blur-xl">
        {/* No celular a logo fica em uma linha e as opções em baixo, para
            nenhum botão ficar escondido fora da tela. */}
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <Logo size={34} withWordmark />
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <button
              type="button"
              onClick={() => void carregar(true)}
              title="Atualizar agora"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] font-medium text-zinc-300 transition hover:border-neon-cyan/40 hover:text-white"
            >
              <RefreshCw size={12} className={atualizando ? 'animate-spin' : ''} />
              <span className="sm:hidden">
                {atualizadoEm ? `Atualizar · ${atualizadoEm}` : 'Atualizar'}
              </span>
              <span className="hidden sm:inline">
                {atualizadoEm ? `Atualizado às ${atualizadoEm}` : 'Atualizar'}
              </span>
            </button>
            <Link
              to="/login"
              className="min-w-0 flex-1 rounded-full border border-white/10 px-3 py-1.5 text-center text-[0.68rem] font-medium text-zinc-300 transition hover:border-neon-cyan/40 hover:text-white sm:flex-none sm:whitespace-nowrap"
            >
              Sou ministro · entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        {/* Servidor fora do ar: mostramos a versão salva neste aparelho */}
        {servidorFora && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
            <CloudOff size={17} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Mostrando a versão salva neste aparelho.</p>
              <p className="mt-0.5 text-xs opacity-90">
                O servidor está fora do ar agora. Assim que ele voltar, esta página se atualiza
                sozinha — o repertório e a equipe continuam aqui enquanto isso.
              </p>
            </div>
          </div>
        )}

        {/* Resposta guardada: o servidor está fora e ela sai sozinha depois */}
        {pendentes.length > 0 && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
            <Clock size={17} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Sua resposta está guardada neste aparelho.</p>
              <p className="mt-0.5 text-xs opacity-90">
                O servidor está fora do ar agora. Assim que ele voltar, a página envia a resposta
                sozinha — você não precisa fazer nada de novo.
              </p>
            </div>
          </div>
        )}

        {/* Título */}
        <Card className="relative mb-5 overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-neon-cyan/10 blur-3xl" />
          <div className="relative p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  escala.status === 'confirmado'
                    ? 'green'
                    : escala.status === 'rascunho'
                      ? 'gold'
                      : 'neutral'
                }
              >
                {STATUS_LABEL[escala.status]}
              </Badge>
            </div>

            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{escala.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-neon-cyan" />
                {formatDateLong(escala.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={15} className="text-neon-cyan" />
                {formatTime(escala.time)}
              </span>
              {escala.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-neon-cyan" />
                  {escala.location}
                </span>
              )}
            </div>

            {escala.notes && (
              <p className="mt-4 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-zinc-300">
                {escala.notes}
              </p>
            )}
          </div>
        </Card>

        {/* Achar o meu nome */}
        <Card className="mb-5 p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon-cyan/10 text-neon-cyan ring-1 ring-neon-cyan/25">
              <Search size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-white">Estou escalado?</h2>
              <p className="text-xs text-zinc-500">Digite seu nome para achar sua parte.</p>
            </div>
          </div>

          <div className="relative mt-4">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Seu nome…"
              className="pl-9"
            />
          </div>

          {achou && (
            <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/25">
                  <UserRound size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Sim! {achou[0].nome} está na escala.
                  </p>
                  <p className="text-xs text-emerald-200/80">
                    {achou.length > 1 ? 'Suas funções: ' : 'Sua função: '}
                    {achou.map((item) => item.funcao).join(', ')}
                    {achou[0].observacao ? ` · ${achou[0].observacao}` : ''}
                  </p>
                </div>
              </div>

              {/* Resposta de presença: obrigatória para o ministro fechar a equipe */}
              <div className="mt-3 border-t border-emerald-400/15 pt-3">
                {minhaResposta ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                        minhaResposta.confirmed
                          ? 'bg-emerald-400/15 text-emerald-200'
                          : 'bg-amber-400/15 text-amber-200',
                      )}
                    >
                      {minhaResposta.confirmed ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <CircleSlash size={14} />
                      )}
                      {minhaResposta.confirmed
                        ? 'Você confirmou presença'
                        : 'Você avisou que não pode vir'}
                    </span>
                    <button
                      type="button"
                      disabled={enviandoResposta}
                      onClick={() => void enviarResposta(!minhaResposta.confirmed)}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-[0.7rem] font-medium text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                    >
                      Mudar resposta
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-zinc-300">
                      {prazo
                        ? `Avise o ministro até ${prazo} se você vai estar no culto.`
                        : 'Avise o ministro se você vai estar no culto.'}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        onClick={() => void enviarResposta(true)}
                        disabled={enviandoResposta}
                      >
                        <CheckCircle2 size={15} /> Vou participar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void enviarResposta(false)}
                        disabled={enviandoResposta}
                      >
                        <CircleSlash size={15} /> Não vou
                      </Button>
                    </div>
                  </>
                )}

                {enviandoResposta && (
                  <p className="mt-2 text-[0.7rem] text-zinc-400">Enviando sua resposta…</p>
                )}
                {erroResposta && (
                  <p
                    className={cn(
                      'mt-2 text-[0.7rem]',
                      respostaGuardada ? 'text-amber-300' : 'text-red-300',
                    )}
                  >
                    {erroResposta}
                  </p>
                )}
              </div>
            </div>
          )}

          {termo && !achou && (
            <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
              Não achei esse nome na escala de hoje. Se você deveria estar aqui, fale com o
              ministro.
            </p>
          )}
        </Card>

        {/* Equipe */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          {categorias.map((categoria) => {
            const itens = filtrados.filter((item) => item.categoria === categoria)
            return (
              <Card key={categoria} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                    {categoria === 'instrumentista' ? (
                      <Music2 size={17} className="text-neon-cyan" />
                    ) : categoria === 'vocal' ? (
                      <Users size={17} className="text-neon-purple" />
                    ) : (
                      <SlidersHorizontal size={17} className="text-neon-gold" />
                    )}
                    {CATEGORY_LABEL[categoria]}
                  </h2>
                  <Badge
                    tone={
                      categoria === 'instrumentista'
                        ? 'cyan'
                        : categoria === 'vocal'
                          ? 'purple'
                          : 'gold'
                    }
                  >
                    {itens.length}
                  </Badge>
                </div>

                {itens.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-zinc-500">
                    {termo ? 'Ninguém encontrado aqui.' : 'Ninguém escalado nesta parte.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {itens.map((item) => (
                      <li
                        key={`${item.memberId}-${item.funcao}`}
                        className={cn(
                          'flex items-center gap-3 px-5 py-3',
                          termo &&
                            item.nome.toLowerCase().includes(termo) &&
                            'bg-emerald-400/8',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ring-1',
                            item.categoria === 'instrumentista'
                              ? 'bg-neon-cyan/12 text-neon-cyan ring-neon-cyan/25'
                              : item.categoria === 'vocal'
                                ? 'bg-neon-purple/12 text-neon-purple ring-neon-purple/25'
                                : 'bg-neon-gold/12 text-neon-gold ring-neon-gold/25',
                          )}
                        >
                          {item.nome.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-100">{item.nome}</p>
                          <p className="text-xs text-zinc-500">
                            {item.funcao}
                            {item.observacao ? ` · ${item.observacao}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>

        {/* Repertório */}
        <Card className="overflow-hidden">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Music2 size={18} className="text-neon-gold" />
              Repertório
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Toque na música para ouvir o áudio, abrir o vídeo, a letra e a cifra.
            </p>
          </div>

          <div className="p-5">
            {escala.musicas.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma música definida para este culto.</p>
            ) : (
              <ol className="space-y-2">
                {escala.musicas.map((song, index) => {
                  const media = song.link ? describeMedia(song.link) : null
                  const sourceStyle = media ? SOURCE_STYLE[media.source] : null
                  const completa: ServiceSong = {
                    title: song.title,
                    artist: song.artist ?? undefined,
                    link: song.link ?? undefined,
                    lyrics: song.lyrics ?? undefined,
                    chords: song.chords ?? undefined,
                    key: song.key ?? undefined,
                    bpm: song.bpm ?? undefined,
                    progression: song.progression ?? undefined,
                    audioId: song.audioId ?? undefined,
                    audioName: song.audioName ?? undefined,
                    audioSize: song.audioSize ?? undefined,
                  }

                  return (
                    <li key={`${song.title}-${index}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSong(completa)
                          setViewerOpen(true)
                        }}
                        className="group flex w-full items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-3.5 py-3 text-left transition hover:border-neon-cyan/30 hover:bg-neon-cyan/5"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neon-gold/12 text-xs font-bold text-neon-gold">
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-100">{song.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {song.artist && (
                              <span className="truncate text-[0.7rem] text-zinc-500">
                                {song.artist}
                              </span>
                            )}
                            {song.key && (
                              <span className="rounded-md bg-neon-gold/12 px-1.5 py-0.5 text-[0.62rem] font-bold text-neon-gold">
                                {song.key}
                              </span>
                            )}
                            {media && sourceStyle && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-semibold ring-1',
                                  sourceStyle.chip,
                                )}
                              >
                                <Play size={9} /> {media.label}
                              </span>
                            )}
                            {song.audioId && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-400/12 px-1.5 py-0.5 text-[0.62rem] font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                                <FileAudio size={10} /> MP3
                              </span>
                            )}
                            {song.lyrics?.trim() && (
                              <span className="inline-flex items-center gap-1 text-[0.62rem] text-zinc-500">
                                <FileText size={10} /> letra
                              </span>
                            )}
                            {song.chords?.trim() && (
                              <span className="inline-flex items-center gap-1 text-[0.62rem] text-zinc-500">
                                <Guitar size={10} /> cifra
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-500 transition group-hover:bg-neon-cyan/15 group-hover:text-neon-cyan">
                          <Play size={14} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Esta escala é pública para a equipe. Para editar, o ministro entra no painel.
        </p>
      </main>

      {/* Visualizador interno de música (vídeo em cima, letra/cifra embaixo) */}
      <SongViewer song={activeSong} open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  )
}

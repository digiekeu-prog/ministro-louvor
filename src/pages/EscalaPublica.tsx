import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  FileText,
  Guitar,
  MapPin,
  Music2,
  Play,
  RefreshCw,
  Search,
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
import { cn, formatDateLong, formatTime } from '../lib/utils'

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
  }>
}

/** De quanto em quanto tempo a página procura a versão nova da escala (ms). */
const INTERVALO_ATUALIZACAO = 8000

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
  const [escala, setEscala] = useState<EscalaPublica | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [activeSong, setActiveSong] = useState<ServiceSong | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  /** Busca a escala no servidor (silencioso = sem mostrar a tela de loading). */
  const carregar = useCallback(
    async (silencioso = false) => {
      if (silencioso) setAtualizando(true)

      try {
        const response = await fetch(apiUrl(`/api/escala?id=${encodeURIComponent(id ?? '')}`))
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.error ?? 'Não foi possível carregar a escala.')
        if (!vivo.current) return
        setEscala(data?.escala as EscalaPublica)
        setErro(null)
        setAtualizadoEm(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        )
      } catch (error) {
        if (!vivo.current) return
        // se já tem escala na tela, continua mostrando (offline) e tenta depois
        if (!silencioso) {
          setErro(error instanceof Error ? error.message : 'Não foi possível carregar a escala.')
        }
      } finally {
        if (vivo.current) {
          setCarregando(false)
          setAtualizando(false)
        }
      }
    },
    [id],
  )

  // primeira carga
  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timer)
  }, [carregar])

  // atualização automática: de tempos em tempos e quando o celular volta pra tela
  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void carregar(true)
    }, INTERVALO_ATUALIZACAO)

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void carregar(true)
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
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

  const achou = useMemo(() => {
    if (!termo || !escala) return null
    return escala.equipe.find((item) => item.nome.toLowerCase().includes(termo)) ?? null
  }, [escala, termo])

  if (erro) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-10">
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="Escala não encontrada"
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

  if (carregando || !escala) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-sm text-zinc-500">Carregando a escala…</p>
      </div>
    )
  }

  const categorias: Category[] = ['instrumentista', 'vocal']

  return (
    <div className="min-h-dvh pb-16">
      {/* Cabeçalho */}
      <header className="border-b border-white/8 bg-ink-900/70 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Logo size={34} withWordmark />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void carregar(true)}
              title="Atualizar agora"
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] font-medium text-zinc-300 transition hover:border-neon-cyan/40 hover:text-white"
            >
              <RefreshCw size={12} className={atualizando ? 'animate-spin' : ''} />
              {atualizadoEm ? `Atualizado às ${atualizadoEm}` : 'Atualizar'}
            </button>
            <Link
              to="/login"
              className="rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] font-medium text-zinc-300 transition hover:border-neon-cyan/40 hover:text-white"
            >
              Sou ministro · entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
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
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/25">
                <UserRound size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Sim, {achou.nome} está escalado!</p>
                <p className="text-xs text-emerald-200/80">
                  Sua função: {achou.funcao}
                  {achou.observacao ? ` · ${achou.observacao}` : ''}
                </p>
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
                    ) : (
                      <Users size={17} className="text-neon-purple" />
                    )}
                    {CATEGORY_LABEL[categoria]}
                  </h2>
                  <Badge tone={categoria === 'instrumentista' ? 'cyan' : 'purple'}>
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
                              : 'bg-neon-purple/12 text-neon-purple ring-neon-purple/25',
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
              Toque na música para abrir o vídeo, a letra e a cifra.
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

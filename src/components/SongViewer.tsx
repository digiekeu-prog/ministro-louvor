import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Guitar,
  Info,
  Maximize2,
  Minus,
  Music4,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Video,
  X,
} from 'lucide-react'
import type { ServiceSong } from '../lib/types'
import { SOURCE_STYLE, describeMedia } from '../lib/mediaLinks'
import { stripChordLines } from '../lib/chordSheet'
import { Badge, Button, IconButton } from './ui'
import { Portal } from './Portal'
import { cn } from '../lib/utils'
import { useDraggable } from '../hooks/useDraggable'

/** 'letra' = só as palavras; 'cifra' = letra com os acordes em cima. */
type TextTab = 'letra' | 'cifra'

/** Velocidade base do "rolar" da letra (pixels por segundo em 1x). */
const SCROLL_BASE = 26
const MIN_SPEED = 0.5
const MAX_SPEED = 3
const SPEED_STEP = 0.5

interface SongViewerProps {
  song: ServiceSong | null
  open: boolean
  onClose: () => void
}

/**
 * Visualizador de música que abre DENTRO do aplicativo (sem sair da tela):
 * vídeo no topo e letra/cifra logo abaixo, visíveis ao mesmo tempo — o
 * músico acompanha o vídeo enquanto lê a letra sem trocar de aba.
 */
export function SongViewer({ song, open, onClose }: SongViewerProps) {
  const [tab, setTab] = useState<TextTab>('letra')
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [lastSongId, setLastSongId] = useState(song?.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { panelRef, offset, dragging, handlePointerDown, reset } = useDraggable(open)

  // ao trocar de música, prioriza o que o músico mais precisa no palco
  if (song && lastSongId !== song.id) {
    setLastSongId(song.id)
    setTab(song.lyrics?.trim() ? 'letra' : 'cifra')
    setCopied(false)
    setPlaying(false)
  }

  /** Rola a letra/cifra automaticamente, do topo ao fim. */
  useEffect(() => {
    if (!playing) return
    let last = performance.now()

    const tick = () => {
      const now = performance.now()
      const delta = (now - last) / 1000
      last = now
      const element = scrollRef.current
      if (element) {
        const max = element.scrollHeight - element.clientHeight
        if (element.scrollTop >= max - 1) {
          setPlaying(false)
          return
        }
        element.scrollTop += SCROLL_BASE * speed * delta
      }
    }

    const timer = window.setInterval(tick, 50)
    return () => window.clearInterval(timer)
  }, [playing, speed])

  useEffect(() => {
    if (!open || !song) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, song, onClose])

  const media = useMemo(() => (song?.link ? describeMedia(song.link) : null), [song])

  /** O YouTube recusa tocar embed quando o app é aberto pelo IP (127.0.0.1). */
  const openedByIp = useMemo(
    () => typeof window !== 'undefined' && /^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname),
    [],
  )

  const embedSrc = useMemo(() => {
    if (!media?.embedUrl) return null
    if (media.source === 'youtube') {
      const sep = media.embedUrl.includes('?') ? '&' : '?'
      return `${media.embedUrl}${sep}origin=${encodeURIComponent(window.location.origin)}`
    }
    return media.embedUrl
  }, [media])

  /** Letra limpa: a cadastrada ou, se não houver, extraída da própria cifra. */
  const onlyLyrics = useMemo(() => {
    if (song?.lyrics?.trim()) return song.lyrics
    if (song?.chords?.trim()) return stripChordLines(song.chords)
    return ''
  }, [song])

  /** Texto com os acordes alinhados acima da letra. */
  const sheet = useMemo(() => {
    if (song?.chords?.trim()) return song.chords
    if (song?.lyrics?.trim()) return song.lyrics
    return ''
  }, [song])

  if (!open || !song) return null

  const hasLyrics = Boolean(song.lyrics?.trim())
  const hasChords = Boolean(song.chords?.trim())
  const style = media ? SOURCE_STYLE[media.source] : null
  const hasSheet = Boolean(sheet.trim())

  async function copyText() {
    const content = [song?.lyrics, song?.chords].filter(Boolean).join('\n\n———\n\n')
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard bloqueado pelo navegador */
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-5">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-black/85 backdrop-blur-sm"
        />

        <div
          ref={panelRef}
          style={
            offset
              ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
              : undefined
          }
          className="relative z-10 flex max-h-[96dvh] w-full max-w-3xl flex-col"
        >
          <div
            className={cn(
              'panel flex min-h-0 flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl',
              dragging ? 'shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]' : '',
            )}
          >
            {/* Cabeçalho */}
            <div
              onPointerDown={handlePointerDown}
              className={cn(
                'flex touch-none shrink-0 items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
              )}
            >
              <div className="min-w-0 select-none">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {media && style && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ring-1',
                        style.chip,
                      )}
                    >
                      {media.label}
                    </span>
                  )}
                  {song.key && <Badge tone="gold">Tom {song.key}</Badge>}
                  {song.bpm && <Badge tone="cyan">{song.bpm} BPM</Badge>}
                  {song.progression && (
                    <span className="rounded-full bg-neon-purple/12 px-2 py-0.5 font-mono text-[0.62rem] font-semibold text-neon-purple ring-1 ring-neon-purple/25">
                      {song.progression}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                  {song.title}
                </h2>
                {song.artist && <p className="mt-0.5 text-sm text-zinc-400">{song.artist}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {offset && (
                  <button
                    type="button"
                    onClick={reset}
                    aria-label="Centralizar"
                    title="Centralizar janela"
                    className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <Maximize2 size={17} />
                  </button>
                )}
                <IconButton onClick={onClose} aria-label="Fechar">
                  <X size={19} />
                </IconButton>
              </div>
            </div>

            {/* Vídeo no topo */}
            <div className="shrink-0 border-b border-white/8 px-4 py-3 sm:px-5">
              {embedSrc ? (
                <div className="space-y-2.5">
                  {openedByIp && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-neon-gold/25 bg-neon-gold/8 px-3.5 py-2.5 text-xs text-neon-gold">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      <p>
                        O YouTube não reproduz vídeo quando o app é aberto pelo IP. Acesse
                        <span className="mx-1 font-semibold">http://localhost:5173</span>
                        para o vídeo tocar dentro do app.
                      </p>
                    </div>
                  )}
                  <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ maxWidth: 'min(100%, 46vh)' }}>
                    <iframe
                      src={embedSrc}
                      title={song.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                </div>
              ) : media ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 px-4 py-5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-zinc-500 ring-1 ring-white/10">
                    <Info size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-white">
                      {media.label} não pode ser exibido dentro do app
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      A letra e a cifra ficam logo abaixo — o músico não precisa sair do app.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 px-4 py-5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-zinc-500 ring-1 ring-white/10">
                    <Music4 size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-white">
                      Nenhum link de áudio cadastrado
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      O ministro pode adicionar um link de YouTube, Vimeo, Spotify ou outro
                      endereço em “Editar escala”.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Letra / cifra embaixo */}
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Um único botão alterna: só a letra  <->  letra com as cifras */}
              {hasSheet && (
                <div className="flex shrink-0 items-center gap-2 px-4 pt-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => {
                      setTab((current) => (current === 'letra' ? 'cifra' : 'letra'))
                      scrollRef.current?.scrollTo({ top: 0 })
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
                      tab === 'letra'
                        ? 'bg-neon-gold/12 text-neon-gold ring-1 ring-neon-gold/25 hover:bg-neon-gold/20'
                        : 'bg-neon-purple/12 text-neon-purple ring-1 ring-neon-purple/25 hover:bg-neon-purple/20',
                    )}
                  >
                    {tab === 'letra' ? <Guitar size={15} /> : <FileText size={15} />}
                    {tab === 'letra' ? 'Ver com as cifras' : 'Ver só a letra'}
                  </button>
                  <p className="min-w-0 truncate text-[0.7rem] text-zinc-500">
                    {tab === 'letra'
                      ? 'letra grande, sem cifragem'
                      : 'cifra alinhada acima da letra'}
                  </p>
                </div>
              )}

              {/* Rodar a letra automaticamente */}
              {(hasLyrics || hasChords) && (
                <div className="flex shrink-0 items-center gap-2 px-4 py-2.5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setPlaying((value) => !value)}
                    aria-label={playing ? 'Pausar' : 'Rodar a letra'}
                    title={playing ? 'Pausar' : 'Rodar a letra automaticamente'}
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition',
                      playing
                        ? 'bg-neon-cyan text-ink-950 shadow-[0_0_18px_-4px_rgba(34,211,238,0.8)]'
                        : 'bg-neon-cyan/12 text-neon-cyan ring-1 ring-neon-cyan/25 hover:bg-neon-cyan/20',
                    )}
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  <div className="flex items-center gap-0.5 rounded-xl bg-white/4 p-0.5 ring-1 ring-white/8">
                    <button
                      type="button"
                      onClick={() => setSpeed((value) => Math.max(MIN_SPEED, +(value - SPEED_STEP).toFixed(1)))}
                      disabled={speed <= MIN_SPEED}
                      aria-label="Diminuir velocidade"
                      className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-11 text-center text-xs font-bold tabular-nums text-neon-cyan">
                      {speed.toFixed(1)}x
                    </span>
                    <button
                      type="button"
                      onClick={() => setSpeed((value) => Math.min(MAX_SPEED, +(value + SPEED_STEP).toFixed(1)))}
                      disabled={speed >= MAX_SPEED}
                      aria-label="Aumentar velocidade"
                      className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      scrollRef.current?.scrollTo({ top: 0 })
                    }}
                    aria-label="Voltar ao topo"
                    title="Voltar ao topo"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    <RotateCcw size={15} />
                  </button>

                  <p className="min-w-0 truncate text-[0.7rem] text-zinc-500">
                    {playing ? 'rolando a letra…' : 'rola a letra sozinho enquanto o vídeo toca'}
                  </p>
                </div>
              )}

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {tab === 'letra' ? (
                  onlyLyrics.trim() ? (
                    <div className="rounded-2xl border border-white/8 bg-ink-900/60 p-5 sm:p-6">
                      <p className="whitespace-pre-wrap font-display text-[1.05rem] leading-[1.9] text-zinc-200">
                        {onlyLyrics}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
                      <FileText size={22} className="mx-auto mb-3 text-zinc-600" />
                      <p className="font-display text-base font-semibold text-white">
                        Letra não cadastrada
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-zinc-400">
                        Peça ao ministro para colar a letra em “Editar escala → Repertório”.
                      </p>
                    </div>
                  )
                ) : hasSheet ? (
                  <div className="rounded-2xl border border-white/8 bg-ink-900/60 p-5 sm:p-6">
                    <pre className="overflow-x-auto whitespace-pre font-mono text-[0.82rem] leading-[1.7] text-zinc-200 sm:text-sm">
                      {sheet}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
                    <Guitar size={22} className="mx-auto mb-3 text-zinc-600" />
                    <p className="font-display text-base font-semibold text-white">
                      Cifra não cadastrada
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-zinc-400">
                      {song.progression
                        ? `A progressão principal é ${song.progression}. A cifra completa pode ser adicionada pelo ministro.`
                        : 'O ministro pode colar a cifra em “Editar escala → Repertório”.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/8 px-5 py-3 sm:px-6">
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                <Video size={13} /> Vídeo no topo, letra embaixo — sem sair do app
              </span>
              {(hasLyrics || hasChords) && (
                <Button size="sm" variant="secondary" onClick={copyText}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar letra/cifra'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

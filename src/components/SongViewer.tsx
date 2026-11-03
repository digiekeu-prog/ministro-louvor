import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Guitar,
  Info,
  Maximize2,
  Music4,
  Video,
  X,
} from 'lucide-react'
import type { ServiceSong } from '../lib/types'
import { SOURCE_STYLE, describeMedia } from '../lib/mediaLinks'
import { Badge, Button, IconButton, Segmented } from './ui'
import { Portal } from './Portal'
import { cn } from '../lib/utils'
import { useDraggable } from '../hooks/useDraggable'

type TextTab = 'letra' | 'cifra'

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
  const [lastSongId, setLastSongId] = useState(song?.id)
  const { panelRef, offset, dragging, handlePointerDown, reset } = useDraggable(open)

  // ao trocar de música, prioriza o que o músico mais precisa no palco
  if (song && lastSongId !== song.id) {
    setLastSongId(song.id)
    setTab(song.lyrics?.trim() ? 'letra' : 'cifra')
    setCopied(false)
  }

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

  if (!open || !song) return null

  const hasLyrics = Boolean(song.lyrics?.trim())
  const hasChords = Boolean(song.chords?.trim())
  const style = media ? SOURCE_STYLE[media.source] : null

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
              {(hasLyrics || hasChords) && (
                <div className="shrink-0 px-4 pt-3 sm:px-5">
                  <Segmented
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: 'letra', label: 'Letra', icon: <FileText size={14} /> },
                      { value: 'cifra', label: 'Cifra', icon: <Guitar size={14} /> },
                    ]}
                  />
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {tab === 'letra' ? (
                  hasLyrics ? (
                    <div className="rounded-2xl border border-white/8 bg-ink-900/60 p-5 sm:p-6">
                      <p className="whitespace-pre-wrap font-display text-[1.05rem] leading-[1.9] text-zinc-200">
                        {song.lyrics}
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
                ) : hasChords ? (
                  <div className="rounded-2xl border border-white/8 bg-ink-900/60 p-5 sm:p-6">
                    <pre className="overflow-x-auto whitespace-pre font-mono text-[0.82rem] leading-[1.7] text-zinc-200 sm:text-sm">
                      {song.chords}
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

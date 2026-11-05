import { useRef, useState } from 'react'
import { FileAudio, Loader2, Music4, Trash2, Upload } from 'lucide-react'
import { audioUrl, formatBytes, removeAudio, uploadAudio } from '../lib/audio'
import type { ServiceSong } from '../lib/types'
import { cn } from '../lib/utils'

interface SongAudioFieldProps {
  song: ServiceSong
  /** Avisa o editor que a música mudou (para ele salvar junto com o resto). */
  onChange: (patch: Partial<ServiceSong>) => void
  /** Mostra um aviso temporário na tela do editor. */
  onMessage: (message: string) => void
}

/**
 * Campo de áudio da música: o ministro envia um MP3 e a equipe ouve dentro do
 * app (inclusive pelo link público da escala), sem depender do YouTube.
 */
export function SongAudioField({ song, onChange, onMessage }: SongAudioFieldProps) {
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleArquivo(file: File | undefined) {
    if (!file) return
    setEnviando(true)
    setProgresso(0)
    setErro(null)
    try {
      const resultado = await uploadAudio(file, setProgresso)
      onChange({
        audioId: resultado.id,
        audioName: resultado.nome,
        audioSize: resultado.tamanho,
      })
      onMessage(`Áudio enviado. Agora é só salvar a escala para a equipe ouvir.`)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível enviar o áudio.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemover() {
    const id = song.audioId
    onChange({ audioId: undefined, audioName: undefined, audioSize: undefined })
    if (id) await removeAudio(id)
    onMessage('Áudio removido desta música.')
  }

  if (song.audioId) {
    return (
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
            <FileAudio size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-100">
              {song.audioName ?? 'Áudio enviado'}
            </p>
            <p className="text-[0.68rem] text-zinc-500">
              MP3 no servidor{song.audioSize ? ` · ${formatBytes(song.audioSize)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRemover()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label="Remover áudio"
            title="Remover áudio"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <audio
          controls
          preload="metadata"
          src={audioUrl(song.audioId)}
          className="mt-2.5 h-9 w-full"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-white/12 bg-ink-950/30 p-3 transition',
        enviando && 'border-neon-cyan/30',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/*,.mp3,.m4a,.aac,.ogg"
        className="hidden"
        onChange={(e) => void handleArquivo(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {enviando ? `Enviando… ${progresso}%` : 'Enviar MP3'}
        </button>
        <p className="min-w-0 flex-1 text-[0.68rem] text-zinc-500">
          Para quando a música não está no YouTube — a equipe ouve o arquivo dentro do app.
        </p>
      </div>

      {enviando && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-neon-cyan transition-[width]"
            style={{ width: `${progresso}%` }}
          />
        </div>
      )}

      {erro && (
        <p className="mt-2 flex items-start gap-1.5 text-[0.7rem] text-red-300">
          <Music4 size={13} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  )
}

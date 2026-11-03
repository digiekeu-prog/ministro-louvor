import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Guitar,
  MapPin,
  Music2,
  Pencil,
  Play,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState } from '../components/ui'
import { SongViewer } from '../components/SongViewer'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import type { Category, ServiceSong } from '../lib/types'
import { CATEGORY_LABEL, CATEGORY_SINGULAR, STATUS_LABEL } from '../lib/types'
import { SOURCE_STYLE, describeMedia } from '../lib/mediaLinks'
import { cn, formatDateLong, formatTime, relativeDay } from '../lib/utils'

export function EscalaDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { getService, getMember, setPresence, isConfirmed } = useData()

  const [activeSong, setActiveSong] = useState<ServiceSong | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const service = getService(id)

  if (!service) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} />}
        title="Escala não encontrada"
        description="Ela pode ter sido removida pelo ministro."
        action={<Button onClick={() => navigate('/app/escalas')}>Voltar para escalas</Button>}
      />
    )
  }

  const categories: Category[] = ['instrumentista', 'vocal']
  const mySlot = service.slots.find((slot) => slot.memberId === user?.id)
  const confirmed = user ? isConfirmed(user.id, service.id) : false

  return (
    <div className="pb-10">
      <button
        type="button"
        onClick={() => navigate('/app/escalas')}
        className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft size={16} /> Todas as escalas
      </button>

      {/* Cabeçalho */}
      <Card className="relative mb-5 overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-neon-cyan/10 blur-3xl" />
        <div className="relative p-5 sm:p-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={service.status === 'confirmado' ? 'green' : service.status === 'rascunho' ? 'gold' : 'neutral'}>
              {STATUS_LABEL[service.status]}
            </Badge>
            <Badge tone="cyan">{relativeDay(service.date)}</Badge>
          </div>

          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{service.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={15} className="text-neon-cyan" />
              {formatDateLong(service.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={15} className="text-neon-cyan" />
              {formatTime(service.time)}
            </span>
            {service.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={15} className="text-neon-cyan" />
                {service.location}
              </span>
            )}
          </div>

          {service.notes && (
            <p className="mt-4 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-zinc-300">
              {service.notes}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            {isAdmin && (
              <Button onClick={() => navigate(`/app/escalas/${service.id}/editar`)}>
                <Pencil size={15} /> Editar escala
              </Button>
            )}
            {user && mySlot && (
              <Button
                variant={confirmed ? 'secondary' : 'primary'}
                onClick={() => setPresence(user.id, service.id, !confirmed)}
              >
                {confirmed ? <Check size={15} /> : <ThumbsUp size={15} />}
                {confirmed ? 'Presença confirmada' : 'Confirmar presença'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ============ MINHA FUNÇÃO (visão do músico) ============ */}
      {mySlot && (
        <div className="mb-5 overflow-hidden rounded-3xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/12 via-neon-cyan/4 to-neon-purple/10 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-neon-cyan">
                Sua função neste culto
              </p>
              <p className="font-display text-3xl font-extrabold text-white sm:text-4xl">
                {mySlot.functionName}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="cyan">{CATEGORY_SINGULAR[mySlot.category]}</Badge>
                {confirmed && <Badge tone="green">Presença confirmada</Badge>}
              </div>
              {mySlot.notes && (
                <p className="mt-3 text-sm text-zinc-300">Obs.: {mySlot.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={user?.name ?? ''} hue={user?.hue ?? 190} size={62} ring />
            </div>
          </div>
        </div>
      )}

      {/* Divisão da equipe */}
      <div className="grid gap-5 lg:grid-cols-2">
        {categories.map((category) => {
          const slots = service.slots.filter((slot) => slot.category === category)
          const filled = slots.filter((slot) => slot.memberId)

          return (
            <Card key={category} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                  {category === 'instrumentista' ? (
                    <Music2 size={18} className="text-neon-cyan" />
                  ) : (
                    <Users size={18} className="text-neon-purple" />
                  )}
                  {CATEGORY_LABEL[category]}
                </h2>
                <Badge tone={category === 'instrumentista' ? 'cyan' : 'purple'}>
                  {filled.length}/{slots.length}
                </Badge>
              </div>

              {slots.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
                  Nenhuma função definida para esta categoria.
                </p>
              ) : (
                <div className="divide-y divide-white/5">
                  {slots.map((slot) => {
                    const member = getMember(slot.memberId)
                    const isMe = slot.memberId === user?.id
                    const memberConfirmed =
                      slot.memberId && isConfirmed(slot.memberId, service.id)

                    return (
                      <div
                        key={slot.id}
                        className={`flex items-center gap-3.5 px-5 py-3.5 transition ${
                          isMe ? 'bg-neon-cyan/8' : ''
                        }`}
                      >
                        <Avatar
                          name={member?.name ?? '?'}
                          hue={member?.hue ?? 200}
                          size={42}
                          ring={isMe}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-zinc-100">
                              {member?.name ?? 'Vaga em aberto'}
                            </p>
                            {isMe && <Badge tone="cyan">Você</Badge>}
                            {memberConfirmed && (
                              <Check size={13} className="text-emerald-400" aria-label="Confirmou" />
                            )}
                          </div>
                          <p
                            className={`mt-0.5 text-xs ${
                              member
                                ? category === 'instrumentista'
                                  ? 'text-neon-cyan/90'
                                  : 'text-neon-purple/90'
                                : 'text-zinc-600'
                            }`}
                          >
                            {member ? slot.functionName : `${slot.functionName} · sem responsável`}
                          </p>
                          {slot.notes && (
                            <p className="mt-1 text-[0.7rem] text-zinc-500">{slot.notes}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Repertório */}
      <Card className="mt-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <Music2 size={18} className="text-neon-gold" />
            <h2 className="font-display text-lg font-semibold text-white">Repertório</h2>
          </div>
          <p className="hidden text-xs text-zinc-500 sm:block">
            Toque para abrir vídeo, letra e cifra
          </p>
        </div>
        <div className="p-5">
          {service.songs.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma música definida para este culto.</p>
          ) : (
            <ol className="space-y-2">
              {service.songs.map((song, index) => {
                const media = song.link ? describeMedia(song.link) : null
                const sourceStyle = media ? SOURCE_STYLE[media.source] : null

                return (
                  <li key={`${song.title}-${index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSong(song)
                        setViewerOpen(true)
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-3.5 py-3 text-left transition hover:border-neon-cyan/30 hover:bg-neon-cyan/5"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neon-gold/12 text-xs font-bold text-neon-gold">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {song.title}
                        </p>
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

      {/* Visualizador interno de música */}
      <SongViewer song={activeSong} open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  )
}

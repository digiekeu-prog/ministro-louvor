import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight, Music2, Users } from 'lucide-react'
import { PageTitle } from '../components/AppShell'
import { Badge, Card, EmptyState } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import { CATEGORY_SINGULAR, STATUS_LABEL } from '../lib/types'
import { formatDateLong, formatTime, relativeDay } from '../lib/utils'

export function MinhaEscalaPage() {
  const { user } = useAuth()
  const { services, isConfirmed } = useData()
  const navigate = useNavigate()

  const myServices = useMemo(() => {
    if (!user) return []
    return services
      .filter((s) => s.slots.some((slot) => slot.memberId === user.id))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  }, [services, user])

  const upcoming = myServices.filter((s) => s.date >= new Date().toISOString().slice(0, 10))
  const past = myServices.filter((s) => s.date < new Date().toISOString().slice(0, 10)).reverse()

  function renderService(service: (typeof myServices)[number]) {
    const slot = service.slots.find((s) => s.memberId === user?.id)!
    const confirmed = isConfirmed(user!.id, service.id)
    const team = service.slots.filter((s) => s.memberId).length

    return (
      <button
        key={service.id}
        type="button"
        onClick={() => navigate(`/app/escalas/${service.id}`)}
        className="group w-full text-left"
      >
        <Card className="flex items-center gap-4 p-4 transition-all group-hover:border-neon-cyan/25 sm:p-5">
          {/* Minha função */}
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-cyan/15 to-neon-purple/15 text-center ring-1 ring-white/10">
            <div className="leading-tight">
              <p className="font-display text-sm font-extrabold text-white">
                {slot.functionName.length > 9 ? slot.functionName.slice(0, 8) + '…' : slot.functionName}
              </p>
              <p className="mt-0.5 text-[0.55rem] uppercase tracking-wider text-neon-cyan">
                {CATEGORY_SINGULAR[slot.category]}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-base font-semibold text-white">
                {service.title}
              </h3>
              <Badge tone={service.status === 'confirmado' ? 'green' : service.status === 'rascunho' ? 'gold' : 'neutral'}>
                {STATUS_LABEL[service.status]}
              </Badge>
              {confirmed && (
                <Badge tone="green">
                  <Check size={11} /> Confirmado
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {formatDateLong(service.date)} · {formatTime(service.time)}
              {service.location ? ` · ${service.location}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Users size={12} /> {team} na equipe
              </span>
              <span className="flex items-center gap-1.5">
                <Music2 size={12} /> {service.songs.length} música(s)
              </span>
              <span className="text-neon-cyan">{relativeDay(service.date)}</span>
            </div>
          </div>

          <ChevronRight
            size={18}
            className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-neon-cyan"
          />
        </Card>
      </button>
    )
  }

  return (
    <div>
      <PageTitle
        eyebrow="Sua agenda"
        title="Minha escala"
        description="Todos os cultos em que você está escalado e a função que exerce em cada um."
      />

      {!user ? null : myServices.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="Você ainda não está em nenhuma escala"
          description="Assim que o ministro definir sua função em um culto, ela aparece aqui."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Próximos
            </h2>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-zinc-500">
                Nenhum culto futuro no momento.
              </p>
            ) : (
              <div className="space-y-3">{upcoming.map(renderService)}</div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Anteriores
              </h2>
              <div className="space-y-3">{past.map(renderService)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarPlus, CalendarDays, ChevronRight, Clock, MapPin, Music2, Search } from 'lucide-react'
import { PageTitle } from '../components/AppShell'
import { Avatar, Badge, Button, Card, EmptyState, Input, Segmented } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import type { ServiceStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import { formatDateLong, formatTime, relativeDay } from '../lib/utils'

type Filter = 'proximas' | 'todas' | 'rascunho' | 'realizadas'

export function EscalasPage() {
  const { services, getMember } = useData()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('proximas')
  const [query, setQuery] = useState('')

  const sorted = useMemo(
    () => [...services].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [services],
  )

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return sorted.filter((s) => {
      const matchesQuery =
        !query.trim() ||
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.location?.toLowerCase().includes(query.toLowerCase()) ||
        s.slots.some((slot) => getMember(slot.memberId)?.name.toLowerCase().includes(query.toLowerCase()))
      if (!matchesQuery) return false

      switch (filter) {
        case 'proximas':
          return s.date >= today && s.status !== 'realizado'
        case 'rascunho':
          return s.status === 'rascunho'
        case 'realizadas':
          return s.status === 'realizado'
        default:
          return true
      }
    })
  }, [sorted, filter, query, getMember])

  const statusTone = (status: ServiceStatus) =>
    status === 'confirmado' ? 'green' : status === 'rascunho' ? 'gold' : 'neutral'

  return (
    <div>
      <PageTitle
        eyebrow="Agenda"
        title="Escalas"
        description="Todos os cultos do ministério e a divisão de equipe de cada um."
        action={
          isAdmin ? (
            <Button onClick={() => navigate('/app/escalas/nova')}>
              <CalendarPlus size={17} /> Nova escala
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          className="sm:w-auto"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'proximas', label: 'Próximas' },
            { value: 'todas', label: 'Todas' },
            { value: 'rascunho', label: 'Rascunhos' },
            { value: 'realizadas', label: 'Realizadas' },
          ]}
        />
        <div className="relative sm:ml-auto sm:w-72">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar culto ou integrante..."
            className="pl-10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="Nenhuma escala encontrada"
          description={
            isAdmin
              ? 'Crie uma escala e defina quem toca o quê e quem canta.'
              : 'Não há escalas publicadas para este filtro.'
          }
          action={
            isAdmin ? (
              <Button onClick={() => navigate('/app/escalas/nova')}>
                <CalendarPlus size={16} /> Criar escala
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3.5">
          {filtered.map((service) => {
            const filled = service.slots.filter((s) => s.memberId).length
            const total = service.slots.length
            const members = service.slots
              .map((slot) => ({ slot, member: getMember(slot.memberId) }))
              .filter((x) => x.member)

            return (
              <Link key={service.id} to={`/app/escalas/${service.id}`} className="group">
                <Card className="flex flex-col gap-4 p-4 transition-all group-hover:border-neon-cyan/25 group-hover:shadow-[0_18px_50px_-30px_rgba(34,211,238,0.6)] sm:flex-row sm:items-center sm:p-5">
                  {/* Data */}
                  <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-cyan/15 to-neon-purple/15 text-center ring-1 ring-white/10">
                      <div className="leading-none">
                        <p className="font-display text-lg font-extrabold text-white">
                          {Number(service.date.slice(8, 10))}
                        </p>
                        <p className="mt-0.5 text-[0.58rem] font-semibold uppercase tracking-wider text-neon-cyan">
                          {new Date(`${service.date}T12:00:00`).toLocaleDateString('pt-BR', {
                            month: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="sm:hidden">
                      <p className="text-sm font-semibold text-white">{service.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {formatTime(service.time)} · {relativeDay(service.date)}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="hidden items-center gap-2 sm:flex">
                      <h3 className="truncate font-display text-lg font-semibold text-white">
                        {service.title}
                      </h3>
                      <Badge tone={statusTone(service.status)}>{STATUS_LABEL[service.status]}</Badge>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-zinc-500" />
                        {formatTime(service.time)}
                      </span>
                      <span className="hidden items-center gap-1.5 sm:flex">
                        <CalendarDays size={13} className="text-zinc-500" />
                        {formatDateLong(service.date)}
                      </span>
                      {service.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-zinc-500" />
                          {service.location}
                        </span>
                      )}
                    </div>

                    {/* Equipe preview */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {members.slice(0, 6).map(({ slot, member }) => (
                          <span key={slot.id} title={`${member!.name} · ${slot.functionName}`}>
                            <Avatar
                              name={member!.name}
                              hue={member!.hue}
                              size={28}
                              className="ring-2 ring-ink-850"
                            />
                          </span>
                        ))}
                        {members.length > 6 && (
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-700 text-[0.62rem] font-semibold text-zinc-300 ring-2 ring-ink-850">
                            +{members.length - 6}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {filled}/{total} funções preenchidas
                        {total - filled > 0 && (
                          <span className="ml-1 text-neon-gold">· {total - filled} em aberto</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Songs */}
                  <div className="hidden items-center gap-1.5 text-xs text-zinc-500 lg:flex">
                    <Music2 size={14} />
                    {service.songs.length}
                  </div>

                  <ChevronRight
                    size={18}
                    className="hidden shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-neon-cyan sm:block"
                  />
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

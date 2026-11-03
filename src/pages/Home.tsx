import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Clock,
  MapPin,
  Music2,
  Sparkles,
  Users,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { Greeting } from '../components/AppShell'
import { Avatar, Badge, Button, Card, EmptyState } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import { CATEGORY_SINGULAR, STATUS_LABEL } from '../lib/types'
import { formatDateLong, formatTime, relativeDay } from '../lib/utils'

export function HomePage() {
  const { user, isAdmin } = useAuth()
  const { services, getMember } = useData()
  const navigate = useNavigate()

  const upcoming = [...services]
    .filter((s) => new Date(`${s.date}T${s.time || '00:00'}`).getTime() >= Date.now() - 86400000)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))

  const nextService = upcoming[0]
  const mySlot = nextService?.slots.find((slot) => slot.memberId === user?.id)
  const myNext = upcoming.find((s) => s.slots.some((slot) => slot.memberId === user?.id))

  const stats = [
    {
      label: 'Escalas futuras',
      value: upcoming.length,
      icon: <CalendarDays size={18} />,
      tone: 'text-neon-cyan',
    },
    {
      label: 'Integrantes',
      value: new Set(services.flatMap((s) => s.slots.map((sl) => sl.memberId))).size,
      icon: <Users size={18} />,
      tone: 'text-neon-purple',
    },
    {
      label: 'Músicas na repertório',
      value: nextService?.songs.length ?? 0,
      icon: <Music2 size={18} />,
      tone: 'text-neon-gold',
    },
  ]

  return (
    <div>
      {/* Hero */}
      <div className="panel relative mb-7 overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-neon-purple/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-56 w-56 rounded-full bg-neon-cyan/12 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <Logo size={38} />
            </div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-neon-cyan/80">
              Ministério de Louvor
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold text-white sm:text-[1.9rem]">
              <Greeting name={user?.name ?? ''} />
            </h1>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {isAdmin
                ? 'Organize os cultos, divida a equipe por função e acompanhe quem confirmou presença.'
                : 'Abra sua escala e veja com clareza o que você vai tocar ou cantar no próximo culto.'}
            </p>
          </div>

          {isAdmin && (
            <Button size="lg" onClick={() => navigate('/app/escalas/nova')} className="shrink-0">
              <CalendarPlus size={18} />
              Nova escala
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4 p-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 ${stat.tone}`}>
              {stat.icon}
            </span>
            <div>
              <p className="font-display text-xl font-bold text-white">{stat.value}</p>
              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-zinc-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Próximo culto */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <Sparkles size={18} className="text-neon-gold" />
                Próximo culto
              </h2>
              <Link
                to="/app/escalas"
                className="flex items-center gap-1 text-xs font-medium text-neon-cyan hover:underline"
              >
                Ver todas <ArrowRight size={13} />
              </Link>
            </div>

            {nextService ? (
              <div className="p-5">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={nextService.status === 'confirmado' ? 'green' : 'gold'}>
                        {STATUS_LABEL[nextService.status]}
                      </Badge>
                      <Badge tone="cyan">{relativeDay(nextService.date)}</Badge>
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">{nextService.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-zinc-500" />
                        {formatTime(nextService.time)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-zinc-500" />
                        {formatDateLong(nextService.date)}
                      </span>
                      {nextService.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-zinc-500" />
                          {nextService.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(`/app/escalas/${nextService.id}`)}>
                    Abrir escala <ArrowRight size={15} />
                  </Button>
                </div>

                {/* Mini equipe */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {(['instrumentista', 'vocal'] as const).map((category) => {
                    const slots = nextService.slots.filter((s) => s.category === category)
                    return (
                      <div key={category} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {category === 'instrumentista' ? 'Instrumentistas' : 'Vocais'}
                          <span className="ml-2 text-zinc-600">({slots.length})</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => {
                            const member = getMember(slot.memberId)
                            return member ? (
                              <div
                                key={slot.id}
                                className="flex items-center gap-2 rounded-xl bg-ink-800 px-2.5 py-1.5 ring-1 ring-white/8"
                              >
                                <Avatar name={member.name} hue={member.hue} size={26} />
                                <div className="leading-tight">
                                  <p className="text-xs font-medium text-zinc-200">{member.name.split(' ')[0]}</p>
                                  <p className="text-[0.62rem] text-neon-cyan/90">{slot.functionName}</p>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={slot.id}
                                className="rounded-xl border border-dashed border-white/12 px-2.5 py-1.5 text-xs text-zinc-600"
                              >
                                {slot.functionName} · vazio
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<CalendarDays size={22} />}
                  title="Nenhum culto agendado"
                  description={
                    isAdmin
                      ? 'Crie a primeira escala para dividir a equipe do culto.'
                      : 'Quando o ministro publicar uma escala, ela aparecerá aqui.'
                  }
                  action={
                    isAdmin ? (
                      <Button onClick={() => navigate('/app/escalas/nova')}>
                        <CalendarPlus size={16} /> Criar escala
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </Card>
        </div>

        {/* Minha função */}
        <div>
          <Card className="h-full p-5">
            <h2 className="mb-4 font-display text-lg font-semibold text-white">Minha função</h2>

            {mySlot && myNext ? (
              <div className="rounded-2xl border border-neon-cyan/25 bg-gradient-to-br from-neon-cyan/12 via-transparent to-neon-purple/10 p-5">
                <Badge tone="cyan">{CATEGORY_SINGULAR[mySlot.category]}</Badge>
                <p className="mt-3 font-display text-2xl font-extrabold text-white">
                  {mySlot.functionName}
                </p>
                <p className="mt-1 text-sm text-zinc-300">{myNext.title}</p>
                <div className="mt-4 space-y-1.5 text-xs text-zinc-400">
                  <p className="flex items-center gap-2">
                    <CalendarDays size={13} className="text-neon-cyan" />
                    {formatDateLong(myNext.date)} · {formatTime(myNext.time)}
                  </p>
                  {myNext.location && (
                    <p className="flex items-center gap-2">
                      <MapPin size={13} className="text-neon-cyan" />
                      {myNext.location}
                    </p>
                  )}
                </div>
                <Button
                  className="mt-5 w-full"
                  variant="secondary"
                  onClick={() => navigate(`/app/escalas/${myNext.id}`)}
                >
                  Ver escala completa
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={<Music2 size={22} />}
                title="Você ainda não está escalado"
                description="Quando o ministro definir sua função em um culto, ela aparece aqui em destaque."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

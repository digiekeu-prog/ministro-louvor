import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Home,
  LogOut,
  Music2,
  UserRound,
  Users,
} from 'lucide-react'
import { Logo } from './Logo'
import { Avatar } from './ui'
import { SyncAlertBanner, SyncBadge, SyncOfferBanner } from './SyncStatus'
import { useAuth } from '../store/AuthContext'
import { cn, firstName, initials } from '../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  adminOnly?: boolean
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Início', icon: <Home size={19} />, end: true },
  { to: '/app/escalas', label: 'Escalas', icon: <CalendarDays size={19} /> },
  { to: '/app/minha-escala', label: 'Minha escala', icon: <Music2 size={19} /> },
  { to: '/app/equipe', label: 'Equipe', icon: <Users size={19} />, adminOnly: true },
  { to: '/app/perfil', label: 'Perfil', icon: <UserRound size={19} /> },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = NAV.filter((item) => !item.adminOnly || isAdmin)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* ---------------------------- Sidebar desktop ---------------------------- */}
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-white/8 bg-ink-900/70 px-5 py-6 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Logo size={44} withWordmark />
        </div>

        <nav className="mt-9 flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-neon-cyan/15 to-neon-purple/10 text-white ring-1 ring-white/10'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 h-6 w-1 rounded-r-full transition-all',
                      isActive
                        ? 'bg-gradient-to-b from-neon-cyan to-neon-purple opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <span className={cn(isActive ? 'text-neon-cyan' : 'text-zinc-500 group-hover:text-zinc-300')}>
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive && <ChevronRight size={15} className="ml-auto text-zinc-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-white/5 to-transparent p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name ?? '?'} hue={user?.hue ?? 200} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-zinc-500">
                {isAdmin
                  ? 'Ministro'
                  : user?.category === 'vocal'
                    ? 'Vocal'
                    : user?.category === 'tecnica'
                      ? 'Equipe técnica'
                      : 'Instrumentista'}
              </p>
            </div>
          </div>
          <SyncBadge className="mt-3 w-full justify-center" />
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* -------------------------------- Main -------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-900/75 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <Logo size={36} withWordmark />
            <div className="flex items-center gap-2">
              <SyncBadge />
              <button
                type="button"
                onClick={() => navigate('/app/perfil')}
                className="flex items-center gap-2 rounded-full ring-1 ring-white/10 transition hover:ring-neon-cyan/40"
              >
                <Avatar name={user?.name ?? '?'} hue={user?.hue ?? 200} size={34} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9">
          <div key={location.pathname} className="animate-fade-up">
            <SyncAlertBanner />
            <SyncOfferBanner />
            {children}
          </div>
        </main>

        {/* --------------------------- Bottom nav mobile --------------------------- */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-ink-900/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="flex items-stretch justify-around">
            {items.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.62rem] font-medium transition-colors',
                    isActive ? 'text-neon-cyan' : 'text-zinc-500',
                  )
                }
              >
                {item.icon}
                <span className="max-w-full truncate px-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-neon-cyan/80">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours()
  const period = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  return (
    <span>
      {period}, {firstName(name)} <span aria-hidden>👋</span>
    </span>
  )
}

export { initials }

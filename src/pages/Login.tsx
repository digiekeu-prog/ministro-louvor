import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, LogIn, Mail, Music4, ShieldCheck, Users } from 'lucide-react'
import { Logo } from '../components/Logo'
import { Button, Field, Input } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'

export function LoginPage() {
  const { login, loginAs } = useAuth()
  const { members } = useData()
  const navigate = useNavigate()

  const [email, setEmail] = useState('admin@worshipflow.app')
  const [password, setPassword] = useState('123456')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const demoAccounts = [
    { member: members.find((m) => m.category === 'admin'), label: 'Ministro (Admin)' },
    { member: members.find((m) => m.id === 'mem_wesley'), label: 'Instrumentista' },
    { member: members.find((m) => m.id === 'mem_renata'), label: 'Vocal' },
  ].filter((a) => a.member)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = login(email, password)
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível entrar.')
      return
    }
    navigate('/app', { replace: true })
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-neon-cyan/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[460px] w-[460px] rounded-full bg-neon-purple/10 blur-[130px]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="animate-float-slow">
            <Logo size={86} animated />
          </div>
          <h1 className="mt-5 font-display text-[2.1rem] font-extrabold leading-none tracking-tight text-white">
            Worship<span className="neon-text">Flow</span>
          </h1>
          <p className="mt-2.5 text-sm text-zinc-400">
            Escalas, divisão de equipe e presença — em um só lugar.
          </p>
        </div>

        {/* Card */}
        <div className="panel rounded-3xl p-6 sm:p-7">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-neon-cyan/10 text-neon-cyan ring-1 ring-neon-cyan/25">
              <LogIn size={17} />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-white">Entrar na conta</h2>
              <p className="text-xs text-zinc-500">Acesse a escala do ministério</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-mail">
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  placeholder="voce@igreja.com"
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
            </Field>

            <Field label="Senha">
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="••••••••"
                  className="pl-10 pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-200"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full">
              Entrar
              <LogIn size={17} />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/8" />
            <span className="text-[0.68rem] uppercase tracking-[0.2em] text-zinc-600">
              Acesso rápido
            </span>
            <span className="h-px flex-1 bg-white/8" />
          </div>

          <div className="space-y-2">
            {demoAccounts.map((account) => (
              <button
                key={account.member!.id}
                type="button"
                onClick={() => {
                  loginAs(account.member!.id)
                  navigate('/app', { replace: true })
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3.5 py-2.5 text-left transition hover:border-neon-cyan/30 hover:bg-neon-cyan/5"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-zinc-400">
                  {account.member!.category === 'admin' ? (
                    <ShieldCheck size={15} />
                  ) : account.member!.category === 'vocal' ? (
                    <Music4 size={15} />
                  ) : (
                    <Users size={15} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-200">
                    {account.member!.name}
                  </span>
                  <span className="block text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500">
                    {account.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          WorshipFlow · Ministério de Louvor · v1.0
        </p>
      </div>
    </div>
  )
}

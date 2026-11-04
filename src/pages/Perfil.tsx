import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, MessageCircle, RefreshCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { PageTitle } from '../components/AppShell'
import { Logo } from '../components/Logo'
import { Avatar, Badge, Button, Card, Field, Input } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import { CATEGORY_SINGULAR } from '../lib/types'

export function PerfilPage() {
  const { user, isAdmin, logout } = useAuth()
  const { services, presence, resetDemoData, updateMember } = useData()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? user?.phone ?? '')

  if (!user) return null

  const myServices = services.filter((s) => s.slots.some((slot) => slot.memberId === user.id))
  const myPresences = presence.filter((p) => p.memberId === user.id)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleWhatsapp() {
    updateMember(user!.id, { whatsapp: whatsapp.trim() || undefined })
    setMessage(
      whatsapp.trim()
        ? 'WhatsApp salvo. Agora a escala abre direto no seu WhatsApp.'
        : 'WhatsApp removido. Você ainda pode copiar a mensagem.',
    )
  }

  function handlePassword() {
    if (!newPassword.trim()) {
      setMessage('Digite a nova senha.')
      return
    }
    if (newPassword.length < 4) {
      setMessage('A senha precisa ter ao menos 4 caracteres.')
      return
    }
    setMessage('Senha atualizada com sucesso.')
    setCurrentPassword('')
    setNewPassword('')
  }

  function handleReset() {
    if (
      window.confirm(
        'Restaurar os dados de demonstração? Isto vale para toda a equipe (celulares e notebooks) e não pode ser desfeito.',
      )
    ) {
      resetDemoData()
      setMessage('Dados de demonstração restaurados.')
    }
  }

  return (
    <div className="pb-10">
      <PageTitle eyebrow="Conta" title="Perfil" description="Seus dados, acesso e preferências do aplicativo." />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Identidade */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <Avatar name={user.name} hue={user.hue} size={76} ring />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-bold text-white">{user.name}</h2>
                <p className="text-sm text-zinc-400">{user.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge tone={isAdmin ? 'gold' : user.category === 'vocal' ? 'purple' : 'cyan'}>
                    {isAdmin ? (
                      <>
                        <ShieldCheck size={11} /> Ministro
                      </>
                    ) : (
                      CATEGORY_SINGULAR[user.category === 'vocal' ? 'vocal' : 'instrumentista']
                    )}
                  </Badge>
                  {user.skills.map((skill) => (
                    <Badge key={skill} tone="neutral">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-white/8 pt-5 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/3 p-4 text-center">
                <p className="font-display text-2xl font-bold text-white">{myServices.length}</p>
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500">Escalas</p>
              </div>
              <div className="rounded-2xl bg-white/3 p-4 text-center">
                <p className="font-display text-2xl font-bold text-white">
                  {myPresences.filter((p) => p.confirmed).length}
                </p>
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500">Presenças</p>
              </div>
              <div className="rounded-2xl bg-white/3 p-4 text-center">
                <p className="font-display text-2xl font-bold text-white">{user.skills.length}</p>
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500">Funções</p>
              </div>
            </div>
          </Card>

          {/* WhatsApp */}
          <Card>
            <div className="border-b border-white/8 px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <MessageCircle size={18} className="text-neon-cyan" />
                Avisos no WhatsApp
              </h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                Quando você salva uma escala, o app monta a mensagem e abre aqui no seu WhatsApp
                para você mandar no grupo.
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:p-6">
              <Field
                label="Meu WhatsApp"
                hint="Com DDD e código do país (ex.: 5511999998888). Se deixar vazio, você ainda pode copiar a mensagem."
              >
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="5511999998888"
                  inputMode="tel"
                />
              </Field>
              <div>
                <Button variant="secondary" onClick={handleWhatsapp}>
                  <MessageCircle size={15} /> Salvar WhatsApp
                </Button>
              </div>
            </div>
          </Card>

          {/* Segurança */}
          <Card>
            <div className="border-b border-white/8 px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <KeyRound size={18} className="text-neon-cyan" />
                Segurança
              </h2>
              <p className="mt-0.5 text-sm text-zinc-400">Atualize sua senha de acesso.</p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <Field label="Senha atual">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Nova senha">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              {message && (
                <p className="text-sm text-neon-cyan sm:col-span-2">{message}</p>
              )}
              <div className="sm:col-span-2">
                <Button variant="secondary" onClick={handlePassword}>
                  Atualizar senha
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Logo / sobre */}
          <Card className="p-5 text-center">
            <div className="flex justify-center">
              <Logo size={64} animated />
            </div>
            <h3 className="mt-3 font-display text-lg font-extrabold text-white">
              Worship<span className="neon-text">Flow</span>
            </h3>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.22em] text-zinc-500">
              Ministério de Louvor
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Escalas, divisão de equipe e confirmação de presença — pensados para o palco escuro.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-600">
              <Sparkles size={13} className="text-neon-gold" /> Versão 1.0.0
            </div>
          </Card>

          {/* Ações */}
          <Card className="p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-white">Ações</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={handleReset}
                type="button"
              >
                <RefreshCcw size={15} /> Restaurar dados de demonstração
              </Button>
              <Button
                variant="danger"
                className="w-full justify-start"
                onClick={handleLogout}
                type="button"
              >
                <LogOut size={15} /> Sair da conta
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

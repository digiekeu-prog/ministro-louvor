import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Member } from '../lib/types'
import { STORAGE_KEYS, readStore, removeStore, writeStore } from '../lib/storage'
import { AuthContext } from './contexts'
import type { AuthContextValue } from './contexts'
import { hasToken, resumeSync, syncLogin, syncLogout, useSyncStatus } from '../lib/sync'

type SessionUser = { id: string; email: string; name?: string; category?: Member['category'] }

/** Mensagem que explica, em português, por que o acesso foi recusado. */
function mensagemDeRecusa(reason?: string, fallback?: string): string {
  switch (reason) {
    case 'desconhecido':
      return 'Este e-mail não está mais na lista da equipe do servidor. Fale com o ministro para voltar a ter acesso.'
    case 'inativo':
      return 'Esta conta está inativa. Fale com o ministro para reativar o acesso.'
    case 'sem_conexao':
      return 'Sem conexão com o servidor. Os dados ficarão só neste aparelho até a internet voltar.'
    default:
      return fallback ?? 'Não foi possível entrar.'
  }
}

/**
 * Sessão da equipe.
 *
 * A senha continua sendo livre (como sempre foi): o que garante o acesso é a
 * lista de membros que fica no servidor compartilhado — quem não está nela
 * não entra. Sem internet, o app ainda abre com os dados salvos no aparelho.
 */
export function AuthProvider({
  children,
  members,
}: {
  children: ReactNode
  members: Member[]
}) {
  const [session, setSession] = useState<SessionUser | null>(() =>
    readStore<SessionUser | null>(STORAGE_KEYS.session, null),
  )
  /** aviso mostrado na tela de login (ex.: acesso removido da lista da equipe) */
  const [authError, setAuthError] = useState<string | null>(null)
  const status = useSyncStatus()

  useEffect(() => {
    if (session) writeStore(STORAGE_KEYS.session, session)
    else removeStore(STORAGE_KEYS.session)
  }, [session])

  // o servidor recusou a sessão (o e-mail saiu da lista da equipe ou o token
  // venceu): encerra a sessão local e explica o motivo na tela de login
  useEffect(() => {
    if (status.state !== 'sem_acesso') return
    setSession(null)
    setAuthError(
      status.message ??
        'Seu acesso foi removido da lista da equipe. Fale com o ministro para voltar a entrar.',
    )
  }, [status.state, status.message])

  // já existe sessão salva? então volta a sincronizar com a nuvem
  useEffect(() => {
    if (!session) return
    if (hasToken()) {
      resumeSync()
      return
    }
    // aparelho que entrou antes da sincronização existir: pede o token agora
    let cancelado = false
    void syncLogin(session.email).then((result) => {
      if (cancelado) return
      if (result.ok || result.offline) return
      // o servidor não conhece mais esta conta: encerra a sessão
      setSession(null)
      setAuthError(mensagemDeRecusa(result.reason, result.error))
    })
    return () => {
      cancelado = true
    }
  }, [session])

  const user = useMemo(() => {
    if (!session) return null
    const found = members.find((m) => m.id === session.id)
    if (found) return found
    // a lista local ainda não recebeu o membro (acabou de entrar em outro
    // aparelho): usa os dados que o servidor devolveu
    if (session.name) {
      return {
        id: session.id,
        name: session.name,
        email: session.email,
        category: session.category ?? 'vocal',
        skills: [],
        hue: 190,
        active: true,
      } satisfies Member
    }
    return null
  }, [session, members])

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase()
      if (!normalized) return { ok: false, error: 'Informe o e-mail.' }
      if (!password) return { ok: false, error: 'Informe a senha.' }

      // primeiro o servidor (a lista de membros compartilhada é a oficial)
      const remote = await syncLogin(normalized)

      if (!remote.ok && !remote.offline) {
        const mensagem = mensagemDeRecusa(remote.reason, remote.error)
        setAuthError(mensagem)
        return { ok: false, error: mensagem }
      }

      // sem internet: vale a lista que está salva neste aparelho
      if (remote.offline) {
        const local = members.find((m) => m.email.toLowerCase() === normalized)
        if (!local) return { ok: false, error: 'Não encontramos uma conta com esse e-mail.' }
        if (!local.active) return { ok: false, error: 'Esta conta está inativa. Fale com o ministro.' }
        setSession({ id: local.id, email: local.email })
        setAuthError(null)
        return {
          ok: true,
          warning: 'Sem internet: os dados ficarão só neste aparelho até a conexão voltar.',
        }
      }

      const info = remote.user
      setSession({
        id: info?.id ?? normalized,
        email: info?.email ?? normalized,
        name: info?.name,
        category: info?.category,
      })
      setAuthError(null)
      return { ok: true }
    },
    [members],
  )

  const loginAs = useCallback(
    async (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member) return { ok: false, error: 'Integrante não encontrado.' }
      const remote = await syncLogin(member.email)
      if (!remote.ok && !remote.offline) {
        const mensagem = mensagemDeRecusa(remote.reason, remote.error)
        setAuthError(mensagem)
        return { ok: false, error: mensagem }
      }
      setSession({
        id: member.id,
        email: member.email,
        name: member.name,
        category: member.category,
      })
      setAuthError(null)
      return { ok: true }
    },
    [members],
  )

  const logout = useCallback(() => {
    syncLogout()
    setSession(null)
    setAuthError(null)
  }, [])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAdmin: user?.category === 'admin',
      authError,
      clearAuthError,
      login,
      loginAs,
      logout,
    }),
    [session, user, authError, clearAuthError, login, loginAs, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

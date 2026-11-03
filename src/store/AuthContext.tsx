import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Member } from '../lib/types'
import { STORAGE_KEYS, readStore, removeStore, writeStore } from '../lib/storage'
import { AuthContext } from './contexts'
import type { AuthContextValue } from './contexts'
import { hasToken, resumeSync, syncLogin, syncLogout } from '../lib/sync'

type SessionUser = { id: string; email: string; name?: string; category?: Member['category'] }

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

  useEffect(() => {
    if (session) writeStore(STORAGE_KEYS.session, session)
    else removeStore(STORAGE_KEYS.session)
  }, [session])

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
      // o servidor não conhece mais esta conta: encerra a session
      if (!result.ok && !result.offline) setSession(null)
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

      // primeiro o servidor (a lista de-members compartilhada é a oficial)
      const remote = await syncLogin(normalized)

      if (!remote.ok && !remote.offline) {
        return { ok: false, error: remote.error ?? 'Não foi possível entrar.' }
      }

      // sem internet: vale a lista que está salva neste aparelho
      if (remote.offline) {
        const local = members.find((m) => m.email.toLowerCase() === normalized)
        if (!local) return { ok: false, error: 'Não encontramos uma conta com esse e-mail.' }
        if (!local.active) return { ok: false, error: 'Esta conta está inativa. Fale com o ministro.' }
        setSession({ id: local.id, email: local.email })
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
      return { ok: true }
    },
    [members],
  )

  const loginAs = useCallback(
    async (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member) return
      await syncLogin(member.email)
      setSession({ id: member.id, email: member.email, name: member.name, category: member.category })
    },
    [members],
  )

  const logout = useCallback(() => {
    syncLogout()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAdmin: user?.category === 'admin',
      login,
      loginAs,
      logout,
    }),
    [session, user, login, loginAs, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

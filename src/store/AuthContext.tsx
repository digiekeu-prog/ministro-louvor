import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Member } from '../lib/types'
import { STORAGE_KEYS, readStore, removeStore, writeStore } from '../lib/storage'
import { AuthContext } from './contexts'
import type { AuthContextValue } from './contexts'

type SessionUser = { id: string; email: string }

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

  const user = useMemo(
    () => (session ? members.find((m) => m.id === session.id) ?? null : null),
    [session, members],
  )

  const login = useCallback(
    (email: string, password: string) => {
      const normalized = email.trim().toLowerCase()
      if (!normalized) return { ok: false, error: 'Informe o e-mail.' }
      if (!password) return { ok: false, error: 'Informe a senha.' }

      const member = members.find((m) => m.email.toLowerCase() === normalized)
      if (!member) return { ok: false, error: 'Não encontramos uma conta com esse e-mail.' }
      if (!member.active) return { ok: false, error: 'Esta conta está inativa. Fale com o ministro.' }

      setSession({ id: member.id, email: member.email })
      return { ok: true }
    },
    [members],
  )

  const loginAs = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member) return
      setSession({ id: member.id, email: member.email })
    },
    [members],
  )

  const logout = useCallback(() => setSession(null), [])

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

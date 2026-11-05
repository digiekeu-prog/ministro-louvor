import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Member, SessionUser } from '../lib/types'
import { STORAGE_KEYS, readStore, removeStore, writeStore } from '../lib/storage'
import { AuthContext } from './contexts'
import type { AuthContextValue } from './contexts'
import { hasToken, markOffline, markServerError, resumeSync, syncLogin, syncLogout, useSyncStatus } from '../lib/sync'
import { phoneKey, samePhone } from '../lib/phone'

/** Sessão salva antes da troca do login (e-mail → celular). */
type StoredSession = SessionUser & { email?: string }

/** Mensagem que explica, em português, por que o acesso foi recusado. */
function mensagemDeRecusa(reason?: string, fallback?: string): string {
  switch (reason) {
    case 'desconhecido':
      return 'Este celular não está mais na lista da equipe do servidor. Fale com o ministro para voltar a ter acesso.'
    case 'inativo':
      return 'Esta conta está inativa. Fale com o ministro para reativar o acesso.'
    case 'sem_conexao':
      return 'Sem conexão com o servidor. Os dados ficarão só neste aparelho até a internet voltar.'
    default:
      return fallback ?? 'Não foi possível entrar.'
  }
}

/** Procura um integrante pelo e-mail antigo (dados salvos antes da troca). */
function membroComEmailAntigo(members: Member[], email: string): Member | undefined {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return undefined
  return members.find((member) => {
    const antigo = (member as Member & { email?: string }).email ?? ''
    return antigo.trim().toLowerCase() === normalized
  })
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
  // A sessão salva pode ainda ser do login antigo (por e-mail): guardamos o
  // formato cru para conseguir trocar pelo celular sem desconectar ninguém.
  const [session, setSession] = useState<StoredSession | null>(() =>
    readStore<StoredSession | null>(STORAGE_KEYS.session, null),
  )
  const [authError, setAuthError] = useState<string | null>(null)
  const status = useSyncStatus()

  // o servidor recusou a sessão (o celular saiu da lista da equipe ou o token
  // venceu): encerra a sessão local e explica o motivo na tela de login
  useEffect(() => {
    if (status.state !== 'sem_acesso') return
    setSession(null)
    setAuthError(
      status.message ??
        'Seu acesso foi removido da lista da equipe. Fale com o ministro para voltar a entrar.',
    )
  }, [status.state, status.message])

  // Sessão salva antes da troca do login (e-mail → celular): troca o e-mail
  // antigo pelo celular do cadastro, para ninguém ser desconectado na hora.
  const sessao = useMemo<SessionUser | null>(() => {
    if (!session) return null
    if (session.phone) {
      return {
        id: session.id,
        phone: session.phone,
        name: session.name,
        category: session.category,
      }
    }
    const antigo = session.email ?? ''
    // a lista de membros ainda não carregou: espera (não desconecta ninguém)
    if (!members.length) {
      return { id: session.id, phone: '', name: session.name, category: session.category }
    }
    const member = membroComEmailAntigo(members, antigo)
    if (!member?.phone) return null
    return {
      id: member.id,
      phone: member.phone,
      name: member.name,
      category: member.category,
    }
  }, [session, members])

  /** A sessão antiga existia, mas não dá mais para entrar com ela. */
  const erroDeSessao =
    session && !sessao ? 'Seu acesso mudou: entre agora com o seu celular.' : null

  // guarda a sessão (já no formato novo: celular)
  useEffect(() => {
    if (sessao?.phone) writeStore(STORAGE_KEYS.session, sessao)
    else if (!session) removeStore(STORAGE_KEYS.session)
  }, [sessao, session])

  // já existe sessão salva? então volta a sincronizar com a nuvem
  useEffect(() => {
    if (!sessao?.phone) return
    if (hasToken()) {
      resumeSync()
      return
    }

    // aparelho que entrou antes da sincronização existir (ou que entrou sem
    // internet): pede o token agora e **tenta de novo** de tempos em tempos,
    // para voltar a sincronizar sozinho quando a internet voltar.
    let cancelado = false
    let timer: number | null = null
    /** Tentativas já feitas — a espera dobra a cada uma. */
    let tentativas = 0

    const tentarToken = async () => {
      if (cancelado || hasToken()) return
      const result = await syncLogin(sessao.phone)
      if (cancelado) return
      if (result.ok) return
      if (result.offline) {
        // sem internet: avisa na tela e tenta de novo em instantes
        markOffline(
          'Sem conexão com o servidor. Você entrou offline: assim que a internet voltar, o app volta a sincronizar sozinho.',
        )
        tentativas += 1
        return
      }
      if (result.reason === 'erro') {
        // o servidor respondeu, mas deu erro (5xx, banco fora, cota do Neon):
        // não é recusa de acesso — o app espera e tenta de novo, sem encerrar
        // a sessão do ministro.
        markServerError(
          'O servidor está com problema agora. Assim que ele voltar, o app volta a sincronizar sozinho.',
        )
        tentativas += 1
        return
      }
      // o servidor não conhece mais esta conta: encerra a sessão
      setSession(null)
      setAuthError(mensagemDeRecusa(result.reason, result.error))
    }

    const agendar = () => {
      if (cancelado || hasToken()) return
      // 15s, 30s, 1min, 2min… até 5min: não martela o servidor — e o servidor
      // é justamente o que acorda o banco (e queima a cota do Neon).
      const espera = Math.min(15000 * 2 ** tentativas, 300000)
      timer = window.setTimeout(async () => {
        timer = null
        await tentarToken()
        agendar()
      }, espera)
    }

    void tentarToken()
    agendar()

    return () => {
      cancelado = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [sessao])

  const user = useMemo(() => {
    if (!sessao) return null
    const found = members.find((m) => m.id === sessao.id)
    if (found) return found
    // a lista local ainda não recebeu o membro (acabou de entrar em outro
    // aparelho): usa os dados que o servidor devolveu
    if (sessao.name) {
      return {
        id: sessao.id,
        name: sessao.name,
        phone: sessao.phone,
        category: sessao.category ?? 'vocal',
        skills: [],
        hue: 190,
        active: true,
      } satisfies Member
    }
    return null
  }, [sessao, members])

  const login = useCallback(
    async (telefone: string, password: string) => {
      const key = phoneKey(telefone)
      if (!key) return { ok: false, error: 'Informe o celular.' }
      if (!password) return { ok: false, error: 'Informe a senha.' }

      // primeiro o servidor (a lista de membros compartilhada é a oficial)
      const remote = await syncLogin(key)

      // o servidor recusou o acesso (celular fora da lista / conta inativa)
      if (!remote.ok && !remote.offline && remote.reason !== 'erro') {
        const mensagem = mensagemDeRecusa(remote.reason, remote.error)
        setAuthError(mensagem)
        return { ok: false, error: mensagem }
      }

      // sem internet (ou servidor fora do ar): vale a lista que está salva
      // neste aparelho — o ministro entra e o app volta a sincronizar sozinho
      // quando o servidor voltar. A senha é livre; o que vale é o celular.
      if (remote.offline || remote.reason === 'erro') {
        const local = members.find((m) => samePhone(m.phone, key))
        if (!local) {
          const mensagem = remote.offline
            ? 'Não encontramos uma conta com esse celular.'
            : 'O servidor está fora do ar e esse celular não está na lista salva neste aparelho. Tente de novo quando o servidor voltar.'
          setAuthError(mensagem)
          return { ok: false, error: mensagem }
        }
        if (!local.active) return { ok: false, error: 'Esta conta está inativa. Fale com o ministro.' }
        if (remote.offline) {
          markOffline(
            'Sem conexão com o servidor. Os dados ficarão só neste aparelho até a internet voltar.',
          )
        } else {
          markServerError(
            'O servidor está com problema agora. Os dados ficarão só neste aparelho até o servidor voltar.',
          )
        }
        setSession({
          id: local.id,
          phone: local.phone ?? key,
          name: local.name,
          category: local.category,
        })
        setAuthError(null)
        return {
          ok: true,
          warning: remote.offline
            ? 'Sem internet: os dados ficarão só neste aparelho até a conexão voltar.'
            : 'Servidor fora do ar: os dados ficarão só neste aparelho até o servidor voltar.',
        }
      }

      const info = remote.user
      setSession({
        id: info?.id ?? key,
        phone: info?.phone ?? key,
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
      if (!member.phone) {
        return { ok: false, error: 'Este integrante ainda não tem celular cadastrado.' }
      }
      const remote = await syncLogin(phoneKey(member.phone))
      // recusou de verdade (fora da lista / inativo) — não entra
      if (!remote.ok && !remote.offline && remote.reason !== 'erro') {
        const mensagem = mensagemDeRecusa(remote.reason, remote.error)
        setAuthError(mensagem)
        return { ok: false, error: mensagem }
      }
      // servidor fora do ar: entra com a lista salva no aparelho
      if (remote.reason === 'erro') {
        markServerError(
          'O servidor está com problema agora. Os dados ficarão só neste aparelho até o servidor voltar.',
        )
      }
      setSession({
        id: member.id,
        phone: member.phone,
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
      session: sessao,
      user,
      isAdmin: user?.category === 'admin',
      authError: authError ?? erroDeSessao,
      clearAuthError,
      login,
      loginAs,
      logout,
    }),
    [sessao, user, authError, erroDeSessao, clearAuthError, login, loginAs, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

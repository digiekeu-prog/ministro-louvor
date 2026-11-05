import { createContext } from 'react'
import type { Member, Presence, Service, Song } from '../lib/types'

export interface SyncControls {
  /**
   * O servidor ainda tem somente os dados de exemplo: o ministro pode enviar
   * os dados deste aparelho para toda a equipe.
   */
  offer: boolean
  /** Quantos itens existem só neste aparelho (ainda não estão no servidor). */
  pendingDiff: number
  /** Envia os dados deste aparelho para toda a equipe (por diferenças). */
  sendLocal: () => void
  /** Troca os dados locais pelos que estão na nuvem. */
  useRemote: () => void
}

export interface DataContextValue {
  members: Member[]
  services: Service[]
  songs: Song[]
  presence: Presence[]
  getMember: (id?: string) => Member | undefined
  addMember: (member: Omit<Member, 'id'>) => Member
  updateMember: (id: string, patch: Partial<Member>) => void
  removeMember: (id: string) => void
  getService: (id?: string) => Service | undefined
  addService: (service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => Service
  updateService: (id: string, patch: Partial<Service>) => void
  removeService: (id: string) => void
  setPresence: (memberId: string, serviceId: string, confirmed: boolean) => void
  isConfirmed: (memberId: string, serviceId: string) => boolean
  resetDemoData: () => void
  sync: SyncControls
}

export interface AuthContextValue {
  session: { id: string; phone: string } | null
  user: Member | null
  isAdmin: boolean
  /** Mensagem que explica por que o acesso foi recusado (tela de login). */
  authError: string | null
  /** Limpa a mensagem de erro (quando a pessoa corrige o celular). */
  clearAuthError: () => void
  login: (
    phone: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; warning?: string }>
  loginAs: (memberId: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

/**
 * Os contextos vivem em um módulo próprio (e não junto dos Providers).
 * Motivo: o Fast Refresh do Vite recria o módulo do Provider a cada edição,
 * e um `createContext()` recriado quebra a árvore (`useData` passa a ler um
 * contexto sem Provider acima) — a tela fica branca até dar F5.
 * Mantendo o objeto de contexto estável aqui, o HMR continua funcionando.
 */
export const DataContext = createContext<DataContextValue | null>(null)
export const AuthContext = createContext<AuthContextValue | null>(null)

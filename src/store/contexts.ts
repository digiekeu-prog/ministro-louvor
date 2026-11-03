import { createContext } from 'react'
import type { Member, Presence, Service, Song } from '../lib/types'

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
}

export interface AuthContextValue {
  session: { id: string; email: string } | null
  user: Member | null
  isAdmin: boolean
  login: (email: string, password: string) => { ok: boolean; error?: string }
  loginAs: (memberId: string) => void
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

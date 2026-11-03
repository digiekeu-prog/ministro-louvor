import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Member, Presence, Service, Song } from '../lib/types'
import { STORAGE_KEYS, normalizeService, readStore, writeStore } from '../lib/storage'
import { seedMembers, seedPresence, seedServices, seedSongs } from '../lib/seed'
import { uid } from '../lib/utils'
import { DataContext } from './contexts'
import type { DataContextValue } from './contexts'

export function DataProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(() =>
    readStore<Member[]>(STORAGE_KEYS.members, seedMembers),
  )
  const [services, setServices] = useState<Service[]>(() =>
    readStore<Service[]>(STORAGE_KEYS.services, seedServices).map(normalizeService),
  )
  const [songs, setSongs] = useState<Song[]>(() => readStore<Song[]>(STORAGE_KEYS.songs, seedSongs))
  const [presence, setPresenceState] = useState<Presence[]>(() =>
    readStore<Presence[]>(STORAGE_KEYS.presence, seedPresence),
  )

  useEffect(() => writeStore(STORAGE_KEYS.members, members), [members])
  useEffect(() => writeStore(STORAGE_KEYS.services, services), [services])
  useEffect(() => writeStore(STORAGE_KEYS.songs, songs), [songs])
  useEffect(() => writeStore(STORAGE_KEYS.presence, presence), [presence])

  const getMember = useCallback(
    (id?: string) => (id ? members.find((m) => m.id === id) : undefined),
    [members],
  )

  const getService = useCallback(
    (id?: string) => (id ? services.find((s) => s.id === id) : undefined),
    [services],
  )

  const addMember = useCallback((member: Omit<Member, 'id'>) => {
    const created: Member = { ...member, id: uid('mem') }
    setMembers((prev) => [...prev, created])
    return created
  }, [])

  const updateMember = useCallback((id: string, patch: Partial<Member>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setServices((prev) =>
      prev.map((s) => ({
        ...s,
        slots: s.slots.map((slot) =>
          slot.memberId === id ? { ...slot, memberId: undefined } : slot,
        ),
      })),
    )
  }, [])

  const addService = useCallback((service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    const timestamp = new Date().toISOString()
    const created: Service = normalizeService({
      ...service,
      id: uid('svc'),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    setServices((prev) => [...prev, created])
    return created
  }, [])

  const updateService = useCallback((id: string, patch: Partial<Service>) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? normalizeService({ ...s, ...patch, updatedAt: new Date().toISOString() })
          : s,
      ),
    )
  }, [])

  const removeService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id))
    setPresenceState((prev) => prev.filter((p) => p.serviceId !== id))
  }, [])

  const setPresence = useCallback((memberId: string, serviceId: string, confirmed: boolean) => {
    setPresenceState((prev) => {
      const existing = prev.find((p) => p.memberId === memberId && p.serviceId === serviceId)
      if (existing) {
        return prev.map((p) =>
          p.memberId === memberId && p.serviceId === serviceId
            ? { ...p, confirmed, respondedAt: new Date().toISOString() }
            : p,
        )
      }
      return [...prev, { memberId, serviceId, confirmed, respondedAt: new Date().toISOString() }]
    })
  }, [])

  const isConfirmed = useCallback(
    (memberId: string, serviceId: string) =>
      presence.find((p) => p.memberId === memberId && p.serviceId === serviceId)?.confirmed ?? false,
    [presence],
  )

  const resetDemoData = useCallback(() => {
    setMembers(seedMembers)
    setServices(seedServices)
    setSongs(seedSongs)
    setPresenceState(seedPresence)
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      members,
      services,
      songs,
      presence,
      getMember,
      addMember,
      updateMember,
      removeMember,
      getService,
      addService,
      updateService,
      removeService,
      setPresence,
      isConfirmed,
      resetDemoData,
    }),
    [
      members,
      services,
      songs,
      presence,
      getMember,
      addMember,
      updateMember,
      removeMember,
      getService,
      addService,
      updateService,
      removeService,
      setPresence,
      isConfirmed,
      resetDemoData,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>')
  return ctx
}

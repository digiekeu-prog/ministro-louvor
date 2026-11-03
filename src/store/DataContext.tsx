import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Member, Presence, Service, Song } from '../lib/types'
import { STORAGE_KEYS, normalizeService, readStore, writeStore } from '../lib/storage'
import { seedMembers, seedPresence, seedServices, seedSongs } from '../lib/seed'
import { uid } from '../lib/utils'
import { DataContext } from './contexts'
import type { DataContextValue } from './contexts'
import type { AppData, SyncChange, SyncOp } from '../lib/syncState'
import { applyOps, changeToOp, deleteOp, resetOp, upsertOp } from '../lib/syncState'
import { attachSync, queueFullState, queueOps } from '../lib/sync'

/** Lê os dados salvos neste aparelho (funciona mesmo sem internet). */
function loadLocal(): AppData {
  return {
    members: readStore<Member[]>(STORAGE_KEYS.members, seedMembers),
    services: readStore<Service[]>(STORAGE_KEYS.services, seedServices).map(normalizeService),
    songs: readStore<Song[]>(STORAGE_KEYS.songs, seedSongs),
    presence: readStore<Presence[]>(STORAGE_KEYS.presence, seedPresence),
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadLocal())
  /** espelho do estado, para calcular as alterações sem esperar o React. */
  const dataRef = useRef(data)
  /** o estado que veio do servidor, guardado para o caso de troca. */
  const remoteRef = useRef<AppData | null>(null)
  /** o servidor ainda tem só os dados de exemplo? */
  const [offer, setOffer] = useState(false)

  // cache local (o app abre rápido e funciona sem internet)
  useEffect(() => writeStore(STORAGE_KEYS.members, data.members), [data.members])
  useEffect(() => writeStore(STORAGE_KEYS.services, data.services), [data.services])
  useEffect(() => writeStore(STORAGE_KEYS.songs, data.songs), [data.songs])
  useEffect(() => writeStore(STORAGE_KEYS.presence, data.presence), [data.presence])

  /** Aplica um estado novo (veio do servidor) e avisa a tela. */
  const applyRemote = useCallback((remote: AppData) => {
    dataRef.current = remote
    setData(remote)
  }, [])

  /** Grava a mudança local e manda para a nuvem. */
  const commit = useCallback((next: AppData, ops: SyncOp[]) => {
    dataRef.current = next
    setData(next)
    queueOps(ops)
  }, [])

  // liga o motor de sincronização ao app
  useEffect(() => {
    attachSync({
      onSnapshot: (remote, pristine) => {
        remoteRef.current = remote
        if (pristine) {
          // o servidor ainda está com os dados de exemplo: o ministro decide
          // se quer enviar os dados deste aparelho para a equipe
          setOffer(true)
          return
        }
        setOffer(false)
        applyRemote(remote)
      },
      onChanges: (changes: SyncChange[]) => {
        // chegou alteração de outro aparelho: o servidor já tem os dados reais
        setOffer(false)
        const ops = changes.map(changeToOp)
        commit(applyOps(dataRef.current, ops), [])
      },
    })
  }, [applyRemote, commit])

  const getMember = useCallback(
    (id?: string) => (id ? data.members.find((m) => m.id === id) : undefined),
    [data.members],
  )

  const getService = useCallback(
    (id?: string) => (id ? data.services.find((s) => s.id === id) : undefined),
    [data.services],
  )

  const addMember = useCallback(
    (member: Omit<Member, 'id'>) => {
      const created: Member = { ...member, id: uid('mem') }
      const current = dataRef.current
      commit({ ...current, members: [...current.members, created] }, [upsertOp('members', created)])
      return created
    },
    [commit],
  )

  const updateMember = useCallback(
    (id: string, patch: Partial<Member>) => {
      const current = dataRef.current
      const updated = current.members.map((m) => (m.id === id ? { ...m, ...patch } : m))
      const member = updated.find((m) => m.id === id)
      commit({ ...current, members: updated }, member ? [upsertOp('members', member)] : [])
    },
    [commit],
  )

  const removeMember = useCallback(
    (id: string) => {
      const current = dataRef.current
      // o membro sai da equipe e dos lugares das escalas
      const services = current.services.map((s) => ({
        ...s,
        slots: s.slots.map((slot) =>
          slot.memberId === id ? { ...slot, memberId: undefined } : slot,
        ),
      }))
      const ops: SyncOp[] = [deleteOp('members', id)]
      for (const service of services) ops.push(upsertOp('services', service))
      commit({ ...current, members: current.members.filter((m) => m.id !== id), services }, ops)
    },
    [commit],
  )

  const addService = useCallback(
    (service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
      const timestamp = new Date().toISOString()
      const created = normalizeService({
        ...service,
        id: uid('svc'),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      const current = dataRef.current
      commit({ ...current, services: [...current.services, created] }, [upsertOp('services', created)])
      return created
    },
    [commit],
  )

  const updateService = useCallback(
    (id: string, patch: Partial<Service>) => {
      const current = dataRef.current
      const updated = current.services.map((s) =>
        s.id === id
          ? normalizeService({ ...s, ...patch, updatedAt: new Date().toISOString() })
          : s,
      )
      const service = updated.find((s) => s.id === id)
      commit({ ...current, services: updated }, service ? [upsertOp('services', service)] : [])
    },
    [commit],
  )

  const removeService = useCallback(
    (id: string) => {
      const current = dataRef.current
      const removedPresence = current.presence.filter((p) => p.serviceId === id)
      const ops: SyncOp[] = [deleteOp('services', id)]
      for (const presence of removedPresence) ops.push(deleteOp('presence', `${presence.memberId}:${presence.serviceId}`))
      commit(
        {
          ...current,
          services: current.services.filter((s) => s.id !== id),
          presence: current.presence.filter((p) => p.serviceId !== id),
        },
        ops,
      )
    },
    [commit],
  )

  const setPresence = useCallback(
    (memberId: string, serviceId: string, confirmed: boolean) => {
      const current = dataRef.current
      const existing = current.presence.find((p) => p.memberId === memberId && p.serviceId === serviceId)
      const presence: Presence = existing
        ? { ...existing, confirmed, respondedAt: new Date().toISOString() }
        : { memberId, serviceId, confirmed, respondedAt: new Date().toISOString() }

      const presenceList = existing
        ? current.presence.map((p) =>
            p.memberId === memberId && p.serviceId === serviceId ? presence : p,
          )
        : [...current.presence, presence]

      commit({ ...current, presence: presenceList }, [upsertOp('presence', presence)])
    },
    [commit],
  )

  const isConfirmed = useCallback(
    (memberId: string, serviceId: string) =>
      data.presence.find((p) => p.memberId === memberId && p.serviceId === serviceId)?.confirmed ??
      false,
    [data.presence],
  )

  const resetDemoData = useCallback(() => {
    const next: AppData = {
      members: seedMembers,
      services: seedServices,
      songs: seedSongs,
      presence: seedPresence,
    }
    commit(next, [resetOp(next)])
  }, [commit])

  /** Envia os dados deste aparelho para toda a equipe (só o ministro). */
  const sendLocalToTeam = useCallback(() => {
    queueFullState(dataRef.current)
    setOffer(false)
  }, [])

  /** Troca os dados locais pelos que estão na nuvem. */
  const useRemoteData = useCallback(() => {
    if (remoteRef.current) applyRemote(remoteRef.current)
    setOffer(false)
  }, [applyRemote])

  const value = useMemo<DataContextValue>(
    () => ({
      members: data.members,
      services: data.services,
      songs: data.songs,
      presence: data.presence,
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
      sync: {
        offer,
        sendLocal: sendLocalToTeam,
        useRemote: useRemoteData,
      },
    }),
    [
      data.members,
      data.services,
      data.songs,
      data.presence,
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
      offer,
      sendLocalToTeam,
      useRemoteData,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>')
  return ctx
}

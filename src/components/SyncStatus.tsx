import { useState } from 'react'
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert, Upload, Users } from 'lucide-react'
import { useSyncStatus } from '../lib/sync'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { Button, Modal } from './ui'
import { cn } from '../lib/utils'

/**
 * Selo que mostra o estado da sincronização com o servidor da equipe.
 * Aparece no menu (computador) e no topo (celular).
 */
export function SyncBadge({ className }: { className?: string }) {
  const status = useSyncStatus()

  const mapa = {
    sincronizado: {
      icon: CheckCircle2,
      texto: 'Sincronizado',
      classes: 'text-emerald-300/90 ring-emerald-400/20 bg-emerald-400/8',
    },
    conectando: {
      icon: RefreshCw,
      texto: 'Sincronizando…',
      classes: 'text-neon-cyan/90 ring-neon-cyan/25 bg-neon-cyan/8',
    },
    erro: {
      icon: CloudOff,
      texto: status.pending > 0 ? `Offline (${status.pending})` : 'Offline',
      classes: 'text-amber-300/90 ring-amber-400/25 bg-amber-400/8',
    },
    desligado: {
      icon: CloudOff,
      texto: 'Só neste aparelho',
      classes: 'text-zinc-500 ring-white/10 bg-white/4',
    },
  } as const

  const atual = mapa[status.state]
  const Icon = atual.icon

  const quando = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <span
      title={
        status.message ??
        (quando ? `Última sincronização às ${quando}` : 'Aguardando sincronização')
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-medium ring-1',
        atual.classes,
        className,
      )}
    >
      <Icon size={12} className={cn(status.state === 'conectando' && 'animate-spin')} />
      {atual.texto}
    </span>
  )
}

/**
 * Aviso para o ministro: o servidor ainda está com os dados de exemplo e ele
 * pode enviar os dados deste aparelho para toda a equipe.
 */
export function SyncOfferBanner() {
  const { sync } = useData()
  const { isAdmin } = useAuth()
  const [confirmando, setConfirmando] = useState(false)

  if (!sync.offer || !isAdmin) return null

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-neon-cyan/25 bg-neon-cyan/8 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-neon-cyan/12 text-neon-cyan ring-1 ring-neon-cyan/25">
            <Users size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-white">
              Preparar os dados compartilhados da equipe
            </p>
            <p className="mt-0.5 text-xs text-zinc-300/80">
              O servidor ainda está com os dados de exemplo. Envie os dados deste aparelho para
              que todo mundo — celular e notebook — veja as mesmas escalas.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={sync.sendLocal}>
            <Upload size={14} /> Enviar meus dados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmando(true)}>
            Usar os da nuvem
          </Button>
        </div>
      </div>

      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title="Trocar pelos dados da nuvem?"
        description="As alterações que existem só neste aparelho serão descartadas e valerá o que está salvo no servidor da equipe."
      >
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>Tem certeza? Essa ação não pode ser desfeita.</span>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              sync.useRemote()
              setConfirmando(false)
            }}
          >
            Usar os dados da nuvem
          </Button>
        </div>
      </Modal>
    </>
  )
}

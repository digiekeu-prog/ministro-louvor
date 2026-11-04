import { useState } from 'react'
import {
  CheckCircle2,
  CloudOff,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Upload,
  Users,
  WifiOff,
} from 'lucide-react'
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
    sem_conexao: {
      icon: WifiOff,
      texto: status.pending > 0 ? `Sem conexão (${status.pending})` : 'Sem conexão',
      classes: 'text-amber-300/90 ring-amber-400/25 bg-amber-400/8',
    },
    sem_acesso: {
      icon: ShieldAlert,
      texto: 'Sem acesso',
      classes: 'text-red-300/90 ring-red-400/25 bg-red-400/8',
    },
    erro: {
      icon: CloudOff,
      texto: status.pending > 0 ? `Erro (${status.pending})` : 'Erro',
      classes: 'text-red-300/90 ring-red-400/25 bg-red-400/8',
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
 * Aviso grande quando a sincronização **não** está funcionando.
 *
 * A ideia é nunca deixar o ministro "no escuro": se o app não está falando
 * com o servidor, ele diz o que está acontecendo e o que acontece com as
 * alterações feitas (ficam guardadas e vão sozinhas).
 */
export function SyncAlertBanner() {
  const status = useSyncStatus()

  if (status.state === 'sincronizado' || status.state === 'conectando') return null

  const aviso = {
    sem_conexao: {
      icon: WifiOff,
      titulo: 'Sem conexão com a nuvem',
      detalhe:
        'As alterações que você fizer ficam guardadas neste aparelho e vão para a equipe assim que a internet voltar.',
      classes: 'border-amber-400/25 bg-amber-400/8 text-amber-100',
    },
    sem_acesso: {
      icon: ShieldAlert,
      titulo: 'Seu acesso foi removido',
      detalhe:
        status.message ??
        'Seu e-mail não está mais na lista da equipe do servidor. Fale com o ministro.',
      classes: 'border-red-400/25 bg-red-400/8 text-red-100',
    },
    erro: {
      icon: CloudOff,
      titulo: 'Não consegui falar com o servidor',
      detalhe: status.message ?? 'Tente de novo em instantes.',
      classes: 'border-red-400/25 bg-red-400/8 text-red-100',
    },
    desligado: {
      icon: CloudOff,
      titulo: 'Este aparelho ainda não está conectado',
      detalhe:
        'Você entrou sem internet. Assim que a conexão voltar, o app volta a sincronizar sozinho — por enquanto, o que você mexer fica só aqui.',
      classes: 'border-white/10 bg-white/4 text-zinc-300',
    },
  } as const

  const atual = aviso[status.state as keyof typeof aviso] ?? aviso.desligado
  const Icon = atual.icon

  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5',
        atual.classes,
      )}
    >
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{atual.titulo}</p>
        <p className="mt-0.5 text-xs opacity-90">{atual.detalhe}</p>
        {status.pending > 0 && (
          <p className="mt-1 text-xs font-medium opacity-90">
            {status.pending} {status.pending === 1 ? 'alteração guardada' : 'alterações guardadas'} —{' '}
            vai junto assim que a conexão voltar.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Aviso para o ministro:
 *  - o servidor ainda está com os dados de exemplo (primeira configuração);
 *  - ou há dados neste aparelho que o servidor ainda não conhece.
 *
 * O envio é sempre por diferenças: nada do que os outros já editaram no
 * servidor é sobrescrito.
 */
export function SyncOfferBanner() {
  const { sync } = useData()
  const { isAdmin } = useAuth()
  const [confirmando, setConfirmando] = useState(false)

  if (!isAdmin) return null
  if (!sync.offer && sync.pendingDiff === 0) return null

  const primeiraConfig = sync.offer

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-neon-cyan/25 bg-neon-cyan/8 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-neon-cyan/12 text-neon-cyan ring-1 ring-neon-cyan/25">
            <Users size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-white">
              {primeiraConfig
                ? 'Preparar os dados compartilhados da equipe'
                : 'Há dados neste aparelho que a equipe ainda não tem'}
            </p>
            <p className="mt-0.5 text-xs text-zinc-300/80">
              {primeiraConfig
                ? 'O servidor ainda está com os dados de exemplo. Envie os dados deste aparelho para que todo mundo — celular e notebook — veja as mesmas escalas.'
                : `${sync.pendingDiff} ${sync.pendingDiff === 1 ? 'item existe' : 'itens existem'} só neste aparelho. Envie só as diferenças: o que os outros já editaram não é sobrescrito.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => setConfirmando(true)}>
            <Upload size={14} /> {primeiraConfig ? 'Enviar meus dados' : 'Enviar as diferenças'}
          </Button>
          {primeiraConfig && (
            <Button size="sm" variant="ghost" onClick={sync.useRemote}>
              Usar os da nuvem
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title={primeiraConfig ? 'Enviar os dados deste aparelho?' : 'Enviar as diferenças?'}
        description={
          primeiraConfig
            ? 'O servidor ainda está com os dados de exemplo, então os dados deste aparelho passam a ser a versão oficial da equipe.'
            : 'Só o que existe apenas neste aparelho será enviado. O que os outros já editaram no servidor continua valendo.'
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-neon-cyan/25 bg-neon-cyan/8 px-4 py-3 text-sm text-zinc-200">
          <Upload size={16} className="mt-0.5 shrink-0 text-neon-cyan" />
          <span>
            {primeiraConfig
              ? 'Depois disso, o envio passa a ser só por diferenças — nenhum aparelho consegue apagar o trabalho de outro.'
              : 'As exclusões que você fez já são enviadas automaticamente, uma a uma.'}
          </span>
        </div>
        {!primeiraConfig && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              Confira se o que você quer compartilhar está completo aqui — o envio não apaga nada do
              servidor.
            </span>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              sync.sendLocal()
              setConfirmando(false)
            }}
          >
            {primeiraConfig ? 'Enviar tudo' : 'Enviar as diferenças'}
          </Button>
        </div>
      </Modal>
    </>
  )
}

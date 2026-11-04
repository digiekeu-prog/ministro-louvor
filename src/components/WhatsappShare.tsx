import { useState } from 'react'
import { Check, Copy, MessageCircle, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from './ui'
import { useAuth } from '../store/AuthContext'
import { buildServiceMessage, whatsappLink } from '../lib/whatsapp'
import type { Service } from '../lib/types'

/**
 * Aviso da escala no WhatsApp.
 *
 * O WhatsApp não deixa o site enviar mensagem sozinho: o app monta o texto e
 * abre o `wa.me`, que já deixa a mensagem escrita na conversa do ministro.
 * Aí é só tocar em enviar (ou copiar e colar no grupo).
 */
export function WhatsAppShare({
  service,
  open,
  onClose,
}: {
  service: Service
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [copiado, setCopiado] = useState(false)

  const mensagem = buildServiceMessage(service)
  const numero = user?.whatsapp || user?.phone || ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem)
    } catch {
      // navegadores antigos / permissão negada: usa o truque da área oculta
      const area = document.createElement('textarea')
      area.value = mensagem
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 2500)
  }

  function abrirWhatsapp() {
    window.open(whatsappLink(numero, mensagem), '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Avisar a equipe no WhatsApp"
      description="A mensagem é curta: só o culto, o local, o recado e o link. Abra no seu WhatsApp, toque em enviar e encaminhe para o grupo — ou copie e cole direto lá."
      maxWidth="max-w-xl"
    >
      {/* Mensagem */}
      <div className="max-h-56 overflow-y-auto rounded-xl border border-white/8 bg-ink-950/60 p-3.5">
        <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-zinc-300">
          {mensagem}
        </pre>
      </div>

      {!numero && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
          <Settings2 size={16} className="mt-0.5 shrink-0" />
          <span>
            Você ainda não cadastrou seu WhatsApp.{' '}
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate('/app/perfil')
              }}
              className="font-semibold underline underline-offset-2"
            >
              Cadastrar no Perfil
            </button>{' '}
            para abrir o WhatsApp direto. Por enquanto, copie a mensagem.
          </span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={copiar}>
          {copiado ? <Check size={15} /> : <Copy size={15} />}
          {copiado ? 'Copiado!' : 'Copiar mensagem'}
        </Button>
        {numero && (
          <Button onClick={abrirWhatsapp}>
            <MessageCircle size={15} /> Abrir no WhatsApp
          </Button>
        )}
      </div>
    </Modal>
  )
}

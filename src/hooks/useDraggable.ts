import { useCallback, useRef, useState } from 'react'

export interface DragOffset {
  x: number
  y: number
}

export interface DraggablePanel {
  /** Referência do elemento que será movido. */
  panelRef: React.RefObject<HTMLDivElement | null>
  /** Deslocamento atual em relação ao centro da tela. */
  offset: DragOffset | null
  /** `true` enquanto o painel está sendo arrastado. */
  dragging: boolean
  /** Handler para o cabeçalho (ou qualquer área de arrasto). */
  handlePointerDown: (event: React.PointerEvent<HTMLElement>) => void
  /** Volta o painel para a posição original. */
  reset: () => void
}

/**
 * Deixa um painel flutuante arrastável pelo cabeçalho.
 *
 * O painel continua sempre visível: na horizontal ele não sai da tela (os
 * botões do cabeçalho ficam sempre ao alcance) e na vertical ele pode subir
 * ou descer livremente, liberando espaço para digitar.
 *
 * @param resetKey Quando muda, o painel volta para o centro (ex.: `open`).
 */
export function useDraggable(resetKey?: unknown): DraggablePanel {
  const panelRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState<DragOffset | null>(null)
  const [dragging, setDragging] = useState(false)
  const [lastKey, setLastKey] = useState(resetKey)

  // ao (re)abrir a janela, volta para o centro (ajuste durante o render)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setOffset(null)
  }

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      // botões, links e campos continuam clicáveis durante o arrasto
      if (target.closest('button, a, input, textarea, select, label')) return
      const panel = panelRef.current
      if (!panel) return
      event.preventDefault()

      const rect = panel.getBoundingClientRect()
      const startX = event.clientX
      const startY = event.clientY
      const origin = offset ?? { x: 0, y: 0 }
      setDragging(true)
      document.body.style.userSelect = 'none'

      const onMove = (moveEvent: PointerEvent) => {
        let dx = moveEvent.clientX - startX
        let dy = moveEvent.clientY - startY
        // horizontal: a janela nunca sai da tela (botões do cabeçalho sempre visíveis)
        let minDx = 8 - rect.left
        let maxDx = window.innerWidth - 8 - rect.right
        if (minDx > maxDx) {
          minDx = 0
          maxDx = 0
        }
        // vertical: mantém o cabeçalho visível, mas libera o resto da tela
        const minDy = -(rect.height - 140)
        const maxDy = window.innerHeight - 110 - rect.top
        dx = Math.min(maxDx, Math.max(minDx, dx))
        dy = Math.min(maxDy, Math.max(minDy, dy))
        setOffset({ x: origin.x + dx, y: origin.y + dy })
      }

      const onUp = () => {
        setDragging(false)
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [offset],
  )

  const reset = useCallback(() => setOffset(null), [])

  return { panelRef, offset, dragging, handlePointerDown, reset }
}

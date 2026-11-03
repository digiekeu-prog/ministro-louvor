import { createPortal } from 'react-dom'

/**
 * Renderiza o conteúdo direto em `document.body`.
 *
 * Necessário para modais: elementos com `position: fixed` passam a se
 * posicionar pela viewport, e não por um ancestral com `transform`
 * (por exemplo a animação `animate-fade-up` das páginas), que cria um
 * containing block e "gruda" o modal na página rolada.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

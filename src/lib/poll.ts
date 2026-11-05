/**
 * Ritmo das consultas ao servidor.
 *
 * O app pergunta ao servidor "o que há de novo?" com frequência — mas cada
 * pergunta acorda o banco (Neon) e queima cota do plano free. Como o uso é
 * esporádico (o ministro abre o app, monta a escala, fecha), o ritmo agora
 * acompanha o uso de verdade:
 *
 * - **ativo** (a pessoa está mexendo no app): rápido, como sempre;
 * - **ocioso** (app aberto, ninguém mexendo): bem mais devagar;
 * - **oculto** (app em segundo plano): quase parado — assim o banco pode
 *   suspender sozinho e não gastar compute à toa.
 *
 * Quando a tela volta a ficar visível, o app pergunta na hora (não espera o
 * próximo ciclo).
 */

/** App em segundo plano: 10 min — dá tempo de o banco suspender. */
export const INTERVALO_OCULTO = 600000

/** App aberto, mas sem ninguém mexendo: 1 min. */
export const INTERVALO_OCIOSO = 60000

/** Tempo sem mexer no app para ele ser considerado "ocioso". */
const OCIOSO_APOS_MS = 3 * 60 * 1000

let ultimaAtividade = Date.now()
const ouvintes = new Set<() => void>()

/** Marca que a pessoa mexeu no app (clique, tecla, toque ou alteração). */
export function marcarAtividade() {
  const agora = Date.now()
  // ignora eventos repetidos (o mouse dispara vários do mesmo gesto)
  if (agora - ultimaAtividade < 1000) return
  ultimaAtividade = agora
  ouvintes.forEach((ouvinte) => ouvinte())
}

/** O app está em uso neste momento? */
export function emAtividade() {
  return Date.now() - ultimaAtividade < OCIOSO_APOS_MS
}

/** Avisa quando a pessoa volta a mexer no app. */
export function observarAtividade(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/**
 * De quanto em quanto tempo consultar o servidor agora.
 *
 * @param ativo intervalo usado enquanto o app está em uso
 */
export function intervaloAgora(ativo: number): number {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return INTERVALO_OCULTO
  }
  return emAtividade() ? ativo : INTERVALO_OCIOSO
}

/**
 * Fica de olho nos gestos da pessoa para saber quando o app voltou a ser
 * usado. Devolve a função que desliga a vigia.
 */
export function vigiarAtividade() {
  if (typeof window === 'undefined') return () => {}
  const eventos: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart']
  const aoMexer = () => marcarAtividade()
  eventos.forEach((evento) => window.addEventListener(evento, aoMexer, { passive: true }))
  return () => {
    eventos.forEach((evento) => window.removeEventListener(evento, aoMexer))
  }
}

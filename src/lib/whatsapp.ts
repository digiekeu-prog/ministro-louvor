/**
 * Mensagem da escala para o WhatsApp.
 *
 * O app não envia mensagem sozinho (o WhatsApp não deixa): ele monta o texto
 * e abre o `wa.me`, que já deixa a mensagem escrita no WhatsApp do ministro.
 * Aí é só tocar em enviar — ou copiar e colar direto no grupo.
 *
 * A mensagem é **curta de propósito**: só o que a equipe precisa saber antes de
 * abrir o link (qual culto, onde, o recado e o link). A escala, o repertório,
 * o vídeo, a letra e a cifra ficam **dentro do link** — mandar tudo no texto
 * faz a mensagem enorme e ninguém entra no app.
 */

import type { Service } from './types'
import { formatDateLong, formatTime, parseISODate } from './utils'

/** Endereço do app — é por ele que o time entra e vê a escala. */
export const APP_URL = 'https://ministro-louvor.vercel.app'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Palavras que já são óbvias no título padrão ("Culto Domingo — Manhã"). */
const PALAVRAS_COMUNS =
  /^(culto|de|do|da|em|no|domingo|segunda|terça|quarta|quinta|sexta|sábado|manhã|tarde|noite|vespertina)$/i

/** Deixa só os dígitos (com o código do país, que o wa.me exige). */
export function normalizePhone(phone: string | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

/** Link do WhatsApp com a mensagem já escrita. */
export function whatsappLink(phone: string | undefined, message: string): string {
  const numero = normalizePhone(phone)
  const texto = encodeURIComponent(message)
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`
}

/** Tira quebras de linha que atrapalham a mensagem (ex.: no título). */
function umaLinha(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim()
}

/** Período do dia: manhã, tarde ou noite. */
function periodo(time: string): string {
  const hora = Number((time || '').split(':')[0])
  if (!Number.isFinite(hora)) return ''
  if (hora < 12) return 'Manhã'
  if (hora < 18) return 'Tarde'
  return 'Noite'
}

/** O título é genérico ("Culto Domingo — Manhã")? aí a gente monta o bonito. */
function tituloGenerico(titulo: string): boolean {
  const partes = titulo
    .split(/\s+/)
    .map((parte) => parte.replace(/[—–\-:,.!]/g, ''))
    .filter(Boolean)
  if (!partes.length) return true
  return partes.every((parte) => PALAVRAS_COMUNS.test(parte))
}

/**
 * Monta o texto que o ministro manda no grupo: qual culto é, onde, o recado
 * (levar transparência, chegar antes…) e o link para ver a escala.
 */
export function buildServiceMessage(service: Service): string {
  const linhas: string[] = []

  const titulo = umaLinha(service.title)
  const dia = DIAS[parseISODate(service.date).getDay()] ?? ''
  const parte = periodo(service.time)

  // título padrão ("Culto Domingo — Manhã") vira "Culto de domingo — Manhã";
  // título com nome próprio ("Encontro de Jovens") é respeitado como está.
  const generico = !titulo || (/culto/i.test(titulo) && tituloGenerico(titulo))

  linhas.push(generico ? `*Culto de ${dia}${parte ? ` — ${parte}` : ''}*` : `*${titulo}*`)

  linhas.push('')
  linhas.push(`📅 ${formatDateLong(service.date)} · ${formatTime(service.time)}`)
  if (service.location) linhas.push(`📍 ${umaLinha(service.location)}`)

  if (service.notes) {
    linhas.push('')
    linhas.push(`_${umaLinha(service.notes)}_`)
  }

  linhas.push('')
  linhas.push('_Confira se você está na escala e veja o repertório (vídeo, letra e cifra):_')
  linhas.push(`${APP_URL}/escala/${service.id}`)
  linhas.push('')
  linhas.push('É só abrir o link e digitar o seu nome. Qualquer dúvida, chame o ministro.')

  return linhas.join('\n')
}

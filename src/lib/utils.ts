export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** '2026-10-30' -> Date local (sem deslocamento de fuso) */
export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateLong(iso: string) {
  const date = parseISODate(iso)
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}

export function formatDateShort(iso: string) {
  const date = parseISODate(iso)
  const d = `${date.getDate()}`.padStart(2, '0')
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}

export function formatMonthYear(iso: string) {
  const date = parseISODate(iso)
  return `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`
}

export function daysUntil(iso: string) {
  const target = parseISODate(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function relativeDay(iso: string) {
  const diff = daysUntil(iso)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  if (diff > 1 && diff <= 7) return `Em ${diff} dias`
  if (diff < -1) return `Há ${Math.abs(diff)} dias`
  return formatDateShort(iso)
}

export function formatTime(time: string) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return `${`${h}`.padStart(2, '0')}h${m ? `:${`${m}`.padStart(2, '0')}` : ''}`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * Prazo da resposta de presença: a **sexta-feira** mais próxima antes do culto
 * (é o dia em que o ministro precisa fechar a equipe).
 */
export function prazoResposta(iso: string): Date {
  const data = parseISODate(iso)
  // dias desde a última sexta-feira (0 = sexta, 6 = quinta)
  const desdeSexta = (data.getDay() + 7 - 5) % 7
  data.setDate(data.getDate() - desdeSexta)
  data.setHours(0, 0, 0, 0)
  return data
}

/** O prazo em texto: 'sexta-feira, 06/11'. */
export function formatarPrazo(iso: string): string {
  const data = prazoResposta(iso)
  const d = `${data.getDate()}`.padStart(2, '0')
  const m = `${data.getMonth() + 1}`.padStart(2, '0')
  return `${WEEKDAYS[data.getDay()]}, ${d}/${m}`
}

/** O prazo já passou? */
export function prazoVencido(iso: string): boolean {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return prazoResposta(iso).getTime() < hoje.getTime()
}

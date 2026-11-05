/**
 * Telefone: é o **login** do app.
 *
 * O e-mail foi tirado do cadastro: quem entra no app entra com o **celular**
 * (a senha continua livre); quem não tem celular cadastrado apenas visualiza
 * a escala pelo link público.
 *
 * Este módulo é puro (sem nada do navegador) porque é usado também pelas
 * functions da Vercel, no Node.
 */

/** Só os dígitos, sem o código do país (55) — é a chave de comparação. */
export function phoneKey(phone: string | undefined | null): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  // 55 + DDD + número (12 ou 13 dígitos) → tira o código do país
  if (digits.length > 11 && digits.startsWith('55')) return digits.slice(2)
  return digits
}

/**
 * Dois telefones são o mesmo?
 *
 * O mesmo número costuma estar salvo de jeitos diferentes: "(11) 98888-1200",
 * "11 98888 1200", "55 11 98888 1200"… Então comparamos os dígitos e
 * aceitamos um como sufixo do outro (quando o menor tem 8 dígitos ou mais).
 */
export function samePhone(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const x = phoneKey(a)
  const y = phoneKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const menor = x.length <= y.length ? x : y
  const maior = x.length <= y.length ? y : x
  if (menor.length >= 8 && maior.endsWith(menor)) return true
  // "55 + 9 dígitos" (salvo sem DDD) — compara com os 9 dígitos finais do outro
  const semDdd = (v: string) => (v.length === 11 && v.startsWith('55') ? v.slice(2) : null)
  const nx = semDdd(x)
  const ny = semDdd(y)
  if (nx && ny && nx === ny) return true
  if (nx && y.length === 11 && y.slice(-9) === nx) return true
  if (ny && x.length === 11 && x.slice(-9) === ny) return true
  return false
}

/** Número com o código do país (55) — é o formato que o `wa.me` exige. */
export function phoneWithCountryCode(phone: string | undefined | null): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 12) return digits
  // 11 dígitos já começando com 55: o código do país está no número
  if (digits.length === 11 && digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`
  return digits
}

/** Deixa bonito para mostrar: (11) 98888-1200 */
export function formatPhone(phone: string | undefined | null): string {
  const raw = (phone ?? '').trim()
  if (!raw) return ''
  if (raw.includes('(') || raw.includes('+')) return raw
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('55')) return raw
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return raw
}

/** Aplica a máscara enquanto a pessoa digita: (11) 98888-1200 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (!digits) return ''

  const comPais = digits.length > 11 && digits.startsWith('55')
  const local = comPais ? digits.slice(2) : digits
  const prefixo = comPais ? '+55 ' : ''

  if (local.length <= 2) return prefixo + local
  if (local.length <= 6) return `${prefixo}(${local.slice(0, 2)}) ${local.slice(2)}`
  if (local.length <= 10) return `${prefixo}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return `${prefixo}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
}

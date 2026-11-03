/**
 * Utilidades para cifras (chord sheets).
 *
 * Sites de cifra entregam o texto de formas diferentes: às vezes a linha de
 * acordes vem acima da letra (alinhada com espaços), às vezes vem em uma
 * coluna separada. Aqui detectamos quais linhas são acordes para conseguir
 * separar a "cifra" da "letra" automaticamente.
 */

/** Acorde: C, G, Dm, F#m, Bb, Am7, C#m7, G/B, Dsus4, Em... */
const CHORD = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?$/

/** Palavras de seção que podem aparecer na mesma linha dos acordes. */
const SECTIONS = new Set([
  'intro',
  'intro.',
  'refrão',
  'refrão.',
  'refrãodemaestro',
  'ponte',
  'final',
  'coda',
  'outro',
  'verso',
  'coro',
  'prerrefrão',
  'pré-refrão',
  'silêncio',
  'repete',
  'intro-refrao',
  'bridge',
  'chorus',
  'verse',
  'tag',
  'key',
  'tom',
])

const REP_MARK = /^\d+x$/i

/** Remove acentos e deixa minúsculo, para comparar palavras de seção. */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Um token isolado é um acorde? */
export function isChordToken(raw: string): boolean {
  const token = raw.replace(/^[[(]|[)\]]$/g, '').trim()
  if (!token) return false
  if (REP_MARK.test(token)) return false
  if (SECTIONS.has(normalizeWord(token))) return false
  return CHORD.test(token)
}

/** A linha inteira é uma linha de acordes (ex.: "G        C     D")? */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const tokens = trimmed.split(/\s+/)
  if (tokens.length > 16) return false

  let chords = 0
  let others = 0
  for (const token of tokens) {
    if (isChordToken(token)) {
      chords += 1
      continue
    }
    const word = normalizeWord(token.replace(/[.,;:!?()[\]]/g, ''))
    if (SECTIONS.has(word) || REP_MARK.test(token)) continue
    others += 1
  }

  if (chords === 0) return false
  // linha só de acordes, ou quase só de acordes (o resto são seções)
  return others === 0 || chords >= others
}

/** Normaliza o texto colado: nbsp, tabs, CRLF e espaços no fim da linha. */
export function normalizeSheet(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '    ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
}

/** Remove as linhas de acordes, devolvendo só a letra. */
export function stripChordLines(raw: string): string {
  return normalizeSheet(raw)
    .split('\n')
    .filter((line) => !isChordLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface ChordSheetSplit {
  /** Letra sem as linhas de acordes. */
  lyrics: string
  /** Cifra completa como foi colada (acordes acima da letra, alinhados). */
  chords: string
  /** A entrada tinha linhas de acordes? */
  detected: boolean
}

/**
 * Separa o que foi colado em letra e cifra.
 *
 * Se o texto tiver linhas de acordes, a "cifra" guarda o texto completo
 * (preservando o alinhamento) e a "letra" fica só com as palavras.
 */
export function splitChordSheet(raw: string): ChordSheetSplit {
  const normalized = normalizeSheet(raw)
  const lines = normalized.split('\n')
  const hasChords = lines.some((line) => isChordLine(line))
  if (!hasChords) {
    return { lyrics: normalized.trim(), chords: '', detected: false }
  }

  const lyrics = lines
    .filter((line) => !isChordLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { lyrics, chords: normalized.trim(), detected: true }
}

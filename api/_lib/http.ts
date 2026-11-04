/**
 * Utilidades mínimas das functions da Vercel (sem depender de tipos extras).
 */

export interface ApiRequest {
  method?: string
  url?: string
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(payload: unknown): void
  setHeader(name: string, value: string): void
  end?: () => void
}

/** Lê o corpo da requisição (a Vercel já parseia JSON, mas há casos sem parse). */
export async function readBody<T>(req: ApiRequest): Promise<T | null> {
  if (req.body !== undefined && req.body !== null) return req.body as T

  const raw = (req as unknown as { body?: unknown }).body
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  return null
}

/** Header de autorização (Bearer <token>). */
export function bearerToken(req: ApiRequest): string | null {
  const headers = req.headers ?? {}
  const raw = headers.authorization ?? headers.Authorization
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1].trim() : null
}

/** Valor de um query param (a Vercel entrega string ou array). */
export function queryValue(req: ApiRequest, key: string): string | undefined {
  const raw = req.query?.[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value ?? undefined
}

/** Erro padrão (500) sem vazar detalhes do banco. */
export function fail(res: ApiResponse, message: string) {
  res.status(500).json({ error: message })
}

/**
 * CORS — permite chamar a API de outro domínio (ex.: o preview do Lovable,
 * em `*.lovable.app`). Não usa cookie (a sessão é um token Bearer), então
 * refletir a origem não abre brecha de CSRF.
 *
 * Devolve `true` quando a requisição era só o *preflight* (OPTIONS) — nesse
 * caso o handler deve encerrar imediatamente.
 */
export function applyCors(req: ApiRequest, res: ApiResponse): boolean {
  const headers = req.headers ?? {}
  const raw = headers.origin ?? headers.Origin
  const origin = Array.isArray(raw) ? raw[0] : raw

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')

  if ((req.method ?? '').toUpperCase() === 'OPTIONS') {
    res.status(204)
    if (res.end) res.end()
    else res.json({})
    return true
  }

  return false
}

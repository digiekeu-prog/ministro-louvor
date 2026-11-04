/**
 * Endereço da API do servidor.
 *
 * Em produção (Vercel) o app e a API ficam no mesmo domínio, então basta usar
 * `/api/...`. Quando o front roda em **outro domínio** — por exemplo o preview
 * do Lovable (`*.lovable.app`) — a variável `VITE_API_URL` aponta para a
 * Vercel: `VITE_API_URL=https://ministro-louvor.vercel.app`.
 *
 * Sem a variável, continua funcionando exatamente como antes (mesmo domínio).
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** Junta o endereço da API com o caminho (`/api/sync` → URL completa). */
export function apiUrl(path: string): string {
  const caminho = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${caminho}`
}

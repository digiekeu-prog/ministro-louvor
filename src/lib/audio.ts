/**
 * Envio dos MP3 do repertório.
 *
 * O arquivo é enviado **em partes** (2 MB cada), porque o servidor da Vercel
 * aceita no máximo ~4,5 MB por requisição. Depois de juntado, o servidor
 * devolve um `id`: é esse id que fica guardado na música e que permite tocar
 * o arquivo dentro do app (inclusive pelo link público da escala).
 */

import { apiUrl } from './api'
import { syncToken } from './sync'
import { uid } from './utils'

/** Tamanho máximo do áudio (15 MB) — o mesmo limite do servidor. */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

/** Tamanho de cada parte enviada. */
const CHUNK_BYTES = 2 * 1024 * 1024

export interface AudioUploadResult {
  id: string
  nome: string
  mime: string
  tamanho: number
}

/** Converte um arquivo em base64 (sem estourar a pilha do navegador). */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  const passo = 0x8000
  for (let i = 0; i < bytes.length; i += passo) {
    binario += String.fromCharCode(...Array.from(bytes.subarray(i, i + passo)))
  }
  return btoa(binario)
}

/** Formata o tamanho do arquivo para a tela (ex.: '4,2 MB'). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Endereço do arquivo (o player usa direto na tag <audio>). */
export function audioUrl(id: string): string {
  return apiUrl(`/api/audio?id=${encodeURIComponent(id)}`)
}

/**
 * Envia um MP3 para o servidor.
 *
 * `onProgress` recebe o percentual (0–100) para a barra de progresso.
 */
export async function uploadAudio(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<AudioUploadResult> {
  const pareceAudio = /^audio\//i.test(file.type) || /\.(mp3|m4a|aac|ogg|wav|flac)$/i.test(file.name)
  if (!pareceAudio) {
    throw new Error('Escolha um arquivo de áudio (MP3, M4A…).')
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error(
      `O arquivo tem ${formatBytes(file.size)} — o limite é ${formatBytes(MAX_AUDIO_BYTES)}. Envie uma versão mais leve.`,
    )
  }
  if (file.size === 0) {
    throw new Error('O arquivo está vazio.')
  }

  const token = syncToken()
  if (!token) {
    throw new Error('Entre no app para enviar o áudio.')
  }

  const uploadId = uid('aud')
  const total = Math.max(1, Math.ceil(file.size / CHUNK_BYTES))
  const mime = file.type || 'audio/mpeg'

  for (let parte = 0; parte < total; parte++) {
    const inicio = parte * CHUNK_BYTES
    const fim = Math.min(file.size, inicio + CHUNK_BYTES)
    const dados = toBase64(await file.slice(inicio, fim).arrayBuffer())

    const response = await fetch(apiUrl('/api/audio'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uploadId,
        parte,
        total,
        nome: file.name,
        mime,
        dados,
      }),
    })

    const json = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      throw new Error(json.error ?? 'Não foi possível enviar o áudio.')
    }

    onProgress?.(Math.round(((parte + 1) / total) * 100))
  }

  return { id: uploadId, nome: file.name, mime, tamanho: file.size }
}

/** Apaga o áudio do servidor (quando o ministro remove o MP3 da música). */
export async function removeAudio(id: string): Promise<void> {
  const token = syncToken()
  if (!token) return
  try {
    await fetch(apiUrl(`/api/audio?id=${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* sem internet: o arquivo fica no servidor (o app avisa antes de salvar) */
  }
}

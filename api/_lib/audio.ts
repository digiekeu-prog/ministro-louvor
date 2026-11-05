/**
 * Áudios (MP3) das músicas do repertório.
 *
 * Como funciona:
 *  - o ministro escolhe um arquivo MP3 no editor da escala;
 *  - o app envia o arquivo **em partes** (2 MB cada), porque a function da
 *    Vercel aceita no máximo ~4,5 MB por requisição;
 *  - o servidor junta as partes e guarda o áudio no banco (tabela `wf_audio`);
 *  - a música guarda só o `audioId` — assim o arquivo NÃO viaja na fila de
 *    sincronização (que é leve), e sim pela rede, só quando alguém toca.
 *
 * O link do áudio é público (como a escala): quem tem o link da escala pode
 * ouvir — inclusive pelo celular, sem instalar nada.
 */

/** Tamanho máximo de um áudio (15 MB). */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

/** Tamanho de cada parte enviada (2 MB — fica bem abaixo do limite da Vercel). */
export const MAX_CHUNK_BYTES = 2 * 1024 * 1024

export interface AudioMeta {
  id: string
  nome: string
  mime: string
  tamanho: number
}

/** Onde o áudio fica guardado (Postgres na nuvem, arquivo local no dev). */
export interface AudioStore {
  /** Guarda uma parte do upload (ainda não finalizada). */
  saveChunk(uploadId: string, parte: number, bytes: Buffer): Promise<void>
  /** Lê as partes já salvas, na ordem. */
  readChunks(uploadId: string, total: number): Promise<Buffer[]>
  /** Apaga as partes temporárias. */
  clearChunks(uploadId: string): Promise<void>
  /** Grava o áudio final. */
  save(meta: AudioMeta, bytes: Buffer): Promise<void>
  /** Lê o áudio final (null quando não existe). */
  read(id: string): Promise<{ meta: AudioMeta; bytes: Buffer } | null>
  /** Apaga o áudio final. */
  remove(id: string): Promise<void>
}

export interface AudioUploadBody {
  uploadId?: string
  parte?: number
  total?: number
  nome?: string
  mime?: string
  /** A parte do arquivo, em base64. */
  dados?: string
}

export interface AudioResult {
  status: number
  body: Record<string, unknown>
}

/** Só aceita ids feitos de letras, números, hífen e sublinhado. */
export function sanitizeAudioId(raw: string | undefined | null): string {
  const id = (raw ?? '').trim()
  if (!/^[a-zA-Z0-9_-]{3,60}$/.test(id)) return ''
  return id
}

/** Remove acentos e caracteres estranhos do nome do arquivo. */
function cleanName(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * POST /api/audio — recebe uma parte do arquivo.
 *
 * Quando chega a última parte, o servidor junta tudo e grava o áudio final.
 */
export async function handleAudioUpload(
  store: AudioStore,
  body: AudioUploadBody | null,
  isAdmin: boolean,
): Promise<AudioResult> {
  if (!isAdmin) {
    return { status: 403, body: { error: 'Só o ministro pode enviar arquivos de áudio.' } }
  }

  const uploadId = sanitizeAudioId(body?.uploadId)
  if (!uploadId) return { status: 400, body: { error: 'Envio inválido.' } }

  const parte = Number(body?.parte)
  const total = Number(body?.total)
  if (!Number.isInteger(parte) || !Number.isInteger(total) || total < 1 || parte < 0 || parte >= total) {
    return { status: 400, body: { error: 'Envio inválido: as partes do arquivo não conferem.' } }
  }

  const nome = cleanName(body?.nome ?? '')
  if (!nome) return { status: 400, body: { error: 'Informe o nome do arquivo.' } }

  const mime = (body?.mime ?? '').trim() || 'audio/mpeg'
  if (!/^audio\//i.test(mime)) {
    return { status: 400, body: { error: 'Só é possível enviar arquivos de áudio (MP3, M4A…).' } }
  }

  const raw = body?.dados ?? ''
  if (!raw) return { status: 400, body: { error: 'A parte do arquivo chegou vazia.' } }

  const bytes = Buffer.from(raw, 'base64')
  if (!bytes.length) {
    return { status: 400, body: { error: 'Não foi possível ler o arquivo enviado.' } }
  }
  if (bytes.length > MAX_CHUNK_BYTES) {
    return {
      status: 413,
      body: { error: 'A parte do arquivo é grande demais. Tente enviar de novo.' },
    }
  }

  await store.saveChunk(uploadId, parte, bytes)

  // ainda faltam partes: o app continua enviando
  if (parte < total - 1) {
    return { status: 200, body: { id: uploadId, parte, total, pronto: false } }
  }

  // última parte: junta tudo e grava o áudio final
  const partes = await store.readChunks(uploadId, total)
  if (partes.length !== total) {
    return {
      status: 409,
      body: { error: 'Faltou parte do arquivo. Envie o áudio novamente.' },
    }
  }

  const dados = Buffer.concat(partes)
  if (dados.length > MAX_AUDIO_BYTES) {
    await store.clearChunks(uploadId)
    return {
      status: 413,
      body: { error: 'O áudio passa de 15 MB. Envie uma versão mais leve do MP3.' },
    }
  }

  await store.save({ id: uploadId, nome, mime, tamanho: dados.length }, dados)
  await store.clearChunks(uploadId)

  return {
    status: 200,
    body: {
      id: uploadId,
      nome,
      mime,
      tamanho: dados.length,
      pronto: true,
    },
  }
}

/** DELETE /api/audio?id=aud_xxx — apaga o áudio (quando o ministro remove o MP3). */
export async function handleAudioDelete(
  store: AudioStore,
  id: string,
  isAdmin: boolean,
): Promise<AudioResult> {
  if (!isAdmin) {
    return { status: 403, body: { error: 'Só o ministro pode apagar arquivos de áudio.' } }
  }
  const audioId = sanitizeAudioId(id)
  if (!audioId) return { status: 400, body: { error: 'Áudio inválido.' } }
  await store.remove(audioId)
  return { status: 200, body: { ok: true } }
}

export interface AudioFileResult {
  status: number
  headers: Record<string, string>
  body: Buffer
}

/**
 * GET /api/audio?id=aud_xxx — entrega o arquivo para tocar no app.
 *
 * Aceita `Range` (o navegador pede para pular para outro ponto da música),
 * por isso o player consegue voltar atrás depois de pular adiante.
 */
export async function handleAudioGet(
  store: AudioStore,
  id: string,
  rangeHeader?: string | undefined,
): Promise<AudioFileResult | null> {
  const audioId = sanitizeAudioId(id)
  if (!audioId) return null

  const arquivo = await store.read(audioId)
  if (!arquivo) return null

  const total = arquivo.bytes.length
  const headers: Record<string, string> = {
    'Content-Type': arquivo.meta.mime || 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    ETag: `"${arquivo.meta.id}-${arquivo.meta.tamanho}"`,
  }

  const range = parseRange(rangeHeader, total)
  if (!range) {
    headers['Content-Length'] = String(total)
    return { status: 200, headers, body: arquivo.bytes }
  }

  const { inicio, fim } = range
  headers['Content-Range'] = `bytes ${inicio}-${fim}/${total}`
  headers['Content-Length'] = String(fim - inicio + 1)
  return {
    status: 206,
    headers,
    body: arquivo.bytes.subarray(inicio, fim + 1),
  }
}

/** Entende o header `Range: bytes=0-1023` (e `bytes=-500`, do fim). */
function parseRange(
  header: string | undefined,
  total: number,
): { inicio: number; fim: number } | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match) return null

  const [, inicioStr, fimStr] = match
  if (!inicioStr && !fimStr) return null

  let inicio: number
  let fim: number

  if (!inicioStr) {
    // últimos N bytes
    const n = Number(fimStr)
    if (!Number.isFinite(n) || n <= 0) return null
    inicio = Math.max(0, total - n)
    fim = total - 1
  } else {
    inicio = Number(inicioStr)
    fim = fimStr ? Number(fimStr) : total - 1
  }

  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null
  if (inicio > fim || inicio >= total) return null

  return { inicio, fim: Math.min(fim, total - 1) }
}

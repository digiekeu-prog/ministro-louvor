export type Category = 'instrumentista' | 'vocal' | 'tecnica'

export type MemberCategory = Category | 'admin'

export interface Member {
  id: string
  name: string
  /**
   * Celular: é com ele que a pessoa entra no app (a senha é livre).
   * Quem fica sem celular cadastrado apenas visualiza a escala pelo link público.
   */
  phone?: string
  /** WhatsApp do ministro: é para ele que chega a mensagem da escala. */
  whatsapp?: string
  category: MemberCategory
  /** Funções que a pessoa pode executar (ex.: 'Teclado', 'Backing Vocal') */
  skills: string[]
  /** Funk de identidade do avatar */
  hue: number
  active: boolean
  notes?: string
}

export interface Slot {
  id: string
  category: Category
  /** Função exercida no culto: 'Teclado', 'Ministro', 'Backing Vocal'... */
  functionName: string
  memberId?: string
  notes?: string
}

export type ServiceStatus = 'rascunho' | 'confirmado' | 'realizado'

/** Música dentro de um culto: título + origem do áudio + letra/cifra para o palco. */
export interface ServiceSong {
  id?: string
  title: string
  artist?: string
  /** Link da música (YouTube, Vimeo, Spotify, Deezer, Apple Music ou qualquer URL) */
  link?: string
  /** Letra completa exibida dentro do app */
  lyrics?: string
  /** Cifra completa (letra com os acordes acima) */
  chords?: string
  /** Progressão de acordes do trecho principal (ex.: 'G | C | D | Em') */
  progression?: string
  /** Tom da música (ex.: 'D', 'G', 'Bb') */
  key?: string
  bpm?: number
  notes?: string
  /**
   * Áudio MP3 enviado pelo ministro: só o `id` viaja na sincronização — o
   * arquivo fica guardado no servidor e é tocado pelo player do app.
   */
  audioId?: string
  /** Nome do arquivo enviado (ex.: 'celebrai-a-cristo.mp3'). */
  audioName?: string
  /** Tamanho do arquivo, em bytes. */
  audioSize?: number
}

export interface Service {
  id: string
  title: string
  date: string // ISO yyyy-mm-dd
  time: string // HH:mm
  location?: string
  status: ServiceStatus
  slots: Slot[]
  songs: ServiceSong[]
  notes?: string
  createdAt: string
  updatedAt: string
}

/** Música do catálogo global do ministério (repertório da equipe). */
export interface Song extends ServiceSong {
  id: string
}

export interface Presence {
  memberId: string
  serviceId: string
  confirmed: boolean
  respondedAt?: string
}

export interface SessionUser {
  id: string
  /** Celular usado para entrar (com o código do país, como o servidor devolve). */
  phone: string
  name?: string
  category?: Member['category']
}

export const INSTRUMENT_FUNCTIONS = [
  'Teclado',
  'Violão',
  'Baixo',
  'Bateria',
  'Guitarra',
  'Cajón',
  'Percussão',
  'Saxofone',
  'Trombone',
] as const

export const VOCAL_FUNCTIONS = [
  'Ministro',
  'Backing Vocal',
  'Vocal Solo',
  'Coral',
  'Respaldo',
] as const

/**
 * Funções da equipe técnica (mesa de som, projeção…).
 * Essas pessoas entram na escala como qualquer outra, mas **não precisam de
 * e-mail nem de login**: elas só visualizam a escala pelo link público.
 */
export const TECHNICAL_FUNCTIONS = [
  'Mesa de som',
  'Projeção',
  'Projeção de letras',
  'Filmagem',
  'Tecnologia',
] as const

export const CATEGORY_LABEL: Record<Category, string> = {
  instrumentista: 'Instrumentistas',
  vocal: 'Vocais',
  tecnica: 'Equipe técnica',
}

export const CATEGORY_SINGULAR: Record<Category, string> = {
  instrumentista: 'Instrumentista',
  vocal: 'Vocal',
  tecnica: 'Técnico',
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
}

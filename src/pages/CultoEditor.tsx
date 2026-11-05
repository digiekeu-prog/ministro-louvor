import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardPaste,
  FileText,
  GripVertical,
  Guitar,
  Link2,
  Music2,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { PageTitle } from '../components/AppShell'
import { Avatar, Badge, Button, Card, Field, Input, Segmented, Select, Textarea } from '../components/ui'
import { useData } from '../store/DataContext'
import type { Category, Service, ServiceSong, ServiceStatus, Slot } from '../lib/types'
import {
  CATEGORY_LABEL,
  CATEGORY_SINGULAR,
  INSTRUMENT_FUNCTIONS,
  STATUS_LABEL,
  TECHNICAL_FUNCTIONS,
  VOCAL_FUNCTIONS,
} from '../lib/types'
import { SOURCE_STYLE, describeMedia } from '../lib/mediaLinks'
import { splitChordSheet } from '../lib/chordSheet'
import { cn, toISODate, uid } from '../lib/utils'

const CATEGORY_ACCENT: Record<Category, { chip: string; text: string; ring: string }> = {
  instrumentista: {
    chip: 'bg-neon-cyan/12 text-neon-cyan ring-neon-cyan/25',
    text: 'text-neon-cyan',
    ring: 'focus-within:ring-neon-cyan/20 focus-within:border-neon-cyan/40',
  },
  vocal: {
    chip: 'bg-neon-purple/12 text-neon-purple ring-neon-purple/25',
    text: 'text-neon-purple',
    ring: 'focus-within:ring-neon-purple/20 focus-within:border-neon-purple/40',
  },
  tecnica: {
    chip: 'bg-neon-gold/12 text-neon-gold ring-neon-gold/25',
    text: 'text-neon-gold',
    ring: 'focus-within:ring-neon-gold/20 focus-within:border-neon-gold/40',
  },
}

/** Ordem das abas de vagas no editor. */
const CATEGORIAS: Category[] = ['instrumentista', 'vocal', 'tecnica']

function defaultSlots(category: Category): Slot[] {
  const list =
    category === 'instrumentista'
      ? INSTRUMENT_FUNCTIONS
      : category === 'vocal'
        ? VOCAL_FUNCTIONS
        : TECHNICAL_FUNCTIONS
  const defaults = category === 'instrumentista' ? list.slice(0, 5) : list.slice(0, 2)
  return defaults.map((functionName) => ({ id: uid('slot'), category, functionName }))
}

/** Próxima categoria (usada no botão "mover para…"). */
function proximaCategoria(category: Category): Category {
  const indice = CATEGORIAS.indexOf(category)
  return CATEGORIAS[(indice + 1) % CATEGORIAS.length]
}

export function CultoEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { members, songs, getService, addService, updateService, removeService } = useData()
  const editing = id && id !== 'nova' ? getService(id) : undefined

  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? toISODate(new Date()))
  const [time, setTime] = useState(editing?.time ?? '19:00')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [status, setStatus] = useState<ServiceStatus>(editing?.status ?? 'rascunho')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [slots, setSlots] = useState<Slot[]>(
    editing?.slots ?? [
      ...defaultSlots('instrumentista'),
      ...defaultSlots('vocal'),
      ...defaultSlots('tecnica'),
    ],
  )
  const [activeCategory, setActiveCategory] = useState<Category>('instrumentista')
  const [selectedSongs, setSelectedSongs] = useState<ServiceSong[]>(editing?.songs ?? [])
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) return
    setTitle(editing.title)
    setDate(editing.date)
    setTime(editing.time)
    setLocation(editing.location ?? '')
    setStatus(editing.status)
    setNotes(editing.notes ?? '')
    setSlots(editing.slots)
    setSelectedSongs(editing.songs)
  }, [editing])

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members])

  /** Membros compatíveis com a categoria da vaga */
  function eligibleMembers(category: Category) {
    return activeMembers.filter((m) => {
      if (category === 'instrumentista') return m.category === 'instrumentista' || m.category === 'admin'
      if (category === 'vocal') return m.category === 'vocal' || m.category === 'admin'
      return m.category === 'tecnica' || m.category === 'admin'
    })
  }

  /** Membros já escalados em outra vaga do mesmo culto */
  const assignedElsewhere = useMemo(() => {
    const map = new Map<string, string[]>()
    slots.forEach((slot) => {
      if (!slot.memberId) return
      const list = map.get(slot.memberId) ?? []
      list.push(slot.functionName)
      map.set(slot.memberId, list)
    })
    return map
  }, [slots])

  const categorySlots = slots.filter((s) => s.category === activeCategory)
  const filledCount = slots.filter((s) => s.memberId).length

  function updateSlot(slotId: string, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...patch } : s)))
    setSaved(false)
  }

  function updateSong(index: number, patch: Partial<ServiceSong>) {
    setSelectedSongs((prev) => prev.map((song, i) => (i === index ? { ...song, ...patch } : song)))
    setSaved(false)
  }

  /** Mostra um aviso temporário na tela. */
  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 5000)
  }

  /**
   * Cola um texto que veio de um site de cifra: se tiver linhas de acordes,
   * separa automaticamente a letra da cifra (guardando o alinhamento).
   */
  function applyPastedText(index: number, raw: string, target: 'lyrics' | 'chords') {
    const result = splitChordSheet(raw)
    if (!result.detected) {
      updateSong(index, { [target]: raw } as Partial<ServiceSong>)
      showNotice(target === 'lyrics' ? 'Letra colada.' : 'Cifra colada.')
      return
    }
    updateSong(index, { lyrics: result.lyrics, chords: result.chords })
    showNotice('Cifra detectada — letra e cifras separadas automaticamente.')
  }

  /** Cola direto da área de transferência (um clique, sem Ctrl+V). */
  async function pasteFromClipboard(index: number, target: 'lyrics' | 'chords') {
    try {
      // timeout: se o navegador travar esperando permissão, o usuário é avisado
      const text = await Promise.race([
        navigator.clipboard.readText(),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('timeout')), 3000),
        ),
      ])
      if (!text.trim()) {
        showNotice('A área de transferência está vazia.')
        return
      }
      applyPastedText(index, text, target)
    } catch {
      showNotice('Não foi possível ler a área de transferência. Use Ctrl+V dentro do campo.')
    }
  }

  function removeSong(index: number) {
    setSelectedSongs((prev) => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function addSlot(category: Category, functionName = '') {
    setSlots((prev) => [
      ...prev,
      { id: uid('slot'), category, functionName: functionName || 'Nova função', memberId: undefined },
    ])
    setSaved(false)
  }

  function removeSlot(slotId: string) {
    setSlots((prev) => prev.filter((s) => s.id !== slotId))
    setSaved(false)
  }

  /** Move uma vaga entre categorias (ex.: alguém que toca e também canta) */
  function moveSlot(slotId: string, category: Category) {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, category } : s)))
    setSaved(false)
  }

  function autoFill() {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.memberId) return slot
        const pool = eligibleMembers(slot.category).filter(
          (m) => !prev.some((s) => s.id !== slot.id && s.memberId === m.id),
        )
        const match = pool.find((m) =>
          m.skills.some((skill) => skill.toLowerCase() === slot.functionName.toLowerCase()),
        )
        const chosen = match ?? pool[0]
        return chosen ? { ...slot, memberId: chosen.id } : slot
      }),
    )
    setSaved(false)
  }

  function handleSave() {
    const validation: string[] = []
    if (!title.trim()) validation.push('Informe o nome do culto.')
    if (!date) validation.push('Informe a data do culto.')

    // Uma pessoa pode estar em mais de uma função (toca e canta ao mesmo
    // tempo, por exemplo) — isso é permitido e não impede o salvamento.

    setErrors(validation)
    if (validation.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const payload: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      date,
      time,
      location: location.trim() || undefined,
      status,
      slots: slots
        .filter((s) => s.functionName.trim())
        .map((s) => ({ ...s, functionName: s.functionName.trim() })),
      songs: selectedSongs,
      notes: notes.trim() || undefined,
    }

    if (editing) {
      updateService(editing.id, payload)
      setSaved(true)
      navigate(`/app/escalas/${editing.id}`, { state: { compartilhar: true } })
    } else {
      const created = addService(payload)
      setSaved(true)
      navigate(`/app/escalas/${created.id}`, { state: { compartilhar: true } })
    }
  }

  function handleDelete() {
    if (!editing) return
    if (window.confirm('Excluir esta escala? Essa ação não pode ser desfeita.')) {
      removeService(editing.id)
      navigate('/app/escalas')
    }
  }

  const functionOptions =
    activeCategory === 'instrumentista'
      ? INSTRUMENT_FUNCTIONS
      : activeCategory === 'vocal'
        ? VOCAL_FUNCTIONS
        : TECHNICAL_FUNCTIONS

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <PageTitle
        eyebrow={editing ? 'Editar escala' : 'Nova escala'}
        title={editing ? editing.title : 'Criar novo culto'}
        description={
          'Defina os dados do culto e distribua a equipe por função — instrumento por instrumento, voz por voz.'
        }
      />

      {errors.length > 0 && (
        <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-300">
            <CircleAlert size={16} /> Não foi possível salvar
          </div>
          <ul className="space-y-1 text-sm text-red-200/80">
            {errors.map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {notice && (
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan">
          <Check size={16} className="shrink-0" />
          {notice}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* --------------------------- Coluna principal --------------------------- */}
        <div className="space-y-5 lg:col-span-2">
          {/* Dados do culto */}
          <Card>
            <div className="border-b border-white/8 px-5 py-4 sm:px-6">
              <h2 className="font-display text-lg font-semibold text-white">Dados do culto</h2>
              <p className="mt-0.5 text-sm text-zinc-400">Quando e onde acontece o encontro.</p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <Field label="Nome do culto" className="sm:col-span-2">
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="Culto Domingo — Manhã"
                />
              </Field>

              <Field label="Data">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setSaved(false)
                  }}
                />
              </Field>

              <Field label="Horário">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value)
                    setSaved(false)
                  }}
                />
              </Field>

              <Field label="Local">
                <Input
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="Templo Central"
                />
              </Field>

              <Field label="Status">
                <Select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as ServiceStatus)
                    setSaved(false)
                  }}
                >
                  {(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {STATUS_LABEL[key]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Observações" className="sm:col-span-2">
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="Ex.: chegar 30 min antes para o teste de som."
                />
              </Field>
            </div>
          </Card>

          {/* ============ DIVISÃO DE EQUIPE (feature principal) ============ */}
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  Divisão da equipe
                </h2>
                <p className="mt-0.5 text-sm text-zinc-400">
                  Selecione o integrante e a função que ele exerce neste culto.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="cyan">
                  {filledCount}/{slots.length} preenchidas
                </Badge>
                <Button size="sm" variant="secondary" onClick={autoFill} type="button">
                  <Check size={14} /> Preencher
                </Button>
              </div>
            </div>

            <div className="px-5 pt-5 sm:px-6">
              <Segmented
                value={activeCategory}
                onChange={setActiveCategory}
                options={[
                  {
                    value: 'instrumentista',
                    label: `Instrumentistas (${slots.filter((s) => s.category === 'instrumentista').length})`,
                    icon: <Music2 size={15} />,
                  },
                  {
                    value: 'vocal',
                    label: `Vocais (${slots.filter((s) => s.category === 'vocal').length})`,
                    icon: <Users size={15} />,
                  },
                  {
                    value: 'tecnica',
                    label: `Técnica (${slots.filter((s) => s.category === 'tecnica').length})`,
                    icon: <SlidersHorizontal size={15} />,
                  },
                ]}
              />
            </div>

            <div className="p-5 sm:p-6">
              {categorySlots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 px-5 py-10 text-center">
                  <p className="text-sm text-zinc-400">
                    Nenhuma vaga em {CATEGORY_LABEL[activeCategory].toLowerCase()} ainda.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-4" onClick={() => addSlot(activeCategory)}>
                    <Plus size={14} /> Adicionar função
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {categorySlots.map((slot) => {
                    const member = members.find((m) => m.id === slot.memberId)
                    const eligible = eligibleMembers(slot.category)
                    const otherFunctions = assignedElsewhere.get(slot.memberId ?? '') ?? []
                    const accent = CATEGORY_ACCENT[slot.category]

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          'group rounded-2xl border border-white/8 bg-ink-900/60 p-3.5 transition-all focus-within:ring-2',
                          accent.ring,
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-2 sm:w-10 sm:justify-center">
                            <GripVertical size={16} className="hidden text-zinc-700 sm:block" />
                            <span
                              className={cn(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ring-1 sm:hidden',
                                accent.chip,
                              )}
                            >
                              {slot.functionName.slice(0, 2).toUpperCase()}
                            </span>
                          </div>

                          {/* Função */}
                          <div className="flex-1">
                            <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              {CATEGORY_SINGULAR[slot.category]} · Função
                            </label>
                            <div className="relative">
                              <select
                                value={
                                  functionOptions.includes(slot.functionName as never)
                                    ? slot.functionName
                                    : '__custom'
                                }
                                onChange={(e) => {
                                  const value = e.target.value
                                  updateSlot(slot.id, {
                                    functionName: value === '__custom' ? slot.functionName : value,
                                  })
                                }}
                                className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-ink-900/80 px-3.5 pr-9 text-sm font-medium text-white outline-none transition focus:border-neon-cyan/40 focus:ring-2 focus:ring-neon-cyan/15"
                              >
                                {functionOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                                <option value="__custom">Outra função…</option>
                              </select>
                              <ChevronDown
                                size={15}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                              />
                            </div>
                            {!functionOptions.includes(slot.functionName as never) && (
                              <Input
                                value={slot.functionName}
                                onChange={(e) => updateSlot(slot.id, { functionName: e.target.value })}
                                className="mt-2 h-10"
                                placeholder="Nome da função"
                              />
                            )}
                          </div>

                          {/* Integrante */}
                          <div className="flex-1">
                            <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Integrante
                            </label>
                            <div className="relative">
                              <select
                                value={slot.memberId ?? ''}
                                onChange={(e) =>
                                  updateSlot(slot.id, { memberId: e.target.value || undefined })
                                }
                                className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-ink-900/80 px-3.5 pr-9 text-sm text-white outline-none transition focus:border-neon-cyan/40 focus:ring-2 focus:ring-neon-cyan/15"
                              >
                                <option value="">— Vazio —</option>
                                {eligible.map((option) => {
                                  const used = assignedElsewhere.get(option.id) ?? []
                                  const alreadyHere = used.filter((f) => f !== slot.functionName)
                                  return (
                                    <option key={option.id} value={option.id}>
                                      {option.name}
                                      {alreadyHere.length ? ` · já em ${alreadyHere[0]}` : ''}
                                    </option>
                                  )
                                })}
                              </select>
                              <ChevronDown
                                size={15}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                              />
                            </div>
                            {member && otherFunctions.length > 1 && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-[0.68rem] text-zinc-500">
                                <CircleAlert size={12} /> Também está em:{' '}
                                {otherFunctions.filter((f) => f !== slot.functionName).join(', ')}
                              </p>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-1 sm:flex-col">
                            {member && (
                              <Avatar name={member.name} hue={member.hue} size={38} />
                            )}
                            <button
                              type="button"
                              onClick={() => removeSlot(slot.id)}
                              aria-label="Remover função"
                              className="grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Nota da vaga */}
                        <Input
                          value={slot.notes ?? ''}
                          onChange={(e) => updateSlot(slot.id, { notes: e.target.value })}
                          placeholder="Observação (ex.: entrada pela lateral, chega atrasado)"
                          className="mt-3 h-9 border-white/6 bg-ink-950/50 text-xs"
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => addSlot(activeCategory)} type="button">
                  <Plus size={14} /> Nova função em {CATEGORY_LABEL[activeCategory].toLowerCase()}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    moveSlot(
                      categorySlots[0]?.id ?? '',
                      proximaCategoria(activeCategory),
                    )
                  }
                  disabled={categorySlots.length === 0}
                  type="button"
                  title="Move a primeira vaga para a outra categoria"
                >
                  Mover primeira para {CATEGORY_LABEL[proximaCategoria(activeCategory)]}
                </Button>
              </div>
            </div>
          </Card>

          {/* Repertório */}
          <Card>
            <div className="border-b border-white/8 px-5 py-4 sm:px-6">
              <h2 className="font-display text-lg font-semibold text-white">Repertório</h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                Cadastre o link da música, a letra e a cifra. O músico abre tudo isso dentro
                do app, direto no palco.
              </p>
            </div>

            <div className="space-y-3 p-5 sm:p-6">
              {selectedSongs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/12 px-5 py-10 text-center">
                  <Music2 size={20} className="mx-auto mb-3 text-zinc-600" />
                  <p className="text-sm text-zinc-400">
                    Nenhuma música no repertório deste culto.
                  </p>
                </div>
              )}

              {selectedSongs.map((song, index) => {
                const media = song.link ? describeMedia(song.link) : null
                const sourceStyle = media ? SOURCE_STYLE[media.source] : null

                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/8 bg-ink-900/60 p-4 transition focus-within:border-neon-cyan/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neon-gold/12 text-xs font-bold text-neon-gold">
                        {index + 1}
                      </span>
                      <Input
                        value={song.title}
                        onChange={(e) => updateSong(index, { title: e.target.value })}
                        placeholder="Título da música"
                        className="h-10 flex-1 font-medium"
                      />
                      {media && sourceStyle && (
                        <span
                          className={cn(
                            'hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-wider ring-1 sm:inline-flex',
                            sourceStyle.chip,
                          )}
                        >
                          {media.label}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSong(index)}
                        aria-label="Remover música"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Input
                        value={song.artist ?? ''}
                        onChange={(e) => updateSong(index, { artist: e.target.value })}
                        placeholder="Intérprete"
                        className="h-10"
                      />
                      <div className="relative">
                        <Link2
                          size={15}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                        />
                        <Input
                          value={song.link ?? ''}
                          onChange={(e) => updateSong(index, { link: e.target.value })}
                          placeholder="Link: YouTube, Vimeo, Spotify…"
                          className="h-10 pl-9"
                        />
                      </div>
                      <Input
                        value={song.key ?? ''}
                        onChange={(e) => updateSong(index, { key: e.target.value })}
                        placeholder="Tom (ex.: G)"
                        className="h-10"
                      />
                      <Input
                        value={song.progression ?? ''}
                        onChange={(e) => updateSong(index, { progression: e.target.value })}
                        placeholder="Progressão (ex.: G | C | D | Em)"
                        className="h-10 font-mono"
                      />
                      <Input
                        type="number"
                        min={30}
                        max={260}
                        value={song.bpm ?? ''}
                        onChange={(e) =>
                          updateSong(index, {
                            bpm: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="BPM"
                        className="h-10"
                      />
                    </div>

                    {/* Letra e cifra */}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <details
                        className="group rounded-xl border border-white/8 bg-ink-950/40 open:border-neon-purple/25"
                        open={Boolean(song.lyrics?.trim())}
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-zinc-300 transition hover:text-white">
                          <FileText size={14} className="text-neon-purple" />
                          Letra
                          {song.lyrics?.trim() ? (
                            <span className="ml-auto text-[0.62rem] text-emerald-400">cadastrada</span>
                          ) : (
                            <span className="ml-auto text-[0.62rem] text-zinc-600">vazia</span>
                          )}
                        </summary>
                        <div className="flex items-center gap-2 px-3 pb-1">
                          <button
                            type="button"
                            onClick={() => pasteFromClipboard(index, 'lyrics')}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.68rem] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
                          >
                            <ClipboardPaste size={12} /> Colar da área de transferência
                          </button>
                        </div>
                        <Textarea
                          value={song.lyrics ?? ''}
                          onChange={(e) => updateSong(index, { lyrics: e.target.value })}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text')
                            const result = splitChordSheet(text)
                            if (!result.detected) return
                            e.preventDefault()
                            applyPastedText(index, text, 'lyrics')
                          }}
                          placeholder="Cole aqui a letra da música…"
                          className="m-2 min-h-40 border-0 bg-transparent p-2 text-sm leading-relaxed"
                        />
                      </details>

                      <details
                        className="group rounded-xl border border-white/8 bg-ink-950/40 open:border-neon-gold/25"
                        open={Boolean(song.chords?.trim())}
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-zinc-300 transition hover:text-white">
                          <Guitar size={14} className="text-neon-gold" />
                          Cifra
                          {song.chords?.trim() ? (
                            <span className="ml-auto text-[0.62rem] text-emerald-400">cadastrada</span>
                          ) : (
                            <span className="ml-auto text-[0.62rem] text-zinc-600">vazia</span>
                          )}
                        </summary>
                        <div className="flex items-center gap-2 px-3 pb-1">
                          <button
                            type="button"
                            onClick={() => pasteFromClipboard(index, 'chords')}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.68rem] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
                          >
                            <ClipboardPaste size={12} /> Colar da área de transferência
                          </button>
                        </div>
                        <Textarea
                          value={song.chords ?? ''}
                          onChange={(e) => updateSong(index, { chords: e.target.value })}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text')
                            const result = splitChordSheet(text)
                            if (!result.detected) return
                            e.preventDefault()
                            applyPastedText(index, text, 'chords')
                          }}
                          placeholder={
                            'Cole a cifra com a letra embaixo:\n\nG        C\nAmazing grace! how sweet the sound\n\nou só os acordes'
                          }
                          className="m-2 min-h-40 border-0 bg-transparent p-2 font-mono text-xs leading-relaxed"
                        />
                      </details>
                    </div>
                  </div>
                )
              })}

              {/* Adicionar */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    const found = songs.find((song) => song.id === e.target.value)
                    if (!found) return
                    const { id: _id, ...rest } = found
                    setSelectedSongs((prev) => [...prev, { ...rest }])
                    setSaved(false)
                  }}
                  className="flex-1"
                >
                  <option value="">+ Adicionar do repertório do ministério…</option>
                  {songs
                    .filter((song) => !selectedSongs.some((s) => s.title === song.title))
                    .map((song) => (
                      <option key={song.id} value={song.id}>
                        {song.title} {song.artist ? `— ${song.artist}` : ''}
                      </option>
                    ))}
                </Select>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setSelectedSongs((prev) => [...prev, { title: 'Nova música' }])
                    setSaved(false)
                  }}
                >
                  <Plus size={15} /> Música em branco
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ------------------------------ Coluna lateral ----------------------------- */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-white">Resumo</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Instrumentistas</dt>
                <dd className="font-medium text-zinc-200">
                  {slots.filter((s) => s.category === 'instrumentista' && s.memberId).length}/
                  {slots.filter((s) => s.category === 'instrumentista').length}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Vocais</dt>
                <dd className="font-medium text-zinc-200">
                  {slots.filter((s) => s.category === 'vocal' && s.memberId).length}/
                  {slots.filter((s) => s.category === 'vocal').length}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Equipe técnica</dt>
                <dd className="font-medium text-zinc-200">
                  {slots.filter((s) => s.category === 'tecnica' && s.memberId).length}/
                  {slots.filter((s) => s.category === 'tecnica').length}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Integrantes únicos</dt>
                <dd className="font-medium text-zinc-200">
                  {new Set(slots.filter((s) => s.memberId).map((s) => s.memberId)).size}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Músicas</dt>
                <dd className="font-medium text-zinc-200">{selectedSongs.length}</dd>
              </div>
            </dl>

            {slots.some((s) => !s.memberId) && (
              <div className="mt-4 rounded-xl border border-neon-gold/25 bg-neon-gold/8 px-3 py-2.5 text-xs text-neon-gold">
                {slots.filter((s) => !s.memberId).length} vaga(s) ainda sem responsável.
              </div>
            )}

            {editing && (
              <button
                type="button"
                onClick={handleDelete}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
              >
                <Trash2 size={14} /> Excluir escala
              </button>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-white">Equipe disponível</h3>
            <div className="space-y-2">
              {activeMembers.map((member) => {
                const assigned = slots.find((s) => s.memberId === member.id)
                return (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar name={member.name} hue={member.hue} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{member.name}</p>
                      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-zinc-500">
                        {member.category === 'admin'
                          ? 'Ministro'
                          : member.category === 'vocal'
                            ? 'Vocal'
                            : member.category === 'tecnica'
                              ? 'Técnico'
                              : 'Instrumentista'}
                      </p>
                    </div>
                    {assigned ? (
                      <Badge tone="cyan" className="shrink-0">
                        {assigned.functionName}
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-[0.65rem] text-zinc-600">livre</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Barra fixa de salvamento */}
      <div className="fixed bottom-[76px] left-0 right-0 z-30 border-t border-white/8 bg-ink-900/92 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:left-[272px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
            <UserRound size={14} />
            {slots.filter((s) => s.memberId).length} integrantes escalados para este culto
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave}>
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Salvo' : 'Salvar escala'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

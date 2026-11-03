import { useMemo, useState } from 'react'
import { Music2, Pencil, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { PageTitle } from '../components/AppShell'
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Segmented, Select } from '../components/ui'
import { useData } from '../store/DataContext'
import type { Member, MemberCategory } from '../lib/types'
import { CATEGORY_SINGULAR, INSTRUMENT_FUNCTIONS, VOCAL_FUNCTIONS } from '../lib/types'
import { cn } from '../lib/utils'

type Filter = 'todos' | 'instrumentista' | 'vocal' | 'admin'

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  category: 'instrumentista' as MemberCategory,
  skills: [] as string[],
  notes: '',
}

export function EquipePage() {
  const { members, addMember, updateMember, removeMember } = useData()
  const [filter, setFilter] = useState<Filter>('todos')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const availableFunctions =
    form.category === 'instrumentista' ? INSTRUMENT_FUNCTIONS : VOCAL_FUNCTIONS

  const filtered = useMemo(
    () =>
      members.filter((m) => {
        const matchesCategory = filter === 'todos' || m.category === filter
        const matchesQuery =
          !query.trim() ||
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.email.toLowerCase().includes(query.toLowerCase()) ||
          m.skills.some((s) => s.toLowerCase().includes(query.toLowerCase()))
        return matchesCategory && matchesQuery
      }),
    [members, filter, query],
  )

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(member: Member) {
    setEditingId(member.id)
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? '',
      category: member.category,
      skills: member.skills,
      notes: member.notes ?? '',
    })
    setModalOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) return

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || `${form.name.trim().toLowerCase().replace(/\s+/g, '.')}@worshipflow.app`,
      phone: form.phone.trim() || undefined,
      category: form.category,
      skills: form.skills.length
        ? form.skills
        : [form.category === 'instrumentista' ? INSTRUMENT_FUNCTIONS[0] : VOCAL_FUNCTIONS[0]],
      notes: form.notes.trim() || undefined,
      hue: editingId
        ? (members.find((m) => m.id === editingId)?.hue ?? 200)
        : Math.floor(Math.random() * 360),
      active: editingId ? (members.find((m) => m.id === editingId)?.active ?? true) : true,
    }

    if (editingId) updateMember(editingId, payload)
    else addMember(payload)

    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function toggleSkill(skill: string) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  function handleDelete(member: Member) {
    if (
      window.confirm(
        `Remover ${member.name} da equipe? As vagas dele ficarão vazias nas escalas já criadas.`,
      )
    ) {
      removeMember(member.id)
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="Ministério"
        title="Equipe"
        description="Cadastre os integrantes e defina as funções que cada um pode executar."
        action={
          <Button onClick={openCreate}>
            <UserPlus size={17} /> Adicionar integrante
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          className="sm:w-auto"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: `Todos (${members.length})` },
            {
              value: 'instrumentista',
              label: `Instrumentistas (${members.filter((m) => m.category === 'instrumentista').length})`,
              icon: <Music2 size={14} />,
            },
            {
              value: 'vocal',
              label: `Vocais (${members.filter((m) => m.category === 'vocal').length})`,
              icon: <Users size={14} />,
            },
            { value: 'admin', label: 'Ministros' },
          ]}
        />
        <div className="relative sm:ml-auto sm:w-72">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar integrante..."
            className="pl-10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Nenhum integrante encontrado"
          description="Ajuste a busca ou cadastre um novo integrante na equipe."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} /> Adicionar integrante
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
            <Card key={member.id} className="p-4">
              <div className="flex items-start gap-3.5">
                <Avatar name={member.name} hue={member.hue} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-white">
                      {member.name}
                    </h3>
                    {!member.active && <Badge tone="red">Inativo</Badge>}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{member.email}</p>
                  <div className="mt-2">
                    <Badge
                      tone={
                        member.category === 'admin'
                          ? 'gold'
                          : member.category === 'vocal'
                            ? 'purple'
                            : 'cyan'
                      }
                    >
                      {member.category === 'admin'
                        ? 'Ministro'
                        : CATEGORY_SINGULAR[member.category]}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(member)}
                    aria-label="Editar"
                    className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(member)}
                    aria-label="Remover"
                    className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {member.skills.length > 0 && (
                <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-white/6 pt-3.5">
                  {member.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg bg-white/5 px-2 py-1 text-[0.68rem] font-medium text-zinc-300 ring-1 ring-white/8"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <label className="mt-3.5 flex cursor-pointer items-center justify-between rounded-xl border border-white/6 bg-ink-950/40 px-3 py-2">
                <span className="text-xs text-zinc-400">Ativo na escala</span>
                <input
                  type="checkbox"
                  checked={member.active}
                  onChange={(e) => updateMember(member.id, { active: e.target.checked })}
                  className="h-4 w-4 cursor-pointer accent-neon-cyan"
                />
              </label>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar integrante' : 'Novo integrante'}
        description="Cadastre a pessoa e marque as funções que ela pode executar."
      >
        <div className="space-y-4">
          <Field label="Nome completo">
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nome do integrante"
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="nome@igreja.com"
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </Field>
          </div>

          <Field label="Categoria">
            <Select
              value={form.category}
              onChange={(e) => {
                const category = e.target.value as MemberCategory
                setForm((p) => ({
                  ...p,
                  category,
                  skills: p.skills.filter((s) =>
                    category === 'admin'
                      ? true
                      : category === 'instrumentista'
                        ? (INSTRUMENT_FUNCTIONS as readonly string[]).includes(s)
                        : (VOCAL_FUNCTIONS as readonly string[]).includes(s),
                  ),
                }))
              }}
            >
              <option value="instrumentista">Instrumentista</option>
              <option value="vocal">Vocal</option>
              <option value="admin">Ministro / Líder</option>
            </Select>
          </Field>

          <Field
            label="Funções que pode executar"
            hint={
              form.category === 'admin'
                ? 'Ministros podem actuar em qualquer função.'
                : 'Marque tudo que a pessoa toca ou canta.'
            }
          >
            <div className="flex flex-wrap gap-2">
              {(form.category === 'admin'
                ? [...INSTRUMENT_FUNCTIONS, ...VOCAL_FUNCTIONS]
                : availableFunctions
              ).map((option) => {
                const active = form.skills.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleSkill(option)}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                      active
                        ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 text-white ring-1 ring-neon-cyan/35'
                        : 'bg-white/4 text-zinc-400 ring-1 ring-white/8 hover:text-zinc-200',
                    )}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Observações">
            <Input
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Ex.: availability only on Sundays"
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              {editingId ? 'Salvar alterações' : 'Adicionar integrante'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

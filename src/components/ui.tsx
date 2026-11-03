import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect } from 'react'
import { Maximize2, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { useDraggable } from '../hooks/useDraggable'
import { Portal } from './Portal'

/* ---------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-neon-cyan via-neon-sky to-neon-purple text-ink-950 font-semibold shadow-[0_10px_30px_-12px_rgba(34,211,238,0.75)] hover:brightness-110 active:brightness-95',
  secondary:
    'bg-ink-750 text-zinc-100 border border-white/10 hover:bg-ink-700 hover:border-white/20',
  ghost: 'text-zinc-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
  gold: 'bg-neon-gold/15 text-neon-gold border border-neon-gold/30 hover:bg-neon-gold/25',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.8rem] gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-[0.95rem] gap-2.5 rounded-2xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/60 disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-neon-cyan/60 outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel rounded-3xl', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6', className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-neon-cyan ring-1 ring-white/10">
            {icon}
          </span>
        )}
        <div>
          <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------- Fields --------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span>
      ) : null}
    </label>
  )
}

const FIELD_BASE =
  'w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all focus:border-neon-cyan/50 focus:ring-2 focus:ring-neon-cyan/15'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, 'h-11', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_BASE, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(FIELD_BASE, 'h-11 cursor-pointer appearance-none bg-no-repeat pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.85rem center',
      }}
      {...props}
    >
      {children}
    </select>
  )
}

/* ---------------------------------- Badge ---------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'cyan' | 'purple' | 'gold' | 'green' | 'red'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/5 text-zinc-300 ring-white/10',
    cyan: 'bg-neon-cyan/12 text-neon-cyan ring-neon-cyan/25',
    purple: 'bg-neon-purple/12 text-neon-purple ring-neon-purple/25',
    gold: 'bg-neon-gold/12 text-neon-gold ring-neon-gold/25',
    green: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25',
    red: 'bg-red-500/12 text-red-300 ring-red-500/25',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ring-1',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------- Avatar --------------------------------- */

export function Avatar({
  name,
  hue = 200,
  size = 40,
  className,
  ring,
}: {
  name: string
  hue?: number
  size?: number
  className?: string
  ring?: boolean
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold text-white',
        ring && 'ring-2 ring-neon-cyan/40',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 70% 38%), hsl(${(hue + 45) % 360} 65% 22%))`,
        boxShadow: `0 0 0 1px hsl(${hue} 60% 50% / 0.25) inset`,
      }}
    >
      {initials}
    </span>
  )
}

/* ---------------------------------- Modal ---------------------------------- */

/**
 * Modal flutuante e ARRASTÁVEL: segure o cabeçalho e mova a janela para
 * qualquer lugar da tela (útil quando o formulário é alto e atrapalha a
 * digitação no palco).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  maxWidth?: string
}) {
  const { panelRef, offset, dragging, handlePointerDown, reset } = useDraggable(open)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
        <button
          aria-label="Fechar"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
          type="button"
        />
        <div
          ref={panelRef}
          style={
            offset
              ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
              : undefined
          }
          className={cn('relative z-10 w-full', maxWidth)}
        >
          <div
            className={cn(
              'panel w-full animate-fade-up rounded-t-3xl sm:rounded-3xl',
              dragging ? 'shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]' : '',
            )}
          >
          <div
            onPointerDown={handlePointerDown}
            className={cn(
              'flex touch-none items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6',
              dragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
          >
            <div className="min-w-0 select-none">
              <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
              {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {offset && (
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Centralizar"
                  title="Centralizar janela"
                  className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                >
                  <Maximize2 size={15} />
                </button>
              )}
              <IconButton onClick={onClose} type="button">
                <X size={18} />
              </IconButton>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

/* -------------------------------- EmptyState -------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-500 ring-1 ring-white/10">
          {icon}
        </div>
      )}
      <h4 className="font-display text-lg font-semibold text-white">{title}</h4>
      {description && <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* -------------------------------- Segmented --------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex w-full gap-1 rounded-2xl border border-white/8 bg-ink-900/70 p-1',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 text-white ring-1 ring-neon-cyan/30'
              : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

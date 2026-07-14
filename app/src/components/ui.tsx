import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center bg-navy-2/50 backdrop-blur-[2px] overflow-y-auto p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} shadow-pop my-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h2 className="text-base font-bold">{title}</h2>
          <button className="p-1.5 rounded-lg hover:bg-ink/5 text-ink-2 cursor-pointer" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const badgeStyles: Record<string, string> = {
  good: 'bg-good/10 text-good-deep border-good/30',
  warn: 'bg-warn/15 text-warn-deep border-warn/40',
  serious: 'bg-serious/10 text-serious-deep border-serious/30',
  critical: 'bg-critical/10 text-critical border-critical/30',
  neutral: 'bg-ink/5 text-ink-2 border-ink/15',
  accent: 'bg-accent/10 text-accent-deep border-accent/25',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  title,
}: {
  tone?: keyof typeof badgeStyles
  icon?: ReactNode
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${badgeStyles[tone]}`}
    >
      {icon}
      {children}
    </span>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'danger' | 'accent'
}) {
  return (
    <div className={`card p-4 ${tone === 'danger' ? 'border-critical/40 bg-critical/3' : ''}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === 'danger' ? 'text-critical' : tone === 'accent' ? 'text-accent-deep' : 'text-ink'
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-ink-2 leading-snug">{sub}</div> : null}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-2 text-sm">
      <span className="inline-block size-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      {label ?? 'Carregando…'}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-sm font-semibold text-ink-2">{title}</div>
      {hint ? <div className="mt-1 text-xs text-ink-3">{hint}</div> : null}
    </div>
  )
}

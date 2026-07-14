import { useData } from '../state/DataContext'

/** Seletor de cliente (tomador) — vale para todas as telas */
export function ClientTabs() {
  const { tomadores, notas, activeTomador, setActiveTomador } = useData()
  return (
    <div className="flex flex-wrap gap-1.5">
      <Tab
        active={activeTomador === 'todos'}
        onClick={() => setActiveTomador('todos')}
        label="Todos os clientes"
        count={notas.length}
      />
      {tomadores.map((t) => (
        <Tab
          key={t.key}
          active={activeTomador === t.key}
          onClick={() => setActiveTomador(t.key)}
          label={t.nome}
          count={t.count}
        />
      ))}
    </div>
  )
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
        active
          ? 'bg-navy text-white border-navy'
          : 'bg-surface text-ink-2 border-ink/15 hover:border-navy/40 hover:text-ink'
      }`}
    >
      <span className="max-w-44 truncate">{label}</span>
      <span
        className={`rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums ${
          active ? 'bg-white/20' : 'bg-ink/8'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

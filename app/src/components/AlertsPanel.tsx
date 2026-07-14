import { AlertTriangle } from 'lucide-react'
import { useData, tomadorKey } from '../state/DataContext'
import { checkMissingMonthsFor } from '../domain/prazo'

/** Alerta de meses sem nota (lacunas) e períodos já estourados sem nota. */
export function AlertsPanel() {
  const { notas, tabNotas, recebiveis, config, tomadores, activeTomador } = useData()

  if (activeTomador === 'todos') {
    const lines = tomadores
      .map((t) => {
        const clientNotas = notas.filter((n) => tomadorKey(n) === t.key)
        const { missing, overdue } = checkMissingMonthsFor(clientNotas, recebiveis, config.prazoDias)
        if (!missing.length && !overdue.length) return null
        return { nome: t.nome, missing, overdue }
      })
      .filter(Boolean) as { nome: string; missing: string[]; overdue: string[] }[]

    if (!lines.length) return null
    return (
      <div className="card border-warn/50 bg-warn/6 p-4 flex gap-3">
        <AlertTriangle size={18} className="text-warn-deep shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <div className="font-bold text-warn-deep">Possíveis lacunas ou atrasos na cobrança mensal</div>
          {lines.map((l) => (
            <div key={l.nome} className="text-ink-2">
              <b className="text-ink">{l.nome}</b>:{' '}
              {[
                l.missing.length ? `lacuna em ${l.missing.join(', ')}` : null,
                l.overdue.length ? `possível atraso em ${l.overdue.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { missing, resolved, overdue } = checkMissingMonthsFor(tabNotas, recebiveis, config.prazoDias)
  if (!missing.length && !overdue.length) return null

  return (
    <div className="card border-warn/50 bg-warn/6 p-4 flex gap-3">
      <AlertTriangle size={18} className="text-warn-deep shrink-0 mt-0.5" />
      <div className="text-sm text-ink-2 space-y-1">
        {missing.length > 0 && (
          <div>
            Não há nota com período de referência para{' '}
            {missing.length > 1 ? 'os meses' : 'o mês'} de <b className="text-ink">{missing.join(', ')}</b>.
          </div>
        )}
        {overdue.length > 0 && (
          <div>
            {overdue.length > 1 ? 'Os períodos' : 'O período'} de{' '}
            <b className="text-ink">{overdue.join(', ')}</b> já ultrapassa
            {overdue.length > 1 ? 'm' : ''} o prazo padrão (nota e cobrança até {config.prazoDias} dias após o
            fim do mês) e ainda não {overdue.length > 1 ? 'estão' : 'está'} no painel.
          </div>
        )}
        {resolved.length > 0 && (
          <div className="text-xs text-ink-3">
            Período de {resolved.map((r) => `nº ${r.numero} → ${r.periodoLabel}`).join(', ')} conferido via
            contas a receber e considerado nesta análise.
          </div>
        )}
        <div className="text-xs text-ink-3">
          Confira se falta lançar a nota ou se o período não foi informado em alguma nota já emitida.
        </div>
      </div>
    </div>
  )
}

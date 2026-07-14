import { useData, tomadorKey } from '../state/DataContext'
import { checkMissingMonthsFor } from '../domain/prazo'

/**
 * Alerta de meses sem nota (lacunas) e períodos já estourados sem nota —
 * banner vermelho com ícone de aviso, no mesmo espírito do painel original.
 */
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
      <AlertBanner>
        <b>Possíveis lacunas ou atrasos na cobrança mensal por cliente:</b>
        <br />
        {lines.map((l, i) => (
          <span key={l.nome}>
            {i > 0 && <br />}
            <b>{l.nome}</b>:{' '}
            {[
              l.missing.length ? (
                <>
                  lacuna em <b>{l.missing.join(', ')}</b>
                </>
              ) : null,
              l.overdue.length ? (
                <>
                  possível atraso em <b>{l.overdue.join(', ')}</b>
                </>
              ) : null,
            ]
              .filter(Boolean)
              .reduce<React.ReactNode[]>((acc, cur, idx) => (idx === 0 ? [cur] : [...acc, ' · ', cur]), [])}
          </span>
        ))}
      </AlertBanner>
    )
  }

  const { missing, resolved, overdue } = checkMissingMonthsFor(tabNotas, recebiveis, config.prazoDias)
  if (!missing.length && !overdue.length) return null

  const resolvedNote = resolved.length
    ? ` (período de ${resolved.map((r) => `nº ${r.numero} → ${r.periodoLabel}`).join(', ')} já foi conferido via contas a receber e considerado nesta análise.)`
    : ''

  return (
    <AlertBanner>
      {missing.length > 0 && (
        <>
          não há nota com período de referência para {missing.length > 1 ? 'os meses' : 'o mês'} de{' '}
          <b>{missing.join(', ')}</b>
          {overdue.length > 0 ? '; ' : '. '}
        </>
      )}
      {overdue.length > 0 && (
        <>
          {overdue.length > 1 ? 'os períodos' : 'o período'} de <b>{overdue.join(', ')}</b> já ultrapassa
          {overdue.length > 1 ? 'm' : ''} o prazo padrão (nota e cobrança até {config.prazoDias} dias após o fim
          do mês) e ainda não {overdue.length > 1 ? 'estão' : 'está'} no painel.{' '}
        </>
      )}
      {resolvedNote}
      Confira se falta lançar a nota ou se o período não foi informado em alguma nota já emitida.
    </AlertBanner>
  )
}

function AlertBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-critical bg-critical-soft px-4 py-3 text-sm leading-relaxed text-ink [&_b]:text-critical [&_b]:font-bold">
      <span className="mt-px shrink-0 text-[17px] leading-none text-critical" aria-hidden>
        ⚠
      </span>
      <span>{children}</span>
    </div>
  )
}

import { useMemo } from 'react'
import { useData, tomadorKey } from '../state/DataContext'
import { computeTotals } from '../domain/calc'
import { checkMissingMonthsFor } from '../domain/prazo'
import { buildReconciliationSummaryAll } from '../domain/reconciliation'
import { fmtBRL } from '../lib/format'
import { KpiCard } from '../components/ui'
import { RevenueChart } from '../components/RevenueChart'
import { AlertsPanel } from '../components/AlertsPanel'

export function OverviewView() {
  const { notas, tabNotas, recebiveis, config, tomadores, activeTomador, commissionRateFor } = useData()

  const totals = useMemo(
    () => computeTotals(tabNotas, (n) => commissionRateFor(tomadorKey(n))),
    [tabNotas, commissionRateFor],
  )

  const commissionLabel =
    activeTomador === 'todos' ? 'Comissão' : `Comissão (${commissionRateFor(activeTomador)}%)`
  const commissionSub =
    activeTomador === 'todos'
      ? 'soma pela taxa própria de cada cliente'
      : 'indicação sobre o líquido'

  const pendingMonths = useMemo(() => {
    if (activeTomador === 'todos') {
      let count = 0
      const detail: string[] = []
      tomadores.forEach((t) => {
        const clientNotas = notas.filter((n) => tomadorKey(n) === t.key)
        const { missing, overdue } = checkMissingMonthsFor(clientNotas, recebiveis, config.prazoDias)
        const combined = [...new Set([...missing, ...overdue])]
        if (combined.length) {
          count += combined.length
          detail.push(`${t.nome}: ${combined.join(', ')}`)
        }
      })
      return { count, detail: detail.join(' · ') }
    }
    const { missing, overdue } = checkMissingMonthsFor(tabNotas, recebiveis, config.prazoDias)
    const combined = [...new Set([...missing, ...overdue])]
    return { count: combined.length, detail: combined.join(', ') }
  }, [notas, tabNotas, recebiveis, config.prazoDias, tomadores, activeTomador])

  const reconSummary = useMemo(
    () =>
      recebiveis.length
        ? buildReconciliationSummaryAll(tomadores, notas, recebiveis, config.prazoDias)
        : [],
    [tomadores, notas, recebiveis, config.prazoDias],
  )

  return (
    <div className="space-y-4">
      <AlertsPanel />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
        <KpiCard label="Total faturado" value={fmtBRL(totals.total)} sub={`${totals.count} nota(s)`} />
        <KpiCard label="Impostos totais" value={fmtBRL(totals.taxes)} sub="ISS + IBS + CBS + retenções" tone="teal" />
        <KpiCard label="Valor líquido" value={fmtBRL(totals.net)} sub="pós-impostos" />
        <KpiCard
          label={commissionLabel}
          value={fmtBRL(totals.commission)}
          sub={commissionSub}
          tone="commission"
        />
        <KpiCard label="Notas emitidas" value={totals.count} />
        <KpiCard label="Ticket médio" value={fmtBRL(totals.avg)} tone="teal" />
        <KpiCard
          label="Meses não cobrados"
          value={pendingMonths.count}
          sub={
            pendingMonths.count
              ? pendingMonths.detail
              : activeTomador === 'todos'
                ? 'nenhum cliente com pendência'
                : `em dia com a regra de ${config.prazoDias} dias`
          }
          tone={pendingMonths.count ? 'danger' : 'teal'}
        />
      </div>

      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="heading text-base">Faturamento por período de referência</h2>
          <span className="font-mono text-[11px] text-ink-3">
            barras em âmbar: valor faturado · marca vermelha na base: mês sem nota
          </span>
        </div>
        <RevenueChart notas={tabNotas} />
      </div>

      {reconSummary.length > 0 && activeTomador === 'todos' && (
        <div className="card p-5">
          <h2 className="heading text-base mb-1">Conciliação com contas a receber — resumo</h2>
          <p className="text-xs text-ink-3 mb-3">
            Detalhe nota a nota na aba Conciliação, selecionando um cliente.
          </p>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="text-right!">Notas</th>
                  <th className="text-right!">OK</th>
                  <th className="text-right!">Atenção</th>
                  <th className="text-right!">Sem cobrança</th>
                  <th className="text-right!">Sem nota</th>
                </tr>
              </thead>
              <tbody>
                {reconSummary.map((s) => (
                  <tr key={s.key}>
                    <td className="font-semibold">{s.nome}</td>
                    <td className="text-right tabular-nums">{s.totalNotas}</td>
                    <td className="text-right tabular-nums text-good-deep font-semibold">{s.ok}</td>
                    <td className={`text-right tabular-nums font-semibold ${s.atencao ? 'text-warn-deep' : 'text-ink-3'}`}>
                      {s.atencao}
                    </td>
                    <td className={`text-right tabular-nums font-semibold ${s.faltando ? 'text-critical' : 'text-ink-3'}`}>
                      {s.faltando}
                    </td>
                    <td className={`text-right tabular-nums ${s.orphanCount ? 'text-warn-deep font-semibold' : 'text-ink-3'}`}>
                      {s.orphanCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

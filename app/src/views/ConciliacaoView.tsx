import { useMemo, useState } from 'react'
import { FileSpreadsheet, Info } from 'lucide-react'
import { useData } from '../state/DataContext'
import { buildReconciliation, buildReconciliationSummaryAll } from '../domain/reconciliation'
import { fmtBRL, fmtDate, dateOnly } from '../lib/format'
import { Badge, EmptyState } from '../components/ui'
import { CsvImportModal } from '../components/CsvImportModal'

export function ConciliacaoView() {
  const { notas, tabNotas, recebiveis, config, tomadores, activeTomador, setActiveTomador } = useData()
  const [showImport, setShowImport] = useState(false)

  const summary = useMemo(
    () =>
      recebiveis.length ? buildReconciliationSummaryAll(tomadores, notas, recebiveis, config.prazoDias) : [],
    [tomadores, notas, recebiveis, config.prazoDias],
  )

  const detail = useMemo(
    () =>
      activeTomador !== 'todos' && recebiveis.length
        ? buildReconciliation(activeTomador, tabNotas, recebiveis, config.prazoDias)
        : null,
    [activeTomador, tabNotas, recebiveis, config.prazoDias],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setShowImport(true)}>
          <FileSpreadsheet size={16} /> Importar CSV do financeiro
        </button>
        <span className="ml-auto text-sm text-ink-2 tabular-nums">
          <b>{recebiveis.length}</b> lançamento(s) importado(s)
        </span>
      </div>

      <div className="card border-accent/30 bg-accent/4 p-3.5 flex gap-2.5 text-xs text-ink-2">
        <Info size={15} className="text-accent-deep shrink-0 mt-0.5" />
        <span>
          A conciliação casa cada nota com o lançamento de cobrança pelo <b>número do documento</b>, compara
          valores (tolerância R$ 0,01) e verifica a regra de prazo ({config.prazoDias} dias após o fim do mês do
          período). <b>OK</b> = tudo certo · <b>Atenção</b> = valor divergente ou fora do prazo ·{' '}
          <b>Sem cobrança</b> = nota emitida sem título correspondente.
        </span>
      </div>

      {recebiveis.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Nenhum lançamento de contas a receber importado ainda"
            hint="Importe o CSV exportado do financeiro para conciliar as cobranças com as notas emitidas."
          />
        </div>
      ) : activeTomador === 'todos' ? (
        <div className="card p-5">
          <h2 className="heading text-base mb-1">Resumo por cliente</h2>
          <p className="text-xs text-ink-3 mb-3">Clique em um cliente para ver o detalhe nota a nota.</p>
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
                {summary.map((s) => (
                  <tr key={s.key} className="cursor-pointer" onClick={() => setActiveTomador(s.key)}>
                    <td className="font-semibold text-accent-deep">{s.nome}</td>
                    <td className="text-right tabular-nums">{s.totalNotas}</td>
                    <td className="text-right tabular-nums text-good-deep font-semibold">{s.ok}</td>
                    <td className={`text-right tabular-nums font-semibold ${s.atencao ? 'text-warn-deep' : 'text-ink-3'}`}>{s.atencao}</td>
                    <td className={`text-right tabular-nums font-semibold ${s.faltando ? 'text-critical' : 'text-ink-3'}`}>{s.faltando}</td>
                    <td className={`text-right tabular-nums ${s.orphanCount ? 'text-warn-deep font-semibold' : 'text-ink-3'}`}>{s.orphanCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : detail ? (
        <>
          <div className="card p-5">
            <h2 className="heading text-base mb-3">Detalhe nota a nota</h2>
            {detail.rows.length === 0 ? (
              <EmptyState title="Sem notas para este cliente" />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Nº Nota</th>
                      <th>Emissão NFS-e</th>
                      <th>Doc. cobrança</th>
                      <th>Emissão título</th>
                      <th>Diferença</th>
                      <th className="text-right!">Valor nota</th>
                      <th className="text-right!">Valor título</th>
                      <th>Recebimento</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((r) => (
                      <tr key={r.nota.numero}>
                        <td className="font-bold tabular-nums">{r.nota.numero}</td>
                        <td className="tabular-nums">{fmtDate(r.nota.dataEmissao)}</td>
                        <td className="tabular-nums">{r.recebivel?.numDocumento ?? '—'}</td>
                        <td className="tabular-nums">
                          {r.recebivel?.emissao ? dateOnly(r.recebivel.emissao).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="tabular-nums">
                          {r.diffDias !== null ? `${r.diffDias > 0 ? '+' : ''}${r.diffDias}d` : '—'}
                        </td>
                        <td className="text-right tabular-nums">{fmtBRL(r.nota.valorTotal)}</td>
                        <td className={`text-right tabular-nums ${r.valorDivergente ? 'text-critical font-bold' : ''}`}>
                          {r.recebivel ? fmtBRL(r.recebivel.valorTitulo) : '—'}
                        </td>
                        <td>
                          {r.recebivel ? (
                            <Badge tone={/receb/i.test(r.recebivel.status) ? 'good' : 'neutral'}>
                              {r.recebivel.status || '—'}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <Badge
                            tone={r.situacao === 'ok' ? 'good' : r.situacao === 'atencao' ? 'warn' : 'critical'}
                            title={r.motivo}
                          >
                            {r.situacao === 'ok' ? 'OK' : r.situacao === 'atencao' ? 'Atenção' : 'Sem cobrança'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {detail.orphans.length > 0 && (
            <div className="card p-5">
              <div className="pt-3 border-t border-dashed border-hairline text-sm text-ink-2">
                <b className="text-ink">{detail.orphans.length}</b> lançamento(s) de contas a receber sem nota
                correspondente no painel:
                <ul className="mt-1.5 space-y-1 list-disc pl-4.5">
                  {detail.orphans.map((o) => (
                    <li key={o.id} className="tabular-nums">
                      Doc. <b>{o.numDocumento}</b> · {fmtBRL(o.valorTitulo)}
                      {o.emissao ? ` · emitido em ${dateOnly(o.emissao).toLocaleDateString('pt-BR')}` : ''}
                      {o.observacoes ? <span className="text-ink-3"> · {o.observacoes}</span> : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : null}

      {showImport && <CsvImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

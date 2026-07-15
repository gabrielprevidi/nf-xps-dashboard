import { useMemo, useState, Fragment } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileUp,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react'
import { useData, tomadorKey } from '../state/DataContext'
import type { Nota, Recebivel } from '../domain/types'
import { commission, netAfterTaxes, taxesTotal, computeTotals } from '../domain/calc'
import { getDeadlineForNota } from '../domain/prazo'
import { dateOnly, fmtBRL, fmtDate, fmtDateTime } from '../lib/format'
import { EmptyState, Stamp } from '../components/ui'
import { NotaFormModal, type NotaDraft } from '../components/NotaForm'
import { PdfImportModal } from '../components/PdfImportModal'

type SortColumn =
  | 'numero'
  | 'cliente'
  | 'periodo'
  | 'emissao'
  | 'status'
  | 'prazo'
  | 'valor'
  | 'impostos'
  | 'liquido'
  | 'comissao'

interface SortState {
  column: SortColumn
  dir: 'asc' | 'desc'
}

const DEFAULT_DIR: Record<SortColumn, 'asc' | 'desc'> = {
  numero: 'asc',
  cliente: 'asc',
  periodo: 'desc',
  emissao: 'desc',
  status: 'asc',
  prazo: 'desc',
  valor: 'desc',
  impostos: 'desc',
  liquido: 'desc',
  comissao: 'desc',
}

/** -1 = sem prazo apurável · 0 = dentro do prazo · N = dias de atraso */
function prazoSortValue(n: Nota, recebiveis: Recebivel[], prazoDias: number): number {
  const deadline = getDeadlineForNota(n, recebiveis, prazoDias)
  if (!deadline) return -1
  const emissao = dateOnly(n.dataEmissao.slice(0, 10))
  if (emissao <= deadline) return 0
  return Math.round((emissao.getTime() - deadline.getTime()) / 86400000)
}

export function NotasView() {
  const { tabNotas, recebiveis, config, removeNota, activeTomador, emitentes, commissionRateFor } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [servico, setServico] = useState('todos')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'periodo', dir: 'desc' })
  const [periodOff, setPeriodOff] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [formDraft, setFormDraft] = useState<NotaDraft | null>(null)
  const [editingNum, setEditingNum] = useState<number | undefined>()
  const [showPdfImport, setShowPdfImport] = useState(false)

  const uniquePeriods = useMemo(() => {
    const seen = new Map<string, string>() // label → sortKey
    tabNotas.forEach((n) => {
      if (!seen.has(n.periodoLabel)) seen.set(n.periodoLabel, n.periodoInfo ? n.sortDate : '9999')
    })
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([label]) => label)
  }, [tabNotas])

  const services = useMemo(() => [...new Set(tabNotas.map((n) => n.nbsDesc))], [tabNotas])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const minV = parseFloat(min)
    const maxV = parseFloat(max)
    const list = tabNotas.filter((n) => {
      if (periodOff.has(n.periodoLabel)) return false
      if (servico !== 'todos' && n.nbsDesc !== servico) return false
      if (status !== 'todos' && n.status !== status) return false
      if (!isNaN(minV) && n.valorTotal < minV) return false
      if (!isNaN(maxV) && n.valorTotal > maxV) return false
      if (term) {
        const hay = (
          n.numero + ' ' + n.codVerificacao + ' ' + (n.chaveAcesso || '') + ' ' + n.periodoLabel + ' ' + n.tomadorNome
        ).toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (sort.column) {
        case 'numero':
          return (a.numero - b.numero) * dir
        case 'cliente':
          return a.tomadorNome.localeCompare(b.tomadorNome) * dir
        case 'periodo':
          return a.sortDate.localeCompare(b.sortDate) * dir
        case 'emissao':
          return (new Date(a.dataEmissao).getTime() - new Date(b.dataEmissao).getTime()) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        case 'prazo':
          return (prazoSortValue(a, recebiveis, config.prazoDias) - prazoSortValue(b, recebiveis, config.prazoDias)) * dir
        case 'valor':
          return (a.valorTotal - b.valorTotal) * dir
        case 'impostos':
          return (taxesTotal(a) - taxesTotal(b)) * dir
        case 'liquido':
          return (netAfterTaxes(a) - netAfterTaxes(b)) * dir
        case 'comissao':
          return (
            (commission(a, commissionRateFor(tomadorKey(a))) - commission(b, commissionRateFor(tomadorKey(b)))) * dir
          )
      }
    })
    return list
  }, [tabNotas, search, status, servico, min, max, sort, periodOff, recebiveis, config.prazoDias, commissionRateFor])

  const totals = useMemo(
    () => computeTotals(filtered, (n) => commissionRateFor(tomadorKey(n))),
    [filtered, commissionRateFor],
  )

  function toggleSort(column: SortColumn) {
    setSort((prev) => (prev.column === column ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { column, dir: DEFAULT_DIR[column] }))
  }

  function prazoBadge(n: Nota) {
    const deadline = getDeadlineForNota(n, recebiveis, config.prazoDias)
    if (!deadline) return null
    const emissao = dateOnly(n.dataEmissao.slice(0, 10))
    if (emissao > deadline) {
      const dias = Math.round((emissao.getTime() - deadline.getTime()) / 86400000)
      return (
        <Stamp tone="critical" title={`Prazo: até ${fmtDate(deadline.toISOString())}`}>
          {dias}d de atraso
        </Stamp>
      )
    }
    return (
      <Stamp tone="ok" title={`Prazo: até ${fmtDate(deadline.toISOString())}`}>
        no prazo
      </Stamp>
    )
  }

  function startEdit(n: Nota) {
    setEditingNum(n.numero)
    setFormDraft({ ...n, chaveAcesso: n.chaveAcesso ?? undefined })
  }

  const emitenteNome = (cnpj: string | null) => {
    if (!cnpj) return null
    const e = emitentes.find((x) => x.cnpj === cnpj)
    return e ? `${e.razaoSocial} · ${e.municipio}` : cnpj
  }

  return (
    <div className="space-y-4">
      {/* Ações */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          onClick={() => {
            setEditingNum(undefined)
            setFormDraft({})
          }}
        >
          <FilePlus2 size={16} /> Nova nota
        </button>
        <button className="btn-ghost" onClick={() => setShowPdfImport(true)}>
          <FileUp size={16} /> Importar PDF(s)
        </button>
        <button className="btn-ghost" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir / PDF
        </button>
        <span className="ml-auto text-sm text-ink-2 tabular-nums">
          <b>{filtered.length}</b> de {tabNotas.length} nota(s)
        </span>
      </div>

      {/* Filtros */}
      <div className="no-print card p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
          <div className="col-span-2">
            <label className="field-label">Buscar</label>
            <input
              className="field"
              placeholder="nº, código, chave, período, cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="autenticada">Autenticada</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
          <div>
            <label className="field-label">Tipo de serviço</label>
            <select className="field" value={servico} onChange={(e) => setServico(e.target.value)}>
              <option value="todos">Todos</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Valor (R$) mín – máx</label>
            <div className="flex gap-1.5">
              <input className="field tabular-nums" type="number" placeholder="mín" value={min} onChange={(e) => setMin(e.target.value)} />
              <input className="field tabular-nums" type="number" placeholder="máx" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
        </div>

        {uniquePeriods.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-3 mr-1">Períodos:</span>
            {uniquePeriods.map((p) => {
              const active = !periodOff.has(p)
              return (
                <button
                  key={p}
                  onClick={() =>
                    setPeriodOff((prev) => {
                      const next = new Set(prev)
                      if (next.has(p)) next.delete(p)
                      else next.add(p)
                      return next
                    })
                  }
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-accent/10 border-accent/40 text-accent-deep'
                      : 'bg-transparent border-ink/15 text-ink-3 line-through'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <span className="text-ink-3 text-[11px]">·</span>
            {periodOff.size > 0 && (
              <button className="text-[11px] font-semibold text-accent-deep underline cursor-pointer" onClick={() => setPeriodOff(new Set())}>
                marcar todos
              </button>
            )}
            {periodOff.size < uniquePeriods.length && (
              <button
                className="text-[11px] font-semibold text-ink-3 underline cursor-pointer"
                onClick={() => setPeriodOff(new Set(uniquePeriods))}
              >
                limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="no-print card overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma nota no filtro atual"
            hint={tabNotas.length === 0 ? 'Adicione a primeira nota manualmente ou importe os PDFs das NFS-e.' : 'Ajuste os filtros acima.'}
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <SortTh label="Nº" column="numero" sort={sort} onSort={toggleSort} />
                {activeTomador === 'todos' && <SortTh label="Cliente" column="cliente" sort={sort} onSort={toggleSort} />}
                <SortTh label="Período" column="periodo" sort={sort} onSort={toggleSort} />
                <SortTh label="Emissão" column="emissao" sort={sort} onSort={toggleSort} />
                <SortTh label="Status" column="status" sort={sort} onSort={toggleSort} />
                <SortTh label="Prazo" column="prazo" sort={sort} onSort={toggleSort} />
                <SortTh label="Valor" column="valor" sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Impostos" column="impostos" sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Líquido" column="liquido" sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Comissão" column="comissao" sort={sort} onSort={toggleSort} align="right" />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const open = expanded === n.numero
                return (
                  <Fragment key={n.numero}>
                    <tr className="cursor-pointer" onClick={() => setExpanded(open ? null : n.numero)}>
                      <td className="w-8 text-ink-3">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                      <td className="font-display font-bold tabular-nums">{n.numero}</td>
                      {activeTomador === 'todos' && <td className="max-w-44 truncate">{n.tomadorNome}</td>}
                      <td>
                        {n.periodoLabel}
                        {!n.periodoInfo && (
                          <span className="text-ink-3" title="Período não informado na nota">
                            {' '}†
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums whitespace-nowrap">{fmtDate(n.dataEmissao)}</td>
                      <td>
                        {n.status === 'autenticada' ? (
                          <Stamp tone="ok">autenticada</Stamp>
                        ) : (
                          <Stamp tone="critical">pendente</Stamp>
                        )}
                      </td>
                      <td>{prazoBadge(n)}</td>
                      <td className="text-right tabular-nums font-semibold whitespace-nowrap">{fmtBRL(n.valorTotal)}</td>
                      <td className="text-right tabular-nums text-ink-2 whitespace-nowrap">{fmtBRL(taxesTotal(n))}</td>
                      <td className="text-right tabular-nums whitespace-nowrap">{fmtBRL(netAfterTaxes(n))}</td>
                      <td className="text-right tabular-nums text-accent-deep whitespace-nowrap">
                        {fmtBRL(commission(n, commissionRateFor(tomadorKey(n))))}
                      </td>
                      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded hover:bg-ink/8 text-ink-2 cursor-pointer" title="Editar" onClick={() => startEdit(n)}>
                          <Pencil size={14} />
                        </button>
                        {confirmDelete === n.numero ? (
                          <button
                            className="p-1.5 rounded bg-critical text-white text-[11px] font-bold cursor-pointer"
                            title="Clique para confirmar a exclusão"
                            onClick={() => {
                              void removeNota(n.numero)
                              setConfirmDelete(null)
                            }}
                          >
                            confirmar?
                          </button>
                        ) : (
                          <button
                            className="p-1.5 rounded hover:bg-critical/10 text-critical cursor-pointer"
                            title="Excluir"
                            onClick={() => {
                              setConfirmDelete(n.numero)
                              setTimeout(() => setConfirmDelete((c) => (c === n.numero ? null : c)), 3000)
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={activeTomador === 'todos' ? 12 : 11} className="bg-ink/2!">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-2 px-2 py-2 text-xs">
                            <Detail k="Cliente" v={`${n.tomadorNome} — ${n.tomadorCnpj}`} />
                            <Detail k="Emitente" v={emitenteNome(n.emitenteCnpj) ?? 'Não identificado'} />
                            <Detail k="Emissão" v={fmtDateTime(n.dataEmissao)} />
                            <Detail k="Serviço" v={n.descServico || '—'} />
                            <Detail k="NBS" v={n.nbs ? `${n.nbs} — ${n.nbsDesc}` : n.nbsDesc} />
                            <Detail k="Base de cálculo ISS" v={fmtBRL(n.baseCalculoISS)} />
                            <Detail k="Alíquota ISS" v={`${n.aliquota.toLocaleString('pt-BR')}%`} />
                            <Detail k="ISS" v={fmtBRL(n.valorISS)} />
                            <Detail k="IBS" v={fmtBRL(n.valorIBS)} />
                            <Detail k="CBS" v={fmtBRL(n.valorCBS)} />
                            <Detail k="Outras retenções" v={fmtBRL(n.outrasRetTotal)} />
                            <Detail k="Código de verificação" v={n.codVerificacao} />
                            <div className="md:col-span-2 xl:col-span-4">
                              <Detail k="Chave de acesso" v={n.chaveAcesso ?? 'Aguardando retorno do Ambiente Nacional'} mono />
                            </div>
                            <div className="md:col-span-2 xl:col-span-4">
                              <Detail k="Discriminação" v={n.discriminacao || '—'} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-ink/3">
                <td colSpan={activeTomador === 'todos' ? 7 : 6} className="font-bold">
                  Total do filtro ({totals.count} nota{totals.count === 1 ? '' : 's'})
                </td>
                <td className="text-right tabular-nums font-bold whitespace-nowrap">{fmtBRL(totals.total)}</td>
                <td className="text-right tabular-nums font-bold whitespace-nowrap">{fmtBRL(totals.taxes)}</td>
                <td className="text-right tabular-nums font-bold whitespace-nowrap">{fmtBRL(totals.net)}</td>
                <td className="text-right tabular-nums font-bold text-accent-deep whitespace-nowrap">{fmtBRL(totals.commission)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Relatório de impressão */}
      <PrintReport list={filtered} />

      {formDraft && (
        <NotaFormModal
          initial={formDraft}
          editing={editingNum}
          onClose={() => {
            setFormDraft(null)
            setEditingNum(undefined)
          }}
        />
      )}
      {showPdfImport && (
        <PdfImportModal
          onClose={() => setShowPdfImport(false)}
          onReviewSingle={(draft) => {
            setShowPdfImport(false)
            setEditingNum(undefined)
            setFormDraft(draft)
          }}
        />
      )}
    </div>
  )
}

/** Cabeçalho de coluna clicável para ordenar a lista de notas. */
function SortTh({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string
  column: SortColumn
  sort: SortState
  onSort: (c: SortColumn) => void
  align?: 'right'
}) {
  const active = sort.column === column
  return (
    <th className={align === 'right' ? 'text-right!' : ''}>
      <button
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 cursor-pointer hover:text-ink ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-ink' : ''}`}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp size={11} />
          ) : (
            <ArrowDown size={11} />
          )
        ) : (
          <ArrowUpDown size={11} className="opacity-30" />
        )}
      </button>
    </th>
  )
}

function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <span className="font-semibold text-ink-3">{k}: </span>
      <span className={mono ? 'font-mono text-[11px] break-all' : ''}>{v}</span>
    </div>
  )
}

function PrintReport({ list }: { list: Nota[] }) {
  const { config, activeTomador, tomadores, emitentes, commissionRateFor } = useData()
  const totals = computeTotals(list, (n) => commissionRateFor(tomadorKey(n)))
  const clienteLabel =
    activeTomador === 'todos' ? 'Todos os clientes' : tomadores.find((t) => t.key === activeTomador)?.nome ?? ''
  const comissaoLabel =
    activeTomador === 'todos'
      ? `taxa por cliente (padrão ${config.commissionRate}%)`
      : `${commissionRateFor(activeTomador)}% sobre o valor líquido`
  const now = new Date()
  return (
    <div className="print-area">
      <h1 style={{ fontSize: 16, fontWeight: 800 }}>XPS LOG — Relatório de Notas Fiscais</h1>
      <p style={{ fontSize: 11, color: '#444', margin: '4px 0 12px' }}>
        Gerado em {now.toLocaleDateString('pt-BR')} às{' '}
        {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Cliente: {clienteLabel} ·
        Comissão: {comissaoLabel}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr>
            {['Nº', 'Cliente', 'Período', 'Emissão', 'Status', 'Valor', 'Impostos', 'Líquido', 'Comissão'].map((h) => (
              <th key={h} style={{ border: '1px solid #bbb', padding: '3px 6px', textAlign: 'left', background: '#eee' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((n) => (
            <tr key={n.numero}>
              <td style={pcell}>{n.numero}</td>
              <td style={pcell}>{n.tomadorNome}</td>
              <td style={pcell}>
                {n.periodoLabel}
                {!n.periodoInfo ? ' †' : ''}
              </td>
              <td style={pcell}>{fmtDate(n.dataEmissao)}</td>
              <td style={pcell}>{n.status === 'autenticada' ? 'Autenticada' : 'Pendente'}</td>
              <td style={pnum}>{fmtBRL(n.valorTotal)}</td>
              <td style={pnum}>{fmtBRL(taxesTotal(n))}</td>
              <td style={pnum}>{fmtBRL(netAfterTaxes(n))}</td>
              <td style={pnum}>{fmtBRL(commission(n, commissionRateFor(tomadorKey(n))))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ ...pcell, fontWeight: 700 }}>
              Total ({list.length} nota{list.length === 1 ? '' : 's'})
            </td>
            <td style={{ ...pnum, fontWeight: 700 }}>{fmtBRL(totals.total)}</td>
            <td style={{ ...pnum, fontWeight: 700 }}>{fmtBRL(totals.taxes)}</td>
            <td style={{ ...pnum, fontWeight: 700 }}>{fmtBRL(totals.net)}</td>
            <td style={{ ...pnum, fontWeight: 700 }}>{fmtBRL(totals.commission)}</td>
          </tr>
        </tfoot>
      </table>
      <p style={{ fontSize: 9.5, color: '#555', marginTop: 10 }}>
        † período de referência não informado na nota original.
        <br />
        Emitentes: {emitentes.map((e) => `${e.razaoSocial} — CNPJ ${e.cnpj}`).join(' · ')}. Comissão de indicação
        calculada sobre o valor líquido pós-impostos (valor − ISS − IBS − CBS − outras retenções), pela taxa
        própria do cliente quando cadastrada, ou pela taxa padrão.
      </p>
    </div>
  )
}

const pcell: React.CSSProperties = { border: '1px solid #bbb', padding: '3px 6px' }
const pnum: React.CSSProperties = { ...pcell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

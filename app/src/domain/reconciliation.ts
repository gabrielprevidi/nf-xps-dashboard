import type { Nota, Recebivel, Tomador } from './types'
import { getDeadlineForNota } from './prazo'
import { normalizeCnpj, dateOnly } from '../lib/format'

export type Situacao = 'ok' | 'atencao' | 'faltando'

export interface ReconRow {
  nota: Nota
  recebivel: Recebivel | null
  /** dias entre emissão da nota e emissão do título */
  diffDias: number | null
  valorDivergente: boolean | null
  situacao: Situacao
  motivo: string
}

export interface ReconResult {
  rows: ReconRow[]
  /** lançamentos do cliente sem nota correspondente no painel */
  orphans: Recebivel[]
}

const DAY = 86400000

export function buildReconciliation(
  tomadorKey: string,
  tomadorNotas: Nota[],
  recebiveis: Recebivel[],
  prazoDias: number,
): ReconResult {
  const relevant = recebiveis.filter((r) => normalizeCnpj(r.cnpjCliente) === tomadorKey)
  const usedIds = new Set<string>()

  const rows: ReconRow[] = tomadorNotas
    .slice()
    .sort((a, b) => new Date(a.dataEmissao).getTime() - new Date(b.dataEmissao).getTime())
    .map((n) => {
      const deadline = getDeadlineForNota(n, recebiveis, prazoDias)
      const match = relevant.find((r) => r.numDocumentoDigits === n.numero)
      if (match) {
        usedIds.add(match.id)
        const diffDias = match.emissao
          ? Math.round((dateOnly(match.emissao).getTime() - dateOnly(n.dataEmissao.slice(0, 10)).getTime()) / DAY)
          : null
        const valorDivergente = Math.abs((match.valorTitulo || 0) - n.valorTotal) > 0.01
        let situacao: Situacao = 'ok'
        const motivos: string[] = []
        if (deadline) {
          const emissaoNota = dateOnly(n.dataEmissao.slice(0, 10))
          if (emissaoNota > deadline) {
            situacao = 'atencao'
            motivos.push(
              `nota emitida ${Math.round((emissaoNota.getTime() - deadline.getTime()) / DAY)}d após o prazo`,
            )
          }
          if (match.emissao) {
            const emissaoTitulo = dateOnly(match.emissao)
            if (emissaoTitulo > deadline) {
              situacao = 'atencao'
              motivos.push(
                `cobrança emitida ${Math.round((emissaoTitulo.getTime() - deadline.getTime()) / DAY)}d após o prazo`,
              )
            }
          }
        }
        if (valorDivergente) {
          situacao = 'atencao'
          motivos.push('valor do título diverge do valor da nota')
        }
        return {
          nota: n,
          recebivel: match,
          diffDias,
          valorDivergente,
          situacao,
          motivo: motivos.join('; ') || `dentro do prazo (${prazoDias}d)`,
        }
      }
      const motivo =
        deadline && new Date() > deadline
          ? `nenhum lançamento de cobrança encontrado — prazo (${prazoDias}d após o período) já vencido`
          : 'nenhum lançamento de cobrança encontrado'
      return { nota: n, recebivel: null, diffDias: null, valorDivergente: null, situacao: 'faltando', motivo }
    })

  const orphans = relevant.filter((r) => !usedIds.has(r.id))
  return { rows, orphans }
}

export interface ReconSummary {
  nome: string
  key: string
  ok: number
  atencao: number
  faltando: number
  orphanCount: number
  totalNotas: number
}

export function buildReconciliationSummaryAll(
  tomadores: Tomador[],
  notas: Nota[],
  recebiveis: Recebivel[],
  prazoDias: number,
): ReconSummary[] {
  return tomadores.map((t) => {
    const clientNotas = notas.filter(
      (n) => (normalizeCnpj(n.tomadorCnpj) || 'sem-cnpj-' + n.tomadorNome) === t.key,
    )
    const { rows, orphans } = buildReconciliation(t.key, clientNotas, recebiveis, prazoDias)
    const ok = rows.filter((r) => r.situacao === 'ok').length
    const atencao = rows.filter((r) => r.situacao === 'atencao').length
    const faltando = rows.filter((r) => r.situacao === 'faltando').length
    return {
      nome: t.nome,
      key: t.key,
      ok,
      atencao,
      faltando,
      orphanCount: orphans.length,
      totalNotas: clientNotas.length,
    }
  })
}

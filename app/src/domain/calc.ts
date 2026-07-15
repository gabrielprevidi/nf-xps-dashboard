import type { Nota } from './types'

/** ISS + IBS + CBS + outras retenções */
export const taxesTotal = (n: Nota): number =>
  (n.valorISS || 0) + (n.valorIBS || 0) + (n.valorCBS || 0) + (n.outrasRetTotal || 0)

/** Valor líquido pós-impostos */
export const netAfterTaxes = (n: Nota): number => n.valorTotal - taxesTotal(n)

/** Comissão de indicação sobre o líquido */
export const commission = (n: Nota, ratePct: number): number =>
  netAfterTaxes(n) * (ratePct / 100)

export interface Totals {
  total: number
  taxes: number
  net: number
  count: number
  avg: number
  commission: number
}

/**
 * Totais de uma lista de notas. `rateForNota` resolve a taxa de comissão de
 * cada nota individualmente (o cliente pode ter uma taxa própria) — por isso
 * a comissão é somada nota a nota, e não aplicada sobre o líquido agregado.
 */
export function computeTotals(list: Nota[], rateForNota: (n: Nota) => number): Totals {
  const total = list.reduce((s, n) => s + n.valorTotal, 0)
  const taxes = list.reduce((s, n) => s + taxesTotal(n), 0)
  const net = list.reduce((s, n) => s + netAfterTaxes(n), 0)
  const count = list.length
  const totalCommission = list.reduce((s, n) => s + commission(n, rateForNota(n)), 0)
  return {
    total,
    taxes,
    net,
    count,
    avg: count ? total / count : 0,
    commission: totalCommission,
  }
}

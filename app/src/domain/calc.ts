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

export function computeTotals(list: Nota[], ratePct: number): Totals {
  const total = list.reduce((s, n) => s + n.valorTotal, 0)
  const taxes = list.reduce((s, n) => s + taxesTotal(n), 0)
  const net = list.reduce((s, n) => s + netAfterTaxes(n), 0)
  const count = list.length
  return {
    total,
    taxes,
    net,
    count,
    avg: count ? total / count : 0,
    commission: net * (ratePct / 100),
  }
}

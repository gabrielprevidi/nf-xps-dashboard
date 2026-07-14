import type { Nota, Recebivel } from './types'
import { MESES_LABEL, dateOnly } from '../lib/format'

/**
 * Regra de prazo: nota fiscal e cobrança do período M devem existir até
 * `prazoDias` dias após o fim do mês M (padrão 10, configurável).
 */

/** Deadline para o período (ano, mês 1-based) */
export function deadlineForPeriodMonth(y: number, m1based: number, prazoDias: number): Date {
  const last = new Date(y, m1based, 0) // último dia do mês
  return new Date(last.getFullYear(), last.getMonth(), last.getDate() + prazoDias)
}

/**
 * Quando a nota não traz o período, tenta inferir pelo lançamento de contas a
 * receber correspondente (campo Observações: "Armazenagem referente a DD/MM/AAAA a DD/MM/AAAA").
 */
export function inferPeriodFromRecebivel(
  n: Nota,
  recebiveis: Recebivel[],
): { sortDate: string; periodoLabel: string } | null {
  if (n.periodoInfo && n.sortDate) return null
  const match = recebiveis.find((r) => r.numDocumentoDigits === n.numero)
  if (!match || !match.observacoes) return null
  const pm = match.observacoes.match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/)
  if (!pm) return null
  const [, d1, mo1, y1] = pm
  return { sortDate: `${y1}-${mo1}-${d1}`, periodoLabel: `${MESES_LABEL[mo1] || mo1}/${y1}` }
}

export function getDeadlineForNota(
  n: Nota,
  recebiveis: Recebivel[],
  prazoDias: number,
): Date | null {
  let sortDate = n.periodoInfo && n.sortDate ? n.sortDate : null
  if (!sortDate) {
    const inferred = inferPeriodFromRecebivel(n, recebiveis)
    if (inferred) sortDate = inferred.sortDate
  }
  if (!sortDate) return null
  const d = dateOnly(sortDate)
  return deadlineForPeriodMonth(d.getFullYear(), d.getMonth() + 1, prazoDias)
}

export interface MissingMonthsResult {
  /** meses sem nota dentro do intervalo já coberto (ex.: "Mai/2026") */
  missing: string[]
  /** notas cujo período foi inferido via contas a receber */
  resolved: { numero: number; periodoLabel: string }[]
  /** períodos após o último conhecido que já estouraram o prazo sem nota */
  overdue: string[]
}

export function checkMissingMonthsFor(
  list: Nota[],
  recebiveis: Recebivel[],
  prazoDias: number,
): MissingMonthsResult {
  const effective: { sortDate: string; inferred: boolean; numero: number; periodoLabel?: string }[] = []
  list.forEach((n) => {
    if (n.periodoInfo && n.sortDate) {
      effective.push({ sortDate: n.sortDate, inferred: false, numero: n.numero })
    } else {
      const inferred = inferPeriodFromRecebivel(n, recebiveis)
      if (inferred)
        effective.push({
          sortDate: inferred.sortDate,
          inferred: true,
          numero: n.numero,
          periodoLabel: inferred.periodoLabel,
        })
    }
  })
  if (effective.length < 2) return { missing: [], resolved: [], overdue: [] }

  const resolved = effective
    .filter((e) => e.inferred)
    .map((e) => ({ numero: e.numero, periodoLabel: e.periodoLabel! }))

  const monthsSet = new Set(effective.map((e) => e.sortDate.slice(0, 7)))
  const sortedKeys = [...monthsSet].sort()
  const [fy, fm] = sortedKeys[0].split('-').map(Number)
  const [ly, lm] = sortedKeys[sortedKeys.length - 1].split('-').map(Number)

  const missing: string[] = []
  let y = fy
  let m = fm
  while (y < ly || (y === ly && m <= lm)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (!monthsSet.has(key)) missing.push(`${MESES_LABEL[String(m).padStart(2, '0')]}/${y}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  // Períodos após o último conhecido, até hoje, que já passaram do prazo sem nota
  const overdue: string[] = []
  const today = new Date()
  let cy = ly
  let cm = lm
  for (;;) {
    cm++
    if (cm > 12) {
      cm = 1
      cy++
    }
    const cursorDate = new Date(cy, cm - 1, 1)
    if (cursorDate > today) break
    const deadline = deadlineForPeriodMonth(cy, cm, prazoDias)
    if (deadline < today) overdue.push(`${MESES_LABEL[String(cm).padStart(2, '0')]}/${cy}`)
  }

  return { missing, resolved, overdue }
}

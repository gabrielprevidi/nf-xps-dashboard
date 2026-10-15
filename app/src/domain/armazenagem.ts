/**
 * Pausas de armazenagem — períodos em que um cliente deixou de armazenar.
 *
 * Nesses meses a nota continua sendo emitida, só que por valor simbólico
 * (R$ 0,01), apenas para fechar o mês. O painel marca essas notas para que o
 * valor não seja lido como erro de importação. A marcação é informativa: não
 * altera faturamento, comissão nem prazo.
 *
 * O período é meio aberto — [parouEm, retomouEm) — para que o mês em que o
 * cliente voltou a armazenar já conte como armazenagem normal. `retomouEm`
 * nulo significa que o cliente segue sem armazenar.
 */
import type { Nota, PausaArmazenagem } from './types'
import { MESES_LABEL, normalizeCnpj } from '../lib/format'

/** "2026-08" (input month) → "2026-08-01", que é como a data é guardada. */
export const mesToDate = (ym: string): string => `${ym}-01`

/** "2026-08-01" → "2026-08", para preencher um <input type="month">. */
export const dateToMes = (d: string): string => d.slice(0, 7)

/** "2026-08-01" → "Ago/2026" */
export function mesLabel(d: string): string {
  const [ano, mes] = d.split('-')
  return `${MESES_LABEL[mes] || mes}/${ano}`
}

/** Pausas de um cliente, da mais recente para a mais antiga. */
export function pausasDoCliente(pausas: PausaArmazenagem[], clienteKey: string): PausaArmazenagem[] {
  const key = normalizeCnpj(clienteKey) || clienteKey
  return pausas
    .filter((p) => p.clienteCnpj === key)
    .sort((a, b) => b.parouEm.localeCompare(a.parouEm))
}

/** A pausa ainda aberta do cliente (sem retomada), se houver. */
export function pausaAberta(pausas: PausaArmazenagem[], clienteKey: string): PausaArmazenagem | null {
  return pausasDoCliente(pausas, clienteKey).find((p) => p.retomouEm === null) ?? null
}

/**
 * A pausa que cobre o mês de referência da nota, se houver.
 *
 * Compara `sortDate` (1º dia do mês de referência) — e não a data de emissão —
 * porque o que interessa é o mês a que a nota se refere. Datas ISO comparam
 * corretamente como texto.
 */
export function pausaDaNota(pausas: PausaArmazenagem[], n: Nota): PausaArmazenagem | null {
  const key = normalizeCnpj(n.tomadorCnpj) || 'sem-cnpj-' + n.tomadorNome
  return (
    pausasDoCliente(pausas, key).find(
      (p) => n.sortDate >= p.parouEm && (p.retomouEm === null || n.sortDate < p.retomouEm),
    ) ?? null
  )
}

/** Atalho: a nota cai num período sem armazenagem? */
export const notaSemArmazenagem = (pausas: PausaArmazenagem[], n: Nota): boolean =>
  pausaDaNota(pausas, n) !== null

/** Descrição do período, para tooltip e legenda. */
export function pausaLabel(p: PausaArmazenagem): string {
  return p.retomouEm === null
    ? `sem armazenagem desde ${mesLabel(p.parouEm)}`
    : `sem armazenagem de ${mesLabel(p.parouEm)} a ${mesLabel(mesAnterior(p.retomouEm))}`
}

/** "2026-11-01" → "2026-10-01" (o último mês da pausa, já que retomouEm é exclusivo). */
export function mesAnterior(d: string): string {
  return deslocaMes(d, -1)
}

/**
 * "2026-08-01" → "2026-09-01". O banco exige retomou_em > parou_em, então o
 * mês de retorno mais cedo possível é o seguinte ao da parada.
 */
export function mesSeguinte(d: string): string {
  return deslocaMes(d, +1)
}

function deslocaMes(d: string, delta: number): string {
  const [ano, mes] = d.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1 + delta, 1)).toISOString().slice(0, 10)
}

/**
 * O mês ("YYYY-MM") cai numa pausa do cliente? Usado para não cobrar nem
 * alertar nota de um mês em que o cliente não armazenou.
 */
export function mesSemArmazenagem(pausas: PausaArmazenagem[], clienteKey: string, ym: string): boolean {
  const d = mesToDate(ym)
  return pausasDoCliente(pausas, clienteKey).some(
    (p) => d >= p.parouEm && (p.retomouEm === null || d < p.retomouEm),
  )
}

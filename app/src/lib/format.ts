export const fmtBRL = (v: number | null | undefined): string =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

export const fmtDateTime = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return (
    d.toLocaleDateString('pt-BR') +
    ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

/** "2026-06-30" (date-only) → data local sem fuso surpresa */
export const dateOnly = (s: string): Date => new Date(s + 'T00:00:00')

export const normalizeCnpj = (v: string | null | undefined): string =>
  String(v || '').replace(/\D/g, '')

export const formatCnpj = (v: string | null | undefined): string => {
  const d = normalizeCnpj(v)
  if (d.length !== 14) return String(v || '')
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** número em formato brasileiro "1.234,56" → 1234.56 */
export function parseBRNumber(str: string | null | undefined): number {
  if (str == null) return 0
  const n = parseFloat(String(str).trim().replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export const MESES_LABEL: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

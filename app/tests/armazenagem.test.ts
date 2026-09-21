/**
 * Pausas de armazenagem: o intervalo é meio aberto — [parouEm, retomouEm) — para
 * que o mês em que o cliente voltou já conte como armazenagem normal.
 */
import { describe, expect, it } from 'vitest'
import {
  dateToMes,
  mesAnterior,
  mesLabel,
  mesSeguinte,
  mesToDate,
  notaSemArmazenagem,
  pausaAberta,
  pausaDaNota,
  pausaLabel,
  pausasDoCliente,
} from '../src/domain/armazenagem'
import type { Nota, PausaArmazenagem } from '../src/domain/types'

const CLIENTE = '43999630000124'
const OUTRO = '34661762000150'

const pausa = (p: Partial<PausaArmazenagem>): PausaArmazenagem => ({
  id: 'p1',
  clienteCnpj: CLIENTE,
  parouEm: '2026-08-01',
  retomouEm: null,
  observacao: null,
  ...p,
})

/** Só os campos que a regra usa; o resto da nota é irrelevante aqui. */
const nota = (sortDate: string, cnpj = '43.999.630/0001-24'): Nota =>
  ({ sortDate, tomadorCnpj: cnpj, tomadorNome: 'AVERY DENNISON DO BRASIL LTDA' }) as Nota

describe('pausaDaNota', () => {
  const abertaEmAgo = [pausa({ parouEm: '2026-08-01' })]

  it('o mês em que parou já conta como sem armazenagem', () => {
    expect(notaSemArmazenagem(abertaEmAgo, nota('2026-08-01'))).toBe(true)
  })

  it('meses anteriores à parada não são afetados', () => {
    expect(notaSemArmazenagem(abertaEmAgo, nota('2026-07-01'))).toBe(false)
  })

  it('pausa em aberto vale para todos os meses seguintes', () => {
    expect(notaSemArmazenagem(abertaEmAgo, nota('2027-03-01'))).toBe(true)
  })

  it('o mês da retomada já conta como armazenagem normal', () => {
    const fechada = [pausa({ parouEm: '2026-08-01', retomouEm: '2026-11-01' })]
    expect(notaSemArmazenagem(fechada, nota('2026-10-01'))).toBe(true)
    expect(notaSemArmazenagem(fechada, nota('2026-11-01'))).toBe(false)
  })

  it('cliente que parou, voltou e parou de novo', () => {
    const pausas = [
      pausa({ id: 'a', parouEm: '2025-03-01', retomouEm: '2025-06-01' }),
      pausa({ id: 'b', parouEm: '2026-08-01', retomouEm: null }),
    ]
    expect(notaSemArmazenagem(pausas, nota('2025-04-01'))).toBe(true) // 1ª pausa
    expect(notaSemArmazenagem(pausas, nota('2025-09-01'))).toBe(false) // voltou a armazenar
    expect(notaSemArmazenagem(pausas, nota('2026-09-01'))).toBe(true) // 2ª pausa
    expect(pausaDaNota(pausas, nota('2025-04-01'))?.id).toBe('a')
  })

  it('a pausa de um cliente não afeta outro', () => {
    const pausas = [pausa({ clienteCnpj: OUTRO, parouEm: '2026-01-01' })]
    expect(notaSemArmazenagem(pausas, nota('2026-09-01'))).toBe(false)
  })

  it('cliente sem CNPJ cai na chave por nome e não casa por engano', () => {
    const pausas = [pausa({ parouEm: '2026-01-01' })]
    expect(notaSemArmazenagem(pausas, nota('2026-09-01', ''))).toBe(false)
  })
})

describe('pausaAberta e pausasDoCliente', () => {
  const pausas = [
    pausa({ id: 'a', parouEm: '2025-03-01', retomouEm: '2025-06-01' }),
    pausa({ id: 'b', parouEm: '2026-08-01', retomouEm: null }),
    pausa({ id: 'c', clienteCnpj: OUTRO, parouEm: '2026-02-01', retomouEm: null }),
  ]

  it('devolve só a pausa ainda sem retomada', () => {
    expect(pausaAberta(pausas, CLIENTE)?.id).toBe('b')
  })

  it('é null quando o cliente está armazenando', () => {
    const encerradas = [pausa({ id: 'a', parouEm: '2025-03-01', retomouEm: '2025-06-01' })]
    expect(pausaAberta(encerradas, CLIENTE)).toBeNull()
  })

  it('lista do cliente vem da mais recente para a mais antiga', () => {
    expect(pausasDoCliente(pausas, CLIENTE).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('aceita a chave com CNPJ formatado', () => {
    expect(pausaAberta(pausas, '43.999.630/0001-24')?.id).toBe('b')
  })
})

describe('meses', () => {
  it('converte entre input month e data guardada', () => {
    expect(mesToDate('2026-08')).toBe('2026-08-01')
    expect(dateToMes('2026-08-01')).toBe('2026-08')
  })

  it('rotula em português', () => {
    expect(mesLabel('2026-08-01')).toBe('Ago/2026')
  })

  it('anda de mês atravessando o ano', () => {
    expect(mesSeguinte('2026-12-01')).toBe('2027-01-01')
    expect(mesAnterior('2027-01-01')).toBe('2026-12-01')
    expect(mesSeguinte('2026-08-01')).toBe('2026-09-01')
  })

  it('descreve o período usando o último mês parado, não o da retomada', () => {
    expect(pausaLabel(pausa({ parouEm: '2026-08-01', retomouEm: '2026-11-01' }))).toBe(
      'sem armazenagem de Ago/2026 a Out/2026',
    )
    expect(pausaLabel(pausa({ parouEm: '2026-08-01' }))).toBe('sem armazenagem desde Ago/2026')
  })
})

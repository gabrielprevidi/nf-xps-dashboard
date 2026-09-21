/**
 * Parsers de texto de NFS-e — portados do protótipo validado.
 *
 * IMPORTANTE: os regexes abaixo foram calibrados contra a saída do pdf.js
 * 3.11.174 (itens de texto unidos por "\n"). A ordem do texto extraído NÃO
 * segue a ordem visual do PDF — especialmente no layout de Osasco, onde os
 * valores são localizados pelo FORMATO (nº de dígitos, "%", prefixo "NFS")
 * em vez de proximidade com o rótulo. Não trocar a lib/versão de extração
 * sem recalibrar contra os PDFs reais de regressão (tests/fixtures).
 */
import type { Nota, NotaStatus } from './types'
import { parseBRNumber, MESES_LABEL, normalizeCnpj } from '../lib/format'

const MESES_PT: Record<string, string> = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
}

export interface ParsedNota {
  numero?: number
  emitenteCnpj?: string
  dataEmissao?: string
  discriminacao?: string
  sortDate?: string
  periodoLabel?: string
  periodoInfo?: boolean
  valorTotal?: number
  baseCalculoISS?: number
  aliquota?: number
  valorISS?: number
  valorIBS?: number
  valorCBS?: number
  outrasRetTotal?: number
  codVerificacao?: string
  chaveAcesso?: string | null
  nbs?: string | null
  nbsDesc?: string
  codServico?: string
  descServico?: string
  tomadorNome?: string
  tomadorCnpj?: string
}

/** Layout 1: NFS-e padrão de Vinhedo (XPS LOG LTDA — 32.771.162/0004-62) */
export function parseNFSeTextVinhedo(text: string): ParsedNota {
  const r: ParsedNota = {}
  let m: RegExpMatchArray | null

  m = text.match(/Nº Nota\s*\n\s*(\d+)/)
  if (m) r.numero = parseInt(m[1], 10)

  m = text.match(/Data de Emissão\s*\n\s*(\d{2})\/([A-ZÇÃÕ]{3})\/(\d{4})\s*-\s*(\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    const [, dd, mesAbbr, yyyy, hh, mi, ss] = m
    const mm = MESES_PT[mesAbbr] || '01'
    r.dataEmissao = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
  }

  // A discriminação pode vir quebrada em várias linhas/tokens; capturamos até o
  // próximo bloco conhecido ("Vlr Líquido da Nota") e normalizamos os espaços.
  m = text.match(/DISCRIMINAÇÃO DOS SERVIÇOS\s*\n*([\s\S]+?)\s*\n*Vlr Líquido da Nota/)
  if (m) {
    r.discriminacao = m[1].replace(/\s+/g, ' ').trim()
    let pm = r.discriminacao.match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/)
    if (pm) {
      const [, d1, mo1, y1] = pm
      r.sortDate = `${y1}-${mo1}-${d1}`
      r.periodoLabel = `${MESES_LABEL[mo1] || mo1}/${y1}`
      r.periodoInfo = true
    } else {
      // variante: "no período do dia D1 ao dia D2/MM/AA" (ano com 2 dígitos)
      pm = r.discriminacao.match(/dia\s*(\d{1,2})\s*ao\s*dia\s*(\d{1,2})\/(\d{2})\/(\d{2})\b/i)
      if (pm) {
        const [, , , mo1, y2] = pm
        const y1 = '20' + y2
        r.sortDate = `${y1}-${mo1}-01`
        r.periodoLabel = `${MESES_LABEL[mo1] || mo1}/${y1}`
        r.periodoInfo = true
      } else {
        r.periodoInfo = false
        r.periodoLabel = 'Não especificado'
      }
    }
  }

  m = text.match(/VALOR TOTAL DA NOTA\s*=?\s*R\$\s*([\d.,]+)/)
  if (m) r.valorTotal = parseBRNumber(m[1])

  m = text.match(/Vlr ISS \(R\$\)\s*Base de Cálculo do ISS \(R\$\)\s*([\d.,]+)\s*([\d.,]+)\s*([\d.,]+)/)
  if (m) {
    r.aliquota = parseBRNumber(m[1])
    r.baseCalculoISS = parseBRNumber(m[3])
  }

  m = text.match(/Valor do IRRF Retido\s*\(R\$\)\s*([\d.,]+)\s*([\d.,]+)\s*([\d.,]+)/)
  if (m) r.valorISS = parseBRNumber(m[3])

  m = text.match(/Valor do IBS\s*\(RS\)\s*Valor do CBS\s*\(R\$\)\s*([\d.,]+)\s*([\d.,]+)/)
  if (m) {
    r.valorIBS = parseBRNumber(m[1])
    r.valorCBS = parseBRNumber(m[2])
  } else {
    r.valorIBS = 0
    r.valorCBS = 0
  }

  m = text.match(/Código de Verificação:?\s*\n\s*([A-Z0-9]{6,14})/)
  if (m) r.codVerificacao = m[1]

  m = text.match(/Chave Acesso:\s*\n\s*([^\n]+)/)
  if (m) {
    const v = m[1].trim()
    r.chaveAcesso = /Aguardando/i.test(v) ? null : v
  }

  m = text.match(/Código NBS:\s*([^\n]+)/)
  if (m) {
    const raw = m[1].trim()
    if (/^null$/i.test(raw)) {
      r.nbs = null
    } else {
      const nm = raw.match(/(\d+)\s*-\s*(.+)/)
      if (nm) {
        r.nbs = nm[1]
        r.nbsDesc = nm[2].trim()
      }
    }
  }

  m = text.match(/Ativ\.\s*Serviço:\s*([\d.]+)\s*-\s*([^\n]+)/)
  if (m) {
    r.codServico = m[1]
    r.descServico = m[2].trim().replace(/\.$/, '')
  }

  // 1ª ocorrência = prestador (emitente), 2ª = tomador
  const razaoMatches = [...text.matchAll(/Razão Social\/Nome:\s*([^\n]+)/g)]
  if (razaoMatches.length >= 2) r.tomadorNome = razaoMatches[1][1].trim()
  const cnpjMatches = [...text.matchAll(/CNPJ\/CPF:\s*([^\n]+)/g)]
  if (cnpjMatches.length >= 1) r.emitenteCnpj = normalizeCnpj(cnpjMatches[0][1])
  if (cnpjMatches.length >= 2) r.tomadorCnpj = cnpjMatches[1][1].trim()

  r.outrasRetTotal = 0
  return r
}

/**
 * Layout 2: NFS-e padrão de Osasco (XPS LOG EIRELI — 32.771.162/0001-10) e
 * municípios com o mesmo modelo (Betha/GINFES). Neste layout o pdf.js devolve
 * os valores de tabelas longe dos rótulos (às vezes antes deles) — por isso
 * os valores são identificados pelo FORMATO, não pela proximidade do rótulo.
 */
export function parseNFSeTextOsasco(text: string): ParsedNota {
  const r: ParsedNota = {}
  let m: RegExpMatchArray | null

  // Linha "Nota Nº / Emissão / Série / Ref. Fiscal": nº com zeros à esquerda +
  // data curta + letra da série + mês/ano — específico o bastante sem rótulo.
  m = text.match(/(\d{6,12})\s+\d{2}\/\d{2}\/\d{4}\s+[A-Z]\s+\d{2}\/\d{4}/)
  if (m) r.numero = parseInt(m[1], 10)

  m = text.match(/Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m
    r.dataEmissao = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
  }

  m = text.match(/C[óo]d\.\s*do Servi[çc]o:\s*([\d.]+)\s*-\s*([^\n]+?)(?=\s*(?:NBS:|Discrimina|$))/i)
  if (m) {
    r.codServico = m[1]
    r.descServico = m[2].trim().replace(/\.$/, '')
  }

  m = text.match(/NBS:\s*([\d.]+)/)
  if (m) r.nbs = m[1]

  m = text.match(/Discrimina[çc][ãa]o do Servi[çc]o:\s*\n*([\s\S]+?)\s*\n*Valor Total do Servi[çc]o/i)
  if (m) {
    r.discriminacao = m[1].replace(/\s+/g, ' ').trim()
    let pm = r.discriminacao.match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i)
    if (pm) {
      const [, d1, mo1, y1] = pm
      r.sortDate = `${y1}-${mo1}-${d1}`
      r.periodoLabel = `${MESES_LABEL[mo1] || mo1}/${y1}`
      r.periodoInfo = true
    } else {
      pm = r.discriminacao.match(/(\d{1,2})\s*a\s*(\d{1,2})\/(\d{2})\/(\d{4})/i)
      if (pm) {
        const [, , , mo1, y1] = pm
        r.sortDate = `${y1}-${mo1}-01`
        r.periodoLabel = `${MESES_LABEL[mo1] || mo1}/${y1}`
        r.periodoInfo = true
      } else {
        r.periodoInfo = false
        r.periodoLabel = 'Não especificado'
      }
    }
  }

  // "Valor Total / Base de Cálculo / Alíq. ISS / Valor ISS": os 4 valores
  // aparecem juntos em outro trecho; o "%" é o único do documento e serve de âncora.
  m = text.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*%\s+([\d.,]+)/)
  if (m) {
    r.valorTotal = parseBRNumber(m[1])
    r.baseCalculoISS = parseBRNumber(m[2])
    r.aliquota = parseBRNumber(m[3])
    r.valorISS = parseBRNumber(m[4])
  }

  m = text.match(/CBS:\s*([\d.,]+)/i)
  const cbs = m ? parseBRNumber(m[1]) : 0
  m = text.match(/IBS-UF:\s*([\d.,]+)/i)
  const ibsUf = m ? parseBRNumber(m[1]) : 0
  m = text.match(/IBS-Mun:\s*([\d.,]+)/i)
  const ibsMun = m ? parseBRNumber(m[1]) : 0
  r.valorCBS = cbs
  r.valorIBS = ibsUf + ibsMun

  // Retenções federais deste layout costumam vir zeradas (ISS Auto-Lançado);
  // não dá para localizá-las com segurança por causa do reordenamento do texto.
  r.outrasRetTotal = 0

  m = text.match(/Autenticador:\s*([A-Z0-9]{5,14})/)
  if (m) r.codVerificacao = m[1]

  // Chave NFS-e tem formato próprio (prefixo "NFS" + dígitos); busca por formato.
  m = text.match(/\bNFS\d{20,}\b/)
  if (m) r.chaveAcesso = m[0]

  const razaoMatches = [...text.matchAll(/Raz[ãa]o Social(?:\/Nome)?:\s*([^\n]+?)(?=\s*(?:Endere[çc]o:|$))/gi)]
  if (razaoMatches.length >= 2) r.tomadorNome = razaoMatches[1][1].trim()
  const cnpjMatches = [...text.matchAll(/CNPJ\/CPF:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g)]
  if (cnpjMatches.length >= 1) r.emitenteCnpj = normalizeCnpj(cnpjMatches[0][1])
  if (cnpjMatches.length >= 2) r.tomadorCnpj = cnpjMatches[1][1].trim()

  if (r.nbs && !r.nbsDesc) r.nbsDesc = r.descServico || 'Armazenagem'

  return r
}

/**
 * Layout 3: DANFSe V2.0 — leiaute nacional padronizado (portal nfse.gov.br),
 * adotado por diversos municípios em substituição ao modelo próprio da
 * prefeitura (ex.: Osasco passou a emitir também neste formato). Rótulo e
 * valor vêm em linhas separadas ("RÓTULO\n\nvalor"), sem tabelas — por isso
 * os campos são localizados pelo texto do rótulo, e não pelo formato do valor.
 */
export function parseNFSeTextNacional(text: string): ParsedNota {
  const r: ParsedNota = {}
  let m: RegExpMatchArray | null

  m = text.match(/NÚMERO DA NFS-e\s*\n+\s*(\d+)/)
  if (m) r.numero = parseInt(m[1], 10)

  m = text.match(/DATA E HORA DA EMISSÃO DA NFS-E\s*\n+\s*(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/i)
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m
    r.dataEmissao = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
  }

  // A competência informa diretamente o mês/ano de referência (sem período de
  // datas como nos outros leiautes).
  m = text.match(/COMPETÊNCIA DA NFS-e\s*\n+\s*(\d{2})-(\d{2})-(\d{4})/i)
  if (m) {
    const [, , mm, yyyy] = m
    r.sortDate = `${yyyy}-${mm}-01`
    r.periodoLabel = `${MESES_LABEL[mm] || mm}/${yyyy}`
    r.periodoInfo = true
  } else {
    r.periodoInfo = false
    r.periodoLabel = 'Não especificado'
  }

  m = text.match(/CHAVE DE ACESSO DA NFS-E\s*\n+\s*(\d{20,60})/i)
  if (m) r.chaveAcesso = m[1]

  m = text.match(/Descrição do Serviço\s*\n+\s*([^\n]+)/i)
  if (m) r.discriminacao = m[1].trim()

  // Código e descrição do serviço aparecem juntos, logo antes do rótulo
  // "Descrição do Serviço" (ex.: "16.02 - Outros serviços de transporte...").
  m = text.match(/(\d{1,2}\.\d{2})\s*-\s*([^\n]+?)\.?\s*\n+\s*Descrição do Serviço/i)
  if (m) {
    r.codServico = m[1]
    r.descServico = m[2].trim()
  }

  m = text.match(/Código da NBS\s*\n+\s*([\d.]+)/i)
  if (m) r.nbs = m[1]

  m = text.match(/VALOR DA OPERAÇÃO\s*\/\s*SERVIÇO\s*\n+\s*([\d.,]+)/i)
  if (m) r.valorTotal = parseBRNumber(m[1])

  m = text.match(/BC ISSQN\s*\n+\s*([\d.,]+)/i)
  if (m) r.baseCalculoISS = parseBRNumber(m[1])

  m = text.match(/ISSQN Apurado\s*\n+\s*([\d.,]+)/i)
  if (m) r.valorISS = parseBRNumber(m[1])

  m = text.match(/Alíquota Aplicada\s*\n+\s*([\d.,]+)/i)
  if (m) r.aliquota = parseBRNumber(m[1])

  // IBS e CBS: "Valor Total Apurado" (IBS UF+Mun) seguido de "Valor Total
  // Apurado - CBS" — casados na mesma regex para não confundir um rótulo com
  // o outro (um é prefixo textual do outro).
  m = text.match(
    /Valor Total Apurado\s*\n+\s*([\d.,]+)\s*\n+\s*Valor Total Apurado - CBS\s*\n+\s*([\d.,]+)/i,
  )
  if (m) {
    r.valorIBS = parseBRNumber(m[1])
    r.valorCBS = parseBRNumber(m[2])
  } else {
    r.valorIBS = 0
    r.valorCBS = 0
  }

  m = text.match(/Total das Retenções \(ISSQN \/ Federais\)\s*\n+\s*([\d.,]+)/i)
  r.outrasRetTotal = m ? parseBRNumber(m[1]) : 0

  const razaoMatches = [...text.matchAll(/Nome\/Nome Empresarial\s*\n+\s*([^\n]+)/gi)]
  if (razaoMatches.length >= 2) r.tomadorNome = razaoMatches[1][1].trim()
  const cnpjMatches = [...text.matchAll(/CNPJ\/CPF\/NIF\s*\n+\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/gi)]
  if (cnpjMatches.length >= 1) r.emitenteCnpj = normalizeCnpj(cnpjMatches[0][1])
  if (cnpjMatches.length >= 2) r.tomadorCnpj = cnpjMatches[1][1].trim()

  if (r.nbs && !r.nbsDesc) r.nbsDesc = r.descServico || 'Armazenagem'

  return r
}

export type Layout = 'vinhedo' | 'osasco' | 'nacional'

/**
 * Rótulos exclusivos de cada leiaute, usados só para IDENTIFICAR o documento —
 * nunca para extrair valores. Calibrados contra os PDFs de tests/fixtures: os
 * 10 casos reais acertam 4/4 da própria família e 0/4 das outras duas.
 */
const ASSINATURAS: Record<Layout, RegExp[]> = {
  vinhedo: [/Nº Nota/, /DISCRIMINAÇÃO DOS SERVIÇOS/, /Vlr Líquido da Nota/, /VALOR TOTAL DA NOTA/],
  osasco: [
    /Discrimina[çc][ãa]o do Servi[çc]o:/i,
    /Autenticador:/,
    /C[óo]d\.\s*do Servi[çc]o:/i,
    /Valor Total do Servi[çc]o/i,
  ],
  nacional: [
    /N[ÚU]MERO DA NFS-e/i,
    /DANFSe/i,
    /CHAVE DE ACESSO DA NFS-E/i,
    /COMPET[ÊE]NCIA DA NFS-e/i,
  ],
}

/** Mínimo de rótulos próprios para considerar o documento daquele leiaute. */
const MIN_ASSINATURAS = 2

/**
 * Identifica o leiaute pelos rótulos do documento, antes de extrair qualquer
 * valor. Devolve null quando nenhum leiaute se identifica com segurança — é o
 * caso, por exemplo, de um DANFE de NF-e (modelo 55), que traz "VALOR TOTAL DA
 * NOTA" e por isso acerta 1 assinatura do leiaute de Vinhedo, mas nenhuma
 * outra.
 */
export function detectLayout(text: string): Layout | null {
  let melhor: Layout | null = null
  let melhorScore = 0
  for (const [layout, regexes] of Object.entries(ASSINATURAS) as [Layout, RegExp[]][]) {
    const score = regexes.filter((re) => re.test(text)).length
    if (score > melhorScore) {
      melhor = layout
      melhorScore = score
    }
  }
  return melhorScore >= MIN_ASSINATURAS ? melhor : null
}

const PARSER_POR_LAYOUT: Record<Layout, (text: string) => ParsedNota> = {
  vinhedo: parseNFSeTextVinhedo,
  osasco: parseNFSeTextOsasco,
  nacional: parseNFSeTextNacional,
}

/**
 * Escolhe o parser pelo leiaute identificado no documento.
 *
 * Quando nenhum leiaute se identifica, cai no comportamento antigo (roda os
 * três e fica com o que reconheceu mais campos) — mas esse resultado é só um
 * palpite, e quem chama deve passá-lo por `validateParsedNota` antes de gravar.
 * Isso importa porque o parser de Osasco localiza valores pelo FORMATO, com
 * regexes sem âncora: num documento de outro leiaute ele casa números avulsos e
 * devolve uma nota bem-formada, porém com valores errados.
 */
export function parseNFSeText(text: string): ParsedNota {
  const layout = detectLayout(text)
  if (layout) return PARSER_POR_LAYOUT[layout](text)

  const candidates = [parseNFSeTextVinhedo(text), parseNFSeTextOsasco(text), parseNFSeTextNacional(text)]
  const isOk = (c: ParsedNota) => !!(c.numero || c.valorTotal)
  const countFields = (obj: object) =>
    Object.values(obj).filter((v) => v !== undefined && v !== null && v !== '').length

  const valid = candidates.filter(isOk)
  if (valid.length === 0) return candidates[0]
  return valid.reduce((best, cur) => (countFields(cur) > countFields(best) ? cur : best))
}

/**
 * Confere a coerência interna do que foi extraído e devolve a lista de
 * problemas (vazia = nota consistente).
 *
 * São relações que qualquer NFS-e respeita — base não supera o total, as
 * retenções não superam o total, o ISS bate com base × alíquota — e não limites
 * arbitrários de valor. Servem para recusar o arquivo em vez de gravar em
 * silêncio uma nota com valor errado.
 *
 * Deliberadamente NÃO existe piso de valor: as notas de fechamento de mês de
 * cliente sem armazenagem saem por valor simbólico (R$ 0,01) e são legítimas —
 * veja as pausas de armazenagem em domain/armazenagem.ts.
 */
export function validateParsedNota(p: ParsedNota): string[] {
  const problemas: string[] = []
  const tol = 0.01

  if (p.numero == null || !Number.isInteger(p.numero) || p.numero <= 0) {
    problemas.push('nº da nota inválido')
  }

  if (p.dataEmissao) {
    const ano = Number(String(p.dataEmissao).slice(0, 4))
    const anoLimite = new Date().getFullYear() + 1
    if (!Number.isFinite(ano) || ano < 2000 || ano > anoLimite) {
      problemas.push(`data de emissão implausível (${p.dataEmissao})`)
    }
  }

  const total = p.valorTotal
  if (total == null || !Number.isFinite(total) || total <= 0) {
    problemas.push('valor total ausente ou zerado')
    return problemas // sem total, as demais checagens não têm referência
  }
  if (p.aliquota != null && (p.aliquota < 0 || p.aliquota > 100)) {
    problemas.push(`alíquota fora da faixa (${p.aliquota})`)
  }

  const retencoes: [string, number | undefined][] = [
    ['ISS', p.valorISS],
    ['IBS', p.valorIBS],
    ['CBS', p.valorCBS],
    ['outras retenções', p.outrasRetTotal],
  ]
  for (const [nome, v] of retencoes) {
    if (v == null) continue
    if (v < 0) problemas.push(`${nome} negativo (${v.toFixed(2)})`)
    else if (v > total + tol) problemas.push(`${nome} maior que o valor total (${v.toFixed(2)} > ${total.toFixed(2)})`)
  }

  const somaRetencoes = retencoes.reduce((s, [, v]) => s + (v ?? 0), 0)
  if (somaRetencoes > total + tol) {
    problemas.push(`retenções somam mais que o valor total (${somaRetencoes.toFixed(2)} > ${total.toFixed(2)})`)
  }

  if (p.baseCalculoISS != null && p.baseCalculoISS > total + tol) {
    problemas.push(
      `base de cálculo maior que o valor total (${p.baseCalculoISS.toFixed(2)} > ${total.toFixed(2)})`,
    )
  }

  // ISS apurado = base × alíquota. Tolerância absorve o arredondamento do
  // centavo (e 1% para municípios que arredondam a apuração de outro jeito).
  if (p.aliquota != null && p.aliquota > 0 && p.baseCalculoISS != null && p.baseCalculoISS > 0 && p.valorISS != null) {
    const esperado = (p.baseCalculoISS * p.aliquota) / 100
    if (Math.abs(p.valorISS - esperado) > Math.max(0.02, esperado * 0.01)) {
      problemas.push(
        `ISS incoerente com base × alíquota (${p.valorISS.toFixed(2)} ≠ ${esperado.toFixed(2)})`,
      )
    }
  }

  return problemas
}

/** Campos indispensáveis para aceitar uma nota no envio em lote. */
export const CAMPOS_OBRIGATORIOS_LOTE: (keyof ParsedNota)[] = [
  'numero',
  'valorTotal',
  'tomadorNome',
  'tomadorCnpj',
  'dataEmissao',
]

export const DESC_SERVICO_PADRAO =
  'Armazenamento, depósito, carga, descarga, arrumação e guarda de bens'

/** Monta a nota completa a partir do extraído, com os mesmos padrões do formulário manual. */
export function buildNoteFromParsed(p: ParsedNota): Nota {
  const periodoLabelRaw = p.periodoLabel || 'Não especificado'
  const periodoInfo = periodoLabelRaw === 'Não especificado' ? false : p.periodoInfo !== false
  const sortDate =
    p.sortDate ||
    (p.dataEmissao ? String(p.dataEmissao).slice(0, 10) : new Date().toISOString().slice(0, 10))
  const chaveAcesso = p.chaveAcesso || null
  const descServico = p.descServico || DESC_SERVICO_PADRAO
  const status: NotaStatus = chaveAcesso ? 'autenticada' : 'pendente'
  return {
    numero: p.numero!,
    emitenteCnpj: p.emitenteCnpj || null,
    tomadorNome: p.tomadorNome!,
    tomadorCnpj: p.tomadorCnpj!,
    dataEmissao: p.dataEmissao || sortDate + 'T00:00:00',
    periodoLabel: periodoLabelRaw,
    periodoInfo,
    sortDate,
    discriminacao: p.discriminacao || 'Referente a ' + periodoLabelRaw + '.',
    valorTotal: p.valorTotal!,
    baseCalculoISS: p.baseCalculoISS != null ? p.baseCalculoISS : p.valorTotal!,
    aliquota: p.aliquota != null ? p.aliquota : 0,
    valorISS: p.valorISS != null ? p.valorISS : 0,
    valorIBS: p.valorIBS != null ? p.valorIBS : 0,
    valorCBS: p.valorCBS != null ? p.valorCBS : 0,
    outrasRetTotal: p.outrasRetTotal != null ? p.outrasRetTotal : 0,
    descServico,
    nbs: p.nbs || null,
    nbsDesc: p.nbsDesc || (p.nbs ? descServico : 'Não informado na nota'),
    codVerificacao: p.codVerificacao || '—',
    chaveAcesso,
    status,
  }
}

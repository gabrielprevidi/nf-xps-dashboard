export type NotaStatus = 'autenticada' | 'pendente'

export interface Nota {
  numero: number
  /** CNPJ (só dígitos) da filial emitente, quando identificado */
  emitenteCnpj: string | null
  tomadorNome: string
  tomadorCnpj: string // formatado 00.000.000/0000-00
  dataEmissao: string // ISO datetime
  periodoLabel: string
  periodoInfo: boolean
  sortDate: string // YYYY-MM-DD (1º dia do mês de referência)
  discriminacao: string
  valorTotal: number
  baseCalculoISS: number
  aliquota: number
  valorISS: number
  valorIBS: number
  valorCBS: number
  outrasRetTotal: number
  descServico: string
  nbs: string | null
  nbsDesc: string
  codVerificacao: string
  chaveAcesso: string | null
  status: NotaStatus
}

export interface Recebivel {
  id: string // "Sequência" do CSV
  cnpjFilial: string
  filial: string
  cnpjCliente: string // só dígitos
  cliente: string
  numDocumento: string
  numDocumentoDigits: number | null
  emissao: string | null // YYYY-MM-DD
  vencimento: string | null
  vencimentoOriginal: string | null
  competencia: string
  valorPrincipal: number
  jurosDesc: number
  valorTitulo: number
  dataBaixa: string | null
  dataLiquidacao: string | null
  bancoPagto: string
  contaPagto: string
  formaPagto: string
  observacoes: string
  contaContabil: string
  status: string
  emailFatura: string
}

export interface Emitente {
  id: string
  razaoSocial: string
  cnpj: string // só dígitos
  inscMunicipal: string | null
  municipio: string | null
}

/** Cliente persistido (tomador) — pode ter uma taxa de comissão própria. */
export interface Cliente {
  id: string
  nome: string
  cnpj: string // só dígitos
  /** taxa específica deste cliente; null = usa a taxa padrão de Config.commissionRate */
  commissionRate: number | null
}

export interface Config {
  /** taxa padrão, aplicada quando o cliente não tem uma taxa própria cadastrada */
  commissionRate: number
  prazoDias: number
}

export interface Tomador {
  key: string // CNPJ normalizado (ou fallback pelo nome)
  cnpj: string
  nome: string
  count: number
  total: number
}

/**
 * Dados de exemplo do modo demonstração (cliente ALPHALUM, do protótipo).
 * Usados apenas em memória — nada é gravado.
 */
import type { Emitente, Nota, Recebivel } from '../domain/types'

export const SEED_EMITENTES: Emitente[] = [
  { id: 'demo-1', razaoSocial: 'XPS LOG LTDA', cnpj: '32771162000462', inscMunicipal: '000027432', municipio: 'Vinhedo' },
  { id: 'demo-2', razaoSocial: 'XPS LOG EIRELI', cnpj: '32771162000110', inscMunicipal: '138472', municipio: 'Osasco' },
]

const DESC = 'Armazenamento, depósito, carga, descarga, arrumação e guarda de bens'
const NBS_DESC = 'Armazenagem não classificada em subposições anteriores'

export const SEED_NOTAS: Nota[] = [
  {
    numero: 496, emitenteCnpj: '32771162000462', tomadorNome: 'ALPHALUM LTDA', tomadorCnpj: '61.178.630/0001-45',
    dataEmissao: '2025-11-25T16:01:37', periodoLabel: 'Out/2025', periodoInfo: true, sortDate: '2025-10-01',
    discriminacao: 'Armazenagem referente a 01/10/2025 a 31/10/2025.',
    valorTotal: 4424.88, baseCalculoISS: 4424.88, aliquota: 2, valorISS: 88.5, valorIBS: 0, valorCBS: 0,
    outrasRetTotal: 0, descServico: DESC, nbs: null, nbsDesc: 'Não informado na nota',
    codVerificacao: '237811PCZR', chaveAcesso: null, status: 'pendente',
  },
  {
    numero: 809, emitenteCnpj: '32771162000462', tomadorNome: 'ALPHALUM LTDA', tomadorCnpj: '61.178.630/0001-45',
    dataEmissao: '2026-01-30T14:19:10', periodoLabel: 'Não especificado', periodoInfo: false, sortDate: '2026-01-30',
    discriminacao: 'Serviços Prestados (período não informado na nota).',
    valorTotal: 6319.41, baseCalculoISS: 6319.41, aliquota: 2, valorISS: 126.39, valorIBS: 6.32, valorCBS: 56.87,
    outrasRetTotal: 0, descServico: DESC, nbs: '106019000',
    nbsDesc: 'Manuseio de cargas não classificado em subposições anteriores',
    codVerificacao: '462475R0TN', chaveAcesso: '35567011232771162000462000000000080926015058925955', status: 'autenticada',
  },
  {
    numero: 1141, emitenteCnpj: '32771162000462', tomadorNome: 'ALPHALUM LTDA', tomadorCnpj: '61.178.630/0001-45',
    dataEmissao: '2026-03-31T13:14:56', periodoLabel: 'Dez/2025', periodoInfo: true, sortDate: '2025-12-01',
    discriminacao: 'Armazenagem referente a 01/12/2025 a 31/12/2025.',
    valorTotal: 6087.36, baseCalculoISS: 6087.36, aliquota: 2, valorISS: 121.75, valorIBS: 0, valorCBS: 0,
    outrasRetTotal: 0, descServico: DESC, nbs: '106029000', nbsDesc: NBS_DESC,
    codVerificacao: '670365YN04', chaveAcesso: '35567011232771162000462000000000114126036128682177', status: 'autenticada',
  },
  {
    numero: 1313, emitenteCnpj: '32771162000462', tomadorNome: 'ALPHALUM LTDA', tomadorCnpj: '61.178.630/0001-45',
    dataEmissao: '2026-04-27T12:36:58', periodoLabel: 'Jan/2026', periodoInfo: true, sortDate: '2026-01-01',
    discriminacao: 'Armazenagem referente a 01/01/2026 a 31/01/2026.',
    valorTotal: 7837.68, baseCalculoISS: 7837.68, aliquota: 2, valorISS: 156.75, valorIBS: 0.01, valorCBS: 0.01,
    outrasRetTotal: 0, descServico: DESC, nbs: '106029000', nbsDesc: NBS_DESC,
    codVerificacao: '761411KPQO', chaveAcesso: '35567011232771162000462000000000131326044676596741', status: 'autenticada',
  },
  {
    numero: 1369, emitenteCnpj: '32771162000462', tomadorNome: 'ALPHALUM LTDA', tomadorCnpj: '61.178.630/0001-45',
    dataEmissao: '2026-05-08T10:18:02', periodoLabel: 'Fev/2026', periodoInfo: true, sortDate: '2026-02-01',
    discriminacao: 'Armazenagem referente a 01/02/2026 a 28/02/2026.',
    valorTotal: 10014.36, baseCalculoISS: 10014.36, aliquota: 2, valorISS: 200.29, valorIBS: 0.01, valorCBS: 0.01,
    outrasRetTotal: 0, descServico: DESC, nbs: '106029000', nbsDesc: NBS_DESC,
    codVerificacao: '819650ZR5T', chaveAcesso: '35567011232771162000462000000000136926050611424482', status: 'autenticada',
  },
  {
    numero: 1657, emitenteCnpj: '32771162000462', tomadorNome: 'ALPHALUM LTDA', tomadorCnpj: '61.178.630/0001-45',
    dataEmissao: '2026-06-30T15:40:11', periodoLabel: 'Mar/2026', periodoInfo: true, sortDate: '2026-03-01',
    discriminacao: 'Armazenagem referente a 01/03/2026 a 31/03/2026.',
    valorTotal: 10525.38, baseCalculoISS: 10525.38, aliquota: 2, valorISS: 210.51, valorIBS: 0.01, valorCBS: 0.01,
    outrasRetTotal: 0, descServico: DESC, nbs: '106029000', nbsDesc: NBS_DESC,
    codVerificacao: '10471886DJ', chaveAcesso: '35567011232771162000462000000000165726062380847501', status: 'autenticada',
  },
]

const REC_BASE = {
  cnpjFilial: '32771162000462',
  filial: 'XPS LOG LTDA - VINHEDO',
  cnpjCliente: '61178630000145',
  cliente: 'ALPHALUM LTDA',
  competencia: '',
  jurosDesc: 0,
  bancoPagto: 'Banco Bradesco S.A.',
  contaPagto: '0063430-1',
  formaPagto: 'Boleto',
  contaContabil: 'Recebimento de clientes',
  emailFatura: 'contato@alphalum.com.br',
  vencimentoOriginal: null,
}

export const SEED_RECEBIVEIS: Recebivel[] = [
  {
    ...REC_BASE, id: '19140', numDocumento: '496', numDocumentoDigits: 496,
    emissao: '2025-11-25', vencimento: '2025-12-16', valorPrincipal: 4424.88, valorTitulo: 4424.88,
    dataBaixa: '2025-12-16', dataLiquidacao: '2025-12-17', status: 'Recebido',
    observacoes: 'Armazenagem referente a 01/10/2025 a 31/10/2025.',
  },
  {
    ...REC_BASE, id: '19623', numDocumento: '0809', numDocumentoDigits: 809,
    emissao: '2026-02-02', vencimento: '2026-02-23', valorPrincipal: 6319.41, valorTitulo: 6319.41,
    dataBaixa: '2026-02-23', dataLiquidacao: '2026-02-24', status: 'Recebido',
    observacoes: 'Armazenagem referente a 01/11/2025 a 30/11/2025.',
  },
  {
    ...REC_BASE, id: '20311', numDocumento: '1141E', numDocumentoDigits: 1141,
    emissao: '2026-04-02', vencimento: '2026-04-22', valorPrincipal: 6087.36, valorTitulo: 6087.36,
    dataBaixa: '2026-04-22', dataLiquidacao: '2026-04-23', status: 'Recebido',
    observacoes: 'Armazenagem referente a 01/12/2025 a 31/12/2025.',
  },
  {
    ...REC_BASE, id: '20614', numDocumento: '1313E', numDocumentoDigits: 1313,
    emissao: '2026-04-27', vencimento: '2026-05-18', valorPrincipal: 7837.68, valorTitulo: 7837.68,
    dataBaixa: '2026-05-18', dataLiquidacao: '2026-05-19', status: 'Recebido',
    observacoes: 'Armazenagem referente a 01/01/2026 a 31/01/2026.',
  },
  {
    ...REC_BASE, id: '20768', numDocumento: '1369E', numDocumentoDigits: 1369,
    emissao: '2026-05-11', vencimento: '2026-06-01', valorPrincipal: 10014.36, valorTitulo: 10014.36,
    dataBaixa: '2026-06-01', dataLiquidacao: '2026-06-02', status: 'Recebido',
    observacoes: 'Armazenagem referente a 01/02/2026 a 28/02/2026.',
  },
  {
    ...REC_BASE, id: '21514', numDocumento: '1657E', numDocumentoDigits: 1657,
    emissao: '2026-06-30', vencimento: '2026-07-22', valorPrincipal: 10525.38, valorTitulo: 10525.38,
    dataBaixa: null, dataLiquidacao: null, status: 'Pendente',
    observacoes: 'Armazenagem referente a 01/03/2026 a 31/03/2026.',
  },
]

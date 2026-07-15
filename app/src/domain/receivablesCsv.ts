/**
 * Parser do relatório "Lançamentos a Receber" exportado pelo financeiro.
 * Formato: CSV separado por ";", encoding Latin-1 (ISO-8859-1), com valores
 * protegidos no formato Excel `="..."`.
 */
import Papa from 'papaparse'
import type { Recebivel } from './types'
import { parseBRNumber, normalizeCnpj } from '../lib/format'

function cleanExcelValue(v: unknown): string {
  const s = String(v == null ? '' : v).trim()
  const m = s.match(/^="(.*)"$/)
  return m ? m[1] : s
}

function parseDateBRSlash(s: unknown): string | null {
  const c = cleanExcelValue(s)
  const m = c.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function parseReceivablesCsv(text: string): Recebivel[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
  })
  return parsed.data
    .map((row, idx) => {
      const docRaw = cleanExcelValue(row['Nº Documento'])
      const digits = docRaw.replace(/\D/g, '')
      return {
        id: cleanExcelValue(row['Sequência']) || 'r' + idx + '-' + Date.now(),
        importacaoId: null, // atribuído no momento da importação
        cnpjFilial: normalizeCnpj(cleanExcelValue(row['CNPJ Filial'])),
        filial: cleanExcelValue(row['Filial']),
        cnpjCliente: normalizeCnpj(cleanExcelValue(row['CNPJ Cliente'])),
        cliente: cleanExcelValue(row['Cliente']),
        numDocumento: docRaw,
        numDocumentoDigits: digits ? parseInt(digits, 10) : null,
        emissao: parseDateBRSlash(row['Emissão']),
        vencimento: parseDateBRSlash(row['Vencimento']),
        vencimentoOriginal: parseDateBRSlash(row['Vencimento Original']),
        competencia: cleanExcelValue(row['Competência']),
        valorPrincipal: parseBRNumber(cleanExcelValue(row['Valor Principal'])),
        jurosDesc: parseBRNumber(cleanExcelValue(row['Juros/Desc'])),
        valorTitulo: parseBRNumber(cleanExcelValue(row['Valor Título'])),
        dataBaixa: parseDateBRSlash(row['Data Baixa']),
        dataLiquidacao: parseDateBRSlash(row['Data Liquidação']),
        bancoPagto: cleanExcelValue(row['Banco Pagto']),
        contaPagto: cleanExcelValue(row['Conta Pagto']),
        formaPagto: cleanExcelValue(row['Forma Pagto']),
        observacoes: cleanExcelValue(row['Observações']).trim(),
        contaContabil: cleanExcelValue(row['Conta Contábil']),
        status: cleanExcelValue(row['Status']),
        emailFatura: cleanExcelValue(row['Email para fatura']),
      } satisfies Recebivel
    })
    .filter((r) => r.numDocumentoDigits)
}

export function fileToTextLatin1(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('falha ao ler arquivo'))
    r.readAsText(file, 'ISO-8859-1')
  })
}

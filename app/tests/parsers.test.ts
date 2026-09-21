/**
 * Regressão dos parsers de NFS-e contra os 9 PDFs reais (massa recomendada no
 * handoff). A extração usa o MESMO pdf.js (3.11.174) e a mesma junção por "\n"
 * do app — se este teste quebrar após trocar a lib/versão de extração, é
 * esperado: os regexes precisam ser recalibrados.
 */
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import {
  parseNFSeText,
  detectLayout,
  validateParsedNota,
  CAMPOS_OBRIGATORIOS_LOTE,
} from '../src/domain/nfseParser'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

async function extractText(file: string): Promise<string> {
  const data = new Uint8Array(await readFile(resolve(__dirname, 'fixtures', file)))
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((it: { str?: string }) => it.str ?? '').join('\n') + '\n'
  }
  return fullText
}

interface Expected {
  file: string
  numero: number
  emitenteCnpj: string
  layout: 'vinhedo' | 'osasco' | 'nacional'
}

// nº esperado vem do próprio nome do arquivo; emitente pela filial de cada leiaute
const CASES: Expected[] = [
  { file: '16728.pdf', numero: 16728, emitenteCnpj: '32771162000110', layout: 'osasco' },
  { file: '16729.pdf', numero: 16729, emitenteCnpj: '32771162000110', layout: 'osasco' },
  { file: '16730.pdf', numero: 16730, emitenteCnpj: '32771162000110', layout: 'osasco' },
  { file: '16731.pdf', numero: 16731, emitenteCnpj: '32771162000110', layout: 'osasco' },
  { file: '16732.pdf', numero: 16732, emitenteCnpj: '32771162000110', layout: 'osasco' },
  { file: '16757.pdf', numero: 16757, emitenteCnpj: '32771162000110', layout: 'osasco' },
  { file: '1774.pdf', numero: 1774, emitenteCnpj: '32771162000462', layout: 'vinhedo' },
  { file: 'NF 1756 Cobrança de Armazenagem TECNIA.pdf', numero: 1756, emitenteCnpj: '32771162000462', layout: 'vinhedo' },
  { file: 'NF 1790 - Fedrigoni.pdf', numero: 1790, emitenteCnpj: '32771162000462', layout: 'vinhedo' },
  { file: '17124-nacional.pdf', numero: 17124, emitenteCnpj: '32771162000110', layout: 'nacional' },
]

describe('parseNFSeText — notas reais', () => {
  for (const c of CASES) {
    it(`${c.file} (${c.layout})`, async () => {
      const text = await extractText(c.file)
      const p = parseNFSeText(text)

      // o leiaute é identificado pelos rótulos do documento, antes de extrair valores
      expect(detectLayout(text)).toBe(c.layout)

      // campos obrigatórios do envio em lote
      for (const campo of CAMPOS_OBRIGATORIOS_LOTE) {
        expect(p[campo], `campo obrigatório ausente: ${campo}`).toBeTruthy()
      }

      // valores coerentes entre si (base, alíquota, ISS e retenções)
      expect(validateParsedNota(p)).toEqual([])

      expect(p.numero).toBe(c.numero)
      expect(p.emitenteCnpj).toBe(c.emitenteCnpj)
      expect(p.valorTotal!).toBeGreaterThan(0)
      expect(p.tomadorCnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
      expect(p.dataEmissao).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
      // período de referência reconhecido (todas as 9 notas trazem o período)
      expect(p.periodoInfo, 'período não reconhecido').toBe(true)
      expect(p.sortDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // resumo legível no output do teste
      // eslint-disable-next-line no-console
      console.log(
        `${c.file}: nº ${p.numero} · ${p.tomadorNome} · ${p.periodoLabel} · ` +
          `R$ ${p.valorTotal?.toFixed(2)} · ISS ${p.valorISS?.toFixed(2)} · ` +
          `IBS ${p.valorIBS?.toFixed(2)} · CBS ${p.valorCBS?.toFixed(2)} · ` +
          `chave ${p.chaveAcesso ? 'ok' : 'pendente'}`,
      )
    })
  }
})

/**
 * O contrário da regressão acima: documentos que o painel NÃO pode aceitar.
 * Antes destas travas, um leiaute não suportado podia ser lido pelos regexes
 * "por formato" do parser de Osasco e virar uma nota bem-formada com valor
 * errado (o sintoma relatado foi R$ 0,01 no painel).
 */
describe('recusa de documentos não suportados', () => {
  it('DANFE de NF-e (modelo 55) não é confundido com NFS-e', async () => {
    const text = await extractText('danfe-nfe-modelo55.pdf')

    // traz "VALOR TOTAL DA NOTA" (1 assinatura de Vinhedo), mas nenhuma outra
    expect(detectLayout(text)).toBeNull()

    const p = parseNFSeText(text)
    const missing = CAMPOS_OBRIGATORIOS_LOTE.filter((c) => p[c] == null || p[c] === '')
    expect(missing.length, 'DANFE não deveria preencher os campos obrigatórios').toBeGreaterThan(0)
  })

  it('nota de fechamento de mês (valor simbólico) é aceita', () => {
    // cliente sem armazenagem: a nota existe só para fechar o mês
    expect(
      validateParsedNota({
        numero: 150158,
        valorTotal: 0.01,
        baseCalculoISS: 0.01,
        aliquota: 2,
        valorISS: 0,
        valorIBS: 0,
        valorCBS: 0,
        outrasRetTotal: 0,
        dataEmissao: '2026-07-31T10:00:00',
      }),
    ).toEqual([])
  })

  it('retenção maior que o total é recusada', () => {
    const problemas = validateParsedNota({ numero: 1, valorTotal: 100, valorISS: 250 })
    expect(problemas).toContain('ISS maior que o valor total (250.00 > 100.00)')
  })

  it('ISS que não bate com base × alíquota é recusado', () => {
    const problemas = validateParsedNota({
      numero: 1,
      valorTotal: 10000,
      baseCalculoISS: 10000,
      aliquota: 2,
      valorISS: 5,
    })
    expect(problemas).toContain('ISS incoerente com base × alíquota (5.00 ≠ 200.00)')
  })

  it('base de cálculo acima do total é recusada', () => {
    const problemas = validateParsedNota({ numero: 1, valorTotal: 100, baseCalculoISS: 5000 })
    expect(problemas).toContain('base de cálculo maior que o valor total (5000.00 > 100.00)')
  })

  it('nota consistente passa sem problemas', () => {
    expect(
      validateParsedNota({
        numero: 16728,
        valorTotal: 5877.55,
        baseCalculoISS: 5877.55,
        aliquota: 2,
        valorISS: 117.55,
        valorIBS: 5.76,
        valorCBS: 51.84,
        outrasRetTotal: 0,
        dataEmissao: '2026-08-31T10:00:00',
      }),
    ).toEqual([])
  })
})

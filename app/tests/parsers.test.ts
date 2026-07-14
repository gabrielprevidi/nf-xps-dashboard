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
import { parseNFSeText, CAMPOS_OBRIGATORIOS_LOTE } from '../src/domain/nfseParser'

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
  layout: 'vinhedo' | 'osasco'
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
]

describe('parseNFSeText — 9 notas reais', () => {
  for (const c of CASES) {
    it(`${c.file} (${c.layout})`, async () => {
      const text = await extractText(c.file)
      const p = parseNFSeText(text)

      // campos obrigatórios do envio em lote
      for (const campo of CAMPOS_OBRIGATORIOS_LOTE) {
        expect(p[campo], `campo obrigatório ausente: ${campo}`).toBeTruthy()
      }

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

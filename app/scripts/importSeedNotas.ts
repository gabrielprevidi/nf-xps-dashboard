/**
 * Importa as NFS-e de exemplo (tests/fixtures) direto no Supabase, usando a
 * service_role key (bypassa RLS). Uso único/administrativo — não faz parte do
 * app. Requer as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/importSeedNotas.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { parseNFSeText, buildNoteFromParsed, CAMPOS_OBRIGATORIOS_LOTE, type ParsedNota } from '../src/domain/nfseParser'
import { normalizeCnpj } from '../src/lib/format'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const FILES = [
  '16728.pdf',
  '16729.pdf',
  '16730.pdf',
  '16731.pdf',
  '16732.pdf',
  '16757.pdf',
  '1774.pdf',
  'NF 1756 Cobrança de Armazenagem TECNIA.pdf',
  'NF 1790 - Fedrigoni.pdf',
]

async function extractText(file: string): Promise<string> {
  const data = new Uint8Array(readFileSync(resolve(__dirname, '../tests/fixtures', file)))
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((it: { str?: string }) => it.str ?? '').join('\n') + '\n'
  }
  return fullText
}

async function ensureCliente(nome: string, cnpjFormatted: string): Promise<string> {
  const cnpj = normalizeCnpj(cnpjFormatted) || 'sem-cnpj-' + nome
  const { data, error } = await supabase
    .from('clientes')
    .upsert({ cnpj, nome }, { onConflict: 'cnpj' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function emitenteIdByCnpj(cnpj: string | null | undefined): Promise<string | null> {
  if (!cnpj) return null
  const { data } = await supabase.from('emitentes').select('id').eq('cnpj', normalizeCnpj(cnpj)).maybeSingle()
  return (data?.id as string) ?? null
}

async function main() {
  let ok = 0
  let skipped = 0
  for (const file of FILES) {
    const text = await extractText(file)
    const parsed: ParsedNota = parseNFSeText(text)
    const missing = CAMPOS_OBRIGATORIOS_LOTE.filter((c) => parsed[c] == null || parsed[c] === '')
    if (missing.length) {
      console.error(`✗ ${file}: campos ausentes (${missing.join(', ')}) — pulando`)
      skipped++
      continue
    }
    const nota = buildNoteFromParsed(parsed)
    const cliente_id = await ensureCliente(nota.tomadorNome, nota.tomadorCnpj)
    const emitente_id = await emitenteIdByCnpj(nota.emitenteCnpj)
    const { error } = await supabase.from('notas_fiscais').upsert(
      {
        numero: nota.numero,
        emitente_id,
        cliente_id,
        data_emissao: nota.dataEmissao,
        periodo_label: nota.periodoLabel,
        periodo_info: nota.periodoInfo,
        sort_date: nota.sortDate,
        discriminacao: nota.discriminacao,
        valor_total: nota.valorTotal,
        base_calculo_iss: nota.baseCalculoISS,
        aliquota: nota.aliquota,
        valor_iss: nota.valorISS,
        valor_ibs: nota.valorIBS,
        valor_cbs: nota.valorCBS,
        outras_ret_total: nota.outrasRetTotal,
        desc_servico: nota.descServico,
        nbs: nota.nbs,
        nbs_desc: nota.nbsDesc,
        cod_verificacao: nota.codVerificacao,
        chave_acesso: nota.chaveAcesso,
      },
      { onConflict: 'numero' },
    )
    if (error) {
      console.error(`✗ ${file}: erro ao gravar nota ${nota.numero}: ${error.message}`)
      skipped++
    } else {
      console.log(
        `✓ ${file}: nota ${nota.numero} · ${nota.tomadorNome} · ${nota.periodoLabel} · R$ ${nota.valorTotal.toFixed(2)}`,
      )
      ok++
    }
  }
  console.log(`\n${ok} nota(s) gravada(s), ${skipped} pulada(s).`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

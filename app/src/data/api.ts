import { supabase } from '../lib/supabase'
import type { Config, Emitente, Nota, Recebivel } from '../domain/types'
import { formatCnpj, normalizeCnpj } from '../lib/format'

function db() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

// ---------- Mapeamento snake_case (banco) ⇄ camelCase (app) ----------

interface NotaRow {
  numero: number
  emitente_id: string | null
  cliente_id: string
  data_emissao: string
  periodo_label: string
  periodo_info: boolean
  sort_date: string
  discriminacao: string | null
  valor_total: number
  base_calculo_iss: number | null
  aliquota: number | null
  valor_iss: number
  valor_ibs: number
  valor_cbs: number
  outras_ret_total: number
  desc_servico: string | null
  nbs: string | null
  nbs_desc: string | null
  cod_verificacao: string | null
  chave_acesso: string | null
  clientes: { nome: string; cnpj: string } | null
  emitentes: { cnpj: string } | null
}

function rowToNota(r: NotaRow): Nota {
  return {
    numero: Number(r.numero),
    emitenteCnpj: r.emitentes?.cnpj ?? null,
    tomadorNome: r.clientes?.nome ?? '—',
    tomadorCnpj: formatCnpj(r.clientes?.cnpj ?? ''),
    dataEmissao: r.data_emissao,
    periodoLabel: r.periodo_label,
    periodoInfo: r.periodo_info,
    sortDate: r.sort_date,
    discriminacao: r.discriminacao ?? '',
    valorTotal: Number(r.valor_total),
    baseCalculoISS: Number(r.base_calculo_iss ?? r.valor_total),
    aliquota: Number(r.aliquota ?? 0),
    valorISS: Number(r.valor_iss),
    valorIBS: Number(r.valor_ibs),
    valorCBS: Number(r.valor_cbs),
    outrasRetTotal: Number(r.outras_ret_total),
    descServico: r.desc_servico ?? '',
    nbs: r.nbs,
    nbsDesc: r.nbs_desc ?? 'Não informado na nota',
    codVerificacao: r.cod_verificacao ?? '—',
    chaveAcesso: r.chave_acesso,
    status: r.chave_acesso ? 'autenticada' : 'pendente',
  }
}

const NOTA_SELECT = '*, clientes(nome, cnpj), emitentes(cnpj)'

// ---------- Leitura ----------

export async function fetchNotas(): Promise<Nota[]> {
  const { data, error } = await db()
    .from('notas_fiscais')
    .select(NOTA_SELECT)
    .order('data_emissao', { ascending: true })
  if (error) throw error
  return (data as unknown as NotaRow[]).map(rowToNota)
}

export async function fetchRecebiveis(): Promise<Recebivel[]> {
  const { data, error } = await db().from('contas_receber').select('*').order('emissao')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    cnpjFilial: r.cnpj_filial ?? '',
    filial: r.filial ?? '',
    cnpjCliente: r.cnpj_cliente ?? '',
    cliente: r.cliente ?? '',
    numDocumento: r.num_documento ?? '',
    numDocumentoDigits: r.num_documento_digits != null ? Number(r.num_documento_digits) : null,
    emissao: r.emissao,
    vencimento: r.vencimento,
    vencimentoOriginal: r.vencimento_original,
    competencia: r.competencia ?? '',
    valorPrincipal: Number(r.valor_principal ?? 0),
    jurosDesc: Number(r.juros_desc ?? 0),
    valorTitulo: Number(r.valor_titulo ?? 0),
    dataBaixa: r.data_baixa,
    dataLiquidacao: r.data_liquidacao,
    bancoPagto: r.banco_pagto ?? '',
    contaPagto: r.conta_pagto ?? '',
    formaPagto: r.forma_pagto ?? '',
    observacoes: r.observacoes ?? '',
    contaContabil: r.conta_contabil ?? '',
    status: r.status ?? '',
    emailFatura: r.email_fatura ?? '',
  }))
}

export async function fetchEmitentes(): Promise<Emitente[]> {
  const { data, error } = await db().from('emitentes').select('*').order('razao_social')
  if (error) throw error
  return (data ?? []).map((e) => ({
    id: e.id,
    razaoSocial: e.razao_social,
    cnpj: e.cnpj,
    inscMunicipal: e.insc_municipal,
    municipio: e.municipio,
  }))
}

export async function fetchConfig(): Promise<Config> {
  const { data, error } = await db().from('configuracoes').select('*').eq('id', 1).single()
  if (error) throw error
  return { commissionRate: Number(data.commission_rate), prazoDias: Number(data.prazo_dias) }
}

// ---------- Escrita ----------

/** Garante o cliente (por CNPJ) e devolve o id */
async function ensureCliente(nome: string, cnpjFormatted: string): Promise<string> {
  const cnpj = normalizeCnpj(cnpjFormatted) || 'sem-cnpj-' + nome
  const { data, error } = await db()
    .from('clientes')
    .upsert({ cnpj, nome }, { onConflict: 'cnpj' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function emitenteIdByCnpj(cnpj: string | null): Promise<string | null> {
  if (!cnpj) return null
  const { data } = await db().from('emitentes').select('id').eq('cnpj', normalizeCnpj(cnpj)).maybeSingle()
  return data?.id ?? null
}

export async function upsertNota(n: Nota): Promise<void> {
  const cliente_id = await ensureCliente(n.tomadorNome, n.tomadorCnpj)
  const emitente_id = await emitenteIdByCnpj(n.emitenteCnpj)
  const { error } = await db()
    .from('notas_fiscais')
    .upsert(
      {
        numero: n.numero,
        emitente_id,
        cliente_id,
        data_emissao: n.dataEmissao,
        periodo_label: n.periodoLabel,
        periodo_info: n.periodoInfo,
        sort_date: n.sortDate,
        discriminacao: n.discriminacao,
        valor_total: n.valorTotal,
        base_calculo_iss: n.baseCalculoISS,
        aliquota: n.aliquota,
        valor_iss: n.valorISS,
        valor_ibs: n.valorIBS,
        valor_cbs: n.valorCBS,
        outras_ret_total: n.outrasRetTotal,
        desc_servico: n.descServico,
        nbs: n.nbs,
        nbs_desc: n.nbsDesc,
        cod_verificacao: n.codVerificacao,
        chave_acesso: n.chaveAcesso,
      },
      { onConflict: 'numero' },
    )
  if (error) throw error
}

export async function deleteNota(numero: number): Promise<void> {
  const { error } = await db().from('notas_fiscais').delete().eq('numero', numero)
  if (error) throw error
}

/** Merge por Sequência (id) — reimportar não duplica */
export async function upsertRecebiveis(rows: Recebivel[]): Promise<void> {
  if (!rows.length) return
  const payload = rows.map((r) => ({
    id: r.id,
    cnpj_filial: r.cnpjFilial,
    filial: r.filial,
    cnpj_cliente: r.cnpjCliente,
    cliente: r.cliente,
    num_documento: r.numDocumento,
    num_documento_digits: r.numDocumentoDigits,
    emissao: r.emissao,
    vencimento: r.vencimento,
    vencimento_original: r.vencimentoOriginal,
    competencia: r.competencia,
    valor_principal: r.valorPrincipal,
    juros_desc: r.jurosDesc,
    valor_titulo: r.valorTitulo,
    data_baixa: r.dataBaixa,
    data_liquidacao: r.dataLiquidacao,
    banco_pagto: r.bancoPagto,
    conta_pagto: r.contaPagto,
    forma_pagto: r.formaPagto,
    observacoes: r.observacoes,
    conta_contabil: r.contaContabil,
    status: r.status,
    email_fatura: r.emailFatura,
  }))
  const { error } = await db().from('contas_receber').upsert(payload, { onConflict: 'id' })
  if (error) throw error
}

export async function saveConfig(cfg: Config): Promise<void> {
  const { error } = await db()
    .from('configuracoes')
    .update({ commission_rate: cfg.commissionRate, prazo_dias: cfg.prazoDias })
    .eq('id', 1)
  if (error) throw error
}

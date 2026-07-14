import { useState } from 'react'
import type { Nota } from '../domain/types'
import { DESC_SERVICO_PADRAO } from '../domain/nfseParser'
import { Modal } from './ui'
import { useData } from '../state/DataContext'
import { fmtBRL } from '../lib/format'
import { netAfterTaxes, taxesTotal } from '../domain/calc'

export interface NotaDraft extends Partial<Nota> {}

const emptyDraft: NotaDraft = {
  periodoInfo: true,
  aliquota: 2,
  valorISS: 0,
  valorIBS: 0,
  valorCBS: 0,
  outrasRetTotal: 0,
  descServico: DESC_SERVICO_PADRAO,
}

export function NotaFormModal({
  initial,
  editing,
  onClose,
}: {
  initial?: NotaDraft
  /** número da nota em edição (bloqueia o campo) */
  editing?: number
  onClose: () => void
}) {
  const { saveNota, emitentes } = useData()
  const [d, setD] = useState<NotaDraft>({ ...emptyDraft, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: NotaDraft) => setD((prev) => ({ ...prev, ...patch }))

  const num = (v: string) => (v === '' ? undefined : Number(v))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!d.numero || !d.valorTotal || !d.tomadorNome || !d.tomadorCnpj || !d.dataEmissao) {
      setError('Preencha os campos obrigatórios: nº, cliente, CNPJ, emissão e valor.')
      return
    }
    const chave = d.chaveAcesso?.trim() || null
    const nota: Nota = {
      numero: d.numero,
      emitenteCnpj: d.emitenteCnpj || null,
      tomadorNome: d.tomadorNome.trim(),
      tomadorCnpj: d.tomadorCnpj.trim(),
      dataEmissao: d.dataEmissao,
      periodoLabel: d.periodoLabel?.trim() || 'Não especificado',
      periodoInfo: (d.periodoLabel?.trim() || 'Não especificado') !== 'Não especificado' && d.periodoInfo !== false,
      sortDate: d.sortDate || d.dataEmissao.slice(0, 10),
      discriminacao: d.discriminacao || '',
      valorTotal: d.valorTotal,
      baseCalculoISS: d.baseCalculoISS ?? d.valorTotal,
      aliquota: d.aliquota ?? 0,
      valorISS: d.valorISS ?? 0,
      valorIBS: d.valorIBS ?? 0,
      valorCBS: d.valorCBS ?? 0,
      outrasRetTotal: d.outrasRetTotal ?? 0,
      descServico: d.descServico || DESC_SERVICO_PADRAO,
      nbs: d.nbs || null,
      nbsDesc: d.nbsDesc || (d.nbs ? d.descServico || DESC_SERVICO_PADRAO : 'Não informado na nota'),
      codVerificacao: d.codVerificacao || '—',
      chaveAcesso: chave,
      status: chave ? 'autenticada' : 'pendente',
    }
    setSaving(true)
    try {
      await saveNota(nota)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const liquidoPreview =
    d.valorTotal != null
      ? netAfterTaxes({
          ...(d as Nota),
          valorTotal: d.valorTotal ?? 0,
          valorISS: d.valorISS ?? 0,
          valorIBS: d.valorIBS ?? 0,
          valorCBS: d.valorCBS ?? 0,
          outrasRetTotal: d.outrasRetTotal ?? 0,
        })
      : null

  return (
    <Modal title={editing ? `Editar nota nº ${editing}` : 'Nova nota fiscal'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="field-label">Nº da nota *</label>
          <input
            className="field tabular-nums"
            type="number"
            value={d.numero ?? ''}
            readOnly={!!editing}
            onChange={(e) => set({ numero: num(e.target.value) })}
          />
        </div>
        <div>
          <label className="field-label">Data/hora de emissão *</label>
          <input
            className="field"
            type="datetime-local"
            value={(d.dataEmissao ?? '').slice(0, 16)}
            onChange={(e) => set({ dataEmissao: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Valor total (R$) *</label>
          <input
            className="field tabular-nums"
            type="number"
            step="0.01"
            value={d.valorTotal ?? ''}
            onChange={(e) => set({ valorTotal: num(e.target.value) })}
          />
        </div>
        <div>
          <label className="field-label">Emitente (filial)</label>
          <select
            className="field"
            value={d.emitenteCnpj ?? ''}
            onChange={(e) => set({ emitenteCnpj: e.target.value || undefined })}
          >
            <option value="">Não identificado</option>
            {emitentes.map((em) => (
              <option key={em.id} value={em.cnpj}>
                {em.razaoSocial} · {em.municipio}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label">Cliente (razão social) *</label>
          <input className="field" value={d.tomadorNome ?? ''} onChange={(e) => set({ tomadorNome: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">CNPJ do cliente *</label>
          <input
            className="field tabular-nums"
            placeholder="00.000.000/0000-00"
            value={d.tomadorCnpj ?? ''}
            onChange={(e) => set({ tomadorCnpj: e.target.value })}
          />
        </div>

        <div>
          <label className="field-label">Período (rótulo)</label>
          <input className="field" placeholder="Jun/2026" value={d.periodoLabel ?? ''} onChange={(e) => set({ periodoLabel: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Mês de referência</label>
          <input
            className="field"
            type="date"
            value={d.sortDate ?? ''}
            onChange={(e) => set({ sortDate: e.target.value })}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="inline-flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              className="size-4 accent-[#c1791f]"
              checked={d.periodoInfo !== false}
              onChange={(e) => set({ periodoInfo: e.target.checked })}
            />
            Período informado na nota
          </label>
        </div>
        <div>
          <label className="field-label">Alíquota ISS (%)</label>
          <input className="field tabular-nums" type="number" step="0.01" value={d.aliquota ?? ''} onChange={(e) => set({ aliquota: num(e.target.value) })} />
        </div>

        <div>
          <label className="field-label">Valor ISS (R$)</label>
          <input className="field tabular-nums" type="number" step="0.01" value={d.valorISS ?? ''} onChange={(e) => set({ valorISS: num(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Valor IBS (R$)</label>
          <input className="field tabular-nums" type="number" step="0.01" value={d.valorIBS ?? ''} onChange={(e) => set({ valorIBS: num(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Valor CBS (R$)</label>
          <input className="field tabular-nums" type="number" step="0.01" value={d.valorCBS ?? ''} onChange={(e) => set({ valorCBS: num(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Outras retenções (R$)</label>
          <input className="field tabular-nums" type="number" step="0.01" value={d.outrasRetTotal ?? ''} onChange={(e) => set({ outrasRetTotal: num(e.target.value) })} />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label">Descrição do serviço</label>
          <input className="field" value={d.descServico ?? ''} onChange={(e) => set({ descServico: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Código NBS</label>
          <input className="field tabular-nums" value={d.nbs ?? ''} onChange={(e) => set({ nbs: e.target.value || null })} />
        </div>
        <div>
          <label className="field-label">Código de verificação</label>
          <input className="field tabular-nums" value={d.codVerificacao ?? ''} onChange={(e) => set({ codVerificacao: e.target.value })} />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Chave de acesso (vazio = pendente no Ambiente Nacional)</label>
          <input className="field tabular-nums" value={d.chaveAcesso ?? ''} onChange={(e) => set({ chaveAcesso: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Discriminação dos serviços</label>
          <textarea className="field min-h-16" value={d.discriminacao ?? ''} onChange={(e) => set({ discriminacao: e.target.value })} />
        </div>

        {error && <div className="sm:col-span-2 lg:col-span-4 text-sm text-critical font-semibold">{error}</div>}

        <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-1">
          <div className="text-xs text-ink-2 tabular-nums">
            {liquidoPreview != null && d.valorTotal != null ? (
              <>
                Impostos: <b>{fmtBRL(taxesTotal(d as Nota))}</b> · Líquido: <b>{fmtBRL(liquidoPreview)}</b>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar nota'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

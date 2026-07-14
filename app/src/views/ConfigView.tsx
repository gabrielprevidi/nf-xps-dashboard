import { useState } from 'react'
import { useData } from '../state/DataContext'
import { formatCnpj } from '../lib/format'

export function ConfigView() {
  const { config, updateConfig, emitentes } = useData()
  const [rate, setRate] = useState(String(config.commissionRate))
  const [prazo, setPrazo] = useState(String(config.prazoDias))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      await updateConfig({
        commissionRate: parseFloat(rate) || 0,
        prazoDias: parseInt(prazo, 10) || 10,
      })
      setMsg('Configurações salvas.')
    } catch (err) {
      setMsg('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={save} className="card p-5 space-y-4">
        <h2 className="text-sm font-bold">Regras de negócio</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Taxa de comissão de indicação (%)</label>
            <input className="field tabular-nums" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
            <p className="mt-1 text-xs text-ink-3">Aplicada sobre o valor líquido pós-impostos.</p>
          </div>
          <div>
            <label className="field-label">Prazo de emissão e cobrança (dias)</label>
            <input className="field tabular-nums" type="number" min="1" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            <p className="mt-1 text-xs text-ink-3">Dias após o fim do mês do período de referência.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
          {msg && <span className={`text-sm font-semibold ${msg.startsWith('Erro') ? 'text-critical' : 'text-good-deep'}`}>{msg}</span>}
        </div>
      </form>

      <div className="card p-5">
        <h2 className="text-sm font-bold mb-3">Emitentes (filiais)</h2>
        <ul className="space-y-2">
          {emitentes.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm border-b border-hairline/70 pb-2 last:border-0">
              <div>
                <div className="font-semibold">{e.razaoSocial}</div>
                <div className="text-xs text-ink-3">
                  {e.municipio} · Insc. Municipal {e.inscMunicipal ?? '—'}
                </div>
              </div>
              <span className="tabular-nums text-ink-2 text-xs">{formatCnpj(e.cnpj)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          As notas importadas por PDF identificam a filial automaticamente pelo CNPJ do prestador.
        </p>
      </div>
    </div>
  )
}

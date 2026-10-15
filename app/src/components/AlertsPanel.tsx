import { useState } from 'react'
import { PackageX } from 'lucide-react'
import { useData, tomadorKey } from '../state/DataContext'
import { checkMissingMonthsFor } from '../domain/prazo'
import { mesSemArmazenagem, mesToDate } from '../domain/armazenagem'

/**
 * Alerta de meses sem nota (lacunas) e períodos já estourados sem nota —
 * banner vermelho com ícone de aviso, no mesmo espírito do painel original.
 * Cada mês listado tem um botão para informar que o cliente não teve
 * armazenagem nele, o que tira o mês do alerta (evita cobrança indevida).
 */
export function AlertsPanel() {
  const { notas, tabNotas, recebiveis, config, tomadores, activeTomador, pausasArmazenagem } = useData()

  if (activeTomador === 'todos') {
    const lines = tomadores
      .map((t) => {
        const clientNotas = notas.filter((n) => tomadorKey(n) === t.key)
        const { missing, overdue, missingKeys, overdueKeys } = checkMissingMonthsFor(
          clientNotas,
          recebiveis,
          config.prazoDias,
          (ym) => mesSemArmazenagem(pausasArmazenagem, t.key, ym),
        )
        if (!missing.length && !overdue.length) return null
        return { nome: t.nome, cnpj: t.cnpj, missing, overdue, missingKeys, overdueKeys }
      })
      .filter(Boolean) as {
      nome: string
      cnpj: string
      missing: string[]
      overdue: string[]
      missingKeys: string[]
      overdueKeys: string[]
    }[]

    if (!lines.length) return null
    return (
      <AlertBanner>
        <b>Possíveis lacunas ou atrasos na cobrança mensal por cliente:</b>
        {lines.map((l) => (
          <div key={l.nome} className="mt-1">
            <b>{l.nome}</b>:{' '}
            {l.missing.length > 0 && (
              <>
                lacuna em <MonthList labels={l.missing} keys={l.missingKeys} cnpj={l.cnpj} />
              </>
            )}
            {l.missing.length > 0 && l.overdue.length > 0 && ' · '}
            {l.overdue.length > 0 && (
              <>
                possível atraso em <MonthList labels={l.overdue} keys={l.overdueKeys} cnpj={l.cnpj} />
              </>
            )}
          </div>
        ))}
      </AlertBanner>
    )
  }

  const tomador = tomadores.find((t) => t.key === activeTomador)
  const { missing, resolved, overdue, missingKeys, overdueKeys } = checkMissingMonthsFor(
    tabNotas,
    recebiveis,
    config.prazoDias,
    (ym) => mesSemArmazenagem(pausasArmazenagem, activeTomador, ym),
  )
  if (!missing.length && !overdue.length) return null

  const resolvedNote = resolved.length
    ? ` (período de ${resolved.map((r) => `nº ${r.numero} → ${r.periodoLabel}`).join(', ')} já foi conferido via contas a receber e considerado nesta análise.)`
    : ''

  return (
    <AlertBanner>
      {missing.length > 0 && (
        <>
          não há nota com período de referência para {missing.length > 1 ? 'os meses' : 'o mês'} de{' '}
          <MonthList labels={missing} keys={missingKeys} cnpj={tomador?.cnpj} />
          {overdue.length > 0 ? '; ' : '. '}
        </>
      )}
      {overdue.length > 0 && (
        <>
          {overdue.length > 1 ? 'os períodos' : 'o período'} de{' '}
          <MonthList labels={overdue} keys={overdueKeys} cnpj={tomador?.cnpj} /> já ultrapassa
          {overdue.length > 1 ? 'm' : ''} o prazo padrão (nota e cobrança até {config.prazoDias} dias após o fim
          do mês) e ainda não {overdue.length > 1 ? 'estão' : 'está'} no painel.{' '}
        </>
      )}
      {resolvedNote}
      Confira se falta lançar a nota ou se o período não foi informado em alguma nota já emitida. Se o cliente
      não armazenou no mês, use “sem armazenagem” para não gerar cobrança indevida.
    </AlertBanner>
  )
}

/** Lista de meses, cada um com o botão "sem armazenagem" (quando o usuário pode alterar). */
function MonthList({ labels, keys, cnpj }: { labels: string[]; keys: string[]; cnpj?: string }) {
  const { canEdit, marcarMesSemArmazenagem } = useData()
  const [busy, setBusy] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function marcar(ym: string) {
    if (!cnpj) return
    setBusy(ym)
    setErro(null)
    try {
      await marcarMesSemArmazenagem(cnpj, mesToDate(ym))
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {labels.map((label, i) => (
        <span key={keys[i]} className="inline-flex items-center gap-1 mr-2 whitespace-nowrap">
          <b>{label}</b>
          {canEdit && cnpj && (
            <button
              type="button"
              className="btn-ghost px-1.5 py-0.5 text-[11px] inline-flex items-center gap-1 text-ink"
              disabled={busy !== null}
              title={`Informar que o cliente não teve armazenagem em ${label}`}
              onClick={() => void marcar(keys[i])}
            >
              <PackageX size={11} />
              {busy === keys[i] ? 'Salvando…' : 'sem armazenagem'}
            </button>
          )}
        </span>
      ))}
      {erro && <b> {erro}</b>}
    </>
  )
}

function AlertBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-critical bg-critical-soft px-4 py-3 text-sm leading-relaxed text-ink [&_b]:text-critical [&_b]:font-bold">
      <span className="mt-px shrink-0 text-[17px] leading-none text-critical" aria-hidden>
        ⚠
      </span>
      <span>{children}</span>
    </div>
  )
}

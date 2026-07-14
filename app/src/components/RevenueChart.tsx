import { useMemo, useState } from 'react'
import type { Nota } from '../domain/types'
import { taxesTotal } from '../domain/calc'
import { fmtBRL, MESES_LABEL } from '../lib/format'

interface Bucket {
  key: string // YYYY-MM
  label: string
  total: number
  taxes: number
  count: number
  semPeriodo: boolean
}

/**
 * Faturamento por período de referência — barras SVG (série única).
 * Meses sem nota dentro do intervalo aparecem como lacunas marcadas.
 */
export function RevenueChart({ notas }: { notas: Nota[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const buckets = useMemo<Bucket[]>(() => {
    const withPeriod = notas.filter((n) => n.periodoInfo && n.sortDate)
    const noPeriod = notas.filter((n) => !(n.periodoInfo && n.sortDate))
    const map = new Map<string, Bucket>()
    withPeriod.forEach((n) => {
      const key = n.sortDate.slice(0, 7)
      if (!map.has(key)) {
        const [y, mo] = key.split('-')
        map.set(key, { key, label: `${MESES_LABEL[mo]}/${y}`, total: 0, taxes: 0, count: 0, semPeriodo: false })
      }
      const b = map.get(key)!
      b.total += n.valorTotal
      b.taxes += taxesTotal(n)
      b.count++
    })
    if (!map.size) return []
    // eixo contínuo do primeiro ao último mês (lacunas visíveis)
    const keys = [...map.keys()].sort()
    const out: Bucket[] = []
    let [y, m] = keys[0].split('-').map(Number)
    const [ly, lm] = keys[keys.length - 1].split('-').map(Number)
    while (y < ly || (y === ly && m <= lm)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      out.push(
        map.get(key) ?? {
          key,
          label: `${MESES_LABEL[String(m).padStart(2, '0')]}/${y}`,
          total: 0,
          taxes: 0,
          count: 0,
          semPeriodo: false,
        },
      )
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    if (noPeriod.length) {
      out.push({
        key: 'sem',
        label: 'Sem período',
        total: noPeriod.reduce((s, n) => s + n.valorTotal, 0),
        taxes: noPeriod.reduce((s, n) => s + taxesTotal(n), 0),
        count: noPeriod.length,
        semPeriodo: true,
      })
    }
    return out
  }, [notas])

  if (!buckets.length)
    return (
      <div className="h-56 flex items-center justify-center text-sm text-ink-3">
        Sem notas com período de referência para exibir.
      </div>
    )

  const W = 900
  const H = 240
  const PAD_L = 74
  const PAD_R = 16
  const PAD_T = 18
  const PAD_B = 34
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const max = Math.max(...buckets.map((b) => b.total), 1)
  // teto "bonito"
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const ceil = Math.ceil(max / pow) * pow
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ceil)

  const n = buckets.length
  const slot = plotW / n
  const barW = Math.min(44, Math.max(10, slot * 0.6))

  const x = (i: number) => PAD_L + i * slot + (slot - barW) / 2
  const yv = (v: number) => PAD_T + plotH * (1 - v / ceil)

  const fmtShort = (v: number) =>
    v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : String(v)

  const h = hover != null ? buckets[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Faturamento por período">
        {/* grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yv(t)} y2={yv(t)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PAD_L - 8} y={yv(t) + 3.5} textAnchor="end" fontSize={10.5} fill="#898781">
              {t === 0 ? '0' : fmtShort(t)}
            </text>
          </g>
        ))}
        {/* baseline */}
        <line x1={PAD_L} x2={W - PAD_R} y1={yv(0)} y2={yv(0)} stroke="#c3c2b7" strokeWidth={1} />

        {buckets.map((b, i) => {
          const bx = x(i)
          const by = yv(b.total)
          const isHover = hover === i
          return (
            <g key={b.key}>
              {/* hit target maior que a marca */}
              <rect
                x={PAD_L + i * slot}
                y={PAD_T}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {b.count === 0 ? (
                // lacuna: marcador de mês sem nota
                <g pointerEvents="none">
                  <rect
                    x={bx}
                    y={yv(0) - 3}
                    width={barW}
                    height={3}
                    fill="#fab219"
                    opacity={0.9}
                  />
                </g>
              ) : (
                <path
                  pointerEvents="none"
                  d={`M ${bx} ${yv(0)} L ${bx} ${by + 4} Q ${bx} ${by} ${bx + 4} ${by} L ${bx + barW - 4} ${by} Q ${bx + barW} ${by} ${bx + barW} ${by + 4} L ${bx + barW} ${yv(0)} Z`}
                  fill={b.semPeriodo ? '#86b6ef' : isHover ? '#1c5cab' : '#2a78d6'}
                />
              )}
              {(n <= 14 || i % 2 === 0) && (
                <text
                  pointerEvents="none"
                  x={bx + barW / 2}
                  y={H - 12}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill={hover === i ? '#0b0b0b' : '#898781'}
                  fontWeight={hover === i ? 700 : 400}
                >
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {h && (
        <div
          className="absolute pointer-events-none z-10 card shadow-pop px-3 py-2 text-xs"
          style={{
            left: `${((PAD_L + hover! * slot + slot / 2) / W) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-bold mb-0.5">{h.label}</div>
          {h.count === 0 ? (
            <div className="text-warn-deep font-semibold">Nenhuma nota neste mês</div>
          ) : (
            <>
              <div className="tabular-nums">
                Faturado: <b>{fmtBRL(h.total)}</b>
              </div>
              <div className="tabular-nums text-ink-2">Impostos: {fmtBRL(h.taxes)}</div>
              <div className="text-ink-2">
                {h.count} nota{h.count > 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

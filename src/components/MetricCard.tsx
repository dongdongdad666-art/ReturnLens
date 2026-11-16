import type { ReactNode } from 'react'
import { Sparkline } from './Sparkline'

interface MetricCardProps {
  label: string
  value: string
  detail: ReactNode
  values?: number[]
  trendLabel?: string
  primary?: boolean
}

export function MetricCard({ label, value, detail, values, trendLabel, primary = false }: MetricCardProps) {
  return <article className={`metric-card${primary ? ' metric-card-primary' : ' metric-card-secondary'}`}>
    <p className="metric-label">{label}</p>
    <div className="metric-value-row"><strong className="metric-value">{value}</strong>{values && <span className="metric-sparkline"><Sparkline values={values} label={trendLabel ?? `${label}趋势`} /></span>}</div>
    <small className="metric-detail">{detail}</small>
  </article>
}

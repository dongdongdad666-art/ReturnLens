import type { RiskPoint } from './dashboard-metrics'
import { RiskMatrix } from './RiskMatrix'

export type DashboardChartsProps = {
  riskPoints: RiskPoint[]
  matrixUnavailableCount: number
}

export default function DashboardCharts(props: DashboardChartsProps) {
  return <RiskMatrix points={props.riskPoints} unavailableCount={props.matrixUnavailableCount} />
}

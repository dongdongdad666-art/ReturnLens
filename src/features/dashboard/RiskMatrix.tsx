import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import type { RiskPoint } from './dashboard-metrics'

const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`
const compactMoney = (value: number) => Math.abs(value) >= 10000 ? `¥${+(value / 10000).toFixed(1)}万` : money(value)
const percent = (value: number) => `${Math.round(value * 100)}%`
const chartMargin = { top: 30, right: 30, bottom: 18, left: 8 }
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function RiskBubble({ cx, cy, size = 80, payload, labels, onFocusPoint }: {
  cx?: number; cy?: number; size?: number; payload?: RiskPoint; labels: Map<string, string>
  onFocusPoint: (point: RiskPoint | null) => void
}) {
  const navigate = useNavigate()
  if (!payload || cx === undefined || cy === undefined) return null
  const radius = Math.sqrt(size / Math.PI)
  const openIssue = () => navigate(`/issues/${payload.issueId}`)
  return <g className={`risk-bubble risk-bubble-${payload.level}`} role="link" tabIndex={0}
    aria-label={`${payload.sku}，退货率 ${percent(payload.returnRate)}，订单毛利贡献估算 ${money(payload.grossMarginContribution)}，直接损失 ${money(payload.directLoss)}`}
    onFocus={() => onFocusPoint(payload)} onBlur={() => onFocusPoint(null)}
    onClick={openIssue} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); openIssue() } }}>
    <circle className="risk-bubble-focus" cx={cx} cy={cy} r={radius + 5} />
    <circle className="risk-bubble-point" cx={cx} cy={cy} r={radius} />
    {labels.has(payload.issueId) && <text x={cx} y={cy - radius - 8} textAnchor="middle">{labels.get(payload.issueId)}</text>}
  </g>
}

function RiskTooltip({ active, payload, focusedPoint }: { active?: boolean; payload?: readonly { payload?: RiskPoint }[]; focusedPoint: RiskPoint | null }) {
  const point = focusedPoint ?? payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="chart-tooltip"><strong>{point.sku}</strong>
    <p>退货率 {percent(point.returnRate)}</p><p>订单毛利贡献估算 {money(point.grossMarginContribution)}</p>
    <p>直接损失 {money(point.directLoss)}</p>
  </div>
}

export function RiskMatrix({ points, unavailableCount }: { points: RiskPoint[]; unavailableCount: number }) {
  const [focusedPoint, setFocusedPoint] = useState<RiskPoint | null>(null)
  const coordinateGroups = useMemo(() => {
    const groups = new Map<string, RiskPoint[]>()
    for (const point of points) {
      const key = `${point.returnRate}:${point.grossMarginContribution}`
      const group = groups.get(key) ?? []
      group.push(point)
      groups.set(key, group)
    }
    return [...groups.values()]
  }, [points])
  const overlappingGroups = coordinateGroups.filter((group) => group.length > 1)
  // Recharts remounts scatter symbols when geometry props change; focus must only update the tooltip.
  const geometry = useMemo(() => {
    const labels = new Map<string, string>()
    const rankedGroups = coordinateGroups.map((group) => ({
      group, largest: group.reduce((left, right) => left.directLoss >= right.directLoss ? left : right),
    })).sort((a, b) => b.largest.directLoss - a.largest.directLoss).slice(0, 3)
    for (const { group, largest } of rankedGroups) {
      const losses = group.map((point) => point.directLoss)
      const sameLoss = losses.every((loss) => loss === losses[0])
      const groupLoss = sameLoss
        ? `${compactMoney(losses[0])}/个`
        : `${compactMoney(Math.min(...losses))}–${compactMoney(Math.max(...losses))}`
      labels.set(largest.issueId, group.length === 1
        ? `${largest.sku} · ${compactMoney(largest.directLoss)}`
        : `${group.length} 个商品 · ${groupLoss}`)
    }
    return <>
      <XAxis type="number" dataKey="returnRate" tickFormatter={percent} name="退货率" axisLine={false} tickLine={false} padding={{ left: 20, right: 20 }} />
      <YAxis type="number" dataKey="grossMarginContribution" tickFormatter={compactMoney} name="订单毛利贡献估算" axisLine={false} tickLine={false} width={70} padding={{ top: 20, bottom: 20 }} />
      <ZAxis type="number" dataKey="directLoss" range={[80, 900]} />
      <CartesianGrid stroke="var(--hairline)" strokeOpacity={0.55} vertical horizontal />
      {points.length > 0 && <>
        <ReferenceLine x={median(points.map((point) => point.returnRate))} stroke="var(--hairline)" strokeDasharray="4 4" />
        <ReferenceLine y={median(points.map((point) => point.grossMarginContribution))} stroke="var(--hairline)" strokeDasharray="4 4" />
      </>}
      <Scatter data={points} shape={<RiskBubble labels={labels} onFocusPoint={setFocusedPoint} />} isAnimationActive={false} />
    </>
  }, [points, coordinateGroups])
  return <section className="risk-matrix" aria-labelledby="risk-matrix-title">
    <header><h2 id="risk-matrix-title">商品风险矩阵</h2><p>虚线为本批数据中位数 · 气泡大小代表直接损失</p></header>
    {points.length ? <>
      <p className="chart-axis-caption">订单毛利贡献估算（元）</p>
      <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={chartMargin}>
          {geometry}
          <Tooltip active={focusedPoint ? true : undefined} content={<RiskTooltip focusedPoint={focusedPoint} />} />
        </ScatterChart>
      </ResponsiveContainer></div>
      <p className="chart-axis-caption chart-axis-x">退货率 · 选择气泡查看问题</p>
      {overlappingGroups.length > 0 && <ul className="matrix-overlap-list" aria-label="同坐标商品入口">{overlappingGroups.map((group) => <li key={group[0].issueId}>
        <span>同坐标商品 · 退货率 {percent(group[0].returnRate)} · 毛利贡献 {money(group[0].grossMarginContribution)}</span>
        {group.map((point) => <Link key={point.issueId} to={`/issues/${point.issueId}`}>{point.sku}</Link>)}
      </li>)}</ul>}
      {unavailableCount > 0 && <p className="chart-data-note">{unavailableCount} 个商品缺少矩阵数据，重新分析后可查看。<Link to="/import">重新分析数据</Link></p>}
    </> : <div className="chart-empty"><p>{unavailableCount > 0 ? '重新分析后可查看商品风险矩阵' : '暂无可展示的商品风险数据'}</p><Link className="secondary-button" to="/import">重新分析数据</Link></div>}
  </section>
}

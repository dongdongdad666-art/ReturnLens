import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function LossTrendChart({ values }: { values: number[] }) {
  const gradientId = useId()
  return <section className="loss-trend-chart" aria-labelledby="loss-trend-title">
    <header><h2 id="loss-trend-title">损失趋势</h2><p>模拟时间序列</p></header>
    {values.length ? <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%">
      <AreaChart data={values.map((value, index) => ({ period: index + 1, value }))} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--forest)" stopOpacity={.15} /><stop offset="100%" stopColor="var(--forest)" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--hairline)" />
        <XAxis dataKey="period" tickFormatter={(value) => `第${value}期`} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis axisLine={false} tickLine={false} width={36} />
        <Tooltip labelFormatter={(value) => `模拟第${value}期`} />
        <Area type="monotone" dataKey="value" name="模拟损失" stroke="var(--forest)" strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer></div> : <div className="chart-empty"><p>暂无模拟趋势数据</p></div>}
  </section>
}

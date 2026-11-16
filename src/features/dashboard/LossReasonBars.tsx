import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { ReturnCause } from '../../domain/types'
import type { ReasonLoss } from './dashboard-metrics'

const causeLabels: Record<ReturnCause, string> = { size: '尺码', material: '面料', color: '色差', quality: '质量', logistics: '物流', expectation: '预期偏差', other: '其他' }

export function LossReasonBars({ values }: { values: ReasonLoss[] }) {
  return <section className="loss-reason-chart" aria-labelledby="loss-reason-title">
    <header><h2 id="loss-reason-title">退货原因损失</h2><p>按直接损失排序</p></header>
    {values.length ? <div className="chart-canvas" style={{ height: Math.max(140, values.length * 28) }}><ResponsiveContainer width="100%" height="100%">
      <BarChart data={values} layout="vertical" margin={{ top: 8, right: 85, bottom: 8, left: 0 }}>
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="cause" tickFormatter={(value: ReturnCause) => causeLabels[value]} width={64} interval={0} axisLine={false} tickLine={false} />
        <Bar dataKey="directLoss" barSize={18} fill="var(--danger)" isAnimationActive={false} radius={[0, 3, 3, 0]}>
          {values.map((value, index) => <Cell key={value.cause} fillOpacity={index === 0 ? 1 : index === 1 ? .65 : .35} />)}
          <LabelList dataKey="directLoss" position="right" formatter={(value) => `¥${Number(value).toLocaleString('zh-CN')}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer></div> : <div className="chart-empty"><p>暂无退货原因损失数据</p></div>}
  </section>
}

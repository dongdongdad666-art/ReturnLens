import { StatusBadge } from '../../components/StatusBadge'
import { experimentFixtures } from '../../data/mock-ai-fixtures'

const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`

export function ExperimentsPage() {
  return <section className="experiments-page" aria-labelledby="experiments-title">
    <header className="experiments-header"><div><p className="section-kicker">实验复盘</p><h1 id="experiments-title">确认整改是否真的降低退货</h1><p>以下为固定的本地演示样本，用于说明复盘口径；不代表真实业务实验结论。</p></div><p className="simulation-label">模拟实验数据</p></header>
    <div className="experiment-list">{experimentFixtures.map((experiment) => {
      const baseline = Number.parseFloat(experiment.baseline)
      const current = Number.parseFloat(experiment.current)
      return <article className="experiment-card" key={experiment.id}><header><div><p className="section-kicker">{experiment.id}</p><h2>{experiment.title}</h2></div><StatusBadge tone={experiment.tone}>{experiment.status}</StatusBadge></header><p className="experiment-conclusion">{experiment.conclusion}</p><div className="experiment-rate-comparison" role="img" aria-label={`基线退货率 ${experiment.baseline}，当前退货率 ${experiment.current}`}><div><span>基线</span><i style={{ width: `${baseline}%` }} /></div><div><span>当前</span><i style={{ width: `${current}%` }} /></div></div>{experiment.id === 'EXP-003' && <p className="experiment-next-step">样本不足，延长观察后再判断</p>}<dl><div><dt>基线退货率</dt><dd>{experiment.baseline}</dd></div><div><dt>当前退货率</dt><dd>{experiment.current}</dd></div><div><dt>观察周期</dt><dd>{experiment.duration}</dd></div><div><dt>样本覆盖</dt><dd>{experiment.coverage}</dd></div><div><dt>可避免损失</dt><dd className="recoverable experiment-loss-values"><span>低 {money(experiment.recoverableLoss.low)}</span><span>基准 {money(experiment.recoverableLoss.base)}</span><span>高 {money(experiment.recoverableLoss.high)}</span></dd></div><div><dt>模拟 AI 成本</dt><dd>{experiment.cost}</dd></div></dl><p className="experiment-source"><span className="simulation-label">模拟实验数据</span>确定性演示数据，仅用于产品流程验证。</p></article>
    })}</div>
  </section>
}

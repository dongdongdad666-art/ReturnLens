import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Issue, ReturnCause } from '../../domain/types'
import { getMockSummary } from '../../lib/mock-ai'

const causeLabels: Record<ReturnCause, string> = { size: '尺码', material: '面料', color: '色差', quality: '质量', logistics: '物流', expectation: '预期偏差', other: '其他' }

export function AiRiskBrief({ issue, hasAnyIssues }: { issue: Issue | undefined; hasAnyIssues: boolean }) {
  const summary = issue ? getMockSummary(issue) : undefined
  return <aside className="ai-risk-brief" aria-labelledby="ai-brief-title">
    <header><h2 id="ai-brief-title"><Sparkles className="ai-brief-icon" size={16} aria-hidden="true" />AI 风险简报</h2><span className="simulation-label">模拟生成</span></header>
    {issue && summary ? <>
      <p className="ai-brief-priority">当前最高可行动优先级 · {issue.sku}</p>
      <h3>{issue.title}</h3>
      <dl className="ai-brief-facts">
        <div><dt>主要原因</dt><dd>{causeLabels[issue.primaryCause]}</dd></div>
        <div><dt>证据置信度</dt><dd>{issue.confidence}%</dd></div>
      </dl>
      <p className="ai-brief-evidence"><span>{issue.affectedReturns} 笔相关退货</span><span>{issue.evidenceIds.length} 条证据</span></p>
      <div className="ai-brief-summary"><p>{summary.hypothesis}</p><p>{summary.recommendation}</p></div>
      <p className="ai-brief-caution">置信度表示证据充分程度，不代表因果确定性</p>
      <Link className="primary-button" to={`/issues/${issue.id}#evidence`}>查看证据并生成整改方案<ArrowUpRight size={16} aria-hidden="true" /></Link>
      <small>先人工复核，再确认整改动作。</small>
    </> : <div className="ai-brief-empty">
      <h3>{hasAnyIssues ? '暂无可排序的问题' : '从一批退货数据开始'}</h3>
      <p>{hasAnyIssues ? '已完成分析的问题当前无需进入优先队列，可查看复核状态。' : '导入 CSV 并完成模拟分析后，查看损失、证据与整改建议。'}</p>
      <Link className="secondary-button" to={hasAnyIssues ? '/issues' : '/import'}>{hasAnyIssues ? '查看问题复核状态' : '导入数据开始分析'}</Link>
    </div>}
  </aside>
}

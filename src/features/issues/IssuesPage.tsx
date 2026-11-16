import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Issue, ReturnCause, ReviewStatus } from '../../domain/types'
import { getMockSummary } from '../../lib/mock-ai'
import { isAnalysisComplete, isIssueAnalysisComplete, loadAnalysisTask } from '../tasks/analysis-eligibility'
import { getIssueSessionContext } from './issue-session'

const causes: Record<ReturnCause, string> = { size: '尺码', material: '面料', color: '色差', quality: '质量', logistics: '物流', expectation: '预期偏差', other: '其他' }
const statuses: Record<ReviewStatus, string> = { pending: '待复核', confirmed: '已确认', corrected: '已修正', rejected: '已驳回', watching: '观察中' }
const loadIssues = (): Issue[] => { try { return JSON.parse(localStorage.getItem('returnlens:issues') ?? '[]') as Issue[] } catch { return [] } }
const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`

export function IssuesPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [toast] = useState(() => (location.state as { toast?: string } | null)?.toast ?? '')
  const [issues] = useState(loadIssues)
  const [sku, setSku] = useState('')
  const [cause, setCause] = useState('')
  const [channel, setChannel] = useState('')
  const [confidence, setConfidence] = useState('')
  const [status, setStatus] = useState('')
  const context = getIssueSessionContext()
  const channels = [...new Set(Object.values(context).flatMap((item) => item.channels))].sort()
  const filtered = useMemo(() => issues.filter((issue) =>
    issue.sku.toLowerCase().includes(sku.toLowerCase()) && (!cause || issue.primaryCause === cause) &&
    (!confidence || issue.confidence >= Number(confidence)) && (!status || issue.status === status) && (!channel || context[issue.id]?.channels.includes(channel)),
  ).toSorted((left, right) => right.recoverableHigh - left.recoverableHigh || right.directLoss - left.directLoss), [cause, channel, confidence, context, issues, sku, status])
  const task = loadAnalysisTask()
  const taskPartial = !isAnalysisComplete(task)
  const totalReturns = issues.reduce((sum, issue) => sum + issue.affectedReturns, 0)
  const coverageParam = searchParams.get('coverage')
  const requestedCoverage = Number(coverageParam)
  const hasPartialCoverage = taskPartial
  const evidenceCoverage = totalReturns ? Math.round(issues.reduce((sum, issue) => sum + Math.min(context[issue.id]?.evidence.length ?? 0, issue.affectedReturns), 0) / totalReturns * 100) : 0
  const taskCoverage = task?.total ? Math.round((task.processed ?? 0) / task.total * 100) : 0
  const covered = hasPartialCoverage ? Math.min(99, coverageParam !== null && Number.isFinite(requestedCoverage) ? Math.round(requestedCoverage) : taskCoverage) : evidenceCoverage
  const completedIssueIds = new Set(issues.filter((issue) => isIssueAnalysisComplete(issue.id, task)).map((issue) => issue.id))
  const completedIssues = issues.filter((issue) => completedIssueIds.has(issue.id))
  const incompleteIssues = issues.filter((issue) => !completedIssueIds.has(issue.id))
  const pendingCount = hasPartialCoverage ? Math.max(incompleteIssues.length, Math.max(0, (task?.total ?? 0) - (task?.processed ?? 0))) : 0
  useEffect(() => {
    if (toast) navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.pathname, location.search, navigate, toast])

  return <section className="issues-page" aria-labelledby="issues-title">
    <header className="issues-header"><div><p className="section-kicker">问题中心</p><h1 id="issues-title">优先处理可挽回损失</h1><p>以下为本地确定性分析结果；金额均为估算区间，不是审计财务结果。</p></div><p className="issue-count">{issues.length} 个问题</p></header>
    {toast && <p className="toast" role="status">{toast}</p>}
    {covered < 100 && <p className="coverage-banner" role="status">分析覆盖率 {covered}%：仍有退货缺少可复核证据，结论需人工确认。</p>}
    {hasPartialCoverage ? <><section className="partial-results" aria-label="部分问题结果"><h2>已完成的问题</h2><div>{completedIssues.map((issue) => <article key={issue.id}><Link className="issue-link" to={`/issues/${issue.id}`}>{issue.title}</Link><span>已完成</span></article>)}{!completedIssues.length && <p>当前批次尚未完成可独立展示的问题卡片。</p>}</div></section><section className="partial-pending" aria-label="待分析记录"><h2>待分析记录（{pendingCount}）</h2><ul>{Array.from({ length: pendingCount }, (_, index) => <li key={index}>待分析</li>)}</ul></section></> : <><form className="issue-filters" aria-label="问题筛选" onSubmit={(event) => event.preventDefault()}>
      <label>SKU<input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="搜索 SKU" /></label>
      <label>原因<select value={cause} onChange={(event) => setCause(event.target.value)}><option value="">全部原因</option>{Object.entries(causes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label>渠道<select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="">全部渠道</option>{channels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label>置信度<select value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="">全部置信度</option><option value="80">80% 及以上</option><option value="60">60% 及以上</option></select></label>
      <label>复核状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(statuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
    </form>
    <div className="issue-table-wrap"><table className="data-table"><thead><tr><th>问题 / 证据假设</th><th className="optional-column">原因</th><th>置信度</th><th>复核</th><th className="number optional-column">直接损失</th><th className="number">可挽回损失（估算）</th></tr></thead><tbody>{filtered.map((issue) => { const summary = getMockSummary(issue); return <tr key={issue.id}><td><Link className="issue-link" to={`/issues/${issue.id}`}>{issue.title}</Link><p><span className="simulation-label">{summary.label}</span>{summary.hypothesis}</p></td><td className="optional-column">{causes[issue.primaryCause]}</td><td><div className="confidence-cell"><span>{issue.confidence}%</span><meter aria-label="AI 归因置信度" min={0} max={100} value={issue.confidence} /></div></td><td><span className={`issue-status issue-status-${issue.status}`}><span aria-hidden="true" />{statuses[issue.status]}</span></td><td className="number optional-column">{money(issue.directLoss)}</td><td className="number recoverable">{money(issue.recoverableLow)}–{money(issue.recoverableHigh)}<small>按置信度与改善率 15%–35%</small></td></tr> })}</tbody></table>{!filtered.length && <p className="empty-state">没有匹配的问题。请先在“数据与设置”完成模拟分析。</p>}</div></>}
  </section>
}

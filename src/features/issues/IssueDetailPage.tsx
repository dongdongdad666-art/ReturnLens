import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Issue, ReturnCause } from '../../domain/types'
import { getMockSummary } from '../../lib/mock-ai'
import { reviewIssue } from './issue-review'
import { getIssueSessionContext } from './issue-session'
import { ActionDraftDrawer } from '../actions/ActionDraftDrawer'
import { isIssueAnalysisComplete } from '../tasks/analysis-eligibility'

const causeLabels: Record<ReturnCause, string> = { size: '尺码', material: '面料', color: '色差', quality: '质量', logistics: '物流', expectation: '预期偏差', other: '其他' }
const loadIssues = (): Issue[] => { try { return JSON.parse(localStorage.getItem('returnlens:issues') ?? '[]') as Issue[] } catch { return [] } }
const saveIssue = (updated: Issue) => { const issues = loadIssues().map((issue) => issue.id === updated.id ? updated : issue); localStorage.setItem('returnlens:issues', JSON.stringify(issues)) }

export function IssueDetailPage() {
  const { issueId } = useParams()
  const [issue, setIssue] = useState(() => loadIssues().find((item) => item.id === issueId))
  const [reason, setReason] = useState('')
  const [cause, setCause] = useState<ReturnCause>(issue?.primaryCause ?? 'other')
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const draftButtonRef = useRef<HTMLButtonElement>(null)
  if (!issue) return <section className="issue-detail"><p className="section-kicker">问题详情</p><h1>未找到问题</h1><p>请先完成模拟分析，或返回问题中心重新选择。</p><Link to="/issues">返回问题中心</Link></section>
  if (!isIssueAnalysisComplete(issue.id)) return <section className="issue-detail"><h1>分析尚未完成</h1><p>完成该问题的全部关联批次后，才能查看结论、复核证据并创建整改动作。</p><Link to="/import">返回分析任务</Link></section>
  const summary = getMockSummary(issue)
  const evidence = getIssueSessionContext()[issue.id]?.evidence ?? []
  const lowEvidence = evidence.length === 0
  const canDraft = issue.status === 'confirmed' || issue.status === 'corrected'
  const update = (event: Parameters<typeof reviewIssue>[1]) => { try { const updated = { ...issue, primaryCause: event.type === 'correct' ? event.cause : issue.primaryCause, status: reviewIssue(issue.status, event) }; setHasError(false); setIssue(updated); saveIssue(updated); setMessage(`已${updated.status === 'confirmed' ? '确认' : updated.status === 'corrected' ? '修正' : updated.status === 'rejected' ? '驳回' : '加入观察'}，状态已保存到本地派生结果。`) } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : '无法更新复核状态') } }
  return <section className="issue-detail" aria-labelledby="issue-title">
    <Link className="back-link" to="/issues">← 返回问题中心</Link><header><p className="section-kicker">证据复核</p><h1 id="issue-title">{issue.title}</h1><p>SKU {issue.sku} · {issue.affectedReturns} 笔相关退货 · 当前置信度 {issue.confidence}%</p></header>
    {lowEvidence && <p className="low-evidence" role="alert">低证据：未保留可复核的脱敏证据，不能创建整改动作；请补充数据后重新分析。</p>}
    <div className="issue-detail-layout">
    <section className="issue-evidence-column" aria-label="问题证据与分析">
    <div className="detail-grid"><article><h2>损失构成与估算</h2><dl><div><dt>直接损失</dt><dd>¥{issue.directLoss.toLocaleString('zh-CN')}</dd></div><div><dt>可挽回损失（估算）</dt><dd className="recoverable">¥{issue.recoverableLow.toLocaleString('zh-CN')}–¥{issue.recoverableHigh.toLocaleString('zh-CN')}</dd></div></dl><p>假设：在当前置信度下，改善后可降低相关直接损失的 15%–35%；仅用于优先级排序，非审计结果。</p></article><article><h2>规则匹配</h2><p>主因：{causeLabels[issue.primaryCause]}；匹配到 {issue.evidenceIds.length} 条脱敏文本证据，关联 {issue.affectedReturns} 笔退货。</p><p>规则以退货原因和脱敏评价/客服文本中的关键词进行确定性匹配。</p></article><article><h2>模拟建议 <span className="simulation-label">{summary.label}</span></h2><p>{summary.hypothesis}</p><p>{summary.recommendation}</p></article></div>
    <article className="evidence-panel" id="evidence"><h2>脱敏证据摘录</h2>{lowEvidence ? <p>证据摘录仅在本次浏览器会话可用，刷新后请重新导入数据查看。</p> : <ul>{evidence.map((item) => <li key={item.id}><b>{item.source === 'chat' ? '客服' : '评价'} · {item.id}</b><span>{item.text}</span></li>)}</ul>}</article>
    </section>
    <aside className="issue-review-rail" aria-label="问题复核">
    <article className="confidence-panel"><h2>置信度说明</h2><div className="confidence-cell"><span>{issue.confidence}%</span><meter aria-label="AI 归因置信度" aria-valuenow={issue.confidence} aria-describedby="confidence-explanation" min={0} max={100} value={issue.confidence} /></div><p id="confidence-explanation">{issue.confidence}% 由退货数量与证据数量确定：基础 45%，每笔退货 +5%，每条证据 +3%（证据贡献最高 +20%），总分最高 95%。分数表示证据充分程度，不代表因果确定性。</p></article>
    <article className="review-panel"><h2>人工复核</h2><div className="review-actions"><button className="primary-button" type="button" disabled={lowEvidence} onClick={() => update({ type: 'confirm' })}>确认问题</button><button className="secondary-button" type="button" disabled={lowEvidence} onClick={() => update({ type: 'watch' })}>加入观察</button><label>修正原因<select value={cause} onChange={(event) => setCause(event.target.value as ReturnCause)}>{Object.entries(causeLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>说明<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="必填" /></label><button className="secondary-button" type="button" disabled={lowEvidence} onClick={() => update({ type: 'correct', cause, reason })}>修正</button><button className="secondary-button danger-button" type="button" disabled={lowEvidence} onClick={() => update({ type: 'reject', reason })}>驳回</button></div>{message && <p role={hasError ? 'alert' : 'status'}>{message}</p>}<button ref={draftButtonRef} className="primary-button" type="button" disabled={!canDraft || lowEvidence} onClick={() => setDrawerOpen(true)}>生成整改方案</button></article>
    </aside>
    </div>
    <ActionDraftDrawer issue={issue} open={drawerOpen} onClose={() => setDrawerOpen(false)} returnFocusRef={draftButtonRef} />
  </section>
}

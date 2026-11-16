import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { ActionStatus, Issue } from '../../domain/types'
import { loadActions, reduceAction, saveAction, type ActionEvent, type StoredAction } from './action-workflow'
import { isIssueAnalysisComplete } from '../tasks/analysis-eligibility'

const loadIssues = (): Issue[] => { try { return JSON.parse(localStorage.getItem('returnlens:issues') ?? '[]') as Issue[] } catch { return [] } }
const columns: { title: string; statuses: ActionStatus[] }[] = [
  { title: '待执行', statuses: ['todo'] },
  { title: '执行中', statuses: ['doing'] },
  { title: '待验证', statuses: ['verify'] },
  { title: '已验证', statuses: ['verified'] },
]

const nextEvent = (status: ActionStatus): ActionEvent | null => {
  if (status === 'todo') return { type: 'start' }
  if (status === 'doing') return { type: 'complete' }
  if (status === 'verify') return { type: 'verify' }
  return null
}

const nextLabel: Partial<Record<ActionStatus, string>> = { todo: '开始执行', doing: '提交验证', verify: '确认验证' }
const boardRecords = () => loadActions().filter((record) => isIssueAnalysisComplete(record.current.issueId) && ['todo', 'doing', 'verify', 'verified'].includes(record.current.status))

export function ActionsPage() {
  const [records, setRecords] = useState<StoredAction[]>(boardRecords)
  const issues = useMemo(loadIssues, [])
  const issueById = useMemo(() => new Map(issues.map((issue) => [issue.id, issue])), [issues])
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [focusedId, setFocusedId] = useState(() => searchParams.get('focus') ?? '')
  const [toast, setToast] = useState(() => (location.state as { toast?: string } | null)?.toast ?? '')
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const targetId = searchParams.get('focus')
    if (!targetId) return
    cardRefs.current[targetId]?.focus()
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
    setFocusedId('')
  }, [searchParams, setSearchParams])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const transition = (record: StoredAction) => {
    const event = nextEvent(record.current.status)
    if (!event) return
    saveAction({ ...record, current: reduceAction(record.current, event) })
    setRecords(boardRecords())
  }
  const verifiedCount = records.filter((record) => record.current.status === 'verified').length
  const recoverableLow = records.reduce((total, record) => total + (issueById.get(record.current.issueId)?.recoverableLow ?? 0), 0)
  const recoverableHigh = records.reduce((total, record) => total + (issueById.get(record.current.issueId)?.recoverableHigh ?? 0), 0)

  return <section className="actions-page" aria-labelledby="actions-title">
    <header className="actions-header"><div><p className="section-kicker">整改看板</p><h1 id="actions-title">把已确认问题推进到验证</h1><p>整改状态仅保存本地派生动作，不保存原始证据文本。</p></div></header>
    {toast && <p className="toast" role="status">{toast}</p>}
    <div className="action-summary" aria-label="整改看板摘要"><p><strong>{records.length} 个整改动作</strong></p><p><strong>{verifiedCount} 个已验证</strong></p><p><strong>预计可避免损失 ¥{recoverableLow.toLocaleString('zh-CN')}–¥{recoverableHigh.toLocaleString('zh-CN')}</strong></p></div>
    <div className="action-board" aria-label="整改动作看板">{columns.map((column) => {
      const items = records.filter((record) => column.statuses.includes(record.current.status))
      return <section className="action-column" key={column.title}><h2>{column.title}<span>{items.length}</span></h2>{items.length ? items.map((record) => {
        const draft = record.current
        const event = nextEvent(draft.status)
        const highlighted = focusedId === draft.id
        return <article ref={(element) => { cardRefs.current[draft.id] = element }} className={`action-card${highlighted ? ' action-focus' : ''}`} key={draft.id} tabIndex={0}>
          <h3>{draft.title}</h3><p className="action-problem">问题：{issueById.get(draft.issueId)?.title ?? draft.issueId}</p>
          <dl><div><dt>负责人</dt><dd>{draft.owner}</dd></div><div><dt>截止日期</dt><dd>{draft.dueDate}</dd></div><div><dt>目标指标</dt><dd>{draft.targetMetric}</dd></div><div><dt>预计收益</dt><dd>¥{(issueById.get(draft.issueId)?.recoverableLow ?? 0).toLocaleString('zh-CN')}–¥{(issueById.get(draft.issueId)?.recoverableHigh ?? 0).toLocaleString('zh-CN')}</dd></div><div><dt>版本</dt><dd>V{draft.version} <span className="simulation-label">模拟生成</span></dd></div></dl>
          <Link to={`/issues/${draft.issueId}#evidence`} className="issue-link">查看脱敏证据</Link>
          {event && <button className="secondary-button" type="button" onClick={() => transition(record)}>{nextLabel[draft.status]}</button>}
        </article>
      }) : <p className="board-empty">暂无{column.title}动作</p>}</section>
    })}</div>
  </section>
}

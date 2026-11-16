import { useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ActionDraft, Issue } from '../../domain/types'
import { getMockActionDraft } from '../../lib/mock-ai'
import { loadAction, ownerRoles, reduceAction, saveAction } from './action-workflow'

interface ActionDraftDrawerProps {
  issue: Issue
  open: boolean
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

const rejectionCategories = ['内容不够具体', '触点不正确', '目标指标不合理', '需要补充约束']

export function ActionDraftDrawer({ issue, open, onClose, returnFocusRef }: ActionDraftDrawerProps) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ActionDraft | null>(null)
  const [history, setHistory] = useState<ActionDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [category, setCategory] = useState(rejectionCategories[0])
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const generationRef = useRef(0)
  const rewriteTimerRef = useRef<number | undefined>(undefined)
  const invalidateGeneration = () => {
    generationRef.current += 1
    if (rewriteTimerRef.current !== undefined) window.clearTimeout(rewriteTimerRef.current)
    rewriteTimerRef.current = undefined
  }
  const closeDrawer = () => {
    invalidateGeneration()
    onClose()
    window.setTimeout(() => returnFocusRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!open) return
    drawerRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // Opening owns this one-time focus handoff; rerendering inputs must not steal focus.
  }, [open])

  useEffect(() => {
    invalidateGeneration()
    if (!open) return
    const generation = generationRef.current
    const stored = loadAction(issue.id)
    setMessage('')
    setHasError(false)
    setRejecting(false)
    setInstruction('')
    if (stored) {
      setDraft(stored.current)
      setHistory(stored.history)
      setLoading(false)
      return
    }
    setDraft(null)
    setHistory([])
    setLoading(true)
    const timer = window.setTimeout(() => {
      if (generation !== generationRef.current) return
      setDraft(getMockActionDraft(issue))
      setLoading(false)
    }, 280)
    return () => { window.clearTimeout(timer); invalidateGeneration() }
  }, [issue, open])

  if (!open) return null
  const update = <K extends keyof ActionDraft>(key: K, value: ActionDraft[K]) => draft && setDraft({ ...draft, [key]: value })
  const save = () => {
    if (!draft) return
    saveAction({ current: draft, history })
    setHasError(false)
    setMessage('草稿已保存到本地派生状态。')
  }
  const rejectAndRewrite = () => {
    if (!draft) return
    try {
      const rejected = reduceAction(draft, { type: 'reject', reason: `${category}：${instruction}` })
      const nextHistory = [...history, rejected]
      setHistory(nextHistory)
      setRejecting(false)
      setMessage('')
      setHasError(false)
      setLoading(true)
      invalidateGeneration()
      const generation = generationRef.current
      rewriteTimerRef.current = window.setTimeout(() => {
        if (generation !== generationRef.current) return
        rewriteTimerRef.current = undefined
        try {
          const regenerated = reduceAction(rejected, { type: 'regenerate' })
          const fixture = getMockActionDraft(issue, regenerated.version, rejected.rejectionReason)
          const rewritten = { ...regenerated, title: fixture.title, touchpoint: fixture.touchpoint, content: fixture.content, targetMetric: fixture.targetMetric, experimentDays: fixture.experimentDays }
          setDraft(rewritten)
          saveAction({ current: rewritten, history: nextHistory })
        } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : '无法重写草稿') }
        finally { if (generation === generationRef.current) setLoading(false) }
      }, 280)
    } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : '无法重写草稿') }
  }
  const publish = () => {
    if (!draft) return
    try {
      const published = reduceAction(draft, { type: 'publish' })
      saveAction({ current: published, history })
      navigate(`/actions?focus=${encodeURIComponent(published.id)}`, { state: { toast: '整改动作已加入看板。' } })
    } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : '无法加入看板') }
  }

  return <aside ref={drawerRef} tabIndex={-1} className="action-drawer" role="dialog" aria-modal="false" aria-labelledby="draft-drawer-title">
    <header className="drawer-header"><div><p className="section-kicker">整改方案</p><h2 id="draft-drawer-title">{issue.title}</h2></div><button className="text-button" type="button" onClick={closeDrawer}>关闭</button></header>
    {loading && <p className="draft-loading" role="status">生成中</p>}
    {!loading && draft && <div className="drawer-body">
      <p className="simulation-note"><span className="simulation-label">模拟生成</span>确定性模拟草稿，可按实际业务调整。</p>
      <p className="draft-version"><span>版本 {draft.version}</span> · <span>{draft.status === 'manual_edit' ? '人工编辑中' : '草案待确认'}</span></p>
      <label>整改触点<input value={draft.touchpoint} onChange={(event) => update('touchpoint', event.target.value)} /></label>
      <label>具体内容<textarea rows={4} value={draft.content} onChange={(event) => update('content', event.target.value)} /></label>
      <div className="drawer-fields"><label>负责人<select value={draft.owner} onChange={(event) => update('owner', event.target.value)}><option value="">请选择团队</option>{ownerRoles.map((role) => <option key={role}>{role}</option>)}</select></label><label>截止日期<input type="date" value={draft.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label></div>
      <p className="simulation-note">负责人仅选团队；请填写整改摘要，勿粘贴聊天原文或个人信息。保存时会进行本地脱敏。</p>
      <label>目标指标<input value={draft.targetMetric} onChange={(event) => update('targetMetric', event.target.value)} placeholder="确认前必填" /></label>
      <label>实验周期（天）<input type="number" min="1" value={draft.experimentDays} onChange={(event) => update('experimentDays', Number(event.target.value) || 1)} /></label>
      {rejecting && <div className="rewrite-panel"><h3>驳回并重写</h3><label>驳回类别<select value={category} onChange={(event) => setCategory(event.target.value)}>{rejectionCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label>修改要求<textarea rows={3} required value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="必填：说明需要如何调整" /></label><button className="secondary-button" type="button" disabled={!instruction.trim()} onClick={rejectAndRewrite}>按意见重新生成</button></div>}
      <div className="drawer-actions"><button className="secondary-button" type="button" onClick={save}>保存草稿</button><button className="secondary-button" type="button" disabled={draft.status !== 'draft_review'} onClick={() => setRejecting(true)}>驳回并重写</button><button className="secondary-button" type="button" disabled={draft.status !== 'draft_review' && draft.status !== 'needs_rewrite'} onClick={() => setDraft(reduceAction(draft, { type: 'manual' }))}>转为人工编辑</button><button className="primary-button" type="button" disabled={draft.status !== 'draft_review' && draft.status !== 'manual_edit'} onClick={publish}>确认并入看板</button></div>
      {message && <p role={hasError ? 'alert' : 'status'}>{message}</p>}
      <section className="version-history" aria-label="版本历史"><h3>版本历史</h3>{history.length ? <ol>{history.map((item) => <li key={`${item.id}-${item.version}-${item.status}`}><span className="simulation-label">模拟生成</span>V{item.version} · 已驳回：{item.rejectionReason}</li>)}</ol> : <p>当前为首个模拟生成版本。</p>}</section>
    </div>}
  </aside>
}

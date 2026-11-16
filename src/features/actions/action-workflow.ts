import type { ActionDraft, ActionStatus } from '../../domain/types'
import { maskSensitiveText } from '../import/privacy'
import { isIssueAnalysisComplete } from '../tasks/analysis-eligibility'

export interface StoredAction {
  current: ActionDraft
  history: ActionDraft[]
}

const storageKey = 'returnlens:actions'
export const ownerRoles = ['商品运营', '客服团队', '商品团队', '仓配团队']
export const clearActions = () => localStorage.removeItem(storageKey)

const sanitizeActionText = (text: string) => /(?:买家|客户|客服|用户|顾客|商家)\s*[：:]/.test(text)
  ? '[聊天原文已移除，请填写整改摘要]'
  : maskSensitiveText(text)

const statuses: ActionStatus[] = ['not_created', 'generating', 'draft_review', 'needs_rewrite', 'manual_edit', 'todo', 'doing', 'verify', 'verified']
const isStatus = (value: unknown): value is ActionStatus => typeof value === 'string' && statuses.includes(value as ActionStatus)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeDraft = (value: unknown): ActionDraft | undefined => {
  if (!isRecord(value) || !isStatus(value.status)) return undefined
  const fields = ['id', 'issueId', 'title', 'touchpoint', 'content', 'owner', 'dueDate', 'targetMetric'] as const
  if (fields.some((field) => typeof value[field] !== 'string') || typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 1 || typeof value.experimentDays !== 'number' || !Number.isFinite(value.experimentDays) || value.experimentDays < 1) return undefined
  if (value.rejectionReason !== undefined && typeof value.rejectionReason !== 'string') return undefined
  const safe = Object.fromEntries(fields.map((field) => [field, sanitizeActionText(value[field] as string)])) as Record<typeof fields[number], string>
  return { ...safe, owner: ownerRoles.includes(safe.owner.trim()) ? safe.owner.trim() : '', dueDate: /^\d{4}-\d{2}-\d{2}$/.test(safe.dueDate.trim()) ? safe.dueDate.trim() : '', version: value.version, status: value.status, experimentDays: value.experimentDays, ...(value.rejectionReason ? { rejectionReason: sanitizeActionText(value.rejectionReason) } : {}) }
}

const normalizeStoredAction = (issueId: string, value: unknown): StoredAction | undefined => {
  if (!isRecord(value)) return undefined
  const current = normalizeDraft(value.current)
  if (!current || current.issueId !== issueId) return undefined
  const history = value.history === undefined ? [] : Array.isArray(value.history) ? value.history.map(normalizeDraft) : []
  if (history.some((item) => !item)) return undefined
  return { current, history: history as ActionDraft[] }
}

const loadAll = (): Record<string, StoredAction> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (!isRecord(parsed)) return {}
    const normalized = Object.fromEntries(Object.entries(parsed).flatMap(([issueId, value]) => {
      const action = normalizeStoredAction(issueId, value)
      return action ? [[issueId, action]] : []
    }))
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) localStorage.setItem(storageKey, JSON.stringify(normalized))
    return normalized
  } catch { return {} }
}

export const loadAction = (issueId: string) => loadAll()[issueId]
export const loadActions = () => Object.values(loadAll())
export const saveAction = (record: StoredAction) => {
  const normalized = normalizeStoredAction(record.current.issueId, record)
  if (!normalized) return
  const actions = loadAll()
  localStorage.setItem(storageKey, JSON.stringify({ ...actions, [normalized.current.issueId]: normalized }))
}

export type ActionEvent =
  | { type: 'reject'; reason: string }
  | { type: 'regenerate' }
  | { type: 'manual' }
  | { type: 'publish' }
  | { type: 'start' }
  | { type: 'complete' }
  | { type: 'verify' }

export function reduceAction(state: ActionDraft, event: ActionEvent): ActionDraft {
  if (event.type === 'reject') {
    if (state.status !== 'draft_review') throw new Error('不允许的整改状态流转')
    if (!event.reason.trim()) throw new Error('请输入驳回原因')
    return { ...state, status: 'needs_rewrite', rejectionReason: event.reason }
  }
  if (event.type === 'regenerate') {
    if (state.status !== 'needs_rewrite') throw new Error('不允许的整改状态流转')
    return { ...state, status: 'draft_review', version: state.version + 1 }
  }
  if (event.type === 'manual') {
    if (state.status !== 'draft_review' && state.status !== 'needs_rewrite') throw new Error('不允许的整改状态流转')
    return { ...state, status: 'manual_edit' }
  }
  if (event.type === 'publish') {
    if (!isIssueAnalysisComplete(state.issueId)) throw new Error('分析尚未完成，不能发布整改动作')
    if (state.status !== 'draft_review' && state.status !== 'manual_edit') throw new Error('不允许的整改状态流转')
    const owner = state.owner.trim()
    const dueDate = state.dueDate.trim()
    const targetMetric = state.targetMetric.trim()
    if (!owner || !dueDate || !targetMetric) throw new Error('请补全负责人、截止日期和目标指标')
    if (!ownerRoles.includes(owner)) throw new Error('请选择负责人团队，不填写个人姓名')
    return { ...state, owner, dueDate, targetMetric, status: 'todo' }
  }
  if (event.type === 'start') {
    if (state.status !== 'todo') throw new Error('不允许的整改状态流转')
    return { ...state, status: 'doing' }
  }
  if (event.type === 'complete') {
    if (state.status !== 'doing') throw new Error('不允许的整改状态流转')
    return { ...state, status: 'verify' }
  }
  if (state.status !== 'verify') throw new Error('不允许的整改状态流转')
  return { ...state, status: 'verified' }
}

import type { ActionDraft, Issue } from '../domain/types'
import { actionDrafts, summaries } from '../data/mock-ai-fixtures'

export function getMockSummary(issue: Pick<Issue, 'id' | 'sku' | 'primaryCause'>) {
  return summaries[issue.primaryCause]
}

export function getMockActionDraft(issue: Pick<Issue, 'id' | 'primaryCause'>, version = 1, feedback = ''): ActionDraft {
  const fixture = actionDrafts[issue.primaryCause]
  const note = feedback.trim()
  const rewrite = version > 1 && note ? { touchpoint: `${fixture.touchpoint}（按反馈补充）`, content: `${fixture.content} 根据驳回反馈：${note}`, targetMetric: `${fixture.targetMetric}（按反馈复核）` } : {}
  return { id: `A-${issue.id}`, issueId: issue.id, version, status: 'draft_review', owner: '', dueDate: '', ...fixture, ...rewrite }
}

import type { ReturnCause, ReviewStatus } from '../../domain/types'

type ReviewEvent =
  | { type: 'confirm' }
  | { type: 'correct'; cause: ReturnCause; reason: string }
  | { type: 'reject'; reason: string }
  | { type: 'watch' }

export function reviewIssue(_: ReviewStatus, event: ReviewEvent): ReviewStatus {
  if ('reason' in event && !event.reason.trim()) throw new Error(event.type === 'correct' ? '请输入修正原因' : '请输入驳回原因')
  return { confirm: 'confirmed', correct: 'corrected', reject: 'rejected', watch: 'watching' }[event.type] as ReviewStatus
}

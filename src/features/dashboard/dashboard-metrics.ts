import type { Issue, ReturnCause } from '../../domain/types'
import type { StoredAction } from '../actions/action-workflow'
import { isIssueAnalysisComplete } from '../tasks/analysis-eligibility'
import type { AnalysisTask } from '../tasks/analysis-task'

export type RiskPoint = {
  issueId: string
  sku: string
  returnRate: number
  grossMarginContribution: number
  directLoss: number
  level: 'high' | 'medium' | 'normal'
}

export type ReasonLoss = { cause: ReturnCause; directLoss: number; share: number }

export type DashboardViewModel = {
  actionableIssues: Issue[]
  recoverable: { low: number; high: number }
  directLoss: number
  priorityCount: number
  reviewedCount: number
  totalIssueCount: number
  coverage: number
  riskPoints: RiskPoint[]
  matrixUnavailableCount: number
  reasonLosses: ReasonLoss[]
  actionQueue: StoredAction[]
}

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : 0
}

export function buildDashboardViewModel(
  issues: Issue[], task: AnalysisTask | null, actions: StoredAction[],
): DashboardViewModel {
  const actionByIssue = new Map(actions.map((record) => [record.current.issueId, record]))
  const actionableIssues = issues
    .filter((issue) => task === null || isIssueAnalysisComplete(issue.id, task))
    .filter((issue) => ['pending', 'confirmed', 'corrected'].includes(issue.status))
    .filter((issue) => actionByIssue.get(issue.id)?.current.status !== 'verified')
    .sort((left, right) => right.recoverableHigh - left.recoverableHigh || right.directLoss - left.directLoss)

  const matrixIssues = actionableIssues.filter((issue) =>
    Number.isFinite(issue.returnRate) && Number.isFinite(issue.grossMarginContribution),
  )
  const xMedian = median(matrixIssues.map((issue) => issue.returnRate!))
  const yMedian = median(matrixIssues.map((issue) => issue.grossMarginContribution!))
  const riskPoints = matrixIssues.map((issue): RiskPoint => {
    const highX = issue.returnRate! >= xMedian
    const highY = issue.grossMarginContribution! >= yMedian
    return {
      issueId: issue.id, sku: issue.sku, returnRate: issue.returnRate!,
      grossMarginContribution: issue.grossMarginContribution!, directLoss: issue.directLoss,
      level: highX && highY ? 'high' : highX || highY ? 'medium' : 'normal',
    }
  })

  const lossByCause = new Map<ReturnCause, number>()
  for (const issue of actionableIssues) {
    lossByCause.set(issue.primaryCause, (lossByCause.get(issue.primaryCause) ?? 0) + issue.directLoss)
  }
  const totalCauseLoss = [...lossByCause.values()].reduce((sum, value) => sum + value, 0)
  const reasonLosses = [...lossByCause.entries()]
    .map(([cause, directLoss]) => ({ cause, directLoss, share: totalCauseLoss ? directLoss / totalCauseLoss : 0 }))
    .sort((left, right) => right.directLoss - left.directLoss)

  const issueById = new Map(issues.map((issue) => [issue.id, issue]))
  const actionQueue = actions
    .filter((record) => ['todo', 'doing', 'verify'].includes(record.current.status))
    .sort((left, right) => (issueById.get(right.current.issueId)?.recoverableHigh ?? 0) - (issueById.get(left.current.issueId)?.recoverableHigh ?? 0))
    .slice(0, 5)

  return {
    actionableIssues,
    recoverable: {
      low: actionableIssues.reduce((sum, issue) => sum + issue.recoverableLow, 0),
      high: actionableIssues.reduce((sum, issue) => sum + issue.recoverableHigh, 0),
    },
    directLoss: actionableIssues.reduce((sum, issue) => sum + issue.directLoss, 0),
    priorityCount: actionableIssues.length,
    reviewedCount: issues.filter((issue) => ['confirmed', 'corrected'].includes(issue.status)).length,
    totalIssueCount: issues.length,
    coverage: task?.total ? Math.round(task.processed / task.total * 100) : issues.length ? 100 : 0,
    riskPoints,
    matrixUnavailableCount: actionableIssues.length - matrixIssues.length,
    reasonLosses,
    actionQueue,
  }
}

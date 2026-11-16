import type { Dataset, Issue } from '../../domain/types'
import type { AnalysisBatch } from './analysis-task'

export function buildAnalysisBatches(dataset: Dataset, issues: Issue[], batchSize = 30): AnalysisBatch[] {
  const issueBySku = new Map(issues.map((issue) => [issue.sku, issue.id]))
  const skuByOrderId = new Map(dataset.orders.map((order) => [order.orderId, order.sku]))
  const issueIds = dataset.returns.map((returned) => {
    const issueId = issueBySku.get(skuByOrderId.get(returned.orderId) ?? '')
    return issueId
  })
  const remaining = new Map<string, number>()
  issueIds.forEach((issueId) => { if (issueId) remaining.set(issueId, (remaining.get(issueId) ?? 0) + 1) })
  const batches: AnalysisBatch[] = []
  for (let start = 0; start < issueIds.length; start += batchSize) {
    const batchIds = issueIds.slice(start, start + batchSize)
    const completedIssueIds = batchIds.flatMap((issueId) => {
      if (!issueId) return []
      const left = (remaining.get(issueId) ?? 1) - 1
      remaining.set(issueId, left)
      return left === 0 ? [issueId] : []
    })
    batches.push({ rows: batchIds.length, sourceRows: batchIds.map((issueId) => issueId ? { issueId } : {}), completedIssueIds })
  }
  return batches
}

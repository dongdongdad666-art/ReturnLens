import type { Dataset, Issue, TextEvidence } from '../../domain/types'

export type SessionEvidence = Pick<TextEvidence, 'id' | 'source' | 'text'>
export type IssueSessionContext = Record<string, { channels: string[]; evidence: SessionEvidence[] }>

let context: IssueSessionContext = {}

export function setIssueSessionContext(next: IssueSessionContext) { context = next }
export function getIssueSessionContext() { return context }

export function buildIssueSessionContext(issues: Issue[], dataset: Dataset): IssueSessionContext {
  const orders = new Map(dataset.orders.map((order) => [order.orderId, order]))
  const evidence = new Map(dataset.evidence.map((item) => [item.id, item]))
  return Object.fromEntries(issues.map((issue) => {
    const channels = [...new Set(dataset.returns.flatMap((returned) => {
      const order = orders.get(returned.orderId)
      return order?.sku === issue.sku && order.channel ? [order.channel] : []
    }))].sort()
    return [issue.id, { channels, evidence: issue.evidenceIds.flatMap((id) => evidence.get(id) ? [evidence.get(id)!] : []) }]
  }))
}

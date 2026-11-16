import { expect, test } from 'vitest'
import { buildAnalysisBatches } from './analysis-progress'
import type { Dataset, Issue } from '../../domain/types'

const issues = [
  { id: 'I-A', sku: 'A', title: 'A', primaryCause: 'size', secondaryCauses: [], confidence: 60, evidenceIds: [], affectedReturns: 2, directLoss: 0, recoverableLow: 0, recoverableHigh: 0, status: 'pending' },
  { id: 'I-B', sku: 'B', title: 'B', primaryCause: 'size', secondaryCauses: [], confidence: 60, evidenceIds: [], affectedReturns: 1, directLoss: 0, recoverableLow: 0, recoverableHigh: 0, status: 'pending' },
] satisfies Issue[]

const dataset: Dataset = {
  orders: [
    { orderId: 'O1', sku: 'A', productName: '', size: '', color: '', channel: '', salePrice: 0, unitCost: 0, orderedAt: '' },
    { orderId: 'O2', sku: 'B', productName: '', size: '', color: '', channel: '', salePrice: 0, unitCost: 0, orderedAt: '' },
    { orderId: 'O3', sku: 'A', productName: '', size: '', color: '', channel: '', salePrice: 0, unitCost: 0, orderedAt: '' },
  ],
  returns: [
    { returnId: 'R1', orderId: 'O1', reason: '', returnedAt: '', returnShippingCost: 0, inspectionCost: 0, restockCost: 0, residualLoss: 0 },
    { returnId: 'R2', orderId: 'O2', reason: '', returnedAt: '', returnShippingCost: 0, inspectionCost: 0, restockCost: 0, residualLoss: 0 },
    { returnId: 'R3', orderId: 'O3', reason: '', returnedAt: '', returnShippingCost: 0, inspectionCost: 0, restockCost: 0, residualLoss: 0 },
  ],
  evidence: [],
}

test('only completes an issue in the batch containing its final source return', () => {
  expect(buildAnalysisBatches(dataset, issues, 2)).toEqual([
    { rows: 2, sourceRows: [{ issueId: 'I-A' }, { issueId: 'I-B' }], completedIssueIds: ['I-B'] },
    { rows: 1, sourceRows: [{ issueId: 'I-A' }], completedIssueIds: ['I-A'] },
  ])
})

test('keeps an orphan return in its source batch so later issue completion is not shifted earlier', () => {
  const withOrphan: Dataset = { ...dataset, returns: [dataset.returns[0], { ...dataset.returns[1], orderId: 'missing' }, dataset.returns[1]] }
  expect(buildAnalysisBatches(withOrphan, issues, 2)).toEqual([
    { rows: 2, sourceRows: [{ issueId: 'I-A' }, {}], completedIssueIds: ['I-A'] },
    { rows: 1, sourceRows: [{ issueId: 'I-B' }], completedIssueIds: ['I-B'] },
  ])
})

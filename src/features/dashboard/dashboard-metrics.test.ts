import { expect, test } from 'vitest'
import type { ActionStatus, Issue } from '../../domain/types'
import type { StoredAction } from '../actions/action-workflow'
import { buildDashboardViewModel } from './dashboard-metrics'

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'I-1', sku: 'SKU-1', title: '尺码问题', primaryCause: 'size', secondaryCauses: [],
  confidence: 80, evidenceIds: ['E-1'], affectedReturns: 2, directLoss: 1000,
  recoverableLow: 120, recoverableHigh: 280, status: 'pending',
  returnRate: 0.2, grossMarginContribution: 3000, ...overrides,
})

const action = (issueId: string, status: ActionStatus): StoredAction => ({
  current: {
    id: `A-${issueId}`, issueId, version: 1, status, title: '整改', touchpoint: '详情页',
    content: '修改说明', owner: '商品运营', dueDate: '2026-09-30',
    targetMetric: '退货率下降', experimentDays: 14,
  },
  history: [],
})

test('builds trusted KPI totals and excludes verified actions', () => {
  const issues = [issue(), issue({ id: 'I-2', recoverableLow: 50, recoverableHigh: 90 })]
  const model = buildDashboardViewModel(issues, null, [action('I-2', 'verified')])
  expect(model.recoverable).toEqual({ low: 120, high: 280 })
  expect(model.directLoss).toBe(1000)
  expect(model.priorityCount).toBe(1)
})

test('excludes incomplete and non-actionable issues from KPIs and the matrix', () => {
  const task = { status: 'running' as const, processed: 1, total: 3, spent: 0.1, cap: 1, completedIssueIds: ['I-complete'] }
  const model = buildDashboardViewModel([
    issue({ id: 'I-complete', directLoss: 100, recoverableLow: 10, recoverableHigh: 40 }),
    issue({ id: 'I-incomplete', directLoss: 900, recoverableLow: 90, recoverableHigh: 360 }),
    issue({ id: 'I-rejected', status: 'rejected', directLoss: 800, recoverableLow: 80, recoverableHigh: 320 }),
  ], task, [])

  expect(model.actionableIssues.map((item) => item.id)).toEqual(['I-complete'])
  expect(model.recoverable).toEqual({ low: 10, high: 40 })
  expect(model.directLoss).toBe(100)
  expect(model.riskPoints.map((item) => item.issueId)).toEqual(['I-complete'])
})

test('classifies the top-right point as high risk and aggregates cause losses', () => {
  const model = buildDashboardViewModel([
    issue({ id: 'I-low', returnRate: 0.05, grossMarginContribution: 500, directLoss: 100 }),
    issue({ id: 'I-high', returnRate: 0.3, grossMarginContribution: 5000, directLoss: 900 }),
  ], null, [])
  expect(model.riskPoints.find((point) => point.issueId === 'I-high')?.level).toBe('high')
  expect(model.reasonLosses[0]).toMatchObject({ cause: 'size', directLoss: 1000 })
})

test('keeps legacy issues out of the matrix instead of inventing a rate', () => {
  const legacy = issue({ returnRate: undefined, grossMarginContribution: undefined })
  expect(buildDashboardViewModel([legacy], null, []).matrixUnavailableCount).toBe(1)
})

test('treats an explicit null task as legacy data instead of reading stored progress', () => {
  localStorage.setItem('returnlens:derived-state:v1', JSON.stringify({
    task: { status: 'partial', processed: 0, total: 2, completedIssueIds: [] },
  }))

  try {
    expect(buildDashboardViewModel([issue()], null, []).priorityCount).toBe(1)
  } finally {
    localStorage.removeItem('returnlens:derived-state:v1')
  }
})

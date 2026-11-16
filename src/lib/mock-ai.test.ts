import { expect, test } from 'vitest'
import { getMockActionDraft, getMockSummary } from './mock-ai'
import type { Issue } from '../domain/types'

test('returns stable size evidence copy with a simulation label', () => {
  const issue: Pick<Issue, 'id' | 'sku' | 'primaryCause'> = { id: 'I-SKU-123', sku: 'SKU-123', primaryCause: 'size' }
  expect(getMockSummary(issue)).toEqual(getMockSummary(issue))
  expect(getMockSummary(issue).label).toBe('模拟生成')
  expect(getMockSummary(issue).hypothesis).toContain('尺码')
})

test('regenerates a stable changed draft from explicit rejection feedback', () => {
  const issue: Pick<Issue, 'id' | 'primaryCause'> = { id: 'I-SKU-123', primaryCause: 'size' }
  const feedback = '内容不够具体：补充详情页的测量位置'
  const first = getMockActionDraft(issue)
  const rewritten = getMockActionDraft(issue, 2, feedback)
  expect(rewritten).toEqual(getMockActionDraft(issue, 2, feedback))
  expect(rewritten.content).toContain(feedback)
  expect(rewritten.content).not.toBe(first.content)
  expect(rewritten.version).toBe(2)
})

import { expect, test } from 'vitest'
import { reviewIssue } from './issue-review'

test('requires a correction reason when changing the cause', () => {
  expect(() => reviewIssue('pending', { type: 'correct', cause: 'material', reason: '' })).toThrow('请输入修正原因')
})

test('moves a confirmed issue to confirmed', () => {
  expect(reviewIssue('pending', { type: 'confirm' })).toBe('confirmed')
})

test('requires a reason to reject and can move an issue to watching', () => {
  expect(() => reviewIssue('pending', { type: 'reject', reason: ' ' })).toThrow('请输入驳回原因')
  expect(reviewIssue('pending', { type: 'watch' })).toBe('watching')
})

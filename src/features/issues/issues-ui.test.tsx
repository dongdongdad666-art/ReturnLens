import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import type { Issue } from '../../domain/types'
import { saveDerivedState } from '../../lib/storage'
import { IssueDetailPage } from './IssueDetailPage'
import { IssuesPage } from './IssuesPage'
import { setIssueSessionContext } from './issue-session'

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'I-SKU-1', sku: 'SKU-1', title: 'SKU-1 尺码相关退货异常', primaryCause: 'size', secondaryCauses: [], confidence: 70,
  evidenceIds: ['E-1'], affectedReturns: 2, directLoss: 100, recoverableLow: 10, recoverableHigh: 20, status: 'pending', ...overrides,
})

afterEach(() => { localStorage.clear(); setIssueSessionContext({}) })

test('sorts visible issues by recoverable high estimate and direct loss after filtering', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-low', title: '较低收益', recoverableHigh: 100 }),
    issue({ id: 'I-high', title: '较高收益', recoverableHigh: 900 }),
    issue({ id: 'I-tie', title: '同收益较高损失', recoverableHigh: 900, directLoss: 200 }),
    issue({ id: 'I-other', sku: 'OTHER', title: '其他 SKU', recoverableHigh: 1000 }),
  ]))
  render(<MemoryRouter><IssuesPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-1' } })
  const rows = screen.getAllByRole('row').slice(1)
  expect(rows).toHaveLength(3)
  expect(within(rows[0]).getByText('同收益较高损失')).toBeInTheDocument()
  expect(within(rows[1]).getByText('较高收益')).toBeInTheDocument()
  expect(within(rows[2]).getByText('较低收益')).toBeInTheDocument()
  expect(within(rows[0]).getByRole('meter', { name: 'AI 归因置信度' })).toHaveAttribute('value', '70')
  expect(JSON.parse(localStorage.getItem('returnlens:issues')!)[0].id).toBe('I-low')
})

test('exposes confidence as a labeled meter and keeps evidence before review controls', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue({ confidence: 72 })]))
  render(<MemoryRouter initialEntries={['/issues/I-SKU-1#evidence']}><Routes>
    <Route path="/issues/:issueId" element={<IssueDetailPage />} />
  </Routes></MemoryRouter>)
  expect(screen.getByRole('meter', { name: 'AI 归因置信度' })).toHaveAttribute('aria-valuenow', '72')
  const evidence = screen.getByRole('heading', { name: '脱敏证据摘录' })
  const review = screen.getByRole('heading', { name: '人工复核' })
  expect(evidence.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(evidence.closest('article')).toHaveAttribute('id', 'evidence')
  expect(within(screen.getByRole('complementary', { name: '问题复核' })).getByRole('heading', { name: '人工复核' })).toBe(review)
})

test('filters issues by a real derived channel and avoids NaN coverage for zero returns', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue({ affectedReturns: 0 }), issue({ id: 'I-SKU-2', sku: 'SKU-2', title: 'SKU-2 尺码相关退货异常', affectedReturns: 0, evidenceIds: [] })]))
  setIssueSessionContext({ 'I-SKU-1': { channels: ['抖音'], evidence: [] }, 'I-SKU-2': { channels: ['淘宝'], evidence: [] } })
  render(<MemoryRouter><IssuesPage /></MemoryRouter>)
  expect(screen.getByRole('option', { name: '抖音' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('渠道'), { target: { value: '淘宝' } })
  expect(screen.getByText('SKU-2 尺码相关退货异常')).toBeInTheDocument()
  expect(screen.queryByText('SKU-1 尺码相关退货异常')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).not.toHaveTextContent('NaN')
})

test('renders session-only masked evidence and honestly reports missing evidence after refresh', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue()]))
  setIssueSessionContext({ 'I-SKU-1': { channels: ['抖音'], evidence: [{ id: 'E-1', source: 'review', text: '张** 138****5678 尺码偏小' }] } })
  const page = () => <MemoryRouter initialEntries={['/issues/I-SKU-1']}><Routes><Route path="/issues/:issueId" element={<IssueDetailPage />} /></Routes></MemoryRouter>
  const { unmount } = render(page())
  expect(screen.getByText('张** 138****5678 尺码偏小')).toBeInTheDocument()
  expect(screen.getAllByText('模拟生成').length).toBeGreaterThan(0)
  unmount()
  setIssueSessionContext({})
  render(page())
  expect(screen.getByText('证据摘录仅在本次浏览器会话可用，刷新后请重新导入数据查看。')).toBeInTheDocument()
})

test('blocks review actions when an issue has no evidence', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue({ evidenceIds: [] })]))
  render(<MemoryRouter initialEntries={['/issues/I-SKU-1']}><Routes><Route path="/issues/:issueId" element={<IssueDetailPage />} /></Routes></MemoryRouter>)
  expect(screen.getByRole('button', { name: '确认问题' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '生成整改方案' })).toBeDisabled()
})

test('renders only batch-proven completed conclusions and keeps 0% results anonymous', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue({ affectedReturns: 4 }), issue({ id: 'I-SKU-2', sku: 'SKU-2', title: 'SKU-2 尺码相关退货异常', affectedReturns: 3 })]))
  saveDerivedState({ issues: [], task: { status: 'partial', processed: 0, total: 7, spent: 0, cap: 0.6, completedIssueIds: [] } })
  render(<MemoryRouter initialEntries={['/issues?coverage=0']}><IssuesPage /></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('分析覆盖率 0%')
  expect(screen.queryByText('SKU-1 尺码相关退货异常')).not.toBeInTheDocument()
  expect(screen.queryByText('已结束分析，正在查看部分结果。')).not.toBeInTheDocument()
  expect(screen.getAllByText('待分析').length).toBeGreaterThan(0)
})

test('uses persisted batch completion metadata for intermediate partial results and only toasts on transition', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue({ affectedReturns: 4 }), issue({ id: 'I-SKU-2', sku: 'SKU-2', title: 'SKU-2 尺码相关退货异常', affectedReturns: 3 })]))
  saveDerivedState({ issues: [], task: { status: 'partial', processed: 4, total: 7, spent: 0.24, cap: 0.6, completedIssueIds: ['I-SKU-1'] } })
  render(<MemoryRouter initialEntries={[{ pathname: '/issues', search: '?coverage=57', state: { toast: '已结束分析，正在查看部分结果。' } }]}><IssuesPage /></MemoryRouter>)
  expect(screen.getByText('SKU-1 尺码相关退货异常')).toBeInTheDocument()
  expect(screen.queryByText('SKU-2 尺码相关退货异常')).not.toBeInTheDocument()
  expect(screen.getByText('已结束分析，正在查看部分结果。')).toBeInTheDocument()
})

function LocationState() {
  return <output data-testid="location-state">{JSON.stringify(useLocation().state)}</output>
}

test('consumes toast navigation state while retaining the coverage query', async () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([]))
  render(<MemoryRouter initialEntries={[{ pathname: '/issues', search: '?coverage=0', state: { toast: '已结束分析，正在查看部分结果。' } }]}><IssuesPage /><LocationState /></MemoryRouter>)
  expect(screen.getByText('已结束分析，正在查看部分结果。')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('location-state')).toHaveTextContent('null'))
  expect(screen.getByText(/分析覆盖率 0%/)).toBeInTheDocument()
})

test('keeps 300 of 301 records partial even when rounded coverage would be 100%', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue()]))
  saveDerivedState({ issues: [], task: { status: 'partial', processed: 300, total: 301, spent: 0.6, cap: 0.6, completedIssueIds: ['I-SKU-1'] } })
  render(<MemoryRouter initialEntries={['/issues?coverage=100']}><IssuesPage /></MemoryRouter>)
  expect(screen.getByText(/分析覆盖率 99%/)).toBeInTheDocument()
  expect(screen.getByLabelText('部分问题结果')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('shows an anonymous pending record for an unprocessed orphan row', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue()]))
  saveDerivedState({ issues: [], task: { status: 'partial', processed: 1, total: 2, spent: 0.24, cap: 0.6, completedIssueIds: ['I-SKU-1'] } })
  render(<MemoryRouter initialEntries={['/issues?coverage=50']}><IssuesPage /></MemoryRouter>)
  expect(within(screen.getByLabelText('待分析记录')).getByText('待分析', { selector: 'li' })).toBeInTheDocument()
})

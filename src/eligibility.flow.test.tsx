import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { App } from './app/App'
import type { Issue } from './domain/types'
import { setIssueSessionContext } from './features/issues/issue-session'

const issues: Issue[] = [
  { id: 'I-A', sku: 'A', title: '已完成问题', primaryCause: 'size', secondaryCauses: [], confidence: 70, evidenceIds: ['E1'], affectedReturns: 1, directLoss: 100, recoverableLow: 10, recoverableHigh: 20, status: 'confirmed' },
  { id: 'I-B', sku: 'B', title: '未完成的机密结论', primaryCause: 'size', secondaryCauses: [], confidence: 95, evidenceIds: ['E2'], affectedReturns: 1, directLoss: 9999, recoverableLow: 1000, recoverableHigh: 2000, status: 'confirmed' },
]
afterEach(() => { localStorage.clear(); setIssueSessionContext({}) })

test.each(['idle', 'partial'])('uses identical eligibility on overview, issue list and direct URLs at %s progress', async (status) => {
  localStorage.setItem('returnlens:issues', JSON.stringify(issues))
  localStorage.setItem('returnlens:derived-state:v1', JSON.stringify({ task: { status, processed: status === 'idle' ? 0 : 1, total: 2, completedIssueIds: status === 'idle' ? [] : ['I-A'] } }))
  setIssueSessionContext({ 'I-A': { channels: [], evidence: [{ id: 'E1', source: 'review', text: '偏小' }] }, 'I-B': { channels: [], evidence: [{ id: 'E2', source: 'review', text: '未完成的证据原文' }] } })
  const overview = render(<MemoryRouter><App /></MemoryRouter>)
  expect(screen.queryByText('未完成的机密结论')).not.toBeInTheDocument()
  expect(screen.getByText(status === 'idle' ? '¥0–¥0' : '¥10–¥20', { selector: 'strong' })).toBeInTheDocument()
  if (status === 'idle') expect(screen.queryByRole('link', { name: /查看证据并生成整改方案/ })).not.toBeInTheDocument()
  else {
    expect(screen.getByRole('link', { name: /查看证据并生成整改方案/ })).toHaveAttribute('href', '/issues/I-A#evidence')
    expect(screen.getByText(/预算未记录/)).toBeInTheDocument()
  }
  fireEvent.click(screen.getByRole('link', { name: '问题中心' }))
  await screen.findByRole('heading', { name: '优先处理可挽回损失' })
  expect(screen.queryByText('未完成的机密结论')).not.toBeInTheDocument()
  overview.unmount()
  render(<MemoryRouter initialEntries={['/issues/I-B']}><App /></MemoryRouter>)
  expect(await screen.findByText(/分析尚未完成/)).toBeInTheDocument()
  expect(screen.queryByText('未完成的机密结论')).not.toBeInTheDocument()
  expect(screen.queryByText('未完成的证据原文')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '生成整改方案' })).not.toBeInTheDocument()
})

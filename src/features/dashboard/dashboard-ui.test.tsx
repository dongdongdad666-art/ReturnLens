import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { Sparkline } from '../../components/Sparkline'
import type { ActionDraft, Issue } from '../../domain/types'
import { DashboardPage } from './DashboardPage'
import { ExperimentsPage } from '../experiments/ExperimentsPage'
import type { AnalysisStatus, AnalysisTask } from '../tasks/analysis-task'

const issue = (overrides: Partial<Issue>): Issue => ({
  id: 'I-pending', sku: 'SKU-1', title: '待处理尺码问题', primaryCause: 'size', secondaryCauses: [], confidence: 80,
  evidenceIds: ['E-1'], affectedReturns: 4, directLoss: 1000, recoverableLow: 120, recoverableHigh: 280, status: 'pending', ...overrides,
})

const verifiedDraft: ActionDraft = {
  id: 'A-verified', issueId: 'I-verified', version: 1, status: 'verified', title: '已完成整改', touchpoint: '详情页', content: '完成', owner: '陈晨', dueDate: '2026-09-30', targetMetric: '退货率下降', experimentDays: 14,
}

afterEach(() => localStorage.clear())

test('renders every simulated experiment state with labeled low, base, and high loss values', () => {
  render(<ExperimentsPage />)

  const cases: Array<[string, string[]]> = [
    ['尺码说明补充', ['低 ¥1,480', '基准 ¥2,470', '高 ¥3,460']],
    ['面料信息补充', ['低 ¥520', '基准 ¥850', '高 ¥1,180']],
    ['自然光颜色展示', ['低 ¥90', '基准 ¥205', '高 ¥320']],
  ]
  for (const [title, lossValues] of cases) {
    const card = screen.getByRole('heading', { name: title }).closest('article')!
    expect(within(card).getByText('模拟实验数据')).toBeInTheDocument()
    for (const lossValue of lossValues) expect(within(card).getByText(lossValue)).toBeInTheDocument()
  }
  expect(screen.getByText('有效')).toBeInTheDocument()
  expect(screen.getByText('无显著变化')).toBeInTheDocument()
  expect(screen.getByText('证据不足')).toBeInTheDocument()
  expect(screen.getByText(/相对下降 18.3%，超过 15% 目标/)).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: /基线退货率.*当前退货率/ })).toHaveLength(3)
  expect(screen.getByText('样本不足，延长观察后再判断')).toBeInTheDocument()
})

test('briefs only actionable issues and excludes rejected, watched, and verified issues', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-rejected', title: '已驳回问题', recoverableHigh: 900, status: 'rejected' }),
    issue({ id: 'I-watching', title: '观察中问题', recoverableHigh: 800, status: 'watching' }),
    issue({ id: 'I-verified', title: '已验证问题', recoverableHigh: 700, status: 'confirmed' }),
    issue({ id: 'I-pending', title: '待处理尺码问题', recoverableHigh: 280, status: 'pending' }),
  ]))
  localStorage.setItem('returnlens:actions', JSON.stringify({ 'I-verified': { current: verifiedDraft, history: [] } }))

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getByText('1 个')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '待处理尺码问题' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /查看证据并生成整改方案/ })).toHaveAttribute('href', '/issues/I-pending#evidence')
  expect(screen.queryByText('已驳回问题')).not.toBeInTheDocument()
  expect(screen.queryByText('观察中问题')).not.toBeInTheDocument()
  expect(screen.queryByText('已验证问题')).not.toBeInTheDocument()
})

test('treats a confirmed issue without an action as the highest actionable priority', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-confirmed', title: '已确认尺码问题', recoverableHigh: 360, status: 'confirmed' }),
  ]))

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getByText('1 个')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '已确认尺码问题' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /查看证据并生成整改方案/ })).toHaveAttribute('href', '/issues/I-confirmed#evidence')
})

test('keeps coverage at 100% when analyzed issues are no longer actionable', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-rejected', title: '已驳回问题', status: 'rejected' }),
    issue({ id: 'I-watching', title: '观察中问题', status: 'watching' }),
  ]))

  render(<MemoryRouter><DashboardPage /></MemoryRouter>)

  expect(screen.getByText('100%')).toBeInTheDocument()
  expect(screen.getByText('暂无可排序的问题')).toBeInTheDocument()
  expect(within(screen.getByRole('complementary', { name: 'AI 风险简报' })).getByRole('link', { name: '查看问题复核状态' })).toHaveAttribute('href', '/issues')
})

test('renders one recoverable-loss hero and an evidence-backed brief for the top actionable issue', async () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-top', title: '高风险尺码问题', recoverableLow: 120, recoverableHigh: 320,
      returnRate: .25, grossMarginContribution: 4000, status: 'confirmed' }),
  ]))
  localStorage.setItem('returnlens:derived-state:v1', JSON.stringify({ task: {
    status: 'complete', processed: 1, total: 1, spent: .2, cap: .6, completedIssueIds: ['I-top'],
  } }))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText('¥120–¥320')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '高风险尺码问题' })).toBeInTheDocument()
  expect(screen.getByText('80%')).toBeInTheDocument()
  expect(screen.getByText('4 笔相关退货')).toBeInTheDocument()
  expect(screen.getByText('1 条证据')).toBeInTheDocument()
  expect(screen.getByText('尺码表可能低估 M/L 码的实际穿着空间')).toBeInTheDocument()
  expect(screen.getByText('复测实物尺寸，并验证详情页尺码说明')).toBeInTheDocument()
  expect(screen.getByText('置信度表示证据充分程度，不代表因果确定性')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /查看证据并生成整改方案/ })).toHaveAttribute('href', '/issues/I-top#evidence')
  expect(await screen.findByRole('heading', { name: '商品风险矩阵' })).toBeInTheDocument()
  expect(screen.getByText('模拟时间序列')).toBeInTheDocument()
})

test.each([
  ['paused_budget', '预算已暂停'],
  ['paused_error', '模型响应超时'],
  ['partial', '部分结果'],
])('keeps trusted KPI data visible in %s state', (status, message) => {
  const storedIssue = issue({ id: 'I-top', recoverableLow: 120, recoverableHigh: 320,
    returnRate: .25, grossMarginContribution: 4000 })
  const unfinishedIssue = issue({ id: 'I-next', title: '未完成分析的问题', recoverableHigh: 900 })
  const task: AnalysisTask = {
    status: status as AnalysisStatus, processed: 1, total: 2, spent: .2, cap: .6,
    batches: [], completedIssueIds: ['I-top'],
  }
  localStorage.setItem('returnlens:issues', JSON.stringify([storedIssue, unfinishedIssue]))
  localStorage.setItem('returnlens:derived-state:v1', JSON.stringify({
    issues: [storedIssue, unfinishedIssue], task, prices: { inputPerMillion: .5, outputPerMillion: 1.5 },
  }))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText(message)).toBeInTheDocument()
  expect(screen.getByText('¥120–¥320')).toBeInTheDocument()
  expect(screen.getByText('50%')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '未完成分析的问题' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '查看分析进度与预算' })).toHaveAttribute('href', '/import')
})

test('shows import guidance when there is no analysis data', () => {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByRole('link', { name: '导入数据开始分析' })).toHaveAttribute('href', '/import')
})

test('shows active actions with their owner, due date, estimate, and focused board link', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-first', recoverableHigh: 420 }), issue({ id: 'I-second', recoverableHigh: 280 }),
  ]))
  localStorage.setItem('returnlens:actions', JSON.stringify({
    'I-second': { current: { ...verifiedDraft, id: 'A-second', issueId: 'I-second', title: '面料复核', status: 'doing', owner: '商品团队' }, history: [] },
    'I-first': { current: { ...verifiedDraft, id: 'A-first', issueId: 'I-first', title: '尺码复测', status: 'todo', owner: '商品运营' }, history: [] },
    'I-verified': { current: verifiedDraft, history: [] },
  }))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  const queue = screen.getByRole('region', { name: '行动队列' })
  const links = within(queue).getAllByRole('link', { name: /尺码复测|面料复核/ })
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/actions?focus=A-first', '/actions?focus=A-second'])
  expect(within(queue).getByText('商品运营')).toBeInTheDocument()
  expect(within(queue).getAllByText('2026-09-30')).toHaveLength(2)
  expect(within(queue).getByText('¥120–¥420')).toBeInTheDocument()
  expect(within(queue).queryByText('已完成整改')).not.toBeInTheDocument()
})

test('explains the estimated conversion from direct loss to avoidable loss', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-ratio', directLoss: 1000, recoverableLow: 140, recoverableHigh: 330 }),
  ]))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText('按证据置信度与措施有效率估算，约 14%–33% 可避免')).toBeInTheDocument()
})

test('does not invent an avoidable ratio when direct loss is zero', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-zero', directLoss: 0, recoverableLow: 0, recoverableHigh: 0 }),
  ]))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText('暂无可计算的可避免比例')).toBeInTheDocument()
})

test('routes an empty action queue to the current actionable issues', () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([
    issue({ id: 'I-1' }), issue({ id: 'I-2', sku: 'SKU-2' }),
  ]))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByRole('link', {
    name: '当前无整改行动。去问题中心复核 2 个高优先级问题，生成整改方案 →',
  })).toHaveAttribute('href', '/issues')
})

test('keeps the action-empty state neutral when no actionable issue exists', () => {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText('暂无待执行、执行中或待验证的行动。')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '查看问题复核状态' })).toHaveAttribute('href', '/issues')
})

test('renders empty and singleton sparklines without NaN coordinates', () => {
  const { rerender } = render(<Sparkline values={[]} label="空趋势" />)
  expect(screen.getByRole('img', { name: '空趋势' }).innerHTML).not.toContain('NaN')

  rerender(<Sparkline values={[12]} label="单点趋势" />)
  const line = screen.getByRole('img', { name: '单点趋势' }).querySelector('polyline')
  expect(line).toHaveAttribute('points')
  expect(line?.getAttribute('points')).not.toContain('NaN')
})

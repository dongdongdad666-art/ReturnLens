import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from './app/App'
import type { Issue } from './domain/types'
import { setIssueSessionContext } from './features/issues/issue-session'
import { loadAction } from './features/actions/action-workflow'
import { readFileSync } from 'node:fs'

afterEach(() => { localStorage.clear(); setIssueSessionContext({}) })

test.each([
  ['--warning', '#a36b08'],
  ['--danger', '#bc3b32'],
])('publishes the approved %s status color to the app', (token, color) => {
  render(<style>{readFileSync('src/styles/tokens.css', 'utf8')}</style>)
  expect(getComputedStyle(document.documentElement).getPropertyValue(token).trim()).toBe(color)
})

function seedReview() {
  const issue: Issue = { id: 'I-SKU-123', sku: 'SKU-123', title: 'SKU-123 尺码相关退货异常', primaryCause: 'size', secondaryCauses: [], confidence: 70, evidenceIds: ['E1'], affectedReturns: 2, directLoss: 100, recoverableLow: 15, recoverableHigh: 35, status: 'pending' }
  localStorage.setItem('returnlens:issues', JSON.stringify([issue]))
  setIssueSessionContext({ [issue.id]: { channels: ['淘宝'], evidence: [{ id: 'E1', source: 'review', text: '尺码偏小，建议补充测量位置' }] } })
}

test('confirms an issue, rejects a draft, regenerates, and publishes it', async () => {
  seedReview()
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/issues/I-SKU-123']}><App /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: '修正' }))
  expect(screen.getByRole('alert')).toHaveTextContent('原因')
  await user.click(screen.getByRole('button', { name: '确认问题' }))
  await user.click(screen.getByRole('button', { name: '生成整改方案' }))
  expect(await screen.findByText('草案待确认')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '驳回并重写' }))
  await user.type(screen.getByLabelText('修改要求'), '指出详情页位置和具体文案')
  await user.click(screen.getByRole('button', { name: '按意见重新生成' }))
  expect(await screen.findByText('版本 2')).toBeInTheDocument()
  expect((screen.getByLabelText('具体内容') as HTMLTextAreaElement).value).toContain('指出详情页位置和具体文案')
  await user.selectOptions(screen.getByLabelText('负责人'), '商品运营')
  await user.type(screen.getByLabelText('截止日期'), '2026-09-30')
  await user.click(screen.getByRole('button', { name: '确认并入看板' }))
  expect(await screen.findByRole('heading', { name: '把已确认问题推进到验证' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('整改动作已加入看板。')
  const card = screen.getByText('商品运营').closest('article')!
  expect(card).toHaveFocus()
  expect(within(card).getByRole('button', { name: '开始执行' })).toBeInTheDocument()
  expect(loadAction('I-SKU-123')?.current).toMatchObject({ version: 2, status: 'todo', owner: '商品运营' })
  expect(loadAction('I-SKU-123')?.history[0].rejectionReason).toContain('指出详情页位置和具体文案')
})

test('clears a failed publication alert after rejecting and regenerating V2', async () => {
  seedReview()
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/issues/I-SKU-123']}><App /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: '确认问题' }))
  await user.click(screen.getByRole('button', { name: '生成整改方案' }))
  await screen.findByLabelText('负责人')
  await user.click(screen.getByRole('button', { name: '确认并入看板' }))
  const drawer = within(screen.getByRole('dialog'))
  expect(drawer.getByRole('alert')).toHaveTextContent('请补全负责人、截止日期和目标指标')
  await user.click(drawer.getByRole('button', { name: '驳回并重写' }))
  await user.type(drawer.getByLabelText('修改要求'), '补充详情页位置')
  await user.click(drawer.getByRole('button', { name: '按意见重新生成' }))
  expect(await drawer.findByText('版本 2')).toBeInTheDocument()
  expect(drawer.queryByRole('alert')).not.toBeInTheDocument()
  expect(drawer.queryByText('请补全负责人、截止日期和目标指标')).not.toBeInTheDocument()
})

test('announces a blocking draft error and restores keyboard focus on Escape', async () => {
  seedReview()
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/issues/I-SKU-123']}><App /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: '确认问题' }))
  const trigger = screen.getByRole('button', { name: '生成整改方案' })
  await user.click(trigger)
  await screen.findByLabelText('负责人')
  await user.click(screen.getByRole('button', { name: '确认并入看板' }))
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('负责人')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('renders the four primary navigation destinations and overview heading', () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(screen.getByRole('link', { name: '经营总览' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '问题中心' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '整改看板' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '实验复盘' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '经营总览' })).toBeInTheDocument()
})

test('keeps the approved navigation structure and exposes its two groups', () => {
  render(<MemoryRouter initialEntries={['/issues']}><App /></MemoryRouter>)
  const nav = screen.getByRole('navigation', { name: '主导航' })
  expect(within(nav).getByRole('link', { name: '问题中心' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '数据与设置' })).toHaveAttribute('href', '/import')
  expect(screen.getByText('经营决策')).toBeInTheDocument()
  expect(screen.getByText('系统')).toBeInTheDocument()
})

test('shows recoverable loss as a range and labels experiment data as simulated', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
  expect(await screen.findByText('可避免损失')).toBeInTheDocument()
  expect(screen.getByText(/预计范围/)).toBeInTheDocument()

  render(<MemoryRouter initialEntries={['/experiments']}><App /></MemoryRouter>)
  expect((await screen.findAllByText('模拟实验数据')).length).toBeGreaterThan(0)
})

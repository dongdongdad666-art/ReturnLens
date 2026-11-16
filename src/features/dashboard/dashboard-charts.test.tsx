import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RiskMatrix } from './RiskMatrix'
import { LossReasonBars } from './LossReasonBars'
import { LossTrendChart } from './LossTrendChart'
import type { RiskPoint } from './dashboard-metrics'
import userEvent from '@testing-library/user-event'

// jsdom has no layout; keep real Recharts and supply only its measured viewport.
beforeEach(() => {
  const measure = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.classList.contains('recharts-responsive-container')) return measure.call(this)
    return { width: 720, height: 320, x: 0, y: 0, top: 0, left: 0, right: 720, bottom: 320, toJSON: () => ({}) }
  })
})
afterEach(() => vi.restoreAllMocks())

test('offers a keyboard-reachable detail link for every risk point', () => {
  render(<MemoryRouter initialEntries={['/']}><Routes>
    <Route path="/" element={<RiskMatrix points={[{
      issueId: 'I-SKU-123', sku: 'SKU-123', returnRate: .24,
      grossMarginContribution: 4800, directLoss: 1200, level: 'high',
    }]} unavailableCount={0} />} />
    <Route path="/issues/:issueId" element={<p>问题详情已打开</p>} />
  </Routes></MemoryRouter>)
  const link = screen.getByRole('link', { name: /SKU-123.*退货率 24%.*直接损失 ¥1,200/ })
  expect(link).toHaveAttribute('tabindex', '0')
  expect(link).toHaveAccessibleName(/订单毛利贡献估算 ¥4,800/)
  act(() => link.focus())
  expect(link).toHaveFocus()
  fireEvent.keyDown(link, { key: 'Enter' })
  expect(screen.getByText('问题详情已打开')).toBeInTheDocument()
})

test('shows a reanalysis action instead of fabricated coordinates', () => {
  render(<MemoryRouter><RiskMatrix points={[]} unavailableCount={2} /></MemoryRouter>)
  expect(screen.getByText('重新分析后可查看商品风险矩阵')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '重新分析数据' })).toHaveAttribute('href', '/import')
})

test.each(['SKU-447', 'SKU-522'])('offers a visible native link to overlapping %s without moving its bubble', async (sku) => {
  const user = userEvent.setup()
  const points: RiskPoint[] = ['SKU-447', 'SKU-522'].map((sku) => ({
    issueId: `I-${sku}`, sku, returnRate: 14 / 150, grossMarginContribution: 16350, directLoss: 1848, level: 'medium',
  }))
  const { container } = render(<MemoryRouter><Routes>
    <Route path="/" element={<RiskMatrix points={points} unavailableCount={0} />} />
    <Route path={`/issues/I-${sku}`} element={<p>{sku} 问题详情已打开</p>} />
  </Routes></MemoryRouter>)
  const bubbles = [...container.querySelectorAll('.risk-bubble-point')]
  expect(bubbles).toHaveLength(2)
  expect(bubbles[0].getAttribute('cx')).toBe(bubbles[1].getAttribute('cx'))
  expect(bubbles[0].getAttribute('cy')).toBe(bubbles[1].getAttribute('cy'))
  expect(container.querySelectorAll('.risk-bubble text')).toHaveLength(1)
  expect(screen.getByText('2 个商品 · ¥1,848/个')).toBeVisible()
  expect(screen.getByText(/同坐标商品/)).toBeVisible()
  const links = ['SKU-447', 'SKU-522'].map((name) => screen.getByRole('link', { name }))
  for (const [index, link] of links.entries()) {
    expect(link.tagName).toBe('A')
    expect(link).toBeVisible()
    expect(link).toHaveAttribute('href', `/issues/I-${points[index].sku}`)
  }
  // Native anchors remain in the Tab order as well as providing separate mouse targets.
  act(() => links[0].focus())
  await user.tab()
  expect(links[1]).toHaveFocus()
  if (sku === 'SKU-522') await user.keyboard('{Enter}')
  else await user.click(links[0])
  expect(screen.getByText(`${sku} 问题详情已打开`)).toBeInTheDocument()
})

test('shows the focused bubble data then restores hovered data after blur', async () => {
  render(<MemoryRouter><RiskMatrix points={[
    { issueId: 'I-A', sku: 'SKU-A', returnRate: .1, grossMarginContribution: 100, directLoss: 10, level: 'normal' },
    { issueId: 'I-B', sku: 'SKU-B', returnRate: .2, grossMarginContribution: 200, directLoss: 40, level: 'high' },
  ]} unavailableCount={0} /></MemoryRouter>)
  const secondBubble = screen.getByRole('link', { name: /SKU-B/ })
  act(() => secondBubble.focus())
  expect(await screen.findByText('退货率 20%')).toBeVisible()
  expect(screen.getByRole('link', { name: /SKU-B/ })).toHaveFocus()
  expect(screen.getByText('订单毛利贡献估算 ¥200')).toBeVisible()
  expect(screen.getByText('直接损失 ¥40')).toBeVisible()
  expect(screen.queryByText('退货率 10%')).not.toBeInTheDocument()

  act(() => secondBubble.blur())
  fireEvent.mouseEnter(screen.getByRole('link', { name: /SKU-A/ }))
  expect(await screen.findByText('退货率 10%')).toBeVisible()
  expect(screen.getByText('直接损失 ¥10')).toBeVisible()
  expect(screen.queryByText('退货率 20%')).not.toBeInTheDocument()
})

test('explains reanalysis availability alongside valid matrix points', () => {
  render(<MemoryRouter><RiskMatrix points={[
    { issueId: 'I-A', sku: 'SKU-A', returnRate: .1, grossMarginContribution: 100, directLoss: 10, level: 'normal' },
  ]} unavailableCount={1} /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /SKU-A/ })).toBeInTheDocument()
  expect(screen.getByText(/1 个商品缺少矩阵数据，重新分析后可查看/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '重新分析数据' })).toHaveAttribute('href', '/import')
})

test('keeps all bubbles reachable while direct-labeling only the three largest losses', () => {
  const points: RiskPoint[] = [
    { issueId: 'I-A', sku: 'SKU-A', returnRate: .1, grossMarginContribution: 100, directLoss: 10, level: 'normal' },
    { issueId: 'I-B', sku: 'SKU-B', returnRate: .2, grossMarginContribution: 200, directLoss: 40, level: 'high' },
    { issueId: 'I-C', sku: 'SKU-C', returnRate: .3, grossMarginContribution: 300, directLoss: 30, level: 'medium' },
    { issueId: 'I-D', sku: 'SKU-D', returnRate: .4, grossMarginContribution: 400, directLoss: 20, level: 'high' },
  ]
  render(<MemoryRouter><Routes>
    <Route path="/" element={<RiskMatrix points={points} unavailableCount={0} />} />
    <Route path="/issues/I-A" element={<p>小额损失问题已打开</p>} />
  </Routes></MemoryRouter>)
  expect(screen.getAllByRole('link')).toHaveLength(4)
  expect(screen.queryByText('SKU-A · ¥10')).not.toBeInTheDocument()
  for (const label of ['SKU-B · ¥40', 'SKU-C · ¥30', 'SKU-D · ¥20']) expect(screen.getByText(label)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: /SKU-A/ }))
  expect(screen.getByText('小额损失问题已打开')).toBeInTheDocument()
})

test('adds a quiet grid and direct-loss values to the three coordinate labels', () => {
  const points: RiskPoint[] = [
    { issueId: 'I-A', sku: 'SKU-A', returnRate: .1, grossMarginContribution: 100, directLoss: 1000, level: 'normal' },
    { issueId: 'I-B', sku: 'SKU-B', returnRate: .2, grossMarginContribution: 200, directLoss: 900, level: 'high' },
    { issueId: 'I-C', sku: 'SKU-C', returnRate: .3, grossMarginContribution: 300, directLoss: 800, level: 'medium' },
    { issueId: 'I-D', sku: 'SKU-D', returnRate: .4, grossMarginContribution: 400, directLoss: 100, level: 'normal' },
  ]
  const { container } = render(<MemoryRouter><RiskMatrix points={points} unavailableCount={0} /></MemoryRouter>)
  expect(container.querySelector('.recharts-cartesian-grid')).toBeInTheDocument()
  expect(screen.getByText('SKU-A · ¥1,000')).toBeInTheDocument()
  expect(screen.getByText('SKU-B · ¥900')).toBeInTheDocument()
  expect(screen.getByText('SKU-C · ¥800')).toBeInTheDocument()
  expect(screen.queryByText('SKU-D · ¥100')).not.toBeInTheDocument()
})

test('labels only the three coordinate groups with largest individual losses and shows overlap ranges', () => {
  const points: RiskPoint[] = [
    { issueId: 'I-A1', sku: 'SKU-A1', returnRate: .1, grossMarginContribution: 100, directLoss: 950, level: 'normal' },
    { issueId: 'I-A2', sku: 'SKU-A2', returnRate: .1, grossMarginContribution: 100, directLoss: 1000, level: 'high' },
    { issueId: 'I-B', sku: 'SKU-B', returnRate: .2, grossMarginContribution: 200, directLoss: 900, level: 'high' },
    { issueId: 'I-C1', sku: 'SKU-C1', returnRate: .3, grossMarginContribution: 300, directLoss: 800, level: 'medium' },
    { issueId: 'I-C2', sku: 'SKU-C2', returnRate: .3, grossMarginContribution: 300, directLoss: 10, level: 'normal' },
    { issueId: 'I-D1', sku: 'SKU-D1', returnRate: .4, grossMarginContribution: 400, directLoss: 700, level: 'normal' },
    { issueId: 'I-D2', sku: 'SKU-D2', returnRate: .4, grossMarginContribution: 400, directLoss: 700, level: 'normal' },
  ]
  const { container } = render(<MemoryRouter><RiskMatrix points={points} unavailableCount={0} /></MemoryRouter>)
  expect(container.querySelectorAll('.risk-bubble text')).toHaveLength(3)
  expect(screen.getByText('2 个商品 · ¥950–¥1,000')).toBeVisible()
  expect(screen.getByText('SKU-B · ¥900')).toBeVisible()
  expect(screen.getByText('2 个商品 · ¥10–¥800')).toBeVisible()
  expect(screen.queryByText('2 个商品 · ¥700/个')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'SKU-D1' })).toHaveAttribute('href', '/issues/I-D1')
  expect(screen.getByRole('link', { name: 'SKU-D2' })).toHaveAttribute('href', '/issues/I-D2')
})

test('direct-labels cause bars and labels trend data as simulated', () => {
  render(<><LossReasonBars values={[{ cause: 'size', directLoss: 900, share: .75 }]} />
    <LossTrendChart values={[20, 16, 14]} /></>)
  expect(screen.getByText('尺码')).toBeInTheDocument()
  expect(screen.getByText('¥900')).toBeInTheDocument()
  expect(screen.getByText('模拟时间序列')).toBeInTheDocument()
})

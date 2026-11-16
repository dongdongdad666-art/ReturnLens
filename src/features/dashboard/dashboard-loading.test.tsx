import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const loading = vi.hoisted(() => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  return { pending, release }
})

vi.mock('./DashboardCharts', async (importOriginal) => {
  await loading.pending
  return importOriginal()
})
vi.mock('./LossReasonBars', async (importOriginal) => {
  await loading.pending
  return importOriginal()
})
vi.mock('./LossTrendChart', async (importOriginal) => {
  await loading.pending
  return importOriginal()
})

test('reserves every chart region while keeping metrics and the brief available', async () => {
  const { container } = render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText('可避免损失')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'AI 风险简报' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '正在加载商品风险矩阵' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '正在加载损失原因' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '正在加载损失趋势' })).toBeInTheDocument()
  expect(container.querySelector('.dashboard-reasons-skeleton')).toBeInTheDocument()
  expect(container.querySelector('.dashboard-trend-skeleton')).toBeInTheDocument()
  await act(async () => { loading.release(); await loading.pending })
  expect(await screen.findByRole('heading', { name: '商品风险矩阵' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: '退货原因损失' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: '损失趋势' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: /正在加载/ })).not.toBeInTheDocument()
  expect([...container.querySelectorAll('.dashboard-content-grid h2')].map((heading) => heading.textContent)).toEqual([
    '商品风险矩阵', 'AI 风险简报', '退货原因损失', '损失趋势', '行动队列',
  ])
})

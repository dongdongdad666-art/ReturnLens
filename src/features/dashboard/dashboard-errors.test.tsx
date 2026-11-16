import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const failure = vi.hoisted(() => ({ chart: '' }))

// Fail only the selected chart render; keep its siblings and dashboard real.
vi.mock('./RiskMatrix', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./RiskMatrix')>()
  return { RiskMatrix: (props: Parameters<typeof actual.RiskMatrix>[0]) => {
    if (failure.chart === '商品风险矩阵') throw new Error('matrix render failed')
    return <actual.RiskMatrix {...props} />
  } }
})
vi.mock('./LossReasonBars', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./LossReasonBars')>()
  return { LossReasonBars: (props: Parameters<typeof actual.LossReasonBars>[0]) => {
    if (failure.chart === '退货原因损失') throw new Error('reason render failed')
    return <actual.LossReasonBars {...props} />
  } }
})
vi.mock('./LossTrendChart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./LossTrendChart')>()
  return { LossTrendChart: (props: Parameters<typeof actual.LossTrendChart>[0]) => {
    if (failure.chart === '损失趋势') throw new Error('trend render failed')
    return <actual.LossTrendChart {...props} />
  } }
})

afterEach(() => { failure.chart = ''; vi.restoreAllMocks() })

test.each([
  ['商品风险矩阵', 'dashboard-chart-skeleton'],
  ['退货原因损失', 'dashboard-reasons-skeleton'],
  ['损失趋势', 'dashboard-trend-skeleton'],
])('isolates %s render failure while retaining the dashboard and other charts', async (title, geometry) => {
  failure.chart = title
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  const fallback = await screen.findByRole('alert', { name: `${title}暂不可用` })
  expect(fallback).toHaveClass(geometry)
  expect(within(fallback).getByRole('link', { name: '前往问题中心' })).toHaveAttribute('href', '/issues')
  expect(screen.getByText('¥0–¥0')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'AI 风险简报' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '行动队列' })).toBeInTheDocument()
  for (const other of ['商品风险矩阵', '退货原因损失', '损失趋势'].filter((name) => name !== title)) {
    expect(screen.getByRole('region', { name: other })).toBeInTheDocument()
  }
  expect(screen.getAllByRole('alert')).toHaveLength(1)
})

import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const download = vi.hoisted(() => {
  let reject!: (error: Error) => void
  const pending = new Promise<void>((_resolve, fail) => { reject = fail })
  return { pending, reject }
})

vi.mock('./DashboardCharts', async (importOriginal) => {
  await download.pending
  return importOriginal()
})

afterEach(() => vi.restoreAllMocks())

test('contains a rejected chart module download in eager fallbacks and retains KPI, brief and actions', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByRole('status', { name: '正在加载商品风险矩阵' })).toBeInTheDocument()
  await act(async () => { download.reject(new Error('chart download failed')) })
  const fallback = await screen.findByRole('alert', { name: '商品风险矩阵暂不可用' })
  expect(fallback).toHaveClass('dashboard-chart-skeleton')
  expect(within(fallback).getByRole('link', { name: '前往问题中心' })).toHaveAttribute('href', '/issues')
  expect(await screen.findByRole('region', { name: '退货原因损失' })).toBeInTheDocument()
  expect(await screen.findByRole('region', { name: '损失趋势' })).toBeInTheDocument()
  expect(screen.getByText('¥0–¥0')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'AI 风险简报' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '行动队列' })).toBeInTheDocument()
})

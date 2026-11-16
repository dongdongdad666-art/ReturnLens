import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { App } from './app/App'

const loading = vi.hoisted(() => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  return { pending, release }
})

// Hold only the module download; render the real route after it arrives.
vi.mock('./features/issues/IssuesPage', async (importOriginal) => {
  await loading.pending
  return importOriginal()
})

test('keeps navigation usable while a secondary route is still downloading', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '经营总览' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: '问题中心' }))
  expect(screen.getByRole('status', { name: '正在加载页面' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
  await act(async () => { loading.release(); await loading.pending })
  expect(await screen.findByRole('heading', { name: '优先处理可挽回损失' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '正在加载页面' })).not.toBeInTheDocument()
})

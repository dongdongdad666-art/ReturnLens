import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { ActionDraft, Issue } from '../../domain/types'
import { setIssueSessionContext } from '../issues/issue-session'
import { IssueDetailPage } from '../issues/IssueDetailPage'
import { ActionsPage } from './ActionsPage'
import { loadAction } from './action-workflow'

const issue: Issue = { id: 'I1', sku: 'SKU-1', title: 'SKU-1 尺码相关退货异常', primaryCause: 'size', secondaryCauses: [], confidence: 70, evidenceIds: ['E1'], affectedReturns: 2, directLoss: 100, recoverableLow: 10, recoverableHigh: 20, status: 'confirmed' }
const draft: ActionDraft = { id: 'A1', issueId: 'I1', version: 1, status: 'todo', title: '补充尺码说明', touchpoint: '详情页第二屏', content: '增加偏小提示', owner: '李青', dueDate: '2026-09-30', targetMetric: '退货率下降 15%', experimentDays: 14 }

afterEach(() => { localStorage.clear(); setIssueSessionContext({}); vi.useRealTimers() })

test('shows recoverable ranges in the board summary and every action card', () => {
  const todo = { ...draft, owner: '商品运营', status: 'todo' as const }
  const verified = { ...draft, id: 'A2', issueId: 'I2', owner: '商品运营', status: 'verified' as const }
  localStorage.setItem('returnlens:issues', JSON.stringify([
    { ...issue, recoverableHigh: 20 },
    { ...issue, id: 'I2', sku: 'SKU-2', title: 'SKU-2 描述问题', recoverableLow: 15, recoverableHigh: 40 },
  ]))
  localStorage.setItem('returnlens:actions', JSON.stringify({
    I1: { current: todo, history: [] },
    I2: { current: verified, history: [] },
  }))
  render(<MemoryRouter><ActionsPage /></MemoryRouter>)
  expect(screen.getByText('2 个整改动作')).toBeInTheDocument()
  expect(screen.getByText('1 个已验证')).toBeInTheDocument()
  expect(screen.getByText('预计可避免损失 ¥25–¥60')).toBeInTheDocument()
  expect(screen.getByText('¥10–¥20')).toBeInTheDocument()
  expect(screen.getByText('¥15–¥40')).toBeInTheDocument()
})

test('focuses the board target after clearing its temporary focus highlight', async () => {
  localStorage.setItem('returnlens:actions', JSON.stringify({ I1: { current: draft, history: [] } }))
  render(<MemoryRouter initialEntries={['/actions?focus=A1']}><Routes><Route path="/actions" element={<ActionsPage />} /></Routes></MemoryRouter>)
  const card = screen.getByRole('heading', { name: '补充尺码说明' }).closest('article')
  expect(card).not.toBeNull()
  await waitFor(() => expect(card).toHaveFocus())
  expect(card).not.toHaveClass('action-focus')
})

test('moves focus into the draft drawer and returns it on Escape', async () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue]))
  setIssueSessionContext({ I1: { channels: ['淘宝'], evidence: [{ id: 'E1', source: 'review', text: '尺码偏小' }] } })
  render(<MemoryRouter initialEntries={['/issues/I1']}><Routes><Route path="/issues/:issueId" element={<IssueDetailPage />} /></Routes></MemoryRouter>)
  const trigger = screen.getByRole('button', { name: '生成整改方案' })
  trigger.focus()
  fireEvent.click(trigger)
  const drawer = screen.getByRole('dialog')
  await waitFor(() => expect(drawer).toHaveFocus())
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
})

test('regenerates a rejected issue draft as feedback-aware V2 without leaving generation pending', async () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([{ ...issue, status: 'pending' }]))
  setIssueSessionContext({ I1: { channels: ['淘宝'], evidence: [{ id: 'E1', source: 'review', text: '尺码偏小' }] } })
  render(<MemoryRouter initialEntries={['/issues/I1']}><Routes><Route path="/issues/:issueId" element={<IssueDetailPage />} /></Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '确认问题' }))
  fireEvent.click(screen.getByRole('button', { name: '生成整改方案' }))
  await screen.findByLabelText('整改触点')
  fireEvent.click(screen.getByRole('button', { name: '驳回并重写' }))
  fireEvent.change(screen.getByLabelText('驳回类别'), { target: { value: '触点不正确' } })
  fireEvent.change(screen.getByLabelText('修改要求'), { target: { value: '改到尺码建议模块，并补充测量位置' } })
  fireEvent.click(screen.getByRole('button', { name: '按意见重新生成' }))
  await screen.findByText('版本 2')
  expect(screen.getByDisplayValue(/触点不正确：改到尺码建议模块/)).toBeInTheDocument()
  expect(screen.queryByText('生成中')).not.toBeInTheDocument()
})

test('publishes a complete manual edit to the action board', async () => {
  localStorage.setItem('returnlens:issues', JSON.stringify([issue]))
  setIssueSessionContext({ I1: { channels: ['淘宝'], evidence: [{ id: 'E1', source: 'review', text: '尺码偏小' }] } })
  render(<MemoryRouter initialEntries={['/issues/I1']}><Routes><Route path="/issues/:issueId" element={<IssueDetailPage />} /><Route path="/actions" element={<ActionsPage />} /></Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '生成整改方案' }))
  await screen.findByLabelText('整改触点')
  fireEvent.change(screen.getByLabelText('负责人'), { target: { value: '商品运营' } })
  fireEvent.change(screen.getByLabelText('截止日期'), { target: { value: '2026-09-30' } })
  fireEvent.change(screen.getByLabelText('目标指标'), { target: { value: ' 退货率下降 15% ' } })
  fireEvent.click(screen.getByRole('button', { name: '转为人工编辑' }))
  fireEvent.click(screen.getByRole('button', { name: '确认并入看板' }))
  await screen.findByRole('heading', { name: '把已确认问题推进到验证' })
  expect(screen.getByText('商品运营')).toBeInTheDocument()
})

test('cancels a stale rewrite callback when the drawer closes and reopens', () => {
  vi.useFakeTimers()
  localStorage.setItem('returnlens:issues', JSON.stringify([issue]))
  setIssueSessionContext({ I1: { channels: ['淘宝'], evidence: [{ id: 'E1', source: 'review', text: '尺码偏小' }] } })
  render(<MemoryRouter initialEntries={['/issues/I1']}><Routes><Route path="/issues/:issueId" element={<IssueDetailPage />} /></Routes></MemoryRouter>)
  const trigger = screen.getByRole('button', { name: '生成整改方案' })
  fireEvent.click(trigger)
  act(() => { vi.advanceTimersByTime(280) })
  fireEvent.click(screen.getByRole('button', { name: '驳回并重写' }))
  fireEvent.change(screen.getByLabelText('修改要求'), { target: { value: '补充测量位置' } })
  fireEvent.click(screen.getByRole('button', { name: '按意见重新生成' }))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(trigger)
  act(() => { vi.advanceTimersByTime(280) })
  expect(screen.getByText('版本 1')).toBeInTheDocument()
  expect(loadAction('I1')).toBeUndefined()
})

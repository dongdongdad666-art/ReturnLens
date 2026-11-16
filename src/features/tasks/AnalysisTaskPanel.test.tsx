import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { AnalysisTaskPanel } from './AnalysisTaskPanel'
import { reduceAnalysisTask } from './analysis-task'
import type { AnalysisTask } from './analysis-task'

function TaskHarness({ initial }: { initial: AnalysisTask }) {
  const [task, setTask] = useState(initial)
  const [prices, setPrices] = useState({ inputPerMillion: 0.5, outputPerMillion: 1.5 })
  return <AnalysisTaskPanel task={task} inputPerMillion={prices.inputPerMillion} outputPerMillion={prices.outputPerMillion} onPricesChange={setPrices} onTaskChange={(event) => setTask((current) => reduceAnalysisTask(current, event))} onAddBudget={(amount) => setTask((current) => ({ ...current, cap: current.cap + amount }))} onFinishPartial={() => undefined} />
}

test('shows progress and budget outside the collapsed advanced price settings', () => {
  render(<TaskHarness initial={{ status: 'running', processed: 30, total: 81, spent: 0.24, cap: 0.6 }} />)
  expect(screen.getByRole('progressbar', { name: '分析进度' })).toBeVisible()
  expect(screen.getByRole('progressbar', { name: '预算使用' })).toBeVisible()
  expect(screen.getByText('高级模型价格设置')).toBeInTheDocument()
  const pricing = screen.getByText('高级模型价格设置').closest('details')
  expect(pricing).toHaveProperty('open', false)
  expect(pricing).not.toContainElement(screen.getByText(/下一批 30 条预计/))
})

test('keeps no-task pricing details limited to inputs and leaves validation outside', () => {
  const props = { task: null, inputPerMillion: 0.5, outputPerMillion: 1.5, onPricesChange: () => undefined, onTaskChange: () => undefined, onAddBudget: () => undefined, onFinishPartial: () => undefined }
  const { rerender } = render(<AnalysisTaskPanel {...props} />)
  const pricing = screen.getByText('高级模型价格设置').closest('details')
  expect(pricing?.querySelectorAll('input')).toHaveLength(2)
  expect(pricing?.querySelectorAll('p')).toHaveLength(0)
  rerender(<AnalysisTaskPanel {...props} inputPerMillion={Number.NaN} />)
  expect(screen.getByText('高级模型价格设置').closest('details')).not.toContainElement(screen.getByRole('alert'))
})

test.each(['-1', ''])('visibly blocks invalid prices %s without spending or processing', (value) => {
  render(<TaskHarness initial={{ status: 'running', processed: 30, total: 81, spent: 0.24, cap: 0.6 }} />)
  fireEvent.change(screen.getByLabelText('输入价格（每百万 Token）'), { target: { value } })
  expect(screen.getByRole('alert')).toHaveTextContent('价格')
  expect(screen.getByRole('button', { name: '处理下一批' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '处理下一批' }))
  expect(screen.getByRole('progressbar', { name: '分析进度' })).toHaveAttribute('aria-valuenow', '37')
  expect(screen.getByText(/¥0.24 \/ ¥0.60/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('输入价格（每百万 Token）'), { target: { value: '0' } })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '处理下一批' })).toBeEnabled()
})

test('pauses at a batch boundary before exceeding the budget and can continue after more budget', () => {
  render(<TaskHarness initial={{ status: 'running', processed: 60, total: 81, spent: 0.48, cap: 0.6 }} />)
  fireEvent.click(screen.getByRole('button', { name: '处理下一批' }))
  expect(screen.getByText('预算已暂停')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('追加预算金额'), { target: { value: '0.5' } })
  fireEvent.click(screen.getByRole('button', { name: '追加预算并继续' }))
  expect(screen.getByRole('button', { name: '处理下一批' })).toBeInTheDocument()
})

test('offers timeout retry, economical-model confirmation, and partial-result confirmation', () => {
  render(<TaskHarness initial={{ status: 'running', processed: 30, total: 81, spent: 0.24, cap: 0.6 }} />)
  fireEvent.click(screen.getByRole('button', { name: '模拟模型超时' }))
  expect(screen.getByText('模型响应超时')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重试当前批次' }))
  fireEvent.click(screen.getByRole('button', { name: '切换备用经济模型' }))
  expect(screen.getByText('质量取舍：摘要可能更简短，需增加人工复核。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '确认切换备用经济模型' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '确认切换备用经济模型' }))
  fireEvent.click(screen.getByRole('button', { name: '结束分析并查看部分结果' }))
  expect(screen.getByRole('button', { name: '确认结束并查看部分结果' })).toBeInTheDocument()
})

test('withholds competing task actions while a confirmation is open', () => {
  render(<TaskHarness initial={{ status: 'running', processed: 30, total: 81, spent: 0.24, cap: 0.6 }} />)
  fireEvent.click(screen.getByRole('button', { name: '切换备用经济模型' }))
  expect(screen.queryByRole('button', { name: '处理下一批' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '结束分析并查看部分结果' })).not.toBeInTheDocument()
})

test('labels a costlier backup price as an increase instead of economical', () => {
  render(<TaskHarness initial={{ status: 'running', processed: 30, total: 81, spent: 0.24, cap: 0.6 }} />)
  fireEvent.change(screen.getByLabelText('输入价格（每百万 Token）'), { target: { value: '0.1' } })
  fireEvent.change(screen.getByLabelText('输出价格（每百万 Token）'), { target: { value: '0.2' } })
  fireEvent.click(screen.getByRole('button', { name: '切换备用模型' }))
  expect(screen.getByText(/预计增加 ¥0.05/)).toBeInTheDocument()
  expect(screen.queryByText('切换备用经济模型？')).not.toBeInTheDocument()
})

test('reports no change when current and backup costs round to the same amount', () => {
  render(<TaskHarness initial={{ status: 'running', processed: 30, total: 81, spent: 0.24, cap: 0.6 }} />)
  fireEvent.change(screen.getByLabelText('输入价格（每百万 Token）'), { target: { value: '0.2' } })
  fireEvent.change(screen.getByLabelText('输出价格（每百万 Token）'), { target: { value: '0.6' } })
  fireEvent.click(screen.getByRole('button', { name: '切换备用模型' }))
  expect(screen.getByText(/费用不变/)).toBeInTheDocument()
  expect(screen.queryByText(/预计增加 ¥0.00/)).not.toBeInTheDocument()
})

test('shows an idle task as not started and starts it through the reducer', () => {
  render(<TaskHarness initial={{ status: 'idle', processed: 0, total: 81, spent: 0, cap: 0.6 }} />)
  expect(screen.getByText('尚未开始')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '开始批次模拟' }))
  expect(screen.getByRole('button', { name: '处理下一批' })).toBeInTheDocument()
})

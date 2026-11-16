import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach } from 'vitest'
import { loadDerivedState } from '../../lib/storage'
import { maskSensitiveText } from './privacy'
import { ImportPage } from './ImportPage'
import { getIssueSessionContext, setIssueSessionContext } from '../issues/issue-session'

const page = () => <MemoryRouter><ImportPage /></MemoryRouter>

afterEach(() => { localStorage.clear(); setIssueSessionContext({}) })

test('keeps privacy and estimated cost visible while advanced prices are collapsible', async () => {
  render(page())
  expect(screen.getByText(/本地完成脱敏/)).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '分析预算与进度' })).toBeInTheDocument()
  expect(screen.getByText('高级模型价格设置')).toBeInTheDocument()
})

test('groups CSV inputs and analysis controls into two workbench columns', () => {
  const { container } = render(page())
  expect(container.querySelector('.import-data-column')).toBeInTheDocument()
  expect(container.querySelector('.import-control-column')).toBeInTheDocument()
})

const csvFile = (name: string, csv: string) => {
  const file = new File([''], name, { type: 'text/csv' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(csv) })
  return file
}

test('blocks negative import money before replacing existing results', async () => {
  localStorage.setItem('returnlens:issues', '[]')
  render(page())
  const [ordersInput, returnsInput] = screen.getAllByLabelText('选择 CSV 文件')
  fireEvent.change(ordersInput, { target: { files: [csvFile('orders.csv', 'order_id,sku,sale_price,unit_cost\nO1,SKU-1,-199,90')] } })
  fireEvent.change(returnsInput, { target: { files: [csvFile('returns.csv', 'return_id,order_id,return_shipping_cost,inspection_cost,restock_cost,residual_loss\nR1,O1,8,3,2,10')] } })
  await waitFor(() => expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '开始模拟分析' }))
  expect(screen.getByText(/sale_price 不是有效金额/)).toBeInTheDocument()
  expect(localStorage.getItem('returnlens:issues')).toBe('[]')
  expect(screen.queryByRole('heading', { name: '分析进度与预算' })).not.toBeInTheDocument()
})

test('clears every old action and version when a new dataset replaces even the same SKU', async () => {
  const oldDraft = { id: 'A-I-SKU-1', issueId: 'I-SKU-1', version: 1, status: 'todo', title: '旧数据动作', touchpoint: '详情页', content: '旧数据整改', owner: '商品运营', dueDate: '2026-09-30', targetMetric: '降低退货率', experimentDays: 14 }
  localStorage.setItem('returnlens:actions', JSON.stringify({ 'I-SKU-1': { current: oldDraft, history: [{ ...oldDraft, content: '旧版本', status: 'needs_rewrite' }] }, unrelated: { current: { ...oldDraft, issueId: 'unrelated', title: '其他SKU动作' }, history: [] } }))
  render(page())
  const [ordersInput, returnsInput] = screen.getAllByLabelText('选择 CSV 文件')
  fireEvent.change(ordersInput, { target: { files: [csvFile('orders.csv', 'order_id,sku,sale_price,unit_cost\nO1,SKU-1,199,90')] } })
  fireEvent.change(returnsInput, { target: { files: [csvFile('returns.csv', 'return_id,order_id,return_shipping_cost,inspection_cost,restock_cost,residual_loss\nR1,O1,8,3,2,10')] } })
  await waitFor(() => expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '开始模拟分析' }))
  expect(localStorage.getItem('returnlens:actions')).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('整改动作及版本历史已清除')
})

test('resets all ReturnLens storage and session data to an empty import without deleting another app', async () => {
  localStorage.setItem('returnlens:issues', '[]')
  localStorage.setItem('returnlens:actions', '{}')
  localStorage.setItem('returnlens:old-version', 'old')
  localStorage.setItem('returnlens:derived-state:v1', JSON.stringify({ issues: [], task: { status: 'complete', total: 1, processed: 1, spent: 0.1, cap: 1 }, prices: { inputPerMillion: 0.5, outputPerMillion: 1.5 } }))
  localStorage.setItem('other-app', 'keep')
  setIssueSessionContext({ I1: { channels: ['淘宝'], evidence: [{ id: 'E1', source: 'chat', text: '会话数据' }] } })
  render(page())
  fireEvent.change(screen.getAllByLabelText('选择 CSV 文件')[0], { target: { files: [csvFile('orders.csv', 'order_id,sku,sale_price,unit_cost\nO1,SKU-1,199,90')] } })
  await waitFor(() => expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '清除本地演示数据' }))
  expect(Object.keys(localStorage)).toEqual(['other-app'])
  expect(getIssueSessionContext()).toEqual({})
  expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeDisabled()
  expect(screen.getAllByText('尚未选择文件')).toHaveLength(4)
  expect(screen.queryByRole('heading', { name: '分析进度与预算' })).not.toBeInTheDocument()
})

test('does not restore a CSV that finishes reading after a local reset', async () => {
  let finishRead!: (text: string) => void
  const pending = new Promise<string>((resolve) => { finishRead = resolve })
  const file = new File([''], 'pending.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'text', { value: () => pending })
  render(page())
  fireEvent.change(screen.getAllByLabelText('选择 CSV 文件')[0], { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: '清除本地演示数据' }))
  await act(async () => { finishRead('order_id,sku,sale_price,unit_cost\nO1,SKU-1,199,90'); await pending })
  expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeDisabled()
  expect(screen.getAllByText('尚未选择文件')).toHaveLength(4)
})

test('blocks ambiguous mappings until confirmed and resets mapping state after a replacement file', async () => {
  render(page())
  const [ordersInput, returnsInput] = screen.getAllByLabelText('选择 CSV 文件')
  fireEvent.change(ordersInput, { target: { files: [csvFile('ambiguous.csv', '主订单号,子订单号,sku,sale_price,unit_cost\nO1,S1,SKU-1,199,90')] } })
  fireEvent.change(returnsInput, { target: { files: [csvFile('returns.csv', 'return_id,order_id,return_reason,returned_at,return_shipping_cost,inspection_cost,restock_cost,residual_loss\nR1,O1,偏小,2026-09-01,8,3,2,10')] } })
  await waitFor(() => expect(screen.getByLabelText('我已确认此字段映射')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: '开始模拟分析' }))
  expect(screen.getByRole('status')).toHaveTextContent('请先修复阻断问题')
  fireEvent.click(screen.getByLabelText('我已确认此字段映射'))
  fireEvent.click(screen.getByRole('button', { name: '开始模拟分析' }))
  expect(screen.getByRole('status')).toHaveTextContent('模拟生成：已完成本地脱敏与确定性分析')
  fireEvent.change(ordersInput, { target: { files: [csvFile('replacement.csv', 'order_id,sku,sale_price,unit_cost\nO2,SKU-2,299,100')] } })
  await waitFor(() => expect(screen.queryByLabelText('我已确认此字段映射')).not.toBeInTheDocument())
  expect(screen.getAllByLabelText('订单编号')[0]).toHaveValue('order_id')
})

test('opens the budget-controlled simulated analysis after valid deterministic input', async () => {
  render(page())
  const [ordersInput, returnsInput] = screen.getAllByLabelText('选择 CSV 文件')
  fireEvent.change(ordersInput, { target: { files: [csvFile('orders.csv', 'order_id,sku,sale_price,unit_cost\nO1,SKU-1,199,90')] } })
  fireEvent.change(returnsInput, { target: { files: [csvFile('returns.csv', 'return_id,order_id,return_reason,returned_at,return_shipping_cost,inspection_cost,restock_cost,residual_loss\nR1,O1,偏小,2026-09-01,8,3,2,10')] } })
  await waitFor(() => expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '开始模拟分析' }))
  expect(screen.getByRole('heading', { name: '分析进度与预算' })).toBeInTheDocument()
  expect(screen.getByText(/MVP 不会调用真实模型服务/)).toBeInTheDocument()
})

test('persists only derived batch progress and completion IDs after a partial analysis', async () => {
  render(page())
  const [ordersInput, returnsInput, reviewsInput, chatsInput] = screen.getAllByLabelText('选择 CSV 文件')
  const orders = ['order_id,sku,sale_price,unit_cost', ...Array.from({ length: 31 }, (_, index) => `O${index + 1},SKU-${index < 30 ? 'A' : 'B'},199,90`)].join('\n')
  const returns = ['return_id,order_id,return_reason,returned_at,return_shipping_cost,inspection_cost,restock_cost,residual_loss', ...Array.from({ length: 31 }, (_, index) => `R${index + 1},O${index + 1},机密退货文本,2026-09-01,8,3,2,10`)].join('\n')
  const reviewText = '张三 13812345678 尺码偏小'
  const chatText = '上海市静安区南京西路100号'
  fireEvent.change(ordersInput, { target: { files: [csvFile('orders.csv', orders)] } })
  fireEvent.change(returnsInput, { target: { files: [csvFile('returns.csv', returns)] } })
  fireEvent.change(reviewsInput, { target: { files: [csvFile('reviews.csv', `review_id,order_id,review_text\nE1,O1,${reviewText}`)] } })
  fireEvent.change(chatsInput, { target: { files: [csvFile('chats.csv', `chat_id,order_id,message_text\nC1,O1,${chatText}`)] } })
  await waitFor(() => expect(screen.getByRole('button', { name: '开始模拟分析' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '开始模拟分析' }))
  fireEvent.click(screen.getByRole('button', { name: '开始批次模拟' }))
  fireEvent.click(screen.getByRole('button', { name: '处理下一批' }))
  fireEvent.click(screen.getByRole('button', { name: '结束分析并查看部分结果' }))
  fireEvent.click(screen.getByRole('button', { name: '确认结束并查看部分结果' }))
  await waitFor(() => expect(loadDerivedState<{ task: { completedIssueIds: string[]; batches: { sourceRows: { issueId?: string }[] }[] } }>()?.task.completedIssueIds).toEqual(['I-SKU-A']))
  expect(loadDerivedState<{ task: { batches: { sourceRows: { issueId?: string }[] }[] } }>()?.task.batches[0].sourceRows).toHaveLength(30)
  const persisted = JSON.stringify(loadDerivedState())
  expect(persisted).not.toContain('机密退货文本')
  expect(persisted).not.toContain('order_id')
  expect(persisted).not.toContain(reviewText)
  expect(persisted).not.toContain(maskSensitiveText(reviewText))
  expect(persisted).not.toContain(chatText)
  expect(persisted).not.toContain(maskSensitiveText(chatText))
})

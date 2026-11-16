import { afterEach, expect, test } from 'vitest'
import { loadAction, loadActions, reduceAction, saveAction } from './action-workflow'
import type { ActionDraft } from '../../domain/types'

const base: ActionDraft = { id: 'A1', issueId: 'I1', version: 1, status: 'draft_review', title: '修改尺码说明', touchpoint: '详情页第二屏', content: '增加偏小提示', owner: '', dueDate: '', targetMetric: '', experimentDays: 14 }

test.each(['save', 'load'])('sanitizes all current and historical free text at the %s persistence boundary', (mode) => {
  const privateText = '联系人：张三 电话：13812345678，地址：上海市静安区南京西路100号'
  const personal = { ...base, title: privateText, touchpoint: privateText, content: privateText, owner: '张三', targetMetric: privateText, rejectionReason: privateText }
  const record = { current: personal, history: [{ ...personal, version: 2 }] }
  if (mode === 'save') saveAction(record)
  else localStorage.setItem('returnlens:actions', JSON.stringify({ I1: record }))
  const loaded = loadAction('I1')!
  expect(loaded.current.owner).toBe('')
  for (const serialized of [JSON.stringify(loaded), localStorage.getItem('returnlens:actions')!]) {
    for (const secret of ['张三', '13812345678', '南京西路100号']) expect(serialized).not.toContain(secret)
  }
  expect(loaded.current.content).toContain('138****5678')
})

test.each(['买家：私密原始聊天内容\n客服：另一段原始回复', '修改要求：买家：私密原始聊天内容；客服：另一段原始回复'])('does not persist pasted conversation transcripts: %s', (transcript) => {
  saveAction({ current: { ...base, content: transcript }, history: [{ ...base, rejectionReason: transcript }] })
  expect(localStorage.getItem('returnlens:actions')).not.toContain('私密原始聊天内容')
  expect(localStorage.getItem('returnlens:actions')).not.toContain('另一段原始回复')
})

test('rejects a personal owner and blocks publishing an unfinished issue even if confirmed', () => {
  expect(() => reduceAction({ ...base, owner: '张三', dueDate: '2026-09-30', targetMetric: '降低退货率' }, { type: 'publish' })).toThrow()
  localStorage.setItem('returnlens:derived-state:v1', JSON.stringify({ task: { status: 'partial', processed: 1, total: 2, completedIssueIds: [] } }))
  expect(() => reduceAction({ ...base, owner: '商品运营', dueDate: '2026-09-30', targetMetric: '降低退货率' }, { type: 'publish' })).toThrow('分析尚未完成')
})

test('rejects a draft into needs_rewrite with a reason', () => {
  expect(reduceAction(base, { type: 'reject', reason: '内容太泛' }).status).toBe('needs_rewrite')
})

test('regeneration increments the version and keeps the prior version outside the reducer', () => {
  expect(reduceAction({ ...base, status: 'needs_rewrite' }, { type: 'regenerate' }).version).toBe(2)
})

test('cannot publish without owner, due date, and metric', () => {
  expect(() => reduceAction(base, { type: 'publish' })).toThrow('请补全负责人、截止日期和目标指标')
})

test('allows each workflow event only from its permitted source status', () => {
  expect(() => reduceAction({ ...base, status: 'todo' }, { type: 'reject', reason: '内容太泛' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction(base, { type: 'regenerate' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction({ ...base, status: 'doing' }, { type: 'manual' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction({ ...base, status: 'needs_rewrite' }, { type: 'publish' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction(base, { type: 'start' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction({ ...base, status: 'todo' }, { type: 'complete' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction({ ...base, status: 'doing' }, { type: 'verify' })).toThrow('不允许的整改状态流转')
  expect(() => reduceAction({ ...base, status: 'verified' }, { type: 'start' })).toThrow('不允许的整改状态流转')
})

test('rejects whitespace-only publish fields', () => {
  expect(() => reduceAction({ ...base, owner: ' ', dueDate: ' ', targetMetric: ' ' }, { type: 'publish' })).toThrow('请补全负责人、截止日期和目标指标')
})

test('publishes a complete manual-edit draft but still rejects whitespace fields', () => {
  const manual = reduceAction({ ...base, owner: ' 商品运营 ', dueDate: ' 2026-09-30 ', targetMetric: ' 退货率下降 15% ' }, { type: 'manual' })
  expect(() => reduceAction({ ...manual, owner: ' ', dueDate: ' ', targetMetric: ' ' }, { type: 'publish' })).toThrow('请补全负责人、截止日期和目标指标')
  expect(reduceAction(manual, { type: 'publish' })).toMatchObject({ status: 'todo', owner: '商品运营', dueDate: '2026-09-30', targetMetric: '退货率下降 15%' })
})

afterEach(() => localStorage.clear())

test('ignores malformed and old persisted action records', () => {
  for (const stored of ['null', '[]', JSON.stringify({ I1: { current: { id: 'A1' }, history: [] } }), JSON.stringify({ I1: { current: { ...base, status: 'unknown' }, history: [] } })]) {
    localStorage.setItem('returnlens:actions', stored)
    expect(loadAction('I1')).toBeUndefined()
    expect(loadActions()).toEqual([])
  }
})

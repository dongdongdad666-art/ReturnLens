import { expect, test } from 'vitest'
import { reduceAnalysisTask } from './analysis-task'
import type { AnalysisTask } from './analysis-task'

const running: AnalysisTask = { status: 'running', processed: 360, total: 600, spent: 4.32, cap: 6 }

test.each([-1, NaN, Infinity, -Infinity])('does not process or reduce spent for invalid batch cost %s', (cost) => {
  expect(reduceAnalysisTask(running, { type: 'batch_complete', rows: 30, cost })).toEqual(running)
})

test('preserves processed progress when budget pauses', () => {
  expect(reduceAnalysisTask(running, { type: 'budget_pause' })).toMatchObject({ status: 'paused_budget', processed: 360 })
})

test('finishes with partial results without resetting progress', () => {
  expect(reduceAnalysisTask(running, { type: 'finish_partial' })).toMatchObject({ status: 'partial', processed: 360 })
})

test('does not restart a completed or partial task with later events', () => {
  const complete = { ...running, status: 'complete' as const, processed: 600 }
  const partial = { ...running, status: 'partial' as const }
  expect(reduceAnalysisTask(complete, { type: 'retry' })).toEqual(complete)
  expect(reduceAnalysisTask(partial, { type: 'batch_complete', rows: 30, cost: 0.24 })).toEqual(partial)
})

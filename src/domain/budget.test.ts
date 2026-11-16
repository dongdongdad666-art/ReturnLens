import { expect, test } from 'vitest'
import { estimateTokenCost, shouldPauseBeforeBatch } from './budget'

test('estimates input and output cost from per-million prices', () => {
  expect(estimateTokenCost({ inputTokens: 6_000_000, outputTokens: 1_000_000, inputPerMillion: 0.5, outputPerMillion: 1.5 })).toBe(4.5)
})

test('pauses before the next batch exceeds the authorized cap', () => {
  expect(shouldPauseBeforeBatch({ spent: 5.6, cap: 6, nextBatch: 0.72 })).toBe(true)
})

test.each([-1, NaN, Infinity, -Infinity])('rejects invalid model prices %s before estimating a batch', (price) => {
  for (const field of ['inputPerMillion', 'outputPerMillion']) {
    expect(() => estimateTokenCost({ inputTokens: 10_000, outputTokens: 2_000, inputPerMillion: 0.5, outputPerMillion: 1.5, [field]: price })).toThrow()
  }
})

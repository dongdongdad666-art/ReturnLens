export const isValidPrice = (value: number) => Number.isFinite(value) && value >= 0

export function estimateTokenCost(values: { inputTokens: number; outputTokens: number; inputPerMillion: number; outputPerMillion: number }) {
  if (!Object.values(values).every(isValidPrice)) throw new Error('模型价格与 Token 数量必须为有限的非负数')
  return values.inputTokens / 1_000_000 * values.inputPerMillion + values.outputTokens / 1_000_000 * values.outputPerMillion
}

export function shouldPauseBeforeBatch(values: { spent: number; cap: number; nextBatch: number }) {
  return values.spent + values.nextBatch > values.cap
}

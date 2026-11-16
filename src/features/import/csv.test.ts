import { expect, test } from 'vitest'
import { calculateQuality, parseCsv, requiresMappingConfirmation, separateDiagnostics, suggestFieldMapping, validateImport, validateMappedFields, validateNumericFields, validateMappingConfirmation } from './csv'

test('parses a quoted comma without splitting the field', () => {
  const rows = parseCsv<{ order_id: string; reason: string }>('order_id,reason\nO1,"偏小,换大一码"')
  expect(rows[0]).toEqual({ order_id: 'O1', reason: '偏小,换大一码' })
})

test('suggests 主订单号 for order_id with review required', () => {
  expect(suggestFieldMapping(['主订单号', '子订单号'], 'order_id')).toEqual({
    column: '主订单号', confidence: 0.68, requiresReview: true,
  })
})

test('blocks import when order id is missing', () => {
  expect(validateImport(['sku', 'size'], ['order_id', 'sku']).blocking).toContain('缺少订单编号')
})

test('accepts a localized column when it is mapped to the required target field', () => {
  expect(validateMappedFields({ order_id: '主订单号', sku: '商品编码' }, ['order_id', 'sku']).blocking).toEqual([])
})

test('rejects a mapping whose source column is absent from the current file', () => {
  expect(validateMappedFields({ order_id: '主订单号' }, ['order_id'], ['order_id']).blocking).toContain('缺少订单编号')
})

test('blocks malformed monetary values instead of coercing them to zero', () => {
  expect(validateNumericFields([{ sale_price: '199', unit_cost: '免费' }], ['sale_price', 'unit_cost']).blocking)
    .toContain('第 1 行：unit_cost 不是有效金额')
})

test('blocks negative monetary values but accepts zero', () => {
  expect(validateNumericFields([{ sale_price: '-199', unit_cost: '0' }], ['sale_price', 'unit_cost']).blocking).toEqual(['第 1 行：sale_price 不是有效金额'])
})

test('blocks an ambiguous mapping until a person confirms it', () => {
  expect(validateMappingConfirmation(true, false)).toBe('请确认字段映射')
  expect(validateMappingConfirmation(true, true)).toBe('')
})

test('keeps both main and child order columns risky while allowing a direct order id column', () => {
  const columns = ['order_id', '主订单号', '子订单号']
  expect(requiresMappingConfirmation(columns, 'order_id', '主订单号')).toBe(true)
  expect(requiresMappingConfirmation(columns, 'order_id', '子订单号')).toBe(true)
  expect(requiresMappingConfirmation(columns, 'order_id', 'order_id')).toBe(false)
})

test('keeps blocking diagnostics out of warnings and counts each once in quality', () => {
  const diagnostics = ['订单：第 1 行：unit_cost 不是有效金额', '订单：请确认 主订单号 映射到订单编号', '评价：建议补充 rating']
  const { blocking, warnings } = separateDiagnostics(diagnostics)
  expect(blocking).toHaveLength(2)
  expect(warnings).toEqual(['评价：建议补充 rating'])
  expect(calculateQuality(10, blocking, warnings)).toBe(20)
})

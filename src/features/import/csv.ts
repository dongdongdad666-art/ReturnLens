import Papa from 'papaparse'

export function parseCsv<T>(input: string): T[] {
  const result = Papa.parse<T>(input, { header: true, skipEmptyLines: true })
  if (result.errors.length) throw new Error(result.errors[0].message)
  return result.data
}

const aliases: Record<string, string[]> = {
  order_id: ['order_id', '订单编号', '主订单号', '订单号'],
  sku: ['sku', '商品编码', '货号'],
  reason: ['reason', 'return_reason', '退款原因', '退货原因'],
}

export function suggestFieldMapping(columns: string[], target: string) {
  const candidates = aliases[target] ?? [target]
  const matches = columns.filter((column) => candidates.includes(column))
  if (!matches.length) return { column: '', confidence: 0, requiresReview: true }
  const ambiguous = target === 'order_id' && columns.includes('主订单号') && columns.includes('子订单号')
  return { column: matches[0], confidence: ambiguous ? 0.68 : 0.96, requiresReview: ambiguous }
}

export function validateImport(columns: string[], required: string[]) {
  const missing = required.filter((field) => !columns.includes(field))
  return {
    blocking: missing.includes('order_id') ? ['缺少订单编号'] : [],
    warnings: missing.filter((field) => field !== 'order_id'),
  }
}

export function validateMappedFields(mappings: Record<string, string>, required: string[], columns?: string[]) {
  const missing = required.filter((field) => !mappings[field] || (columns !== undefined && !columns.includes(mappings[field])))
  return {
    blocking: missing.includes('order_id') ? ['缺少订单编号'] : [],
    warnings: missing.filter((field) => field !== 'order_id'),
  }
}

export function validateNumericFields(rows: Record<string, string>[], fields: string[]) {
  const blocking = rows.flatMap((row, index) => fields.flatMap((field) => {
    const input = row[field]?.trim() ?? ''
    return input === '' || !Number.isFinite(Number(input)) || Number(input) < 0 ? [`第 ${index + 1} 行：${field} 不是有效金额`] : []
  }))
  return { blocking, warnings: [] as string[] }
}

export function validateMappingConfirmation(isRisky: boolean, isConfirmed: boolean) {
  return isRisky && !isConfirmed ? '请确认字段映射' : ''
}

export function requiresMappingConfirmation(columns: string[], target: string, selected: string) {
  return target === 'order_id' && columns.includes('主订单号') && columns.includes('子订单号')
    && (selected === '主订单号' || selected === '子订单号')
}

export function separateDiagnostics(diagnostics: string[]) {
  const blocking = diagnostics.filter((item) => item.includes('缺少订单编号') || item.includes('不是有效金额') || item.includes('请确认'))
  return { blocking, warnings: diagnostics.filter((item) => !blocking.includes(item)) }
}

export function calculateQuality(totalRows: number, blocking: string[], warnings: string[]) {
  return totalRows ? Math.round(Math.max(0, 100 - blocking.length * 35 - warnings.length * 10)) : 0
}

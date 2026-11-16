import type { Dataset, Issue, ReturnCause, ReturnRow, TextEvidence } from './types'

const keywords: Record<ReturnCause, string[]> = {
  size: ['偏小', '偏大', '很紧', '太松', '换大一码', '换小一码'],
  material: ['面料', '材质', '太薄', '扎', '闷'],
  color: ['色差', '颜色不一样', '偏黄', '偏灰'],
  quality: ['开线', '破损', '掉扣', '做工'],
  logistics: ['压坏', '包装破', '运输', '快递'],
  expectation: ['与描述不符', '不像图片', '上身效果'],
  other: [],
}

export function classifyCauses(texts: string[]): ReturnCause[] {
  const joined = texts.join(' ')
  const matches = (Object.keys(keywords) as ReturnCause[])
    .filter((cause) => cause !== 'other' && keywords[cause].some((word) => joined.includes(word)))
  return matches.length ? matches : ['other']
}

export function calculateDirectLoss(
  costs: Pick<ReturnRow, 'returnShippingCost' | 'inspectionCost' | 'restockCost' | 'residualLoss'>,
  salePrice: number,
  unitCost: number,
) {
  const unrecoveredMargin = Math.max(0, salePrice - unitCost)
  return unrecoveredMargin + costs.returnShippingCost + costs.inspectionCost + costs.restockCost + costs.residualLoss
}

export function analyzeDataset(dataset: Dataset): Issue[] {
  const orders = new Map(dataset.orders.map((order) => [order.orderId, order]))
  const skuStats = new Map<string, { orders: number; grossMargin: number }>()
  for (const order of dataset.orders) {
    const current = skuStats.get(order.sku) ?? { orders: 0, grossMargin: 0 }
    current.orders += 1
    current.grossMargin += Math.max(0, order.salePrice - order.unitCost)
    skuStats.set(order.sku, current)
  }
  const groups = new Map<string, { returns: ReturnRow[]; texts: TextEvidence[] }>()

  for (const returned of dataset.returns) {
    const order = orders.get(returned.orderId)
    if (!order) continue
    const group = groups.get(order.sku) ?? { returns: [], texts: [] }
    group.returns.push(returned)
    group.texts.push(...dataset.evidence.filter((item) => item.orderId === returned.orderId))
    groups.set(order.sku, group)
  }

  return [...groups.entries()].map(([sku, group]) => {
    const stats = skuStats.get(sku) ?? { orders: 0, grossMargin: 0 }
    const causeList = classifyCauses([...group.returns.map((item) => item.reason), ...group.texts.map((item) => item.text)])
    const directLoss = group.returns.reduce((sum, returned) => {
      const order = orders.get(returned.orderId)!
      return sum + calculateDirectLoss(returned, order.salePrice, order.unitCost)
    }, 0)
    const confidence = Math.min(95, 45 + group.returns.length * 5 + Math.min(20, group.texts.length * 3))
    return {
      id: `I-${sku}`,
      sku,
      title: `${sku} ${causeList[0] === 'size' ? '尺码相关退货异常' : '退货异常'}`,
      primaryCause: causeList[0],
      secondaryCauses: causeList.slice(1),
      confidence,
      evidenceIds: group.texts.map((item) => item.id),
      affectedReturns: group.returns.length,
      directLoss: Math.round(directLoss),
      recoverableLow: Math.round(directLoss * confidence / 100 * 0.15),
      recoverableHigh: Math.round(directLoss * confidence / 100 * 0.35),
      status: 'pending' as const,
      returnRate: stats.orders ? new Set(group.returns.map((returned) => returned.orderId)).size / stats.orders : 0,
      grossMarginContribution: Math.round(stats.grossMargin),
    }
  }).sort((a, b) => b.directLoss - a.directLoss || a.sku.localeCompare(b.sku))
}

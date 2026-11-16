import { expect, test } from 'vitest'
import { analyzeDataset, calculateDirectLoss, classifyCauses } from './analysis'
import type { Dataset } from './types'

const demoDataset: Dataset = {
  orders: [{ orderId: 'O1', sku: 'SKU-123', productName: '收腰连衣裙', size: 'M', color: '黑色', channel: '天猫', salePrice: 199, unitCost: 90, orderedAt: '2026-09-01' }],
  returns: [{ returnId: 'R1', orderId: 'O1', reason: '穿着很紧，申请换大一码', returnedAt: '2026-09-05', returnShippingCost: 8, inspectionCost: 3, restockCost: 2, residualLoss: 10 }],
  evidence: [{ id: 'E1', orderId: 'O1', source: 'review', text: '穿着很紧，申请换大一码' }],
}

test('classifies tight fit and size exchange as a size problem', () => {
  expect(classifyCauses(['穿着很紧', '申请换大一码'])).toEqual(['size'])
})

test('keeps primary and secondary causes', () => {
  expect(classifyCauses(['尺码偏小，而且面料比图片薄'])).toEqual(['size', 'material'])
})

test('calculates direct return loss', () => {
  expect(calculateDirectLoss({
    returnShippingCost: 8, inspectionCost: 3, restockCost: 2, residualLoss: 10,
  }, 199, 90)).toBe(132)
})

test('returns the same issues for the same dataset', () => {
  const first = analyzeDataset(demoDataset)
  const second = analyzeDataset(demoDataset)
  expect(second).toEqual(first)
})

test('adds return rate and gross margin contribution for each SKU', () => {
  const dataset: Dataset = {
    orders: [
      { ...demoDataset.orders[0], orderId: 'O1', salePrice: 200, unitCost: 80 },
      { ...demoDataset.orders[0], orderId: 'O2', salePrice: 150, unitCost: 100 },
    ],
    returns: [{ ...demoDataset.returns[0], orderId: 'O1' }],
    evidence: [],
  }

  expect(analyzeDataset(dataset)[0]).toMatchObject({
    returnRate: 0.5,
    grossMarginContribution: 170,
  })
})

test('never reports negative gross margin contribution', () => {
  const dataset: Dataset = {
    orders: [{ ...demoDataset.orders[0], salePrice: 80, unitCost: 100 }],
    returns: demoDataset.returns,
    evidence: [],
  }
  expect(analyzeDataset(dataset)[0].grossMarginContribution).toBe(0)
})

test('counts one returned order once even when it has multiple return records', () => {
  const dataset: Dataset = {
    ...demoDataset,
    returns: [demoDataset.returns[0], { ...demoDataset.returns[0], returnId: 'R2' }],
  }
  expect(analyzeDataset(dataset)[0]).toMatchObject({ returnRate: 1, affectedReturns: 2 })
})

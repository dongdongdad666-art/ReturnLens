export type ReturnCause = 'size' | 'material' | 'color' | 'quality' | 'logistics' | 'expectation' | 'other'
export type ReviewStatus = 'pending' | 'confirmed' | 'corrected' | 'rejected' | 'watching'

export interface OrderRow {
  orderId: string
  sku: string
  productName: string
  size: string
  color: string
  channel: string
  salePrice: number
  unitCost: number
  orderedAt: string
}

export interface ReturnRow {
  returnId: string
  orderId: string
  reason: string
  returnedAt: string
  returnShippingCost: number
  inspectionCost: number
  restockCost: number
  residualLoss: number
}

export interface TextEvidence {
  id: string
  orderId: string
  source: 'review' | 'chat'
  text: string
}

export interface Dataset {
  orders: OrderRow[]
  returns: ReturnRow[]
  evidence: TextEvidence[]
}

export interface Issue {
  id: string
  sku: string
  title: string
  primaryCause: ReturnCause
  secondaryCauses: ReturnCause[]
  confidence: number
  evidenceIds: string[]
  affectedReturns: number
  directLoss: number
  recoverableLow: number
  recoverableHigh: number
  status: ReviewStatus
  returnRate?: number
  grossMarginContribution?: number
}

export type ActionStatus = 'not_created' | 'generating' | 'draft_review' | 'needs_rewrite' | 'manual_edit' | 'todo' | 'doing' | 'verify' | 'verified'

export interface ActionDraft {
  id: string
  issueId: string
  version: number
  status: ActionStatus
  title: string
  touchpoint: string
  content: string
  owner: string
  dueDate: string
  targetMetric: string
  experimentDays: number
  rejectionReason?: string
}

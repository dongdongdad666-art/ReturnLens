export type AnalysisStatus = 'idle' | 'running' | 'paused_budget' | 'paused_error' | 'partial' | 'complete'

export interface AnalysisBatch {
  rows: number
  sourceRows: { issueId?: string }[]
  completedIssueIds: string[]
}

export interface AnalysisTask {
  status: AnalysisStatus
  processed: number
  total: number
  spent: number
  cap: number
  batches?: AnalysisBatch[]
  completedIssueIds?: string[]
}

export type AnalysisEvent =
  | { type: 'start' }
  | { type: 'batch_complete'; rows: number; cost: number; completedIssueIds?: string[] }
  | { type: 'budget_pause' }
  | { type: 'model_error' }
  | { type: 'retry' }
  | { type: 'finish_partial' }

export function reduceAnalysisTask(state: AnalysisTask, event: AnalysisEvent): AnalysisTask {
  if (state.status === 'complete' || state.status === 'partial') return state
  if (event.type === 'start' || event.type === 'retry') return { ...state, status: 'running' }
  if (event.type === 'budget_pause') return { ...state, status: 'paused_budget' }
  if (event.type === 'model_error') return { ...state, status: 'paused_error' }
  if (event.type === 'finish_partial') return { ...state, status: 'partial' }
  if (!Number.isFinite(event.cost) || event.cost < 0 || !Number.isFinite(state.spent + event.cost)) return state
  const processed = Math.min(state.total, state.processed + event.rows)
  return { ...state, processed, spent: state.spent + event.cost, completedIssueIds: [...new Set([...(state.completedIssueIds ?? []), ...(event.completedIssueIds ?? [])])], status: processed === state.total ? 'complete' : 'running' }
}

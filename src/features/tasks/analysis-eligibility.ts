import { loadDerivedState } from '../../lib/storage'
import type { AnalysisTask } from './analysis-task'

export const loadAnalysisTask = () => loadDerivedState<{ task?: AnalysisTask }>()?.task

export function isAnalysisComplete(task: AnalysisTask | undefined) {
  // Legacy derived issues without a task predate batch simulation.
  return !task || (task.status === 'complete' && task.total > 0 && task.processed >= task.total)
}

export function isIssueAnalysisComplete(issueId: string, task = loadAnalysisTask()) {
  return isAnalysisComplete(task) || Boolean(task && task.status !== 'idle' && task.processed > 0 && task.completedIssueIds?.includes(issueId))
}

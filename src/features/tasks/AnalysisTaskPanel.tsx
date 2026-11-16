import { useState } from 'react'
import { estimateTokenCost, isValidPrice, shouldPauseBeforeBatch } from '../../domain/budget'
import type { AnalysisEvent, AnalysisTask } from './analysis-task'

type Props = {
  task: AnalysisTask | null
  inputPerMillion: number
  outputPerMillion: number
  onPricesChange: (prices: { inputPerMillion: number; outputPerMillion: number }) => void
  onTaskChange: (event: AnalysisEvent) => void
  onAddBudget: (amount: number) => void
  onFinishPartial: (coverage: number) => void
}

const backupPrices = { inputPerMillion: 0.2, outputPerMillion: 0.6 }
const money = (value: number) => `¥${value.toFixed(2)}`

function nextBatchFor(task: AnalysisTask) {
  let processed = 0
  for (const batch of task.batches ?? []) {
    if (task.processed < processed + batch.rows) return batch
    processed += batch.rows
  }
  return { rows: Math.min(30, Math.max(0, task.total - task.processed)), sourceRows: [], completedIssueIds: [] }
}

export function AnalysisTaskPanel({ task, inputPerMillion, outputPerMillion, onPricesChange, onTaskChange, onAddBudget, onFinishPartial }: Props) {
  const [additionalBudget, setAdditionalBudget] = useState('0.5')
  const [confirmBackup, setConfirmBackup] = useState(false)
  const [confirmPartial, setConfirmPartial] = useState(false)
  const validPrices = isValidPrice(inputPerMillion) && isValidPrice(outputPerMillion)

  if (!task) return <>
    <details className="advanced-pricing"><summary>高级模型价格设置</summary><div className="price-inputs" aria-label="模型价格假设"><label>输入价格（每百万 Token）<input type="number" min="0" step="0.1" value={Number.isFinite(inputPerMillion) ? inputPerMillion : ''} aria-invalid={!isValidPrice(inputPerMillion)} aria-describedby={!validPrices ? 'price-error' : undefined} onChange={(event) => onPricesChange({ inputPerMillion: event.target.valueAsNumber, outputPerMillion })} /></label><label>输出价格（每百万 Token）<input type="number" min="0" step="0.1" value={Number.isFinite(outputPerMillion) ? outputPerMillion : ''} aria-invalid={!isValidPrice(outputPerMillion)} aria-describedby={!validPrices ? 'price-error' : undefined} onChange={(event) => onPricesChange({ inputPerMillion, outputPerMillion: event.target.valueAsNumber })} /></label></div></details>
    <p className="next-batch-estimate">开始分析后，将按这些价格估算每个批次的预算使用。</p>
    {!validPrices && <p id="price-error" role="alert">模型价格必须填写有限的非负数；修正后才能开始或处理批次。</p>}
  </>

  const batch = nextBatchFor(task)
  const batchRows = batch.rows
  const nextBatch = validPrices ? estimateTokenCost({ inputTokens: batchRows * 10_000, outputTokens: batchRows * 2_000, inputPerMillion, outputPerMillion }) : 0
  const backupBatch = estimateTokenCost({ inputTokens: batchRows * 10_000, outputTokens: batchRows * 2_000, ...backupPrices })
  const progress = task.total ? Math.round(task.processed / task.total * 100) : 0
  const budget = task.cap ? Math.round(task.spent / task.cap * 100) : 0
  const budgetState = budget >= 100 ? '已达上限' : budget >= 80 ? '接近上限' : '预算正常'
  const roundedDifference = Math.round((backupBatch - nextBatch) * 100) / 100
  const backupCheaper = roundedDifference < 0
  const backupName = backupCheaper ? '备用经济模型' : '备用模型'
  const confirmationOpen = confirmBackup || confirmPartial

  const runBatch = () => {
    if (!batchRows || !validPrices) return
    if (shouldPauseBeforeBatch({ spent: task.spent, cap: task.cap, nextBatch })) {
      onTaskChange({ type: 'budget_pause' })
      return
    }
    onTaskChange({ type: 'batch_complete', rows: batchRows, cost: nextBatch, completedIssueIds: batch.completedIssueIds })
  }

  const continueWithBudget = () => {
    const amount = Number(additionalBudget)
    if (!Number.isFinite(amount) || amount <= 0) return
    onAddBudget(amount)
    onTaskChange({ type: 'retry' })
  }

  const finishPartial = () => {
    onTaskChange({ type: 'finish_partial' })
    onFinishPartial(Math.min(99, progress))
  }

  return <section className="analysis-task-panel" aria-labelledby="analysis-task-title">
    <header><div><p className="section-kicker">模拟分析控制</p><h2 id="analysis-task-title">分析进度与预算</h2><p>费用为基于你填写价格的本地估算；MVP 不会调用真实模型服务。</p></div><p className={`task-status task-status-${task.status}`}>{task.status === 'idle' ? '尚未开始' : task.status === 'paused_budget' ? '预算已暂停' : task.status === 'paused_error' ? '模型响应超时' : task.status === 'partial' ? '已保留部分结果' : task.status === 'complete' ? '分析完成' : '分析进行中'}</p></header>
    <div className="task-bars">
      <div><div className="task-bar-heading"><span>分析进度</span><strong>{task.processed} / {task.total} 条（{progress}%）</strong></div><div className="task-bar" role="progressbar" aria-label="分析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div></div>
      <div><div className="task-bar-heading"><span>预算使用</span><strong>{money(task.spent)} / {money(task.cap)}（{budget}% · {budgetState}）</strong></div><div className={`task-bar budget-bar ${budget >= 80 ? 'budget-warning' : ''}`} role="progressbar" aria-label="预算使用" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, budget)}><span style={{ width: `${Math.min(100, budget)}%` }} /></div></div>
    </div>
    <details className="advanced-pricing"><summary>高级模型价格设置</summary><div className="price-inputs" aria-label="模型价格假设"><label>输入价格（每百万 Token）<input type="number" min="0" step="0.1" value={Number.isFinite(inputPerMillion) ? inputPerMillion : ''} aria-invalid={!isValidPrice(inputPerMillion)} aria-describedby={!validPrices ? 'price-error' : undefined} onChange={(event) => onPricesChange({ inputPerMillion: event.target.valueAsNumber, outputPerMillion })} /></label><label>输出价格（每百万 Token）<input type="number" min="0" step="0.1" value={Number.isFinite(outputPerMillion) ? outputPerMillion : ''} aria-invalid={!isValidPrice(outputPerMillion)} aria-describedby={!validPrices ? 'price-error' : undefined} onChange={(event) => onPricesChange({ inputPerMillion, outputPerMillion: event.target.valueAsNumber })} /></label></div></details>
    {validPrices && <p className="next-batch-estimate">下一批 {batchRows} 条预计 {money(nextBatch)}</p>}
    {!validPrices && <p id="price-error" role="alert">模型价格必须填写有限的非负数；修正后才能开始或处理批次。</p>}
    {task.status === 'idle' && !confirmationOpen && <div className="task-actions"><button type="button" className="primary-button" disabled={!validPrices} onClick={() => onTaskChange({ type: 'start' })}>开始批次模拟</button></div>}
    {task.status === 'running' && !confirmationOpen && <div className="task-actions"><button type="button" className="primary-button" disabled={!validPrices} onClick={runBatch}>处理下一批</button><button type="button" className="secondary-button" onClick={() => onTaskChange({ type: 'model_error' })}>模拟模型超时</button><button type="button" className="text-button" disabled={!validPrices} onClick={() => { setConfirmPartial(false); setConfirmBackup(true) }}>切换{backupName}</button><button type="button" className="text-button" onClick={() => { setConfirmBackup(false); setConfirmPartial(true) }}>结束分析并查看部分结果</button></div>}
    {task.status === 'paused_budget' && !confirmationOpen && <div className="task-notice" role="status"><p><strong>预算已暂停。</strong>下一批预计 {money(nextBatch)}，会超过已授权上限。</p><label>追加预算金额<input aria-label="追加预算金额" type="number" min="0.01" step="0.1" value={additionalBudget} onChange={(event) => setAdditionalBudget(event.target.value)} /></label><button type="button" className="primary-button" onClick={continueWithBudget}>追加预算并继续</button><button type="button" className="text-button" onClick={() => { setConfirmPartial(false); setConfirmBackup(true) }}>切换{backupName}</button><button type="button" className="text-button" onClick={() => { setConfirmBackup(false); setConfirmPartial(true) }}>结束分析并查看部分结果</button></div>}
    {task.status === 'paused_error' && !confirmationOpen && <div className="task-notice" role="status"><p><strong>模型响应超时。</strong>已完成的 {task.processed} 条记录和预算保持不变。</p><button type="button" className="primary-button" onClick={() => onTaskChange({ type: 'retry' })}>重试当前批次</button><button type="button" className="text-button" onClick={() => { setConfirmBackup(false); setConfirmPartial(true) }}>结束分析并查看部分结果</button></div>}
    {confirmBackup && <div className="task-confirmation" role="region" aria-label="切换备用模型确认"><p><strong>切换{backupName}？</strong>下一批将从 {money(nextBatch)} 变为 {money(backupBatch)}，{roundedDifference === 0 ? '费用不变' : `${backupCheaper ? '预计节省' : '预计增加'} ${money(Math.abs(roundedDifference))}`}。</p><p>质量取舍：摘要可能更简短，需增加人工复核。</p><button type="button" className="primary-button" onClick={() => { onPricesChange(backupPrices); onTaskChange({ type: 'retry' }); setConfirmBackup(false) }}>确认切换{backupName}</button><button type="button" className="secondary-button" onClick={() => setConfirmBackup(false)}>取消切换</button></div>}
    {confirmPartial && <div className="task-confirmation" role="region" aria-label="部分结果确认"><p><strong>结束分析并查看部分结果？</strong>将保留已完成的 {task.processed} 条，并在问题中心标记其余记录为待分析。</p><button type="button" className="primary-button" onClick={finishPartial}>确认结束并查看部分结果</button><button type="button" className="secondary-button" onClick={() => setConfirmPartial(false)}>继续分析</button></div>}
  </section>
}

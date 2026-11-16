import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../../components/MetricCard'
import { StatusBadge } from '../../components/StatusBadge'
import { dashboardFixtures } from '../../data/mock-ai-fixtures'
import type { Issue } from '../../domain/types'
import { loadAnalysisTask } from '../tasks/analysis-eligibility'
import type { AnalysisTask } from '../tasks/analysis-task'
import { loadActions, type StoredAction } from '../actions/action-workflow'
import { AiRiskBrief } from './AiRiskBrief'
import { ChartErrorBoundary } from './ChartErrorBoundary'
import { buildDashboardViewModel } from './dashboard-metrics'

const DashboardCharts = lazy(() => import('./DashboardCharts'))
const LossReasonBars = lazy(() => import('./LossReasonBars').then((module) => ({ default: module.LossReasonBars })))
const LossTrendChart = lazy(() => import('./LossTrendChart').then((module) => ({ default: module.LossTrendChart })))
const loadIssues = (): Issue[] => { try { return JSON.parse(localStorage.getItem('returnlens:issues') ?? '[]') as Issue[] } catch { return [] } }
const money = (value: number) => `¥${value.toLocaleString('zh-CN')}`
const recoverableRatioText = (low: number, high: number, directLoss: number) => directLoss > 0
  ? `按证据置信度与措施有效率估算，约 ${Math.round(low / directLoss * 100)}%–${Math.round(high / directLoss * 100)}% 可避免`
  : '暂无可计算的可避免比例'
const actionLabels: Record<string, string> = { todo: '待执行', doing: '执行中', verify: '待验证' }
const stateLabels = { paused_budget: '预算已暂停', paused_error: '模型响应超时', partial: '部分结果', running: '分析进行中' }

function DashboardToolbar({ coverage }: { coverage: number }) {
  return <header className="dashboard-header">
    <div><h1 id="dashboard-title">经营总览</h1><p>先处理最有把握挽回的损失；金额为估算区间，执行前需人工复核。</p></div>
    <div className="dashboard-toolbar"><span>当前导入批次</span><span>分析覆盖率 <strong>{coverage}%</strong></span><Link className="secondary-button" to="/import">数据与设置</Link></div>
  </header>
}

function DashboardStateNotice({ task }: { task: AnalysisTask | null }) {
  if (!task || task.status === 'complete' || task.status === 'idle') return null
  return <div className={`dashboard-state-notice dashboard-state-${task.status}`} role="status">
    <strong>{stateLabels[task.status]}</strong>
    <span>已处理 {task.processed} / {task.total} 条 · {Number.isFinite(task.spent) && Number.isFinite(task.cap) ? `预算 ${money(task.spent)} / ${money(task.cap)}` : '预算未记录'}。当前指标仅纳入已完成分析且可行动的问题。</span>
    <Link to="/import">查看分析进度与预算</Link>
  </div>
}

function ActionQueue({ records, issues, priorityCount }: { records: StoredAction[]; issues: Issue[]; priorityCount: number }) {
  return <section className="dashboard-action-queue" aria-labelledby="action-queue-title">
    <header><h2 id="action-queue-title">行动队列</h2><Link to="/actions">查看看板</Link></header>
    <p className="action-queue-note">按可避免损失排序 · 最多 5 项</p>
    {records.length ? <ol>{records.map(({ current }) => {
      const issue = issues.find((item) => item.id === current.issueId)
      return <li key={current.id}>
        <div className="action-queue-title"><Link to={`/actions?focus=${encodeURIComponent(current.id)}`}>{current.title}</Link><StatusBadge tone={current.status === 'verify' ? 'warning' : 'neutral'}>{actionLabels[current.status]}</StatusBadge></div>
        <div className="action-queue-meta"><span>{current.owner || '待分配团队'}</span><time dateTime={current.dueDate || undefined}>{current.dueDate || '待设定日期'}</time></div>
        <p className="action-queue-estimate">{issue ? <><strong>{money(issue.recoverableLow)}–{money(issue.recoverableHigh)}</strong><span>预计可避免损失</span></> : <span>关联问题数据不可用</span>}</p>
      </li>
    })}</ol> : <div className="chart-empty">{priorityCount > 0 ? <Link className="action-empty-link" to="/issues">当前无整改行动。去问题中心复核 {priorityCount} 个高优先级问题，生成整改方案 →</Link> : <><p>暂无待执行、执行中或待验证的行动。</p><Link className="secondary-button" to="/issues">查看问题复核状态</Link></>}</div>}
  </section>
}

export function DashboardPage() {
  const issues = loadIssues()
  const task = loadAnalysisTask() ?? null
  const model = buildDashboardViewModel(issues, task, loadActions())
  const trend = [...dashboardFixtures.recoverableLossTrend.values]

  return <section className="dashboard-page" aria-labelledby="dashboard-title">
    <DashboardToolbar coverage={model.coverage} />
    <DashboardStateNotice task={task} />
    <div className="dashboard-metrics">
      <MetricCard primary label="可避免损失" value={`${money(model.recoverable.low)}–${money(model.recoverable.high)}`} detail="预计范围 · 仅用于优先级排序，非审计结果" />
      <MetricCard label="相关直接损失" value={money(model.directLoss)} detail={recoverableRatioText(model.recoverable.low, model.recoverable.high, model.directLoss)} />
      <MetricCard label="高优先级问题" value={`${model.priorityCount} 个`} detail="待复核、已确认或已修正" />
      <MetricCard label="问题复核" value={`${model.reviewedCount} / ${model.totalIssueCount}`} detail="已确认或已修正 / 全部问题" />
    </div>
    <div className="dashboard-content-grid">
      <ChartErrorBoundary title="商品风险矩阵">
        <Suspense fallback={<div className="dashboard-chart-skeleton" role="status" aria-label="正在加载商品风险矩阵"><span>正在加载商品风险矩阵</span></div>}>
          <DashboardCharts riskPoints={model.riskPoints} matrixUnavailableCount={model.matrixUnavailableCount} />
        </Suspense>
      </ChartErrorBoundary>
      <AiRiskBrief issue={model.actionableIssues[0]} hasAnyIssues={Boolean(issues.length)} />
      <ChartErrorBoundary title="退货原因损失" geometry="dashboard-reasons-skeleton">
        <Suspense fallback={<div className="dashboard-chart-skeleton dashboard-reasons-skeleton" role="status" aria-label="正在加载损失原因" />}>
          <LossReasonBars values={model.reasonLosses} />
        </Suspense>
      </ChartErrorBoundary>
      <ChartErrorBoundary title="损失趋势" geometry="dashboard-trend-skeleton">
        <Suspense fallback={<div className="dashboard-chart-skeleton dashboard-trend-skeleton" role="status" aria-label="正在加载损失趋势" />}>
          <LossTrendChart values={trend} />
        </Suspense>
      </ChartErrorBoundary>
      <ActionQueue records={model.actionQueue} issues={issues} priorityCount={model.priorityCount} />
    </div>
  </section>
}

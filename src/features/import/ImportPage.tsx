import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileUp, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { analyzeDataset } from '../../domain/analysis'
import type { Dataset, Issue, OrderRow, ReturnRow, TextEvidence } from '../../domain/types'
import { clearLocalDemoData, loadDerivedState, saveDerivedState } from '../../lib/storage'
import { clearActions } from '../actions/action-workflow'
import { calculateQuality, parseCsv, requiresMappingConfirmation, separateDiagnostics, suggestFieldMapping, validateMappedFields, validateMappingConfirmation, validateNumericFields } from './csv'
import { maskSensitiveText } from './privacy'
import { buildIssueSessionContext, setIssueSessionContext } from '../issues/issue-session'
import { AnalysisTaskPanel } from '../tasks/AnalysisTaskPanel'
import { buildAnalysisBatches } from '../tasks/analysis-progress'
import { reduceAnalysisTask } from '../tasks/analysis-task'
import type { AnalysisTask } from '../tasks/analysis-task'

type SlotKey = 'orders' | 'returns' | 'reviews' | 'chats'
type Row = Record<string, string>
type Slot = { label: string; required: string[]; rows: Row[]; columns: string[]; source: string }
type DerivedAnalysisState = { issues: Issue[]; task: AnalysisTask; prices: { inputPerMillion: number; outputPerMillion: number } }

const slotLabels: Record<SlotKey, string> = { orders: '订单', returns: '退货', reviews: '评价', chats: '客服聊天' }
const initialSlots = (): Record<SlotKey, Slot> => ({
  orders: { label: '订单', required: ['order_id', 'sku'], rows: [], columns: [], source: '' },
  returns: { label: '退货', required: ['order_id'], rows: [], columns: [], source: '' },
  reviews: { label: '评价', required: [], rows: [], columns: [], source: '' },
  chats: { label: '客服聊天', required: [], rows: [], columns: [], source: '' },
})

const number = (value: string | undefined) => Number(value)
const value = (row: Row, ...keys: string[]) => keys.map((key) => row[key]).find(Boolean) ?? ''
const monetaryFields: Partial<Record<SlotKey, string[]>> = {
  orders: ['sale_price', 'unit_cost'],
  returns: ['return_shipping_cost', 'inspection_cost', 'restock_cost', 'residual_loss'],
}

export function ImportPage() {
  const [saved] = useState(() => loadDerivedState<DerivedAnalysisState>())
  const [slots, setSlots] = useState(initialSlots)
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const [task, setTask] = useState<AnalysisTask | null>(saved?.task ?? null)
  const [analysisIssues, setAnalysisIssues] = useState<Issue[]>(saved?.issues ?? [])
  const [prices, setPrices] = useState(saved?.prices ?? { inputPerMillion: 0.5, outputPerMillion: 1.5 })
  const navigate = useNavigate()
  const importGeneration = useRef(0)

  useEffect(() => () => { importGeneration.current += 1 }, [])

  const resetDemo = () => {
    importGeneration.current += 1
    clearLocalDemoData()
    setIssueSessionContext({})
    setSlots(initialSlots())
    setMappings({})
    setConfirmations({})
    setTask(null)
    setAnalysisIssues([])
    setPrices({ inputPerMillion: 0.5, outputPerMillion: 1.5 })
    setMessage('本地演示数据与本次会话证据已清除。')
    navigate('/import', { replace: true })
  }

  const diagnostics = useMemo(() => (Object.entries(slots) as [SlotKey, Slot][]).flatMap(([key, slot]) => {
    const fieldMappings = Object.fromEntries(slot.required.map((field) => [field, mappings[`${key}:${field}`] ?? suggestFieldMapping(slot.columns, field).column]))
    const validation = validateMappedFields(fieldMappings, slot.required, slot.columns)
    const numeric = monetaryFields[key] ? validateNumericFields(slot.rows, monetaryFields[key]) : { blocking: [], warnings: [] }
    const confirmationsNeeded = slot.required.flatMap((field) => {
      const chosen = fieldMappings[field]
      const isRisky = requiresMappingConfirmation(slot.columns, field, chosen)
      return validateMappingConfirmation(isRisky, Boolean(confirmations[`${key}:${field}`])) ? [`${slot.label}：请确认 ${chosen} 映射到${field === 'order_id' ? '订单编号' : '商品编码'}`] : []
    })
    return validation.blocking.map((item) => `${slot.label}：${item}`)
      .concat(validation.warnings.map((item) => `${slot.label}：建议补充 ${item}`), numeric.blocking.map((item) => `${slot.label}：${item}`), confirmationsNeeded)
  }), [confirmations, mappings, slots])
  const { blocking, warnings } = separateDiagnostics(diagnostics)
  const totalRows = Object.values(slots).reduce((sum, slot) => sum + slot.rows.length, 0)
  const quality = calculateQuality(totalRows, blocking, warnings)

  useEffect(() => {
    if (task) saveDerivedState({ issues: analysisIssues, task, prices })
  }, [analysisIssues, prices, task])

  const loadText = (key: SlotKey, source: string, input: string) => {
    try {
      const rows = parseCsv<Row>(input)
      const columns = Object.keys(rows[0] ?? {})
      setSlots((current) => ({ ...current, [key]: { ...current[key], rows, columns, source } }))
      setMappings((current) => Object.fromEntries(Object.entries(current).filter(([mappingKey]) => !mappingKey.startsWith(`${key}:`))))
      setConfirmations((current) => Object.fromEntries(Object.entries(current).filter(([mappingKey]) => !mappingKey.startsWith(`${key}:`))))
      setMessage(`${slotLabels[key]}数据已读取 ${rows.length} 行；原始文件仅保留在本次浏览器会话中。`)
    } catch (error) {
      setMessage(`无法读取${slotLabels[key]} CSV：${error instanceof Error ? error.message : '格式错误'}`)
    }
  }

  const loadFile = async (key: SlotKey, file: File) => {
    const generation = importGeneration.current
    try {
      const text = await file.text()
      if (generation === importGeneration.current) loadText(key, file.name, text)
    } catch {
      if (generation === importGeneration.current) setMessage(`无法读取${slotLabels[key]} CSV：文件读取失败`)
    }
  }

  const useDemo = async () => {
    const generation = importGeneration.current
    setMessage('正在读取内置模拟品牌数据…')
    try {
      const entries = await Promise.all((Object.keys(slotLabels) as SlotKey[]).map(async (key) => {
        const response = await fetch(`/demo/${key}.csv`)
        if (!response.ok) throw new Error(`${slotLabels[key]}示例不可用`)
        return [key, await response.text()] as const
      }))
      if (generation !== importGeneration.current) return
      entries.forEach(([key, text]) => loadText(key, `内置模拟品牌 · ${key}.csv`, text))
      setMessage('已加载内置模拟品牌数据，可检查字段后开始模拟分析。')
    } catch (error) { if (generation === importGeneration.current) setMessage(error instanceof Error ? error.message : '示例数据加载失败') }
  }

  const mapping = (key: SlotKey, field: string) => mappings[`${key}:${field}`] ?? suggestFieldMapping(slots[key].columns, field).column
  const beginAnalysis = () => {
    if (blocking.length || !slots.orders.rows.length || !slots.returns.rows.length) {
      setMessage('请先修复阻断问题，并上传订单与退货数据。')
      return
    }
    const dataset: Dataset = {
      orders: slots.orders.rows.map((row): OrderRow => ({ orderId: value(row, mapping('orders', 'order_id'), 'order_id'), sku: value(row, mapping('orders', 'sku'), 'sku'), productName: value(row, 'product_name'), size: value(row, 'size'), color: value(row, 'color'), channel: value(row, 'channel'), salePrice: number(value(row, 'sale_price')), unitCost: number(value(row, 'unit_cost')), orderedAt: value(row, 'ordered_at') })),
      returns: slots.returns.rows.map((row): ReturnRow => ({ returnId: value(row, 'return_id'), orderId: value(row, mapping('returns', 'order_id'), 'order_id'), reason: maskSensitiveText(value(row, 'return_reason', 'reason')), returnedAt: value(row, 'returned_at'), returnShippingCost: number(value(row, 'return_shipping_cost')), inspectionCost: number(value(row, 'inspection_cost')), restockCost: number(value(row, 'restock_cost')), residualLoss: number(value(row, 'residual_loss')) })),
      evidence: ([...slots.reviews.rows.map((row): TextEvidence => ({ id: value(row, 'review_id'), orderId: value(row, 'order_id'), source: 'review', text: maskSensitiveText(value(row, 'review_text', 'text')) })), ...slots.chats.rows.map((row): TextEvidence => ({ id: value(row, 'chat_id'), orderId: value(row, 'order_id'), source: 'chat', text: maskSensitiveText(value(row, 'message_text', 'text')) }))]),
    }
    const issues: Issue[] = analyzeDataset(dataset)
    clearActions()
    setIssueSessionContext(buildIssueSessionContext(issues, dataset))
    localStorage.setItem('returnlens:issues', JSON.stringify(issues))
    setAnalysisIssues(issues)
    setTask({ status: 'idle', processed: 0, total: dataset.returns.length, spent: 0, cap: 0.6, batches: buildAnalysisBatches(dataset, issues), completedIssueIds: [] })
    setMessage(`模拟生成：已完成本地脱敏与确定性分析，识别 ${issues.length} 个问题。继续按批次模拟分析，且仅保存派生问题结果。新分析已替换旧数据，整改动作及版本历史已清除。`)
  }

  const finishPartial = (coverage: number) => {
    if (!task) return
    const partial = reduceAnalysisTask(task, { type: 'finish_partial' })
    setTask(partial)
    saveDerivedState({ issues: analysisIssues, task: partial, prices })
    navigate(`/issues?coverage=${coverage}`, { state: { toast: '已结束分析，正在查看部分结果。' } })
  }

  return <section className="import-page" aria-labelledby="import-title">
    <header className="import-header"><div><p className="section-kicker">数据与设置</p><h1 id="import-title">导入经营数据</h1><p>CSV 在浏览器内读取、校验并脱敏，确认后进行模拟生成分析。</p></div><button className="primary-button" type="button" onClick={useDemo}>使用内置模拟品牌</button></header>
    <p className="import-message">每次开始新分析都会清除上一份数据的整改动作及版本历史。<button className="text-button" type="button" onClick={resetDemo}>清除本地演示数据</button></p>
    <div className="import-workbench">
      <div className="import-data-column">
        <div className="trust-banner"><ShieldCheck aria-hidden="true" size={20} /><span>演示数据已在本地完成脱敏，MVP 不会发送至外部模型服务</span></div>
        <section className="import-grid" aria-label="CSV 文件导入">
          {(Object.keys(slotLabels) as SlotKey[]).map((key) => { const slot = slots[key]; return <article className="file-slot" key={`${key}:${importGeneration.current}`}><div className="slot-heading"><div><h2>{slot.label} CSV</h2><p>{slot.source || '尚未选择文件'}</p></div><span>{slot.rows.length ? `${slot.rows.length} 行` : '待导入'}</span></div><input id={`${key}-file`} type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(key, file) }} /><label className="secondary-button file-picker" htmlFor={`${key}-file`}><FileUp size={16} aria-hidden="true" />选择 CSV 文件</label>{slot.required.map((field) => { const suggestion = suggestFieldMapping(slot.columns, field); const chosen = mapping(key, field); const mappingKey = `${key}:${field}`; const isRisky = requiresMappingConfirmation(slot.columns, field, chosen); return <div className="mapping-row" key={field}><label htmlFor={`${key}-${field}`}>{field === 'order_id' ? '订单编号' : '商品编码'}</label><select id={`${key}-${field}`} value={chosen} onChange={(event) => { setMappings((current) => ({ ...current, [mappingKey]: event.target.value })); setConfirmations((current) => ({ ...current, [mappingKey]: false })) }}><option value="">请选择字段</option>{slot.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><small>置信度 {Math.round((chosen === suggestion.column ? suggestion.confidence : 0.68) * 100)}%{isRisky ? '，需人工确认' : ''}</small>{suggestion.requiresReview && <button type="button" className="text-button" onClick={() => { setMappings((current) => ({ ...current, [mappingKey]: suggestion.column })); setConfirmations((current) => ({ ...current, [mappingKey]: false })) }}>AI 智能匹配 · 模拟</button>}{isRisky && <label className="confirmation"><input type="checkbox" checked={Boolean(confirmations[mappingKey])} onChange={(event) => setConfirmations((current) => ({ ...current, [mappingKey]: event.target.checked }))} />我已确认此字段映射</label>}</div> })}</article> })}
        </section>
        <div className="import-actions"><a className="download-link" href="/demo/orders.csv" download><Download size={16} aria-hidden="true" />下载示例数据</a></div>
      </div>
      <aside className="import-control-column" role="region" aria-label="分析预算与进度">
        <section className="quality-panel" aria-live="polite"><div><p className="section-kicker">数据质量</p><strong>{quality}%</strong><p>字段越完整，越能将退货原因归因到具体商品并估算可挽回损失。</p></div><div className="quality-details"><h2>校验结果</h2>{blocking.length > 0 && <div className="blocking"><b>阻断问题</b><ul>{blocking.map((item) => <li key={item}>{item}</li>)}</ul></div>}{warnings.length > 0 && <div className="warnings"><b>非阻断提醒</b><ul>{warnings.map((item) => <li key={item}>{item}</li>)}</ul></div>}{!blocking.length && !warnings.length && <p>暂无问题。订单与退货数据齐备后即可分析。</p>}</div></section>
        <div className="import-actions import-analysis-action"><button className="primary-button" type="button" onClick={beginAnalysis} disabled={!totalRows}>开始模拟分析</button></div>
        <AnalysisTaskPanel task={task} inputPerMillion={prices.inputPerMillion} outputPerMillion={prices.outputPerMillion} onPricesChange={setPrices} onTaskChange={(event) => setTask((current) => current ? reduceAnalysisTask(current, event) : current)} onAddBudget={(amount) => setTask((current) => current ? { ...current, cap: current.cap + amount } : current)} onFinishPartial={finishPartial} />
        {task?.status === 'complete' && <p className="analysis-complete" role="status">分析已完成。<Link to="/issues">查看完整问题结果</Link></p>}
      </aside>
    </div>
    {message && <p className="import-message" role="status">{message}</p>}
  </section>
}

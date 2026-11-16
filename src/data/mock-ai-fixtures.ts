export const summaries = {
  size: { label: '模拟生成', hypothesis: '尺码表可能低估 M/L 码的实际穿着空间', recommendation: '复测实物尺寸，并验证详情页尺码说明' },
  material: { label: '模拟生成', hypothesis: '详情页对面料厚度的表达可能高于消费者实际感受', recommendation: '补充克重、透光与近景材质说明' },
  color: { label: '模拟生成', hypothesis: '当前色差反馈样本不足', recommendation: '继续观察并补充直播与客服证据' },
  quality: { label: '模拟生成', hypothesis: '做工问题集中于特定批次', recommendation: '核对批次与供应商质检记录' },
  logistics: { label: '模拟生成', hypothesis: '运输破损可能与包装抗压不足有关', recommendation: '抽检包装并比较承运渠道' },
  expectation: { label: '模拟生成', hypothesis: '内容展示可能造成上身效果预期偏差', recommendation: '增加不同身形试穿与限制说明' },
  other: { label: '模拟生成', hypothesis: '暂未形成稳定原因', recommendation: '补充证据后重新分析' },
} as const

export const actionDrafts = {
  size: { title: '补充尺码说明', touchpoint: '详情页第二屏', content: '增加“偏小可选大一码”提示，并补充实测尺寸对照图。', targetMetric: '相关退货率下降 15%', experimentDays: 14 },
  material: { title: '补充面料信息', touchpoint: '详情页材质模块', content: '补充克重、透光程度和近景材质视频，明确薄厚体感。', targetMetric: '相关退货率下降 12%', experimentDays: 14 },
  color: { title: '校准颜色展示', touchpoint: '商品主图与详情页', content: '增加自然光实拍与色差说明，并记录不同屏幕的展示差异。', targetMetric: '色差相关退货率下降 10%', experimentDays: 14 },
  quality: { title: '核查质量批次', touchpoint: '供应商质检流程', content: '按批次复核质检记录，并对异常批次增加出库抽检。', targetMetric: '质量相关退货率下降 20%', experimentDays: 21 },
  logistics: { title: '加强包装抗压', touchpoint: '发货包装流程', content: '增加易损部位缓冲材料，并比较承运渠道的破损率。', targetMetric: '运输破损率下降 15%', experimentDays: 21 },
  expectation: { title: '补充上身展示', touchpoint: '详情页试穿模块', content: '增加不同身形试穿、尺码建议与效果边界说明。', targetMetric: '预期偏差退货率下降 12%', experimentDays: 14 },
  other: { title: '补充问题证据', touchpoint: '商品详情页', content: '补充用户反馈与页面信息后，再验证可执行的整改假设。', targetMetric: '相关退货率下降 8%', experimentDays: 14 },
} as const

export const dashboardFixtures = {
  recoverableLossTrend: { label: '模拟时间序列 · 近 6 个观察日', values: [2480, 2290, 2380, 2140, 2010, 1860] },
} as const

export const experimentFixtures = [
  { id: 'EXP-001', title: '尺码说明补充', status: '有效', tone: 'success' as const, baseline: '18.6%', current: '15.2%', duration: '21 天', coverage: '1,248 笔订单（94%）', recoverableLoss: { low: 1480, base: 2470, high: 3460 }, cost: '¥0.42', conclusion: '退货率相对下降 18.3%，超过 15% 目标，建议扩大到更多尺码。' },
  { id: 'EXP-002', title: '面料信息补充', status: '无显著变化', tone: 'neutral' as const, baseline: '12.4%', current: '11.9%', duration: '14 天', coverage: '836 笔订单（89%）', recoverableLoss: { low: 520, base: 850, high: 1180 }, cost: '¥0.31', conclusion: '置信区间与基线重叠，暂不能归因于本次改动。' },
  { id: 'EXP-003', title: '自然光颜色展示', status: '证据不足', tone: 'warning' as const, baseline: '9.8%', current: '8.9%', duration: '5 天', coverage: '143 笔订单（41%）', recoverableLoss: { low: 90, base: 205, high: 320 }, cost: '¥0.08', conclusion: '观察期和样本量不足；延长至 14 天后再做判断。' },
] as const

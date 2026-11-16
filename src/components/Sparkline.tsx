interface SparklineProps {
  values: number[]
  label: string
}

export function Sparkline({ values, label }: SparklineProps) {
  const width = 132
  const height = 40
  const finiteValues = values.filter(Number.isFinite)
  const min = Math.min(...finiteValues)
  const max = Math.max(...finiteValues)
  const range = max - min || 1
  const points = finiteValues.map((value, index) => `${finiteValues.length === 1 ? width / 2 : index * width / (finiteValues.length - 1)},${finiteValues.length === 1 ? height / 2 : height - ((value - min) / range) * (height - 6) - 3}`).join(' ')

  return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>
}

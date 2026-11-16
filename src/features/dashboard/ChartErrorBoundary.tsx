import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export class ChartErrorBoundary extends Component<{
  title: string
  geometry?: string
  children: ReactNode
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className={`dashboard-chart-skeleton dashboard-chart-error ${this.props.geometry ?? ''}`} role="alert" aria-label={`${this.props.title}暂不可用`}>
      <h2>{this.props.title}</h2>
      <p>图表暂不可用，请前往问题中心查看分析结果。</p>
      <Link to="/issues">前往问题中心</Link>
    </section>
  }
}

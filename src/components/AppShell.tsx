import { NavLink, Outlet } from 'react-router-dom'
import { ChartNoAxesCombined, ClipboardCheck, FlaskConical, LayoutDashboard, Settings } from 'lucide-react'

const nav = [
  ['/', '经营总览', LayoutDashboard],
  ['/issues', '问题中心', ChartNoAxesCombined],
  ['/actions', '整改看板', ClipboardCheck],
  ['/experiments', '实验复盘', FlaskConical],
] as const

function LogoMark() {
  return <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--ink)" />
    <path d="M16 7.3 21.2 10l-3.28 4.1H11.5L16 7.3Z" fill="var(--surface)" />
    <path d="m23.65 12.05.1 5.82-5.17-.73-2.45-5.95 7.52.86Z" fill="#b8ddcc" />
    <path d="m21.5 21.95-5.12 2.77-1.9-4.86 3.97-5.08 3.05 7.17Z" fill="var(--surface)" />
    <path d="m10.3 23.17-3.15-4.9 4.65-2.37 6.16 1.87-7.66 5.4Z" fill="#8fc3aa" />
    <circle cx="16" cy="16" r="2.25" fill="var(--forest)" stroke="var(--surface)" strokeWidth="1.2" />
  </svg>
}

export function AppShell() {
  return <>
    <div className="app-shell desktop-product">
      <a className="skip-link" href="#main-content">跳转到主要内容</a>
      <aside className="sidebar">
        <div className="brand"><LogoMark /><span className="brand-copy">ReturnLens</span></div>
        <nav aria-label="主导航">
          <p className="nav-group-label">经营决策</p>
          {nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className="nav-link" title={label}><Icon size={19} aria-hidden="true" /><span className="nav-label">{label}</span></NavLink>)}
        </nav>
        <div className="settings-group">
          <p className="nav-group-label">系统</p>
          <NavLink to="/import" className="nav-link settings-link" title="数据与设置"><Settings size={19} aria-hidden="true" /><span className="nav-label">数据与设置</span></NavLink>
        </div>
      </aside>
      <main className="page" id="main-content" tabIndex={-1}><Outlet /></main>
    </div>
    <div className="mobile-notice">ReturnLens MVP 请使用平板或桌面浏览器查看。</div>
  </>
}

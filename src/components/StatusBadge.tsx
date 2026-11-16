interface StatusBadgeProps {
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  children: string
}

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}><span aria-hidden="true" />{children}</span>
}

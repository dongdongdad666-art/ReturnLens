export function RouteFallback() {
  return <section className="route-fallback" role="status" aria-label="正在加载页面">
    <span className="sr-only">正在加载页面</span>
    <div className="route-fallback-heading" aria-hidden="true" />
    <div className="route-fallback-grid" aria-hidden="true"><i /><i /><i /></div>
  </section>
}

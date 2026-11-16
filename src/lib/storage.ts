const key = 'returnlens:derived-state:v1'

export function saveDerivedState(value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadDerivedState<T>(): T | null {
  const stored = localStorage.getItem(key)
  if (!stored) return null
  try { return JSON.parse(stored) as T } catch { return null }
}

export function clearDerivedState() {
  localStorage.removeItem(key)
}

export function clearLocalDemoData() {
  Object.keys(localStorage).filter((item) => item.startsWith('returnlens:')).forEach((item) => localStorage.removeItem(item))
}

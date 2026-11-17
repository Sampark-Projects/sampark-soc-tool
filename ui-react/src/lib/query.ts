export type FilterValue = string | string[]
export type Filters = Record<string, FilterValue>

export const RANGES = [
  { key: '1h', label: 'Last hour', ms: 3600e3 },
  { key: '24h', label: 'Last 24 hours', ms: 24 * 3600e3 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 3600e3 },
  { key: '30d', label: 'Last 30 days', ms: 30 * 24 * 3600e3 },
  { key: 'all', label: 'All time', ms: 0 },
]

export function rangeParams(key: string, now = Date.now()) {
  const r = RANGES.find((x) => x.key === key) ?? RANGES[1]
  return { from: r.ms ? String(Math.floor((now - r.ms) / 1000)) : '0', to: String(Math.floor(now / 1000)), ms: r.ms }
}

// Dashboard-level (saved search) filter + panel filter + the analyst's own filters.
export function mergeFilters(...fs: (Filters | undefined)[]): string | undefined {
  const out: Filters = {}
  for (const f of fs) if (f) Object.assign(out, f)
  return Object.keys(out).length ? JSON.stringify(out) : undefined
}

export function describeFilter(k: string, v: FilterValue) {
  const neg = k.startsWith('!')
  return `${neg ? 'NOT ' : ''}${neg ? k.slice(1) : k}: ${Array.isArray(v) ? v.join(' | ') : v}`
}

// Flatten a (possibly nested) _source into dotted keys.
export function flatten(obj: any, prefix = '', out: Record<string, any> = {}) {
  if (obj === null || obj === undefined) return out
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix] = obj
    return out
  }
  for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  return out
}

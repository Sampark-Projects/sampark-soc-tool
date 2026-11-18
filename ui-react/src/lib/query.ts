export type FilterValue = string | string[]
export type Filters = Record<string, FilterValue>

export const RANGES = [
  { key: '1h', label: 'Last hour', ms: 3600e3 },
  { key: '24h', label: 'Last 24 hours', ms: 24 * 3600e3 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 3600e3 },
  { key: '30d', label: 'Last 30 days', ms: 30 * 24 * 3600e3 },
  { key: 'all', label: 'All time', ms: 0 },
]

// A custom range is carried in the same string as the presets: "custom:<fromMs>:<toMs>".
export const makeCustom = (fromMs: number, toMs: number) => `custom:${Math.floor(fromMs)}:${Math.floor(toMs)}`
export function parseCustom(key: string): { from: number; to: number } | null {
  if (!key || !key.startsWith('custom')) return null
  const [, a, b] = key.split(':')
  const from = Number(a)
  const to = Number(b)
  return Number.isFinite(from) && Number.isFinite(to) && to > from ? { from, to } : null
}

// The window a range key stands for, in ms. 'all' has from 0.
export function resolveRange(key: string, now = Date.now()) {
  const c = parseCustom(key)
  if (c) return { from: c.from, to: c.to, ms: c.to - c.from, all: false, custom: true }
  const r = RANGES.find((x) => x.key === key) ?? RANGES[1]
  return { from: r.ms ? now - r.ms : 0, to: now, ms: r.ms, all: !r.ms, custom: false }
}

export function rangeLabel(key: string): string {
  const c = parseCustom(key)
  if (c) return `${new Date(c.from).toLocaleString()} – ${new Date(c.to).toLocaleString()}`
  return (RANGES.find((x) => x.key === key) ?? RANGES[1]).label
}

export function rangeParams(key: string, now = Date.now()) {
  const r = resolveRange(key, now)
  return { from: r.all ? '0' : String(Math.floor(r.from / 1000)), to: String(Math.floor(r.to / 1000)), ms: r.ms }
}

// True when a timestamp (ms, seconds or an ISO string) falls inside the chosen range; 'all' keeps everything.
export function inRange(ts: unknown, key: string, now = Date.now()): boolean {
  const r = resolveRange(key, now)
  if (r.all) return true
  let n = typeof ts === 'number' ? ts : Date.parse(String(ts ?? ''))
  if (typeof ts === 'string' && /^\d+(\.\d+)?$/.test(ts)) n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return false
  if (n < 1e12) n *= 1000
  return n >= r.from && n <= (r.custom ? r.to : r.to + 60e3)
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

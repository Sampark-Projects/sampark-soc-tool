import { useEffect, useMemo, useRef, useState } from 'react'
import { getJSON, sampledNote } from '../api'
import { PanelDef } from '../data/catalog'
import { Filters, mergeFilters, rangeParams } from '../lib/query'
import BarList, { Bucket } from './BarList'
import TimeChart, { TimePoint } from './TimeChart'
import { ControlsPanel, FileTreePanel, SankeyPanel, TreePanel } from './FlowPanels'

export interface Ctx {
  range: string
  base: Filters // dashboard (saved search) filter + analyst filters
  refreshKey: number
  onPick: (field: string, value: string) => void
  onClear?: (field: string) => void
}

// Run the panel's request only once it scrolls into view (a dashboard can have 20+ panels).
export function useVisible() {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen || !ref.current) return
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { rootMargin: '200px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen])
  return { ref, seen }
}

const flattenBuckets = (node: any, fields: string[], depth: number, prefix: string[], rows: { path: string[]; count: number }[]) => {
  for (const b of node?.buckets ?? []) {
    const path = [...prefix, String(b.key)]
    if (depth + 1 < fields.length) flattenBuckets(b[fields[depth + 1]], fields, depth + 1, path, rows)
    else rows.push({ path, count: b.doc_count })
  }
}

const SAMPLED_NOTE = sampledNote

function TermsPanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  const { ref, seen } = useVisible()
  const [data, setData] = useState<{ buckets?: Bucket[]; rows?: { path: string[]; count: number }[]; sampled?: number } | null>(null)
  const [error, setError] = useState(false)
  const filter = mergeFilters(ctx.base, p.filter)
  // a field listed twice (a saved-object split on the same field) adds nothing and trips some servers
  const fields = useMemo(() => Array.from(new Set(p.fields)), [p.fields])

  useEffect(() => {
    if (!seen) return
    let alive = true
    setData(null)
    setError(false)
    const { from, to } = rangeParams(ctx.range)
    getJSON(`/mapi/agg/${fields.map(encodeURIComponent).join(',')}`, { from, to, filter, limit: 10 }, { sampleOnError: true })
      .then((r) => {
        if (!alive) return
        if (fields.length === 1) setData({ buckets: r?.[fields[0]]?.buckets ?? [], sampled: r?.sampled })
        else {
          const rows: { path: string[]; count: number }[] = []
          flattenBuckets(r?.[fields[0]], fields, 0, [], rows)
          setData({ rows: rows.sort((a, b) => b.count - a.count).slice(0, 25), sampled: r?.sampled })
        }
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [seen, ctx.range, filter, ctx.refreshKey, fields])

  if (fields.length === 1)
    return (
      <div ref={ref}>
        <BarList
          title={p.title}
          buckets={data?.buckets ?? []}
          loading={!error && data === null}
          error={error}
          note={data?.sampled !== undefined ? SAMPLED_NOTE(data.sampled) : undefined}
          onSelect={(v) => ctx.onPick(fields[0], v)}
        />
      </div>
    )

  return (
    <div ref={ref} className="card">
      <h3>{p.title}</h3>
      {error && <p className="err small">Server error for this panel (the field may not be indexed on this server)</p>}
      {!error && data === null && <p className="muted">Loading…</p>}
      {data?.sampled !== undefined && !error && <p className="muted small">{SAMPLED_NOTE(data.sampled)}</p>}
      {data?.rows && data.rows.length === 0 && <p className="muted">No data</p>}
      {data?.rows && data.rows.length > 0 && (
        <table>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f}>{f.split('.').slice(-2).join('.')}</th>
              ))}
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i}>
                {r.path.map((v, j) => (
                  <td key={j}>
                    <button className="link" onClick={() => ctx.onPick(fields[j], v)}>
                      {v}
                    </button>
                  </td>
                ))}
                <td>{r.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const SLICES = 24

function TimePanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  const { ref, seen } = useVisible()
  const [pts, setPts] = useState<TimePoint[] | null>(null)
  const [error, setError] = useState(false)
  const filter = mergeFilters(ctx.base, p.filter)

  useEffect(() => {
    if (!seen) return
    let alive = true
    setPts(null)
    setError(false)
    const now = Date.now()
    const { ms } = rangeParams(ctx.range, now)
    const span = ms || 30 * 24 * 3600e3 // "All time": last 30 days
    const step = span / SLICES
    const start = now - span
    Promise.all(
      Array.from({ length: SLICES }, (_, i) =>
        getJSON('/mapi/document', {
          from: String(Math.floor((start + i * step) / 1000)),
          to: String(Math.floor((start + (i + 1) * step) / 1000) - 1),
          filter,
          limit: 0,
          track_total_hits: 'true',
        }).then((r) => ({ t: start + i * step, count: typeof r?.total === 'object' && r.total ? r.total.value : (r?.total ?? 0) })),
      ),
    )
      .then((x) => alive && setPts(x))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [seen, ctx.range, filter, ctx.refreshKey])

  return (
    <div ref={ref} className="card wide-card">
      <h3>{p.title}</h3>
      {error && <p className="err small">Server error for this panel (the field may not be indexed on this server)</p>}
      {!error && pts === null && <p className="muted">Loading…</p>}
      {pts && <TimeChart points={pts} />}
    </div>
  )
}

function MetricPanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  const { ref, seen } = useVisible()
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const filter = mergeFilters(ctx.base, p.filter)
  const unique = p.metric === 'cardinality' && !!p.metricField

  useEffect(() => {
    if (!seen) return
    let alive = true
    setValue(null)
    setError(false)
    const { from, to } = rangeParams(ctx.range)
    const req = unique
      ? getJSON(`/mapi/agg/${encodeURIComponent(p.metricField!)}`, { from, to, filter, limit: 500 }, { sampleOnError: true }).then((r) => {
          const n = r?.[p.metricField!]?.buckets?.length ?? 0
          return n >= 500 ? '500+' : String(n)
        })
      : getJSON('/mapi/document', { from, to, filter, limit: 0, track_total_hits: 'true' }).then((r) => {
          const t = typeof r?.total === 'object' && r.total ? r.total.value : r?.total
          return t == null ? '—' : Number(t).toLocaleString()
        })
    req.then((v) => alive && setValue(v)).catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [seen, ctx.range, filter, ctx.refreshKey, unique, p.metricField])

  return (
    <div ref={ref} className="card kpi">
      <span className="muted">
        {p.title}
        {unique ? ' (unique)' : ''}
      </span>
      <strong>{error ? '—' : (value ?? '…')}</strong>
    </div>
  )
}

export default function PanelView({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  if (p.kind === 'terms') return <TermsPanel p={p} ctx={ctx} />
  if (p.kind === 'time') return <TimePanel p={p} ctx={ctx} />
  if (p.kind === 'metric') return <MetricPanel p={p} ctx={ctx} />
  if (p.kind === 'sankey') return <SankeyPanel p={p} ctx={ctx} />
  if (p.kind === 'tree') return <TreePanel p={p} ctx={ctx} />
  if (p.kind === 'controls') return <ControlsPanel p={p} ctx={ctx} />
  if (p.kind === 'filetree') return <FileTreePanel p={p} ctx={ctx} />
  return null // maps / vega / free-form visualizations: see "Open original"
}

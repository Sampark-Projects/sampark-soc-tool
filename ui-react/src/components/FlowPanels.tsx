import { useEffect, useMemo, useState } from 'react'
import { getJSON, pick, sampledNote } from '../api'
import { PanelDef } from '../data/catalog'
import { mergeFilters, rangeParams } from '../lib/query'
import type { Ctx } from './PanelView'
import { useVisible } from './PanelView'

// Rebuilds of the custom Vega visualizations (Sankey flows, connection trees) and the
// "input controls" filter panel, all from nested /mapi/agg/<a>,<b>[,<c>] aggregations.

interface Edge { a: string; b: string; count: number }

function useNested(p: PanelDef, ctx: Ctx, limit: number) {
  const { ref, seen } = useVisible()
  const [root, setRoot] = useState<any>(null)
  const [sampled, setSampled] = useState<number | undefined>(undefined)
  const [error, setError] = useState(false)
  const filter = mergeFilters(ctx.base, p.filter)
  useEffect(() => {
    if (!seen) return
    let alive = true
    setRoot(null)
    setSampled(undefined)
    setError(false)
    const { from, to } = rangeParams(ctx.range)
    getJSON(`/mapi/agg/${p.fields.map(encodeURIComponent).join(',')}`, { from, to, filter, limit }, { sampleOnError: true })
      .then((r) => {
        if (!alive) return
        setRoot(r?.[p.fields[0]] ?? { buckets: [] })
        setSampled(r?.sampled)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [seen, ctx.range, filter, ctx.refreshKey, p.fields, limit])
  return { ref, root, error, sampled }
}

// ---------------------------------------------------------------- Sankey

const W = 640
const H = 380
const PAD = 5
const LEFT = 170
const RIGHT = W - 170

export function SankeyPanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  const { ref, root, error, sampled } = useNested(p, ctx, 12)
  const [fa, fb] = p.fields

  const model = useMemo(() => {
    if (!root) return null
    const edges: Edge[] = []
    for (const ba of root.buckets ?? []) for (const bb of ba[fb]?.buckets ?? []) edges.push({ a: String(ba.key), b: String(bb.key), count: bb.doc_count })
    const sum = (key: 'a' | 'b') => {
      const m = new Map<string, number>()
      edges.forEach((e) => m.set(e[key], (m.get(e[key]) ?? 0) + e.count))
      return [...m.entries()].sort((x, y) => y[1] - x[1])
    }
    const left = sum('a')
    const right = sum('b')
    const total = Math.max(1, left.reduce((s, [, v]) => s + v, 0), right.reduce((s, [, v]) => s + v, 0))
    const usable = H - 20 - PAD * Math.max(left.length, right.length)
    const k = Math.max(0.0001, usable / total)
    const place = (list: [string, number][]) => {
      let y = 10
      const m = new Map<string, { y: number; h: number; used: number }>()
      for (const [id, v] of list) {
        const h = Math.max(2, v * k)
        m.set(id, { y, h, used: 0 })
        y += h + PAD
      }
      return m
    }
    const L = place(left)
    const R = place(right)
    const links = [...edges]
      .sort((x, y) => (R.get(x.b)!.y - R.get(y.b)!.y) || (L.get(x.a)!.y - L.get(y.a)!.y))
      .map((e) => {
        const h = Math.max(1, e.count * k)
        const l = L.get(e.a)!
        const r = R.get(e.b)!
        const y0 = l.y + l.used + h / 2
        const y1 = r.y + r.used + h / 2
        l.used += h
        r.used += h
        return { ...e, h, y0, y1 }
      })
    return { L, R, links }
  }, [root, fb])

  const empty = model && model.links.length === 0
  return (
    <div className="card" ref={ref} style={{ gridColumn: '1 / -1' }}>
      <h3>{p.title}</h3>
      {error && <p className="err small">Server error for this panel (the field may not be indexed on this server)</p>}
      {sampled !== undefined && !error && <p className="muted small">{sampledNote(sampled)}</p>}
      {!error && !model && <p className="muted">Loading…</p>}
      {empty && <p className="muted">No data</p>}
      {model && !empty && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={p.title}>
          {model.links.map((e, i) => (
            <path
              key={i}
              d={`M${LEFT},${e.y0} C${(LEFT + RIGHT) / 2},${e.y0} ${(LEFT + RIGHT) / 2},${e.y1} ${RIGHT},${e.y1}`}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.35}
              strokeWidth={e.h}
            >
              <title>{`${e.a} → ${e.b}: ${e.count.toLocaleString()}`}</title>
            </path>
          ))}
          {[...model.L.entries()].map(([id, n]) => (
            <g key={'l' + id} style={{ cursor: 'pointer' }} onClick={() => ctx.onPick(fa, id)}>
              <rect x={LEFT - 8} y={n.y} width={8} height={n.h} fill="var(--accent)" />
              <text x={LEFT - 12} y={n.y + n.h / 2} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--text)">
                {id.length > 24 ? id.slice(0, 23) + '…' : id}
              </text>
            </g>
          ))}
          {[...model.R.entries()].map(([id, n]) => (
            <g key={'r' + id} style={{ cursor: 'pointer' }} onClick={() => ctx.onPick(fb, id)}>
              <rect x={RIGHT} y={n.y} width={8} height={n.h} fill="var(--ok)" />
              <text x={RIGHT + 12} y={n.y + n.h / 2} dominantBaseline="middle" fontSize="11" fill="var(--text)">
                {id.length > 24 ? id.slice(0, 23) + '…' : id}
              </text>
            </g>
          ))}
        </svg>
      )}
      <p className="muted small">
        {fa} → {fb}. Click a label to filter the dashboard.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- Tree

function TreeNode({ node, fields, depth, ctx }: { node: any; fields: string[]; depth: number; ctx: Ctx }) {
  const [open, setOpen] = useState(depth === 0)
  const children: any[] = depth + 1 < fields.length ? node[fields[depth + 1]]?.buckets ?? [] : []
  return (
    <li>
      <span className="tree-row">
        {children.length > 0 ? (
          <button type="button" className="link" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-leaf">•</span>
        )}
        <button type="button" className="link" onClick={() => ctx.onPick(fields[depth], String(node.key))} title={`Filter ${fields[depth]}`}>
          {String(node.key)}
        </button>
        <span className="muted small"> {node.doc_count.toLocaleString()}</span>
      </span>
      {open && children.length > 0 && (
        <ul className="tree">
          {children.map((c) => (
            <TreeNode key={String(c.key)} node={c} fields={fields} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function TreePanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  const { ref, root, error, sampled } = useNested(p, ctx, 8)
  return (
    <div className="card" ref={ref} style={{ gridColumn: '1 / -1' }}>
      <h3>{p.title}</h3>
      {error && <p className="err small">Server error for this panel (the field may not be indexed on this server)</p>}
      {sampled !== undefined && !error && <p className="muted small">{sampledNote(sampled)}</p>}
      {!error && !root && <p className="muted">Loading…</p>}
      {root && (root.buckets ?? []).length === 0 && <p className="muted">No data</p>}
      {root && (
        <ul className="tree">
          {(root.buckets ?? []).map((b: any) => (
            <TreeNode key={String(b.key)} node={b} fields={p.fields} depth={0} ctx={ctx} />
          ))}
        </ul>
      )}
      <p className="muted small">{p.fields.join(' → ')}</p>
    </div>
  )
}

// ---------------------------------------------------------------- Input controls

function Control({ field, ctx }: { field: string; ctx: Ctx }) {
  const [values, setValues] = useState<string[]>([])
  // The list must not narrow to the already-selected value, so leave this field's own filter out.
  const { [field]: _a, [`!${field}`]: _b, ...others } = ctx.base
  const filter = mergeFilters(others)
  useEffect(() => {
    let alive = true
    const { from, to } = rangeParams(ctx.range)
    getJSON(`/mapi/agg/${encodeURIComponent(field)}`, { from, to, filter, limit: 50 }, { sampleOnError: true })
      .then((r) => alive && setValues((r?.[field]?.buckets ?? []).map((b: any) => String(b.key))))
      .catch(() => alive && setValues([]))
    return () => {
      alive = false
    }
  }, [field, ctx.range, filter, ctx.refreshKey])
  const cur = ctx.base[field]
  const selected = typeof cur === 'string' ? cur : ''
  return (
    <label className="muted small">
      {field}{' '}
      <select value={selected} onChange={(e) => (e.target.value ? ctx.onPick(field, e.target.value) : ctx.onClear?.(field))} aria-label={field}>
        <option value="">All</option>
        {selected && !values.includes(selected) && <option value={selected}>{selected}</option>}
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ControlsPanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  return (
    <div className="toolbar card" style={{ gridColumn: '1 / -1' }}>
      <strong>{p.title}</strong>
      {p.fields.map((f) => (
        <Control key={f} field={f} ctx={ctx} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- File tree (Strelka)

interface FileNode {
  id: string
  parent: string | null
  name: string
  mime: string
  depth: number
  kids: FileNode[]
}

function FileRow({ node, level }: { node: FileNode; level: number }) {
  const [open, setOpen] = useState(level === 0)
  return (
    <li>
      <span className="tree-row">
        {node.kids.length > 0 ? (
          <button type="button" className="link" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-leaf">•</span>
        )}
        <span>{node.name}</span>
        {node.mime && <span className="muted small">{node.mime}</span>}
        {node.kids.length > 0 && <span className="muted small">{node.kids.length} child file{node.kids.length === 1 ? '' : 's'}</span>}
      </span>
      {open && node.kids.length > 0 && (
        <ul className="tree">
          {node.kids.map((k) => (
            <FileRow key={k.id} node={k} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

// Files extracted by Strelka form parent/child trees (an archive containing documents, etc.).
// The original Vega chart drew every node from a 30,000-bucket composite aggregation; this lists the
// most recent files (the document API returns at most 500) as an expandable tree.
export function FileTreePanel({ p, ctx }: { p: PanelDef; ctx: Ctx }) {
  const { ref, seen } = useVisible()
  const [rows, setRows] = useState<any[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState(false)
  const filter = mergeFilters(ctx.base, { 'event.dataset': 'strelka', ...p.filter })
  useEffect(() => {
    if (!seen) return
    let alive = true
    setRows(null)
    setError(false)
    const { from, to } = rangeParams(ctx.range)
    getJSON('/mapi/document', { from, to, filter, limit: 500 })
      .then((r) => {
        if (!alive) return
        setRows((r?.results ?? []).map((x: any) => x?._source ?? {}))
        setTotal(r?.total?.value ?? 0)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [seen, ctx.range, filter, ctx.refreshKey])

  const roots = useMemo(() => {
    if (!rows) return null
    const byId = new Map<string, FileNode>()
    for (const src of rows) {
      const id = pick(src, ['filescan.tree.node'])
      if (!id || byId.has(String(id))) continue
      const parent = pick(src, ['filescan.tree.parent'])
      byId.set(String(id), {
        id: String(id),
        parent: parent ? String(parent) : null,
        name: String(pick(src, ['file.name', 'zeek.files.filename', 'filescan.tree.node'])),
        mime: String(pick(src, ['file.mime_type', 'file.mime']) ?? ''),
        depth: Number(pick(src, ['filescan.tree.depth']) ?? 0),
        kids: [],
      })
    }
    const top: FileNode[] = []
    for (const n of byId.values()) {
      const par = n.parent ? byId.get(n.parent) : undefined
      // a node whose parent is outside this result window is shown at the top
      if (par && par !== n) par.kids.push(n)
      else top.push(n)
    }
    const sortKids = (list: FileNode[]) => {
      list.sort((a, b) => b.kids.length - a.kids.length || a.name.localeCompare(b.name))
      list.forEach((n) => sortKids(n.kids))
    }
    sortKids(top)
    return top
  }, [rows])

  return (
    <div className="card" ref={ref} style={{ gridColumn: '1 / -1' }}>
      <h3>{p.title}</h3>
      {error && <p className="err small">Server error for this panel (the field may not be indexed on this server)</p>}
      {!error && !roots && <p className="muted">Loading…</p>}
      {roots && roots.length === 0 && <p className="muted">No extracted files in this time range</p>}
      {roots && roots.length > 0 && (
        <ul className="tree">
          {roots.slice(0, 200).map((n) => (
            <FileRow key={n.id} node={n} level={0} />
          ))}
        </ul>
      )}
      {roots && total > (rows?.length ?? 0) && (
        <p className="warn-text small">Showing the most recent {rows?.length} of {total.toLocaleString()} files. Narrow the time range to see others.</p>
      )}
    </div>
  )
}

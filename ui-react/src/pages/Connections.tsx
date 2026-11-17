import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getJSON } from '../api'
import { Filters, RANGES, rangeParams } from '../lib/query'
import PageHero from '../components/PageHero'

// Connections graph: nodes are values of two fields, edges are co-occurring pairs weighted by
// document count. Data comes from a nested aggregation: GET /mapi/agg/<a>,<b>.
const PAIRS = [
  { label: 'Source IP → Destination IP', a: 'source.ip', b: 'destination.ip' },
  { label: 'Source IP → Destination port', a: 'source.ip', b: 'destination.port' },
  { label: 'Source IP → Protocol', a: 'source.ip', b: 'network.protocol' },
  { label: 'Source MAC OUI → Destination OUI', a: 'source.oui', b: 'destination.oui' },
  { label: 'Source segment → Destination segment', a: 'source.segment.name', b: 'destination.segment.name' },
  { label: 'Source country → Destination country', a: 'source.geo.country_name', b: 'destination.geo.country_name' },
]
const DATE_TO_RANGE: Record<string, string> = { '1': '1h', '24': '24h', '168': '7d', '720': '30d', '-1': 'all' }
const SRC = '#38bdf8'
const DST = '#34d399'
const BOTH = '#fbbf24'
const W = 900
const H = 560

interface Node { id: string; side: 'a' | 'b' | 'both'; weight: number; x: number; y: number; vx: number; vy: number }
interface Edge { s: string; t: string; count: number }

function layout(edges: Edge[], sides: Map<string, 'a' | 'b' | 'both'>): Node[] {
  const nodes = new Map<string, Node>()
  const get = (id: string) => {
    let n = nodes.get(id)
    if (!n) {
      const i = nodes.size
      const ang = i * 2.399963
      const r = 20 + 12 * Math.sqrt(i)
      n = { id, side: sides.get(id) ?? 'a', weight: 0, x: W / 2 + r * Math.cos(ang), y: H / 2 + r * Math.sin(ang), vx: 0, vy: 0 }
      nodes.set(id, n)
    }
    return n
  }
  edges.forEach((e) => {
    get(e.s).weight += e.count
    get(e.t).weight += e.count
  })
  const list = [...nodes.values()]
  const idx = new Map(list.map((n, i) => [n.id, i]))
  const k = Math.sqrt((W * H) / Math.max(list.length, 1)) * 0.7
  for (let it = 0; it < 250; it++) {
    const cool = 1 - it / 250
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        let dx = a.x - b.x, dy = a.y - b.y
        const d2 = dx * dx + dy * dy || 0.01
        const f = (k * k) / d2
        dx *= f; dy *= f
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy
      }
    }
    for (const e of edges) {
      const a = list[idx.get(e.s)!], b = list[idx.get(e.t)!]
      const dx = a.x - b.x, dy = a.y - b.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = (d * d) / k / d
      a.vx -= dx * f / d; a.vy -= dy * f / d; b.vx += dx * f / d; b.vy += dy * f / d
    }
    for (const n of list) {
      n.vx += (W / 2 - n.x) * 0.01
      n.vy += (H / 2 - n.y) * 0.01
      const sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1
      const lim = 12 * cool + 0.5
      n.x = Math.min(W - 30, Math.max(30, n.x + (n.vx / sp) * Math.min(sp, lim)))
      n.y = Math.min(H - 20, Math.max(20, n.y + (n.vy / sp) * Math.min(sp, lim)))
      n.vx = n.vy = 0
    }
  }
  return list
}

export default function Connections() {
  const [params] = useSearchParams()
  const [pair, setPair] = useState(PAIRS[0])
  const [range, setRange] = useState(DATE_TO_RANGE[params.get('date') ?? ''] ?? 'all')
  const [protocol, setProtocol] = useState('')
  const [limit, setLimit] = useState(40)
  const [minConn, setMinConn] = useState(1)
  const [rawEdges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setSelected(null)
    const { from, to } = rangeParams(range)
    const filter: Filters = protocol.trim() ? { 'network.protocol': protocol.trim() } : {}
    getJSON(`/mapi/agg/${pair.a},${pair.b}`, { from, to, limit, filter: Object.keys(filter).length ? JSON.stringify(filter) : undefined })
      .then((r) => {
        if (!alive) return
        const out: Edge[] = []
        for (const ba of r?.[pair.a]?.buckets ?? [])
          for (const bb of ba?.[pair.b]?.buckets ?? []) out.push({ s: String(ba.key), t: String(bb.key), count: bb.doc_count })
        setEdges(out.sort((x, y) => y.count - x.count).slice(0, 120))
      })
      .catch((e) => alive && (setError(e.message ?? String(e)), setEdges([])))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [pair, range, protocol, limit])

  const edges = useMemo(() => rawEdges.filter((e) => e.count >= minConn), [rawEdges, minConn])
  const { nodes, byId } = useMemo(() => {
    const sides = new Map<string, 'a' | 'b' | 'both'>()
    edges.forEach((e) => {
      sides.set(e.s, sides.get(e.s) === 'b' ? 'both' : 'a')
      sides.set(e.t, sides.get(e.t) === 'a' ? 'both' : 'b')
    })
    const list = layout(edges, sides)
    return { nodes: list, byId: new Map(list.map((n) => [n.id, n])) }
  }, [edges])

  const maxEdge = Math.max(1, ...edges.map((e) => e.count))
  const maxNode = Math.max(1, ...nodes.map((n) => n.weight))
  const docs = edges.reduce((a, e) => a + e.count, 0)
  const top = edges[0]
  const sel = selected ? byId.get(selected) : undefined
  const selEdges = selected ? edges.filter((e) => e.s === selected || e.t === selected) : []
  const focus = hover ?? selected
  const isIp = pair.a === 'source.ip' && selected && /^[0-9a-f:.]+$/i.test(selected)
  const talkers = [...nodes].sort((a, b) => b.weight - a.weight).slice(0, 8)
  const colorOf = (side: 'a' | 'b' | 'both') => (side === 'a' ? SRC : side === 'b' ? DST : BOTH)

  return (
    <>
      <PageHero icon="🕸️" title="Connections" sub="See who talks to whom, as a live graph of your network traffic." href="/arkime/connections" linkLabel="Open PCAP & Indexing view ↗" />

      <div className="ov-kpis">
        <div className="ov-kpi" style={{ ['--c' as any]: SRC }}><span className="ov-kpi-label">Nodes</span><span className="ov-kpi-value">{nodes.length}</span><span className="ov-kpi-hint">{pair.a.split('.').pop()} / {pair.b.split('.').pop()} values</span></div>
        <div className="ov-kpi" style={{ ['--c' as any]: DST }}><span className="ov-kpi-label">Connections</span><span className="ov-kpi-value">{edges.length}</span><span className="ov-kpi-hint">unique pairs</span></div>
        <div className="ov-kpi" style={{ ['--c' as any]: '#818cf8' }}><span className="ov-kpi-label">Documents</span><span className="ov-kpi-value">{docs.toLocaleString()}</span><span className="ov-kpi-hint">across these pairs</span></div>
        <div className="ov-kpi" style={{ ['--c' as any]: BOTH }}><span className="ov-kpi-label">Busiest link</span><span className="ov-kpi-value" style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}>{top ? `${top.s} → ${top.t}` : '—'}</span><span className="ov-kpi-hint">{top ? `${top.count.toLocaleString()} documents` : ''}</span></div>
      </div>

      <div className="toolbar card conn-bar">
        <select value={pair.label} onChange={(e) => setPair(PAIRS.find((p) => p.label === e.target.value)!)} aria-label="Fields">
          {PAIRS.map((p) => (
            <option key={p.label}>{p.label}</option>
          ))}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Time range">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="Query size">
          {[20, 40, 80, 150].map((n) => (
            <option key={n} value={n}>Query size {n}</option>
          ))}
        </select>
        <select value={minConn} onChange={(e) => setMinConn(Number(e.target.value))} aria-label="Minimum connections">
          {[1, 2, 5, 10, 50, 100].map((n) => (
            <option key={n} value={n}>Min connections {n}</option>
          ))}
        </select>
        <input value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="Protocol filter, e.g. dns" aria-label="Protocol" />
        <span className="muted small">{loading ? 'Loading…' : `${nodes.length} nodes, ${edges.length} connections`}</span>
      </div>
      {error && <p className="err">Could not load connections: {error}</p>}

      <div className="conn-grid">
        <section className="ov-card conn-graph">
          <header>
            <h3>Network graph</h3>
            <span className="conn-legend"><i style={{ background: SRC }} />{pair.a.split('.').slice(-2).join('.')} <i style={{ background: DST }} />{pair.b.split('.').slice(-2).join('.')} <i style={{ background: BOTH }} />both</span>
          </header>
          <div className="graph-canvas">
            {!loading && edges.length === 0 && !error && <p className="muted conn-empty">No connections in this time range. Try “All time” or a lower minimum.</p>}
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Connections graph">
              <defs>
                {[['gs', SRC], ['gd', DST], ['gb', BOTH]].map(([id, c]) => (
                  <radialGradient key={id} id={id} cx="35%" cy="35%" r="75%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="35%" stopColor={c} />
                    <stop offset="100%" stopColor={c} stopOpacity="0.75" />
                  </radialGradient>
                ))}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {edges.map((e, i) => {
                const a = byId.get(e.s), b = byId.get(e.t)
                if (!a || !b) return null
                const on = !focus || e.s === focus || e.t === focus
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
                const dx = b.x - a.x, dy = b.y - a.y
                const cx = mx - dy * 0.12, cy = my + dx * 0.12
                return (
                  <path key={i} d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} fill="none" stroke={SRC} strokeLinecap="round" strokeOpacity={on ? 0.55 : 0.06} strokeWidth={0.7 + (3.6 * Math.log(1 + e.count)) / Math.log(1 + maxEdge)}>
                    <title>{`${e.s} → ${e.t}: ${e.count.toLocaleString()}`}</title>
                  </path>
                )
              })}
              {nodes.map((n) => {
                const r = 5 + (11 * Math.sqrt(n.weight)) / Math.sqrt(maxNode)
                const linked = focus && (n.id === focus || edges.some((e) => (e.s === focus && e.t === n.id) || (e.t === focus && e.s === n.id)))
                const dim = focus && !linked
                const grad = n.side === 'a' ? 'gs' : n.side === 'b' ? 'gd' : 'gb'
                return (
                  <g key={n.id} opacity={dim ? 0.2 : 1} style={{ cursor: 'pointer' }} onClick={() => setSelected(n.id === selected ? null : n.id)} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                    <circle cx={n.x} cy={n.y} r={r + (n.id === selected ? 3 : 0)} fill={`url(#${grad})`} filter="url(#glow)" style={{ stroke: n.id === selected ? 'var(--text-strong)' : 'var(--panel-dark)' }} strokeWidth="1.5" />
                    {(r > 9 || n.id === focus || linked) && (
                      <text x={n.x} y={n.y - r - 5} textAnchor="middle" fontSize="10.5" fontWeight="600" style={{ fill: 'var(--text-strong)', stroke: 'var(--panel-dark)', strokeWidth: 3, paintOrder: 'stroke' }}>
                        {n.id.length > 24 ? n.id.slice(0, 23) + '…' : n.id}
                      </text>
                    )}
                    <title>{`${n.id}: ${n.weight.toLocaleString()} documents`}</title>
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="muted small" style={{ margin: '.5rem 0 0' }}>Node size and line width scale with document count. Hover to highlight neighbours, click a node to pin it.</p>
        </section>

        <aside className="conn-side">
          <section className="ov-card">
            <header><h3>Top talkers</h3><span>by documents</span></header>
            <ul className="ov-bars">
              {talkers.map((n) => (
                <li key={n.id} onClick={() => setSelected(n.id === selected ? null : n.id)} style={{ cursor: 'pointer' }}>
                  <span className="ov-bar-label" title={n.id}>{n.id}</span>
                  <span className="ov-bar-track"><span style={{ width: `${Math.max(3, (n.weight / maxNode) * 100)}%`, background: colorOf(n.side) }} /></span>
                  <b>{n.weight.toLocaleString()}</b>
                </li>
              ))}
              {talkers.length === 0 && <li className="muted">Nothing to show</li>}
            </ul>
          </section>
          {sel && (
            <section className="ov-card">
              <header><h3>{sel.id}</h3><span>{sel.weight.toLocaleString()} documents</span></header>
              <ul className="ov-list">
                {selEdges.slice(0, 12).map((e, i) => (
                  <li key={i}><i className="on" /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.s === selected ? `→ ${e.t}` : `← ${e.s}`}</span><em>{e.count.toLocaleString()}</em></li>
                ))}
              </ul>
              <div className="ov-links" style={{ marginTop: '.7rem' }}>
                {isIp && (
                  <>
                    <Link to={`/sessions?expression=${encodeURIComponent(`ip == ${selected}`)}`}>Sessions</Link>
                    <Link to={`/assets?tab=ips&q=${encodeURIComponent(selected!)}`}>Asset</Link>
                  </>
                )}
                <Link to="/explorer">Explorer</Link>
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}

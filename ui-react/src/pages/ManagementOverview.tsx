import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatBytes, getJSON, osProxy } from '../api'
import { catalog } from '../data/catalog'
import RangeSelect from '../components/RangeSelect'
import { RANGES, rangeParams } from '../lib/query'

// Management > Overview: a single-screen summary of the server, built only from live API reads.
const PALETTE = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#a78bfa', '#2dd4bf']
const nf = (n: number) => n.toLocaleString()

function parseSize(s: unknown): number {
  const m = /^([\d.]+)\s*(b|kb|mb|gb|tb|pb)$/i.exec(String(s ?? '').trim())
  if (!m) return 0
  const pow = ['b', 'kb', 'mb', 'gb', 'tb', 'pb'].indexOf(m[2].toLowerCase())
  return parseFloat(m[1]) * 1024 ** pow
}

// "arkime_sessions3-260311h12" -> "arkime_sessions3"; "malcolm_beats_zeek_2026..." keeps its family.
function family(name: string): string {
  return name
    .replace(/^\./, 'system: ')
    .replace(/[-_]\d{4}\.\d{2}\.\d{2}([-_]\d+)?$/, '')
    .replace(/[-_]\d{2}w\d{2}$/, '')
    .replace(/[-_]\d{2,6}[a-z]?\d*$/i, '')
    .replace(/[-_]v\d+$/i, '')
}

function Kpi({ label, value, hint, color, onClick }: { label: string; value: string; hint?: string; color: string; onClick?: () => void }) {
  return (
    <button className="ov-kpi" style={{ ['--c' as any]: color }} onClick={onClick} disabled={!onClick}>
      <span className="ov-kpi-label">{label}</span>
      <span className="ov-kpi-value">{value}</span>
      {hint && <span className="ov-kpi-hint">{hint}</span>}
    </button>
  )
}

function Card({ title, sub, children, span }: { title: string; sub?: string; children: ReactNode; span?: number }) {
  return (
    <section className="ov-card" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <header>
        <h3>{title}</h3>
        {sub && <span>{sub}</span>}
      </header>
      {children}
    </section>
  )
}

function Area({ pts, hourly }: { pts: { t: number; v: number }[]; hourly?: boolean }) {
  const fmt = (t: number) => (hourly ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }) : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 220, L = 44, R = 12, T = 14, B = 26
  const max = Math.max(1, ...pts.map((p) => p.v))
  const nice = Math.pow(10, Math.floor(Math.log10(max)))
  const top = Math.ceil(max / nice) * nice
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(pts.length - 1)},${H - B} L${x(0)},${H - B} Z`
  const h = hover === null ? null : pts[hover]
  return (
    <div className="ov-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Events per day" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ovg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(top * f)} y2={y(top * f)} style={{ stroke: 'var(--border-dark)' }} strokeDasharray="3 4" />
            <text x={L - 6} y={y(top * f) + 4} textAnchor="end" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{top * f >= 1000 ? `${Math.round((top * f) / 1000)}k` : Math.round(top * f)}</text>
          </g>
        ))}
        <path d={area} fill="url(#ovg)" />
        <path d={line} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <rect key={i} x={x(i) - (W - L - R) / pts.length / 2} y={T} width={(W - L - R) / pts.length} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {pts.map((p, i) => (i % Math.ceil(pts.length / 6) === 0) && (
          <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{fmt(p.t)}</text>
        ))}
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#38bdf8" strokeOpacity="0.5" />
            <circle cx={x(hover)} cy={y(h.v)} r="4" style={{ fill: 'var(--panel-dark)' }} stroke="#38bdf8" strokeWidth="2" />
            <g transform={`translate(${Math.min(x(hover) + 8, W - 140)},${T + 4})`}>
              <rect width="132" height="38" rx="6" style={{ fill: 'var(--panel-dark)', stroke: 'var(--tip-border)' }} />
              <text x="8" y="16" fontSize="11" style={{ fill: 'var(--muted-2)' }}>{fmt(h.t)}</text>
              <text x="8" y="31" fontSize="13" fontWeight="700" style={{ fill: 'var(--text-strong)' }}>{nf(h.v)} events</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

function Donut({ data, center, sub }: { data: { label: string; value: number }[]; center: string; sub: string }) {
  const [hi, setHi] = useState<number | null>(null)
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const R = 62, C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="ov-donut">
      <svg viewBox="0 0 180 180" role="img" aria-label={sub}>
        <circle cx="90" cy="90" r={R} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.value / total) * C
          const el = (
            <circle key={d.label} cx="90" cy="90" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={hi === i ? 24 : 20} strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 90 90)" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: 'stroke-width .15s' }} />
          )
          acc += len
          return el
        })}
        <text x="90" y="88" textAnchor="middle" fontSize="22" fontWeight="700" style={{ fill: 'var(--text-strong)' }}>{hi === null ? center : nf(data[hi].value)}</text>
        <text x="90" y="106" textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{hi === null ? sub : data[hi].label.slice(0, 22)}</text>
      </svg>
      <ul>
        {data.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={hi === i ? 'on' : ''}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span title={d.label}>{d.label}</span>
            <b>{Math.round((d.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HBars({ data, fmt }: { data: { label: string; value: number; to?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="ov-bars">
      {data.map((d, i) => (
        <li key={d.label}>
          <span className="ov-bar-label" title={d.label}>{d.to ? <Link to={d.to}>{d.label}</Link> : d.label}</span>
          <span className="ov-bar-track"><span style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length]}, ${PALETTE[(i + 1) % PALETTE.length]})` }} /></span>
          <b>{(fmt ?? nf)(d.value)}</b>
        </li>
      ))}
    </ul>
  )
}

export default function Overview({ onTab }: { onTab: (t: any) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [vizTypes, setVizTypes] = useState<{ label: string; value: number }[]>([])
  const [recent, setRecent] = useState<{ id: string; title: string; at: string }[]>([])
  const [indices, setIndices] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [version, setVersion] = useState<any>(null)
  const [events, setEvents] = useState<{ t: number; v: number }[] | null>(null)
  const [hourly, setHourly] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [datasets, setDatasets] = useState<{ label: string; value: number }[]>([])
  const [plug, setPlug] = useState<{ monitors: any[]; detectors: number; channels: number; alerts: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('all')

  useEffect(() => {
    let alive = true
    const set = <T,>(fn: (v: T) => void) => (v: T) => alive && fn(v)
    const fail = (e: any) => alive && setError(e?.message ?? String(e))

    for (const type of ['dashboard', 'visualization', 'search', 'index-pattern']) {
      getJSON('/dashboards/api/saved_objects/_find', { type, per_page: 1, fields: 'title' })
        .then((r) => alive && setCounts((c) => ({ ...c, [type]: r?.total ?? 0 })))
        .catch(fail)
    }
    getJSON('/dashboards/api/saved_objects/_find', { type: 'visualization', per_page: 1000, fields: 'visState' })
      .then((r) => {
        const m = new Map<string, number>()
        for (const o of r?.saved_objects ?? []) {
          let t = 'other'
          try { t = JSON.parse(o.attributes?.visState ?? '{}').type || 'other' } catch { /* ignore */ }
          m.set(t, (m.get(t) ?? 0) + 1)
        }
        const all = [...m.entries()].sort((a, b) => b[1] - a[1])
        const top = all.slice(0, 7).map(([label, value]) => ({ label, value }))
        const rest = all.slice(7).reduce((a, [, v]) => a + v, 0)
        if (rest) top.push({ label: 'other types', value: rest })
        if (alive) setVizTypes(top)
      })
      .catch(fail)
    getJSON('/dashboards/api/saved_objects/_find', { type: 'dashboard', per_page: 200, fields: 'title' })
      .then((r) => {
        const list = (r?.saved_objects ?? []).map((o: any) => ({ id: o.id, title: o.attributes?.title ?? o.id, at: o.updated_at ?? '' }))
        list.sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
        if (alive) setRecent(list.slice(0, 7))
      })
      .catch(fail)
    getJSON('/mapi/indices').then((r) => alive && setIndices(r?.indices ?? [])).catch(fail)
    getJSON('/mapi/version').then(set(setVersion)).catch(() => undefined)
    osProxy('GET', '_cluster/health').then((r) => alive && setHealth(r.json)).catch(() => undefined)

    Promise.all([
      osProxy('GET', '_plugins/_alerting/monitors/_search', { size: 200, query: { match_all: {} } }),
      osProxy('GET', '_plugins/_anomaly_detection/detectors/_search', { size: 200, query: { match_all: {} } }),
      osProxy('GET', '_plugins/_notifications/configs'),
      osProxy('GET', '_plugins/_alerting/monitors/alerts?size=200'),
    ])
      .then(([m, d, c, a]) => {
        if (!alive) return
        setPlug({
          monitors: (m.json?.hits?.hits ?? []).map((h: any) => ({ id: h._id, ...(h._source?.monitor ?? h._source ?? {}) })),
          detectors: (d.json?.hits?.hits ?? []).length,
          channels: (c.json?.config_list ?? []).length,
          alerts: (a.json?.alerts ?? []).length,
        })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // events chart, total and dataset split follow the selected time range
  useEffect(() => {
    let alive = true
    const fail = (e: any) => alive && setError(e?.message ?? String(e))
    const now = Date.now()
    const DAY = 24 * 3600e3
    const count = (from: number, to: number) =>
      getJSON('/mapi/document', { from: String(Math.floor(from / 1000)), to: String(Math.floor(to / 1000) - 1), limit: 0, track_total_hits: 'true' }).then((r) => (typeof r?.total === 'object' && r.total ? r.total.value : (r?.total ?? 0)))
    const buckets = (start: number, end: number, n: number) => {
      const step = (end - start) / n
      return Promise.all(Array.from({ length: n }, (_, i) => count(start + i * step, start + (i + 1) * step).then((v: number) => ({ t: start + i * step, v }))))
    }
    setEvents(null)
    setHourly(false)
    const r = RANGES.find((x) => x.key === range)
    if (r && r.ms) {
      const n = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 28 : 30
      buckets(now - r.ms, now, n)
        .then((list) => {
          if (!alive) return
          setEvents(list)
          setHourly(range !== '30d')
        })
        .catch(fail)
    } else {
      // all time: 30 daily buckets, then zoom into hours when everything landed in a few days
      buckets(now - 30 * DAY, now, 30)
        .then(async (daily) => {
          if (!alive) return
          setEvents(daily)
          const live = daily.filter((d) => d.v > 0)
          if (!live.length || live.length > 3) return
          const from = live[0].t
          const to = live[live.length - 1].t + DAY
          const N = Math.min(72, Math.max(24, Math.round((to - from) / 3600e3)))
          const hrs = await buckets(from, to, N)
          if (alive) {
            setEvents(hrs)
            setHourly(true)
          }
        })
        .catch(fail)
    }
    const { from } = rangeParams(range, now)
    setTotal(null)
    getJSON('/mapi/document', { from, to: String(Math.floor(now / 1000)), limit: 0, track_total_hits: 'true' })
      .then((x) => alive && setTotal(typeof x?.total === 'object' && x.total ? x.total.value : (x?.total ?? 0)))
      .catch(() => undefined)
    getJSON('/mapi/agg/event.dataset', { from, to: String(Math.floor(now / 1000)), limit: 8 })
      .then((x) => alive && setDatasets((x?.['event.dataset']?.buckets ?? []).map((b: any) => ({ label: String(b.key), value: b.doc_count }))))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [range])

  const families = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of indices) m.set(family(String(r.index)), (m.get(family(String(r.index))) ?? 0) + (Number(r['docs.count']) || 0))
    const all = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    const top = all.slice(0, 6).map(([label, value]) => ({ label, value }))
    const rest = all.slice(6).reduce((a, [, v]) => a + v, 0)
    if (rest) top.push({ label: 'others', value: rest })
    return top
  }, [indices])
  const docs = indices.reduce((a, r) => a + (Number(r['docs.count']) || 0), 0)
  const bytes = indices.reduce((a, r) => a + parseSize(r['store.size']), 0)
  const biggest = useMemo(
    () => [...indices].map((r) => ({ label: String(r.index), value: parseSize(r['store.size']) })).sort((a, b) => b.value - a.value).slice(0, 7),
    [indices],
  )
  const status = String(health?.status ?? '').toLowerCase()
  const statusColor = status === 'green' ? '#34d399' : status === 'yellow' ? '#fbbf24' : status ? '#f87171' : '#7d8da1'
  const enabled = plug?.monitors.filter((m) => m.enabled).length ?? 0
  const busiest = events ? events.reduce((b, p) => (p.v > b.v ? p : b), events[0]) : null

  return (
    <div className="ov">
      {error && <p className="err">Some figures could not be loaded: {error}</p>}

      <div className="ov-hero">
        <div>
          <h2>Server overview</h2>
          <p>
            {version?.mode ? `${version.mode} mode` : 'Live server'}
            {health?.cluster_name ? ` · cluster ${health.cluster_name}` : ''}
            {health?.number_of_nodes ? ` · ${health.number_of_nodes} node${health.number_of_nodes > 1 ? 's' : ''}` : ''}
            {health?.active_shards ? ` · ${health.active_shards} shards` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <RangeSelect value={range} onChange={setRange} />
          <span className="ov-health" style={{ ['--c' as any]: statusColor }}>
            <i /> {status ? `Cluster ${status}` : 'Checking cluster…'}
          </span>
        </div>
      </div>

      <div className="ov-kpis">
        <Kpi label="Events stored" value={total === null ? '…' : nf(total)} hint={(RANGES.find((x) => x.key === range)?.label ?? 'All time').toLowerCase()} color="#38bdf8" onClick={() => onTab('indices')} />
        <Kpi label="Disk used" value={indices.length ? formatBytes(bytes) : '…'} hint={`${indices.length} indices`} color="#818cf8" onClick={() => onTab('indices')} />
        <Kpi label="Dashboards" value={nf(counts.dashboard ?? 0)} hint="ready to open" color="#34d399" onClick={() => onTab('dashboard')} />
        <Kpi label="Visualizations" value={nf(counts.visualization ?? 0)} color="#fbbf24" onClick={() => onTab('visualization')} />
        <Kpi label="Saved searches" value={nf(counts.search ?? 0)} color="#f472b6" onClick={() => onTab('search')} />
        <Kpi label="Alert monitors" value={plug ? `${enabled}/${plug.monitors.length}` : '…'} hint="enabled" color="#fb923c" onClick={() => onTab('monitors')} />
      </div>

      <div className="ov-grid">
        <Card title={hourly ? 'Events per hour' : 'Events per day'} sub={busiest && busiest.v ? `peak ${new Date(busiest.t).toLocaleString(undefined, hourly ? { month: 'short', day: 'numeric', hour: 'numeric' } : { month: 'short', day: 'numeric' })} · ${nf(busiest.v)}` : (RANGES.find((x) => x.key === range)?.label ?? 'Last 30 days').toLowerCase()} span={8}>
          {events ? <Area pts={events} hourly={hourly} /> : <p className="muted">Loading…</p>}
        </Card>
        <Card title="Where the events come from" sub="by dataset" span={4}>
          {datasets.length ? <Donut data={datasets} center={total ? (total >= 1000 ? `${Math.round(total / 1000)}k` : String(total)) : '…'} sub="events" /> : <p className="muted">Loading…</p>}
        </Card>

        <Card title="Largest indices" sub="by disk size" span={4}>
          {biggest.length ? <HBars data={biggest} fmt={formatBytes} /> : <p className="muted">Loading…</p>}
        </Card>
        <Card title="Documents by index family" sub={`${nf(docs)} documents`} span={4}>
          {families.length ? <Donut data={families} center={docs >= 1000 ? `${Math.round(docs / 1000)}k` : String(docs)} sub="documents" /> : <p className="muted">Loading…</p>}
        </Card>
        <Card title="Visualization types" sub={`${nf(counts.visualization ?? 0)} total`} span={4}>
          {vizTypes.length ? <HBars data={vizTypes} /> : <p className="muted">Loading…</p>}
        </Card>

        <Card title="Alerting & detection" sub="live from the server" span={4}>
          {plug ? (
            <div className="ov-stats">
              <button onClick={() => onTab('monitors')}><b>{plug.monitors.length}</b><span>monitors</span></button>
              <button onClick={() => onTab('detectors')}><b>{plug.detectors}</b><span>anomaly detectors</span></button>
              <button onClick={() => onTab('channels')}><b>{plug.channels}</b><span>channels</span></button>
              <button onClick={() => onTab('alerts')}><b>{plug.alerts}</b><span>active alerts</span></button>
            </div>
          ) : (
            <p className="muted">Loading…</p>
          )}
          {plug && plug.monitors.length > 0 && (
            <ul className="ov-list">
              {plug.monitors.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <i className={m.enabled ? 'on' : ''} />
                  <Link to={`/management/plugin/monitors/${encodeURIComponent(m.id)}`}>{m.name ?? m.id}</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recently updated dashboards" sub="newest first" span={4}>
          {recent.length ? (
            <ul className="ov-list">
              {recent.map((d) => {
                const known = catalog.dashboards.find((c) => c.id === d.id)
                return (
                  <li key={d.id}>
                    <i className="on" />
                    <Link to={known ? `/dashboards/${known.slug}` : `/dashboards/saved/${encodeURIComponent(d.id)}`}>{d.title}</Link>
                    <em>{d.at ? new Date(d.at).toLocaleDateString() : ''}</em>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="muted">Loading…</p>
          )}
        </Card>
        <Card title="Jump to" sub="shortcuts" span={4}>
          <div className="ov-links">
            <Link to="/dashboards">All dashboards</Link>
            <Link to="/explorer">Explorer</Link>
            <Link to="/console">Console</Link>
            <button onClick={() => onTab('index-pattern')}>Index patterns</button>
            <button onClick={() => onTab('fields')}>Fields</button>
            <button onClick={() => onTab('indices')}>Indices</button>
          </div>
        </Card>
      </div>
    </div>
  )
}

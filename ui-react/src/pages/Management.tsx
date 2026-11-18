import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, osProxy } from '../api'
import { catalog } from '../data/catalog'
import Overview from './ManagementOverview'
import PageHero from '../components/PageHero'
import RangeSelect from '../components/RangeSelect'
import { niceName } from '../lib/relabel'
import { inRange } from '../lib/query'
import ManagementDashboards from './ManagementDashboards'

// Read-only counterpart of the original Dashboards "Dashboards Management" / "Index Management" areas:
//  - saved objects (dashboards, visualizations, saved searches, index patterns): /dashboards/api/saved_objects/_find
//  - indices: /mapi/indices      - fields: /mapi/fields
type Tab = 'overview' | 'dashboard' | 'visualization' | 'search' | 'index-pattern' | 'indices' | 'fields' | 'monitors' | 'detectors' | 'channels' | 'alerts'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'dashboard', label: 'Dashboards' },
  { id: 'visualization', label: 'Visualizations' },
  { id: 'search', label: 'Saved searches' },
  { id: 'index-pattern', label: 'Index patterns' },
  { id: 'indices', label: 'Indices' },
  { id: 'fields', label: 'Fields' },
  { id: 'monitors', label: 'Alerting monitors' },
  { id: 'detectors', label: 'Anomaly detectors' },
  { id: 'channels', label: 'Notification channels' },
  { id: 'alerts', label: 'Active alerts' },
]
const PER_PAGE = 25

interface SavedObject {
  id: string
  type: string
  updated_at?: string
  attributes: { title?: string; description?: string; visState?: string }
}

const visType = (o: SavedObject) => {
  try {
    return JSON.parse(o.attributes.visState ?? '{}').type ?? ''
  } catch {
    return ''
  }
}

function SavedObjects({ type }: { type: 'dashboard' | 'visualization' | 'search' | 'index-pattern' }) {
  const [allRows, setAllRows] = useState<SavedObject[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('7d')

  useEffect(() => setPage(1), [type, search, range])
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params: Record<string, string | number | undefined> = {
      type,
      per_page: range === 'all' ? PER_PAGE : 1000,
      page: range === 'all' ? page : 1,
    }
    if (search) {
      params.search = `${search}*`
      params.search_fields = 'title'
    }
    getJSON('/dashboards/api/saved_objects/_find', params)
      .then((r) => {
        if (!alive) return
        const list = [...(r?.saved_objects ?? [])].filter((o: SavedObject) => inRange(o.updated_at, range)).sort((a: SavedObject, b: SavedObject) => String(a.attributes.title ?? '').localeCompare(String(b.attributes.title ?? '')))
        setAllRows(list)
        setTotal(range === 'all' ? (r?.total ?? 0) : list.length)
        setError(null)
      })
      .catch((e) => alive && setError(e.message ?? String(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [type, page, search, range])

  const rows = range === 'all' ? allRows : allRows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  return (
    <>
      <div className="toolbar">
        <input placeholder="Search by title…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setSearch(text.trim())} />
        <button className="btn" onClick={() => setSearch(text.trim())}>Search</button>
        <RangeSelect value={range} onChange={setRange} label="Updated within" />
        <span className="muted small">{loading ? 'Loading…' : `${total.toLocaleString()} found`}</span>
      </div>
      {error && <p className="err">Could not load saved objects: {error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              {type === 'visualization' && <th>Type</th>}
              {(type === 'dashboard' || type === 'search') && <th>Description</th>}
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.type === 'dashboard' ? (
                    <Link to={catalog.dashboards.find((d) => d.id === o.id) ? `/dashboards/${catalog.dashboards.find((d) => d.id === o.id)!.slug}` : `/dashboards/saved/${encodeURIComponent(o.id)}`}>{niceName(String(o.attributes.title ?? o.id))}</Link>
                  ) : (
                    <Link to={`/management/${o.type}/${encodeURIComponent(niceName(o.id))}`}>{niceName(String(o.attributes.title ?? o.id))}</Link>
                  )}
                  {o.type === 'dashboard' && <> <Link className="muted small" to={`/management/dashboard/${encodeURIComponent(o.id)}`}>details</Link></>}
                </td>
                {type === 'visualization' && <td>{visType(o)}</td>}
                {(type === 'dashboard' || type === 'search') && <td className="muted small">{(o.attributes.description ?? '').slice(0, 100)}</td>}
                <td className="muted small">{o.updated_at ? new Date(o.updated_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="muted">Nothing found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar" style={{ marginTop: '0.5rem' }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="muted small">Page {page} of {pages}</span>
        <button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </>
  )
}

function Indices() {
  const [rows, setRows] = useState<any[]>([])
  const [pattern, setPattern] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    getJSON('/mapi/indices')
      .then((r) => {
        setRows(r?.indices ?? [])
        setPattern(r?.arkime_network_index_pattern ?? '')
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
  }, [])
  useEffect(load, [load])
  const sorted = useMemo(() => [...rows].sort((a, b) => String(a.index).localeCompare(String(b.index))), [rows])
  const docs = rows.reduce((a, r) => a + (Number(r['docs.count']) || 0), 0)
  return (
    <>
      <div className="toolbar">
        <span className="muted small">{rows.length} indices, {docs.toLocaleString()} documents{pattern ? ` · session index pattern ${pattern}` : ''}</span>
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      {error && <p className="err">Could not load indices: {error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Index</th><th>Health</th><th>Status</th><th>Documents</th><th>Size</th><th>Primaries</th><th>Replicas</th></tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.index}>
                <td>{niceName(String(r.index))}</td>
                <td>{r.health}</td>
                <td>{r.status}</td>
                <td>{Number(r['docs.count'] ?? 0).toLocaleString()}</td>
                <td>{r['store.size'] ?? '—'}</td>
                <td>{r.pri ?? '—'}</td>
                <td>{r.rep ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Fields() {
  const [fields, setFields] = useState<Record<string, { type?: string; description?: string }>>({})
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getJSON('/mapi/fields')
      .then((r) => {
        setFields(r?.fields ?? {})
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
  }, [])
  const rows = useMemo(() => {
    const t = text.toLowerCase()
    return Object.entries(fields)
      .filter(([k, v]) => !t || k.toLowerCase().includes(t) || (v.description ?? '').toLowerCase().includes(t))
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [fields, text])
  return (
    <>
      <div className="toolbar">
        <input placeholder="Filter fields…" value={text} onChange={(e) => setText(e.target.value)} />
        <span className="muted small">{rows.length.toLocaleString()} of {Object.keys(fields).length.toLocaleString()} fields</span>
      </div>
      {error && <p className="err">Could not load fields: {error}</p>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map(([k, v]) => (
              <tr key={k}><td>{niceName(k)}</td><td>{v.type ?? ''}</td><td className="muted small">{v.description ?? ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 500 && <p className="muted small">Showing the first 500; narrow the filter to see the rest.</p>}
    </>
  )
}


// Alerting monitors, anomaly detectors, notification channels and active alerts, read through the console proxy.
interface PluginRow { id: string; name: string; kind: string; detail: string; state: string; when: string; ts: number }
const tsOf = (v: unknown) => {
  const n = Number(v)
  return n > 1e9 ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(v ?? '')) || 0
}
const when = (v: unknown) => {
  const n = Number(v)
  return n > 1e9 ? new Date(n < 1e12 ? n * 1000 : n).toLocaleString() : typeof v === 'string' ? v : ''
}
const schedule = (sch: any) => (sch?.period ? `every ${sch.period.interval} ${String(sch.period.unit ?? '').toLowerCase()}` : sch?.cron ? `cron ${sch.cron.expression}` : '')
const PLUGIN: Record<string, { path: string; body?: unknown; rows: (j: any) => PluginRow[] }> = {
  monitors: {
    path: '_plugins/_alerting/monitors/_search',
    body: { size: 200, query: { match_all: {} } },
    rows: (j) =>
      (j?.hits?.hits ?? []).map((h: any) => {
        const m = h._source?.monitor ?? h._source ?? {}
        return { id: h._id, name: m.name ?? h._id, kind: m.monitor_type ?? '', detail: `${schedule(m.schedule)} · ${(m.triggers ?? []).length} triggers`, state: m.enabled ? 'enabled' : 'disabled', when: when(m.last_update_time), ts: tsOf(m.last_update_time) }
      }),
  },
  detectors: {
    path: '_plugins/_anomaly_detection/detectors/_search',
    body: { size: 200, query: { match_all: {} } },
    rows: (j) =>
      (j?.hits?.hits ?? []).map((h: any) => ({ id: h._id, name: h._source?.name ?? h._id, kind: 'detector', detail: (h._source?.indices ?? []).join(', '), state: h._source?.enabled_time ? 'enabled' : 'stopped', when: when(h._source?.last_update_time), ts: tsOf(h._source?.last_update_time) })),
  },
  channels: {
    path: '_plugins/_notifications/configs?max_items=200',
    rows: (j) =>
      (j?.config_list ?? []).map((c: any) => ({ id: c.config_id, name: c.config?.name ?? c.config_id, kind: c.config?.config_type ?? '', detail: c.config?.description ?? '', state: c.config?.is_enabled ? 'enabled' : 'disabled', when: when(c.last_updated_time_ms), ts: tsOf(c.last_updated_time_ms) })),
  },
  alerts: {
    path: '_plugins/_alerting/monitors/alerts?size=200',
    rows: (j) =>
      (j?.alerts ?? []).map((a: any) => ({ id: '', name: `${a.monitor_name ?? ''} / ${a.trigger_name ?? ''}`, kind: `severity ${a.severity ?? ''}`, detail: a.error_message ?? '', state: String(a.state ?? '').toLowerCase(), when: when(a.start_time), ts: tsOf(a.start_time) })),
  },
}

function PluginList({ kind }: { kind: 'monitors' | 'detectors' | 'channels' | 'alerts' }) {
  const [all, setRows] = useState<PluginRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('7d')
  const rows = useMemo(() => (all ? all.filter((r) => inRange(r.ts, range)) : null), [all, range])
  useEffect(() => {
    let alive = true
    setRows(null)
    const def = PLUGIN[kind]
    osProxy('GET', def.path, def.body)
      .then((r) => {
        if (!alive) return
        if (r.json?.error) setError(typeof r.json.error === 'string' ? r.json.error : r.json.error.reason ?? 'The server could not answer this request.')
        else {
          setError(null)
          setRows(def.rows(r.json))
        }
      })
      .catch((e) => alive && setError(e.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [kind])
  return (
    <>
      {error && <p className="err">Could not load: {error}</p>}
      {rows && (
        <>
          <div className="toolbar">
            <RangeSelect value={range} onChange={setRange} label="Updated within" />
            <span className="muted small">{rows.length} found on the server</span>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Type</th><th>Details</th><th>State</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td>{r.id ? <Link to={`/management/plugin/${kind}/${encodeURIComponent(r.id)}`}>{r.name}</Link> : r.name}</td>
                    <td>{r.kind}</td>
                    <td className="muted small">{niceName(String(r.detail ?? ''))}</td>
                    <td>{r.state}</td>
                    <td className="muted small">{r.when}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="muted">None on this server.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

export default function Management() {
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <>
      <PageHero icon="🧰" title="Management" sub="Everything stored on this server — dashboards, visualizations, saved searches, indices, alerting and more. Open any item for its details." to="/console" linkLabel="Console →" />
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'overview' ? <Overview onTab={setTab} /> : tab === 'dashboard' ? <ManagementDashboards /> : tab === 'indices' ? <Indices /> : tab === 'fields' ? <Fields /> : tab === 'monitors' ? <PluginList kind="monitors" /> : tab === 'detectors' ? <PluginList kind="detectors" /> : tab === 'channels' ? <PluginList kind="channels" /> : tab === 'alerts' ? <PluginList kind="alerts" /> : <SavedObjects type={tab as 'dashboard' | 'visualization' | 'search' | 'index-pattern'} />}
    </>
  )
}
